import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { api, auth } from "./api.js";
import { navigate, useHashRoute } from "./router.js";
import { Alert, Field, useAsync } from "./ui.js";
import { Dashboard, Panels, ProductOwners, Projects } from "./pages-sa.js";
import { PoExport, PoOverview, PoTasks, PoTemplate } from "./pages-po.js";

type Nav = { path: string; label: string };

const SA_NAV: Nav[] = [
  { path: "/", label: "Dashboard" },
  { path: "/po-users", label: "Product owners" },
  { path: "/projects", label: "Projects" },
  { path: "/panels", label: "Panels" },
];
const PO_NAV: Nav[] = [
  { path: "/", label: "Overview" },
  { path: "/template", label: "Task template" },
  { path: "/export", label: "Export" },
  { path: "/tasks", label: "Tasks" },
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
    <div className="grid min-h-screen place-items-center p-md">
      <form onSubmit={submit} className="card card-pad w-full max-w-sm" noValidate>
        <h1 className="text-h3 text-primary">Speqify Admin</h1>
        <p className="page-sub mb-lg">Sign in to manage projects and panels.</p>
        {error ? <Alert kind="danger">{error}</Alert> : null}
        <Field label="Email" htmlFor="l-email">
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
        <Field label="Password" htmlFor="l-pass">
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
        <button className="btn-primary mt-sm w-full" type="submit" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}

function renderPage(role: string, route: string) {
  const r = route === "" ? "/" : route;
  if (role === "superadmin") {
    if (r === "/po-users") return <ProductOwners />;
    if (r === "/projects") return <Projects />;
    if (r === "/panels") return <Panels />;
    return <Dashboard />;
  }
  if (r === "/template") return <PoTemplate />;
  if (r === "/export") return <PoExport />;
  if (r === "/tasks") return <PoTasks />;
  return <PoOverview />;
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

  if (checking) return <div className="grid min-h-screen place-items-center">…</div>;
  if (!role) return <Login onAuthed={setRole} />;

  const nav = role === "superadmin" ? SA_NAV : PO_NAV;
  const here = route === "" ? "/" : route;

  return (
    <div className="app-shell">
      <div className="shell-brand">Speqify</div>
      <div className="shell-top">
        <span className="badge">{role === "superadmin" ? "SuperAdmin" : "Product owner"}</span>
        <button
          className="btn-ghost btn-sm"
          onClick={() => {
            auth.clear();
            setRole(null);
            navigate("/");
          }}
        >
          Sign out
        </button>
      </div>
      <nav className="shell-side" aria-label="Sections">
        <p className="nav-group">{role === "superadmin" ? "Administration" : "Workspace"}</p>
        {nav.map((n) => (
          <a
            key={n.path}
            href={`#${n.path}`}
            className="nav-link"
            aria-current={here === n.path ? "page" : undefined}
          >
            {n.label}
          </a>
        ))}
      </nav>
      <main className="shell-main">{renderPage(role, route)}</main>
    </div>
  );
}
