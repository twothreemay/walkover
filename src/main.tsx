import React, { FormEvent, PointerEvent as ReactPointerEvent, useCallback, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "@google/model-viewer";
import "./styles.css";

type Organisation = { id: string; name: string; type: string; branding: string };
type Place = { id: string; organisationId: string; name: string; placeType: string; location: string; description: string };
type Project = { id: string; placeId: string; organisationId: string; title: string; reference: string; status: string; description: string; startDate: string };
type Walkover = { id: string; projectId: string; title: string; surveyDate: string; surveyType: string; surveyor: string; captureMethod: string; notes: string };
type FileRecord = { id: string; walkoverId: string; projectId: string; filename: string; contentType: string; size: number; kind: string; url?: string };
type Observation = { id: string; walkoverId: string; title: string; category: string; recordType: string; status: string; notes: string; assignee: string; dueDate: string };
type Share = { token: string; code: string; projectId: string; label: string; expiresAt: string; revoked: boolean };
type HistoryItem = { id: string; type: string; action: string; actor: string; summary: string; createdAt: string };
type SharedTwin = { organisation: Organisation | null; place: Place | null; project: Project; walkovers: Walkover[]; files: FileRecord[]; observations: Observation[] };
type MeasurePoint = { position: string; x: number; y: number; z: number };

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, { ...init, credentials: "same-origin" });
  const data = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error || "The request could not be completed");
  return data as T;
}

function App() {
  const [path, setPath] = useState(location.pathname);
  const navigate = (next: string) => { history.pushState({}, "", next); setPath(next); scrollTo(0, 0); };
  useEffect(() => {
    const pop = () => setPath(location.pathname);
    addEventListener("popstate", pop);
    return () => removeEventListener("popstate", pop);
  }, []);
  if (path === "/admin") return <AdminGate navigate={navigate} />;
  if (path.startsWith("/share/")) return <TwinViewer token={decodeURIComponent(path.slice(7))} navigate={navigate} />;
  return <Welcome navigate={navigate} />;
}

function Welcome({ navigate }: { navigate: (path: string) => void }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  function cleanCode(value: string) { return value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 10); }
  async function submit(event: FormEvent) {
    event.preventDefault(); if (code.length !== 10) return;
    setBusy(true); setError("");
    try {
      const result = await api<{ token: string }>(`/project-code/${code}`);
      navigate(`/share/${result.token}`);
    } catch (reason) { setError(message(reason)); }
    finally { setBusy(false); }
  }
  return <main className="welcome-shell">
    <Header navigate={navigate}><button className="ghost-button" onClick={() => navigate("/admin")}>Admin access <span>→</span></button></Header>
    <section className="welcome-hero">
      <div className="hero-copy">
        <span className="eyebrow">PLACE-BASED DIGITAL TWIN PLATFORM</span>
        <h1>A shared digital record of places.</h1>
        <p className="hero-proposition">Bringing together reality capture, design information, inspections, assets and change over time.</p>
        <div className="audience">For local authorities · engineering consultants · asset owners</div>
      </div>
      <form className="access-card" onSubmit={submit}>
        <span className="eyebrow">SHARED ACCESS</span>
        <h2>Open a place record</h2>
        <p>Enter the 10-character code supplied by your project administrator.</p>
        <label htmlFor="place-code">ACCESS CODE</label>
        <input id="place-code" inputMode="text" autoComplete="off" value={code} onChange={(event) => { setCode(cleanCode(event.target.value)); setError(""); }} placeholder="AB12CD34EF" maxLength={10} />
        <div className="code-progress"><span>{code.length}/10</span><i style={{ width: `${code.length * 10}%` }} /></div>
        {error && <div className="form-error" role="alert">{error}</div>}
        <button className="primary-button" disabled={code.length !== 10 || busy}>{busy ? "Checking access…" : "Open TwinPlace"} <span>→</span></button>
      </form>
    </section>
    <section className="product-story">
      <div><span>01</span><h2>Capture the place</h2><p>Bring Polycam and other reality models, site photographs and walkover records into one controlled place record.</p></div>
      <div><span>02</span><h2>Connect the work</h2><p>Organise projects, design models, documents, observations and inspections around the geography they describe.</p></div>
      <div><span>03</span><h2>Build the history</h2><p>Retain each survey and decision over time, creating the foundations for a useful, evolving digital twin.</p></div>
    </section>
    <footer><span>TwinPlaces</span><span>Reality · Design · Assets · Change</span></footer>
  </main>;
}

