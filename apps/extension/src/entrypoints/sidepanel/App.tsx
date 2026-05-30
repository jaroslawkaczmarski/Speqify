import { useEffect, useRef, useState } from "react";
import { browser } from "#imports";
import {
  emptyTicket,
  submitTicket,
  VIDEO_UPLOAD,
  type CaptureContext,
  type ElementInfo,
  type SubmitResult,
  type Ticket,
} from "@speqify/core";
import { trackerDisplay, useSettings } from "@/store";
import { captureScreenshot, endCapture, getContext, onLiveClick, pickArea, pickElement, startCapture } from "@/capture-client";
import { aiReady, aiReason, draftReady, draftTicket, transcribeAudio } from "@/ai";
import { probeNano } from "@/ai/chrome-ai";
import { startRecording, recordVoiceNote, CaptureCancelled, type ActiveRecorder, type CropRegion, type VoiceNote as VoiceNoteHandle } from "@/panel/recorder";
import { deleteDraft, listDrafts, newDraftId, saveDraft, type DraftRecord } from "@/panel/drafts-db";
import { Shell, type PanelView } from "@/panel/Shell";
import { Onboarding } from "@/panel/Onboarding";
import { SourcePicker } from "@/panel/SourcePicker";
import { Recording } from "@/panel/Recording";
import { Review } from "@/panel/Review";
import { Drafts } from "@/panel/Drafts";
import { ArmedConfirm } from "@/panel/ArmedConfirm";
import { Sending, Success, Transcribing, VoiceNote, type TranscribePhase } from "@/panel/FlowStates";

type FlowState = "idle" | "armed" | "recording" | "voicenote" | "transcribing" | "review" | "sending" | "success";

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

