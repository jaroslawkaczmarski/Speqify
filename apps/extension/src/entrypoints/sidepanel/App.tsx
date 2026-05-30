import { useEffect, useRef, useState } from "react";
import { browser } from "#imports";
import {
  emptyTicket,
  submitTicket,
  type CaptureContext,
  type ElementInfo,
  type SubmitResult,
  type Ticket,
} from "@speqify/core";
import { trackerDisplay, useSettings } from "@/store";
import { captureScreenshot, endCapture, getContext, onLiveClick, pickArea, pickElement, startCapture } from "@/capture-client";
import { aiReady, aiReason, draftReady, draftTicket, transcribeAudio } from "@/ai";
import { probeNano } from "@/ai/chrome-ai";
import { startRecording, CaptureCancelled, type ActiveRecorder, type CropRegion } from "@/panel/recorder";
import { deleteDraft, listDrafts, newDraftId, saveDraft, type DraftRecord } from "@/panel/drafts-db";
import { Shell, type PanelView } from "@/panel/Shell";
import { Onboarding } from "@/panel/Onboarding";
import { SourcePicker } from "@/panel/SourcePicker";
import { Recording } from "@/panel/Recording";
import { Review } from "@/panel/Review";
import { Drafts } from "@/panel/Drafts";
import { ArmedConfirm } from "@/panel/ArmedConfirm";
import { Sending, Success, Transcribing, type TranscribePhase } from "@/panel/FlowStates";

type FlowState = "idle" | "armed" | "recording" | "transcribing" | "review" | "sending" | "success";

function hostOf(url: string | undefined): string {
  if (!url) return "the page";
  try {
    return new URL(url).hostname;
  } catch {
    return "the page";
  }
}

function stubDraft(ctx?: CaptureContext, transcript?: string): Ticket {
  const note = transcript?.trim();
  return {
    ...emptyTicket(),
    type: "bug",
    title: note ? note.slice(0, 80) : `Issue on ${hostOf(ctx?.page.url)}`,
    // With no voice note there's nothing to draft from — leave the description empty
    // for the user to fill rather than injecting placeholder/marketing copy.
    description: note ?? "",
    labels: [],
  };
}

