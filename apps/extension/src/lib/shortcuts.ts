/** OS-aware keyboard shortcut labels. Mac shows symbols; Windows/Linux show words. */

function detectMac(): boolean {
  const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
  const platform = nav.userAgentData?.platform || navigator.platform || navigator.userAgent;
  return /mac/i.test(platform);
}

export const isMac = detectMac();

/** Modifier glyphs/words per platform. `mod` = Cmd on macOS, Ctrl elsewhere. */
export const KEYS = isMac
  ? { mod: "⌘", alt: "⌥", shift: "⇧", enter: "↵", esc: "Esc" }
  : { mod: "Ctrl", alt: "Alt", shift: "Shift", enter: "Enter", esc: "Esc" };

/** Each shortcut as an ordered list of key labels (render one <kbd> per item). */
export const SHORTCUTS: Record<string, { label: string; keys: string[] }> = {
  capture: { label: "Open capture", keys: [KEYS.alt, "S"] },
  mute: { label: "Toggle microphone", keys: [KEYS.alt, "M"] },
  stop: { label: "Stop & attach", keys: [KEYS.alt, KEYS.shift, "S"] },
  create: { label: "Create issue", keys: [KEYS.mod, KEYS.enter] },
  cancel: { label: "Cancel / back", keys: [KEYS.esc] },
};
