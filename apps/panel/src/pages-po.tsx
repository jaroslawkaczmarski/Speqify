import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import type {
  PoSourceAnnotation,
  ProjectTemplate,
  SubtaskType,
  Task,
  TaskEditInput,
} from "@speqify/shared";
import { api, type PoProjectView } from "./api.js";
import {
  Alert,
  Button,
  EmptyState,
  Field,
  Page,
  Skeleton,
  Toggle,
  csvToList,
  useAsync,
  useToast,
} from "./components.js";
import {
  IconCheck,
  IconEdit,
  IconInfo,
  IconPlay,
  IconRefresh,
  IconTrash,
  IconZap,
  IconDownload,
} from "./icons.js";

export function PoOverview() {
  const [v, setV] = useState<PoProjectView | null>(null);
  const { error, run } = useAsync();
  useEffect(() => {
    void run(async () => setV(await api.poProject()));
  }, []);
  return (
    <Page crumbs={["Mój projekt", "Pulpit"]} env={v ? "prod" : undefined}>
      <div className="page-h">
        <div>
          <h1>Pulpit</h1>
          <p className="sub">Workspace Product Ownera</p>
        </div>
      </div>
      {error ? <Alert kind="danger">{error}</Alert> : null}
      {v ? (
        <>
          <div className="stats">
            <div className="stat">
              <span className="l">Projekt</span>
              <span className="n" style={{ fontSize: "1.0625rem" }}>
                {v.project.name}
              </span>
              <span className="d">
                <span className="sp">{v.project.id}</span>
              </span>
            </div>
            <div className="stat">
              <span className="l">Język zadań</span>
              <span className="n">{v.project.template.language.toUpperCase()}</span>
              <span className="d">
                <span className="sp">szablon zadań</span>
              </span>
            </div>
            <div className="stat">
              <span className="l">Eksport</span>
              <span className="n" style={{ fontSize: "1.0625rem" }}>
                {v.export ? v.export.target : "—"}
              </span>
              <span className="d">
                <span className="sp">{v.export ? "skonfigurowany" : "do konfiguracji"}</span>
              </span>
            </div>
            <div className="stat">
              <span className="l">Środowiska</span>
              <span className="n">{v.project.environmentUrls.length}</span>
              <span className="d">
                <span className="sp">CORS allowlist</span>
              </span>
            </div>
          </div>
          <div className="card card-pad" style={{ maxWidth: 720 }}>
            <h2 className="section-title" style={{ marginTop: 0 }}>
              Adresy środowisk
            </h2>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {v.project.environmentUrls.map((u) => (
                <li key={u} className="mono" style={{ fontSize: ".8125rem", padding: "2px 0" }}>
                  {u}
                </li>
              ))}
            </ul>
          </div>
        </>
      ) : null}
    </Page>
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
  const set = (patch: Partial<ProjectTemplate>): void => {
    setSaved(false);
    if (t) setT({ ...t, ...patch });
  };

  return (
    <Page crumbs={["Mój projekt", "Szablon zadań"]}>
      <div className="page-h">
        <div>
          <h1>Szablon zadań</h1>
          <p className="sub">Kształtuje każde zadanie generowane przez AI</p>
        </div>
      </div>
      {error ? <Alert kind="danger">{error}</Alert> : null}
      {saved ? <Alert kind="success">Szablon zapisany.</Alert> : null}
      {!t ? (
        <div
          className="card card-pad"
          style={{ maxWidth: 640, display: "flex", flexDirection: "column", gap: 12 }}
          aria-busy="true"
        >
          <Skeleton line width="40%" />
          <Skeleton height={44} />
          <Skeleton line width="60%" />
          <Skeleton height={44} />
        </div>
      ) : (
        <form onSubmit={submit} className="card card-pad" style={{ maxWidth: 640 }} noValidate>
          <Field label="Język wyjściowy" htmlFor="t-lang">
            <select
              id="t-lang"
              className="select"
              value={t.language}
              onChange={(e) => set({ language: e.target.value === "pl" ? "pl" : "en" })}
            >
              <option value="pl">Polski</option>
              <option value="en">English</option>
            </select>
          </Field>
          <div className="field" style={{ display: "flex", gap: 32 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Toggle
                on={t.userStory}
                onChange={(v) => set({ userStory: v })}
                label="Format user story"
              />
              <span style={{ fontSize: ".875rem" }}>Format user story</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Toggle
                on={t.acceptanceCriteria}
                onChange={(v) => set({ acceptanceCriteria: v })}
                label="Kryteria akceptacji"
              />
              <span style={{ fontSize: ".875rem" }}>Kryteria akceptacji</span>
            </div>
          </div>
          <Field label="Etykiety" htmlFor="t-labels" hint="Dozwolone słownictwo, po przecinku">
            <input
              id="t-labels"
              className="input"
              value={t.labels.join(", ")}
              onChange={(e) => set({ labels: csvToList(e.target.value) })}
            />
          </Field>
          <Field label="Komponenty" htmlFor="t-comp" hint="Po przecinku">
            <input
              id="t-comp"
              className="input"
              value={t.components.join(", ")}
              onChange={(e) => set({ components: csvToList(e.target.value) })}
            />
          </Field>
          <Field label="Wersje" htmlFor="t-ver" hint="Po przecinku">
            <input
              id="t-ver"
              className="input"
              value={t.versions.join(", ")}
              onChange={(e) => set({ versions: csvToList(e.target.value) })}
            />
          </Field>
          <Button type="submit" disabled={busy}>
            {busy ? "Zapisywanie…" : "Zapisz szablon"}
          </Button>
        </form>
      )}
    </Page>
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
    <Page crumbs={["Mój projekt", "Eksport & integracje"]}>
      <div className="page-h">
        <div>
          <h1>Eksport & integracje</h1>
          <p className="sub">Dane uwierzytelniające szyfrowane, nigdy nie zwracane</p>
        </div>
      </div>
      {error ? <Alert kind="danger">{error}</Alert> : null}
      {saved ? <Alert kind="success">Konfiguracja eksportu zapisana.</Alert> : null}
      <form onSubmit={save} className="card card-pad" style={{ maxWidth: 640 }} noValidate>
        <Field label="Cel" htmlFor="x-target">
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
            <option value="json">Eksport JSON</option>
            <option value="csv">Eksport CSV</option>
          </select>
        </Field>
        {(CRED_FIELDS[target] ?? []).map((k) => (
          <Field key={k} label={`Sekret: ${k}`} htmlFor={`c-${k}`}>
            <input
              id={`c-${k}`}
              className="input"
              type="password"
              autoComplete="off"
              placeholder="pozostaw puste, aby zachować obecne"
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
        <div style={{ display: "flex", gap: 8 }}>
          <Button type="submit" disabled={busy}>
            {busy ? "Zapisywanie…" : "Zapisz"}
          </Button>
          <Button variant="secondary" type="button" onClick={test} disabled={busy}>
            Uruchom test konfiguracji
          </Button>
        </div>
      </form>
      {checks ? (
        <div className="card card-pad" style={{ marginTop: 20, maxWidth: 640 }}>
          <h2 className="section-title" style={{ marginTop: 0 }}>
            Wynik testu
          </h2>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 8 }}>
            {checks.map((c) => (
              <li key={c.name} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ color: c.ok ? "var(--success)" : "var(--danger)" }}>
                  {c.ok ? "✓" : "✗"}
                </span>
                {c.name}
              </li>
            ))}
          </ul>
          <p className="hint">Aktywna sonda Jira/GitHub w Phase 9.</p>
        </div>
      ) : null}
    </Page>
  );
}

const STATE_CLASS: Record<string, string> = {
  generated: "state-gen",
  accepted: "state-acc",
  exported: "state-exp",
  rejected: "state-rej",
  export_failed: "state-rej",
};
const SEV: Record<"low" | "medium" | "high", { cls: string; label: string }> = {
  low: { cls: "sev-low", label: "Niski" },
  medium: { cls: "sev-med", label: "Średni" },
  high: { cls: "sev-high", label: "Wysoki" },
};
const FILTERS = [
  { key: "all", label: "Wszystkie" },
  { key: "generated", label: "Generated" },
  { key: "accepted", label: "Accepted" },
  { key: "exported", label: "Exported" },
  { key: "rejected", label: "Rejected" },
];
const GWT = /^\s*(given|when|then|gdy|kiedy|wtedy|jeśli)\b/i;
const SUBTYPES: SubtaskType[] = ["backend", "frontend", "integration", "other"];

function confClass(c: number | null): { cls: string; pct: string } | null {
  if (c == null) return null;
  const pct = `${Math.round(c * 100)}%`;
  return { cls: c >= 0.8 ? "high" : c >= 0.5 ? "med" : "low", pct };
}

function emptyEdit(t: Task): TaskEditInput {
  return {
    title: t.title,
    description: t.description,
    acceptanceCriteria: t.acceptanceCriteria,
    labels: t.labels,
    component: t.component,
    version: t.version,
    priority: t.priority,
    subtaskType: t.subtaskType,
    expectedRev: t.rev,
  };
}

export function PoTasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [filter, setFilter] = useState("generated");
  const [selId, setSelId] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [exportTarget, setExportTarget] = useState<string | null>(null);
  const [sources, setSources] = useState<PoSourceAnnotation[] | null>(null);
  const [editForm, setEditForm] = useState<TaskEditInput | null>(null);
  const { error, busy, run } = useAsync();
  const toast = useToast();

  const load = (): void =>
    void run(async () => {
      const [{ tasks: ts }, pv] = await Promise.all([api.listTasks(), api.poProject()]);
      setTasks(ts);
      setExportTarget(pv.export?.target ?? null);
    });
  useEffect(() => load(), []);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: tasks.length };
    for (const t of tasks) c[t.status] = (c[t.status] ?? 0) + 1;
    return c;
  }, [tasks]);

  const visible = useMemo(
    () => tasks.filter((t) => !t.parentTaskId).filter((t) => filter === "all" || t.status === filter),
    [tasks, filter],
  );
  const sel = visible.find((t) => t.id === selId) ?? visible[0] ?? null;
  const subtasks = sel ? tasks.filter((t) => t.parentTaskId === sel.id) : [];

  // Load source annotations whenever the selected task changes.
  useEffect(() => {
    setEditForm(null);
    if (!sel) {
      setSources(null);
      return;
    }
    let live = true;
    setSources(null);
    api
      .taskAnnotations(sel.id)
      .then((r) => live && setSources(r.annotations))
      .catch(() => live && setSources([]));
    return () => {
      live = false;
    };
  }, [sel?.id]);

  const analyze = (): void =>
    void run(async () => {
      const r = await api.analyze();
      setInfo(`Analiza ${r.status}: ${r.annotations} adnotacji → ${r.tasksCreated} zadań.`);
      const { tasks: ts } = await api.listTasks();
      setTasks(ts);
    });

  // Rev-guarded action: run, then refresh the list (fresh rev), keep selection.
  const act = (label: string, fn: () => Promise<{ task: Task }>, advance = false): void =>
    void run(async () => {
      setInfo(null);
      try {
        const { task } = await fn();
        const { tasks: ts } = await api.listTasks();
        setTasks(ts);
        if (advance) {
          const nextGen = ts.find((t) => !t.parentTaskId && t.status === "generated" && t.id !== task.id);
          setSelId(nextGen?.id ?? task.id);
        } else {
          setSelId(task.id);
        }
        setInfo(`${label} — OK.`);
      } catch (e) {
        const { tasks: ts } = await api.listTasks();
        setTasks(ts);
        setInfo(e instanceof Error ? `${label}: ${e.message}` : `${label}: błąd`);
      }
    });

  const accept = (t: Task): void =>
    act("Akceptacja", () => api.acceptTask(t.id, t.rev), true);
  const reject = (t: Task): void => act("Odrzucenie", () => api.rejectTask(t.id, t.rev));
  const regenerate = (t: Task): void =>
    act("Regeneracja", () => api.regenerateTask(t.id, t.rev));
  const saveEdit = (t: Task): void => {
    if (!editForm) return;
    act("Zapis edycji", () => api.editTask(t.id, { ...editForm, expectedRev: t.rev }));
    setEditForm(null);
  };

  const doExport = (format: "json" | "csv"): void =>
    void run(async () => {
      setInfo(null);
      try {
        const r = await api.exportTasks(format);
        const blob = new Blob([r.content], {
          type: format === "csv" ? "text/csv" : "application/json",
        });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = r.filename;
        a.click();
        URL.revokeObjectURL(a.href);
        const { tasks: tsList } = await api.listTasks();
        setTasks(tsList);
        toast.push({
          kind: "ok",
          title: `Eksport ${format.toUpperCase()} gotowy`,
          message: `${r.total} zadań · ${r.newlyExported} nowo wyeksportowanych · pobrano ${r.filename}`,
        });
      } catch (e) {
        toast.push({
          kind: "danger",
          title: "Eksport nie powiódł się",
          message: e instanceof Error ? e.message : "Spróbuj ponownie.",
        });
      }
    });

  const isGen = sel?.status === "generated";

  return (
    <Page
      crumbs={["Mój projekt", "Zadania — kolejka review"]}
      env="prod"
      variant="bleed"
      actions={
        <>
          <div className="ai-status" title="Kolejka review">
            <IconCheck />
            {tasks.length ? `${tasks.length} zadań` : "Brak zadań"}
          </div>
          <Button
            variant="secondary"
            icon={<IconDownload />}
            onClick={() => doExport("json")}
            disabled={busy || !(counts.accepted ?? 0)}
            title="Eksport JSON zaakceptowanych zadań"
          >
            Eksportuj {counts.accepted ?? 0}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => doExport("csv")}
            disabled={busy || !(counts.accepted ?? 0)}
            title="Eksport CSV"
          >
            CSV
          </Button>
          <Button icon={<IconZap />} onClick={analyze} disabled={busy}>
            {busy ? "Analiza…" : "Uruchom analizę AI"}
          </Button>
        </>
      }
    >
      <div className="filter-bar">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            className={`state-tab${filter === f.key ? " active" : ""}`}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
            <span className="ct">{counts[f.key] ?? 0}</span>
          </button>
        ))}
        <div className="spacer" />
        <div className="search">
          <input placeholder="Szukaj w tytułach i opisach…" aria-label="Szukaj zadań" />
        </div>
      </div>

      {error ? (
        <div style={{ padding: "12px 20px" }}>
          <Alert kind="danger">{error}</Alert>
        </div>
      ) : null}
      {info ? (
        <div style={{ padding: "12px 20px" }}>
          <Alert kind="info">{info}</Alert>
        </div>
      ) : null}

      <div className="pane">
        <div className="list" role="list" aria-label="Lista zadań">
          <div className="list-head">
            <div>
              <h2>
                {FILTERS.find((f) => f.key === filter)?.label} · {visible.length}
              </h2>
              <div className="sub">posortowane wg pewności AI</div>
            </div>
          </div>
          {visible.length === 0 ? (
            <EmptyState
              icon={<IconCheck />}
              title="Brak zadań w tym stanie"
              description="Uruchom analizę AI po wysłaniu feedbacku — pogrupuje adnotacje w zadania gotowe do review."
              action={
                <Button icon={<IconZap />} onClick={analyze} disabled={busy}>
                  {busy ? "Analiza…" : "Uruchom analizę AI"}
                </Button>
              }
            />
          ) : (
            [...visible]
              .sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0))
              .map((t) => {
                const sev = SEV[t.priority ?? "medium"];
                const conf = confClass(t.confidence);
                return (
                  <button
                    key={t.id}
                    className={`task-card${sel?.id === t.id ? " selected" : ""}`}
                    onClick={() => setSelId(t.id)}
                    role="listitem"
                  >
                    <div className="meta-row">
                      <span className="id">{t.id.slice(0, 10)}</span>
                      <span>·</span>
                      <span className={`state ${STATE_CLASS[t.status]}`}>{t.status}</span>
                      <span style={{ marginLeft: "auto" }}>
                        {new Date(t.createdAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <div className="title">{t.title}</div>
                    <div className="bottom">
                      <span className="s">
                        <span className={`sev-dot ${sev.cls}`} />
                        {sev.label}
                      </span>
                      <span className="s">{t.annotationIds.length} adnotacji</span>
                      {conf ? (
                        <span className={`conf ${conf.cls}`}>
                          <span>{conf.pct}</span>
                          <span className="bar" />
                        </span>
                      ) : null}
                    </div>
                  </button>
                );
              })
          )}
        </div>

        <div className="detail">
          {!sel ? (
            <div style={{ padding: 40, color: "var(--muted)" }}>
              Wybierz zadanie z listy, aby zobaczyć szczegóły.
            </div>
          ) : (
            <>
              <div className="detail-head">
                <div className="detail-meta-row">
                  <span className="id">{sel.id.slice(0, 12)}</span>
                  <span className="sep">·</span>
                  <span className={`state ${STATE_CLASS[sel.status]}`}>{sel.status}</span>
                  <span className="sep">·</span>
                  <span>
                    priorytet <strong>{SEV[sel.priority ?? "medium"].label}</strong>
                  </span>
                  {confClass(sel.confidence) ? (
                    <>
                      <span className="sep">·</span>
                      <span>
                        pewność <strong>{confClass(sel.confidence)?.pct}</strong>
                      </span>
                    </>
                  ) : null}
                  <span className="sep">·</span>
                  <span>
                    utworzono <strong>{new Date(sel.createdAt).toLocaleString()}</strong> przez AI
                  </span>
                </div>
                <h1 className="detail-h1">{sel.title}</h1>
                <div className="actions-row">
                  <Button
                    variant="secondary"
                    icon={<IconRefresh />}
                    onClick={() => regenerate(sel)}
                    disabled={busy || !isGen}
                  >
                    Regeneruj
                  </Button>
                  <Button
                    variant="secondary"
                    icon={<IconEdit />}
                    onClick={() => setEditForm(editForm ? null : emptyEdit(sel))}
                    disabled={busy || !isGen}
                  >
                    {editForm ? "Anuluj edycję" : "Edytuj"}
                  </Button>
                  <Button
                    variant="danger-ghost"
                    icon={<IconTrash />}
                    onClick={() => reject(sel)}
                    disabled={busy || !isGen}
                  >
                    Odrzuć
                  </Button>
                  <div className="spacer" />
                  <Button
                    size="lg"
                    icon={<IconCheck />}
                    onClick={() => accept(sel)}
                    disabled={busy || !isGen}
                  >
                    Akceptuj i kontynuuj
                  </Button>
                </div>
              </div>

              <div className="detail-body">
                {editForm ? (
                  <div className="card card-pad">
                    <div className="card-h" style={{ padding: 0, border: 0, marginBottom: 14 }}>
                      <h3>Edycja zadania</h3>
                      <span className="extra">rev {sel.rev}</span>
                    </div>
                    <Field label="Tytuł" htmlFor="e-title">
                      <input
                        id="e-title"
                        className="input"
                        value={editForm.title}
                        onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                      />
                    </Field>
                    <Field label="Opis" htmlFor="e-desc">
                      <textarea
                        id="e-desc"
                        className="textarea"
                        value={editForm.description}
                        onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                      />
                    </Field>
                    <Field
                      label="Kryteria akceptacji"
                      htmlFor="e-ac"
                      hint="Jedno kryterium na linię"
                    >
                      <textarea
                        id="e-ac"
                        className="textarea"
                        value={editForm.acceptanceCriteria.join("\n")}
                        onChange={(e) =>
                          setEditForm({
                            ...editForm,
                            acceptanceCriteria: e.target.value
                              .split("\n")
                              .map((s) => s.trim())
                              .filter(Boolean),
                          })
                        }
                      />
                    </Field>
                    <Field label="Etykiety" htmlFor="e-labels" hint="Po przecinku">
                      <input
                        id="e-labels"
                        className="input"
                        value={editForm.labels.join(", ")}
                        onChange={(e) =>
                          setEditForm({ ...editForm, labels: csvToList(e.target.value) })
                        }
                      />
                    </Field>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                      <Field label="Priorytet" htmlFor="e-prio">
                        <select
                          id="e-prio"
                          className="select"
                          value={editForm.priority ?? ""}
                          onChange={(e) =>
                            setEditForm({
                              ...editForm,
                              priority: (e.target.value || null) as Task["priority"],
                            })
                          }
                        >
                          <option value="">—</option>
                          <option value="low">Niski</option>
                          <option value="medium">Średni</option>
                          <option value="high">Wysoki</option>
                        </select>
                      </Field>
                      <Field label="Komponent" htmlFor="e-comp">
                        <input
                          id="e-comp"
                          className="input"
                          value={editForm.component ?? ""}
                          onChange={(e) =>
                            setEditForm({ ...editForm, component: e.target.value || null })
                          }
                        />
                      </Field>
                      <Field label="Sub-task typ" htmlFor="e-sub">
                        <select
                          id="e-sub"
                          className="select"
                          value={editForm.subtaskType ?? ""}
                          onChange={(e) =>
                            setEditForm({
                              ...editForm,
                              subtaskType: (e.target.value || null) as SubtaskType | null,
                            })
                          }
                        >
                          <option value="">—</option>
                          {SUBTYPES.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      </Field>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <Button onClick={() => saveEdit(sel)} disabled={busy}>
                        Zapisz zmiany
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => setEditForm(null)}
                        disabled={busy}
                      >
                        Anuluj
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="card card-pad">
                      <div className="card-h" style={{ padding: 0, border: 0, marginBottom: 14 }}>
                        <h3>Opis</h3>
                      </div>
                      <p>{sel.description || "Brak opisu."}</p>
                      {sel.component || sel.version ? (
                        <p className="hint">
                          Komponent: <span className="mono">{sel.component ?? "—"}</span> · Wersja:{" "}
                          <span className="mono">{sel.version ?? "—"}</span>
                        </p>
                      ) : null}
                    </div>

                    {sel.acceptanceCriteria.length ? (
                      <div className="card card-pad">
                        <div className="card-h" style={{ padding: 0, border: 0, marginBottom: 14 }}>
                          <h3>Kryteria akceptacji</h3>
                          <span className="extra">{sel.acceptanceCriteria.length} zasad</span>
                        </div>
                        <ul className="ac">
                          {sel.acceptanceCriteria.map((c, i) => {
                            const m = GWT.exec(c);
                            const head = m?.[1];
                            const tag = head ? head.toLowerCase() : null;
                            const cls =
                              tag && /given|gdy|jeśli/.test(tag)
                                ? "g"
                                : tag && /when|kiedy/.test(tag)
                                  ? "w"
                                  : tag
                                    ? "t"
                                    : "";
                            return (
                              <li key={i}>
                                {tag ? <span className={`gwt ${cls}`}>{head}</span> : null}
                                {tag ? c.slice(m?.[0]?.length ?? 0) : c}
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    ) : null}

                    <div className="card card-pad">
                      <div className="card-h" style={{ padding: 0, border: 0, marginBottom: 14 }}>
                        <h3>Metadane i sub-taski</h3>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                        <div>
                          <div
                            style={{
                              marginBottom: 6,
                              fontSize: ".75rem",
                              color: "var(--muted)",
                              fontWeight: 600,
                              letterSpacing: ".04em",
                              textTransform: "uppercase",
                            }}
                          >
                            Etykiety
                          </div>
                          <div className="chips">
                            {sel.labels.length ? (
                              sel.labels.map((l) => (
                                <span key={l} className="chip">
                                  {l}
                                </span>
                              ))
                            ) : (
                              <span className="chip add">brak etykiet</span>
                            )}
                          </div>
                        </div>
                        <div>
                          <div
                            style={{
                              marginBottom: 6,
                              fontSize: ".75rem",
                              color: "var(--muted)",
                              fontWeight: 600,
                              letterSpacing: ".04em",
                              textTransform: "uppercase",
                            }}
                          >
                            Sub-taski ({subtasks.length})
                          </div>
                          <div className="subtasks">
                            {subtasks.length ? (
                              subtasks.map((s) => (
                                <div className="subtask" key={s.id}>
                                  <span className="box" />
                                  <span>{s.title}</span>
                                  {s.subtaskType ? (
                                    <span className="ty">{s.subtaskType}</span>
                                  ) : s.component ? (
                                    <span className="ty">{s.component}</span>
                                  ) : null}
                                </div>
                              ))
                            ) : (
                              <div className="subtask">
                                <span className="box" />
                                <span style={{ color: "var(--muted)" }}>Brak sub-tasków</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="card card-pad">
                      <div className="card-h" style={{ padding: 0, border: 0, marginBottom: 14 }}>
                        <h3>Adnotacje źródłowe ({sel.annotationIds.length})</h3>
                        <span className="extra">na podstawie których AI wygenerowała zadanie</span>
                      </div>
                      <div className="src">
                        {sources === null ? (
                          <div
                            aria-busy="true"
                            style={{ display: "flex", flexDirection: "column", gap: 14 }}
                          >
                            {[0, 1].map((i) => (
                              <div
                                key={i}
                                className="src-item"
                                style={{ display: "flex", flexDirection: "column", gap: 10 }}
                              >
                                <Skeleton line width="45%" />
                                <Skeleton height={34} />
                                <Skeleton line width="80%" />
                              </div>
                            ))}
                          </div>
                        ) : sources.length === 0 ? (
                          <p className="hint">Brak powiązanych adnotacji.</p>
                        ) : (
                          sources.map((a, i) => (
                            <div className="src-item" key={a.id}>
                              <div className="src-head">
                                <span className="src-num">{i + 1}</span>
                                <span className="meta">
                                  <strong>{a.id.slice(0, 12)}</strong> · {a.type}
                                  {a.structured ? ` · ${a.structured.severity}` : ""}
                                </span>
                                <span className="by">
                                  {new Date(a.createdAt).toLocaleTimeString([], {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </span>
                              </div>
                              {a.selector ? (
                                <div className="src-selector">{a.selector}</div>
                              ) : null}
                              {a.voiceUrl ? (
                                <div className="voice-bar">
                                  <button
                                    className="voice-play"
                                    aria-label="Odtwórz"
                                    onClick={() => void new Audio(a.voiceUrl as string).play()}
                                  >
                                    <IconPlay />
                                  </button>
                                  <span className="voice-wave">
                                    {Array.from({ length: 22 }, (_, k) => (
                                      <span
                                        key={k}
                                        className={k < 8 ? "p" : ""}
                                        style={{ height: 6 + ((k * 5) % 16) }}
                                      />
                                    ))}
                                  </span>
                                  <span className="voice-time">audio</span>
                                </div>
                              ) : null}
                              <div className="transcript">
                                <div className="l">
                                  {a.transcript
                                    ? "Transkrypcja"
                                    : a.textNote
                                      ? "Notatka tekstowa"
                                      : "Adnotacja"}
                                </div>
                                {a.transcript ??
                                  a.textNote ??
                                  (a.transcriptionStatus
                                    ? `Transkrypcja: ${a.transcriptionStatus}`
                                    : "Brak treści tekstowej.")}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    <div className="card card-pad">
                      <div className="card-h" style={{ padding: 0, border: 0, marginBottom: 14 }}>
                        <h3>Eksport — podgląd</h3>
                        <span className="extra">create-only, idempotentnie</span>
                      </div>
                      <div className="export">
                        <div className="export-target">
                          <div className="h">
                            <span className="logo jira">J</span> Jira
                          </div>
                          <div className="row">
                            <span>Aktywny cel</span>
                            <span className="v">{exportTarget === "jira" ? "tak" : "nie"}</span>
                          </div>
                          <div className="row">
                            <span>Typ</span>
                            <span className="v">Story</span>
                          </div>
                        </div>
                        <div className="export-target">
                          <div className="h">
                            <span className="logo gh">GH</span> GitHub
                          </div>
                          <div className="row">
                            <span>Aktywny cel</span>
                            <span className="v">{exportTarget === "github" ? "tak" : "nie"}</span>
                          </div>
                          <div className="row">
                            <span>Sub-issues</span>
                            <span className="v">{subtasks.length} powiązane</span>
                          </div>
                        </div>
                      </div>
                      <div
                        style={{
                          marginTop: 14,
                          fontSize: ".75rem",
                          color: "var(--muted)",
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        <IconInfo width={12} height={12} />
                        Eksport uruchomi się po przejściu do stanu{" "}
                        <span className="mono" style={{ color: "var(--primary)", fontWeight: 600 }}>
                          accepted
                        </span>{" "}
                        (Phase 9).
                      </div>
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </Page>
  );
}
