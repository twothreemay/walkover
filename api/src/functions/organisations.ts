import { app, HttpResponseInit } from "@azure/functions";
import { adminName, adminRequired } from "../lib/auth.js";
import { clean, ensureTables, history, list, table } from "../lib/storage.js";

app.http("organisations", {
  methods: ["GET", "POST"], authLevel: "anonymous", route: "organisations",
  handler: async (request): Promise<HttpResponseInit> => {
    const denied = adminRequired(request); if (denied) return denied;
    await ensureTables();
    if (request.method === "GET") return { jsonBody: { organisations: await list("organisations") } };
    const body = await request.json() as { name?: string; type?: string; branding?: string };
    if (!body.name?.trim()) return { status: 400, jsonBody: { error: "Organisation name is required" } };
    const id = crypto.randomUUID(); const now = new Date().toISOString();
    const item = { partitionKey: "ORGANISATION", rowKey: id, id, name: body.name.trim(), type: body.type || "Client", branding: body.branding || "", createdAt: now, updatedAt: now };
    await table("organisations").createEntity(item); await history(id, "organisation", "created", adminName(request), item.name);
    return { status: 201, jsonBody: { organisation: clean(item) } };
  }
});

app.http("organisationById", {
  methods: ["PATCH"], authLevel: "anonymous", route: "organisations/{id}",
  handler: async (request): Promise<HttpResponseInit> => {
    const denied = adminRequired(request); if (denied) return denied;
    const body = await request.json() as Record<string, unknown>;
    await table("organisations").updateEntity({ partitionKey: "ORGANISATION", rowKey: request.params.id, ...body, updatedAt: new Date().toISOString() }, "Merge");
    await history(request.params.id, "organisation", "updated", adminName(request), String(body.name || "Organisation updated"));
    return { status: 204 };
  }
});
