import { useState } from "react";
import type { ReactNode } from "react";

export function useAsync() {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<void>): Promise<void> => {
    setError(null);
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };
  return { error, busy, run, setError };
}

export function Alert(props: {
  kind: "info" | "success" | "warning" | "danger";
  children: ReactNode;
}) {
  return (
    <p className={`alert alert-${props.kind}`} role={props.kind === "danger" ? "alert" : "status"}>
      {props.children}
    </p>
  );
}

export function Field(props: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="field">
      <label htmlFor={props.htmlFor}>{props.label}</label>
      {props.children}
      {props.hint ? <p className="hint">{props.hint}</p> : null}
    </div>
  );
}

export function PageHeader(props: { title: string; sub?: string; actions?: ReactNode }) {
  return (
    <div className="mb-xl flex items-end justify-between gap-lg">
      <div>
        <h1 className="page-title">{props.title}</h1>
        {props.sub ? <p className="page-sub">{props.sub}</p> : null}
      </div>
      {props.actions ? <div className="flex gap-sm">{props.actions}</div> : null}
    </div>
  );
}

export function csvToList(s: string): string[] {
  return s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}
