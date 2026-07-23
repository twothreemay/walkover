"use client";

import { useEffect, useRef, useState } from "react";

const initialIssues = [
  { id: "HW-01", type: "Pavement", title: "Carriageway surface wear", status: "Review", color: "#ed8b00" },
  { id: "HW-02", type: "Drainage", title: "Gully condition", status: "Open", color: "#2878d0" },
  { id: "HW-03", type: "Signs", title: "Sign visibility check", status: "Open", color: "#9d55c7" },
];

const categories = [
  ["All observations", "3", "#17324d"],
  ["Drainage", "1", "#2878d0"],
  ["Pavement", "1", "#ed8b00"],
  ["Signs & markings", "1", "#9d55c7"],
  ["Lighting", "0", "#e0aa2d"],
  ["Utilities", "0", "#cc5268"],
  ["Structures", "0", "#39a17e"],
  ["Safety", "0", "#d65045"],
];

export default function SiteDashboard() {
  const [activeCategory, setActiveCategory] = useState("All observations");
  const [activeTab, setActiveTab] = useState<"observations" | "details">("observations");
  const [panel, setPanel] = useState<"viewer" | "photos" | "map">("viewer");
  const [toast, setToast] = useState("");
  const [notes, setNotes] = useState("Confirm drainage outfall and arrange a targeted topographical survey before detailed design.");
  const modelName = "23_07_2026.glb";
  const [issues, setIssues] = useState(initialIssues);
  const [measureMode, setMeasureMode] = useState(false);
  const [measurePoints, setMeasurePoints] = useState<{ position: string; x: number; y: number; z: number }[]>([]);
  const modelRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    import("@google/model-viewer");
    fetch("/api/projects/a54-walkover-2026/observations")
      .then(async (response) => response.ok ? response.json() : null)
      .then((data) => {
        if (!data?.observations?.length) return;
        setIssues(data.observations.map((item: { id: string; category: string; title: string; status: string }) => ({
          id: item.id,
          type: item.category,
          title: item.title,
          status: item.status === "review" ? "Review" : "Open",
          color: item.category === "Pavement" ? "#ed8b00" : item.category === "Drainage" ? "#2878d0" : "#9d55c7",
        })));
      });
  }, []);

  function notify(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2600);
  }

  async function deleteObservation(id: string, title: string) {
    if (!window.confirm(`Delete observation “${title}”? This cannot be undone.`)) return;
    const response = await fetch(`/api/observations/${id}`, { method: "DELETE" });
    if (!response.ok) return notify("Observation could not be deleted");
    setIssues((current) => current.filter((issue) => issue.id !== id));
    notify("Observation deleted");
  }

  function toggleMeasure() {
    setPanel("viewer");
    setMeasureMode((current) => !current);
    setMeasurePoints([]);
    notify(measureMode ? "Measurement cleared" : "Select two points on the model");
  }

  function selectMeasurePoint(event: React.MouseEvent<HTMLElement>) {
    if (!measureMode || measurePoints.length >= 2) return;
    const viewer = modelRef.current as unknown as {
      positionAndNormalFromPoint?: (x: number, y: number) => { position: { x: number; y: number; z: number } } | null;
    };
    const hit = viewer?.positionAndNormalFromPoint?.(event.clientX, event.clientY);
    if (!hit) return notify("Select a visible point on the model");
    const { x, y, z } = hit.position;
    setMeasurePoints((current) => [...current, { position: `${x}m ${y}m ${z}m`, x, y, z }].slice(-2));
  }

  const measuredDistance = measurePoints.length === 2
    ? Math.hypot(measurePoints[1].x - measurePoints[0].x, measurePoints[1].y - measurePoints[0].y, measurePoints[1].z - measurePoints[0].z)
    : null;

  return (
    <main>
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">W</span>
          <span>WALKOVER</span>
          <span className="prototype">INTERNAL PROTOTYPE</span>
        </div>
        <div className="top-actions">
          <a className="admin-link" href="/">⌂ <span>Welcome</span></a>
          <button className="icon-btn" aria-label="More options">•••</button>
          <button className="secondary" onClick={() => notify("Secure share link copied")}>↗ <span>Share</span></button>
          <button className="primary" onClick={() => window.print()}>⇩ <span>Export report</span></button>
          <div className="avatar">RC</div>
        </div>
      </header>

      <section className="project-head">
        <div>
          <div className="breadcrumb">PROJECTS <span>/</span> SITE WALKOVER</div>
          <h1>A54 Highway Site Walkover</h1>
          <p className="subtitle">Existing conditions · Reality capture · 23 July 2026</p>
        </div>
        <div className="project-stats">
          <div><b>3</b><span>Observations</span></div>
          <div><b>1</b><span>Open action</span></div>
          <div><b>5.7 MB</b><span>Reality model</span></div>
        </div>
      </section>

      <nav className="view-tabs" aria-label="Project views">
        {(["viewer", "photos", "map"] as const).map((item) => (
          <button key={item} className={panel === item ? "selected" : ""} onClick={() => setPanel(item)}>
            {item === "viewer" ? "▱ 3D SITE VIEW" : item === "photos" ? "▣ PHOTOS" : "⌖ LOCATION"}
          </button>
        ))}
      </nav>

      <div className="workspace">
        <section className="viewer-card">
          <div className="viewer-top">
            <div>
              <span className="live-dot" /> <b>{modelName}</b>
              <span className="model-status">MODEL LOADED</span>
            </div>
            <div className="viewer-tools">
              <button className={measureMode ? "tool-active" : ""} onClick={toggleMeasure}>↔ {measureMode ? "Clear measure" : "Measure"}</button>
            </div>
          </div>

          <div className="viewer-stage">
            {panel === "viewer" && (
              <>
                {/*
                  model-viewer is loaded client-side. React.createElement avoids
                  coupling this prototype to custom-element type declarations.
                */}
                <ModelViewer ref={modelRef} src="/23_07_2026.glb" points={measurePoints} onSelect={selectMeasurePoint} />
                {measuredDistance !== null && <div className="measure-result">{measuredDistance.toFixed(2)} m</div>}
                <div className="viewer-hint">{measureMode ? `${measurePoints.length}/2 points selected` : "Drag to orbit · Scroll to zoom · Right-drag to pan"}</div>
                <div className="compass">N</div>
              </>
            )}
            {panel === "photos" && <PhotoPanel />}
            {panel === "map" && <MapPanel />}
          </div>

          <div className="disclaimer">
            <span>!</span>
            <p><b>Visual site record — not survey grade.</b> Measurements are indicative only and must not be used for design, setting out, construction or contractual purposes unless independently verified against survey control.</p>
          </div>
        </section>

        <aside className="side-panel">
          <div className="side-tabs">
            <button className={activeTab === "observations" ? "active" : ""} onClick={() => setActiveTab("observations")}>OBSERVATIONS</button>
            <button className={activeTab === "details" ? "active" : ""} onClick={() => setActiveTab("details")}>SURVEY DETAILS</button>
          </div>

          {activeTab === "observations" ? (
            <>
              <div className="category-list">
                {categories.map(([label, count, color]) => (
                  <button key={label} className={activeCategory === label ? "active" : ""} onClick={() => setActiveCategory(label)}>
                    <span className="category-dot" style={{ background: color }} />{label}<em>{count}</em>
                  </button>
                ))}
              </div>
              <div className="issue-list">
                <div className="issue-heading"><b>OBSERVATIONS</b><button onClick={() => notify("New observation form opened")}>＋ NEW</button></div>
                {issues.filter((issue) => activeCategory === "All observations" || issue.type === activeCategory || (activeCategory === "Signs & markings" && issue.type === "Signs")).map((issue) => (
                  <article key={issue.id} onClick={() => notify(`${issue.id} selected in model`)}>
                    <span className="issue-icon" style={{ background: issue.color }}>{issue.id.slice(-1)}</span>
                    <div><small>{issue.id} · {issue.type.toUpperCase()}</small><h3>{issue.title}</h3><p>Captured during site walkover</p></div>
                    <span className={`status ${issue.status.toLowerCase()}`}>{issue.status}</span>
                    <button className="delete-observation" aria-label={`Delete ${issue.title}`} onClick={(event) => { event.stopPropagation(); deleteObservation(issue.id, issue.title); }}>×</button>
                  </article>
                ))}
              </div>
            </>
          ) : <SurveyDetails />}
        </aside>
      </div>

      <section className="lower-grid">
        <div className="card metadata">
          <div className="card-head"><h2>Survey information</h2><button onClick={() => notify("Survey information is editable in the full product")}>Edit</button></div>
          <div className="meta-grid">
            <Meta label="Survey date" value="23 July 2026" />
            <Meta label="Surveyor" value="Ross Couper" />
            <Meta label="Capture method" value="Polycam · LiDAR / photogrammetry" />
            <Meta label="Source file" value={modelName} />
            <Meta label="Coordinate system" value="Not supplied" warning />
            <Meta label="Accuracy class" value="Visual reference only" warning />
          </div>
        </div>

        <div className="card notes">
          <div className="card-head"><h2>Notes & actions</h2><button onClick={() => notify("Notes saved locally")}>Save</button></div>
          <label>GENERAL SITE NOTES<textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
          <div className="action-row">
            <input type="checkbox" id="action1" />
            <label htmlFor="action1"><b>Confirm survey control requirements</b><span>Assigned to Ross · Due 30 Jul 2026</span></label>
            <em>OPEN</em>
          </div>
          <button className="add-action" onClick={() => notify("New action added")}>＋ Add action</button>
        </div>
      </section>

      <footer>
        <span>Walkover · Internal prototype</span>
        <span>Source: Polycam export · Last updated 23 Jul 2026</span>
      </footer>
      {toast && <div className="toast">{toast}</div>}
    </main>
  );
}

