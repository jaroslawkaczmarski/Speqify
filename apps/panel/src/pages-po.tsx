import { useEffect, useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import type {
  PoSourceAnnotation,
  ProjectTemplate,
  SubtaskType,
  Task,
  TaskEditInput,
  TaskType,
} from "@speqify/shared";
import { TASK_TYPES } from "@speqify/shared";
import { api, type PoProjectView } from "./api.js";
import {
  Alert,
  Avatar,
  AvatarStack,
  Button,
  Card,
  EmptyState,
  Field,
  Page,
  Pill,
  RoleBadge,
  Skeleton,
  Stat,
  Toggle,
  csvToList,
  useAsync,
  useToast,
} from "./components.js";
import {
  IconCheck,
  IconEdit,
  IconInfo,
  IconMessage,
  IconMic,
  IconPlay,
  IconPlus,
  IconRefresh,
  IconTrash,
  IconUsers,
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
              <span className="n">{v.project.templates.bug.language.toUpperCase()}</span>
              <span className="d">
                <span className="sp">szablon zadań (bug)</span>
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

const TASK_TYPE_LABELS: Record<TaskType, string> = {
  bug: "Błąd",
  change: "Zmiana",
  feature: "Nowa funkcja",
  polish: "Polish",
};

export function PoTemplate() {
  const [allTemplates, setAllTemplates] = useState<Record<TaskType, ProjectTemplate> | null>(null);
  const [activeType, setActiveType] = useState<TaskType>("bug");
  const [saved, setSaved] = useState(false);
  const { error, busy, run } = useAsync();
  useEffect(() => {
    void run(async () => setAllTemplates((await api.poProject()).project.templates));
  }, []);

  const t = allTemplates ? allTemplates[activeType] : null;

  const submit = (e: FormEvent): void => {
    e.preventDefault();
    if (!t) return;
    void run(async () => {
      await api.putTemplate(activeType, t);
      setSaved(true);
    });
  };
  const set = (patch: Partial<ProjectTemplate>): void => {
    setSaved(false);
    if (allTemplates && t) {
      setAllTemplates({ ...allTemplates, [activeType]: { ...t, ...patch } });
    }
  };

  return (
    <Page crumbs={["Mój projekt", "Szablon zadań"]}>
      <div className="page-h">
        <div>
          <h1>Szablon zadań</h1>
          <p className="sub">Per typ zadania (bug / change / feature / polish) — AI dobiera szablon przy klasyfikacji.</p>
        </div>
      </div>
      <div className="tabs" role="tablist" aria-label="Typ zadania" style={{ display: "flex", gap: 6, marginBottom: 14 }}>
        {TASK_TYPES.map((tt) => (
          <button
            key={tt}
            type="button"
            role="tab"
            aria-selected={tt === activeType}
            className={`pill${tt === activeType ? " active" : ""}`}
            onClick={() => {
              setActiveType(tt);
              setSaved(false);
            }}
            style={{
              padding: "6px 12px",
              borderRadius: 999,
              border: "1px solid var(--border)",
              background: tt === activeType ? "var(--primary)" : "transparent",
              color: tt === activeType ? "#fff" : "inherit",
              cursor: "pointer",
              fontSize: ".8125rem",
            }}
          >
            {TASK_TYPE_LABELS[tt]}
          </button>
        ))}
      </div>
      {error ? <Alert kind="danger">{error}</Alert> : null}
      {saved ? <Alert kind="success">Szablon ({TASK_TYPE_LABELS[activeType]}) zapisany.</Alert> : null}
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
    () =>
      tasks.filter((t) => !t.parentTaskId).filter((t) => filter === "all" || t.status === filter),
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
          const nextGen = ts.find(
            (t) => !t.parentTaskId && t.status === "generated" && t.id !== task.id,
          );
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

  const accept = (t: Task): void => act("Akceptacja", () => api.acceptTask(t.id, t.rev), true);
  const reject = (t: Task): void => act("Odrzucenie", () => api.rejectTask(t.id, t.rev));
  const regenerate = (t: Task): void => act("Regeneracja", () => api.regenerateTask(t.id, t.rev));
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
                      <Button variant="secondary" onClick={() => setEditForm(null)} disabled={busy}>
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
                              {a.selector ? <div className="src-selector">{a.selector}</div> : null}
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

/* ===================================================================== *
 *  Batch 4 — PO bundle screens                                          *
 * ===================================================================== */

/** Honesty banner for screens whose backend is out of V1 scope. */
function RepBanner({ children }: { children: ReactNode }) {
  return (
    <Alert kind="warning" title="Widok poglądowy">
      {children} Dane i akcje są reprezentatywne — encja sesji / recenzentów nie istnieje w V1
      (Phase 11). Adnotacje i zadania w pozostałych widokach pochodzą z realnego API.
    </Alert>
  );
}

function relTime(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "—";
  const s = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (s < 60) return "przed chwilą";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min temu`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} godz. temu`;
  const d = Math.floor(h / 24);
  return d === 1 ? "wczoraj" : `${d} dni temu`;
}

/** Representative review-session card (no session entity in V1). */
type RepSession = {
  name: string;
  env: "prod" | "stg" | "dev";
  state: "live" | "danger" | "archived";
  stateLabel: string;
  desc: string;
  range: string;
  by: string;
  url: string;
  anns: number;
  ai: number | null;
  people: string[];
  pct: number;
  pctNote: string;
  done?: boolean;
};

const REP_SESSIONS: RepSession[] = [
  {
    name: "Q1 2026 — Zamówienia & rozliczenia",
    env: "prod",
    state: "live",
    stateLabel: "aktywna",
    desc: "Przegląd przepływu zamówień na produkcji przed sprintem 24 — eksport raportów i statusy zwrotów.",
    range: "12.05 → 24.05.2026",
    by: "Ty",
    url: "app.lumen-lab.com/orders",
    anns: 34,
    ai: 12,
    people: ["MK", "TW", "AL", "JK", "PG"],
    pct: 68,
    pctNote: "68% · do 24.05",
  },
  {
    name: "Hotfix — formularz kontakt B2B",
    env: "prod",
    state: "danger",
    stateLabel: "kończy jutro",
    desc: "Szybka weryfikacja formularza B2B po włączeniu walidacji NIP — edge case'y.",
    range: "18.05 → 20.05.2026",
    by: "Patrycja Górska",
    url: "app.lumen-lab.com/contact",
    anns: 10,
    ai: null,
    people: ["TW"],
    pct: 92,
    pctNote: "92% · kończy jutro",
  },
  {
    name: "Q2 2026 — Refresh nawigacji",
    env: "stg",
    state: "live",
    stateLabel: "aktywna",
    desc: "Przegląd nowej nawigacji bocznej i top-baru na staging'u przed wdrożeniem na prod.",
    range: "17.05 → 14.06.2026",
    by: "Ty",
    url: "staging.lumen-lab.com",
    anns: 18,
    ai: null,
    people: ["MK", "AL", "PG"],
    pct: 24,
    pctNote: "24% · 26 dni do końca",
  },
  {
    name: "Q4 2025 — Onboarding nowych klientów",
    env: "prod",
    state: "archived",
    stateLabel: "ukończona",
    desc: "12.04 → 30.04.2026 · 24 adnotacje · 9 zadań w Jira",
    range: "12.04 → 30.04.2026",
    by: "Marta Kowalska",
    url: "app.lumen-lab.com/onboarding",
    anns: 24,
    ai: 9,
    people: ["MK", "TW", "AL"],
    pct: 100,
    pctNote: "Raport →",
    done: true,
  },
  {
    name: "Q3 2025 — Płatności PSD2",
    env: "prod",
    state: "archived",
    stateLabel: "ukończona",
    desc: "22.03 → 12.04.2026 · 42 adnotacje · 14 zadań",
    range: "22.03 → 12.04.2026",
    by: "Marta Kowalska",
    url: "app.lumen-lab.com/checkout",
    anns: 42,
    ai: 14,
    people: ["MK", "JK", "TW"],
    pct: 100,
    pctNote: "Raport →",
    done: true,
  },
];

export function PoSessions() {
  const [name, setName] = useState<string>("Mój projekt");
  const { run } = useAsync();
  useEffect(() => {
    void run(async () => {
      try {
        setName((await api.poProject()).project.name);
      } catch {
        /* representative header — name is non-critical */
      }
    });
  }, []);

  const active = REP_SESSIONS.filter((s) => !s.done);
  const done = REP_SESSIONS.filter((s) => s.done);

  return (
    <Page
      crumbs={[name, "Sesje review"]}
      env="prod"
      actions={
        <Button onClick={() => (window.location.hash = "/sessions/new")}>
          <IconPlus width={14} height={14} />
          Nowa sesja
        </Button>
      }
    >
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 20,
          marginBottom: 20,
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 700, letterSpacing: "-.015em" }}>
            Sesje review
          </h1>
          <div style={{ color: "var(--muted)", fontSize: ".875rem", marginTop: 4 }}>
            {active.length} aktywne · {done.length} ukończone · czasowo ograniczone okna zbierania
            feedbacku
          </div>
        </div>
      </div>

      <div style={{ marginBottom: 18 }}>
        <RepBanner>
          „Sesje review" grupują adnotacje w okno czasowe. W V1 adnotacje są zbierane przez panele
          bez warstwy sesji.
        </RepBanner>
      </div>

      <div className="stats" style={{ gridTemplateColumns: "repeat(4,1fr)", marginBottom: 24 }}>
        <Stat label="Aktywne" value={active.length} delta="+1 nowa w tym tyg." />
        <Stat label="Ukończone · maj" value={done.length} delta="→ 23 zadania w Jira" />
        <Stat label="Avg. czas trwania" value="5,2 dni" delta="↓ 0,8 d vs. kwiecień" />
        <Stat label="Avg. adnotacje / sesja" value="17" delta="+22% vs. kwiecień" />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {active.map((s) => (
          <Card
            key={s.name}
            role="button"
            tabIndex={0}
            style={{ cursor: "pointer" }}
            onClick={() => (window.location.hash = `/sessions/${REP_SESSIONS.indexOf(s)}`)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                window.location.hash = `/sessions/${REP_SESSIONS.indexOf(s)}`;
              }
            }}
          >
            <div
              style={{
                padding: "18px 22px",
                display: "grid",
                gridTemplateColumns: "1fr auto auto auto auto",
                gap: 18,
                alignItems: "center",
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                  <span style={{ fontSize: "1.0625rem", fontWeight: 700 }}>{s.name}</span>
                  <span className={`env-pill env-${s.env}`}>{s.env}</span>
                  <Pill kind={s.state}>{s.stateLabel}</Pill>
                </div>
                <div
                  style={{
                    fontSize: ".8125rem",
                    color: "var(--secondary)",
                    lineHeight: 1.5,
                    marginBottom: 8,
                    maxWidth: 560,
                  }}
                >
                  {s.desc}
                </div>
                <div
                  style={{
                    fontSize: ".75rem",
                    color: "var(--muted)",
                    display: "flex",
                    gap: 10,
                    flexWrap: "wrap",
                  }}
                >
                  <span>
                    <strong style={{ color: "var(--primary)" }}>{s.range}</strong>
                  </span>
                  <span>·</span>
                  <span>
                    utworzone przez <strong style={{ color: "var(--secondary)" }}>{s.by}</strong>
                  </span>
                  <span>·</span>
                  <span className="mono">{s.url}</span>
                </div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div className="mono" style={{ fontSize: "1.25rem", fontWeight: 700 }}>
                  {s.anns}
                </div>
                <div
                  style={{
                    fontSize: ".625rem",
                    color: "var(--muted)",
                    fontWeight: 600,
                    letterSpacing: ".04em",
                    textTransform: "uppercase",
                  }}
                >
                  adnotacje
                </div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div
                  className="mono"
                  style={{
                    fontSize: "1.25rem",
                    fontWeight: 700,
                    color: s.ai == null ? "var(--muted)" : "var(--accent)",
                  }}
                >
                  {s.ai == null ? "—" : s.ai}
                </div>
                <div
                  style={{
                    fontSize: ".625rem",
                    color: "var(--muted)",
                    fontWeight: 600,
                    letterSpacing: ".04em",
                    textTransform: "uppercase",
                  }}
                >
                  {s.ai == null ? "analiza wkrótce" : "zadania AI"}
                </div>
              </div>
              <AvatarStack people={s.people} />
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-end",
                  gap: 6,
                }}
              >
                <div
                  style={{
                    height: 6,
                    width: 140,
                    borderRadius: 999,
                    background: "var(--surface-muted)",
                    overflow: "hidden",
                  }}
                >
                  <i
                    style={{
                      display: "block",
                      height: "100%",
                      width: `${s.pct}%`,
                      borderRadius: 999,
                      background: s.state === "danger" ? "var(--accent)" : "var(--success)",
                    }}
                  />
                </div>
                <span style={{ fontSize: ".6875rem", color: "var(--muted)" }}>{s.pctNote}</span>
              </div>
            </div>
          </Card>
        ))}

        <div style={{ display: "flex", alignItems: "center", gap: 14, margin: "16px 0 4px" }}>
          <span
            style={{
              fontSize: ".75rem",
              fontWeight: 700,
              letterSpacing: ".06em",
              textTransform: "uppercase",
              color: "var(--muted)",
            }}
          >
            Ukończone
          </span>
          <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
        </div>

        {done.map((s) => (
          <Card
            key={s.name}
            role="button"
            tabIndex={0}
            style={{ cursor: "pointer" }}
            onClick={() => (window.location.hash = `/sessions/${REP_SESSIONS.indexOf(s)}`)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                window.location.hash = `/sessions/${REP_SESSIONS.indexOf(s)}`;
              }
            }}
          >
            <div
              style={{
                padding: "14px 22px",
                display: "grid",
                gridTemplateColumns: "1fr auto auto auto",
                gap: 18,
                alignItems: "center",
                opacity: 0.82,
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                  <span style={{ fontSize: ".9375rem", fontWeight: 600 }}>{s.name}</span>
                  <span className={`env-pill env-${s.env}`}>{s.env}</span>
                  <Pill kind="archived">{s.stateLabel}</Pill>
                </div>
                <div style={{ fontSize: ".75rem", color: "var(--muted)" }}>{s.desc}</div>
              </div>
              <div className="mono" style={{ fontWeight: 600, fontSize: ".8125rem" }}>
                {s.anns} adn.
              </div>
              <div
                className="mono"
                style={{ fontWeight: 600, fontSize: ".8125rem", color: "var(--success)" }}
              >
                {s.ai} wyeksp.
              </div>
              <span style={{ fontSize: ".75rem", color: "var(--muted)" }}>{s.pctNote}</span>
            </div>
          </Card>
        ))}
      </div>
    </Page>
  );
}

