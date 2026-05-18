import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import type { Panel, Project, User } from "@speqify/shared";
import { api, sdkSnippet } from "./api.js";
import { Alert, Field, PageHeader, csvToList, useAsync } from "./ui.js";

export function Dashboard() {
  const [counts, setCounts] = useState({ projects: 0, pos: 0 });
  const { error, run } = useAsync();
  useEffect(() => {
    void run(async () => {
      const [u, p] = await Promise.all([api.listUsers(), api.listProjects()]);
      setCounts({
        projects: p.projects.length,
        pos: u.users.filter((x) => x.role === "product_owner").length,
      });
    });
  }, []);

  return (
    <>
      <PageHeader title="Dashboard" sub="SuperAdmin overview" />
      {error ? <Alert kind="danger">{error}</Alert> : null}
      <div className="grid gap-lg sm:grid-cols-2">
        <div className="card card-pad">
          <p className="badge">Projects</p>
          <p className="mt-sm text-h1 text-primary">{counts.projects}</p>
        </div>
        <div className="card card-pad">
          <p className="badge">Product owners</p>
          <p className="mt-sm text-h1 text-primary">{counts.pos}</p>
        </div>
      </div>
    </>
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
    <>
      <PageHeader title="Product owners" sub="Create and review PO accounts" />
      {error ? <Alert kind="danger">{error}</Alert> : null}
      {created ? (
        <Alert kind="success">
          Created <b>{created.email}</b>. One-time password:{" "}
          <span className="pill-code">{created.password}</span> — copy it now.
        </Alert>
      ) : null}
      <div className="card card-pad mt-lg">
        <table className="table">
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
                <td colSpan={3} className="text-muted">
                  No product owners yet.
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
      <form onSubmit={submit} className="card card-pad mt-lg max-w-lg" noValidate>
        <h2 className="section-title !mt-0">Create product owner</h2>
        <Field label="Display name" htmlFor="po-name">
          <input
            id="po-name"
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </Field>
        <Field label="Email" htmlFor="po-email">
          <input
            id="po-email"
            type="email"
            className="input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </Field>
        <button className="btn-primary" type="submit" disabled={busy}>
          {busy ? "Creating…" : "Create PO"}
        </button>
      </form>
    </>
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

  const pos = users.filter((u) => u.role === "product_owner");
  return (
    <>
      <PageHeader title="Projects" />
      {error ? <Alert kind="danger">{error}</Alert> : null}
      <div className="card card-pad">
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Id</th>
              <th>Product owner</th>
            </tr>
          </thead>
          <tbody>
            {projects.length === 0 ? (
              <tr>
                <td colSpan={3} className="text-muted">
                  No projects yet.
                </td>
              </tr>
            ) : (
              projects.map((p) => (
                <tr key={p.id}>
                  <td>{p.name}</td>
                  <td>
                    <span className="pill-code">{p.id}</span>
                  </td>
                  <td>
                    <span className="pill-code">{p.productOwnerId}</span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <form onSubmit={submit} className="card card-pad mt-lg max-w-lg" noValidate>
        <h2 className="section-title !mt-0">Create project</h2>
        <Field label="Project name" htmlFor="pr-name">
          <input
            id="pr-name"
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </Field>
        <Field label="Product owner" htmlFor="pr-po">
          <select
            id="pr-po"
            className="select"
            value={poId}
            onChange={(e) => setPoId(e.target.value)}
            required
          >
            <option value="">Select a product owner…</option>
            {pos.map((u) => (
              <option key={u.id} value={u.id}>
                {u.displayName} ({u.email})
              </option>
            ))}
          </select>
        </Field>
        <Field
          label="Environment URLs"
          htmlFor="pr-urls"
          hint="Comma-separated. Also the ingest CORS allowlist."
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
        <button className="btn-primary" type="submit" disabled={busy || !poId}>
          {busy ? "Creating…" : "Create project"}
        </button>
      </form>
    </>
  );
}

export function Panels() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState("");
  const [panels, setPanels] = useState<Panel[]>([]);
  const [audience, setAudience] = useState("client");
  const [envUrl, setEnvUrl] = useState("");
  const [created, setCreated] = useState<{ secretToken: string; panelUrl: string } | null>(null);
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
    <>
      <PageHeader title="Panels" sub="Capability links + install snippet" />
      {error ? <Alert kind="danger">{error}</Alert> : null}
      <div className="card card-pad max-w-lg">
        <Field label="Project" htmlFor="pn-proj">
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
            <option value="">Select a project…</option>
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
              <span>
                Token <span className="pill-code">{created.secretToken}</span> · link{" "}
                <span className="pill-code">{created.panelUrl}</span>
              </span>
            </Alert>
          ) : null}
          <div className="card card-pad mt-lg">
            <table className="table">
              <thead>
                <tr>
                  <th>Audience</th>
                  <th>Status</th>
                  <th>Environment</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {panels.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-muted">
                      No panels yet.
                    </td>
                  </tr>
                ) : (
                  panels.map((p) => (
                    <tr key={p.id}>
                      <td>{p.audience}</td>
                      <td>{p.status}</td>
                      <td>{p.environmentUrl}</td>
                      <td>
                        <div className="flex justify-end gap-sm">
                          <button className="btn-secondary btn-sm" onClick={() => toggle(p)}>
                            {p.status === "open" ? "Close" : "Reopen"}
                          </button>
                          <button className="btn-danger btn-sm" onClick={() => remove(p)}>
                            Delete
                          </button>
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
              <h2 className="section-title">Install snippet</h2>
              <pre className="code-block">
                <code>{sdkSnippet(panels[0].secretToken)}</code>
              </pre>
            </>
          ) : null}

          <form onSubmit={submit} className="card card-pad mt-lg max-w-lg" noValidate>
            <h2 className="section-title !mt-0">Create panel</h2>
            <Field label="Audience" htmlFor="pn-aud">
              <select
                id="pn-aud"
                className="select"
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
              >
                <option value="client">Client</option>
                <option value="tester">Tester</option>
                <option value="po">Product owner</option>
              </select>
            </Field>
            <Field label="Environment URL" htmlFor="pn-url">
              <input
                id="pn-url"
                className="input"
                value={envUrl}
                onChange={(e) => setEnvUrl(e.target.value)}
                placeholder="https://staging.acme.test"
                required
              />
            </Field>
            <button className="btn-primary" type="submit" disabled={busy}>
              {busy ? "Creating…" : "Create panel"}
            </button>
          </form>
        </>
      ) : null}
    </>
  );
}
