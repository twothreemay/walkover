import { app, HttpResponseInit } from "@azure/functions";
import { adminRequired, isAdmin, principal } from "../lib/auth.js";
import { ensureTables, entity, filesTable, modelsContainer, safeName, sharesTable } from "../lib/storage.js";

app.http("projectFiles", {
  methods: ["GET", "POST"], authLevel: "anonymous", route: "projects/{projectId}/files",
  handler: async (request): Promise<HttpResponseInit> => {
    if (!isAdmin(request)) return adminRequired();
    await ensureTables();
    const projectId = request.params.projectId;
    if (request.method === "GET") {
      const files = [];
      for await (const item of filesTable().listEntities({ queryOptions: { filter: `PartitionKey eq '${projectId.replaceAll("'", "''")}'` } })) files.push(entity(item));
      return { jsonBody: { files } };
    }
    const form = await request.formData();
    const uploaded = form.get("file");
    if (!(uploaded instanceof File) || uploaded.size === 0) return { status: 400, jsonBody: { error: "A file is required" } };
    const id = crypto.randomUUID();
    const blobName = `${projectId}/${id}-${safeName(uploaded.name)}`;
    const blob = (await modelsContainer()).getBlockBlobClient(blobName);
    await blob.uploadData(Buffer.from(await uploaded.arrayBuffer()), { blobHTTPHeaders: { blobContentType: uploaded.type || "application/octet-stream" } });
    const metadata = {
      partitionKey: projectId, rowKey: id, id, projectId, filename: uploaded.name, contentType: uploaded.type || "application/octet-stream",
      size: uploaded.size, kind: String(form.get("kind") || inferKind(uploaded.name)), blobName,
      createdAt: new Date().toISOString(), uploadedBy: principal(request)?.userDetails || "unknown"
    };
    await filesTable().createEntity(metadata);
    return { status: 201, jsonBody: { file: entity(metadata) } };
  }
});

app.http("fileById", {
  methods: ["GET", "DELETE"], authLevel: "anonymous", route: "files/{id}",
  handler: async (request): Promise<HttpResponseInit> => {
    await ensureTables();
    let metadata: Record<string, unknown> | undefined;
    for await (const item of filesTable().listEntities<Record<string, unknown>>({ queryOptions: { filter: `RowKey eq '${request.params.id.replaceAll("'", "''")}'` } })) { metadata = item; break; }
    if (!metadata) return { status: 404, jsonBody: { error: "File not found" } };
    if (request.method === "DELETE") {
      if (!isAdmin(request)) return adminRequired();
      await (await modelsContainer()).deleteBlob(String(metadata.blobName), { deleteSnapshots: "include" });
      await filesTable().deleteEntity(String(metadata.partitionKey), request.params.id);
      return { status: 204 };
    }
    if (!isAdmin(request) && !(await validShare(request.query.get("share"), String(metadata.partitionKey)))) return { status: 403, jsonBody: { error: "File access denied" } };
    const download = await (await modelsContainer()).getBlobClient(String(metadata.blobName)).download();
    if (!download.readableStreamBody) return { status: 404 };
    return {
      body: download.readableStreamBody as unknown as import("node:stream").Readable,
      headers: {
        "content-type": String(metadata.contentType || "application/octet-stream"),
        "content-length": String(download.contentLength || metadata.size || ""),
        "cache-control": "private, max-age=300"
      }
    };
  }
});

async function validShare(token: string | null, projectId: string) {
  if (!token) return false;
  try {
    const share = await sharesTable().getEntity<Record<string, unknown>>("SHARE", token);
    return !share.revoked && share.projectId === projectId && new Date(String(share.expiresAt)).getTime() > Date.now();
  } catch {
    return false;
  }
}

function inferKind(name: string) {
  return /\.(glb|gltf|obj|las|laz)$/i.test(name) ? "model" : /\.(jpg|jpeg|png|webp)$/i.test(name) ? "image" : "metadata";
}
