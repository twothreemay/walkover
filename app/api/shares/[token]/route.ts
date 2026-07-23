import { env } from "cloudflare:workers";

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const share = await env.DB.prepare(`
    SELECT s.id, s.project_id, s.label, s.expires_at, p.title, p.client, p.location, p.description, p.survey_date, p.status
    FROM share_links s JOIN projects p ON p.id = s.project_id
    WHERE s.token = ? AND s.revoked_at IS NULL AND (s.expires_at IS NULL OR s.expires_at > ?)
  `).bind(token, Date.now()).first();
  if (!share) return Response.json({ error: "This share link is invalid or has expired" }, { status: 404 });
  const files = await env.DB.prepare(`
    SELECT id, kind, filename, content_type, size, static_path
    FROM project_files WHERE project_id = ? ORDER BY created_at DESC
  `).bind(share.project_id).all();
  return Response.json({ project: share, files: files.results });
}