const NS_STEPS = ["Podstawy", "Zakres & instrukcje", "Recenzenci", "Harmonogram"];
const NS_FOCUS = [
  "Eksport raportów",
  "Statusy zamówień i zwrotów",
  "Tabela zamówień (filtry, sortowanie, paginacja)",
  "Dashboard analityka",
  "Ustawienia konta",
];

export function PoNewSession() {
  return (
    <Page crumbs={["Mój projekt", "Nowa sesja review"]} env="prod">
      <div style={{ display: "flex", alignItems: "baseline", gap: 14, marginBottom: 18 }}>
        <h1 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 700, letterSpacing: "-.015em" }}>
          Nowa sesja review
        </h1>
        <span style={{ fontSize: ".875rem", color: "var(--muted)" }}>
          krok 2 z 4 · Zakres & instrukcje
        </span>
      </div>

      <div style={{ marginBottom: 20 }}>
        <RepBanner>
          Kreator sesji to makieta — w V1 panele recenzentów tworzy SuperAdmin, a adnotacje trafiają
          wprost do projektu.
        </RepBanner>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${NS_STEPS.length},1fr)`,
          marginBottom: 24,
        }}
      >
        {NS_STEPS.map((label, i) => {
          const doneStep = i === 0;
          const cur = i === 1;
          return (
            <div
              key={label}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 16px",
                background: doneStep ? "var(--success)" : cur ? "var(--primary)" : "var(--surface)",
                color: doneStep || cur ? "#fff" : "var(--muted)",
                border: doneStep || cur ? 0 : "1px solid var(--border)",
                borderRadius:
                  i === 0 ? "8px 0 0 8px" : i === NS_STEPS.length - 1 ? "0 8px 8px 0" : 0,
              }}
            >
              <span
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: "50%",
                  background: doneStep || cur ? "rgba(255,255,255,.2)" : "var(--surface-muted)",
                  fontWeight: 700,
                  fontSize: ".75rem",
                  display: "grid",
                  placeItems: "center",
                  flex: "none",
                }}
              >
                {doneStep ? "✓" : i + 1}
              </span>
              <div>
                <div
                  style={{
                    fontSize: ".75rem",
                    opacity: 0.8,
                    fontWeight: 600,
                    letterSpacing: ".04em",
                    textTransform: "uppercase",
                  }}
                >
                  Krok {i + 1}
                </div>
                <div style={{ fontSize: ".875rem", fontWeight: 600 }}>{label}</div>
              </div>
            </div>
          );
        })}
      </div>

      <Card>
        <div className="card-h">
          <div>
            <h2>Zakres & instrukcje</h2>
            <p className="sub">co recenzent ma sprawdzić i jak</p>
          </div>
        </div>
        <div
          style={{
            padding: "20px 22px",
            display: "flex",
            flexDirection: "column",
            gap: 18,
            maxWidth: 620,
          }}
        >
          <div>
            <label
              style={{ fontSize: ".875rem", fontWeight: 500, marginBottom: 6, display: "block" }}
            >
              URL aplikacji do review
            </label>
            <input
              type="url"
              defaultValue="https://app.lumen-lab.com/orders"
              disabled
              style={{
                width: "100%",
                height: 40,
                border: "1px solid var(--border-strong)",
                borderRadius: 6,
                padding: "0 12px",
                fontSize: ".875rem",
                fontFamily: "var(--font-mono)",
              }}
            />
            <div style={{ fontSize: ".75rem", color: "var(--muted)", marginTop: 6 }}>
              SDK aktywuje się tylko na tej domenie i jej podścieżkach.
            </div>
          </div>

          <div>
            <label
              style={{
                fontSize: ".875rem",
                fontWeight: 500,
                marginBottom: 8,
                display: "block",
              }}
            >
              Obszary skupienia
            </label>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {NS_FOCUS.map((f, i) => (
                <label
                  key={f}
                  style={{ display: "flex", alignItems: "center", gap: 8, fontSize: ".875rem" }}
                >
                  <input
                    type="checkbox"
                    defaultChecked={i < 3}
                    disabled
                    style={{ width: 18, height: 18, accentColor: "var(--primary)" }}
                  />
                  {f}
                </label>
              ))}
            </div>
          </div>

          <div>
            <label
              style={{ fontSize: ".875rem", fontWeight: 500, marginBottom: 6, display: "block" }}
            >
              Instrukcje dla recenzentów
            </label>
            <textarea
              disabled
              defaultValue={
                "Skup się na przepływie eksportu raportów Q1 — w szczególności przycisk Eksportuj raport oraz powiadomienia dla zespołu finansowego.\n\nSprawdź statusy zamówień (anulowane vs zwrócone) — czy etykiety są jednoznaczne wizualnie."
              }
              style={{
                width: "100%",
                minHeight: 120,
                border: "1px solid var(--border-strong)",
                borderRadius: 6,
                padding: 12,
                fontSize: ".875rem",
                fontFamily: "inherit",
                lineHeight: 1.55,
                resize: "vertical",
              }}
            />
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <Button variant="secondary" onClick={() => (window.location.hash = "/sessions")}>
              Wróć do sesji
            </Button>
            <Button disabled title="Kreator sesji — poza V1 (Phase 11)">
              Dalej: Recenzenci
            </Button>
          </div>
        </div>
      </Card>
    </Page>
  );
}

type AnnRow = PoSourceAnnotation & { taskTitle: string };

function annKind(a: PoSourceAnnotation): { voice: boolean; label: string } {
  const voice = a.type === "voice" || a.type === "recording" || !!a.voiceUrl;
  return { voice, label: voice ? "głos" : "txt" };
}

export function PoAnnotations() {
  const [rows, setRows] = useState<AnnRow[] | null>(null);
  const { error, busy, run } = useAsync();
  const toast = useToast();

  const load = (): void =>
    void run(async () => {
      const { tasks } = await api.listTasks();
      const lists = await Promise.all(
        tasks.map(async (t) => ({
          title: t.title,
          annotations: (await api.taskAnnotations(t.id)).annotations,
        })),
      );
      const byId = new Map<string, AnnRow>();
      for (const l of lists) {
        for (const a of l.annotations) {
          if (!byId.has(a.id)) byId.set(a.id, { ...a, taskTitle: l.title });
        }
      }
      const all = [...byId.values()].sort((x, y) => y.createdAt.localeCompare(x.createdAt));
      setRows(all);
    });

  useEffect(() => {
    load();
  }, []);

  const stats = useMemo(() => {
    const r = rows ?? [];
    return {
      total: r.length,
      voice: r.filter((a) => annKind(a).voice).length,
      text: r.filter((a) => !!a.textNote).length,
      classified: r.filter((a) => !!a.structured).length,
    };
  }, [rows]);

  const analyze = (): void =>
    void run(async () => {
      const res = await api.analyze();
      toast.push({
        kind: "ok",
        title: "Analiza AI uruchomiona",
        message: `${res.annotations} adnotacji przetworzono · ${res.tasksCreated} zadań utworzono`,
      });
      load();
    });

  const exportJson = (): void => {
    const blob = new Blob([JSON.stringify(rows ?? [], null, 2)], {
      type: "application/json",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `speqify-annotations-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <Page
      crumbs={["Mój projekt", "Adnotacje"]}
      env="prod"
      actions={
        <>
          <Button variant="secondary" onClick={exportJson} disabled={!rows || rows.length === 0}>
            <IconDownload width={14} height={14} />
            Eksport JSON
          </Button>
          <Button onClick={analyze} disabled={busy}>
            <IconZap width={14} height={14} />
            Uruchom analizę AI
          </Button>
        </>
      }
    >
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 700, letterSpacing: "-.015em" }}>
          Adnotacje
        </h1>
        <div style={{ color: "var(--muted)", fontSize: ".875rem", marginTop: 4 }}>
          Surowy feedback recenzentów (na żywo z API) — źródło zadań generowanych przez AI
        </div>
      </div>

      {error ? (
        <div style={{ marginBottom: 16 }}>
          <Alert kind="danger" title="Nie udało się wczytać adnotacji">
            {error}
          </Alert>
        </div>
      ) : null}

      <div className="stats" style={{ gridTemplateColumns: "repeat(4,1fr)", marginBottom: 20 }}>
        <Stat label="Wszystkie" value={rows ? stats.total : "—"} />
        <Stat label="Głosowe" value={rows ? stats.voice : "—"} />
        <Stat label="Tekstowe" value={rows ? stats.text : "—"} />
        <Stat
          label="Z klasyfikacją AI"
          value={rows ? stats.classified : "—"}
          delta={
            rows && stats.total
              ? `${Math.round((stats.classified / stats.total) * 100)}%`
              : undefined
          }
        />
      </div>

      {!rows ? (
        <Card>
          <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 10 }}>
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} height={28} line />
            ))}
          </div>
        </Card>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<IconMessage />}
          title="Brak adnotacji"
          description="Adnotacje pojawią się tutaj, gdy recenzenci prześlą feedback przez nakładkę SDK. Następnie uruchom analizę AI, aby wygenerować zadania."
        />
      ) : (
        <Card style={{ overflow: "hidden" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "separate",
              borderSpacing: 0,
              fontSize: ".875rem",
            }}
          >
            <thead>
              <tr>
                {["ID", "Treść", "Element", "Klasyfikacja AI", "Tagi", "Czas"].map((h) => (
                  <th
                    key={h}
                    style={{
                      textAlign: "left",
                      fontSize: ".6875rem",
                      color: "var(--muted)",
                      textTransform: "uppercase",
                      letterSpacing: ".06em",
                      fontWeight: 700,
                      padding: "10px 16px",
                      background: "var(--surface-muted)",
                      borderBottom: "1px solid var(--border)",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => {
                const k = annKind(a);
                const content =
                  a.transcript ?? a.textNote ?? (k.voice ? "nagranie głosowe" : "(brak treści)");
                return (
                  <tr key={a.id}>
                    <td
                      style={{
                        padding: "12px 16px",
                        borderBottom: "1px solid var(--border)",
                        fontFamily: "var(--font-mono)",
                        fontSize: ".75rem",
                        fontWeight: 600,
                        color: "var(--secondary)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {a.id.slice(0, 10)}
                    </td>
                    <td
                      style={{
                        padding: "12px 16px",
                        borderBottom: "1px solid var(--border)",
                        maxWidth: 360,
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                            fontSize: ".625rem",
                            fontWeight: 700,
                            textTransform: "uppercase",
                            letterSpacing: ".04em",
                            padding: "2px 6px",
                            borderRadius: 4,
                            flex: "none",
                            background: k.voice ? "#FEF2F2" : "#EFF6FF",
                            color: k.voice ? "var(--accent)" : "var(--info)",
                          }}
                        >
                          {k.voice ? <IconMic width={10} height={10} /> : null}
                          {k.label}
                        </span>
                        <span
                          style={{
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                          title={content}
                        >
                          {content}
                        </span>
                      </div>
                    </td>
                    <td
                      style={{
                        padding: "12px 16px",
                        borderBottom: "1px solid var(--border)",
                        fontFamily: "var(--font-mono)",
                        fontSize: ".6875rem",
                        color: "var(--muted)",
                        maxWidth: 200,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {a.selector ?? "—"}
                    </td>
                    <td
                      style={{
                        padding: "12px 16px",
                        borderBottom: "1px solid var(--border)",
                      }}
                    >
                      {a.structured ? (
                        <Pill
                          kind={
                            a.structured.severity === "high"
                              ? "danger"
                              : a.structured.severity === "medium"
                                ? "warn"
                                : "info"
                          }
                        >
                          {a.structured.kind === "bug" ? "bug" : "zmiana"} · {a.structured.severity}
                        </Pill>
                      ) : (
                        <span style={{ color: "var(--muted)" }}>—</span>
                      )}
                    </td>
                    <td
                      style={{
                        padding: "12px 16px",
                        borderBottom: "1px solid var(--border)",
                        fontSize: ".75rem",
                        color: "var(--muted)",
                        maxWidth: 160,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {a.tags.length ? a.tags.join(", ") : "—"}
                    </td>
                    <td
                      style={{
                        padding: "12px 16px",
                        borderBottom: "1px solid var(--border)",
                        fontSize: ".75rem",
                        color: "var(--muted)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {relTime(a.createdAt)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div
            style={{
              padding: "12px 18px",
              fontSize: ".8125rem",
              color: "var(--muted)",
              borderTop: "1px solid var(--border)",
            }}
          >
            {rows.length} adnotacji · źródło zadań w kolejce review
          </div>
        </Card>
      )}
    </Page>
  );
}

type RepReviewer = {
  initials: string;
  name: string;
  email: string;
  role: "Lead" | "Reviewer";
  sessions: number;
  anns: number;
  last: string;
  twofa: boolean;
  status: "active" | "idle";
};

const REP_REVIEWERS: RepReviewer[] = [
  {
    initials: "TW",
    name: "Tomek Wójcik",
    email: "tomek.wojcik@lumen-lab.com",
    role: "Lead",
    sessions: 3,
    anns: 28,
    last: "8 min temu · online",
    twofa: true,
    status: "active",
  },
  {
    initials: "AL",
    name: "Anna Lis",
    email: "anna.lis@lumen-lab.com",
    role: "Reviewer",
    sessions: 3,
    anns: 24,
    last: "2 godz. temu",
    twofa: true,
    status: "active",
  },
  {
    initials: "JK",
    name: "Jacek Kowal",
    email: "j.kowal@fintech-co.pl",
    role: "Reviewer",
    sessions: 2,
    anns: 18,
    last: "wczoraj",
    twofa: true,
    status: "active",
  },
  {
    initials: "PG",
    name: "Patrycja Górska",
    email: "p.gorska@northstack.io",
    role: "Reviewer",
    sessions: 2,
    anns: 14,
    last: "wczoraj",
    twofa: false,
    status: "idle",
  },
  {
    initials: "MN",
    name: "Marek Nowak",
    email: "m.nowak@lumen-lab.com",
    role: "Reviewer",
    sessions: 1,
    anns: 8,
    last: "3 dni temu",
    twofa: false,
    status: "idle",
  },
  {
    initials: "SK",
    name: "Sebastian Kotowicz",
    email: "s.kotowicz@lumen-lab.com",
    role: "Reviewer",
    sessions: 1,
    anns: 3,
    last: "12 dni temu",
    twofa: false,
    status: "idle",
  },
];

export function PoReviewers() {
  return (
    <Page
      crumbs={["Mój projekt", "Recenzenci"]}
      env="prod"
      actions={
        <Button disabled title="Zapraszanie recenzentów — panele tworzy SuperAdmin (V1)">
          <IconUsers width={14} height={14} />
          Zaproś recenzenta
        </Button>
      }
    >
      <div style={{ marginBottom: 18 }}>
        <h1 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 700, letterSpacing: "-.015em" }}>
          Recenzenci
        </h1>
        <div style={{ color: "var(--muted)", fontSize: ".875rem", marginTop: 4 }}>
          {REP_REVIEWERS.length} osób w projekcie · feedback przez nakładkę SDK
        </div>
      </div>

      <div style={{ marginBottom: 20 }}>
        <RepBanner>
          W V1 „recenzent" to rola panelu, którą wydaje SuperAdmin — dedykowana lista osób z 2FA i
          statystykami jest poglądowa.
        </RepBanner>
      </div>

      <div className="stats" style={{ gridTemplateColumns: "repeat(4,1fr)", marginBottom: 20 }}>
        <Stat label="Aktywni" value={8} delta="+2 w tym mies." />
        <Stat label="Aktywni · 7d" value={5} delta="62%" />
        <Stat label="Avg. adnotacje / recenzent" value={12} delta="+3 vs. poprzedni mies." />
        <Stat label="Zaproszenia oczekujące" value={3} delta="2 starsze niż 3 dni" deltaNeg />
      </div>

      <Card style={{ overflow: "hidden" }}>
        <table
          style={{
            width: "100%",
            borderCollapse: "separate",
            borderSpacing: 0,
            fontSize: ".875rem",
          }}
        >
          <thead>
            <tr>
              {["Recenzent", "Rola", "Sesje", "Adn.", "Ostatnio", "2FA", "Status"].map((h) => (
                <th
                  key={h}
                  style={{
                    textAlign: "left",
                    fontSize: ".6875rem",
                    color: "var(--muted)",
                    textTransform: "uppercase",
                    letterSpacing: ".06em",
                    fontWeight: 700,
                    padding: "10px 16px",
                    background: "var(--surface-muted)",
                    borderBottom: "1px solid var(--border)",
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {REP_REVIEWERS.map((r) => (
              <tr key={r.email}>
                <td style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <Avatar initials={r.initials} />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: ".875rem" }}>{r.name}</div>
                      <div
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: ".6875rem",
                          color: "var(--muted)",
                        }}
                      >
                        {r.email}
                      </div>
                    </div>
                  </div>
                </td>
                <td style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)" }}>
                  <RoleBadge role="rev" />
                  {r.role === "Lead" ? (
                    <span
                      style={{
                        marginLeft: 6,
                        fontSize: ".6875rem",
                        color: "var(--info)",
                        fontWeight: 700,
                      }}
                    >
                      Lead
                    </span>
                  ) : null}
                </td>
                <td
                  style={{
                    padding: "14px 16px",
                    borderBottom: "1px solid var(--border)",
                    fontVariantNumeric: "tabular-nums",
                    fontWeight: 600,
                  }}
                >
                  {r.sessions}
                </td>
                <td
                  style={{
                    padding: "14px 16px",
                    borderBottom: "1px solid var(--border)",
                    fontVariantNumeric: "tabular-nums",
                    fontWeight: 600,
                  }}
                >
                  {r.anns}
                </td>
                <td
                  style={{
                    padding: "14px 16px",
                    borderBottom: "1px solid var(--border)",
                    fontSize: ".8125rem",
                    color: "var(--secondary)",
                  }}
                >
                  {r.last}
                </td>
                <td style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)" }}>
                  {r.twofa ? (
                    <span
                      style={{ fontSize: ".6875rem", color: "var(--success)", fontWeight: 600 }}
                    >
                      ✓ 2FA
                    </span>
                  ) : (
                    <span style={{ fontSize: ".6875rem", color: "var(--muted)" }}>— brak</span>
                  )}
                </td>
                <td style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)" }}>
                  <Pill kind={r.status === "active" ? "live" : "warn"}>{r.status}</Pill>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </Page>
  );
}

type TlEntry = {
  time: string;
  who: string;
  ini: string;
  action: string;
  env?: "prod" | "stg" | "dev";
  annId: string;
  selector: string;
  voice?: string;
  note: string;
  tags: string[];
};

const REP_TIMELINE: TlEntry[] = [
  {
    time: "14:32",
    who: "Tomek Wójcik",
    ini: "TW",
    action: "dodał głos + tekst",
    env: "prod",
    annId: "SPQ-A-091",
    selector: 'button.btn-export[data-action="export"]',
    voice: "0:42",
    note: "Po eksporcie raport powinien lądować na e-mailu PO oraz jako załącznik w Slacku — w tej chwili pobiera się tylko CSV. To jeden z top requestów zespołu finansów.",
    tags: ["eksport", "notyfikacje"],
  },
  {
    time: "13:58",
    who: "Anna Lis",
    ini: "AL",
    action: "dodała notatkę tekstową",
    env: "prod",
    annId: "SPQ-A-090",
    selector: ".status-pill--cancelled",
    note: 'Etykiety „anulowane" i „zwrócone" mają identyczny kolor — łatwo je pomylić na liście zamówień.',
    tags: ["UX", "statusy"],
  },
  {
    time: "11:20",
    who: "Anna Lis",
    ini: "AL",
    action: "dodała głos",
    env: "prod",
    annId: "SPQ-A-088",
    selector: "button.btn-export",
    voice: "0:18",
    note: "Brakuje notyfikacji dla zespołu, że ktoś pobrał raport — przydałby się ślad w audycie.",
    tags: ["eksport"],
  },
];

/** PO · Sesja review — detail (PO Session.html). Representative: there is
 *  no session entity in V1; annotations/tasks live at project scope. */
export function PoSessionDetail({ id }: { id: string }) {
  const idx = Math.max(0, Math.min(REP_SESSIONS.length - 1, Number(id) || 0));
  const s = REP_SESSIONS[idx];
  if (!s) {
    return (
      <Page crumbs={["Mój projekt", "Sesje review", "Sesja"]}>
        <EmptyState
          icon={<IconInfo />}
          title="Nie znaleziono sesji"
          description="Ta sesja nie istnieje lub została zakończona."
          action={
            <Button variant="secondary" onClick={() => (window.location.hash = "/sessions")}>
              Wróć do sesji
            </Button>
          }
        />
      </Page>
    );
  }

  return (
    <Page
      crumbs={["Mój projekt", "Sesje review", s.name]}
      env={s.env}
      actions={
        <>
          <Button variant="secondary" onClick={() => (window.location.hash = "/sessions")}>
            Wszystkie sesje
          </Button>
          <Button onClick={() => (window.location.hash = "/tasks")}>
            <IconZap width={14} height={14} />
            Uruchom analizę AI
          </Button>
        </>
      }
    >
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 14,
          padding: "22px 26px",
          display: "flex",
          alignItems: "center",
          gap: 18,
          marginBottom: 18,
        }}
      >
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 11,
            background: "linear-gradient(135deg,#22C55E,#0EA5E9)",
            flex: "none",
          }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginBottom: 4,
              flexWrap: "wrap",
            }}
          >
            <h1
              style={{ margin: 0, fontSize: "1.375rem", fontWeight: 700, letterSpacing: "-.015em" }}
            >
              {s.name}
            </h1>
            <span className={`env-pill env-${s.env}`}>{s.env}</span>
            <Pill kind={s.done ? "archived" : s.state}>{s.stateLabel}</Pill>
          </div>
          <div
            style={{
              fontSize: ".8125rem",
              color: "var(--muted)",
              display: "flex",
              alignItems: "center",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            <span className="mono">{s.url}</span>
            <span>·</span>
            <span>
              <strong style={{ color: "var(--primary)" }}>{s.range}</strong>
            </span>
            <span>·</span>
            <span>
              owner: <strong style={{ color: "var(--secondary)" }}>{s.by}</strong>
            </span>
          </div>
        </div>
      </div>

      <div style={{ marginBottom: 18 }}>
        <RepBanner>
          Widok pojedynczej sesji (timeline + nagrania) to makieta — w V1 adnotacje są zbierane
          przez panele i analizowane w kolejce zadań bez warstwy sesji.
        </RepBanner>
      </div>

      <div className="stats" style={{ gridTemplateColumns: "repeat(4,1fr)", marginBottom: 20 }}>
        <Stat label="Adnotacje" value={s.anns} delta="+8 dzisiaj" />
        <Stat label="Głosowe" value={Math.round(s.anns * 0.65)} delta="avg 0:34" />
        <Stat label="Recenzenci" value={s.people.length} delta="6 aktywnych w 24h" />
        <Stat label="Postęp" value={`${s.pct}%`} delta={s.pctNote} />
      </div>

      <nav
        style={{
          display: "flex",
          gap: 2,
          borderBottom: "1px solid var(--border)",
          marginBottom: 18,
        }}
      >
        {["Timeline", "Adnotacje", "Recenzenci", "Analiza AI", "Ustawienia"].map((t, i) => (
          <span
            key={t}
            style={{
              padding: "11px 14px",
              fontSize: ".875rem",
              fontWeight: i === 0 ? 600 : 500,
              color: i === 0 ? "var(--primary)" : "var(--muted)",
              borderBottom: `2px solid ${i === 0 ? "var(--primary)" : "transparent"}`,
              marginBottom: -1,
              display: "inline-flex",
              alignItems: "center",
              gap: 7,
            }}
          >
            {t}
            {i === 0 ? (
              <span
                className="mono"
                style={{
                  fontSize: ".6875rem",
                  fontWeight: 700,
                  background: "#FEF2F2",
                  color: "var(--accent)",
                  padding: "1px 6px",
                  borderRadius: 999,
                }}
              >
                {s.anns}
              </span>
            ) : null}
          </span>
        ))}
      </nav>

      <Card>
        <div className="card-h">
          <div>
            <h2>Timeline adnotacji</h2>
            <p className="sub">chronologicznie · ostatnie 24h · poglądowo</p>
          </div>
        </div>
        <div style={{ padding: "6px 0" }}>
          <div
            style={{
              padding: "14px 22px 4px",
              fontSize: ".6875rem",
              fontWeight: 700,
              color: "var(--muted)",
              letterSpacing: ".06em",
              textTransform: "uppercase",
            }}
          >
            Dziś
          </div>
          {REP_TIMELINE.map((e, i) => (
            <div
              key={e.annId}
              style={{
                padding: "14px 22px",
                borderBottom: i < REP_TIMELINE.length - 1 ? "1px solid var(--border)" : "none",
                display: "flex",
                gap: 14,
              }}
            >
              <div style={{ width: 40, textAlign: "right", flex: "none" }}>
                <div
                  className="mono"
                  style={{ fontSize: ".75rem", fontWeight: 600, color: "var(--primary)" }}
                >
                  {e.time}
                </div>
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  flex: "none",
                }}
              >
                <Avatar initials={e.ini} size="sm" />
                {i < REP_TIMELINE.length - 1 ? (
                  <div
                    style={{
                      width: 2,
                      flex: 1,
                      background: "var(--border)",
                      marginTop: 6,
                    }}
                  />
                ) : null}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginBottom: 6,
                    flexWrap: "wrap",
                  }}
                >
                  <strong style={{ fontWeight: 600, fontSize: ".875rem" }}>{e.who}</strong>
                  <span style={{ fontSize: ".75rem", color: "var(--muted)" }}>{e.action}</span>
                  {e.env ? <span className={`env-pill env-${e.env}`}>{e.env}</span> : null}
                  <span
                    className="mono"
                    style={{
                      marginLeft: "auto",
                      fontSize: ".6875rem",
                      color: "var(--muted)",
                    }}
                  >
                    {e.annId}
                  </span>
                </div>
                <div
                  className="mono"
                  style={{
                    fontSize: ".75rem",
                    color: "var(--primary)",
                    background: "var(--surface-muted)",
                    padding: "5px 10px",
                    borderRadius: 6,
                    marginBottom: 8,
                    display: "inline-block",
                    wordBreak: "break-all",
                  }}
                >
                  {e.selector}
                </div>
                {e.voice ? (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      fontSize: ".75rem",
                      color: "var(--accent)",
                      fontWeight: 600,
                      marginBottom: 8,
                    }}
                  >
                    <IconMic width={13} height={13} />
                    Nagranie głosowe · {e.voice}
                  </div>
                ) : null}
                <div
                  style={{
                    fontSize: ".8125rem",
                    lineHeight: 1.55,
                    color: "var(--secondary)",
                    fontStyle: "italic",
                  }}
                >
                  „{e.note}"
                </div>
                <div
                  style={{
                    marginTop: 8,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    flexWrap: "wrap",
                    fontSize: ".6875rem",
                  }}
                >
                  {e.tags.map((t) => (
                    <span
                      key={t}
                      style={{
                        background: "var(--surface-muted)",
                        border: "1px solid var(--border)",
                        padding: "2px 7px",
                        borderRadius: 999,
                        color: "var(--secondary)",
                        fontWeight: 500,
                      }}
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </Page>
  );
}