function ModelViewer({ src, points, onSelect, ref }: {
  src: string;
  points: { position: string }[];
  onSelect: (event: React.MouseEvent<HTMLElement>) => void;
  ref: React.RefObject<HTMLElement | null>;
}) {
  return (
    // @ts-expect-error model-viewer is registered at runtime
    <model-viewer
      ref={ref}
      src={src}
      alt="Interactive 3D reality capture of the highway site"
      camera-controls
      touch-action="pan-y"
      shadow-intensity="0.7"
      exposure="1.05"
      environment-image="neutral"
      auto-rotate-delay="4000"
      min-camera-orbit="auto auto 0.05m"
      max-camera-orbit="auto auto 100m"
      onClick={onSelect}
    >
      {points.map((point, index) => (
        <button key={`${point.position}-${index}`} className="measure-hotspot" slot={`hotspot-measure-${index}`} data-position={point.position} aria-label={`Measurement point ${index + 1}`}>{index + 1}</button>
      ))}
    </model-viewer>
  );
}

function Meta({ label, value, warning = false }: { label: string; value: string; warning?: boolean }) {
  return <div><span>{label}</span><b className={warning ? "warn" : ""}>{warning && "△ "}{value}</b></div>;
}

function SurveyDetails() {
  return <div className="detail-list">
    <Meta label="Project reference" value="HW-SW-2026-001" />
    <Meta label="Capture device" value="Not recorded" warning />
    <Meta label="Weather" value="Dry · daylight" />
    <Meta label="Georeferencing" value="Not confirmed" warning />
    <Meta label="Model format" value="Binary glTF (GLB)" />
    <Meta label="File size" value="5.7 MB" />
    <div className="supported"><b>Supported imports</b><p>GLB / GLTF for direct viewing</p><p>OBJ · LAS / LAZ via processing</p><p>JPG / PNG · CSV / JSON metadata</p></div>
  </div>;
}

function MapPanel() {
  return <div className="map-placeholder">
    <div className="road r1" /><div className="road r2" /><div className="road r3" />
    <div className="map-pin">H</div>
    <div className="map-copy"><span>LOCATION NOT SET</span><h2>Add site coordinates</h2><p>Import CSV/JSON metadata or enter a project location to position this survey.</p><button>Add location</button></div>
  </div>;
}

function PhotoPanel() {
  return <div className="photo-placeholder">
    <div className="photo-copy"><span>NO SEPARATE PHOTOGRAPHS ATTACHED</span><h2>Add original site photos</h2><p>JPG and PNG images can be associated with observations and included in the walkover report.</p><label className="primary">Upload photos<input type="file" accept="image/*" multiple /></label></div>
    {[1,2,3,4].map((n) => <div key={n} className={`photo-tile p${n}`}>PHOTO {n}</div>)}
  </div>;
}
