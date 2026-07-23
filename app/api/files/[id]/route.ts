import { env } from "cloudflare:workers";
import { getAdminUser } from "../../../admin-auth";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const file = await env.DB.prepare("SELECT * FROM project_files WHERE id = ?").bind(id).first<{
    project_id: string; filename: string; content_type: string; storage_key: string | null; static_path: string | null;
  }>();
  if (!file) return new Response("File not found", { status: 404 });

  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  const user = await getAdminUser();
  if (!user) {
    if (!token) return new Response("Sign in or use a valid share link", { status: 401 });
    const share = await env.DB.prepare(`
      SELECT id FROM share_links WHERE token = ? AND project_id = ? AND revoked_at IS NULL
      AND (expires_at IS NULL OR expires_at > ?)
    `).bind(token, file.project_id, Date.now()).first();
    if (!share) return new Response("Share link is invalid or expired", { status: 403 });
  }

  if (file.static_path) return Response.redirect(new URL(file.static_path, request.url), 302);
  if (!file.storage_key) return new Response("File storage is unavailable", { status: 404 });
  const object = await env.FILES.get(file.storage_key);
  if (!object) return new Response("Stored file not found", { status: 404 });
  return new Response(object.body, {
    headers: {
      "Content-Type": object.httpMetadata?.contentType || file.content_type,
      "Content-Disposition": `inline; filename="${file.filename.replaceAll('"', "")}"`,
      "Cache-Control": "private, max-age=3600",
      "ETag": object.httpEtag,
    },
  });
}
