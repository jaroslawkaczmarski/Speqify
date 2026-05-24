import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";
import { browser } from "#imports";
import type { TrackerConfig, TrackerKind } from "@speqify/core";

const chromeStorage: StateStorage = {
  getItem: async (name) => {
    try {
      const result = await browser.storage.local.get(name);
      return (result[name] as string) ?? null;
    } catch {
      return null; // not running as an extension (e.g. static preview)
    }
  },
  setItem: async (name, value) => {
    try {
      await browser.storage.local.set({ [name]: value });
    } catch {
      /* ignore */
    }
  },
  removeItem: async (name) => {
    try {
      await browser.storage.local.remove(name);
    } catch {
      /* ignore */
    }
  },
};

export type AiMode = "local" | "remote";

export interface RemoteAi {
  preset: string;
  endpoint: string;
  /** Drafting model (text → ticket). */
  model: string;
  /** Transcription model (audio → text), via {endpoint}/audio/transcriptions. Empty = no remote STT. */
  sttModel: string;
  apiKey: string;
}

export type LocalTier = "light" | "medium";

export interface AiConfig {
  mode: AiMode;
  /** Which local model bundle the user picked. Nothing is downloaded until they opt in. */
  localTier: LocalTier;
  /** True once the chosen tier has been downloaded into the browser. Default: false. */
  localDownloaded: boolean;
  remote: RemoteAi;
  /** Behaviour */
  detectedLang: string;
  translateTo: string;
  autoLabels: boolean;
}

export interface CaptureDefaults {
  source: "area" | "element" | "tab" | "window";
  mic: boolean;
  cursor: boolean;
  repro: boolean;
  quality: "720" | "1080" | "1440";
}

interface SettingsState {
  hydrated: boolean;
  onboarded: boolean;
  /** Single active destination tracker (design: one at a time). */
  tracker: TrackerConfig | null;
  ai: AiConfig;
  capture: CaptureDefaults;
  setOnboarded: (v: boolean) => void;
  setTracker: (t: TrackerConfig | null) => void;
  setAi: (patch: Partial<AiConfig>) => void;
  setCapture: (patch: Partial<CaptureDefaults>) => void;
}

export function defaultAiConfig(): AiConfig {
  return {
    mode: "local",
    localTier: "light",
    localDownloaded: false,
    remote: {
      preset: "openrouter",
      endpoint: "https://openrouter.ai/api/v1",
      model: "anthropic/claude-3.5-haiku",
      sttModel: "",
      apiKey: "",
    },
    detectedLang: "auto",
    translateTo: "en",
    autoLabels: true,
  };
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      hydrated: false,
      onboarded: false,
      tracker: null,
      ai: defaultAiConfig(),
      capture: { source: "area", mic: true, cursor: true, repro: true, quality: "1080" },
      setOnboarded: (onboarded) => set({ onboarded }),
      setTracker: (tracker) => set({ tracker }),
      setAi: (patch) => set((s) => ({ ai: { ...s.ai, ...patch } })),
      setCapture: (patch) => set((s) => ({ capture: { ...s.capture, ...patch } })),
    }),
    {
      name: "speqify-settings-v2",
      storage: createJSONStorage(() => chromeStorage),
      partialize: ({ onboarded, tracker, ai, capture }) => ({ onboarded, tracker, ai, capture }),
      onRehydrateStorage: () => () => useSettings.setState({ hydrated: true }),
    },
  ),
);

/** Friendly name + sub-label for a configured tracker, used in Review destination. */
export function trackerDisplay(tracker: TrackerConfig | null): { name: string; sub: string; kind: TrackerKind } | null {
  if (!tracker) return null;
  switch (tracker.kind) {
    case "github":
      return { name: "GitHub Issues", sub: `${tracker.owner}/${tracker.repo}`, kind: "github" };
    case "jira":
      return { name: "Jira", sub: `${tracker.projectKey} · ${tracker.issueType}`, kind: "jira" };
    case "linear":
      return { name: "Linear", sub: tracker.teamId, kind: "linear" };
    case "gitlab":
      return { name: "GitLab Issues", sub: tracker.projectId, kind: "gitlab" };
  }
}
