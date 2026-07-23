import { app } from "@azure/functions";
import { adminName, adminRequired } from "../lib/auth.js";
import { clean, ensureTables, escapeOData, history, list, table } from "../lib/storage.js";
app.http("observations", {
    methods: ["GET", "POST"], authLevel: "anonymous", route: "walkovers/{walkoverId}/observations",
    handler: async (request) => {
        const denied = adminRequired(request);
        if (denied)
            return denied;
        await ensureTables();
        if (request.method === "GET")
            return { jsonBody: { observations: await list("observations", `PartitionKey eq '${escapeOData(request.params.walkoverId)}'`) } };
        const body = await request.json();
        if (!body.title?.trim())
            return { status: 400, jsonBody: { error: "Title is required" } };
        const id = crypto.randomUUID();
        const now = new Date().toISOString();
        const item = { partitionKey: request.params.walkoverId, rowKey: id, id, walkoverId: request.params.walkoverId, title: body.title.trim(), category: body.category || "General", recordType: body.recordType || "Observation", status: body.status || "Open", notes: body.notes || "", assignee: body.assignee || "", dueDate: body.dueDate || "", position: body.position || "", createdAt: now, updatedAt: now };
        await table("observations").createEntity(item);
        await history(request.params.walkoverId, "observation", "created", adminName(request), item.title);
        return { status: 201, jsonBody: { observation: clean(item) } };
    }
});
app.http("observationById", {
    methods: ["PATCH", "DELETE"], authLevel: "anonymous", route: "walkovers/{walkoverId}/observations/{id}",
    handler: async (request) => {
        const denied = adminRequired(request);
        if (denied)
            return denied;
        if (request.method === "DELETE") {
            await table("observations").deleteEntity(request.params.walkoverId, request.params.id);
            await history(request.params.walkoverId, "observation", "deleted", adminName(request), request.params.id);
            return { status: 204 };
        }
        const body = await request.json();
        await table("observations").updateEntity({ partitionKey: request.params.walkoverId, rowKey: request.params.id, ...body, updatedAt: new Date().toISOString() }, "Merge");
        await history(request.params.walkoverId, "observation", "updated", adminName(request), body.title || request.params.id);
        return { status: 204 };
    }
});
//# sourceMappingURL=observations.js.map