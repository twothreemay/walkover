import { env } from "cloudflare:workers";
import { getAdminUser } from "../../admin-auth";

const MAX_UPLOAD_BYTES = 250 * 1024 * 1024;

export async function GET() {
  const user = await getAdminUser();
  if (!user) return Response.json({ error: "Admin access required" }, { status: 403 });

  const result = await env.DB.prepare(`
    SELECT p.*, COUNT(DISTINCT f.id) AS file_count,
      COALESCE(SUM(DISTINCT f.size), 0) AS total_bytes,
      COUNT(DISTINCT CASE WHEN s.revoked_at IS NULL THEN s.id END) AS share_count
    FROM projects p
    LEFT JOIN project_files f ON f.project_id = p.id
    LEFT JOIN share_links s ON s.project_id = p.id
    GROUP BY p.id
    ORDER BY p.updated_at DESC
  `).all();
  return Response.json({ projects: result.results });
}

export async function POST(request: Request) {
  const user = await getAdminUser();
  if (!user) return Response.json({ error: "Admin access required" }, { status: 403 });

  const form = await request.formData();
  const title = String(form.get("title") || "").trim();
  const client = String(form.get("client") || "Internal").trim();
  const location = String(form.get("location") || "Location not set").trim();
  const description = String(form.get("description") || "").trim();
  const surveyDate = String(form.get("surveyDate") || "").trim();
  const model = form.get("model");

  if (!title || !surveyDate) {
    return Response.json({ error: "Project name and survey date are required" }, { status: 400 });
  }

  if (model instanceof File && model.size > MAX_UPLOAD_BYTES) {
    return Response.json({ error: "The prototype upload limit is 250 MB per file" }, { status: 413 });
  }

  const id = crypto.randomUUID();
  const slugBase = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48) || "project";
  const slug = `${slugBase}-${id.slice(0, 6)}`;
  const now = Date.now();

  await env.DB.prepare(`
    INSERT INTO projects (id, slug, title, client, location, description, survey_date, status, owner_email, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?)
  `).bind(id, slug, title, client, location, description, surveyDate, user.email, now, now).run();

  if (model instanceof File && model.size > 0) {
    const fileId = crypto.randomUUID();
    const storageKey = `projects/${id}/${fileId}-${safeFilename(model.name)}`;
    await env.FILES.put(storageKey, model.stream(), {
      httpMetadata: { contentType: model.type || "model/gltf-binary" },
      customMetadata: { projectId: id, uploadedBy: user.email },
    });
    await env.DB.prepare(`
      INSERT INTO project_files (id, project_id, kind, filename, content_type, size, storage_key, static_path, created_at)
      VALUES (?, ?, 'model', ?, ?, ?, ?, NULL, ?)
    `).bind(fileId, id, model.name, model.type || "model/gltf-binary", model.size, storageKey, now).run();
  }

  return Response.json({ project: { id, slug, title } }, { status: 201 });
}

function safeFilename(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 120);
}
