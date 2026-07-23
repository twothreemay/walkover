import { app, HttpResponseInit } from "@azure/functions";
import { adminName, adminRequired, session } from "../lib/auth.js";
import { clean, ensureTables, escapeOData, filesContainer, history, list, safeName, table } from "../lib/storage.js";

app.http("walkoverFiles", {
  methods: ["GET", "POST"], authLevel: "anonymous", route: "walkovers/{walkoverId}/files",
  handler: async (request): Promise<HttpResponseInit> => {
    const denied = adminRequired(request); if (denied) return denied;
    await ensureTables();
    const walkoverId = request.params.walkoverId;
    if (request.method === "GET") return { jsonBody: { files: await list("files", `PartitionKey eq '${escapeOData(walkoverId)}'`) } };
    const form = await request.formData();
    const uploaded = form.get("file");
    if (!(uploaded instanceof File) || uploaded.size === 0) return { status: 400, jsonBody: { error: "A file is required" } };
    const id = crypto.randomUUID(); const kind = String(form.get("kind") || inferKind(uploaded.name));
    const blobName = `${walkoverId}/${id}-${safeName(uploaded.name)}`;
    await (await filesContainer()).getBlockBlobClient(blobName).uploadData(Buffer.from(await uploaded.arrayBuffer()), { blobHTTPHeaders: { blobContentType: uploaded.type || "application/octet-stream" } });
    const item = { partitionKey: walkoverId, rowKey: id, id, walkoverId, projectId: String(form.get("projectId") || ""), filename: uploaded.name, contentType: uploaded.type || "application/octet-stream", size: uploaded.size, kind, blobName, createdAt: new Date().toISOString() };
    await table("files").createEntity(item); await history(walkoverId, "file", "uploaded", adminName(request), uploaded.name);
    return { status: 201, jsonBody: { file: clean(item) } };
  }
});

app.http("fileById", {
  methods: ["GET", "DELETE"], authLevel: "anonymous", route: "files/{id}",
  handler: async (request): Promise<HttpResponseInit> => {
    await ensureTables();
    let metadata: Record<string, unknown> | undefined;
    for await (const item of table("files").listEntities<Record<string, unknown>>({ queryOptions: { filter: `RowKey eq '${escapeOData(request.params.id)}'` } })) { metadata = item; break; }
    if (!metadata) return { status: 404, jsonBody: { error: "File not found" } };
    if (request.method === "DELETE") {
      const denied = adminRequired(request); if (denied) return denied;
      await (await filesContainer()).deleteBlob(String(metadata.blobName), { deleteSnapshots: "include" });
      await table("files").deleteEntity(String(metadata.partitionKey), request.params.id);
      return { status: 204 };
    }
    if (!session(request) && !(await validShare(request.query.get("share"), String(metadata.projectId)))) return { status: 403, jsonBody: { error: "File access denied" } };
    const download = await (await filesContainer()).getBlobClient(String(metadata.blobName)).download();
    if (!download.readableStreamBody) return { status: 404 };
    return { body: download.readableStreamBody as unknown as import("node:stream").Readable, headers: { "content-type": String(metadata.contentType), "content-length": String(download.contentLength || metadata.size || ""), "cache-control": "private, max-age=300" } };
  }
});

async function validShare(token: string | null, projectId: string) {
  if (!token) return false;
  try {
    const share = await table("shares").getEntity<Record<string, unknown>>("SHARE", token);
    return !share.revoked && share.projectId === projectId && new Date(String(share.expiresAt)).getTime() > Date.now();
  } catch { return false; }
}

function inferKind(name: string) {
  return /\.(glb|gltf|obj|las|laz)$/i.test(name) ? "Reality model" : /\.(ifc|dwg|dxf|landxml)$/i.test(name) ? "Design model" : /\.(jpg|jpeg|png|webp)$/i.test(name) ? "Image" : "Document";
}
