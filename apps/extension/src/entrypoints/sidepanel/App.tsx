import { useEffect, useRef, useState } from "react";
import { browser } from "#imports";
import {
  emptyTicket,
  submitTicket,
  type CaptureContext,
  type SubmitResult,
  type Ticket,
} from "@speqify/core";
import { trackerDisplay, useSettings } from "@/store";
import { captureScreenshot, getContext } from "@/capture-client";
import { aiReady, draftTicket, transcribeAudio } from "@/ai";
import { startRecording, CaptureCancelled, type ActiveRecorder } from "@/panel/recorder";
import { Shell, type PanelView } from "@/panel/Shell";
import { Onboarding } from "@/panel/Onboarding";
import { SourcePicker } from "@/panel/SourcePicker";
import { Recording } from "@/panel/Recording";
import { Review } from "@/panel/Review";
import { Sending, Success, Transcribing } from "@/panel/FlowStates";

type FlowState = "idle" | "recording" | "transcribing" | "review" | "sending" | "success";

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
    description: note
      ? note
      : "Draft from your capture — edit before sending.\n\nConnect a local or remote model in Settings (Voice & AI) and Speqify will write the title, description, and labels from your voice note automatically.",
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

  const [view, setView] = useState<PanelView>("home");
  const [state, setState] = useState<FlowState>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [step, setStep] = useState(0);
  const [context, setContext] = useState<CaptureContext>();
  const [draft, setDraft] = useState<Ticket>(emptyTicket());
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const [displayStream, setDisplayStream] = useState<MediaStream | null>(null);
  const [micAvailable, setMicAvailable] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const sendCancelled = useRef(false);
  const flowCancelled = useRef(false);
  const recorderRef = useRef<ActiveRecorder | null>(null);
  const videoUrlRef = useRef<string | null>(null);

  const dest = trackerDisplay(tracker);
  const inFlow = state !== "idle";

  // recording timer
  useEffect(() => {
    if (state !== "recording") return;
    setElapsed(0);
    const id = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(id);
  }, [state]);

  // transcribing loader animation (visual only; real work drives the transition)
  useEffect(() => {
    if (state !== "transcribing") return;
    setStep(0);
    const id = setInterval(() => setStep((s) => (s + 1) % 4), 800);
    return () => clearInterval(id);
  }, [state]);

  const stopMedia = () => {
    recorderRef.current?.cancel();
    recorderRef.current = null;
    setAnalyser(null);
    setDisplayStream(null);
  };

  const setRecording = (blob: Blob | null) => {
    if (videoUrlRef.current) URL.revokeObjectURL(videoUrlRef.current);
    const url = blob ? URL.createObjectURL(blob) : null;
    videoUrlRef.current = url;
    setVideoUrl(url);
  };

  const onStop = async () => {
    flowCancelled.current = false;
    const blob = recorderRef.current ? await recorderRef.current.stop() : null;
    recorderRef.current = null;
    setAnalyser(null);
    setDisplayStream(null);
    setRecording(blob);
    setState("transcribing");
    try {
      const transcript = await transcribeAudio(ai, blob);
      if (flowCancelled.current) return;
      const d = aiReady(ai) ? await draftTicket(ai, transcript, context) : stubDraft(context, transcript);
      if (flowCancelled.current) return;
      setDraft(d);
      setState("review");
    } catch (e) {
      if (flowCancelled.current) return;
      setError(e instanceof Error ? e.message : String(e));
      setDraft(stubDraft(context));
      setState("review");
    }
  };

  const onStart = async () => {
    setError(null);
    try {
      const rec = await startRecording({
        mic: capture.mic,
        onEnded: () => {
          if (recorderRef.current) void onStop();
        },
      });
      recorderRef.current = rec;
      setDisplayStream(rec.displayStream);
      setAnalyser(rec.analyser);
      setMicAvailable(rec.micAvailable);
      setState("recording");
      void (async () => {
        try {
          const ctx = await getContext();
          const shot = await captureScreenshot();
          setContext({ ...ctx, screenshot: shot ?? undefined });
        } catch {
          /* best-effort */
        }
      })();
    } catch (e) {
      if (!(e instanceof CaptureCancelled)) setError(e instanceof Error ? e.message : String(e));
      setState("idle");
    }
  };

  const onCancel = () => {
    flowCancelled.current = true;
    sendCancelled.current = true;
    stopMedia();
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

  const onNew = () => {
    flowCancelled.current = true;
    sendCancelled.current = true;
    stopMedia();
    if (videoUrlRef.current) {
      URL.revokeObjectURL(videoUrlRef.current);
      videoUrlRef.current = null;
    }
    setVideoUrl(null);
    setState("idle");
    setContext(undefined);
    setResult(null);
    setError(null);
    setDraft(emptyTicket());
  };

  const goHome = () => {
    setView("home");
    onNew();
  };

  const openSettings = () => {
    browser.runtime.openOptionsPage().catch((err) => console.warn("[speqify] openOptionsPage", err));
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
      <div className="sp" style={{ padding: 16, fontSize: 13, color: "var(--sp-text-3)" }}>
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
    <Shell
      view={view}
      draftsCount={0}
      onHome={goHome}
      onDrafts={() => setView(view === "drafts" ? "home" : "drafts")}
      onSettings={openSettings}
      onClose={close}
    >
      {!inFlow && view === "home" && <SourcePicker onStart={onStart} onCancel={close} />}
      {!inFlow && view === "drafts" && <DraftsPlaceholder onBack={() => setView("home")} />}

      {inFlow && (
        <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
          {state === "recording" && (
            <Recording
              time={`${mm}:${ss}`}
              analyser={analyser}
              displayStream={displayStream}
              micAvailable={micAvailable}
              onStop={onStop}
              onCancel={onCancel}
              onMicChange={(on) => recorderRef.current?.setMicEnabled(on)}
            />
          )}
          {state === "transcribing" && <Transcribing step={step} onCancel={onCancel} />}
          {state === "review" && (
            <>
              {error && (
                <p
                  className="sp"
                  style={{ margin: "12px 16px 0", padding: "8px 10px", borderRadius: 8, background: "var(--sp-danger-bg)", border: "1px solid #FECACA", color: "var(--sp-danger)", fontSize: 12 }}
                >
                  {error}
                </p>
              )}
              <Review
                draft={draft}
                onChange={setDraft}
                onSend={onSend}
                onBack={onNew}
                destination={dest}
                recordingUrl={videoUrl}
                attachment={context ? { label: `Capture · ${hostOf(context.page.url)}`, sub: context.page.url || "Screenshot + context" } : undefined}
              />
            </>
          )}
          {state === "sending" && dest && <Sending kind={dest.kind} name={dest.name} sub={dest.sub} onCancel={onSendingCancel} />}
          {state === "success" && dest && result && (
            <Success kind={dest.kind} name={dest.name} sub={dest.sub} issueKey={result.key ?? result.id} url={result.url} title={draft.title} onNew={onNew} />
          )}
        </div>
      )}
    </Shell>
  );
}

function DraftsPlaceholder({ onBack }: { onBack: () => void }) {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, padding: 24, textAlign: "center" }}>
      <div style={{ fontSize: 14, fontWeight: 600 }}>No drafts yet</div>
      <div style={{ fontSize: 12.5, color: "var(--sp-text-3)", maxWidth: 240 }}>
        Captures you pause before sending will appear here so you can resume them.
      </div>
      <button className="sp-btn sp-btn-secondary sp-btn-sm" onClick={onBack}>
        Back to capture
      </button>
    </div>
  );
}
