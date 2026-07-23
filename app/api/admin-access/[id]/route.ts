import { env } from "cloudflare:workers";
import { getAdminUser } from "../../../admin-auth";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminUser();
  if (!admin) return Response.json({ error: "Admin access required" }, { status: 403 });
  const { id } = await params;
  const payload = await request.json() as { decision?: string };
  const decision = payload.decision === "approve" ? "approved" : "rejected";
  const accessRequest = await env.DB.prepare("SELECT email, display_name FROM admin_access_requests WHERE id = ? AND status = 'pending'").bind(id).first<{ email: string; display_name: string }>();
  if (!accessRequest) return Response.json({ error: "Pending request not found" }, { status: 404 });
  const now = Date.now();
  if (decision === "approved") {
    await env.DB.batch([
      env.DB.prepare("INSERT OR REPLACE INTO admins (email, display_name, role, created_at) VALUES (?, ?, 'admin', ?)").bind(accessRequest.email, accessRequest.display_name, now),
      env.DB.prepare("UPDATE admin_access_requests SET status = 'approved', reviewed_at = ? WHERE id = ?").bind(now, id),
    ]);
  } else {
    await env.DB.prepare("UPDATE admin_access_requests SET status = 'rejected', reviewed_at = ? WHERE id = ?").bind(now, id).run();
  }
  return Response.json({ status: decision });
}
