import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import type {
  AdminStats,
  AuditEntry,
  Panel,
  PlatformProviderConfigView,
  Project,
  ProjectStatus,
  User,
} from "@speqify/shared";
import { api, sdkSnippet } from "./api.js";
import {
  Alert,
  Button,
  ConfirmModal,
  Field,
  Page,
  Stat,
  csvToList,
  useAsync,
} from "./components.js";
import {
  IconCheck,
  IconAlert,
  IconX,
  IconPlus,
  IconSearch,
  IconShield,
} from "./icons.js";

const SPARK = "0,18 8,14 16,16 24,10 32,12 40,6 48,9 56,4 64,7 72,3 80,5";

const STATUS_PILL: Record<ProjectStatus, { cls: string; label: string }> = {
  live: { cls: "live", label: "live" },
  paused: { cls: "paused", label: "paused" },
  archived: { cls: "archived", label: "archived" },
};

function ago(iso: string): string {
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return "przed chwilą";
  if (s < 3600) return `${Math.floor(s / 60)} min temu`;
  if (s < 86400) return `${Math.floor(s / 3600)} godz. temu`;
  return `${Math.floor(s / 86400)} dni temu`;
}

/** prod/stg/dev guess from an environment URL (cosmetic env pill). */
function envOf(url: string | undefined): { cls: string; label: string } {
  const u = (url ?? "").toLowerCase();
  if (/(localhost|127\.0\.0\.1|\bdev\b|\.dev)/.test(u)) return { cls: "env-dev", label: "dev" };
  if (/(staging|stg|test|preview|qa)/.test(u)) return { cls: "env-stg", label: "stg" };
  return { cls: "env-prod", label: "prod" };
}
function hostOf(url: string | undefined): string {
  try {
    return new URL(url ?? "").host;
  } catch {
    return url ?? "—";
  }
}

