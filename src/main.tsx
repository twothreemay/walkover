import React, { FormEvent, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "@google/model-viewer";
import "./styles.css";

type Project = {
  id: string;
  title: string;
  client: string;
  location: string;
  surveyDate: string;
  description: string;
  code: string;
  modelUrl: string;
  modelName: string;
};

const starter: Project = {
  id: "a54-walkover-2026",
  title: "A54 Highway Site Walkover",
  client: "Internal",
  location: "A54 corridor",
  surveyDate: "2026-07-23",
  description: "Existing conditions reality capture.",
  code: "A54SW-2026A",
  modelUrl: "/23_07_2026.glb",
  modelName: "23_07_2026.glb",
};

function loadProjects(): Project[] {
  try {
    const stored = localStorage.getItem("walkover-projects");
    return stored ? JSON.parse(stored) : [starter];
  } catch {
    return [starter];
  }
}

function saveProjects(projects: Project[]) {
  localStorage.setItem("walkover-projects", JSON.stringify(projects));
}

function App() {
  const [path, setPath] = useState(window.location.pathname);
  const navigate = (next: string) => {
    history.pushState({}, "", next);
    setPath(next);
  };
  useEffect(() => {
    const onPop = () => setPath(window.location.pathname);
    addEventListener("popstate", onPop);
    return () => removeEventListener("popstate", onPop);
  }, []);

  if (path === "/admin") return <Admin navigate={navigate} />;
  if (path.startsWith("/project/")) return <ProjectViewer code={decodeURIComponent(path.slice(9))} navigate={navigate} />;
  return <Welcome navigate={navigate} />;
}

function Welcome({ navigate }: { navigate: (path: string) => void }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  function submit(event: FormEvent) {
    event.preventDefault();
    const clean = code.trim().replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
    const match = loadProjects().find((project) => project.code.replace(/[^a-zA-Z0-9]/g, "").toUpperCase() === clean);
    if (!match) return setError("That project code was not recognised.");
    navigate(`/project/${encodeURIComponent(match.code)}`);
  }
  return <main className="welcome-shell">
    <header className="welcome-top"><Brand navigate={navigate} /><button className="admin-access" onClick={() => navigate("/admin")}>Admin access →</button></header>
    <section className="welcome-panel">
      <div className="welcome-copy"><span>3D SITE RECORDS</span><h1>Return to site.<br />Without going back.</h1><p>Explore an up-to-date highway walkover, inspect the reality capture and review project information from any browser.</p></div>
      <form className="code-card" onSubmit={submit}>
        <span>PROJECT ACCESS</span><h2>Open a walkover</h2><p>Enter the code shared by your project administrator.</p>
        <label htmlFor="project-code">PROJECT CODE</label>
        <input id="project-code" value={code} onChange={(event) => { setCode(event.target.value.toUpperCase()); setError(""); }} placeholder="XXXXX–XXXXX" />
        {error && <div className="error">{error}</div>}
        <button>Open project <b>→</b></button><small>Codes are supplied with project invitations.</small>
      </form>
    </section>
    <footer><span>Walkover</span><span>Secure highway reality capture</span></footer>
  </main>;
}

function Admin({ navigate }: { navigate: (path: string) => void }) {
  const [projects, setProjects] = useState<Project[]>(loadProjects);
  const [editing, setEditing] = useState<Project | null>(null);
  function persist(next: Project[]) { setProjects(next); saveProjects(next); }
  function create() {
    const id = crypto.randomUUID();
    setEditing({ id, title: "New walkover", client: "", location: "", surveyDate: new Date().toISOString().slice(0, 10), description: "", code: id.slice(0, 10).toUpperCase(), modelUrl: "", modelName: "" });
  }
  function update(field: keyof Project, value: string) {
    if (editing) setEditing({ ...editing, [field]: value });
  }
  function save(event: FormEvent) {
    event.preventDefault();
    if (!editing) return;
    const exists = projects.some((project) => project.id === editing.id);
    persist(exists ? projects.map((project) => project.id === editing.id ? editing : project) : [editing, ...projects]);
    setEditing(null);
  }
  function upload(file?: File) {
    if (!file || !editing) return;
    update("modelName", file.name);
    setEditing((current) => current ? { ...current, modelName: file.name, modelUrl: URL.createObjectURL(file) } : current);
  }
  return <main className="admin-shell">
    <header className="welcome-top"><Brand navigate={navigate} /><button className="admin-access" onClick={() => navigate("/")}>Welcome page →</button></header>
    <section className="admin-heading"><div><span>WORKSPACE ADMINISTRATION</span><h1>Projects</h1><p>Create, edit and open your highway site records.</p></div><button className="red-button" onClick={create}>＋ New project</button></section>
    <section className="project-list">
      {projects.map((project) => <article key={project.id}>
        <div><span>{project.client || "Internal"}</span><h2>{project.title}</h2><p>{project.location} · {project.surveyDate}</p></div>
        <code>{project.code}</code>
        <button onClick={() => navigate(`/project/${encodeURIComponent(project.code)}`)}>Open</button>
        <button onClick={() => setEditing(project)}>Edit</button>
        <button className="danger" onClick={() => { if (confirm(`Delete “${project.title}”?`)) persist(projects.filter((item) => item.id !== project.id)); }}>Delete</button>
      </article>)}
    </section>
    {editing && <div className="modal"><form onSubmit={save}>
      <div className="modal-head"><div><span>PROJECT DETAILS</span><h2>{projects.some((item) => item.id === editing.id) ? "Edit project" : "Create project"}</h2></div><button type="button" onClick={() => setEditing(null)}>×</button></div>
      <label>Project title<input required value={editing.title} onChange={(event) => update("title", event.target.value)} /></label>
      <label>Client<input value={editing.client} onChange={(event) => update("client", event.target.value)} /></label>
      <label>Location<input value={editing.location} onChange={(event) => update("location", event.target.value)} /></label>
      <label>Survey date<input type="date" value={editing.surveyDate} onChange={(event) => update("surveyDate", event.target.value)} /></label>
      <label>Project code<input required value={editing.code} onChange={(event) => update("code", event.target.value.toUpperCase())} /></label>
      <label>Description<textarea value={editing.description} onChange={(event) => update("description", event.target.value)} /></label>
      <label>Polycam GLB export<input type="file" accept=".glb,.gltf" onChange={(event) => upload(event.target.files?.[0])} /></label>
      {editing.modelName && <small>Selected: {editing.modelName}</small>}
      <div className="modal-actions"><button type="button" onClick={() => setEditing(null)}>Cancel</button><button className="red-button">Save project</button></div>
    </form></div>}
  </main>;
}

function ProjectViewer({ code, navigate }: { code: string; navigate: (path: string) => void }) {
  const project = loadProjects().find((item) => item.code.toUpperCase() === code.toUpperCase());
  const viewer = useRef<HTMLElement | null>(null);
  const [measure, setMeasure] = useState(false);
  const [points, setPoints] = useState<{ position: string; x: number; y: number; z: number }[]>([]);
  if (!project) return <main className="not-found"><Brand navigate={navigate} /><h1>Project not found</h1><button onClick={() => navigate("/")}>Return to welcome page</button></main>;
  const distance = points.length === 2 ? Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y, points[1].z - points[0].z) : null;
  function select(event: React.MouseEvent<HTMLElement>) {
    if (!measure || points.length >= 2) return;
    const hit = (viewer.current as unknown as { positionAndNormalFromPoint?: (x: number, y: number) => { position: { x: number; y: number; z: number } } })?.positionAndNormalFromPoint?.(event.clientX, event.clientY);
    if (hit) {
      const { x, y, z } = hit.position;
      setPoints((current) => [...current, { x, y, z, position: `${x}m ${y}m ${z}m` }]);
    }
  }
  return <main className="viewer-shell">
    <header className="welcome-top"><Brand navigate={navigate} /><button className="admin-access" onClick={() => navigate("/")}>Exit project →</button></header>
    <section className="project-title"><div><span>PROJECT WALKOVER</span><h1>{project.title}</h1><p>{project.location} · {project.surveyDate}</p></div><code>{project.code}</code></section>
    <section className="viewer-grid">
      <div className="viewer-card"><div className="viewer-toolbar"><b>{project.modelName || "No model uploaded"}</b><button className={measure ? "active" : ""} onClick={() => { setMeasure(!measure); setPoints([]); }}>↔ {measure ? "Clear measure" : "Measure"}</button></div>
        <div className="model-stage">
          {project.modelUrl ? React.createElement("model-viewer", { ref: viewer, src: project.modelUrl, "camera-controls": true, "touch-action": "pan-y", "shadow-intensity": "0.7", exposure: "1.05", "min-camera-orbit": "auto auto 0.05m", "max-camera-orbit": "auto auto 100m", onClick: select },
            points.map((point, index) => <button key={index} className="hotspot" slot={`hotspot-${index}`} data-position={point.position}>{index + 1}</button>)) : <div className="empty-model">No 3D model has been added to this project.</div>}
          {distance !== null && <div className="distance">{distance.toFixed(2)} m</div>}
          <div className="viewer-help">{measure ? `${points.length}/2 points selected` : "Drag to orbit · Scroll to zoom · Right-drag to pan"}</div>
        </div>
        <div className="disclaimer"><b>!</b><p><strong>Visual site record — not survey grade.</strong> Measurements are indicative only and must be independently verified.</p></div>
      </div>
      <aside><span>SURVEY DETAILS</span><h2>{project.title}</h2><p>{project.description || "No project description supplied."}</p><dl><dt>Client</dt><dd>{project.client || "Not supplied"}</dd><dt>Location</dt><dd>{project.location || "Not supplied"}</dd><dt>Survey date</dt><dd>{project.surveyDate}</dd><dt>Source</dt><dd>{project.modelName || "Not uploaded"}</dd></dl></aside>
    </section>
  </main>;
}

function Brand({ navigate }: { navigate: (path: string) => void }) {
  return <button className="brand" onClick={() => navigate("/")}><i>W</i><span>WALKOVER</span></button>;
}

createRoot(document.getElementById("root")!).render(<App />);
