import { useEffect, useState } from "react";

/** Minimal hash router (no deps) — subpages get real URLs. */
export function useHashRoute(): string {
  const read = (): string => window.location.hash.replace(/^#/, "") || "/";
  const [path, setPath] = useState(read);
  useEffect(() => {
    const on = (): void => setPath(read());
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return path;
}

export function navigate(path: string): void {
  window.location.hash = path;
}
