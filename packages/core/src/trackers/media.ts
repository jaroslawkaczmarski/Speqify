import type { TrackerKind } from "./types.js";

/**
 * Which trackers can embed an uploaded screenshot in the created issue.
 * GitHub's REST API has no PAT-authorized image upload (only the web UI can
 * attach images), so we keep the screenshot as a local review artifact there.
 */
export const SCREENSHOT_EMBED: Record<TrackerKind, boolean> = {
  github: false,
  gitlab: true,
  jira: true,
  linear: true,
};

/**
 * Which trackers can host an uploaded screen recording (webm). Same constraint as
 * screenshots — GitHub's REST API has no PAT-authorized upload, so a recording
 * stays a local draft artifact there.
 */
export const VIDEO_UPLOAD: Record<TrackerKind, boolean> = {
  github: false,
  gitlab: true,
  jira: true,
  linear: true,
};

/** Decode a `data:` URL (e.g. chrome.tabs.captureVisibleTab output) into a Blob. */
export function dataUrlToBlob(dataUrl: string): Blob {
  const comma = dataUrl.indexOf(",");
  const head = dataUrl.slice(0, comma);
  const body = dataUrl.slice(comma + 1);
  const mime = /data:([^;]+)/.exec(head)?.[1] ?? "image/jpeg";
  const bin = atob(body);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

export function screenshotName(mime: string): string {
  return `speqify-screenshot.${mime.includes("png") ? "png" : "jpg"}`;
}

export function recordingName(mime: string): string {
  return `speqify-recording.${mime.includes("mp4") ? "mp4" : "webm"}`;
}
