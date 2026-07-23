import { env } from "cloudflare:workers";

export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const normalised = code.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
  if (normalised.length !== 10) return Response.redirect(new URL("/?error=invalid-code", request.url));

  const result = await env.DB.prepare(`
    SELECT token
    FROM share_links
    WHERE LOWER(SUBSTR(token, 1, 10)) = ?
      AND revoked_at IS NULL
      AND (expires_at IS NULL OR expires_at > ?)
    LIMIT 2
  `).bind(normalised, Date.now()).all<{ token: string }>();

  if (result.results.length !== 1) return Response.redirect(new URL("/?error=invalid-code", request.url));
  return Response.redirect(new URL(`/share/${result.results[0].token}`, request.url));
}
