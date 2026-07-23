"use client";

import { useEffect, useState } from "react";

type SharedData = {
  project: { title: string; client: string; location: string; description: string; survey_date: string; label: string };
  files: { id: string; kind: string; filename: string; content_type: string; size: number; static_path?: string }[];
};

export default function SharedProject({ token }: { token: string }) {
  const [data, setData] = useState<SharedData | null>(null);
  const [error, setError] = useState("");
  const [activeModel, setActiveModel] = useState("");

  useEffect(() => {
    import("@google/model-viewer");
    fetch(`/api/shares/${token}`).then(async (response) => {
      const payload = await response.json();
      if (!response.ok) return setError(payload.error || "Project could not be loaded");
      setData(payload);
      const model = payload.files.find((file: SharedData["files"][number]) => file.kind === "model" && /\.(glb|gltf)$/i.test(file.filename));
      if (model) setActiveModel(model.static_path || `/api/files/${model.id}?token=${token}`);
    });
  }, [token]);

  if (error) return <main className="shared-error"><div className="brand"><span className="brand-mark">W</span>WALKOVER</div><h1>Link unavailable</h1><p>{error}</p></main>;
  if (!data) return <main className="shared-loading">Loading secure site record…</main>;
  const photos = data.files.filter((file) => file.kind === "photo");

  return <main className="shared-shell">
    <header className="shared-top"><a className="brand" href="/"><span className="brand-mark">W</span><span>WALKOVER</span></a><span>SHARED SITE RECORD</span></header>
    <section className="shared-head"><div><p>{data.project.client.toUpperCase()}</p><h1>{data.project.title}</h1><span>{data.project.location} · Surveyed {new Date(`${data.project.survey_date}T12:00:00`).toLocaleDateString("en-GB", { day:"numeric", month:"long", year:"numeric" })}</span></div><button onClick={() => window.print()}>⇩ Export record</button></section>
    <section className="shared-grid">
      <div className="shared-viewer">
        <div className="viewer-top"><div><span className="live-dot" /><b>{data.files.find((f) => f.kind === "model")?.filename || "No reality model"}</b></div><span>DRAG TO ORBIT · SCROLL TO ZOOM</span></div>
        <div className="shared-stage">
          {activeModel ? (
            // @ts-expect-error model-viewer is registered client-side
            <model-viewer src={activeModel} alt={`3D reality capture for ${data.project.title}`} camera-controls touch-action="pan-y" shadow-intensity="0.7" exposure="1.05" environment-image="neutral" min-camera-orbit="auto auto 0.05m" max-camera-orbit="auto auto 100m" />
          ) : <div className="no-model"><b>3D model not available</b><span>A GLB or GLTF export has not been uploaded to this project.</span></div>}
        </div>
        <div className="disclaimer"><span>!</span><p><b>Visual site record — not survey grade.</b> Measurements are indicative only and must be independently verified before design or construction use.</p></div>
      </div>
      <aside className="shared-info">
        <div><span>ABOUT THIS RECORD</span><p>{data.project.description || "Highway reality capture shared for remote site review."}</p></div>
        <div><span>PROJECT FILES</span>{data.files.map((file) => <a key={file.id} href={file.static_path || `/api/files/${file.id}?token=${token}`} target="_blank"><i>{file.kind === "model" ? "3D" : file.kind === "photo" ? "IMG" : "DOC"}</i><span><b>{file.filename}</b><small>{formatBytes(file.size)}</small></span>↗</a>)}</div>
        <div><span>ACCESS</span><p>This secure link was created for <b>{data.project.label}</b>. Please do not forward it without the project owner’s permission.</p></div>
      </aside>
    </section>
    {photos.length > 0 && <section className="shared-photos"><h2>Site photographs</h2><div>{photos.map((photo) => <img key={photo.id} src={`/api/files/${photo.id}?token=${token}`} alt={photo.filename} />)}</div></section>}
    <footer><span>Walkover · Shared site record</span><span>Visual reference only</span></footer>
  </main>;
}

function formatBytes(value: number) { return value > 1024 ** 2 ? `${(value / 1024 ** 2).toFixed(1)} MB` : `${Math.ceil(value / 1024)} KB`; }
