import { useEffect, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { api, auth } from "./api.js";
import { navigate, useHashRoute } from "./router.js";
import {
  Alert,
  Avatar,
  Button,
  Field,
  Placeholder,
  ToastProvider,
  useAsync,
} from "./components.js";
import {
  AdminAudit,
  AdminBilling,
  AdminPrivacy,
  AdminProject,
  AdminSettings,
  CreateProject,
  Dashboard,
  Panels,
  ProductOwners,
  Projects,
  Providers,
} from "./pages-sa.js";
import { PoExport, PoOverview, PoTasks, PoTemplate } from "./pages-po.js";
import {
  IconBook,
  IconBuilding,
  IconChevronDown,
  IconCpu,
  IconDollar,
  IconFileText,
  IconGrid,
  IconLink,
  IconLogo,
  IconMessage,
  IconCheckSquare,
  IconClock,
  IconShield,
  IconUpload,
  IconUsers,
  type IconCmp,
} from "./icons.js";

type Nav = { path: string; label: string; icon: IconCmp; ct?: string; hot?: boolean };

const SA_NAV: { group: string; items: Nav[] }[] = [
  {
    group: "Operacje",
    items: [
      { path: "/", label: "Pulpit", icon: IconGrid },
      { path: "/projects", label: "Projekty", icon: IconBuilding, ct: "·" },
      { path: "/po-users", label: "Użytkownicy", icon: IconUsers },
      { path: "/panels", label: "Panele", icon: IconLink },
      { path: "/providers", label: "Dostawcy AI", icon: IconCpu, ct: "3", hot: false },
    ],
  },
  {
    group: "Zarządzanie",
    items: [
      { path: "/billing", label: "Rozliczenia & limity", icon: IconDollar },
      { path: "/audit", label: "Audyt log", icon: IconFileText },
      { path: "/privacy", label: "Prywatność & RODO", icon: IconShield },
      { path: "/settings", label: "Ustawienia organizacji", icon: IconCpu },
    ],
  },
];

const PO_NAV: { group: string; items: Nav[] }[] = [
  {
    group: "Praca",
    items: [
      { path: "/", label: "Pulpit", icon: IconGrid },
      { path: "/sessions", label: "Sesje review", icon: IconClock },
      { path: "/annotations", label: "Adnotacje", icon: IconMessage },
      { path: "/tasks", label: "Zadania", icon: IconCheckSquare, hot: true },
    ],
  },
  {
    group: "Konfiguracja",
    items: [
      { path: "/template", label: "Szablon zadań", icon: IconFileText },
      { path: "/export", label: "Eksport & integracje", icon: IconUpload },
      { path: "/reviewers", label: "Recenzenci", icon: IconUsers },
      { path: "/po-privacy", label: "Prywatność", icon: IconShield },
    ],
  },
];

const SSO = [
  {
    name: "Google",
    svg: (
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <path
          fill="#FFC107"
          d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4C12.95 4 4 12.95 4 24s8.95 20 20 20s20-8.95 20-20c0-1.3-.1-2.4-.4-3.5z"
        />
        <path
          fill="#FF3D00"
          d="M6.3 14.7l6.6 4.8C14.6 16 19 13 24 13c3.1 0 5.8 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4C16.3 4 9.7 8.3 6.3 14.7z"
        />
        <path
          fill="#4CAF50"
          d="M24 44c5.2 0 9.9-2 13.5-5.2l-6.2-5.3C29.2 35 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.6 39.6 16.2 44 24 44z"
        />
        <path
          fill="#1976D2"
          d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4 5.5l6.2 5.3C41.4 35.8 44 30.3 44 24c0-1.3-.1-2.4-.4-3.5z"
        />
      </svg>
    ),
  },
  {
    name: "Microsoft",
    svg: (
      <svg viewBox="0 0 23 23" aria-hidden="true">
        <path fill="#F25022" d="M1 1h10v10H1z" />
        <path fill="#7FBA00" d="M12 1h10v10H12z" />
        <path fill="#00A4EF" d="M1 12h10v10H1z" />
        <path fill="#FFB900" d="M12 12h10v10H12z" />
      </svg>
    ),
  },
  {
    name: "GitHub",
    svg: (
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12 .3a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2c-3.3.7-4-1.6-4-1.6-.6-1.4-1.4-1.8-1.4-1.8-1.1-.7.1-.7.1-.7 1.2.1 1.9 1.3 1.9 1.3 1.1 1.9 2.9 1.4 3.6 1 .1-.8.4-1.4.8-1.7-2.7-.3-5.5-1.3-5.5-6 0-1.3.5-2.4 1.3-3.2-.1-.3-.6-1.6.1-3.2 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0c2.3-1.5 3.3-1.2 3.3-1.2.7 1.6.2 2.9.1 3.2.8.8 1.3 1.9 1.3 3.2 0 4.7-2.8 5.6-5.5 5.9.5.4.8 1.2.8 2.4v3.6c0 .3.2.7.8.6A12 12 0 0 0 12 .3" />
      </svg>
    ),
  },
];

const LOGIN_FEED = [
  { ini: "MK", t: "Marta Kowalska uruchomiła analizę AI", m: "lumen-lab/q1-2026 · 12 nowych zadań", s: "gen", st: "generated" },
  { ini: "TW", t: "Tomek Wójcik dodał adnotację głosową 0:42", m: ".btn-export · „Po eksporcie raport…”", s: "rec", st: "voice" },
  { ini: "AL", t: "Anna Lis zaakceptowała SPQ-126", m: "„Brak paginacji w tabeli zamówień…”", s: "acc", st: "accepted" },
  { ini: "PŚ", t: "Paweł Świątek wyeksportował 4 zadania", m: "LUM · Sprint 24 · idempotency-ok", s: "exp", st: "exported" },
];

function Login(props: { onAuthed: (role: string) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const { error, busy, run } = useAsync();
  const submit = (e: FormEvent): void => {
    e.preventDefault();
    void run(async () => {
      const { token } = await api.login(email, password);
      auth.set(token);
      const me = await api.me();
      props.onAuthed(me.role);
    });
  };
  return (
    <div className="auth">
      <main className="form-pane">
        <div className="form-top">
          <span className="login-brand">
            <span className="mark" aria-hidden="true">
              <IconLogo />
            </span>
            Speqify
          </span>
          <div className="lang-switch" aria-hidden="true">
            <button className="active" type="button">
              PL
            </button>
          </div>
        </div>

        <div className="form-box">
          <h1>Witaj z powrotem</h1>
          <p className="sub">
            Zaloguj się do swojego workspace, aby kontynuować review i akceptować zadania
            wygenerowane przez AI.
          </p>

          <div className="sso">
            {SSO.map((s) => (
              <button
                key={s.name}
                type="button"
                className="sso-btn"
                disabled
                title="SSO w przygotowaniu — w V1 logowanie e-mail / hasło"
              >
                {s.svg}
                Kontynuuj z {s.name}
                <span className="badge">wkrótce</span>
              </button>
            ))}
          </div>

          <div className="divider">lub e-mailem</div>

          {error ? <Alert kind="danger">{error}</Alert> : null}
          <form onSubmit={submit} noValidate>
            <Field label="E-mail służbowy" htmlFor="l-email">
              <input
                id="l-email"
                type="email"
                className="input"
                autoComplete="username"
                inputMode="email"
                placeholder="ty@firma.pl"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </Field>
            <Field label="Hasło" htmlFor="l-pass">
              <div style={{ position: "relative", display: "flex" }}>
                <input
                  id="l-pass"
                  type={showPw ? "text" : "password"}
                  className="input"
                  autoComplete="current-password"
                  placeholder="••••••••••••"
                  style={{ paddingRight: 44, flex: 1 }}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  aria-label={showPw ? "Ukryj hasło" : "Pokaż hasło"}
                  onClick={() => setShowPw((v) => !v)}
                  style={{
                    position: "absolute",
                    right: 4,
                    top: 4,
                    width: 36,
                    height: 36,
                    background: "transparent",
                    border: 0,
                    color: "var(--muted)",
                    borderRadius: 6,
                    display: "grid",
                    placeItems: "center",
                  }}
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                </button>
              </div>
            </Field>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                margin: "4px 0 20px",
              }}
            >
              <label className="check">
                <input type="checkbox" defaultChecked />
                Pamiętaj mnie
              </label>
              <span style={{ fontSize: ".75rem", color: "var(--muted)" }}>Sesja 30 dni</span>
            </div>
            <Button type="submit" disabled={busy} style={{ width: "100%" }}>
              {busy ? "Logowanie…" : "Zaloguj się"}
            </Button>
          </form>
        </div>

        <div className="form-foot">
          <span className="gdpr">
            <IconShield />
            Hosted in EU · RODO-compliant
          </span>
          <span>© {new Date().getFullYear()} Speqify</span>
        </div>
      </main>

      <aside className="visual-pane" aria-hidden="true">
        <div className="v-inner">
          <span className="v-eyebrow">
            <span className="live" />
            Workspace na żywo
          </span>
          <h2>Twój zespół zbiera wymagania wprost na żywej aplikacji.</h2>
          <p>
            Po zalogowaniu zobaczysz aktualną kolejkę zadań wygenerowanych przez AI z sesji
            review klientów.
          </p>
          <div className="feed">
            {LOGIN_FEED.map((f) => (
              <div className="feed-row" key={f.t}>
                <Avatar initials={f.ini} size="sm" />
                <div className="info">
                  <div className="t">
                    <span className="who">{f.t}</span>
                  </div>
                  <div className="m">{f.m}</div>
                </div>
                <span className={`fstate ${f.s}`}>{f.st}</span>
              </div>
            ))}
          </div>
          <div className="v-foot">
            <div className="vstat">
              <span className="n">312</span>
              <span>adnotacje · 7d</span>
            </div>
            <span className="sep" />
            <div className="vstat">
              <span className="n">128</span>
              <span>zadania AI</span>
            </div>
            <span className="sep" />
            <div className="vstat">
              <span className="n">81%</span>
              <span>akceptacja</span>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}

function renderPage(role: string, route: string): ReactNode {
  const r = route === "" ? "/" : route;
  if (role === "superadmin") {
    if (r === "/projects/new") return <CreateProject />;
    if (r.startsWith("/projects/")) return <AdminProject id={r.slice("/projects/".length)} />;
    if (r === "/projects") return <Projects />;
    if (r === "/po-users") return <ProductOwners />;
    if (r === "/panels") return <Panels />;
    if (r === "/providers") return <Providers />;
    if (r === "/billing") return <AdminBilling />;
    if (r === "/audit") return <AdminAudit />;
    if (r === "/privacy") return <AdminPrivacy />;
    if (r === "/settings") return <AdminSettings />;
    return <Dashboard />;
  }
  if (r === "/template") return <PoTemplate />;
  if (r === "/export") return <PoExport />;
  if (r === "/tasks") return <PoTasks />;
  if (r === "/sessions")
    return (
      <Placeholder
        crumbs={["Lumen Lab", "Sesje review"]}
        title="Sesje review"
        note="Widok pojedynczej sesji (timeline adnotacji + nagranie ekranu) nie jest jeszcze wdrożony (V1.5 backlog)."
      />
    );
  if (r === "/annotations")
    return (
      <Placeholder
        crumbs={["Lumen Lab", "Adnotacje"]}
        title="Adnotacje"
        note="Przeglądarka surowych adnotacji dla PO nie jest jeszcze wdrożona (Phase 8)."
      />
    );
  if (r === "/reviewers")
    return (
      <Placeholder
        crumbs={["Lumen Lab", "Recenzenci"]}
        title="Recenzenci"
        note="Recenzenci są tożsami z panelami (rola panelu) — dedykowany widow listy recenzentów nie jest wdrożony."
      />
    );
  if (r === "/po-privacy")
    return (
      <Placeholder
        crumbs={["Lumen Lab", "Prywatność"]}
        title="Prywatność"
        note="Ustawienia retencji per projekt nie są jeszcze wdrożone (Phase 11)."
      />
    );
  return <PoOverview />;
}

function Sidebar(props: { role: string; here: string; onSignOut: () => void }) {
  const sa = props.role === "superadmin";
  const nav = sa ? SA_NAV : PO_NAV;
  return (
    <aside className="side">
      <div className="side-head">
        <div className="side-brand">
          <span className="mark" aria-hidden="true">
            <IconLogo />
          </span>
          <span style={{ flex: 1 }}>Speqify</span>
          <span className={`role-pill${sa ? " sa" : ""}`}>{sa ? "SA" : "PO"}</span>
        </div>
        <div className={`proj${sa ? " org" : ""}`}>
          <span className="sq" aria-hidden="true" />
          <span className="meta">
            <span className="n">{sa ? "Speqify Internal" : "Mój projekt"}</span>
            <span className="e">{sa ? "organizacja" : "workspace PO"}</span>
          </span>
          <IconChevronDown className="ch" width={14} height={14} />
        </div>
      </div>
      <nav className="side-nav" aria-label="Sekcje">
        {nav.map((g) => (
          <div key={g.group}>
            <p className="nav-group">{g.group}</p>
            {g.items.map((n) => {
              const Ico = n.icon;
              const active =
                props.here === n.path ||
                (n.path === "/" && props.here === "") ||
                (n.path !== "/" && props.here.startsWith(`${n.path}/`));
              return (
                <a
                  key={n.path}
                  href={`#${n.path}`}
                  className={`nav-item${active ? " active" : ""}`}
                  aria-current={active ? "page" : undefined}
                >
                  <Ico />
                  <span>{n.label}</span>
                  {n.ct && n.ct !== "·" ? (
                    <span className={`ct${n.hot ? " hot" : ""}`}>{n.ct}</span>
                  ) : null}
                </a>
              );
            })}
          </div>
        ))}
      </nav>
      <div className={`side-foot${sa ? " sa" : ""}`}>
        <div className="av">{sa ? "SA" : "PO"}</div>
        <div className="info">
          <div className="n">{sa ? "Super Admin" : "Product Owner"}</div>
          <div className="r">{sa ? "Konto współdzielone" : "Konto projektu"}</div>
        </div>
        <button className="out" onClick={props.onSignOut} aria-label="Wyloguj">
          <IconBook width={16} height={16} />
        </button>
      </div>
    </aside>
  );
}

export function App() {
  const [role, setRole] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const route = useHashRoute();

  useEffect(() => {
    if (!auth.get()) {
      setChecking(false);
      return;
    }
    api
      .me()
      .then((m) => setRole(m.role))
      .catch(() => auth.clear())
      .finally(() => setChecking(false));
  }, []);

  if (checking)
    return (
      <div className="login-wrap">
        <span className="sub" style={{ color: "var(--muted)" }}>
          Ładowanie…
        </span>
      </div>
    );
  if (!role) return <Login onAuthed={setRole} />;

  const here = route === "" ? "/" : route;
  const signOut = (): void => {
    auth.clear();
    setRole(null);
    navigate("/");
  };

  return (
    <ToastProvider>
      <div className="app">
        <Sidebar role={role} here={here} onSignOut={signOut} />
        <div className="main">{renderPage(role, route)}</div>
      </div>
    </ToastProvider>
  );
}