export function Dashboard() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [providers, setProviders] = useState<PlatformProviderConfigView | null>(null);
  const { error, run } = useAsync();
  useEffect(() => {
    void run(async () => {
      const [s, p, a, pr] = await Promise.all([
        api.adminStats(),
        api.listProjects(),
        api.adminAudit(),
        api.getProviders(),
      ]);
      setStats(s);
      setProjects(p.projects);
      setAudit(a.entries);
      setProviders(pr.config);
    });
  }, []);

  const acceptPct =
    stats && stats.acceptRate != null ? `${Math.round(stats.acceptRate * 100)}%` : "—";

  return (
    <Page
      crumbs={["Speqify Internal", "Pulpit administratora"]}
      actions={
        <>
          <div className="top-search">
            <IconSearch />
            <input placeholder="Szukaj projektów, użytkowników, kluczy…" aria-label="Szukaj" />
            <span className="kbd">⌘K</span>
          </div>
          <a className="btn btn-secondary" href="#/audit">
            <IconShield />
            Audyt
          </a>
          <a className="btn btn-primary" href="#/projects">
            <IconPlus />
            Nowy projekt
          </a>
        </>
      }
    >
      <div className="page-h">
        <div>
          <h1>Pulpit administratora</h1>
          <p className="sub">
            Speqify Internal · {stats?.projects ?? 0} projektów · {stats?.productOwners ?? 0}{" "}
            Product Ownerów
          </p>
        </div>
        <div className="right">
          <div className="seg" role="radiogroup" aria-label="Zakres">
            <button>24h</button>
            <button className="active">7 dni</button>
            <button>30 dni</button>
            <button>Q2</button>
          </div>
        </div>
      </div>

      {error ? <Alert kind="danger">{error}</Alert> : null}

      <div className="stats">
        <Stat
          label="Projekty"
          value={stats?.projects ?? "—"}
          delta={<span className="sp">dane na żywo</span>}
        />
        <Stat
          label="Product Owners"
          value={stats?.productOwners ?? "—"}
          delta={<span className="sp">dane na żywo</span>}
        />
        <Stat
          label="Adnotacje"
          value={stats?.annotations ?? "—"}
          delta={
            <>
              {stats?.submitted ?? 0} submitted <span className="sp">dane na żywo</span>
            </>
          }
        />
        <Stat
          label="Zadania AI"
          value={stats?.tasks ?? "—"}
          delta={
            <>
              {acceptPct} akcept. <span className="sp">dane na żywo</span>
            </>
          }
        />
        <Stat
          label="Koszt AI · maj"
          value="€ 248,40"
          deltaNeg
          delta={
            <>
              62% budżetu <span className="sp">dane przykładowe</span>
            </>
          }
        />
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-h">
            <div>
              <h2>Projekty</h2>
              <p className="sub">status i konfiguracja per projekt · dane na żywo</p>
            </div>
            <a className="btn btn-ghost btn-sm" href="#/projects">
              Zarządzaj →
            </a>
          </div>
          <table className="tbl">
            <thead>
              <tr>
                <th>Projekt</th>
                <th>Env</th>
                <th className="num">PO</th>
                <th>Aktywność</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {projects.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ color: "var(--muted)" }}>
                    Brak projektów. Utwórz pierwszy w „Projekty”.
                  </td>
                </tr>
              ) : (
                projects.map((p) => {
                  const env = envOf(p.environmentUrls[0]);
                  const st = STATUS_PILL[p.status];
                  return (
                    <tr key={p.id}>
                      <td>
                        <div className="name">
                          <span className="sq" />
                          <div>
                            <div className="n">{p.name}</div>
                            <div className="k">{hostOf(p.environmentUrls[0])}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className={`env-pill ${env.cls}`}>{env.label}</span>
                      </td>
                      <td className="num">
                        <span className="pill-code">{p.productOwnerId.slice(0, 8)}</span>
                      </td>
                      <td>
                        <svg className="spark" viewBox="0 0 80 24" preserveAspectRatio="none">
                          <polyline
                            fill="none"
                            stroke="#15803D"
                            strokeWidth="1.5"
                            points={SPARK}
                          />
                        </svg>
                      </td>
                      <td>
                        <span className={`pill ${st.cls}`}>
                          <span className="dot" />
                          {st.label}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="col">
          <div className="card">
            <div className="card-h">
              <div>
                <h2>Dostawcy AI</h2>
                <p className="sub">konfiguracja platformy · status/p95 = przykładowe</p>
              </div>
              <a className="btn btn-ghost btn-sm" href="#/providers">
                Konfiguruj →
              </a>
            </div>
            {providers ? (
              <>
                <div className="ai-row">
                  <div className="ai-logo" style={{ background: "#D97757" }}>
                    AI
                  </div>
                  <div className="ai-meta">
                    <div className="n">
                      {providers.aiProvider} · {providers.aiModel}
                    </div>
                    <div className="d">
                      {providers.aiKeyConfigured
                        ? `sk-•••••${providers.aiKeyHint ?? ""}`
                        : "klucz nieustawiony"}
                    </div>
                  </div>
                  <div className="ai-st">
                    <span className={`pill ${providers.aiKeyConfigured ? "live" : "warn"}`}>
                      <span className="dot" />
                      {providers.aiKeyConfigured ? "configured" : "no key"}
                    </span>
                    <span className="lat">p95 —</span>
                  </div>
                </div>
                <div className="ai-row">
                  <div className="ai-logo" style={{ background: "#7C3AED" }}>
                    W
                  </div>
                  <div className="ai-meta">
                    <div className="n">Transkrypcja · {providers.transcriptionProvider}</div>
                    <div className="d">{providers.transcriptionEndpoint ?? "endpoint domyślny"}</div>
                  </div>
                  <div className="ai-st">
                    <span className="pill live">
                      <span className="dot" />
                      configured
                    </span>
                    <span className="lat">p95 —</span>
                  </div>
                </div>
              </>
            ) : (
              <div className="ai-row">
                <div className="ai-meta">
                  <div className="n">Brak konfiguracji dostawcy</div>
                  <div className="d">Ustaw w „Dostawcy AI”.</div>
                </div>
              </div>
            )}
          </div>

          <div className="card">
            <div className="card-h">
              <div>
                <h2>Budżet AI · maj 2026</h2>
                <p className="sub">dane przykładowe (metering = Phase 11)</p>
              </div>
            </div>
            <div className="budget-card">
              <div className="budget-row">
                <span className="l">Zużycie</span>
                <span className="v">
                  € 248,40 <small>/ € 400</small>
                </span>
              </div>
              <div className="progress">
                <div className="progress-bar" style={{ width: "62%" }} />
              </div>
              <div className="budget-foot">
                <span>62% wykorzystane</span>
                <span>Reset 1 czerwca</span>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-h">
              <div>
                <h2>Ostatnie zdarzenia</h2>
                <p className="sub">audit log · dane na żywo</p>
              </div>
            </div>
            <div>
              {audit.length === 0 ? (
                <div className="audit-row">
                  <div>
                    <div className="a" style={{ color: "var(--muted)" }}>
                      Brak zdarzeń.
                    </div>
                  </div>
                </div>
              ) : (
                audit.map((e) => (
                  <div className="audit-row" key={e.id}>
                    <span className={`ic ${e.severity}`}>
                      {e.severity === "ok" ? (
                        <IconCheck />
                      ) : e.severity === "warn" ? (
                        <IconAlert />
                      ) : (
                        <IconX />
                      )}
                    </span>
                    <div>
                      <div className="a">{e.summary}</div>
                      <div className="t">
                        {ago(e.at)} · {e.actor}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </Page>
  );
}

export function ProductOwners() {
  const [users, setUsers] = useState<User[]>([]);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [created, setCreated] = useState<{ email: string; password: string } | null>(null);
  const { error, busy, run } = useAsync();

  const load = (): void => void run(async () => setUsers((await api.listUsers()).users));
  useEffect(() => load(), []);

  const submit = (e: FormEvent): void => {
    e.preventDefault();
    void run(async () => {
      const r = await api.createUser(email, name);
      setCreated({ email: r.email, password: r.password });
      setEmail("");
      setName("");
      setUsers((await api.listUsers()).users);
    });
  };

  const pos = users.filter((u) => u.role === "product_owner");
  return (
    <Page crumbs={["Speqify Internal", "Użytkownicy"]}>
      <div className="page-h">
        <div>
          <h1>Użytkownicy</h1>
          <p className="sub">Konta Product Ownerów tworzone przez SA</p>
        </div>
      </div>
      {error ? <Alert kind="danger">{error}</Alert> : null}
      {created ? (
        <Alert kind="success">
          Utworzono <b>{created.email}</b>. Hasło jednorazowe:{" "}
          <span className="pill-code">{created.password}</span> — skopiuj teraz.
        </Alert>
      ) : null}
      <div className="card">
        <table className="tbl">
          <thead>
            <tr>
              <th>Nazwa</th>
              <th>E-mail</th>
              <th>Id</th>
            </tr>
          </thead>
          <tbody>
            {pos.length === 0 ? (
              <tr>
                <td colSpan={3} style={{ color: "var(--muted)" }}>
                  Brak Product Ownerów.
                </td>
              </tr>
            ) : (
              pos.map((u) => (
                <tr key={u.id}>
                  <td>{u.displayName}</td>
                  <td>{u.email}</td>
                  <td>
                    <span className="pill-code">{u.id}</span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <form onSubmit={submit} className="card card-pad" style={{ marginTop: 20, maxWidth: 520 }} noValidate>
        <h2 className="section-title" style={{ marginTop: 0 }}>
          Utwórz Product Ownera
        </h2>
        <Field label="Nazwa wyświetlana" htmlFor="po-name">
          <input
            id="po-name"
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </Field>
        <Field label="E-mail" htmlFor="po-email">
          <input
            id="po-email"
            type="email"
            className="input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </Field>
        <Button type="submit" disabled={busy}>
          {busy ? "Tworzenie…" : "Utwórz PO"}
        </Button>
      </form>
    </Page>
  );
}

export function Projects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [name, setName] = useState("");
  const [poId, setPoId] = useState("");
  const [urls, setUrls] = useState("");
  const { error, busy, run } = useAsync();

  const load = (): void =>
    void run(async () => {
      const [p, u] = await Promise.all([api.listProjects(), api.listUsers()]);
      setProjects(p.projects);
      setUsers(u.users);
    });
  useEffect(() => load(), []);

  const submit = (e: FormEvent): void => {
    e.preventDefault();
    void run(async () => {
      await api.createProject(name, poId, csvToList(urls));
      setName("");
      setUrls("");
      setProjects((await api.listProjects()).projects);
    });
  };
  const changeStatus = (id: string, status: ProjectStatus): void =>
    void run(async () => {
      await api.setProjectStatus(id, status);
      setProjects((await api.listProjects()).projects);
    });

  const pos = users.filter((u) => u.role === "product_owner");
  return (
    <Page crumbs={["Speqify Internal", "Projekty"]}>
      <div className="page-h">
        <div>
          <h1>Projekty</h1>
          <p className="sub">{projects.length} projektów · status SA-sterowany</p>
        </div>
      </div>
      {error ? <Alert kind="danger">{error}</Alert> : null}
      <div className="card">
        <table className="tbl">
          <thead>
            <tr>
              <th>Projekt</th>
              <th>Env</th>
              <th>Product Owner</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {projects.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ color: "var(--muted)" }}>
                  Brak projektów.
                </td>
              </tr>
            ) : (
              projects.map((p) => {
                const env = envOf(p.environmentUrls[0]);
                const st = STATUS_PILL[p.status];
                return (
                  <tr key={p.id}>
                    <td>
                      <div className="name">
                        <span className="sq" />
                        <div>
                          <div className="n">{p.name}</div>
                          <div className="k">{p.id}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className={`env-pill ${env.cls}`}>{env.label}</span>
                    </td>
                    <td>
                      <span className="pill-code">{p.productOwnerId}</span>
                    </td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span className={`pill ${st.cls}`}>
                          <span className="dot" />
                          {st.label}
                        </span>
                        <select
                          className="select"
                          aria-label={`Status ${p.name}`}
                          style={{ height: 30, width: 120, fontSize: ".75rem" }}
                          value={p.status}
                          onChange={(e) =>
                            changeStatus(p.id, e.target.value as ProjectStatus)
                          }
                        >
                          <option value="live">live</option>
                          <option value="paused">paused</option>
                          <option value="archived">archived</option>
                        </select>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      <form onSubmit={submit} className="card card-pad" style={{ marginTop: 20, maxWidth: 520 }} noValidate>
        <h2 className="section-title" style={{ marginTop: 0 }}>
          Utwórz projekt
        </h2>
        <Field label="Nazwa projektu" htmlFor="pr-name">
          <input
            id="pr-name"
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </Field>
        <Field label="Product Owner" htmlFor="pr-po">
          <select
            id="pr-po"
            className="select"
            value={poId}
            onChange={(e) => setPoId(e.target.value)}
            required
          >
            <option value="">Wybierz Product Ownera…</option>
            {pos.map((u) => (
              <option key={u.id} value={u.id}>
                {u.displayName} ({u.email})
              </option>
            ))}
          </select>
        </Field>
        <Field
          label="Adresy środowisk"
          htmlFor="pr-urls"
          hint="Po przecinku. To także lista dozwolonych originów CORS dla ingest."
        >
          <input
            id="pr-urls"
            className="input"
            value={urls}
            onChange={(e) => setUrls(e.target.value)}
            placeholder="https://staging.acme.test"
            required
          />
        </Field>
        <Button type="submit" disabled={busy || !poId}>
          {busy ? "Tworzenie…" : "Utwórz projekt"}
        </Button>
      </form>
    </Page>
  );
}

export function Panels() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState("");
  const [panels, setPanels] = useState<Panel[]>([]);
  const [audience, setAudience] = useState("client");
  const [envUrl, setEnvUrl] = useState("");
  const [created, setCreated] = useState<{ secretToken: string; panelUrl: string } | null>(null);
  const [confirmDel, setConfirmDel] = useState<Panel | null>(null);
  const { error, busy, run } = useAsync();

  useEffect(() => {
    void run(async () => setProjects((await api.listProjects()).projects));
  }, []);

  const loadPanels = (pid: string): void => {
    if (!pid) return setPanels([]);
    void run(async () => setPanels((await api.listPanels(pid)).panels));
  };
  const submit = (e: FormEvent): void => {
    e.preventDefault();
    void run(async () => {
      const r = await api.createPanel(projectId, audience, envUrl);
      setCreated({ secretToken: r.secretToken, panelUrl: r.panelUrl });
      setEnvUrl("");
      loadPanels(projectId);
    });
  };
  const toggle = (p: Panel): void =>
    void run(async () => {
      await api.setPanelStatus(p.id, p.status === "open" ? "closed" : "open");
      loadPanels(projectId);
    });
  const remove = (p: Panel): void =>
    void run(async () => {
      await api.deletePanel(p.id);
      loadPanels(projectId);
    });

  return (
    <Page crumbs={["Speqify Internal", "Panele"]}>
      <div className="page-h">
        <div>
          <h1>Panele</h1>
          <p className="sub">Linki capability + snippet instalacyjny SDK</p>
        </div>
      </div>
      {error ? <Alert kind="danger">{error}</Alert> : null}
      <div className="card card-pad" style={{ maxWidth: 520 }}>
        <Field label="Projekt" htmlFor="pn-proj">
          <select
            id="pn-proj"
            className="select"
            value={projectId}
            onChange={(e) => {
              setCreated(null);
              setProjectId(e.target.value);
              loadPanels(e.target.value);
            }}
          >
            <option value="">Wybierz projekt…</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {projectId ? (
        <>
          {created ? (
            <Alert kind="success">
              Token <span className="pill-code">{created.secretToken}</span> · link{" "}
              <span className="pill-code">{created.panelUrl}</span>
            </Alert>
          ) : null}
          <div className="card" style={{ marginTop: 20 }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Audiencja</th>
                  <th>Status</th>
                  <th>Środowisko</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {panels.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ color: "var(--muted)" }}>
                      Brak paneli.
                    </td>
                  </tr>
                ) : (
                  panels.map((p) => (
                    <tr key={p.id}>
                      <td>{p.audience}</td>
                      <td>
                        <span className={`pill ${p.status === "open" ? "live" : "archived"}`}>
                          <span className="dot" />
                          {p.status}
                        </span>
                      </td>
                      <td>{p.environmentUrl}</td>
                      <td>
                        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                          <Button variant="secondary" size="sm" onClick={() => toggle(p)}>
                            {p.status === "open" ? "Zamknij" : "Otwórz"}
                          </Button>
                          <Button
                            variant="danger-ghost"
                            size="sm"
                            onClick={() => setConfirmDel(p)}
                          >
                            Usuń
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {panels[0] ? (
            <>
              <h2 className="section-title">Snippet instalacyjny</h2>
              <pre className="code-block">
                <code>{sdkSnippet(panels[0].secretToken)}</code>
              </pre>
            </>
          ) : null}

          <form
            onSubmit={submit}
            className="card card-pad"
            style={{ marginTop: 20, maxWidth: 520 }}
            noValidate
          >
            <h2 className="section-title" style={{ marginTop: 0 }}>
              Utwórz panel
            </h2>
            <Field label="Audiencja" htmlFor="pn-aud">
              <select
                id="pn-aud"
                className="select"
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
              >
                <option value="client">Klient</option>
                <option value="tester">Tester</option>
                <option value="po">Product Owner</option>
              </select>
            </Field>
            <Field label="Adres środowiska" htmlFor="pn-url">
              <input
                id="pn-url"
                className="input"
                value={envUrl}
                onChange={(e) => setEnvUrl(e.target.value)}
                placeholder="https://staging.acme.test"
                required
              />
            </Field>
            <Button type="submit" disabled={busy}>
              {busy ? "Tworzenie…" : "Utwórz panel"}
            </Button>
          </form>
        </>
      ) : null}
      <ConfirmModal
        open={confirmDel !== null}
        danger
        title="Usunąć panel?"
        description={
          confirmDel
            ? `Link capability ${confirmDel.environmentUrl} zostanie nieodwracalnie odwołany. Recenzenci stracą dostęp natychmiast.`
            : ""
        }
        requireAck="Rozumiem, że tej operacji nie da się cofnąć."
        confirmLabel="Tak, usuń panel"
        onCancel={() => setConfirmDel(null)}
        onConfirm={() => {
          if (confirmDel) remove(confirmDel);
          setConfirmDel(null);
        }}
      />
    </Page>
  );
}

const AI_PROVIDERS = ["claude", "openai", "gemini", "azure", "custom"] as const;
const STT_PROVIDERS = ["workers-ai", "groq", "openai", "azure", "self-hosted"] as const;

export function Providers() {
  const [aiProvider, setAiProvider] = useState("claude");
  const [aiModel, setAiModel] = useState("claude-sonnet-4-6");
  const [aiEndpoint, setAiEndpoint] = useState("");
  const [aiKey, setAiKey] = useState("");
  const [stt, setStt] = useState("workers-ai");
  const [sttEndpoint, setSttEndpoint] = useState("");
  const [hint, setHint] = useState<string | null>(null);
  const [configured, setConfigured] = useState(false);
  const [saved, setSaved] = useState(false);
  const { error, busy, run } = useAsync();

  useEffect(() => {
    void run(async () => {
      const { config } = await api.getProviders();
      if (config) {
        setAiProvider(config.aiProvider);
        setAiModel(config.aiModel);
        setAiEndpoint(config.aiEndpoint ?? "");
        setStt(config.transcriptionProvider);
        setSttEndpoint(config.transcriptionEndpoint ?? "");
        setHint(config.aiKeyHint);
        setConfigured(config.aiKeyConfigured);
      }
    });
  }, []);

  const submit = (e: FormEvent): void => {
    e.preventDefault();
    void run(async () => {
      const { config } = await api.putProviders({
        aiProvider,
        aiModel,
        ...(aiEndpoint.trim() ? { aiEndpoint: aiEndpoint.trim() } : {}),
        ...(aiKey.trim() ? { aiKey: aiKey.trim() } : {}),
        transcriptionProvider: stt,
        ...(sttEndpoint.trim() ? { transcriptionEndpoint: sttEndpoint.trim() } : {}),
      });
      setHint(config.aiKeyHint);
      setConfigured(config.aiKeyConfigured);
      setAiKey("");
      setSaved(true);
    });
  };

  return (
    <Page crumbs={["Speqify Internal", "Dostawcy AI"]}>
      <div className="page-h">
        <div>
          <h1>Dostawcy AI</h1>
          <p className="sub">Platformowa konfiguracja AI / transkrypcji (SA)</p>
        </div>
      </div>
      {error ? <Alert kind="danger">{error}</Alert> : null}
      {saved ? <Alert kind="success">Konfiguracja dostawcy zapisana.</Alert> : null}
      <form onSubmit={submit} className="card card-pad" style={{ maxWidth: 640 }} noValidate>
        <Field label="Dostawca LLM" htmlFor="ai-prov">
          <select
            id="ai-prov"
            className="select"
            value={aiProvider}
            onChange={(e) => setAiProvider(e.target.value)}
          >
            {AI_PROVIDERS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Model" htmlFor="ai-model">
          <input
            id="ai-model"
            className="input"
            value={aiModel}
            onChange={(e) => setAiModel(e.target.value)}
            required
          />
        </Field>
        <Field label="Endpoint (opcjonalny)" htmlFor="ai-ep" hint="AI Gateway / endpoint OpenAI-kompatybilny">
          <input
            id="ai-ep"
            className="input"
            value={aiEndpoint}
            onChange={(e) => setAiEndpoint(e.target.value)}
            placeholder="https://gateway.ai.cloudflare.com/…"
          />
        </Field>
        <Field
          label="Klucz API"
          htmlFor="ai-key"
          hint={
            configured
              ? `Zapisany (•••• ${hint ?? ""}). Pozostaw puste, aby zachować.`
              : "Zapisywany zaszyfrowany; nigdy nie zwracany w jawnej formie."
          }
        >
          <input
            id="ai-key"
            className="input"
            type="password"
            autoComplete="off"
            value={aiKey}
            onChange={(e) => setAiKey(e.target.value)}
            placeholder={configured ? "•••••••• (bez zmian)" : "sk-…"}
          />
        </Field>
        <Field label="Dostawca transkrypcji" htmlFor="stt-prov">
          <select
            id="stt-prov"
            className="select"
            value={stt}
            onChange={(e) => setStt(e.target.value)}
          >
            {STT_PROVIDERS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Endpoint transkrypcji (opcjonalny)" htmlFor="stt-ep">
          <input
            id="stt-ep"
            className="input"
            value={sttEndpoint}
            onChange={(e) => setSttEndpoint(e.target.value)}
          />
        </Field>
        <Button type="submit" disabled={busy}>
          {busy ? "Zapisywanie…" : "Zapisz konfigurację"}
        </Button>
      </form>
      <p className="hint" style={{ maxWidth: 640 }}>
        Pomiar p95 / health dostawców i auto-fallback to zakres Phase 11 (observability).
      </p>
    </Page>
  );
}
