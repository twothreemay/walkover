"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

type Project = {
  id: string; title: string; client: string; location: string; survey_date: string;
  status: string; updated_at: number; file_count: number; total_bytes: number; share_count: number;
};
type FileRow = { id: string; kind: string; filename: string; content_type: string; size: number; static_path?: string };
type ShareRow = { id: string; token: string; label: string; expires_at: number; revoked_at?: number };
type Detail = { project: Project & { description: string }; files: FileRow[]; shares: ShareRow[] };
type AccessRequest = { id: string; email: string; display_name: string; organisation: string; reason: string; created_at: number };

function formatProjectCode(token: string) {
  const code = token.slice(0, 10).toUpperCase();
  return `${code.slice(0, 5)}-${code.slice(5)}`;
}

export default function AdminDashboard({ user }: { user: { name: string; email: string } }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [toast, setToast] = useState("");
  const [query, setQuery] = useState("");
  const [accessRequests, setAccessRequests] = useState<AccessRequest[]>([]);

  const loadProjects = useCallback(async () => {
    setLoading(true);
    const response = await fetch("/api/projects");
    const data = await response.json();
    if (response.ok) setProjects(data.projects);
    else notify(data.error || "Could not load projects");
    setLoading(false);
  }, []);

  const loadDetail = useCallback(async (id: string) => {
    setSelected(id);
    const response = await fetch(`/api/projects/${id}`);
    const data = await response.json();
    if (response.ok) setDetail(data);
    else notify(data.error || "Could not load project");
  }, []);

  useEffect(() => { loadProjects(); }, [loadProjects]);
  useEffect(() => {
    fetch("/api/admin-access").then(async (response) => response.ok ? response.json() : null).then((data) => setAccessRequests(data?.requests || []));
  }, []);
  useEffect(() => { if (selected) loadDetail(selected); }, [selected, loadDetail]);

  function notify(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2800);
  }

  async function createProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy("create");
    const response = await fetch("/api/projects", { method: "POST", body: new FormData(event.currentTarget) });
    const data = await response.json();
    setBusy("");
    if (!response.ok) return notify(data.error || "Project could not be created");
    setShowCreate(false);
    await loadProjects();
    await loadDetail(data.project.id);
    notify("Project created");
  }

  async function uploadFiles(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    setBusy("upload");
    const response = await fetch(`/api/projects/${selected}/files`, { method: "POST", body: new FormData(event.currentTarget) });
    const data = await response.json();
    setBusy("");
    if (!response.ok) return notify(data.error || "Upload failed");
    event.currentTarget.reset();
    await loadDetail(selected);
    await loadProjects();
    notify(`${data.uploaded} file${data.uploaded === 1 ? "" : "s"} uploaded`);
  }

  async function makeShareLink() {
    if (!selected) return;
    setBusy("share");
    const label = window.prompt("Who is this link for?", "Project team") || "Project team";
    const response = await fetch(`/api/projects/${selected}/share`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label, days: 30 }),
    });
    const data = await response.json();
    setBusy("");
    if (!response.ok) return notify(data.error || "Share link could not be created");
    const url = `${window.location.origin}/share/${data.share.token}`;
    await navigator.clipboard.writeText(url);
    await loadDetail(selected);
    await loadProjects();
    notify("30-day share link copied");
  }

  async function editProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    setBusy("edit");
    const form = new FormData(event.currentTarget);
    const response = await fetch(`/api/projects/${selected}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: form.get("title"), client: form.get("client"), location: form.get("location"),
        surveyDate: form.get("surveyDate"), description: form.get("description"),
      }),
    });
    const data = await response.json();
    setBusy("");
    if (!response.ok) return notify(data.error || "Project could not be updated");
    setShowEdit(false);
    await loadProjects();
    await loadDetail(selected);
    notify("Project details updated");
  }

  async function deleteProject() {
    if (!selected || !detail) return;
    const confirmed = window.confirm(`Permanently delete “${detail.project.title}” and all uploaded files, observations and share links? This cannot be undone.`);
    if (!confirmed) return;
    setBusy("delete");
    const response = await fetch(`/api/projects/${selected}`, { method: "DELETE" });
    const data = await response.json();
    setBusy("");
    if (!response.ok) return notify(data.error || "Project could not be deleted");
    setSelected(null);
    setDetail(null);
    await loadProjects();
    notify("Project permanently deleted");
  }

  async function reviewAccess(id: string, decision: "approve" | "reject") {
    const response = await fetch(`/api/admin-access/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ decision }),
    });
    if (!response.ok) return notify("Access request could not be updated");
    setAccessRequests((current) => current.filter((request) => request.id !== id));
    notify(decision === "approve" ? "Administrator approved" : "Request rejected");
  }

  const filtered = projects.filter((p) => `${p.title} ${p.client} ${p.location}`.toLowerCase().includes(query.toLowerCase()));
  const totalBytes = projects.reduce((sum, project) => sum + Number(project.total_bytes || 0), 0);

  return (
    <main className="admin-shell">
      <header className="admin-topbar">
        <a className="brand" href="/"><span className="brand-mark">W</span><span>WALKOVER</span></a>
        <nav><a href="/">Welcome page</a><a className="active" href="/admin">Admin</a></nav>
        <div className="admin-account"><span><b>{displayName(user.name)}</b><small>{user.email}</small></span><div className="avatar">{initials(user.name)}</div></div>
      </header>

      <section className="admin-hero">
        <div><p>WORKSPACE ADMINISTRATION</p><h1>Projects</h1><span>Create, manage and securely share your highway site records.</span></div>
        <button className="primary create-button" onClick={() => setShowCreate(true)}>＋ New project</button>
      </section>

      <section className="admin-metrics">
        <div><span>PROJECTS</span><b>{projects.length}</b><small>{projects.filter((p) => p.status === "published").length} shared</small></div>
        <div><span>REALITY CAPTURES</span><b>{projects.reduce((s, p) => s + Number(p.file_count || 0), 0)}</b><small>Models, photos & metadata</small></div>
        <div><span>STORAGE</span><b>{formatBytes(totalBytes)}</b><small>Across all projects</small></div>
        <div><span>ACTIVE SHARE LINKS</span><b>{projects.reduce((s, p) => s + Number(p.share_count || 0), 0)}</b><small>Time-limited access</small></div>
      </section>

      <section className="admin-content">
        <div className="projects-pane">
          <div className="admin-toolbar">
            <label>⌕<input placeholder="Search projects, clients or locations" value={query} onChange={(e) => setQuery(e.target.value)} /></label>
            <button onClick={loadProjects}>↻ Refresh</button>
          </div>
          <div className="project-table">
            <div className="project-row table-head"><span>Project</span><span>Survey</span><span>Files</span><span>Status</span><span /></div>
            {loading && <div className="empty-state">Loading your projects…</div>}
            {!loading && !filtered.length && <div className="empty-state"><b>No projects found</b><span>Create a project to upload your first Polycam export.</span></div>}
            {filtered.map((project) => (
              <button key={project.id} className={`project-row ${selected === project.id ? "selected" : ""}`} onClick={() => loadDetail(project.id)}>
                <span className="project-identity"><i>{project.title.slice(0,2).toUpperCase()}</i><span><b>{project.title}</b><small>{project.client} · {project.location}</small></span></span>
                <span><b>{formatDate(project.survey_date)}</b><small>Site walkover</small></span>
                <span><b>{project.file_count}</b><small>{formatBytes(project.total_bytes || 0)}</small></span>
                <span><em className={`project-status ${project.status}`}>{project.status}</em></span>
                <span>›</span>
              </button>
            ))}
          </div>
          {accessRequests.length > 0 && <div className="access-requests">
            <div className="section-title"><b>ADMIN ACCESS REQUESTS</b><span>{accessRequests.length}</span></div>
            {accessRequests.map((request) => <article key={request.id}>
              <div><b>{request.display_name}</b><small>{request.email} · {request.organisation}</small><p>{request.reason}</p></div>
              <button onClick={() => reviewAccess(request.id, "reject")}>Reject</button>
              <button className="approve" onClick={() => reviewAccess(request.id, "approve")}>Approve</button>
            </article>)}
          </div>}
        </div>

        <aside className={`project-drawer ${detail ? "open" : ""}`}>
          {!detail ? <div className="drawer-empty"><span>▱</span><h2>Select a project</h2><p>Choose a project to manage its files and share links.</p></div> : (
            <>
              <div className="drawer-head"><div><span>PROJECT DETAILS</span><h2>{detail.project.title}</h2><p>{detail.project.client} · {detail.project.location}</p></div><button onClick={() => { setDetail(null); setSelected(null); }}>×</button></div>
              <div className="drawer-actions">
                <a href={detail.project.title === "A54 Highway Site Walkover" ? "/prototype" : detail.shares[0] ? `/share/${detail.shares[0].token}` : "#"}>▱ Open viewer</a>
                <button className="primary" onClick={makeShareLink} disabled={busy === "share"}>↗ {busy === "share" ? "Creating…" : "Create share link"}</button>
              </div>
              <div className="management-actions">
                <button onClick={() => setShowEdit(true)}>✎ Edit title & metadata</button>
                <button className="danger" onClick={deleteProject} disabled={busy === "delete"}>{busy === "delete" ? "Deleting…" : "⌫ Delete project"}</button>
              </div>
              <div className="drawer-section">
                <div className="section-title"><b>PROJECT FILES</b><span>{detail.files.length}</span></div>
                <div className="file-list">
                  {detail.files.map((file) => <div key={file.id}><i>{file.kind === "model" ? "3D" : file.kind === "photo" ? "IMG" : "DOC"}</i><span><b>{file.filename}</b><small>{file.kind} · {formatBytes(file.size)}</small></span></div>)}
                  {!detail.files.length && <p className="muted">No files uploaded yet.</p>}
                </div>
                <form className="upload-box" onSubmit={uploadFiles}>
                  <label>＋ Add exports, photos or metadata<input name="files" type="file" multiple accept=".glb,.gltf,.obj,.las,.laz,.jpg,.jpeg,.png,.csv,.json,.geojson" required /></label>
                  <button disabled={busy === "upload"}>{busy === "upload" ? "Uploading…" : "Upload selected"}</button>
                  <small>GLB/GLTF · OBJ · LAS/LAZ · JPG/PNG · CSV/JSON · 250 MB per file</small>
                </form>
              </div>
              <div className="drawer-section">
                <div className="section-title"><b>SHARE LINKS</b><span>{detail.shares.length}</span></div>
                {!detail.shares.length && <p className="muted">No share links yet. Create one when this project is ready for review.</p>}
                {detail.shares.map((share) => <div className="share-row" key={share.id}><span><b>{share.label}</b><small>Project code {formatProjectCode(share.token)} · Expires {new Date(share.expires_at).toLocaleDateString("en-GB")}</small></span><button onClick={async () => { await navigator.clipboard.writeText(formatProjectCode(share.token)); notify("Project code copied"); }}>Copy code</button><button onClick={async () => { await navigator.clipboard.writeText(`${window.location.origin}/share/${share.token}`); notify("Link copied"); }}>Copy link</button></div>)}
              </div>
            </>
          )}
        </aside>
      </section>

      {showCreate && <div className="modal-backdrop" onMouseDown={() => setShowCreate(false)}>
        <form className="create-modal" onSubmit={createProject} onMouseDown={(e) => e.stopPropagation()}>
          <div className="modal-head"><div><span>NEW HIGHWAY SITE RECORD</span><h2>Create project</h2></div><button type="button" onClick={() => setShowCreate(false)}>×</button></div>
          <div className="form-grid">
            <label className="full">Project name<input name="title" placeholder="e.g. A51 Junction Improvement" required autoFocus /></label>
            <label>Client<input name="client" placeholder="Local authority / client" /></label>
            <label>Survey date<input name="surveyDate" type="date" required /></label>
            <label className="full">Location<input name="location" placeholder="Road, town or coordinates" /></label>
            <label className="full">Description<textarea name="description" placeholder="Purpose, scheme limits and relevant context" /></label>
            <label className="full model-drop">Initial Polycam export<input name="model" type="file" accept=".glb,.gltf" /><span>Choose a GLB or GLTF model</span><small>Optional · up to 250 MB</small></label>
          </div>
          <div className="modal-actions"><button type="button" onClick={() => setShowCreate(false)}>Cancel</button><button className="primary" disabled={busy === "create"}>{busy === "create" ? "Creating project…" : "Create project"}</button></div>
        </form>
      </div>}
      {showEdit && detail && <div className="modal-backdrop" onMouseDown={() => setShowEdit(false)}>
        <form className="create-modal" onSubmit={editProject} onMouseDown={(e) => e.stopPropagation()}>
          <div className="modal-head"><div><span>PROJECT ADMINISTRATION</span><h2>Edit project details</h2></div><button type="button" onClick={() => setShowEdit(false)}>×</button></div>
          <div className="form-grid">
            <label className="full">Project name<input name="title" defaultValue={detail.project.title} required autoFocus /></label>
            <label>Client<input name="client" defaultValue={detail.project.client} /></label>
            <label>Survey date<input name="surveyDate" type="date" defaultValue={detail.project.survey_date} required /></label>
            <label className="full">Location<input name="location" defaultValue={detail.project.location} /></label>
            <label className="full">Description<textarea name="description" defaultValue={detail.project.description} /></label>
          </div>
          <div className="modal-actions"><button type="button" onClick={() => setShowEdit(false)}>Cancel</button><button className="primary" disabled={busy === "edit"}>{busy === "edit" ? "Saving…" : "Save changes"}</button></div>
        </form>
      </div>}
      {toast && <div className="toast">{toast}</div>}
    </main>
  );
}

function formatBytes(value: number) {
  if (!value) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), 3);
  return `${(value / 1024 ** index).toFixed(index > 1 ? 1 : 0)} ${units[index]}`;
}
function formatDate(value: string) { return new Date(`${value}T12:00:00`).toLocaleDateString("en-GB", { day:"numeric", month:"short", year:"numeric" }); }
function displayName(value: string) { return value.includes("@") ? value.split("@")[0] : value; }
function initials(value: string) { return displayName(value).split(/\s|[._-]/).filter(Boolean).slice(0,2).map((part) => part[0]).join("").toUpperCase(); }