/** Crop a captured screenshot data URL to a picked region (CSS px → image px). */
async function cropDataUrl(dataUrl: string, crop: CropRegion): Promise<string> {
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("screenshot failed to load"));
    img.src = dataUrl;
  });
  const sx = img.naturalWidth / Math.max(1, crop.viewport.w);
  const sy = img.naturalHeight / Math.max(1, crop.viewport.h);
  const x = Math.max(0, Math.round(crop.rect.x * sx));
  const y = Math.max(0, Math.round(crop.rect.y * sy));
  const w = Math.min(img.naturalWidth - x, Math.round(crop.rect.w * sx));
  const h = Math.min(img.naturalHeight - y, Math.round(crop.rect.h * sy));
  if (w <= 0 || h <= 0) return dataUrl;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const c = canvas.getContext("2d");
  if (!c) return dataUrl;
  c.drawImage(img, x, y, w, h, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", 0.85);
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
  const [include, setInclude] = useState({ errors: true, network: true, steps: true });
  const [includeVideo, setIncludeVideo] = useState(true);
  const sendCancelled = useRef(false);
  const flowCancelled = useRef(false);
  const recorderRef = useRef<ActiveRecorder | null>(null);
  const videoUrlRef = useRef<string | null>(null);
  const videoBlobRef = useRef<Blob | null>(null);
  const shotRef = useRef<string | null>(null);
  const transcriptRef = useRef("");
  const draftIdRef = useRef<string | null>(null);
  const pickedElementRef = useRef<ElementInfo | null>(null);
  const voiceNoteRef = useRef<VoiceNoteHandle | null>(null);
  const recordedAudioRef = useRef(false);

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
    if (state !== "recording" && state !== "voicenote") return;
    setElapsed(0);
    const id = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(id);
  }, [state]);

  const stopMedia = () => {
    recorderRef.current?.cancel();
    recorderRef.current = null;
    voiceNoteRef.current?.cancel();
    voiceNoteRef.current = null;
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

  // Transcribe (if there's audio) → AI-draft (if there's speech) → review. The model
  // never sees the video — only the transcript + page context — so with no speech we
  // fall back to an editable stub rather than letting it hallucinate.
  const draftFromAudio = async (blob: Blob | null, ctx: CaptureContext) => {
    setPhase("transcribe");
    setState("transcribing");
    try {
      const transcript = await transcribeAudio(ai, blob);
      transcriptRef.current = transcript;
      if (flowCancelled.current) return;
      setPhase("draft");
      const hasSpeech = transcript.trim().length > 0;
      const d =
        draftReady(ai) && hasSpeech ? await draftTicket(ai, transcript, ctx, templates) : stubDraft(ctx, transcript);
      if (flowCancelled.current) return;
      setDraft(d);
      setState("review");
    } catch (e) {
      if (flowCancelled.current) return;
      setError(e instanceof Error ? e.message : String(e));
      setDraft(stubDraft(ctx, transcriptRef.current));
      setState("review");
    }
  };

  const onStop = async () => {
    // Null the ref synchronously so a manual Stop racing the track-"ended" handler
    // can't pass the guard twice and run the whole draft/endCapture flow twice.
    const rec = recorderRef.current;
    recorderRef.current = null;
    if (!rec) return;
    flowCancelled.current = false;
    const blob = await rec.stop();
    setAnalyser(null);
    setDisplayStream(null);
    setRecording(blob);
    // Pull context now (steps/console/network accumulated over the recording);
    // merge any picked element + the start-of-recording screenshot (if any).
    const ctx: CaptureContext = {
      ...(await getContext()),
      element: pickedElementRef.current ?? undefined,
      screenshot: shotRef.current ?? undefined,
    };
    void endCapture();
    setContext(ctx);
    // No voiceover (mic off/denied) → skip transcription, straight to the form.
    if (!recordedAudioRef.current) {
      setDraft(stubDraft(ctx));
      setState("review");
      return;
    }
    await draftFromAudio(blob, ctx);
  };

  /** Screenshot flow: capture a still (+ optional crop) + context, then either the
   *  editable form (mic off) or a voice note → AI draft (mic on). */
  const captureStill = async (crop: CropRegion | null) => {
    setError(null);
    flowCancelled.current = false;
    recordedAudioRef.current = false;
    try {
      await startCapture(false); // refresh console/network buffers; no steps for a still
      const shot = await captureScreenshot();
      const cropped = shot && crop ? await cropDataUrl(shot, crop) : shot;
      shotRef.current = cropped;
      const ctx: CaptureContext = {
        ...(await getContext()),
        element: pickedElementRef.current ?? undefined,
        screenshot: cropped ?? undefined,
      };
      void endCapture();
      setContext(ctx);
      if (capture.mic) {
        try {
          const vn = await recordVoiceNote();
          voiceNoteRef.current = vn;
          recordedAudioRef.current = true;
          setAnalyser(vn.analyser);
          setState("voicenote");
          return;
        } catch {
          /* mic denied/unavailable — fall through to the editable form */
        }
      }
      setDraft(stubDraft(ctx));
      setState("review");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setDraft(stubDraft());
      setState("review");
    }
  };

  const onVoiceNoteStop = async () => {
    flowCancelled.current = false;
    const vn = voiceNoteRef.current;
    voiceNoteRef.current = null;
    setAnalyser(null);
    const blob = vn ? await vn.stop() : null;
    await draftFromAudio(blob, context ?? (await getContext()));
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
      recordedAudioRef.current = rec.micAvailable;
      setState("recording");
      await startCapture(capture.repro); // await so capturing=true before frames roll (don't drop early clicks)
      // No still for recordings — the video is the evidence (and a screenshot would
      // just duplicate the first frame).
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
    if (capture.mode === "screenshot") {
      // No getDisplayMedia gesture to preserve — pick the region (if any), then shoot.
      const crop = needsCrop ? await resolveCropRect() : null;
      if (needsCrop && !crop) return; // cancelled the picker
      void captureStill(crop);
      return;
    }
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
      // Honor the Review include toggles — drop unchecked groups from the issue body.
      const ctx = context
        ? {
            ...context,
            errors: include.errors ? context.errors : [],
            console: include.errors ? context.console : [],
            network: include.network ? context.network : [],
            steps: include.steps ? context.steps : [],
          }
        : undefined;
      // Attach the recording only when kept (checkbox) and the tracker can host it.
      const video = includeVideo && VIDEO_UPLOAD[tracker.kind] ? videoBlobRef.current : null;
      const res = await submitTicket(tracker, { ticket: draft, context: ctx, video });
      if (sendCancelled.current) return;
      // If an attachment failed, KEEP the draft — it holds the only copy of the recording.
      const keepDraft = Boolean(res.attachmentWarnings?.length && video);
      if (draftIdRef.current && !keepDraft) {
        await deleteDraft(draftIdRef.current).catch(() => {});
        draftIdRef.current = null;
      }
      refreshDrafts();
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
    recordedAudioRef.current = false;
    setArmedCrop(null);
    setVideoUrl(null);
    setState("idle");
    setContext(undefined);
    setResult(null);
    setError(null);
    setDraft(emptyTicket());
    setInclude({ errors: true, network: true, steps: true });
    setIncludeVideo(true);
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
          {state === "voicenote" && (
            <VoiceNote time={`${mm}:${ss}`} analyser={analyser} onStop={onVoiceNoteStop} onCancel={onCancel} />
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
                videoSupported={dest ? VIDEO_UPLOAD[dest.kind] : false}
                includeVideo={includeVideo}
                onIncludeVideo={setIncludeVideo}
                context={context}
                include={include}
                onInclude={setInclude}
                attachment={context ? { label: `Capture · ${hostOf(context.page.url)}`, sub: context.page.url || "Screenshot + context" } : undefined}
              />
            </>
          )}
          {state === "sending" && dest && <Sending kind={dest.kind} name={dest.name} sub={dest.sub} onCancel={onSendingCancel} />}
          {state === "success" && dest && result && (
            <Success kind={dest.kind} name={dest.name} sub={dest.sub} issueKey={result.key ?? result.id} url={result.url} title={draft.title} warnings={result.attachmentWarnings} onNew={resetFlow} />
          )}
        </div>
      )}
    </Shell>
  );
}