export function App() {
  const hydrated = useSettings((s) => s.hydrated);
  const onboarded = useSettings((s) => s.onboarded);
  const setOnboarded = useSettings((s) => s.setOnboarded);
  const tracker = useSettings((s) => s.tracker);
  const ai = useSettings((s) => s.ai);
  const capture = useSettings((s) => s.capture);
  const templates = useSettings((s) => s.templates);

  const [view, setView] = useState<PanelView>("home");
  const [state, setState] = useState<FlowState>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [phase, setPhase] = useState<TranscribePhase>("transcribe");
  const [context, setContext] = useState<CaptureContext>();
  const [draft, setDraft] = useState<Ticket>(emptyTicket());
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const [displayStream, setDisplayStream] = useState<MediaStream | null>(null);
  const [micAvailable, setMicAvailable] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<DraftRecord[]>([]);
  const [armedCrop, setArmedCrop] = useState<CropRegion | null>(null);
  const sendCancelled = useRef(false);
  const flowCancelled = useRef(false);
  const recorderRef = useRef<ActiveRecorder | null>(null);
  const videoUrlRef = useRef<string | null>(null);
  const videoBlobRef = useRef<Blob | null>(null);
  const shotRef = useRef<string | null>(null);
  const transcriptRef = useRef("");
  const draftIdRef = useRef<string | null>(null);
  const pickedElementRef = useRef<ElementInfo | null>(null);

  const dest = trackerDisplay(tracker);
  const inFlow = state !== "idle";

  const refreshDrafts = () => void listDrafts().then(setDrafts).catch(() => {});
  useEffect(() => refreshDrafts(), []);
  // Probe Chrome's built-in Gemini Nano so drafting can prefer it when present.
  // Re-render once it resolves so the "AI not ready" banner reflects Nano readiness
  // (nanoUsable() is a cached, non-reactive flag otherwise).
  const [, bumpNano] = useState(0);
  useEffect(() => void probeNano().then(() => bumpNano((n) => n + 1)), []);

  // recording timer
  useEffect(() => {
    if (state !== "recording") return;
    setElapsed(0);
    const id = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(id);
  }, [state]);

  const stopMedia = () => {
    recorderRef.current?.cancel();
    recorderRef.current = null;
    setAnalyser(null);
    setDisplayStream(null);
    void endCapture();
  };

  const setRecording = (blob: Blob | null) => {
    if (videoUrlRef.current) URL.revokeObjectURL(videoUrlRef.current);
    const url = blob ? URL.createObjectURL(blob) : null;
    videoUrlRef.current = url;
    videoBlobRef.current = blob;
    setVideoUrl(url);
  };

  const onStop = async () => {
    flowCancelled.current = false;
    const blob = recorderRef.current ? await recorderRef.current.stop() : null;
    recorderRef.current = null;
    setAnalyser(null);
    setDisplayStream(null);
    setRecording(blob);
    setPhase("transcribe");
    setState("transcribing");
    try {
      // Pull context now (steps/console/network accumulated over the recording);
      // merge the screenshot taken when recording started and any picked element.
      const ctx: CaptureContext = {
        ...(await getContext()),
        element: pickedElementRef.current ?? undefined,
        screenshot: shotRef.current ?? undefined,
      };
      void endCapture();
      setContext(ctx);
      const transcript = await transcribeAudio(ai, blob);
      transcriptRef.current = transcript;
      if (flowCancelled.current) return;
      setPhase("draft");
      // Only let the model write the ticket when there's an actual voice note to
      // work from. With no speech it would hallucinate (it never sees the video —
      // only the transcript + page context), so fall back to an editable stub.
      const hasSpeech = transcript.trim().length > 0;
      const d =
        draftReady(ai) && hasSpeech ? await draftTicket(ai, transcript, ctx, templates) : stubDraft(ctx, transcript);
      if (flowCancelled.current) return;
      setDraft(d);
      setState("review");
    } catch (e) {
      if (flowCancelled.current) return;
      setError(e instanceof Error ? e.message : String(e));
      setDraft(stubDraft(context, transcriptRef.current));
      setState("review");
    }
  };

  /** Resolve a crop region for area/element sources (null = user cancelled). */
  const resolveCropRect = async (): Promise<CropRegion | null> => {
    if (capture.source === "area") {
      const a = await pickArea();
      return a?.rect ? { rect: a.rect, viewport: a.viewport } : null;
    }
    const picked = await pickElement();
    if (!picked?.element?.rect) return null;
    pickedElementRef.current = picked.element;
    return { rect: picked.element.rect, viewport: picked.viewport };
  };

  /** Acquire the screen + start recording. Must run inside a fresh user gesture. */
  const beginRecording = async (crop: CropRegion | null) => {
    setError(null);
    try {
      const rec = await startRecording({
        mic: capture.mic,
        source: capture.source,
        quality: capture.quality,
        cursor: capture.cursor,
        crop,
        subscribeClicks: capture.cursor ? onLiveClick : undefined,
        onEnded: () => {
          if (recorderRef.current) void onStop();
        },
      });
      recorderRef.current = rec;
      setArmedCrop(null);
      setDisplayStream(rec.previewStream);
      setAnalyser(rec.analyser);
      setMicAvailable(rec.micAvailable);
      setState("recording");
      void startCapture(capture.repro);
      // Snapshot the starting state of the page.
      void captureScreenshot()
        .then((shot) => {
          shotRef.current = shot;
        })
        .catch(() => {});
    } catch (e) {
      void endCapture();
      if (!(e instanceof CaptureCancelled)) setError(e instanceof Error ? e.message : String(e));
      setState("idle");
    }
  };

  const onStart = async () => {
    setError(null);
    draftIdRef.current = null;
    pickedElementRef.current = null;
    const needsCrop = capture.source === "area" || capture.source === "element";
    if (needsCrop) {
      // Pick the region on the page first, then re-arm: getDisplayMedia needs a
      // fresh gesture, which the page-overlay picker would otherwise consume.
      const region = await resolveCropRect();
      if (!region) return; // cancelled — stay on the picker
      setArmedCrop(region);
      setState("armed");
      return;
    }
    void beginRecording(null);
  };

  const onArmedCancel = () => {
    pickedElementRef.current = null;
    setArmedCrop(null);
    setState("idle");
  };

  const onArmedReselect = async () => {
    const region = await resolveCropRect();
    if (region) setArmedCrop(region);
  };

  const onCancel = () => {
    flowCancelled.current = true;
    sendCancelled.current = true;
    stopMedia();
    setArmedCrop(null);
    setState("idle");
    setContext(undefined);
  };

  const onSend = async () => {
    if (!tracker) return;
    sendCancelled.current = false;
    setState("sending");
    setError(null);
    try {
      const res = await submitTicket(tracker, { ticket: draft, context });
      if (sendCancelled.current) return;
      // A resumed draft has now shipped — drop it from the drafts list.
      if (draftIdRef.current) {
        await deleteDraft(draftIdRef.current).catch(() => {});
        draftIdRef.current = null;
        refreshDrafts();
      }
      setResult(res);
      setState("success");
    } catch (e) {
      if (sendCancelled.current) return;
      setError(e instanceof Error ? e.message : String(e));
      setState("review");
    }
  };

  const onSendingCancel = () => {
    sendCancelled.current = true;
    setState("review");
  };

  const resetFlow = () => {
    flowCancelled.current = true;
    sendCancelled.current = true;
    stopMedia();
    if (videoUrlRef.current) {
      URL.revokeObjectURL(videoUrlRef.current);
      videoUrlRef.current = null;
    }
    videoBlobRef.current = null;
    shotRef.current = null;
    transcriptRef.current = "";
    pickedElementRef.current = null;
    setArmedCrop(null);
    setVideoUrl(null);
    setState("idle");
    setContext(undefined);
    setResult(null);
    setError(null);
    setDraft(emptyTicket());
  };

  const onDiscard = () => {
    // If this was a saved draft being reviewed, remove it on discard.
    if (draftIdRef.current) {
      void deleteDraft(draftIdRef.current).then(refreshDrafts).catch(() => {});
      draftIdRef.current = null;
    }
    resetFlow();
  };

  const onSaveDraft = async () => {
    const id = draftIdRef.current ?? newDraftId();
    draftIdRef.current = id;
    const rec: DraftRecord = {
      id,
      createdAt: Date.now(),
      title: draft.title.trim() || "Untitled capture",
      ticket: draft,
      context,
      transcript: transcriptRef.current,
      video: videoBlobRef.current,
    };
    try {
      await saveDraft(rec);
      refreshDrafts();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return;
    }
    resetFlow();
    setView("drafts");
  };

  const onResumeDraft = (rec: DraftRecord) => {
    resetFlow();
    draftIdRef.current = rec.id;
    setDraft(rec.ticket);
    setContext(rec.context);
    transcriptRef.current = rec.transcript;
    if (rec.video) {
      const url = URL.createObjectURL(rec.video);
      videoUrlRef.current = url;
      videoBlobRef.current = rec.video;
      setVideoUrl(url);
    }
    setView("home");
    setState("review");
  };

  const onDeleteDraft = (id: string) => {
    void deleteDraft(id).then(refreshDrafts).catch(() => {});
  };

  // Open the options page, optionally deep-linked to a section (e.g. "voice").
  // Reuse an already-open settings tab so we don't pile up duplicates.
  const openSettings = (section?: string) => {
    const base = browser.runtime.getURL("/options.html");
    const url = section ? `${base}#${section}` : base;
    browser.tabs
      .query({})
      .then((tabs) => {
        const existing = tabs.find((t) => t.url?.startsWith(base));
        if (existing?.id != null) {
          void browser.tabs.update(existing.id, { url, active: true });
          if (existing.windowId != null) void browser.windows.update(existing.windowId, { focused: true });
        } else {
          void browser.tabs.create({ url });
        }
      })
      .catch(() => void browser.runtime.openOptionsPage().catch((err) => console.warn("[speqify] openOptionsPage", err)));
  };
  const close = () => window.close();

  // Panel-wide shortcuts: Esc cancels a flow, mod+Enter creates the issue on Review.
  // The actions live in a ref (refreshed every render) so the single listener never
  // captures a stale draft/closure.
  const shortcutsRef = useRef<{ esc: (() => void) | null; submit: (() => void) | null }>({
    esc: null,
    submit: null,
  });
  shortcutsRef.current = {
    esc: state !== "idle" && state !== "sending" ? onCancel : null,
    submit: state === "review" && dest && draft.title.trim() ? onSend : null,
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        shortcutsRef.current.esc?.();
      } else if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && shortcutsRef.current.submit) {
        e.preventDefault();
        shortcutsRef.current.submit();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!hydrated) {
    return (
      <div className="sp" style={{ padding: 19, fontSize: 16, color: "var(--sp-text-3)" }}>
        Loading…
      </div>
    );
  }

  if (!onboarded) {
    return <Onboarding onFinish={() => setOnboarded(true)} onOpenSettings={openSettings} />;
  }

  const mm = String(Math.floor(elapsed / 60));
  const ss = String(elapsed % 60).padStart(2, "0");

  return (
    <Shell>
      {!inFlow && view === "home" && (
        <SourcePicker
          onStart={onStart}
          onCancel={close}
          onDrafts={() => setView("drafts")}
          onSettings={openSettings}
          draftsCount={drafts.length}
          error={error}
          aiNotReady={aiReady(ai) ? null : aiReason(ai)}
        />
      )}
      {!inFlow && view === "drafts" && (
        <Drafts drafts={drafts} onResume={onResumeDraft} onDelete={onDeleteDraft} onBack={() => setView("home")} />
      )}

      {state === "armed" && (
        <ArmedConfirm
          crop={armedCrop}
          source={capture.source}
          onStart={() => void beginRecording(armedCrop)}
          onReselect={onArmedReselect}
          onCancel={onArmedCancel}
        />
      )}

      {inFlow && state !== "armed" && (
        <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
          {state === "recording" && (
            <Recording
              time={`${mm}:${ss}`}
              analyser={analyser}
              displayStream={displayStream}
              micAvailable={micAvailable}
              cursor={capture.cursor}
              repro={capture.repro}
              onStop={onStop}
              onCancel={onCancel}
              onMicChange={(on) => recorderRef.current?.setMicEnabled(on)}
            />
          )}
          {state === "transcribing" && <Transcribing phase={phase} onCancel={onCancel} />}
          {state === "review" && (
            <>
              {error && (
                <p
                  className="sp"
                  style={{ margin: "14px 19px 0", padding: "10px 12px", borderRadius: 10, background: "var(--sp-danger-bg)", border: "1px solid #FECACA", color: "var(--sp-danger)", fontSize: 14 }}
                >
                  {error}
                </p>
              )}
              <Review
                draft={draft}
                onChange={setDraft}
                onSend={onSend}
                onBack={onDiscard}
                onSaveDraft={onSaveDraft}
                destination={dest}
                onSettings={openSettings}
                recordingUrl={videoUrl}
                steps={context?.steps}
                screenshot={context?.screenshot}
                attachment={context ? { label: `Capture · ${hostOf(context.page.url)}`, sub: context.page.url || "Screenshot + context" } : undefined}
              />
            </>
          )}
          {state === "sending" && dest && <Sending kind={dest.kind} name={dest.name} sub={dest.sub} onCancel={onSendingCancel} />}
          {state === "success" && dest && result && (
            <Success kind={dest.kind} name={dest.name} sub={dest.sub} issueKey={result.key ?? result.id} url={result.url} title={draft.title} onNew={resetFlow} />
          )}
        </div>
      )}
    </Shell>
  );
}
