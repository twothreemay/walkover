import React, { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "@google/model-viewer";
import "./styles.css";

type Project = {
  id: string; title: string; client: string; location: string; surveyDate: string;
  description: string; code: string; createdAt?: string; updatedAt?: string;
};
type FileRecord = {
  id: string; projectId: string; filename: string; contentType: string; size: number;
  kind: string; url?: string;
};
type Observation = {
  id: string; projectId: string; title: string; category: string; status: string; notes: string;
};
type Share = { token: string; projectId: string; label: string; expiresAt: string; revoked: boolean };
type Principal = { userDetails: string; userRoles: string[] };
type SharedProject = { project: Project; files: FileRecord[]; observations: Observation[] };

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, init);
  if (response.status === 401 || response.status === 403) throw new Error("Administrator access required");
  const data = response.status === 204 ? null : await response.json();
  if (!response.ok) throw new Error(data?.error || "The request could not be completed");
  return data as T;
}

function App() {
  const [path, setPath] = useState(window.location.pathname);
  const navigate = (next: string) => { history.pushState({}, "", next); setPath(next); };
  useEffect(() => {
    const onPop = () => setPath(window.location.pathname);
    addEventListener("popstate", onPop);
    return () => removeEventListener("popstate", onPop);
  }, []);
  if (path === "/admin") return <Admin navigate={navigate} />;
  if (path.startsWith("/share/")) return <ProjectViewer token={decodeURIComponent(path.slice(7))} navigate={navigate} />;
  return <Welcome navigate={navigate} />;
}