function AdminGate({ navigate }: { navigate: (path: string) => void }) {
  const [state, setState] = useState<"checking" | "signed-out" | "signed-in">("checking");
  const [username, setUsername] = useState("");
  useEffect(() => { api<{ username: string }>("/auth/session").then((data) => { setUsername(data.username); setState("signed-in"); }).catch(() => setState("signed-out")); }, []);
  if (state === "checking") return <Loading label="Checking secure session…" />;
  if (state === "signed-out") return <Login navigate={navigate} onLogin={(name) => { setUsername(name); setState("signed-in"); }} />;
  return <Admin navigate={navigate} username={username} onLogout={async () => { await api("/auth/logout", { method: "POST" }); setState("signed-out"); }} />;
}

function Login({ navigate, onLogin }: { navigate: (path: string) => void; onLogin: (username: string) => void }) {
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const form = new FormData(event.currentTarget);
    try {
      const result = await api<{ username: string }>("/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: form.get("username"), password: form.get("password") }) });
      onLogin(result.username);
    } catch (reason) { setError(message(reason)); }
    finally { setBusy(false); }
  }
  return <main className="login-shell"><Header navigate={navigate} /><form className="login-card" onSubmit={submit}>
    <span className="eyebrow">TWINPLACES ADMINISTRATION</span><h1>Sign in</h1><p>Use the administrator credentials configured securely in Azure.</p>
    <label>Username<input name="username" autoComplete="username" required /></label>
    <label>Password<input name="password" type="password" autoComplete="current-password" required /></label>
    {error && <div className="form-error">{error}</div>}
    <button className="primary-button" disabled={busy}>{busy ? "Signing in…" : "Sign in"} <span>→</span></button>
  </form></main>;
}

