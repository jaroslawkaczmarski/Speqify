import { useEffect, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { api, auth } from "./api.js";
import { navigate, useHashRoute } from "./router.js";
import { Alert, Button, Field, Placeholder, ToastProvider, useAsync } from "./components.js";
import { Dashboard, Panels, ProductOwners, Projects, Providers } from "./pages-sa.js";
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

function Login(props: { onAuthed: (role: string) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
    <div className="login-wrap">
      <form onSubmit={submit} className="login-card" noValidate>
        <div className="login-brand">
          <span className="mark" aria-hidden="true">
            <IconLogo />
          </span>
          Speqify
        </div>
        <p className="sub" style={{ color: "var(--muted)", marginBottom: 20 }}>
          Zaloguj się, aby zarządzać projektami i panelami.
        </p>
        {error ? <Alert kind="danger">{error}</Alert> : null}
        <Field label="E-mail" htmlFor="l-email">
          <input
            id="l-email"
            type="email"
            className="input"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </Field>
        <Field label="Hasło" htmlFor="l-pass">
          <input
            id="l-pass"
            type="password"
            className="input"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </Field>
        <Button type="submit" disabled={busy} style={{ width: "100%" }}>
          {busy ? "Logowanie…" : "Zaloguj się"}
        </Button>
      </form>
    </div>
  );
}

function renderPage(role: string, route: string): ReactNode {
  const r = route === "" ? "/" : route;
  if (role === "superadmin") {
    if (r === "/projects") return <Projects />;
    if (r === "/po-users") return <ProductOwners />;
    if (r === "/panels") return <Panels />;
    if (r === "/providers") return <Providers />;
    if (r === "/billing")
      return (
        <Placeholder
          crumbs={["Speqify Internal", "Rozliczenia & limity"]}
          title="Rozliczenia & limity"
          note="Limity i koszty AI per organizacja nie są jeszcze wdrożone (Phase 11)."
        />
      );
    if (r === "/audit")
      return (
        <Placeholder
          crumbs={["Speqify Internal", "Audyt log"]}
          title="Audyt log"
          note="Trwały audyt log nie jest jeszcze wdrożony (Phase 11 — observability)."
        />
      );
    if (r === "/privacy")
      return (
        <Placeholder
          crumbs={["Speqify Internal", "Prywatność & RODO"]}
          title="Prywatność & RODO"
          note="Panel retencji/erasure RODO nie jest jeszcze wdrożony (Phase 11)."
        />
      );
    if (r === "/settings")
      return (
        <Placeholder
          crumbs={["Speqify Internal", "Ustawienia organizacji"]}
          title="Ustawienia organizacji"
          note="Ustawienia organizacji nie są jeszcze wdrożone."
        />
      );
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
              const active = props.here === n.path || (n.path === "/" && props.here === "");
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