function Welcome({ navigate }: { navigate: (path: string) => void }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const clean = code.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
      const result = await api<{ token: string }>(`/project-code/${encodeURIComponent(clean)}`);
      navigate(`/share/${result.token}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Project code not found");
    } finally { setBusy(false); }
  }
  return <main className="welcome-shell">
    <header className="welcome-top"><Brand navigate={navigate} /><a className="admin-access" href="/.auth/login/aad?post_login_redirect_uri=/admin">Admin access →</a></header>
    <section className="welcome-panel">
      <div className="welcome-copy"><span>3D SITE RECORDS</span><h1>Return to site.<br />Without going back.</h1><p>Explore an up-to-date highway walkover, inspect the reality capture and review project information from any browser.</p></div>
      <form className="code-card" onSubmit={submit}>
        <span>PROJECT ACCESS</span><h2>Open a walkover</h2><p>Enter the code shared by your project administrator.</p>
        <label htmlFor="project-code">PROJECT CODE</label>
        <input id="project-code" required value={code} onChange={(event) => { setCode(event.target.value.toUpperCase()); setError(""); }} placeholder="XXXXX–XXXXX" />
        {error && <div className="error" role="alert">{error}</div>}
        <button disabled={busy}>{busy ? "Checking…" : "Open project"} <b>→</b></button><small>Codes are supplied with project invitations.</small>
      </form>
    </section>
    <footer><span>Walkover</span><span>Secure highway reality capture</span></footer>
  </main>;
}

function Admin({ navigate }: { navigate: (path: string) => void }) {
  const [principal, setPrincipal] = useState<Principal | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selected, setSelected] = useState<Project | null>(null);
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [observations, setObservations] = useState<Observation[]>([]);
  const [shares, setShares] = useState<Share[]>([]);
  const [editing, setEditing] = useState<Project | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const loadProjects = useCallback(async () => {
    try {
      const data = await api<{ projects: Project[] }>("/projects");
      setProjects(data.projects);
    } catch (reason) { setError(message(reason)); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => {
    fetch("/.auth/me").then((response) => response.json()).then((data) => setPrincipal(data.clientPrincipal || null)).catch(() => setPrincipal(null));
    loadProjects();
  }, [loadProjects]);

  const loadDetail = useCallback(async (project: Project) => {
    setSelected(project); setError("");
    try {
      const [fileData, observationData, shareData] = await Promise.all([
        api<{ files: FileRecord[] }>(`/projects/${project.id}/files`),
        api<{ observations: Observation[] }>(`/projects/${project.id}/observations`),
        api<{ shares: Share[] }>(`/projects/${project.id}/shares`)
      ]);
      setFiles(fileData.files); setObservations(observationData.observations); setShares(shareData.shares);
    } catch (reason) { setError(message(reason)); }
  }, []);

  function create() {
    setEditing({ id: "", title: "New walkover", client: "", location: "", surveyDate: new Date().toISOString().slice(0, 10), description: "", code: crypto.randomUUID().slice(0, 10).toUpperCase() });
  }
  function update(field: keyof Project, value: string) { setEditing((current) => current ? { ...current, [field]: value } : current); }
  async function save(event: FormEvent) {
    event.preventDefault(); if (!editing) return;
    try {
      const result = editing.id
        ? await api<{ project: Project }>(`/projects/${editing.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(editing) })
        : await api<{ project: Project }>("/projects", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(editing) });
      setEditing(null); await loadProjects(); await loadDetail(result.project);
    } catch (reason) { setError(message(reason)); }
  }
  async function remove(project: Project) {
    if (!confirm(`Delete “${project.title}”?`)) return;
    try {
      await api(`/projects/${project.id}`, { method: "DELETE" });
      if (selected?.id === project.id) setSelected(null);
      await loadProjects();
    } catch (reason) { setError(message(reason)); }
  }
  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!selected) return;
    const form = new FormData(event.currentTarget);
    try {
      await api(`/projects/${selected.id}/files`, { method: "POST", body: form });
      event.currentTarget.reset(); await loadDetail(selected);
    } catch (reason) { setError(message(reason)); }
  }
  async function addObservation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!selected) return;
    const form = new FormData(event.currentTarget);
    try {
      await api(`/projects/${selected.id}/observations`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: form.get("title"), category: form.get("category"), notes: form.get("notes") })
      });
      event.currentTarget.reset(); await loadDetail(selected);
    } catch (reason) { setError(message(reason)); }
  }
  async function addShare() {
    if (!selected) return;
    try {
      const data = await api<{ share: Share; urlPath: string }>(`/projects/${selected.id}/shares`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ label: "Project team" })
      });
      await navigator.clipboard.writeText(`${location.origin}${data.urlPath}`);
      await loadDetail(selected);
    } catch (reason) { setError(message(reason)); }
  }
  async function deleteObservation(id: string) {
    if (!selected || !confirm("Delete this observation?")) return;
    try { await api(`/projects/${selected.id}/observations/${id}`, { method: "DELETE" }); await loadDetail(selected); }
    catch (reason) { setError(message(reason)); }
  }

  const hasAdminRole = principal?.userRoles?.includes("admin");
  if (!loading && !hasAdminRole) return <AccessDenied />;
  return <main className="admin-shell">
    <header className="welcome-top"><Brand navigate={navigate} /><div className="admin-account">{principal?.userDetails || "Checking access…"} · <a href="/.auth/logout?post_logout_redirect_uri=/">Sign out</a></div></header>
    <section className="admin-heading"><div><span>WORKSPACE ADMINISTRATION</span><h1>Projects</h1><p>Azure-backed site records, files and share links.</p></div><button className="red-button" onClick={create}>＋ New project</button></section>
    {error && <div className="admin-error">{error}</div>}
    <section className="admin-layout">
      <div className="project-list">
        {loading && <p>Loading projects…</p>}
        {projects.map((project) => <article className={selected?.id === project.id ? "selected" : ""} key={project.id} onClick={() => loadDetail(project)}>
          <div><span>{project.client || "Internal"}</span><h2>{project.title}</h2><p>{project.location} · {project.surveyDate}</p></div>
          <code>{project.code}</code>
          <button onClick={(event) => { event.stopPropagation(); setEditing(project); }}>Edit</button>
          <button className="danger" onClick={(event) => { event.stopPropagation(); remove(project); }}>Delete</button>
        </article>)}
      </div>
      <aside className="admin-detail">
        {!selected ? <div className="empty-detail"><h2>Select a project</h2><p>Manage files, observations and sharing.</p></div> : <>
          <div className="detail-heading"><span>SELECTED PROJECT</span><h2>{selected.title}</h2><code>{selected.code}</code></div>
          <section><div className="section-head"><h3>Files</h3></div>
            {files.map((file) => <div className="record-row" key={file.id}><span><b>{file.filename}</b><small>{file.kind} · {formatBytes(file.size)}</small></span></div>)}
            <form className="inline-form" onSubmit={upload}><input name="file" type="file" required accept=".glb,.gltf,.obj,.las,.laz,.jpg,.jpeg,.png,.webp,.csv,.json" /><select name="kind"><option value="model">Model</option><option value="image">Image</option><option value="metadata">Metadata</option></select><button>Upload</button></form>
          </section>
          <section><div className="section-head"><h3>Site observations</h3></div>
            {observations.map((item) => <div className="record-row" key={item.id}><span><b>{item.title}</b><small>{item.category} · {item.status}</small></span><button onClick={() => deleteObservation(item.id)}>Delete</button></div>)}
            <form className="inline-form observation-form" onSubmit={addObservation}><input name="title" required placeholder="Observation title" /><input name="category" placeholder="Category" /><input name="notes" placeholder="Notes" /><button>Add</button></form>
          </section>
          <section><div className="section-head"><h3>Share links</h3><button onClick={addShare}>＋ Create link</button></div>
            {shares.map((share) => <div className="record-row" key={share.token}><span><b>{share.label}</b><small>Expires {new Date(share.expiresAt).toLocaleDateString("en-GB")}</small></span><button onClick={() => navigator.clipboard.writeText(`${location.origin}/share/${share.token}`)}>Copy</button></div>)}
          </section>
        </>}
      </aside>
    </section>
    {editing && <ProjectModal editing={editing} update={update} save={save} close={() => setEditing(null)} />}
  </main>;
}