function Admin({ navigate, username, onLogout }: { navigate: (path: string) => void; username: string; onLogout: () => void }) {
  const [organisations, setOrganisations] = useState<Organisation[]>([]);
  const [places, setPlaces] = useState<Place[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [walkovers, setWalkovers] = useState<Walkover[]>([]);
  const [selectedWalkover, setSelectedWalkover] = useState<Walkover | null>(null);
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [observations, setObservations] = useState<Observation[]>([]);
  const [shares, setShares] = useState<Share[]>([]);
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
  const [modal, setModal] = useState<"organisation" | "place" | "project" | "walkover" | null>(null);
  const [editTarget, setEditTarget] = useState<{ type: "organisation" | "place"; item: Organisation | Place } | null>(null);
  const [error, setError] = useState("");

  const loadBase = useCallback(async () => {
    try {
      const [orgData, placeData, projectData] = await Promise.all([
        api<{ organisations: Organisation[] }>("/organisations"), api<{ places: Place[] }>("/places"), api<{ projects: Project[] }>("/projects")
      ]);
      setOrganisations(orgData.organisations); setPlaces(placeData.places); setProjects(projectData.projects);
    } catch (reason) { setError(message(reason)); }
  }, []);
  useEffect(() => { loadBase(); }, [loadBase]);

  const selectProject = useCallback(async (project: Project) => {
    setSelectedProject(project); setSelectedWalkover(null); setError("");
    try {
      const [walkData, shareData, timeline] = await Promise.all([
        api<{ walkovers: Walkover[] }>(`/projects/${project.id}/walkovers`),
        api<{ shares: Share[] }>(`/projects/${project.id}/shares`),
        api<{ history: HistoryItem[] }>(`/history/${project.id}`)
      ]);
      setWalkovers(walkData.walkovers.sort((a, b) => b.surveyDate.localeCompare(a.surveyDate))); setShares(shareData.shares); setHistoryItems(timeline.history.reverse());
    } catch (reason) { setError(message(reason)); }
  }, []);

  const selectWalkover = useCallback(async (walkover: Walkover) => {
    setSelectedWalkover(walkover);
    try {
      const [fileData, observationData] = await Promise.all([
        api<{ files: FileRecord[] }>(`/walkovers/${walkover.id}/files`),
        api<{ observations: Observation[] }>(`/walkovers/${walkover.id}/observations`)
      ]);
      setFiles(fileData.files); setObservations(observationData.observations);
    } catch (reason) { setError(message(reason)); }
  }, []);

  function choosePlace(place: Place) {
    setSelectedPlace(place); setSelectedProject(null); setSelectedWalkover(null);
  }
  async function submitEntity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!modal) return;
    const form = new FormData(event.currentTarget);
    const body = Object.fromEntries(form.entries());
    try {
      if (modal === "organisation") await api("/organisations", { method: "POST", headers: jsonHeaders, body: JSON.stringify(body) });
      if (modal === "place") await api("/places", { method: "POST", headers: jsonHeaders, body: JSON.stringify({ ...body, organisationId: form.get("organisationId") }) });
      if (modal === "project") {
        const result = await api<{ project: Project }>("/projects", { method: "POST", headers: jsonHeaders, body: JSON.stringify({ ...body, placeId: selectedPlace?.id, organisationId: selectedPlace?.organisationId }) });
        await selectProject(result.project);
      }
      if (modal === "walkover") {
        if (!selectedProject) return;
        const result = await api<{ walkover: Walkover }>(`/projects/${selectedProject.id}/walkovers`, { method: "POST", headers: jsonHeaders, body: JSON.stringify(body) });
        await selectProject(selectedProject); await selectWalkover(result.walkover);
      }
      setModal(null); await loadBase();
    } catch (reason) { setError(message(reason)); }
  }
  async function submitEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!editTarget) return;
    const body = Object.fromEntries(new FormData(event.currentTarget).entries());
    try {
      if (editTarget.type === "organisation") {
        await api(`/organisations/${editTarget.item.id}`, { method: "PATCH", headers: jsonHeaders, body: JSON.stringify(body) });
      } else {
        const place = editTarget.item as Place;
        await api(`/places/${place.organisationId}/${place.id}`, { method: "PATCH", headers: jsonHeaders, body: JSON.stringify(body) });
        if (selectedPlace?.id === place.id) setSelectedPlace({ ...place, ...body } as Place);
      }
      setEditTarget(null); await loadBase();
    } catch (reason) { setError(message(reason)); }
  }
  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!selectedWalkover || !selectedProject) return;
    const form = new FormData(event.currentTarget); form.set("projectId", selectedProject.id);
    try { await api(`/walkovers/${selectedWalkover.id}/files`, { method: "POST", body: form }); event.currentTarget.reset(); await selectWalkover(selectedWalkover); }
    catch (reason) { setError(message(reason)); }
  }
  async function addRecord(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!selectedWalkover) return;
    const form = new FormData(event.currentTarget);
    try {
      await api(`/walkovers/${selectedWalkover.id}/observations`, { method: "POST", headers: jsonHeaders, body: JSON.stringify(Object.fromEntries(form.entries())) });
      event.currentTarget.reset(); await selectWalkover(selectedWalkover);
    } catch (reason) { setError(message(reason)); }
  }
  async function createShare(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!selectedProject) return;
    const form = new FormData(event.currentTarget);
    try { await api(`/projects/${selectedProject.id}/shares`, { method: "POST", headers: jsonHeaders, body: JSON.stringify(Object.fromEntries(form.entries())) }); event.currentTarget.reset(); await selectProject(selectedProject); }
    catch (reason) { setError(message(reason)); }
  }
  async function revokeShare(token: string) {
    try { await api(`/shares/${token}`, { method: "DELETE" }); if (selectedProject) await selectProject(selectedProject); }
    catch (reason) { setError(message(reason)); }
  }

  const placeProjects = projects.filter((project) => project.placeId === selectedPlace?.id);
  return <main className="admin-shell">
    <Header navigate={navigate}><div className="admin-user"><span>{username}</span><button onClick={onLogout}>Sign out</button></div></Header>
    <div className="admin-bar"><div><span className="eyebrow">TWINPLACES ADMINISTRATION</span><h1>Places</h1><p>Manage shared place records, projects, walkovers and information over time.</p></div><div className="admin-create"><button onClick={() => setModal("organisation")}>＋ Organisation</button><button onClick={() => setModal("place")}>＋ Place</button></div></div>
    {error && <div className="admin-error">{error}<button onClick={() => setError("")}>×</button></div>}
    <div className="admin-workspace">
      <aside className="place-browser">
        <div className="pane-title"><span>PLACE DIRECTORY</span><b>{places.length}</b></div>
        {organisations.map((organisation) => <div className="organisation-group" key={organisation.id}>
          <div className="organisation-title"><span><h2>{organisation.name}</h2><small>{organisation.type}</small></span><button aria-label={`Edit ${organisation.name}`} onClick={() => setEditTarget({ type: "organisation", item: organisation })}>Edit</button></div>
          {places.filter((place) => place.organisationId === organisation.id).map((place) => <button className={selectedPlace?.id === place.id ? "active" : ""} key={place.id} onClick={() => choosePlace(place)}><i>⌖</i><span><b>{place.name}</b><small>{place.placeType} · {place.location}</small></span></button>)}
        </div>)}
      </aside>
      <section className="place-main">
        {!selectedPlace ? <EmptyState title="Select a place" text="A place is the long-term container for projects, surveys, models, assets and inspections." /> : <>
          <div className="place-heading"><div><span>{selectedPlace.placeType.toUpperCase()}</span><h2>{selectedPlace.name}</h2><p>{selectedPlace.description || selectedPlace.location}</p></div><div className="place-actions"><button onClick={() => setEditTarget({ type: "place", item: selectedPlace })}>Edit place</button><button className="primary-button compact" onClick={() => setModal("project")}>＋ Project</button></div></div>
          <div className="place-tabs"><button className="active">Projects</button><button disabled>Assets <em>Future</em></button><button disabled>Inspections <em>Future</em></button><button disabled>Design models <em>Future</em></button></div>
          <div className="project-cards">
            {placeProjects.map((project) => <button className={selectedProject?.id === project.id ? "active" : ""} key={project.id} onClick={() => selectProject(project)}><span>{project.status}</span><h3>{project.title}</h3><p>{project.reference || "No project reference"}</p><small>{walkovers.filter((item) => item.projectId === project.id).length} survey records</small></button>)}
            {!placeProjects.length && <EmptyState title="No projects yet" text="Create the first project beneath this place." />}
          </div>
          {selectedProject && <ProjectWorkspace project={selectedProject} walkovers={walkovers} selectedWalkover={selectedWalkover} files={files} observations={observations} shares={shares} historyItems={historyItems} onAddWalkover={() => setModal("walkover")} onSelectWalkover={selectWalkover} onUpload={upload} onAddRecord={addRecord} onCreateShare={createShare} onRevokeShare={revokeShare} />}
        </>}
      </section>
    </div>
    {modal && <EntityModal type={modal} organisations={organisations} selectedPlace={selectedPlace} onClose={() => setModal(null)} onSubmit={submitEntity} />}
    {editTarget && <EditEntityModal target={editTarget} onClose={() => setEditTarget(null)} onSubmit={submitEdit} />}
  </main>;
}

