import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../chatgpt-auth";
import { getAdminUser } from "../../admin-auth";

export async function GET() {
  const admin = await getAdminUser();
  if (!admin) return Response.json({ error: "Admin access required" }, { status: 403 });
  const result = await env.DB.prepare(`
    SELECT id, email, display_name, organisation, reason, status, created_at
    FROM admin_access_requests WHERE status = 'pending' ORDER BY created_at ASC
  `).all();
  return Response.json({ requests: result.results });
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
  const payload = await request.json() as { organisation?: string; reason?: string };
  const organisation = String(payload.organisation || "").trim();
  const reason = String(payload.reason || "").trim();
  if (!organisation || !reason) return Response.json({ error: "Organisation and reason are required" }, { status: 400 });
  const existingAdmin = await env.DB.prepare("SELECT email FROM admins WHERE lower(email) = lower(?)").bind(user.email).first();
  if (existingAdmin) return Response.json({ status: "approved" });
  await env.DB.prepare(`
    INSERT INTO admin_access_requests (id, email, display_name, organisation, reason, status, created_at, reviewed_at)
    VALUES (?, ?, ?, ?, ?, 'pending', ?, NULL)
    ON CONFLICT(email) DO UPDATE SET display_name = excluded.display_name, organisation = excluded.organisation,
      reason = excluded.reason, status = 'pending', created_at = excluded.created_at, reviewed_at = NULL
  `).bind(crypto.randomUUID(), user.email.toLowerCase(), user.displayName, organisation, reason, Date.now()).run();
  return Response.json({ status: "pending" }, { status: 201 });
}
