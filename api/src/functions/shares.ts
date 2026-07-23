import { app, HttpResponseInit } from "@azure/functions";
import { adminRequired, isAdmin, principal } from "../lib/auth.js";
import { ensureTables, entity, filesTable, observationsTable, projectsTable, sharesTable } from "../lib/storage.js";

app.http("shares", {
  methods: ["GET", "POST"], authLevel: "anonymous", route: "projects/{projectId}/shares",
  handler: async (request): Promise<HttpResponseInit> => {
    if (!isAdmin(request)) return adminRequired();
    await ensureTables();
    const table = sharesTable();
    if (request.method === "GET") {
      const shares = [];
      for await (const item of table.listEntities({ queryOptions: { filter: `projectId eq '${request.params.projectId.replaceAll("'", "''")}'` } })) shares.push(entity(item));
      return { jsonBody: { shares } };
    }
    const body = await request.json() as { label?: string; expiresAt?: string };
    const token = `${crypto.randomUUID().replaceAll("-", "")}${crypto.randomUUID().replaceAll("-", "")}`;
    const share = {
      partitionKey: "SHARE", rowKey: token, token, projectId: request.params.projectId, label: body.label || "Project team",
      expiresAt: body.expiresAt || new Date(Date.now() + 30 * 86400000).toISOString(), revoked: false,
      createdAt: new Date().toISOString(), createdBy: principal(request)?.userDetails || "unknown"
    };
    await table.createEntity(share);
    return { status: 201, jsonBody: { share: entity(share), urlPath: `/share/${token}` } };
  }
});

app.http("shareByToken", {
  methods: ["GET", "DELETE"], authLevel: "anonymous", route: "shares/{token}",
  handler: async (request): Promise<HttpResponseInit> => {
    await ensureTables();
    const shareTable = sharesTable();
    if (request.method === "DELETE") {
      if (!isAdmin(request)) return adminRequired();
      await shareTable.updateEntity({ partitionKey: "SHARE", rowKey: request.params.token, revoked: true }, "Merge");
      return { status: 204 };
    }
    try {
      const share = await shareTable.getEntity<Record<string, unknown>>("SHARE", request.params.token);
      if (share.revoked || new Date(String(share.expiresAt)).getTime() < Date.now()) return { status: 404, jsonBody: { error: "Share link is invalid or expired" } };
      const projectId = String(share.projectId);
      const project = entity(await projectsTable().getEntity("PROJECT", projectId));
      const files = []; const observations = [];
      for await (const item of filesTable().listEntities({ queryOptions: { filter: `PartitionKey eq '${projectId.replaceAll("'", "''")}'` } })) files.push({ ...entity(item), url: `/api/files/${item.rowKey}?share=${request.params.token}` });
      for await (const item of observationsTable().listEntities({ queryOptions: { filter: `PartitionKey eq '${projectId.replaceAll("'", "''")}'` } })) observations.push(entity(item));
      return { jsonBody: { project, files, observations } };
    } catch (error) {
      if ((error as { statusCode?: number }).statusCode === 404) return { status: 404, jsonBody: { error: "Share link not found" } };
      throw error;
    }
  }
});

app.http("resolveProjectCode", {
  methods: ["GET"], authLevel: "anonymous", route: "project-code/{code}",
  handler: async (request): Promise<HttpResponseInit> => {
    await ensureTables();
    const code = request.params.code.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
    let projectId = "";
    for await (const project of projectsTable().listEntities<Record<string, unknown>>({ queryOptions: { filter: `code eq '${code.replaceAll("'", "''")}'`, select: ["rowKey"] } })) {
      projectId = String(project.rowKey); break;
    }
    if (!projectId) return { status: 404, jsonBody: { error: "Project code not found" } };
    const now = new Date().toISOString();
    for await (const share of sharesTable().listEntities<Record<string, unknown>>({ queryOptions: { filter: `projectId eq '${projectId.replaceAll("'", "''")}' and revoked eq false` } })) {
      if (String(share.expiresAt) > now) return { jsonBody: { token: share.rowKey } };
    }
    return { status: 404, jsonBody: { error: "No active share link exists for this project" } };
  }
});
