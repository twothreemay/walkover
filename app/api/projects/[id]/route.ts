import { env } from "cloudflare:workers";
import { getAdminUser } from "../../../admin-auth";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAdminUser();
  if (!user) return Response.json({ error: "Admin access required" }, { status: 403 });
  const { id } = await params;

  const project = await env.DB.prepare("SELECT * FROM projects WHERE id = ?").bind(id).first();
  if (!project) return Response.json({ error: "Project not found" }, { status: 404 });
  const files = await env.DB.prepare("SELECT id, kind, filename, content_type, size, static_path, created_at FROM project_files WHERE project_id = ? ORDER BY created_at DESC").bind(id).all();
  const shares = await env.DB.prepare("SELECT id, token, label, expires_at, revoked_at, created_at FROM share_links WHERE project_id = ? ORDER BY created_at DESC").bind(id).all();
  return Response.json({ project, files: files.results, shares: shares.results });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAdminUser();
  if (!user) return Response.json({ error: "Admin access required" }, { status: 403 });
  const { id } = await params;
  const payload = await request.json() as {
    title?: string; client?: string; location?: string; description?: string;
    surveyDate?: string; status?: string;
  };
  const current = await env.DB.prepare("SELECT * FROM projects WHERE id = ?").bind(id).first<Record<string, unknown>>();
  if (!current) return Response.json({ error: "Project not found" }, { status: 404 });
  const title = String(payload.title ?? current.title).trim();
  const surveyDate = String(payload.surveyDate ?? current.survey_date).trim();
  if (!title || !surveyDate) return Response.json({ error: "Project name and survey date are required" }, { status: 400 });
  const status = payload.status === "published" ? "published" : payload.status === "draft" ? "draft" : String(current.status);
  await env.DB.prepare(`
    UPDATE projects SET title = ?, client = ?, location = ?, description = ?, survey_date = ?, status = ?, updated_at = ?
    WHERE id = ?
  `).bind(
    title,
    String(payload.client ?? current.client).trim() || "Internal",
    String(payload.location ?? current.location).trim() || "Location not set",
    String(payload.description ?? current.description).trim(),
    surveyDate,
    status,
    Date.now(),
    id,
  ).run();
  return Response.json({ ok: true, project: { id, title } });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAdminUser();
  if (!user) return Response.json({ error: "Admin access required" }, { status: 403 });
  const { id } = await params;
  const files = await env.DB.prepare("SELECT storage_key FROM project_files WHERE project_id = ? AND storage_key IS NOT NULL").bind(id).all<{ storage_key: string }>();
  for (const file of files.results) await env.FILES.delete(file.storage_key);
  const result = await env.DB.prepare("DELETE FROM projects WHERE id = ?").bind(id).run();
  if (!result.meta.changes) return Response.json({ error: "Project not found" }, { status: 404 });
  return Response.json({ ok: true });
}
