import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import type { ProjectTemplate, Task } from "@speqify/shared";
import { api, type PoProjectView } from "./api.js";
import { Alert, Field, PageHeader, csvToList, useAsync } from "./ui.js";

export function PoOverview() {
  const [v, setV] = useState<PoProjectView | null>(null);
  const { error, run } = useAsync();
  useEffect(() => {
    void run(async () => setV(await api.poProject()));
  }, []);
  return (
    <>
      <PageHeader title="My project" sub="Product Owner workspace" />
      {error ? <Alert kind="danger">{error}</Alert> : null}
      {v ? (
        <div className="grid gap-lg sm:grid-cols-2">
          <div className="card card-pad">
            <p className="badge">Project</p>
            <p className="mt-sm text-h3 text-primary">{v.project.name}</p>
            <p className="hint">Language: {v.project.template.language.toUpperCase()}</p>
          </div>
          <div className="card card-pad">
            <p className="badge">Environments</p>
            <ul className="mt-sm text-body-sm">
              {v.project.environmentUrls.map((u) => (
                <li key={u}>{u}</li>
              ))}
            </ul>
          </div>
          <div className="card card-pad">
            <p className="badge">Export target</p>
            <p className="mt-sm text-body-md text-primary">
              {v.export ? v.export.target : "Not configured"}
            </p>
          </div>
        </div>
      ) : null}
    </>
  );
}

export function PoTemplate() {
  const [t, setT] = useState<ProjectTemplate | null>(null);
  const [saved, setSaved] = useState(false);
  const { error, busy, run } = useAsync();
  useEffect(() => {
    void run(async () => setT((await api.poProject()).project.template));
  }, []);

  const submit = (e: FormEvent): void => {
    e.preventDefault();
    if (!t) return;
    void run(async () => {
      await api.putTemplate(t);
      setSaved(true);
    });
  };
  if (!t) return <PageHeader title="Task template" />;
  const set = (patch: Partial<ProjectTemplate>): void => {
    setSaved(false);
    setT({ ...t, ...patch });
  };

  return (
    <>
      <PageHeader title="Task template" sub="Shapes every AI-generated ticket" />
      {error ? <Alert kind="danger">{error}</Alert> : null}
      {saved ? <Alert kind="success">Template saved.</Alert> : null}
      <form onSubmit={submit} className="card card-pad mt-lg max-w-2xl" noValidate>
        <Field label="Output language" htmlFor="t-lang">
          <select
            id="t-lang"
            className="select"
            value={t.language}
            onChange={(e) => set({ language: e.target.value === "pl" ? "pl" : "en" })}
          >
            <option value="en">English</option>
            <option value="pl">Polish</option>
          </select>
        </Field>
        <div className="field flex gap-lg">
          <label className="flex items-center gap-sm text-body-md">
            <input
              type="checkbox"
              checked={t.userStory}
              onChange={(e) => set({ userStory: e.target.checked })}
            />
            User story format
          </label>
          <label className="flex items-center gap-sm text-body-md">
            <input
              type="checkbox"
              checked={t.acceptanceCriteria}
              onChange={(e) => set({ acceptanceCriteria: e.target.checked })}
            />
            Acceptance criteria
          </label>
        </div>
        <Field label="Labels" htmlFor="t-labels" hint="Comma-separated allowed vocabulary">
          <input
            id="t-labels"
            className="input"
            value={t.labels.join(", ")}
            onChange={(e) => set({ labels: csvToList(e.target.value) })}
          />
        </Field>
        <Field label="Components" htmlFor="t-comp" hint="Comma-separated">
          <input
            id="t-comp"
            className="input"
            value={t.components.join(", ")}
            onChange={(e) => set({ components: csvToList(e.target.value) })}
          />
        </Field>
        <Field label="Versions" htmlFor="t-ver" hint="Comma-separated">
          <input
            id="t-ver"
            className="input"
            value={t.versions.join(", ")}
            onChange={(e) => set({ versions: csvToList(e.target.value) })}
          />
        </Field>
        <button className="btn-primary" type="submit" disabled={busy}>
          {busy ? "Saving…" : "Save template"}
        </button>
      </form>
    </>
  );
}

const CRED_FIELDS: Record<string, string[]> = {
  jira: ["baseUrl", "email", "apiToken"],
  github: ["token"],
  json: [],
  csv: [],
};
const DEFAULT_FIELDS: Record<string, string[]> = {
  jira: ["projectKey", "issueType"],
  github: ["repo"],
  json: [],
  csv: [],
};

