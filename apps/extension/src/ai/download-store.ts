import { create } from "zustand";
import { loadLocal, type LoadProgress } from "@/ai";
import { useSettings, type LocalTier } from "@/store";

/** Which local model a download is fetching. */
export type DownloadKind = "speech" | "llm";

/**
 * Tracks an in-flight local-model download independently of any component, so
 * switching Settings sections (which unmounts the download UI) doesn't lose the
 * progress or let a second download start. Not persisted — it's runtime-only.
 */
interface DownloadState {
  /** Which model is currently downloading (null when idle). */
  kind: DownloadKind | null;
  active: boolean;
  progress: number;
  error: string | null;
  start: (kind: DownloadKind, tier: LocalTier) => Promise<void>;
  clearError: () => void;
}

export const useLocalDownload = create<DownloadState>((set, get) => ({
  kind: null,
  active: false,
  progress: 0,
  error: null,
  clearError: () => set({ error: null }),
  start: async (kind, tier) => {
    if (get().active) return; // already downloading — ignore duplicate clicks
    set({ active: true, kind, progress: 0, error: null });
    try {
      await loadLocal(
        tier,
        (p: LoadProgress) => {
          if (typeof p.progress === "number") set({ progress: Math.min(100, Math.round(p.progress)) });
        },
        kind === "speech" ? { needAsr: true, needLlm: false } : { needAsr: false, needLlm: true },
      );
      useSettings.getState().setAi(kind === "speech" ? { speechDownloaded: true } : { llmDownloaded: true });
      set({ active: false, progress: 100, kind: null });
    } catch (e) {
      set({ active: false, kind: null, error: e instanceof Error ? e.message : String(e) });
    }
  },
}));
