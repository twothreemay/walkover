import { env } from "cloudflare:workers";
import { getAdminUser } from "../../../admin-auth";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAdminUser();
  if (!user) return Response.json({ error: "Admin access required" }, { status: 403 });
  const { id } = await params;
  const result = await env.DB.prepare("DELETE FROM observations WHERE id = ?").bind(id).run();
  if (!result.meta.changes) return Response.json({ error: "Observation not found" }, { status: 404 });
  return Response.json({ ok: true });
}
