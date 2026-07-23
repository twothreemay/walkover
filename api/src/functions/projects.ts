import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { adminRequired, isAdmin, principal } from "../lib/auth.js";
import { ensureTables, entity, projectsTable } from "../lib/storage.js";

type ProjectInput = { title?: string; client?: string; location?: string; surveyDate?: string; description?: string; code?: string };

app.http("projects", {
  methods: ["GET", "POST"],
  authLevel: "anonymous",
  route: "projects",
  handler: async (request): Promise<HttpResponseInit> => {
    if (!isAdmin(request)) return adminRequired();
    await ensureTables();
    const table = projectsTable();
    if (request.method === "GET") {
      const projects = [];
      for await (const item of table.listEntities({ queryOptions: { filter: "PartitionKey eq 'PROJECT'" } })) projects.push(entity(item));
      return { jsonBody: { projects: projects.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt))) } };
    }
    const body = await request.json() as ProjectInput;
    if (!body.title?.trim() || !body.surveyDate) return { status: 400, jsonBody: { error: "Title and survey date are required" } };
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const project = {
      partitionKey: "PROJECT", rowKey: id, id, title: body.title.trim(), client: body.client || "", location: body.location || "",
      surveyDate: body.surveyDate, description: body.description || "", code: normaliseCode(body.code || id.slice(0, 10)),
      createdAt: now, updatedAt: now, createdBy: principal(request)?.userDetails || "unknown"
    };
    await table.createEntity(project);
    return { status: 201, jsonBody: { project: entity(project) } };
  }
});

app.http("projectById", {
  methods: ["GET", "PATCH", "DELETE"],
  authLevel: "anonymous",
  route: "projects/{id}",
  handler: async (request): Promise<HttpResponseInit> => {
    if (!isAdmin(request)) return adminRequired();
    await ensureTables();
    const id = request.params.id;
    const table = projectsTable();
    try {
      if (request.method === "GET") return { jsonBody: { project: entity(await table.getEntity("PROJECT", id)) } };
      if (request.method === "DELETE") {
        await table.deleteEntity("PROJECT", id);
        return { status: 204 };
      }
      const body = await request.json() as ProjectInput;
      const current = await table.getEntity<Record<string, unknown>>("PROJECT", id);
      const updated = {
        ...current, partitionKey: "PROJECT", rowKey: id, id,
        title: body.title?.trim() || current.title, client: body.client ?? current.client, location: body.location ?? current.location,
        surveyDate: body.surveyDate ?? current.surveyDate, description: body.description ?? current.description,
        code: body.code ? normaliseCode(body.code) : current.code, updatedAt: new Date().toISOString()
      };
      await table.updateEntity(updated, "Replace");
      return { jsonBody: { project: entity(updated) } };
    } catch (error) {
      return notFound(error);
    }
  }
});

function normaliseCode(value: string) {
  return value.replace(/[^a-zA-Z0-9]/g, "").slice(0, 16).toUpperCase();
}

function notFound(error: unknown): HttpResponseInit {
  if ((error as { statusCode?: number }).statusCode === 404) return { status: 404, jsonBody: { error: "Project not found" } };
  throw error;
}
