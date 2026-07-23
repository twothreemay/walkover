import { app } from "@azure/functions";
import { adminName, adminRequired } from "../lib/auth.js";
import { clean, ensureTables, escapeOData, exactCode, history, list, table } from "../lib/storage.js";
app.http("shares", {
    methods: ["GET", "POST"], authLevel: "anonymous", route: "projects/{projectId}/shares",
    handler: async (request) => {
        const denied = adminRequired(request);
        if (denied)
            return denied;
        await ensureTables();
        if (request.method === "GET")
            return { jsonBody: { shares: await list("shares", `projectId eq '${escapeOData(request.params.projectId)}'`) } };
        const body = await request.json();
        const code = exactCode(body.code || "");
        if (!code)
            return { status: 400, jsonBody: { error: "Share code must contain exactly 10 letters or numbers" } };
        if ((await list("shares", `code eq '${escapeOData(code)}' and revoked eq false`)).length)
            return { status: 409, jsonBody: { error: "That share code is already active" } };
        const token = `${crypto.randomUUID().replaceAll("-", "")}${crypto.randomUUID().replaceAll("-", "")}`;
        const item = { partitionKey: "SHARE", rowKey: token, token, code, projectId: request.params.projectId, label: body.label || "Project team", expiresAt: body.expiresAt || new Date(Date.now() + 30 * 86400000).toISOString(), revoked: false, createdAt: new Date().toISOString() };
        await table("shares").createEntity(item);
        await history(request.params.projectId, "share", "created", adminName(request), code);
        return { status: 201, jsonBody: { share: clean(item), urlPath: `/share/${token}` } };
    }
});
app.http("shareByToken", {
    methods: ["GET", "DELETE"], authLevel: "anonymous", route: "shares/{token}",
    handler: async (request) => {
        await ensureTables();
        if (request.method === "DELETE") {
            const denied = adminRequired(request);
            if (denied)
                return denied;
            await table("shares").updateEntity({ partitionKey: "SHARE", rowKey: request.params.token, revoked: true }, "Merge");
            return { status: 204 };
        }
        try {
            const share = await table("shares").getEntity("SHARE", request.params.token);
            if (share.revoked || new Date(String(share.expiresAt)).getTime() <= Date.now())
                return { status: 404, jsonBody: { error: "Share code is invalid or expired" } };
            const project = await findByRowKey("projects", String(share.projectId));
            if (!project)
                return { status: 404, jsonBody: { error: "Project not found" } };
            const place = await findByRowKey("places", String(project.placeId));
            const organisation = place ? await findByRowKey("organisations", String(place.organisationId)) : null;
            const walkovers = await list("walkovers", `PartitionKey eq '${escapeOData(String(share.projectId))}'`);
            const walkoverIds = new Set(walkovers.map((item) => String(item.id)));
            const files = (await list("files")).filter((item) => walkoverIds.has(String(item.walkoverId))).map((item) => ({ ...item, url: `/api/files/${item.id}?share=${request.params.token}` }));
            const observations = (await list("observations")).filter((item) => walkoverIds.has(String(item.walkoverId)));
            return { jsonBody: { organisation, place, project, walkovers, files, observations } };
        }
        catch (error) {
            if (error.statusCode === 404)
                return { status: 404, jsonBody: { error: "Share code not found" } };
            throw error;
        }
    }
});
app.http("resolveProjectCode", {
    methods: ["GET"], authLevel: "anonymous", route: "project-code/{code}",
    handler: async (request) => {
        await ensureTables();
        const code = exactCode(request.params.code);
        if (!code)
            return { status: 400, jsonBody: { error: "Code must contain exactly 10 letters or numbers" } };
        const matches = await list("shares", `code eq '${escapeOData(code)}' and revoked eq false`);
        const active = matches.find((item) => new Date(String(item.expiresAt)).getTime() > Date.now());
        return active ? { jsonBody: { token: active.token } } : { status: 404, jsonBody: { error: "Code is invalid or expired" } };
    }
});
async function findByRowKey(name, id) {
    return (await list(name, `RowKey eq '${escapeOData(id)}'`))[0] || null;
}
//# sourceMappingURL=shares.js.map