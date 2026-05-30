import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";
import { browser } from "#imports";
import type { TicketType, TrackerConfig, TrackerKind } from "@speqify/core";

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

/** One OpenAI-compatible API endpoint. `model` means the transcription model for
 *  the Voice config (e.g. whisper-1) and the chat model for the AI/draft config. */
export interface RemoteEndpoint {
  preset: string;
  endpoint: string;
  apiKey: string;
  model: string;
}

export type LocalTier = "light" | "medium";

export interface AiConfig {
  /** Voice — speech → text (transcription). */
  voiceMode: AiMode;
  voiceRemote: RemoteEndpoint;
  /** AI — text → ticket (drafting). Local prefers Chrome's Gemini Nano, else Qwen. */
  draftMode: AiMode;
  draftRemote: RemoteEndpoint;
  /** Quality tier for whichever models run locally. Nothing downloads until opt-in. */
  localTier: LocalTier;
  /** True once the tier's Whisper (speech) model is downloaded. */
  speechDownloaded: boolean;
  /** True once the tier's Qwen (drafting) model is downloaded. Irrelevant when Nano drafts. */
  llmDownloaded: boolean;
  /** Behaviour */
  detectedLang: string;
  translateTo: string;
  autoLabels: boolean;
}

export interface CaptureDefaults {
  /** Still screenshot vs screen recording — the top-level capture type. */
  mode: "screenshot" | "recording";
  source: "area" | "element" | "tab" | "window";
  mic: boolean;
  cursor: boolean;
  repro: boolean;
  quality: "720" | "1080" | "1440";
}

/** Per-type description skeletons the model fills from the spoken note. */
export type TemplateMap = Record<TicketType, string>;

export function defaultTemplates(): TemplateMap {
  return {
    bug: "## What happens\n## Expected\n## Steps to reproduce\n## Environment",
    feature: "## Problem / motivation\n## Proposed solution\n## Acceptance criteria",
    task: "## Outcome\n## Context\n## Notes",
    improvement: "## Current behaviour\n## Desired improvement\n## Why it matters",
  };
}

interface SettingsState {
  hydrated: boolean;
  onboarded: boolean;
  /** Single active destination tracker (design: one at a time). */
  tracker: TrackerConfig | null;
  ai: AiConfig;
  capture: CaptureDefaults;
  templates: TemplateMap;
  setOnboarded: (v: boolean) => void;
  setTracker: (t: TrackerConfig | null) => void;
  setAi: (patch: Partial<AiConfig>) => void;
  setCapture: (patch: Partial<CaptureDefaults>) => void;
  setTemplate: (type: TicketType, body: string) => void;
  resetTemplates: () => void;
}

export function defaultAiConfig(): AiConfig {
  return {
    voiceMode: "local",
    voiceRemote: { preset: "openai", endpoint: "https://api.openai.com/v1", apiKey: "", model: "whisper-1" },
    draftMode: "local",
    draftRemote: { preset: "openrouter", endpoint: "https://openrouter.ai/api/v1", apiKey: "", model: "anthropic/claude-3.5-haiku" },
    localTier: "light",
    speechDownloaded: false,
    llmDownloaded: false,
    detectedLang: "auto",
    translateTo: "en",
    autoLabels: true,
  };
}

/** Migrate a persisted blob from the old single-mode AiConfig to the split
 *  Voice/AI shape. Safe to run on already-new state (it no-ops then). */
function migrateAi(ai: Record<string, unknown> | undefined): AiConfig {
  const base = defaultAiConfig();
  if (!ai) return base;
  // Already the split shape — backfill any missing (nested) fields against defaults
  // so a partial/intermediate blob can't leave an endpoint undefined at runtime.
  if (ai.voiceMode !== undefined && ai.draftMode !== undefined) {
    const a = ai as Partial<AiConfig>;
    return {
      ...base,
      ...a,
      voiceRemote: { ...base.voiceRemote, ...(a.voiceRemote ?? {}) },
      draftRemote: { ...base.draftRemote, ...(a.draftRemote ?? {}) },
    };
  }
  const oldRemote = (ai.remote ?? {}) as Record<string, string>;
  const downloaded = ai.localDownloaded === true;
  // Keep drafting on the old mode, but only keep voice on "remote" if it had a
  // transcription model — otherwise use local Whisper so transcription still works.
  const draftMode: AiMode = ai.mode === "remote" ? "remote" : "local";
  const voiceMode: AiMode = draftMode === "remote" && (oldRemote.sttModel ?? "").trim() ? "remote" : "local";
  return {
    ...base,
    voiceMode,
    voiceRemote: {
      ...base.voiceRemote,
      // old endpoint/key carried over; transcription model came from sttModel.
      endpoint: oldRemote.endpoint || base.voiceRemote.endpoint,
      apiKey: oldRemote.apiKey ?? "",
      model: oldRemote.sttModel || base.voiceRemote.model,
    },
    draftMode,
    draftRemote: {
      ...base.draftRemote,
      preset: oldRemote.preset || base.draftRemote.preset,
      endpoint: oldRemote.endpoint || base.draftRemote.endpoint,
      apiKey: oldRemote.apiKey ?? "",
      model: oldRemote.model || base.draftRemote.model,
    },
    localTier: ai.localTier === "medium" ? "medium" : "light",
    speechDownloaded: downloaded,
    llmDownloaded: downloaded,
    detectedLang: typeof ai.detectedLang === "string" ? ai.detectedLang : base.detectedLang,
    translateTo: typeof ai.translateTo === "string" ? ai.translateTo : base.translateTo,
    autoLabels: ai.autoLabels !== false,
  };
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      hydrated: false,
      onboarded: false,
      tracker: null,
      ai: defaultAiConfig(),
      capture: { mode: "recording", source: "area", mic: true, cursor: true, repro: true, quality: "1080" },
      templates: defaultTemplates(),
      setOnboarded: (onboarded) => set({ onboarded }),
      setTracker: (tracker) => set({ tracker }),
      setAi: (patch) => set((s) => ({ ai: { ...s.ai, ...patch } })),
      setCapture: (patch) => set((s) => ({ capture: { ...s.capture, ...patch } })),
      setTemplate: (type, body) => set((s) => ({ templates: { ...s.templates, [type]: body } })),
      resetTemplates: () => set({ templates: defaultTemplates() }),
    }),
    {
      name: "speqify-settings-v2",
      version: 1,
      storage: createJSONStorage(() => chromeStorage),
      partialize: ({ onboarded, tracker, ai, capture, templates }) => ({ onboarded, tracker, ai, capture, templates }),
      // v0→v1: the on-device drafting model changed (Qwen2.5 → Qwen3), so a stored
      // "downloaded" flag no longer matches a cached model — clear it so Settings
      // prompts a fresh download instead of silently re-fetching at first draft.
      migrate: (persisted, version) => {
        const p = (persisted ?? {}) as { ai?: Record<string, unknown> };
        if (version < 1 && p.ai) p.ai.llmDownloaded = false;
        return p as unknown as SettingsState;
      },
      // New keys (e.g. templates) added after a user first persisted v2 won't be in
      // their stored blob; merge defaults underneath so they're never undefined.
      // `ai` is run through migrateAi so an older single-mode blob is reshaped into
      // the split Voice/AI config rather than overwriting the new defaults wholesale.
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<SettingsState> & { ai?: Record<string, unknown> };
        // Underlay capture defaults so a field added after a user first persisted
        // (e.g. `mode`) is never undefined.
        return { ...current, ...p, ai: migrateAi(p.ai), capture: { ...current.capture, ...(p.capture ?? {}) } };
      },
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
