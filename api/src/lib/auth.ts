import type { HttpRequest } from "@azure/functions";

export type ClientPrincipal = {
  identityProvider: string;
  userId: string;
  userDetails: string;
  userRoles: string[];
};

export function principal(request: HttpRequest): ClientPrincipal | null {
  const encoded = request.headers.get("x-ms-client-principal");
  if (!encoded) return null;
  try {
    return JSON.parse(Buffer.from(encoded, "base64").toString("utf8")) as ClientPrincipal;
  } catch {
    return null;
  }
}

export function isAdmin(request: HttpRequest) {
  return principal(request)?.userRoles?.includes("admin") === true;
}

export function adminRequired() {
  return { status: 403, jsonBody: { error: "Administrator role required" } };
}
