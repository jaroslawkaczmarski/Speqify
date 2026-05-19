import { useState } from "react";
import type { ReactNode } from "react";

/** Async action helper — error + busy state for one in-flight operation. */
export function useAsync() {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<void>): Promise<void> => {
    setError(null);
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Coś poszło nie tak");
    } finally {
      setBusy(false);
    }
  };
  return { error, busy, run, setError };
}

/** Topbar (breadcrumbs + optional env pill + right-side actions) + body. */
export function Page(props: {
  crumbs: string[];
  env?: string;
  actions?: ReactNode;
  variant?: "padded" | "bleed";
  children: ReactNode;
}) {
  const last = props.crumbs.length - 1;
  return (
    <>
      <header className="topbar">
        <div className="crumbs">
          {props.crumbs.map((c, i) => (
            <span key={c} className={i === last ? "cur" : undefined}>
              {c}
              {i < last ? (
                <span className="sep" style={{ marginLeft: 8 }}>
                  /
                </span>
              ) : null}
            </span>
          ))}
        </div>
        {props.env ? <span className="env">{props.env}</span> : null}
        <div className="topbar-spacer" />
        {props.actions}
      </header>
      {props.variant === "bleed" ? (
        <div style={{ overflow: "hidden", display: "flex", flexDirection: "column" }}>
          {props.children}
        </div>
      ) : (
        <div className="body">{props.children}</div>
      )}
    </>
  );
}

export function csvToList(s: string): string[] {
  return s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}
