import { app } from "@azure/functions";
import { adminName, adminRequired } from "../lib/auth.js";
import { clean, ensureTables, escapeOData, history, list, table } from "../lib/storage.js";
app.http("walkovers", {
    methods: ["GET", "POST"], authLevel: "anonymous", route: "projects/{projectId}/walkovers",
    handler: async (request) => {
        const denied = adminRequired(request);
        if (denied)
            return denied;
        await ensureTables();
        if (request.method === "GET")
            return { jsonBody: { walkovers: await list("walkovers", `PartitionKey eq '${escapeOData(request.params.projectId)}'`) } };
        const body = await request.json();
        if (!body.title?.trim() || !body.surveyDate)
            return { status: 400, jsonBody: { error: "Walkover title and survey date are required" } };
        const id = crypto.randomUUID();
        const now = new Date().toISOString();
        const item = { partitionKey: request.params.projectId, rowKey: id, id, projectId: request.params.projectId, title: body.title.trim(), surveyDate: body.surveyDate, surveyType: body.surveyType || "Site walkover", surveyor: body.surveyor || "", captureMethod: body.captureMethod || "", notes: body.notes || "", createdAt: now, updatedAt: now };
        await table("walkovers").createEntity(item);
        await history(request.params.projectId, "walkover", "created", adminName(request), item.title);
        return { status: 201, jsonBody: { walkover: clean(item) } };
    }
});
app.http("walkoverById", {
    methods: ["PATCH"], authLevel: "anonymous", route: "projects/{projectId}/walkovers/{id}",
    handler: async (request) => {
        const denied = adminRequired(request);
        if (denied)
            return denied;
        const body = await request.json();
        await table("walkovers").updateEntity({ partitionKey: request.params.projectId, rowKey: request.params.id, ...body, updatedAt: new Date().toISOString() }, "Merge");
        await history(request.params.projectId, "walkover", "updated", adminName(request), String(body.title || "Walkover updated"));
        return { status: 204 };
    }
});
//# sourceMappingURL=walkovers.js.map