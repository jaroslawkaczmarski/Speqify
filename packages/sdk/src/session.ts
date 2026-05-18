/** Per-tab session ids — group annotations into one Send batch (§4, §14). */
import { newId } from "./ids.js";

function persistent(key: string): string {
  const k = `speqify.${key}`;
  let v = sessionStorage.getItem(k);
  if (!v) {
    v = newId();
    sessionStorage.setItem(k, v);
  }
  return v;
}

export const getClientId = (): string => persistent("cid");
export const getSubmissionId = (): string => persistent("sid");

/** Start a fresh Send batch after a successful submit. */
export function resetSubmission(): void {
  sessionStorage.removeItem("speqify.sid");
}
