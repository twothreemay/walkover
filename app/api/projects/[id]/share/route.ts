import { env } from "cloudflare:workers";
import { getAdminUser } from "../../../../admin-auth";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAdminUser();
  if (!user) return Response.json({ error: "Admin access required" }, { status: 403 });
  const { id } = await params;
  const payload = await request.json() as { label?: string; days?: number };
  const project = await env.DB.prepare("SELECT id FROM projects WHERE id = ?").bind(id).first();
  if (!project) return Response.json({ error: "Project not found" }, { status: 404 });

  const shareId = crypto.randomUUID();
  const token = `${crypto.randomUUID().replaceAll("-", "")}${crypto.randomUUID().replaceAll("-", "")}`;
  const days = Math.min(Math.max(Number(payload.days || 30), 1), 365);
  const now = Date.now();
  const expiresAt = now + days * 86_400_000;
  await env.DB.prepare(`
    INSERT INTO share_links (id, project_id, token, label, created_by, expires_at, revoked_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?, NULL, ?)
  `).bind(shareId, id, token, String(payload.label || "Project team").slice(0, 80), user.email, expiresAt, now).run();
  await env.DB.prepare("UPDATE projects SET status = 'published', updated_at = ? WHERE id = ?").bind(now, id).run();
  return Response.json({ share: { id: shareId, token, expiresAt } }, { status: 201 });
}
