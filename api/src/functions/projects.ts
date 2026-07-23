import { app, HttpResponseInit } from "@azure/functions";
import { adminName, adminRequired } from "../lib/auth.js";
import { clean, ensureTables, escapeOData, history, list, table } from "../lib/storage.js";

type ProjectInput = { placeId?: string; organisationId?: string; title?: string; reference?: string; status?: string; description?: string; startDate?: string };

app.http("projects", {
  methods: ["GET", "POST"], authLevel: "anonymous", route: "projects",
  handler: async (request): Promise<HttpResponseInit> => {
    const denied = adminRequired(request); if (denied) return denied;
    await ensureTables();
    if (request.method === "GET") {
      const placeId = request.query.get("placeId");
      return { jsonBody: { projects: await list("projects", placeId ? `PartitionKey eq '${escapeOData(placeId)}'` : undefined) } };
    }
    const body = await request.json() as ProjectInput;
    if (!body.placeId || !body.title?.trim()) return { status: 400, jsonBody: { error: "Place and project title are required" } };
    const id = crypto.randomUUID(); const now = new Date().toISOString();
    const item = { partitionKey: body.placeId, rowKey: id, id, placeId: body.placeId, organisationId: body.organisationId || "", title: body.title.trim(), reference: body.reference || "", status: body.status || "Active", description: body.description || "", startDate: body.startDate || "", createdAt: now, updatedAt: now };
    await table("projects").createEntity(item); await history(body.placeId, "project", "created", adminName(request), item.title);
    return { status: 201, jsonBody: { project: clean(item) } };
  }
});

app.http("projectById", {
  methods: ["GET", "PATCH"], authLevel: "anonymous", route: "places/{placeId}/projects/{id}",
  handler: async (request): Promise<HttpResponseInit> => {
    const denied = adminRequired(request); if (denied) return denied;
    if (request.method === "GET") return { jsonBody: { project: clean(await table("projects").getEntity(request.params.placeId, request.params.id)) } };
    const body = await request.json() as Record<string, unknown>;
    await table("projects").updateEntity({ partitionKey: request.params.placeId, rowKey: request.params.id, ...body, updatedAt: new Date().toISOString() }, "Merge");
    await history(request.params.placeId, "project", "updated", adminName(request), String(body.title || "Project updated"));
    return { status: 204 };
  }
});

app.http("projectHistory", {
  methods: ["GET"], authLevel: "anonymous", route: "history/{scopeId}",
  handler: async (request): Promise<HttpResponseInit> => {
    const denied = adminRequired(request); if (denied) return denied;
    return { jsonBody: { history: await list("history", `PartitionKey eq '${escapeOData(request.params.scopeId)}'`) } };
  }
});