export function PoExport() {
  const [target, setTarget] = useState("jira");
  const [creds, setCreds] = useState<Record<string, string>>({});
  const [defs, setDefs] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const [checks, setChecks] = useState<{ name: string; ok: boolean }[] | null>(null);
  const { error, busy, run } = useAsync();

  useEffect(() => {
    void run(async () => {
      const v = await api.poProject();
      if (v.export) {
        setTarget(v.export.target);
        setDefs(v.export.defaults ?? {});
      }
    });
  }, []);

  const save = (e: FormEvent): void => {
    e.preventDefault();
    void run(async () => {
      const credentials = Object.fromEntries(
        Object.entries(creds).filter(([, val]) => val.trim() !== ""),
      );
      await api.putExport({ target, credentials, defaults: defs });
      setSaved(true);
      setChecks(null);
    });
  };
  const test = (): void => void run(async () => setChecks((await api.testExport()).checks));

  return (
    <>
      <PageHeader title="Export target" sub="Credentials are encrypted at rest, never shown back" />
      {error ? <Alert kind="danger">{error}</Alert> : null}
      {saved ? <Alert kind="success">Export configuration saved.</Alert> : null}
      <form onSubmit={save} className="card card-pad mt-lg max-w-2xl" noValidate>
        <Field label="Target" htmlFor="x-target">
          <select
            id="x-target"
            className="select"
            value={target}
            onChange={(e) => {
              setTarget(e.target.value);
              setCreds({});
              setSaved(false);
            }}
          >
            <option value="jira">Jira</option>
            <option value="github">GitHub Issues</option>
            <option value="json">JSON export</option>
            <option value="csv">CSV export</option>
          </select>
        </Field>

        {(CRED_FIELDS[target] ?? []).map((k) => (
          <Field key={k} label={`Credential: ${k}`} htmlFor={`c-${k}`}>
            <input
              id={`c-${k}`}
              className="input"
              type="password"
              autoComplete="off"
              placeholder="leave blank to keep existing"
              value={creds[k] ?? ""}
              onChange={(e) => setCreds({ ...creds, [k]: e.target.value })}
            />
          </Field>
        ))}
        {(DEFAULT_FIELDS[target] ?? []).map((k) => (
          <Field key={k} label={k} htmlFor={`d-${k}`}>
            <input
              id={`d-${k}`}
              className="input"
              value={defs[k] ?? ""}
              onChange={(e) => setDefs({ ...defs, [k]: e.target.value })}
            />
          </Field>
        ))}

        <div className="flex gap-sm">
          <button className="btn-primary" type="submit" disabled={busy}>
            {busy ? "Saving…" : "Save"}
          </button>
          <button className="btn-secondary" type="button" onClick={test} disabled={busy}>
            Run config test
          </button>
        </div>
      </form>

      {checks ? (
        <div className="card card-pad mt-lg max-w-2xl">
          <h2 className="section-title !mt-0">Test result</h2>
          <ul className="grid gap-sm">
            {checks.map((c) => (
              <li key={c.name} className="flex items-center gap-sm text-body-sm">
                <span className={c.ok ? "text-success" : "text-danger"}>{c.ok ? "✓" : "✗"}</span>
                {c.name}
              </li>
            ))}
          </ul>
          <p className="hint">Live Jira/GitHub probe lands in Phase 9.</p>
        </div>
      ) : null}
    </>
  );
}

export function PoTasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [info, setInfo] = useState<string | null>(null);
  const { error, busy, run } = useAsync();

  const load = (): void => void run(async () => setTasks((await api.listTasks()).tasks));
  useEffect(() => load(), []);

  const analyze = (): void =>
    void run(async () => {
      const r = await api.analyze();
      setInfo(`Run ${r.status}: ${r.annotations} annotations → ${r.tasksCreated} tasks created.`);
      setTasks((await api.listTasks()).tasks);
    });

  return (
    <>
      <PageHeader
        title="Tasks"
        sub="AI-generated drafts"
        actions={
          <button className="btn-primary" onClick={analyze} disabled={busy}>
            {busy ? "Running…" : "Run AI analysis"}
          </button>
        }
      />
      {error ? <Alert kind="danger">{error}</Alert> : null}
      {info ? <Alert kind="info">{info}</Alert> : null}
      <div className="card card-pad">
        <table className="table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Status</th>
              <th>Priority</th>
              <th>Labels</th>
            </tr>
          </thead>
          <tbody>
            {tasks.length === 0 ? (
              <tr>
                <td colSpan={4} className="text-muted">
                  No tasks yet — run analysis after feedback is submitted.
                </td>
              </tr>
            ) : (
              tasks.map((t) => (
                <tr key={t.id}>
                  <td>{t.title}</td>
                  <td>{t.status}</td>
                  <td>{t.priority ?? "—"}</td>
                  <td>{t.labels.join(", ") || "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        <p className="hint">Review &amp; accept (accept/reject/edit) lands in Phase 8.</p>
      </div>
    </>
  );
}