function ProjectWorkspace(props: {
  project: Project; walkovers: Walkover[]; selectedWalkover: Walkover | null; files: FileRecord[]; observations: Observation[]; shares: Share[]; historyItems: HistoryItem[];
  onAddWalkover: () => void; onSelectWalkover: (item: Walkover) => void; onUpload: (event: FormEvent<HTMLFormElement>) => void; onAddRecord: (event: FormEvent<HTMLFormElement>) => void; onCreateShare: (event: FormEvent<HTMLFormElement>) => void; onRevokeShare: (token: string) => void;
}) {
  return <section className="project-workspace">
    <div className="project-workspace-head"><div><span>PROJECT DASHBOARD</span><h2>{props.project.title}</h2><p>{props.project.description}</p></div><button onClick={props.onAddWalkover}>＋ Add site walkover</button></div>
    <div className="project-columns">
      <div className="survey-timeline"><div className="section-title"><h3>Surveys & records</h3><span>{props.walkovers.length}</span></div>
        {props.walkovers.map((item) => <button className={props.selectedWalkover?.id === item.id ? "active" : ""} key={item.id} onClick={() => props.onSelectWalkover(item)}><i /><span><b>{item.title}</b><small>{item.surveyDate} · {item.surveyType}</small></span></button>)}
        {!props.walkovers.length && <p className="muted">No site walkovers recorded.</p>}
        <div className="history-block"><h3>Project history</h3>{props.historyItems.slice(0, 6).map((item) => <div key={item.id}><b>{item.action}</b><span>{item.summary}</span><small>{new Date(item.createdAt).toLocaleDateString("en-GB")}</small></div>)}</div>
      </div>
      <div className="record-detail">
        {!props.selectedWalkover ? <EmptyState title="Select a survey" text="Review its reality models, documents, observations and actions." /> : <>
          <div className="survey-meta"><span>SITE WALKOVER</span><h3>{props.selectedWalkover.title}</h3><dl><dt>Date</dt><dd>{props.selectedWalkover.surveyDate}</dd><dt>Surveyor</dt><dd>{props.selectedWalkover.surveyor || "Not recorded"}</dd><dt>Capture</dt><dd>{props.selectedWalkover.captureMethod || "Not recorded"}</dd></dl></div>
          <div className="management-section"><h3>Models, images & documents</h3>{props.files.map((file) => <div className="data-row" key={file.id}><span><b>{file.filename}</b><small>{file.kind} · {formatBytes(file.size)}</small></span></div>)}
            <form className="upload-form" onSubmit={props.onUpload}><input name="file" type="file" required /><select name="kind"><option>Reality model</option><option>Design model</option><option>Image</option><option>Document</option></select><button>Upload</button></form>
          </div>
          <div className="management-section"><h3>Observations & actions</h3>{props.observations.map((item) => <div className="data-row" key={item.id}><span><b>{item.title}</b><small>{item.recordType} · {item.category} · {item.status}</small></span></div>)}
            <form className="record-form" onSubmit={props.onAddRecord}><input name="title" required placeholder="Record title" /><select name="recordType"><option>Observation</option><option>Action</option></select><input name="category" placeholder="Category" /><input name="assignee" placeholder="Assignee" /><button>Add record</button></form>
          </div>
          <div className="management-section"><h3>Share codes</h3>{props.shares.map((share) => <div className="data-row" key={share.token}><span><b>{share.code}</b><small>{share.label} · {share.revoked ? "Revoked" : `Expires ${new Date(share.expiresAt).toLocaleDateString("en-GB")}`}</small></span>{!share.revoked && <button onClick={() => props.onRevokeShare(share.token)}>Revoke</button>}</div>)}
            <form className="share-form" onSubmit={props.onCreateShare}><input name="code" required minLength={10} maxLength={10} pattern="[A-Za-z0-9]{10}" onInput={(event) => { event.currentTarget.value = sanitiseCode(event.currentTarget.value); }} placeholder="AB12CD34EF" /><input name="label" placeholder="Recipient label" /><button>Create code</button></form>
          </div>
        </>}
      </div>
    </div>
  </section>;
}

