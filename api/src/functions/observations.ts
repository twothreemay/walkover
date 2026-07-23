import { app, HttpResponseInit } from "@azure/functions";
import { adminRequired, isAdmin, principal } from "../lib/auth.js";
import { ensureTables, entity, observationsTable } from "../lib/storage.js";

type ObservationInput = { title?: string; category?: string; status?: string; notes?: string; position?: string };

app.http("observations", {
  methods: ["GET", "POST"], authLevel: "anonymous", route: "projects/{projectId}/observations",
  handler: async (request): Promise<HttpResponseInit> => {
    if (!isAdmin(request)) return adminRequired();
    await ensureTables();
    const projectId = request.params.projectId;
    const table = observationsTable();
    if (request.method === "GET") {
      const observations = [];
      for await (const item of table.listEntities({ queryOptions: { filter: `PartitionKey eq '${projectId.replaceAll("'", "''")}'` } })) observations.push(entity(item));
      return { jsonBody: { observations } };
    }
    const body = await request.json() as ObservationInput;
    if (!body.title?.trim()) return { status: 400, jsonBody: { error: "Observation title is required" } };
    const id = crypto.randomUUID();
    const observation = {
      partitionKey: projectId, rowKey: id, id, projectId, title: body.title.trim(), category: body.category || "General",
      status: body.status || "open", notes: body.notes || "", position: body.position || "",
      createdAt: new Date().toISOString(), createdBy: principal(request)?.userDetails || "unknown"
    };
    await table.createEntity(observation);
    return { status: 201, jsonBody: { observation: entity(observation) } };
  }
});

app.http("observationById", {
  methods: ["PATCH", "DELETE"], authLevel: "anonymous", route: "projects/{projectId}/observations/{id}",
  handler: async (request): Promise<HttpResponseInit> => {
    if (!isAdmin(request)) return adminRequired();
    await ensureTables();
    const table = observationsTable();
    if (request.method === "DELETE") {
      await table.deleteEntity(request.params.projectId, request.params.id);
      return { status: 204 };
    }
    const body = await request.json() as ObservationInput;
    await table.updateEntity({ partitionKey: request.params.projectId, rowKey: request.params.id, ...body, updatedAt: new Date().toISOString() }, "Merge");
    return { status: 204 };
  }
});
