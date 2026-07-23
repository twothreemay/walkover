import { env } from "cloudflare:workers";
import { getAdminUser } from "../../../../admin-auth";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAdminUser();
  if (!user) return Response.json({ error: "Admin access required" }, { status: 403 });
  const { id } = await params;
  const exists = await env.DB.prepare("SELECT id FROM projects WHERE id = ?").bind(id).first();
  if (!exists) return Response.json({ error: "Project not found" }, { status: 404 });

  const form = await request.formData();
  const uploads = form.getAll("files").filter((item): item is File => item instanceof File && item.size > 0);
  if (!uploads.length) return Response.json({ error: "Choose at least one file" }, { status: 400 });
  if (uploads.some((file) => file.size > 250 * 1024 * 1024)) {
    return Response.json({ error: "The prototype upload limit is 250 MB per file" }, { status: 413 });
  }

  const now = Date.now();
  for (const file of uploads) {
    const fileId = crypto.randomUUID();
    const key = `projects/${id}/${fileId}-${file.name.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 120)}`;
    const kind = classify(file);
    await env.FILES.put(key, file.stream(), {
      httpMetadata: { contentType: file.type || "application/octet-stream" },
      customMetadata: { projectId: id, uploadedBy: user.email, kind },
    });
    await env.DB.prepare(`
      INSERT INTO project_files (id, project_id, kind, filename, content_type, size, storage_key, static_path, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?)
    `).bind(fileId, id, kind, file.name, file.type || "application/octet-stream", file.size, key, now).run();
  }
  await env.DB.prepare("UPDATE projects SET updated_at = ? WHERE id = ?").bind(now, id).run();
  return Response.json({ uploaded: uploads.length }, { status: 201 });
}

function classify(file: File) {
  const name = file.name.toLowerCase();
  if (/\.(glb|gltf|obj|las|laz)$/.test(name)) return "model";
  if (file.type.startsWith("image/")) return "photo";
  if (/\.(csv|json|geojson)$/.test(name)) return "metadata";
  return "attachment";
}