function ProjectModal({ editing, update, save, close }: { editing: Project; update: (field: keyof Project, value: string) => void; save: (event: FormEvent) => void; close: () => void }) {
  return <div className="modal"><form onSubmit={save}>
    <div className="modal-head"><div><span>PROJECT DETAILS</span><h2>{editing.id ? "Edit project" : "Create project"}</h2></div><button type="button" onClick={close}>×</button></div>
    <label>Project title<input required value={editing.title} onChange={(event) => update("title", event.target.value)} /></label>
    <label>Client<input value={editing.client} onChange={(event) => update("client", event.target.value)} /></label>
    <label>Location<input value={editing.location} onChange={(event) => update("location", event.target.value)} /></label>
    <label>Survey date<input required type="date" value={editing.surveyDate} onChange={(event) => update("surveyDate", event.target.value)} /></label>
    <label>Project code<input required value={editing.code} onChange={(event) => update("code", event.target.value.toUpperCase())} /></label>
    <label>Description<textarea value={editing.description} onChange={(event) => update("description", event.target.value)} /></label>
    <div className="modal-actions"><button type="button" onClick={close}>Cancel</button><button className="red-button">Save project</button></div>
  </form></div>;
}

function ProjectViewer({ token, navigate }: { token: string; navigate: (path: string) => void }) {
  const [data, setData] = useState<SharedProject | null>(null);
  const [error, setError] = useState("");
  const viewer = useRef<HTMLElement | null>(null);
  const [measure, setMeasure] = useState(false);
  const [points, setPoints] = useState<{ position: string; x: number; y: number; z: number }[]>([]);
  useEffect(() => { api<SharedProject>(`/shares/${encodeURIComponent(token)}`).then(setData).catch((reason) => setError(message(reason))); }, [token]);
  if (error) return <NotFound navigate={navigate} message={error} />;
  if (!data) return <main className="not-found"><p>Loading walkover…</p></main>;
  const model = data.files.find((file) => file.kind === "model");
  const distance = points.length === 2 ? Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y, points[1].z - points[0].z) : null;
  function select(event: React.MouseEvent<HTMLElement>) {
    if (!measure || points.length >= 2) return;
    const hit = (viewer.current as unknown as { positionAndNormalFromPoint?: (x: number, y: number) => { position: { x: number; y: number; z: number } } })?.positionAndNormalFromPoint?.(event.clientX, event.clientY);
    if (hit) { const { x, y, z } = hit.position; setPoints((current) => [...current, { x, y, z, position: `${x}m ${y}m ${z}m` }]); }
  }
  return <main className="viewer-shell">
    <header className="welcome-top"><Brand navigate={navigate} /><button className="admin-access" onClick={() => navigate("/")}>Exit project →</button></header>
    <section className="project-title"><div><span>PROJECT WALKOVER</span><h1>{data.project.title}</h1><p>{data.project.location} · {data.project.surveyDate}</p></div><code>{data.project.code}</code></section>
    <section className="viewer-grid">
      <div className="viewer-card"><div className="viewer-toolbar"><b>{model?.filename || "No model uploaded"}</b><button className={measure ? "active" : ""} onClick={() => { setMeasure(!measure); setPoints([]); }}>↔ {measure ? "Clear measure" : "Measure"}</button></div>
        <div className="model-stage">
          {model?.url ? React.createElement("model-viewer", { ref: viewer, src: model.url, "camera-controls": true, "touch-action": "pan-y", "shadow-intensity": "0.7", exposure: "1.05", "min-camera-orbit": "auto auto 0.05m", "max-camera-orbit": "auto auto 100m", onClick: select },
            points.map((point, index) => <button key={index} className="hotspot" slot={`hotspot-${index}`} data-position={point.position}>{index + 1}</button>)) : <div className="empty-model">No 3D model has been added to this project.</div>}
          {distance !== null && <div className="distance">{distance.toFixed(2)} m</div>}
          <div className="viewer-help">{measure ? `${points.length}/2 points selected` : "Drag to orbit · Scroll to zoom · Right-drag to pan"}</div>
        </div>
        <div className="disclaimer"><b>!</b><p><strong>Visual site record — not survey grade.</strong> Measurements are indicative only and must be independently verified.</p></div>
      </div>
      <aside><span>SURVEY DETAILS</span><h2>{data.project.title}</h2><p>{data.project.description || "No project description supplied."}</p><dl><dt>Client</dt><dd>{data.project.client || "Not supplied"}</dd><dt>Location</dt><dd>{data.project.location || "Not supplied"}</dd><dt>Survey date</dt><dd>{data.project.surveyDate}</dd><dt>Observations</dt><dd>{data.observations.length}</dd></dl></aside>
    </section>
  </main>;
}

function AccessDenied() {
  return <main className="not-found"><h1>Admin access required</h1><p>Sign in with an account assigned the Static Web Apps <code>admin</code> role.</p><a className="red-button" href="/.auth/login/aad?post_login_redirect_uri=/admin">Sign in with Microsoft</a><a href="/">Return to welcome page</a></main>;
}
function NotFound({ navigate, message }: { navigate: (path: string) => void; message: string }) {
  return <main className="not-found"><Brand navigate={navigate} /><h1>Project unavailable</h1><p>{message}</p><button onClick={() => navigate("/")}>Return to welcome page</button></main>;
}
function Brand({ navigate }: { navigate: (path: string) => void }) {
  return <button className="brand" onClick={() => navigate("/")}><i>W</i><span>WALKOVER</span></button>;
}
function message(reason: unknown) { return reason instanceof Error ? reason.message : "Something went wrong"; }
function formatBytes(value: number) { return value > 1024 * 1024 ? `${(value / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(value / 1024))} KB`; }

createRoot(document.getElementById("root")!).render(<App />);
