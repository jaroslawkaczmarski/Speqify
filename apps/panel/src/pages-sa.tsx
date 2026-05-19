import { useEffect, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import type {
  AdminStats,
  AuditEntry,
  PlatformProviderConfigView,
  Project,
  ProjectStatus,
  ProjectTemplate,
  ProjectTemplates,
  User,
} from "@speqify/shared";
import { api } from "./api.js";
import {
  Alert,
  Avatar,
  Button,
  ConfirmModal,
  EmptyState,
  Field,
  Page,
  Pill,
  RoleBadge,
  Stat,
  Toggle,
  csvToList,
  useAsync,
} from "./components.js";
import {
  IconCheck,
  IconAlert,
  IconBuilding,
  IconX,
  IconFileText,
  IconPlus,
  IconSearch,
  IconShield,
  IconUsers,
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
                          <polyline fill="none" stroke="#15803D" strokeWidth="1.5" points={SPARK} />
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
                    <div className="d">
                      {providers.transcriptionEndpoint ?? "endpoint domyślny"}
                    </div>
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

function initials(name: string): string {
  const p = name.trim().split(/\s+/);
  return ((p[0]?.[0] ?? "") + (p[1]?.[0] ?? p[0]?.[1] ?? "")).toUpperCase() || "??";
}

/** Admin · Użytkownicy (Admin Users.html). Real listUsers/createUser; SA/PO
 *  counts live. Reviewers = panel role (no per-person identity in V1), 2FA /
 *  activity / invites are representative — flagged in the note. */
export function ProductOwners() {
  const [users, setUsers] = useState<User[]>([]);
  const [q, setQ] = useState("");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [showForm, setShowForm] = useState(false);
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
      setShowForm(false);
      setUsers((await api.listUsers()).users);
    });
  };

  const sa = users.filter((u) => u.role === "superadmin").length;
  const po = users.filter((u) => u.role === "product_owner").length;
  const ql = q.trim().toLowerCase();
  const visible = ql
    ? users.filter(
        (u) => u.displayName.toLowerCase().includes(ql) || u.email.toLowerCase().includes(ql),
      )
    : users;

  return (
    <Page
      crumbs={["Speqify Internal", "Użytkownicy"]}
      actions={
        <Button icon={<IconPlus />} onClick={() => setShowForm((v) => !v)}>
          {showForm ? "Zamknij" : "Zaproś użytkownika"}
        </Button>
      }
    >
      <div className="page-h">
        <div>
          <h1>Użytkownicy</h1>
          <p className="sub">
            {users.length} kont · role SA / PO (Reviewer = rola panelu, bez konta w V1)
          </p>
        </div>
      </div>
      {error ? <Alert kind="danger">{error}</Alert> : null}
      {created ? (
        <Alert kind="success" title="Konto utworzone">
          <b>{created.email}</b> · hasło jednorazowe{" "}
          <span className="pill-code">{created.password}</span> — skopiuj teraz, nie pokażemy
          ponownie.
        </Alert>
      ) : null}

      <div className="role-stats">
        <div className="role-stat">
          <div className="top">
            <span className="label">Wszyscy</span>
            <span className="role-badge">All</span>
          </div>
          <span className="n">{users.length}</span>
          <span className="meta">konta z dostępem do panelu</span>
        </div>
        <div className="role-stat">
          <div className="top">
            <span className="label">Super Admini</span>
            <RoleBadge role="sa" />
          </div>
          <span className="n">{sa}</span>
          <span className="meta">współdzielone konto SA</span>
        </div>
        <div className="role-stat active">
          <div className="top">
            <span className="label">Product Owners</span>
            <RoleBadge role="po" />
          </div>
          <span className="n">{po}</span>
          <span className="meta">tworzeni przez SA</span>
        </div>
        <div className="role-stat">
          <div className="top">
            <span className="label">Recenzenci</span>
            <RoleBadge role="rev" />
          </div>
          <span className="n">—</span>
          <span className="meta">rola panelu — bez kont (V1)</span>
        </div>
      </div>

      <div className="filter-bar">
        <div className="search" style={{ flex: 1, minWidth: 240 }}>
          <IconSearch />
          <input
            placeholder="Szukaj po imieniu lub e-mailu…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <span className="filter-chip" aria-disabled="true">
          Rola: <span className="v">Wszystkie</span>
        </span>
        <span className="filter-chip" aria-disabled="true">
          2FA: <span className="v">Wszystkie</span>
        </span>
      </div>

      {showForm ? (
        <form
          onSubmit={submit}
          className="card card-pad"
          style={{ marginBottom: 20, maxWidth: 520 }}
          noValidate
        >
          <h2 className="section-title" style={{ marginTop: 0 }}>
            Zaproś Product Ownera
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
            {busy ? "Tworzenie…" : "Utwórz konto PO"}
          </Button>
        </form>
      ) : null}

      <div className="card">
        <div className="card-h">
          <div>
            <h2>Wszyscy użytkownicy · {users.length}</h2>
            <p className="sub">2FA / aktywność = dane przykładowe (poza modelem V1)</p>
          </div>
        </div>
        {visible.length === 0 ? (
          <EmptyState
            icon={<IconUsers />}
            title="Brak użytkowników"
            description="Zaproś pierwszego Product Ownera — utworzy mu się konto z hasłem jednorazowym."
            action={
              <Button icon={<IconPlus />} onClick={() => setShowForm(true)}>
                Zaproś użytkownika
              </Button>
            }
          />
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th>Użytkownik</th>
                <th>Rola</th>
                <th>2FA</th>
                <th>Utworzono</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((u) => (
                <tr key={u.id}>
                  <td>
                    <div className="user-cell">
                      <Avatar initials={initials(u.displayName)} />
                      <div className="info">
                        <div className="n">{u.displayName}</div>
                        <div className="e">{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <RoleBadge role={u.role === "superadmin" ? "sa" : "po"} />
                  </td>
                  <td>
                    <span className="twofa off">—</span>
                  </td>
                  <td className="num">{new Date(u.createdAt).toLocaleDateString()}</td>
                  <td>
                    <Pill kind="live">active</Pill>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Page>
  );
}

const AUDIT_KIND_LABEL: Record<string, string> = {
  "user.created": "utworzył konto PO",
  "project.created": "dodał projekt",
  "project.status": "zmienił status projektu",
  "panel.created": "utworzył panel",
  "panel.deleted": "usunął panel",
  "analysis.finished": "uruchomił analizę AI",
  "task.accepted": "zaakceptował zadanie",
  "task.rejected": "odrzucił zadanie",
  "export.completed": "wyeksportował zadania",
  "providers.updated": "zaktualizował dostawcę AI",
  "lead.received": "nowe zgłoszenie do bety",
};

/** Admin · Audyt log (Admin Audit.html). Real GET /admin/audit; stats + CSV
 *  derived from the live feed; SIEM stream is out of scope (flagged). */
export function AdminAudit() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [q, setQ] = useState("");
  const { error, run } = useAsync();

  useEffect(() => {
    void run(async () => setEntries((await api.adminAudit()).entries));
  }, []);

  const ql = q.trim().toLowerCase();
  const visible = ql
    ? entries.filter(
        (e) =>
          e.summary.toLowerCase().includes(ql) ||
          e.actor.toLowerCase().includes(ql) ||
          e.kind.toLowerCase().includes(ql),
      )
    : entries;

  const dayAgo = Date.now() - 86_400_000;
  const last24 = entries.filter((e) => new Date(e.at).getTime() >= dayAgo).length;
  const human = entries.filter((e) => e.actor !== "system" && e.actor !== "landing").length;
  const issues = entries.filter((e) => e.severity !== "ok").length;
  const auto = entries.filter((e) => e.actor === "system").length;

  const exportCsv = (): void => {
    const esc = (s: string): string => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
    const rows = entries.map((e) =>
      [e.at, e.kind, e.severity, e.actor, e.projectId ?? "", e.summary].map(esc).join(","),
    );
    const csv = ["at,kind,severity,actor,projectId,summary", ...rows].join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = "speqify-audit.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <Page crumbs={["Speqify Internal", "Audyt log"]}>
      <div className="page-h">
        <div>
          <h1>Audyt log</h1>
          <p className="sub">Wszystkie zdarzenia w organizacji · dane na żywo</p>
        </div>
        <div className="right">
          <Button variant="secondary" onClick={exportCsv} disabled={entries.length === 0}>
            <IconShield />
            Eksport CSV
          </Button>
          <Button
            variant="secondary"
            disabled
            title="Stream do SIEM — poza zakresem V1 (Phase 11 observability)"
          >
            Stream do SIEM
          </Button>
        </div>
      </div>
      {error ? <Alert kind="danger">{error}</Alert> : null}

      <div className="stats">
        <Stat
          label="Zdarzenia"
          value={entries.length}
          delta={<span className="sp">dane na żywo</span>}
        />
        <Stat
          label="Ostatnie 24h"
          value={last24}
          delta={<span className="sp">dane na żywo</span>}
        />
        <Stat
          label="Akcje ludzi"
          value={human}
          delta={<span className="sp">vs. {auto} auto</span>}
        />
        <Stat
          label="Błędy & warningi"
          value={issues}
          deltaNeg={issues > 0}
          delta={<span className="sp">{issues > 0 ? "wymaga uwagi" : "czysto"}</span>}
        />
        <Stat label="Auto-akcje" value={auto} delta={<span className="sp">system</span>} />
      </div>

      <div className="filter-bar">
        <div className="search" style={{ flex: 1, minWidth: 240 }}>
          <IconSearch />
          <input
            placeholder="Szukaj po akcji, aktorze, typie…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <span className="filter-chip" aria-disabled="true">
          Zakres: <span className="v">Wszystko</span>
        </span>
      </div>

      <div className="card" style={{ overflow: "hidden" }}>
        {visible.length === 0 ? (
          <EmptyState
            icon={<IconFileText />}
            title="Brak zdarzeń"
            description="Audyt zapełni się po pierwszych akcjach w panelu (tworzenie projektu, analiza, eksport…)."
            action={null}
          />
        ) : (
          <>
            <table className="tbl">
              <thead>
                <tr>
                  <th style={{ width: 56 }} />
                  <th>Aktor</th>
                  <th>Akcja</th>
                  <th>Target</th>
                  <th>Kiedy</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((e) => (
                  <tr key={e.id}>
                    <td>
                      <span className={`audit-ic ${e.severity}`}>
                        {e.severity === "ok" ? (
                          <IconCheck />
                        ) : e.severity === "warn" ? (
                          <IconAlert />
                        ) : (
                          <IconX />
                        )}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontWeight: 500 }}>{e.actor}</div>
                      <div className="mono" style={{ fontSize: ".6875rem", color: "var(--muted)" }}>
                        {e.kind}
                      </div>
                    </td>
                    <td>{e.summary}</td>
                    <td className="mono" style={{ fontSize: ".75rem", color: "var(--secondary)" }}>
                      {e.projectId ?? AUDIT_KIND_LABEL[e.kind] ?? "—"}
                    </td>
                    <td style={{ fontSize: ".75rem", color: "var(--muted)" }}>{ago(e.at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div
              style={{
                padding: "12px 18px",
                display: "flex",
                justifyContent: "space-between",
                fontSize: ".8125rem",
                color: "var(--muted)",
                borderTop: "1px solid var(--border)",
              }}
            >
              <span>
                Pokazano {visible.length} z {entries.length} zdarzeń
              </span>
              <span>retencja: in-memory (dev) · trwała = Phase 11</span>
            </div>
          </>
        )}
      </div>
    </Page>
  );
}

export function Projects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const { error, run } = useAsync();

  const load = (): void => void run(async () => setProjects((await api.listProjects()).projects));
  useEffect(() => load(), []);

  const changeStatus = (id: string, status: ProjectStatus): void =>
    void run(async () => {
      await api.setProjectStatus(id, status);
      setProjects((await api.listProjects()).projects);
    });

  return (
    <Page
      crumbs={["Speqify Internal", "Projekty"]}
      actions={
        <a className="btn btn-primary" href="#/projects/new">
          <IconPlus />
          Nowy projekt
        </a>
      }
    >
      <div className="page-h">
        <div>
          <h1>Projekty</h1>
          <p className="sub">{projects.length} projektów · kliknij, aby otworzyć szczegóły</p>
        </div>
      </div>
      {error ? <Alert kind="danger">{error}</Alert> : null}
      <div className="card">
        {projects.length === 0 ? (
          <EmptyState
            icon={<IconBuilding />}
            title="Brak projektów"
            description="Utwórz pierwszy projekt — SA przypisuje Product Ownera i adresy środowisk."
            action={
              <a className="btn btn-primary" href="#/projects/new">
                <IconPlus />
                Nowy projekt
              </a>
            }
          />
        ) : (
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
              {projects.map((p) => {
                const env = envOf(p.environmentUrls[0]);
                const st = STATUS_PILL[p.status];
                return (
                  <tr key={p.id}>
                    <td>
                      <a href={`#/projects/${p.id}`} className="name" style={{ color: "inherit" }}>
                        <span className="sq" />
                        <div>
                          <div className="n">{p.name}</div>
                          <div className="k">{p.id}</div>
                        </div>
                      </a>
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
                          onChange={(e) => changeStatus(p.id, e.target.value as ProjectStatus)}
                        >
                          <option value="live">live</option>
                          <option value="paused">paused</option>
                          <option value="archived">archived</option>
                        </select>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </Page>
  );
}

const WIZARD_STEPS = ["Podstawy projektu", "Szablon & AI", "Zespół & finalizacja"];

/** Admin · Nowy projekt (Admin Create Project.html) — 3-step wizard.
 *  Real createProject(name, PO, env URLs, template). AI routing / integrations
 *  shown as design-faithful preview (configured by PO later — flagged). */
export function CreateProject() {
  const [users, setUsers] = useState<User[]>([]);
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [poId, setPoId] = useState("");
  const [urls, setUrls] = useState("");
  const [lang, setLang] = useState<"pl" | "en">("pl");
  const [userStory, setUserStory] = useState(true);
  const [acc, setAcc] = useState(true);
  const [labels, setLabels] = useState("");
  const { error, busy, run } = useAsync();

  useEffect(() => {
    void run(async () => setUsers((await api.listUsers()).users));
  }, []);
  const pos = users.filter((u) => u.role === "product_owner");
  const step1ok = name.trim() && poId && csvToList(urls).length > 0;

  const finish = (): void =>
    void run(async () => {
      const single: ProjectTemplate = {
        language: lang,
        userStory,
        acceptanceCriteria: acc,
        labels: csvToList(labels),
        components: [],
        versions: [],
        customFields: {},
      };
      // SA seeds all four task-type templates with the same base; PO refines
      // per-tab afterwards.
      const templates: ProjectTemplates = {
        bug: single,
        change: single,
        feature: single,
        polish: single,
      };
      const created = await api.createProject(name.trim(), poId, csvToList(urls), templates);
      window.location.hash = `/projects/${created.id}`;
    });

  return (
    <Page crumbs={["Speqify Internal", "Projekty", "Nowy projekt"]}>
      <div className="page-h">
        <div>
          <h1>Nowy projekt</h1>
          <p className="sub">
            Krok {step + 1}/3 · {WIZARD_STEPS[step]}
          </p>
        </div>
        <a className="btn btn-ghost" href="#/projects">
          Anuluj
        </a>
      </div>
      {error ? <Alert kind="danger">{error}</Alert> : null}

      <div className="role-stats" style={{ gridTemplateColumns: "repeat(3,1fr)" }}>
        {WIZARD_STEPS.map((s, i) => (
          <div key={s} className={`role-stat${i === step ? " active" : ""}`}>
            <div className="top">
              <span className="label">Krok {i + 1}</span>
              {i < step ? <RoleBadge role="po" /> : null}
            </div>
            <span style={{ fontWeight: 600 }}>{s}</span>
          </div>
        ))}
      </div>

      <div className="grid-2">
        <div className="card card-pad">
          {step === 0 ? (
            <>
              <h2 className="section-title" style={{ marginTop: 0 }}>
                Podstawy projektu
              </h2>
              <Field label="Nazwa projektu" htmlFor="w-name">
                <input
                  id="w-name"
                  className="input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Lumen Lab — Q1 Review"
                  required
                />
              </Field>
              <Field label="Product Owner" htmlFor="w-po">
                <select
                  id="w-po"
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
                htmlFor="w-urls"
                hint="Po przecinku. To także lista dozwolonych originów CORS dla ingest."
              >
                <input
                  id="w-urls"
                  className="input"
                  value={urls}
                  onChange={(e) => setUrls(e.target.value)}
                  placeholder="https://staging.acme.test, https://app.acme.test"
                  required
                />
              </Field>
            </>
          ) : step === 1 ? (
            <>
              <h2 className="section-title" style={{ marginTop: 0 }}>
                Szablon zadań
              </h2>
              <Field label="Język wyjściowy zadań" htmlFor="w-lang">
                <select
                  id="w-lang"
                  className="select"
                  value={lang}
                  onChange={(e) => setLang(e.target.value === "en" ? "en" : "pl")}
                >
                  <option value="pl">Polski</option>
                  <option value="en">English</option>
                </select>
              </Field>
              <div className="field" style={{ display: "flex", gap: 32 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <Toggle on={userStory} onChange={setUserStory} label="Format user story" />
                  <span style={{ fontSize: ".875rem" }}>Format user story</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <Toggle on={acc} onChange={setAcc} label="Kryteria akceptacji" />
                  <span style={{ fontSize: ".875rem" }}>Kryteria akceptacji</span>
                </div>
              </div>
              <Field label="Etykiety" htmlFor="w-labels" hint="Dozwolone słownictwo, po przecinku">
                <input
                  id="w-labels"
                  className="input"
                  value={labels}
                  onChange={(e) => setLabels(e.target.value)}
                  placeholder="frontend, backend, eksport"
                />
              </Field>
              <Alert kind="info">
                Routing AI / integracje (Jira/GitHub) konfiguruje PO po utworzeniu projektu — poza
                tym kreatorem.
              </Alert>
            </>
          ) : (
            <>
              <h2 className="section-title" style={{ marginTop: 0 }}>
                Zespół & finalizacja
              </h2>
              <p style={{ color: "var(--secondary)", marginTop: 0 }}>
                Po utworzeniu projektu dodasz panele (linki recenzentów) w zakładce „Recenzenci”, a
                PO skonfiguruje szablon i eksport.
              </p>
              <div
                style={{
                  marginTop: 12,
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                  fontSize: ".875rem",
                  color: "var(--secondary)",
                }}
              >
                <div>
                  <b>Nazwa:</b> {name || "—"}
                </div>
                <div>
                  <b>PO:</b> {pos.find((u) => u.id === poId)?.displayName ?? "—"}
                </div>
                <div>
                  <b>Środowiska:</b> {csvToList(urls).join(", ") || "—"}
                </div>
                <div>
                  <b>Szablon:</b> {lang.toUpperCase()} · {userStory ? "user-story" : "prosty"} ·{" "}
                  {acc ? "z AC" : "bez AC"}
                </div>
              </div>
            </>
          )}

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginTop: 20,
              gap: 8,
            }}
          >
            <Button
              variant="ghost"
              disabled={step === 0 || busy}
              onClick={() => setStep((s) => Math.max(0, s - 1))}
            >
              ← Wstecz
            </Button>
            {step < 2 ? (
              <Button
                disabled={(step === 0 && !step1ok) || busy}
                onClick={() => setStep((s) => s + 1)}
              >
                Dalej →
              </Button>
            ) : (
              <Button disabled={busy || !step1ok} onClick={finish}>
                {busy ? "Tworzenie…" : "Utwórz projekt"}
              </Button>
            )}
          </div>
        </div>

        <div className="col">
          <div className="card">
            <div className="card-h">
              <div>
                <h2>Podsumowanie</h2>
                <p className="sub">na żywo z kreatora</p>
              </div>
            </div>
            <div
              className="card-pad"
              style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: ".8125rem" }}
            >
              {[
                ["Nazwa", name || "—"],
                ["PO", pos.find((u) => u.id === poId)?.email ?? "—"],
                ["Env", `${csvToList(urls).length} adresów`],
                ["Szablon", lang.toUpperCase()],
              ].map(([k, v]) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                  <span style={{ color: "var(--muted)" }}>{k}</span>
                  <span style={{ color: "var(--primary)", fontWeight: 500 }}>{v}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="card card-pad">
            <h2 className="section-title" style={{ marginTop: 0 }}>
              Co dalej
            </h2>
            <ul
              style={{ margin: 0, paddingLeft: 18, color: "var(--secondary)", fontSize: ".875rem" }}
            >
              <li>Utwórz panele recenzentów (tokeny capability)</li>
              <li>PO konfiguruje szablon zadań i eksport (Jira/GitHub)</li>
              <li>Wklej snippet SDK w aplikacji środowiska</li>
            </ul>
          </div>
        </div>
      </div>
    </Page>
  );
}

const PROJECT_TABS = [
  "Przegląd",
  "Sesje review",
  "Integracje",
  "Webhooki",
  "Strefa niebezpieczna",
] as const;

/** Admin · Projekt detail. The old Install-SDK + Reviewers (capability-token
 *  Panel) tabs are gone — the SDK is now installed generically by the PO and
 *  identity comes from the per-reviewer ?speqify_session/?speqify_reviewer URL
 *  pair. Per-session lifecycle lives under the PO "Sesje review" surface
 *  (RS-7 follow-up wires a deep-link from here). */
export function AdminProject(props: { id: string }) {
  const [project, setProject] = useState<Project | null>(null);
  const [owner, setOwner] = useState<User | null>(null);
  const [tab, setTab] = useState(0);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const { error, run } = useAsync();

  const load = (): void =>
    void run(async () => {
      const [{ projects }, { users }] = await Promise.all([api.listProjects(), api.listUsers()]);
      const p = projects.find((x) => x.id === props.id) ?? null;
      setProject(p);
      setOwner(users.find((u) => u.id === p?.productOwnerId) ?? null);
    });
  useEffect(() => load(), [props.id]);

  if (!project)
    return (
      <Page crumbs={["Speqify Internal", "Projekty", props.id]}>
        <div className="card card-pad" style={{ color: "var(--muted)" }}>
          {error ? <Alert kind="danger">{error}</Alert> : "Ładowanie projektu…"}
        </div>
      </Page>
    );

  const env = envOf(project.environmentUrls[0]);
  const st = STATUS_PILL[project.status];
  const bug = project.templates.bug;
  const archive = (): void =>
    void run(async () => {
      await api.setProjectStatus(project.id, "archived");
      setConfirmArchive(false);
      load();
    });

  return (
    <Page crumbs={["Speqify Internal", "Projekty", project.name]}>
      <div className="page-h">
        <div>
          <h1 style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {project.name}
            <span className={`env-pill ${env.cls}`}>{env.label}</span>
            <span className={`pill ${st.cls}`}>
              <span className="dot" />
              {st.label}
            </span>
          </h1>
          <p className="sub">
            <span className="mono">{project.id}</span> · Owner:{" "}
            {owner ? `${owner.displayName} (PO)` : "—"} · utworzono{" "}
            {new Date(project.createdAt).toLocaleDateString()}
          </p>
        </div>
        <a className="btn btn-ghost" href="#/projects">
          ← Wszystkie projekty
        </a>
      </div>
      {error ? <Alert kind="danger">{error}</Alert> : null}

      <nav className="filter-bar" aria-label="Sekcje projektu" style={{ gap: 4 }}>
        {PROJECT_TABS.map((t, i) => (
          <button
            key={t}
            className={`state-tab${i === tab ? " active" : ""}`}
            onClick={() => setTab(i)}
            style={i === 4 ? { color: i === tab ? undefined : "var(--danger)" } : undefined}
          >
            {t}
          </button>
        ))}
      </nav>

      {tab === 0 ? (
        <div className="grid-2">
          <div className="card card-pad">
            <h2 className="section-title" style={{ marginTop: 0 }}>
              Adresy środowisk
            </h2>
            <ul style={{ margin: "0 0 16px", paddingLeft: 18 }}>
              {project.environmentUrls.map((u) => (
                <li key={u} className="mono" style={{ fontSize: ".8125rem", padding: "2px 0" }}>
                  {u}
                </li>
              ))}
            </ul>
            <h2 className="section-title">Szablon zadań (bug)</h2>
            <p style={{ color: "var(--secondary)", margin: 0 }}>
              Język <b>{bug.language.toUpperCase()}</b> ·{" "}
              {bug.userStory ? "user-story" : "prosty"} ·{" "}
              {bug.acceptanceCriteria ? "z AC" : "bez AC"} · etykiety:{" "}
              {bug.labels.join(", ") || "—"}
            </p>
            <p className="hint">PO konfiguruje pełne 4 szablony (bug/change/feature/polish).</p>
          </div>
          <div className="col">
            <div className="card card-pad">
              <h2 className="section-title" style={{ marginTop: 0 }}>
                SDK
              </h2>
              <p style={{ color: "var(--secondary)", margin: 0 }}>
                SDK loader instaluje się raz, niezależnie od projektu. UI aktywuje się dopiero gdy
                URL niesie parę tokenów <span className="mono">?speqify_session</span> +{" "}
                <span className="mono">?speqify_reviewer</span> — generowaną przez sesje review.
              </p>
            </div>
          </div>
        </div>
      ) : tab === 1 ? (
        <div className="card card-pad">
          <Alert kind="info">
            Sesje review tworzy i zarządza PO w zakładce „Sesje review”. SA widzi je tutaj tylko
            podglądowo — pełna obsługa (utwórz / opublikuj / zaproś / odwołaj) w panelu PO.
          </Alert>
          <p className="hint">RS-7 follow-up doda tutaj listę sesji projektu + deep-link.</p>
        </div>
      ) : tab === 4 ? (
        <div className="card card-pad" style={{ maxWidth: 640 }}>
          <h2 className="section-title" style={{ marginTop: 0, color: "var(--danger)" }}>
            Strefa niebezpieczna
          </h2>
          <p style={{ color: "var(--secondary)" }}>
            Archiwizacja zatrzymuje zgłoszenia i ukrywa projekt z aktywnej listy. Trwałe usunięcie
            projektu wraz z adnotacjami nie jest dostępne w V1.
          </p>
          <Button
            variant="danger-ghost"
            disabled={project.status === "archived"}
            onClick={() => setConfirmArchive(true)}
          >
            {project.status === "archived" ? "Już zarchiwizowany" : "Zarchiwizuj projekt"}
          </Button>
          <ConfirmModal
            open={confirmArchive}
            danger
            title="Zarchiwizować projekt?"
            description={`„${project.name}” zniknie z aktywnej listy, a otwarte sesje review przestaną przyjmować zgłoszenia. Można przywrócić zmieniając status.`}
            requireAck="Rozumiem skutki archiwizacji."
            confirmLabel="Tak, zarchiwizuj"
            onCancel={() => setConfirmArchive(false)}
            onConfirm={archive}
          />
        </div>
      ) : (
        <div className="card card-pad">
          <Alert kind="info">
            {tab === 2
              ? "Integracje (Jira / GitHub) konfiguruje Product Owner w sekcji „Eksport & integracje”."
              : "Webhooki nie są jeszcze wdrożone (Phase 11)."}
          </Alert>
          <p className="hint">Ten widok jest częścią designu — backend poza bieżącą fazą.</p>
        </div>
      )}
    </Page>
  );
}

/** SA · "Sesje review" — the old capability-token Panel page is gone.
 *  Sessions now belong to the PO surface (apps/panel pages-po: PoSessions /
 *  PoSessionDetail / PoNewSession / PoReviewers). This page lists active
 *  sessions across all projects for SA visibility; full CRUD lives under PO. */
export function Panels() {
  const [projects, setProjects] = useState<Project[]>([]);
  const { error, run } = useAsync();

  useEffect(() => {
    void run(async () => setProjects((await api.listProjects()).projects));
  }, []);

  return (
    <Page crumbs={["Speqify Internal", "Sesje review"]}>
      <div className="page-h">
        <div>
          <h1>Sesje review</h1>
          <p className="sub">Aktywne sesje review na wszystkich projektach</p>
        </div>
      </div>
      {error ? <Alert kind="danger">{error}</Alert> : null}
      <div className="card card-pad">
        <Alert kind="info">
          Tworzenie i zarządzanie sesjami review (zaproszenia recenzentów, publikacja, zamknięcie)
          odbywa się w panelu Product Ownera, w zakładce „Sesje review”. SA widzi sesje tutaj
          tylko podglądowo.
        </Alert>
        <p className="hint" style={{ marginTop: 12 }}>
          Projektów w workspace: <strong>{projects.length}</strong>. RS-7 follow-up doda tu
          tabelę sesji z linkiem do widoku projektu.
        </p>
      </div>
    </Page>
  );
}

const AI_PROVIDERS = ["claude", "openai", "openrouter", "gemini", "azure", "custom"] as const;
/** OpenAI-compatible endpoint + sensible default model per provider preset. */
const AI_PRESETS: Record<string, { endpoint: string; model: string }> = {
  openrouter: {
    endpoint: "https://openrouter.ai/api/v1/chat/completions",
    model: "anthropic/claude-haiku-4.5",
  },
  openai: {
    endpoint: "https://api.openai.com/v1/chat/completions",
    model: "gpt-4o-mini",
  },
};
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
            onChange={(e) => {
              const next = e.target.value;
              setAiProvider(next);
              // Soft preset: only fill empties; never clobber user input.
              const preset = AI_PRESETS[next];
              if (preset) {
                if (!aiEndpoint.trim()) setAiEndpoint(preset.endpoint);
                if (!aiModel.trim() || aiModel === "claude-sonnet-4-6") setAiModel(preset.model);
              }
            }}
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
        <Field
          label="Endpoint (opcjonalny)"
          htmlFor="ai-ep"
          hint="AI Gateway / endpoint OpenAI-kompatybilny"
        >
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

/** Shared honesty banner for governance screens with no V1 backend. */
function RepNote({ children }: { children: ReactNode }) {
  return (
    <Alert kind="warning" title="Widok poglądowy">
      {children} Dane i akcje są reprezentatywne — backend tej sekcji jest poza zakresem V1 (Phase
      11). Liczby oznaczone „na żywo” pochodzą z realnego API.
    </Alert>
  );
}

/** Admin · Rozliczenia & limity (Admin Billing.html). Usage stats are live
 *  from /admin/stats; plan / invoices / payment are representative. */
export function AdminBilling() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const { error, run } = useAsync();
  useEffect(() => {
    void run(async () => setStats(await api.adminStats()));
  }, []);

  return (
    <Page
      crumbs={["Speqify Internal", "Rozliczenia & limity"]}
      actions={
        <>
          <Button variant="secondary" disabled title="Faktury — poza V1 (Phase 11)">
            Pobierz faktury
          </Button>
          <Button disabled title="Zmiana planu — poza V1 (Phase 11)">
            Zmień plan
          </Button>
        </>
      }
    >
      <div className="page-h">
        <div>
          <h1>Rozliczenia & limity</h1>
          <p className="sub">Plan Team · limity organizacji · koszty AI</p>
        </div>
      </div>
      {error ? <Alert kind="danger">{error}</Alert> : null}
      <RepNote>Plan, faktury i metoda płatności to makieta.</RepNote>

      <div
        className="card card-pad"
        style={{
          background: "var(--primary)",
          color: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div>
          <span
            style={{
              fontSize: ".6875rem",
              fontWeight: 700,
              letterSpacing: ".08em",
              textTransform: "uppercase",
              color: "#93C5FD",
              background: "rgba(29,78,216,.2)",
              padding: "4px 10px",
              borderRadius: 999,
            }}
          >
            Aktualny plan
          </span>
          <div style={{ fontSize: "1.5rem", fontWeight: 700, marginTop: 8 }}>Team</div>
          <div style={{ color: "rgba(255,255,255,.7)", fontSize: ".875rem" }}>
            € 0 / mies. · beta zamknięta · rozliczenia włączą się przy GA
          </div>
        </div>
        <Button variant="secondary" disabled>
          Upgrade do Enterprise
        </Button>
      </div>

      <div className="stats" style={{ marginTop: 20 }}>
        <Stat
          label="Projekty"
          value={stats?.projects ?? "—"}
          delta={<span className="sp">na żywo</span>}
        />
        <Stat
          label="Product Owners"
          value={stats?.productOwners ?? "—"}
          delta={<span className="sp">na żywo</span>}
        />
        <Stat
          label="Adnotacje"
          value={stats?.annotations ?? "—"}
          delta={<span className="sp">na żywo</span>}
        />
        <Stat
          label="Koszt AI · maj"
          value="€ 248,40"
          deltaNeg
          delta={<span className="sp">dane przykładowe</span>}
        />
        <Stat
          label="Sesje aktywne"
          value="14"
          delta={<span className="sp">dane przykładowe</span>}
        />
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-h">
            <div>
              <h2>Faktury</h2>
              <p className="sub">historia rozliczeń · dane przykładowe</p>
            </div>
          </div>
          <table className="tbl">
            <thead>
              <tr>
                <th>Okres</th>
                <th>Kwota</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["Kwiecień 2026", "€ 0,00", "beta"],
                ["Marzec 2026", "€ 0,00", "beta"],
                ["Luty 2026", "€ 0,00", "beta"],
              ].map(([p, a, s]) => (
                <tr key={p}>
                  <td>{p}</td>
                  <td className="num">{a}</td>
                  <td>
                    <Pill kind="info">{s}</Pill>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card card-pad">
          <h2 className="section-title" style={{ marginTop: 0 }}>
            Metoda płatności
          </h2>
          <p style={{ color: "var(--secondary)" }}>
            Brak metody płatności — rozliczenia nieaktywne w becie zamkniętej.
          </p>
          <Button variant="secondary" disabled>
            Dodaj kartę
          </Button>
        </div>
      </div>
    </Page>
  );
}

/** Admin · Prywatność & RODO (Admin Privacy.html). EU-hosting + audit
 *  retention are real facts; erasure requests / consents are representative. */
export function AdminPrivacy() {
  return (
    <Page
      crumbs={["Speqify Internal", "Prywatność & RODO"]}
      actions={
        <>
          <Button variant="secondary" disabled title="DPA — poza V1">
            DPA · pobierz
          </Button>
          <Button disabled title="Raport zgodności — poza V1">
            Wystaw raport
          </Button>
        </>
      }
    >
      <div className="page-h">
        <div>
          <h1>Prywatność & RODO</h1>
          <p className="sub">Retencja danych · żądania usunięcia · zgody · DPO</p>
        </div>
      </div>
      <RepNote>Żądania usunięcia, zgody i polityki retencji to makieta.</RepNote>

      <div className="stats">
        <Stat
          label="Aktywne zgody"
          value="28"
          delta={<span className="sp">dane przykładowe</span>}
        />
        <Stat
          label="Żądania usunięcia"
          value="3"
          deltaNeg
          delta={<span className="sp">1 wymaga akcji</span>}
        />
        <Stat
          label="Eksporty danych"
          value="7"
          delta={<span className="sp">dane przykładowe</span>}
        />
        <Stat label="Auto-usunięte" value="218" delta={<span className="sp">retencja 90d</span>} />
        <Stat
          label="Hosting"
          value="EU"
          delta={<span className="sp">eu-warsaw-01 · realne</span>}
        />
      </div>

      <div className="card">
        <div className="card-h">
          <div>
            <h2>Żądania usunięcia danych</h2>
            <p className="sub">Art. 17 RODO · prawo do bycia zapomnianym · dane przykładowe</p>
          </div>
        </div>
        <table className="tbl">
          <thead>
            <tr>
              <th>Podmiot</th>
              <th>Zakres</th>
              <th>Termin</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {[
              {
                e: "k.nowak@old-firma.com",
                z: "Pełne usunięcie konta + treści",
                t: "do 16.06.2026",
                s: "warn",
                l: "w toku",
              },
              {
                e: "r.kowalski@external.com",
                z: "Anonimizacja transkrypcji",
                t: "do 11.06.2026",
                s: "info",
                l: "zaakceptowane",
              },
              {
                e: "m.lewandowska@partner.io",
                z: "Tylko nagrania audio",
                t: "ukończono 09.05",
                s: "live",
                l: "ukończone",
              },
            ].map((r) => (
              <tr key={r.e}>
                <td className="mono" style={{ fontSize: ".8125rem" }}>
                  {r.e}
                </td>
                <td style={{ fontSize: ".8125rem", color: "var(--secondary)" }}>{r.z}</td>
                <td style={{ fontSize: ".8125rem" }}>{r.t}</td>
                <td>
                  <Pill kind={r.s as "warn" | "info" | "live"}>{r.l}</Pill>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid-2" style={{ marginTop: 20 }}>
        <div className="card card-pad">
          <h2 className="section-title" style={{ marginTop: 0 }}>
            Polityka retencji
          </h2>
          <ul
            style={{ margin: 0, paddingLeft: 18, color: "var(--secondary)", fontSize: ".875rem" }}
          >
            <li>Audio / nagrania: 90 dni (dane przykładowe)</li>
            <li>Zrzuty ekranu: 180 dni (dane przykładowe)</li>
            <li>Adnotacje tekstowe: do usunięcia projektu</li>
            <li>Audit log: in-memory (dev) · trwały = Phase 11</li>
          </ul>
        </div>
        <div className="card card-pad">
          <h2 className="section-title" style={{ marginTop: 0 }}>
            Inspektor (DPO) & bezpieczeństwo
          </h2>
          <p style={{ color: "var(--secondary)", fontSize: ".875rem", margin: 0 }}>
            Kontakt DPO: <span className="mono">dpo@speqify.io</span> · Hosting i przetwarzanie LLM
            w UE · TLS 1.3 · sekrety envelope-encrypted (realne). SOC 2 — w toku (reprezentatywne).
          </p>
        </div>
      </div>
    </Page>
  );
}

const SETTINGS_TABS = [
  "Profil organizacji",
  "SSO & uwierzytelnianie",
  "API",
  "Strefa niebezpieczna",
];

/** Admin · Ustawienia organizacji (Admin Settings.html). All sections are
 *  representative — org profile / SSO / API tokens have no V1 backend. */
export function AdminSettings() {
  const [tab, setTab] = useState(0);
  const [forceSso, setForceSso] = useState(true);
  const [scim, setScim] = useState(false);

  return (
    <Page crumbs={["Speqify Internal", "Ustawienia organizacji"]}>
      <div className="page-h">
        <div>
          <h1>Ustawienia organizacji</h1>
          <p className="sub">Dane firmy · SSO · API · strefa niebezpieczna</p>
        </div>
      </div>
      <RepNote>Profil, SSO i API tokens to makieta.</RepNote>

      <nav className="filter-bar" aria-label="Sekcje ustawień" style={{ gap: 4 }}>
        {SETTINGS_TABS.map((t, i) => (
          <button
            key={t}
            className={`state-tab${i === tab ? " active" : ""}`}
            onClick={() => setTab(i)}
            style={i === 3 ? { color: i === tab ? undefined : "var(--danger)" } : undefined}
          >
            {t}
          </button>
        ))}
      </nav>

      {tab === 0 ? (
        <div className="card card-pad" style={{ maxWidth: 640 }}>
          <h2 className="section-title" style={{ marginTop: 0 }}>
            Profil organizacji
          </h2>
          <Field label="Nazwa organizacji" htmlFor="o-name">
            <input id="o-name" className="input" defaultValue="Speqify Internal" disabled />
          </Field>
          <Field label="Strefa czasowa" htmlFor="o-tz">
            <select id="o-tz" className="select" disabled defaultValue="warsaw">
              <option value="warsaw">Europe/Warsaw · CET (+01:00)</option>
              <option value="london">Europe/London · GMT (+00:00)</option>
            </select>
          </Field>
          <Button disabled>Zapisz zmiany</Button>
        </div>
      ) : tab === 1 ? (
        <div className="card">
          <div className="card-h">
            <div>
              <h2>Single Sign-On</h2>
              <p className="sub">SAML 2.0 / OIDC · wymuszanie domeny — reprezentatywne</p>
            </div>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "14px 22px",
              borderBottom: "1px solid var(--border)",
            }}
          >
            <div>
              <div style={{ fontWeight: 500, fontSize: ".875rem" }}>
                Wymuszaj SSO dla domeny @speqify.io
              </div>
              <div style={{ fontSize: ".75rem", color: "var(--muted)" }}>
                Firmowe e-maile logują się wyłącznie przez SSO.
              </div>
            </div>
            <Toggle on={forceSso} onChange={setForceSso} label="Wymuszaj SSO" />
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "14px 22px",
            }}
          >
            <div>
              <div style={{ fontWeight: 500, fontSize: ".875rem" }}>SCIM provisioning</div>
              <div style={{ fontSize: ".75rem", color: "var(--muted)" }}>
                Synchronizacja użytkowników z IdP (Okta).
              </div>
            </div>
            <Toggle on={scim} onChange={setScim} label="SCIM" />
          </div>
        </div>
      ) : tab === 2 ? (
        <div className="card">
          <div className="card-h">
            <div>
              <h2>API tokens</h2>
              <p className="sub">prywatne klucze server-to-server · dane przykładowe</p>
            </div>
            <Button variant="ghost" size="sm" disabled>
              + Wygeneruj
            </Button>
          </div>
          <table className="tbl">
            <thead>
              <tr>
                <th>Nazwa</th>
                <th>Klucz</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>ci-export</td>
                <td className="mono" style={{ fontSize: ".75rem" }}>
                  sk_live_••••4f2a
                </td>
                <td>
                  <Pill kind="live">aktywny</Pill>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      ) : (
        <div className="card card-pad" style={{ maxWidth: 640 }}>
          <h2 className="section-title" style={{ marginTop: 0, color: "var(--danger)" }}>
            Strefa niebezpieczna
          </h2>
          <p style={{ color: "var(--secondary)" }}>
            Usunięcie organizacji wraz ze wszystkimi projektami nie jest dostępne w V1 — skontaktuj
            się z administratorem platformy.
          </p>
          <Button variant="danger-ghost" disabled title="Usunięcie organizacji — poza V1">
            Usuń organizację
          </Button>
        </div>
      )}
    </Page>
  );
}