function EntityModal({ type, organisations, selectedPlace, onClose, onSubmit }: { type: "organisation" | "place" | "project" | "walkover"; organisations: Organisation[]; selectedPlace: Place | null; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return <div className="modal"><form className="entity-modal" onSubmit={onSubmit}>
    <div className="modal-head"><div><span>CREATE RECORD</span><h2>New {type === "walkover" ? "site walkover" : type}</h2></div><button type="button" onClick={onClose}>×</button></div>
    {type === "organisation" && <><label>Name<input name="name" required /></label><label>Organisation type<select name="type"><option>Local authority</option><option>Consultant</option><option>Asset owner</option><option>Developer</option></select></label><label>Branding note<input name="branding" placeholder="Reserved for future branding settings" /></label></>}
    {type === "place" && <><label>Organisation<select name="organisationId" required><option value="">Select…</option>{organisations.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>Place name<input name="name" required /></label><label>Place type<select name="placeType"><option>Street</option><option>Highway corridor</option><option>Junction</option><option>Town centre</option><option>Development site</option><option>Public-realm scheme</option><option>Local-authority area</option></select></label><label>Location<input name="location" /></label><label>Description<textarea name="description" /></label></>}
    {type === "project" && <><div className="context-note">Place: <b>{selectedPlace?.name}</b></div><label>Project title<input name="title" required /></label><label>Reference<input name="reference" /></label><label>Status<select name="status"><option>Active</option><option>Planning</option><option>Completed</option><option>Archived</option></select></label><label>Start date<input name="startDate" type="date" /></label><label>Description<textarea name="description" /></label></>}
    {type === "walkover" && <><label>Record title<input name="title" required placeholder="July 2026 site walkover" /></label><label>Survey date<input name="surveyDate" type="date" required /></label><label>Survey type<select name="surveyType"><option>Site walkover</option><option>Condition survey</option><option>Inspection</option><option>Reality capture</option></select></label><label>Surveyor<input name="surveyor" /></label><label>Capture method<input name="captureMethod" placeholder="Polycam LiDAR / photogrammetry" /></label><label>Notes<textarea name="notes" /></label></>}
    <div className="modal-actions"><button type="button" onClick={onClose}>Cancel</button><button className="primary-button compact">Create</button></div>
  </form></div>;
}

function EditEntityModal({ target, onClose, onSubmit }: { target: { type: "organisation" | "place"; item: Organisation | Place }; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  const organisation = target.type === "organisation" ? target.item as Organisation : null;
  const place = target.type === "place" ? target.item as Place : null;
  return <div className="modal"><form className="entity-modal" onSubmit={onSubmit}>
    <div className="modal-head"><div><span>EDIT RECORD</span><h2>Edit {target.type}</h2></div><button type="button" onClick={onClose}>×</button></div>
    {organisation && <><label>Name<input name="name" required defaultValue={organisation.name} /></label><label>Organisation type<input name="type" defaultValue={organisation.type} /></label><label>Branding note<input name="branding" defaultValue={organisation.branding} /></label></>}
    {place && <><label>Place name<input name="name" required defaultValue={place.name} /></label><label>Place type<input name="placeType" defaultValue={place.placeType} /></label><label>Location<input name="location" defaultValue={place.location} /></label><label>Description<textarea name="description" defaultValue={place.description} /></label></>}
    <div className="modal-actions"><button type="button" onClick={onClose}>Cancel</button><button className="primary-button compact">Save changes</button></div>
  </form></div>;
}

function TwinViewer({ token, navigate }: { token: string; navigate: (path: string) => void }) {
  const [data, setData] = useState<SharedTwin | null>(null); const [error, setError] = useState("");
  const [activeWalkover, setActiveWalkover] = useState<Walkover | null>(null);
  useEffect(() => { api<SharedTwin>(`/shares/${encodeURIComponent(token)}`).then((result) => { setData(result); setActiveWalkover([...result.walkovers].sort((a, b) => b.surveyDate.localeCompare(a.surveyDate))[0] || null); }).catch((reason) => setError(message(reason))); }, [token]);
  if (error) return <ErrorPage navigate={navigate} text={error} />;
  if (!data) return <Loading label="Opening shared place…" />;
  const files = data.files.filter((item) => item.walkoverId === activeWalkover?.id);
  const observations = data.observations.filter((item) => item.walkoverId === activeWalkover?.id);
  const model = files.find((item) => item.kind === "Reality model");
  return <main className="viewer-shell"><Header navigate={navigate}><button className="ghost-button" onClick={() => navigate("/")}>Exit shared record →</button></Header>
    <section className="viewer-title"><div><span>{data.place?.placeType || "PLACE RECORD"}</span><h1>{data.place?.name || data.project.title}</h1><p>{data.project.title} · {activeWalkover?.surveyDate || "No survey selected"}</p></div><div className="record-badge">DIGITAL PLACE RECORD</div></section>
    <div className="viewer-layout"><section className="model-panel"><div className="viewer-toolbar"><b>{model?.filename || "No reality model"}</b></div><MeasurementViewer src={model?.url || ""} /></section>
      <aside className="viewer-info"><span>PLACE & PROJECT</span><h2>{data.project.title}</h2><p>{data.project.description}</p><dl><dt>Organisation</dt><dd>{data.organisation?.name || "Not supplied"}</dd><dt>Place</dt><dd>{data.place?.name || "Not supplied"}</dd><dt>Survey records</dt><dd>{data.walkovers.length}</dd><dt>Observations</dt><dd>{observations.length}</dd></dl><h3>Previous surveys</h3>{data.walkovers.map((walkover) => <button className={activeWalkover?.id === walkover.id ? "active" : ""} key={walkover.id} onClick={() => setActiveWalkover(walkover)}><b>{walkover.title}</b><small>{walkover.surveyDate}</small></button>)}</aside>
    </div></main>;
}

function MeasurementViewer({ src }: { src: string }) {
  const viewerRef = useRef<HTMLElement | null>(null); const stageRef = useRef<HTMLDivElement | null>(null);
  const [placing, setPlacing] = useState(false); const [points, setPoints] = useState<MeasurePoint[]>([]);
  const [line, setLine] = useState({ x1: 0, y1: 0, x2: 0, y2: 0, visible: false });
  useEffect(() => {
    let frame = 0;
    const update = () => {
      const stage = stageRef.current?.getBoundingClientRect();
      const markers = stageRef.current?.querySelectorAll<HTMLElement>(".measure-marker");
      if (stage && markers?.length === 2) {
        const a = markers[0].getBoundingClientRect(); const b = markers[1].getBoundingClientRect();
        setLine({ x1: a.left + a.width / 2 - stage.left, y1: a.top + a.height / 2 - stage.top, x2: b.left + b.width / 2 - stage.left, y2: b.top + b.height / 2 - stage.top, visible: true });
      } else setLine((current) => current.visible ? { ...current, visible: false } : current);
      frame = requestAnimationFrame(update);
    };
    frame = requestAnimationFrame(update); return () => cancelAnimationFrame(frame);
  }, []);
  function hit(clientX: number, clientY: number) {
    return (viewerRef.current as unknown as { positionAndNormalFromPoint?: (x: number, y: number) => { position: { x: number; y: number; z: number } } })?.positionAndNormalFromPoint?.(clientX, clientY);
  }
  function choose(event: React.MouseEvent<HTMLElement>) {
    if (!placing || points.length >= 2) return;
    const result = hit(event.clientX, event.clientY); if (!result) return;
    const { x, y, z } = result.position; setPoints((current) => [...current, point(x, y, z)]); if (points.length === 1) setPlacing(false);
  }
  function drag(index: number, event: ReactPointerEvent<HTMLButtonElement>) {
    event.preventDefault(); event.stopPropagation(); event.currentTarget.setPointerCapture(event.pointerId);
    const move = (pointer: PointerEvent) => {
      const result = hit(pointer.clientX, pointer.clientY); if (!result) return;
      const { x, y, z } = result.position; setPoints((current) => current.map((item, itemIndex) => itemIndex === index ? point(x, y, z) : item));
    };
    const up = () => { removeEventListener("pointermove", move); removeEventListener("pointerup", up); };
    addEventListener("pointermove", move); addEventListener("pointerup", up);
  }
  const distance = points.length === 2 ? Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y, points[1].z - points[0].z) : null;
  return <div className="model-stage" ref={stageRef}>
    {src ? React.createElement("model-viewer", { ref: viewerRef, src, "camera-controls": true, "touch-action": "pan-y", "shadow-intensity": "0.7", exposure: "1.05", "min-camera-orbit": "auto auto 0.05m", "max-camera-orbit": "auto auto 100m", onClick: choose },
      points.map((item, index) => <button key={index} className="measure-marker" slot={`hotspot-measure-${index}`} data-position={item.position} onPointerDown={(event) => drag(index, event)} aria-label={`Drag measurement point ${index + 1}`}>{index + 1}</button>)) : <div className="empty-model">No reality model is attached to this survey.</div>}
    <svg className="measurement-line" aria-hidden="true"><line x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2} opacity={line.visible ? 1 : 0} /></svg>
    <div className="measure-controls"><button className={placing ? "active" : ""} onClick={() => { setPoints([]); setPlacing(true); }}>{points.length === 2 ? "Replace measurement" : "Measure"}</button>{points.length > 0 && <button onClick={() => { setPoints([]); setPlacing(false); }}>Clear</button>}</div>
    {distance !== null && <div className="distance-label">{distance.toFixed(2)} m</div>}
    <div className="viewer-help">{placing ? `${points.length}/2 points selected` : points.length === 2 ? "Drag either numbered endpoint to update" : "Drag to orbit · Scroll to zoom · Right-drag to pan"}</div>
  </div>;
}

function Header({ navigate, children }: { navigate: (path: string) => void; children?: React.ReactNode }) {
  return <header className="site-header"><button className="brand" onClick={() => navigate("/")}><i>TP</i><span>TwinPlaces</span></button>{children}</header>;
}
function EmptyState({ title, text }: { title: string; text: string }) { return <div className="empty-state"><i>⌖</i><h2>{title}</h2><p>{text}</p></div>; }
function Loading({ label }: { label: string }) { return <main className="loading-page"><div className="brand-static"><i>TP</i><span>TwinPlaces</span></div><p>{label}</p></main>; }
function ErrorPage({ navigate, text }: { navigate: (path: string) => void; text: string }) { return <main className="loading-page"><h1>Place unavailable</h1><p>{text}</p><button className="primary-button compact" onClick={() => navigate("/")}>Return home</button></main>; }
function sanitiseCode(value: string) { return value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 10); }
function point(x: number, y: number, z: number): MeasurePoint { return { x, y, z, position: `${x}m ${y}m ${z}m` }; }
function message(reason: unknown) { return reason instanceof Error ? reason.message : "Something went wrong"; }
function formatBytes(value: number) { return value > 1048576 ? `${(value / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(value / 1024))} KB`; }
const jsonHeaders = { "content-type": "application/json" };

createRoot(document.getElementById("root")!).render(<App />);
