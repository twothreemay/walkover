import { env } from "cloudflare:workers";
import { getAdminUser } from "../../../../admin-auth";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAdminUser();
  if (!user) return Response.json({ error: "Admin access required" }, { status: 403 });
  const { id } = await params;
  const result = await env.DB.prepare(`
    SELECT id, category, title, description, status, created_at, updated_at
    FROM observations WHERE project_id = ? ORDER BY created_at ASC
  `).bind(id).all();
  return Response.json({ observations: result.results });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAdminUser();
  if (!user) return Response.json({ error: "Admin access required" }, { status: 403 });
  const { id } = await params;
  const payload = await request.json() as { category?: string; title?: string; description?: string; status?: string };
  const title = String(payload.title || "").trim();
  if (!title) return Response.json({ error: "Observation title is required" }, { status: 400 });
  const observationId = crypto.randomUUID();
  const now = Date.now();
  await env.DB.prepare(`
    INSERT INTO observations (id, project_id, category, title, description, status, created_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(observationId, id, String(payload.category || "General"), title, String(payload.description || ""), payload.status === "review" ? "review" : "open", user.email, now, now).run();
  return Response.json({ observation: { id: observationId } }, { status: 201 });
}
