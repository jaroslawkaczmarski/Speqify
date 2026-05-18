import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import type { Panel, Project, User } from "@speqify/shared";
import { api, auth, sdkSnippet } from "./api.js";

/* SuperAdmin panel (Phase 2). Internal tool — Convergence-styled, accessible,
   single-column forms, labels above inputs (DESIGN.md). */

function useAsync() {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<void>) => {
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

function Login(props: { onSuccess: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { error, busy, run } = useAsync();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    void run(async () => {
      const { token } = await api.login(email, password);
      auth.set(token);
      props.onSuccess();
    });
  };

  return (
    <div className="center">
      <h1>Speqify Admin</h1>
      <p className="muted">Sign in to manage projects, product owners and panels.</p>
      <form onSubmit={submit} className="card" noValidate>
        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {error ? (
          <p className="alert alert-error" role="alert">
            {error}
          </p>
        ) : null}
        <div style={{ marginTop: 24 }}>
          <button className="btn" type="submit" disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </div>
      </form>
    </div>
  );
}

function ProductOwners(props: { users: User[]; reload: () => void }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [created, setCreated] = useState<{ email: string; password: string } | null>(null);
  const { error, busy, run } = useAsync();
  const pos = props.users.filter((u) => u.role === "product_owner");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    void run(async () => {
      const res = await api.createUser(email, name);
      setCreated({ email: res.email, password: res.password });
      setEmail("");
      setName("");
      props.reload();
    });
  };

  return (
    <section aria-labelledby="po-h">
      <h2 id="po-h">Product Owners</h2>
      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Id</th>
            </tr>
          </thead>
          <tbody>
            {pos.length === 0 ? (
              <tr>
                <td colSpan={3} className="muted">
                  No product owners yet.
                </td>
              </tr>
            ) : (
              pos.map((u) => (
                <tr key={u.id}>
                  <td>{u.displayName}</td>
                  <td>{u.email}</td>
                  <td>
                    <code>{u.id}</code>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <form onSubmit={submit} className="card" noValidate>
        <div className="row">
          <strong>Create product owner</strong>
        </div>
        <label htmlFor="po-name">Display name</label>
        <input id="po-name" value={name} onChange={(e) => setName(e.target.value)} required />
        <label htmlFor="po-email">Email</label>
        <input
          id="po-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        {error ? (
          <p className="alert alert-error" role="alert">
            {error}
          </p>
        ) : null}
        {created ? (
          <p className="alert alert-ok" role="status">
            Created <b>{created.email}</b>. One-time password: <code>{created.password}</code> —
            copy it now, it is not shown again.
          </p>
        ) : null}
        <div style={{ marginTop: 16 }}>
          <button className="btn" type="submit" disabled={busy}>
            {busy ? "Creating…" : "Create PO"}
          </button>
        </div>
      </form>
    </section>
  );
}

function Projects(props: { projects: Project[]; users: User[]; reload: () => void }) {
  const [name, setName] = useState("");
  const [poId, setPoId] = useState("");
  const [urls, setUrls] = useState("");
  const { error, busy, run } = useAsync();
  const pos = props.users.filter((u) => u.role === "product_owner");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    void run(async () => {
      const list = urls
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      await api.createProject(name, poId, list);
      setName("");
      setUrls("");
      props.reload();
    });
  };

  return (
    <section aria-labelledby="pr-h">
      <h2 id="pr-h">Projects</h2>
      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Id</th>
              <th>Product owner</th>
            </tr>
          </thead>
          <tbody>
            {props.projects.length === 0 ? (
              <tr>
                <td colSpan={3} className="muted">
                  No projects yet.
                </td>
              </tr>
            ) : (
              props.projects.map((p) => (
                <tr key={p.id}>
                  <td>{p.name}</td>
                  <td>
                    <code>{p.id}</code>
                  </td>
                  <td>
                    <code>{p.productOwnerId}</code>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <form onSubmit={submit} className="card" noValidate>
        <div className="row">
          <strong>Create project</strong>
        </div>
        <label htmlFor="pr-name">Project name</label>
        <input id="pr-name" value={name} onChange={(e) => setName(e.target.value)} required />
        <label htmlFor="pr-po">Product owner</label>
        <select id="pr-po" value={poId} onChange={(e) => setPoId(e.target.value)} required>
          <option value="">Select a product owner…</option>
          {pos.map((u) => (
            <option key={u.id} value={u.id}>
              {u.displayName} ({u.email})
            </option>
          ))}
        </select>
        <label htmlFor="pr-urls">Environment URLs (comma-separated)</label>
        <input
          id="pr-urls"
          value={urls}
          onChange={(e) => setUrls(e.target.value)}
          placeholder="https://staging.acme.test"
          required
        />
        {error ? (
          <p className="alert alert-error" role="alert">
            {error}
          </p>
        ) : null}
        <div style={{ marginTop: 16 }}>
          <button className="btn" type="submit" disabled={busy || !poId}>
            {busy ? "Creating…" : "Create project"}
          </button>
        </div>
      </form>
    </section>
  );
}

function Panels(props: { projects: Project[] }) {
  const [projectId, setProjectId] = useState("");
  const [panels, setPanels] = useState<Panel[]>([]);
  const [audience, setAudience] = useState("client");
  const [envUrl, setEnvUrl] = useState("");
  const [created, setCreated] = useState<{ secretToken: string; panelUrl: string } | null>(null);
  const { error, busy, run } = useAsync();

  useEffect(() => {
    if (!projectId) {
      setPanels([]);
      return;
    }
    void run(async () => {
      setPanels((await api.listPanels(projectId)).panels);
    });
  }, [projectId]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    void run(async () => {
      const res = await api.createPanel(projectId, audience, envUrl);
      setCreated({ secretToken: res.secretToken, panelUrl: res.panelUrl });
      setEnvUrl("");
      setPanels((await api.listPanels(projectId)).panels);
    });
  };

  return (
    <section aria-labelledby="pn-h">
      <h2 id="pn-h">Panels</h2>
      <div className="card">
        <label htmlFor="pn-proj">Project</label>
        <select
          id="pn-proj"
          value={projectId}
          onChange={(e) => {
            setCreated(null);
            setProjectId(e.target.value);
          }}
        >
          <option value="">Select a project…</option>
          {props.projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      {projectId ? (
        <>
          {panels.length === 0 ? (
            <p className="card muted">No panels yet.</p>
          ) : (
            panels.map((p) => (
              <div className="card" key={p.id}>
                <div className="row">
                  <div>
                    <strong>{p.audience}</strong> · {p.status} ·{" "}
                    <span className="muted">{p.environmentUrl}</span>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      className="btn btn-secondary"
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        void run(async () => {
                          await api.setPanelStatus(p.id, p.status === "open" ? "closed" : "open");
                          setPanels((await api.listPanels(projectId)).panels);
                        })
                      }
                    >
                      {p.status === "open" ? "Close" : "Reopen"}
                    </button>
                    <button
                      className="btn"
                      type="button"
                      style={{ background: "var(--danger)" }}
                      disabled={busy}
                      onClick={() =>
                        void run(async () => {
                          if (
                            !window.confirm("Delete this panel? The link is revoked permanently.")
                          )
                            return;
                          await api.deletePanel(p.id);
                          setPanels((await api.listPanels(projectId)).panels);
                        })
                      }
                    >
                      Delete
                    </button>
                  </div>
                </div>
                <details style={{ marginTop: 12 }}>
                  <summary>Install snippet &amp; token</summary>
                  <p className="muted" style={{ marginTop: 8 }}>
                    Token: <code>{p.secretToken}</code>
                  </p>
                  <pre style={{ overflowX: "auto" }}>
                    <code>{sdkSnippet(p.secretToken)}</code>
                  </pre>
                </details>
              </div>
            ))
          )}
          <form onSubmit={submit} className="card" noValidate>
            <div className="row">
              <strong>Create panel</strong>
            </div>
            <label htmlFor="pn-aud">Audience</label>
            <select id="pn-aud" value={audience} onChange={(e) => setAudience(e.target.value)}>
              <option value="client">Client</option>
              <option value="tester">Tester</option>
              <option value="po">Product owner</option>
            </select>
            <label htmlFor="pn-url">Environment URL</label>
            <input
              id="pn-url"
              value={envUrl}
              onChange={(e) => setEnvUrl(e.target.value)}
              placeholder="https://staging.acme.test"
              required
            />
            {error ? (
              <p className="alert alert-error" role="alert">
                {error}
              </p>
            ) : null}
            {created ? (
              <p className="alert alert-ok" role="status">
                Panel created. Token: <code>{created.secretToken}</code>
                <br />
                Link: <code>{created.panelUrl}</code>
              </p>
            ) : null}
            <div style={{ marginTop: 16 }}>
              <button className="btn" type="submit" disabled={busy}>
                {busy ? "Creating…" : "Create panel"}
              </button>
            </div>
          </form>
        </>
      ) : null}
    </section>
  );
}

export function App() {
  const [authed, setAuthed] = useState(Boolean(auth.get()));
  const [users, setUsers] = useState<User[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const { error, run } = useAsync();

  const reload = () =>
    void run(async () => {
      const [u, p] = await Promise.all([api.listUsers(), api.listProjects()]);
      setUsers(u.users);
      setProjects(p.projects);
    });

  useEffect(() => {
    if (authed) reload();
  }, [authed]);

  if (!authed) return <Login onSuccess={() => setAuthed(true)} />;

  return (
    <div className="wrap">
      <div className="row">
        <h1>Speqify Admin</h1>
        <button
          className="btn-link"
          type="button"
          onClick={() => {
            auth.clear();
            setAuthed(false);
          }}
        >
          Sign out
        </button>
      </div>
      {error ? (
        <p className="alert alert-error" role="alert">
          {error}
        </p>
      ) : null}
      <ProductOwners users={users} reload={reload} />
      <Projects projects={projects} users={users} reload={reload} />
      <Panels projects={projects} />
    </div>
  );
}
