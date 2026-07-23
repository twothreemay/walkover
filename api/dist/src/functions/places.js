import { app } from "@azure/functions";
import { adminName, adminRequired } from "../lib/auth.js";
import { clean, ensureTables, escapeOData, history, list, table } from "../lib/storage.js";
app.http("places", {
    methods: ["GET", "POST"], authLevel: "anonymous", route: "places",
    handler: async (request) => {
        const denied = adminRequired(request);
        if (denied)
            return denied;
        await ensureTables();
        if (request.method === "GET") {
            const organisationId = request.query.get("organisationId");
            return { jsonBody: { places: await list("places", organisationId ? `organisationId eq '${escapeOData(organisationId)}'` : undefined) } };
        }
        const body = await request.json();
        if (!body.organisationId || !body.name?.trim())
            return { status: 400, jsonBody: { error: "Organisation and place name are required" } };
        const id = crypto.randomUUID();
        const now = new Date().toISOString();
        const item = { partitionKey: body.organisationId, rowKey: id, id, organisationId: body.organisationId, name: body.name.trim(), placeType: body.placeType || "Area", location: body.location || "", description: body.description || "", createdAt: now, updatedAt: now };
        await table("places").createEntity(item);
        await history(id, "place", "created", adminName(request), item.name);
        return { status: 201, jsonBody: { place: clean(item) } };
    }
});
app.http("placeById", {
    methods: ["PATCH"], authLevel: "anonymous", route: "places/{organisationId}/{id}",
    handler: async (request) => {
        const denied = adminRequired(request);
        if (denied)
            return denied;
        const body = await request.json();
        await table("places").updateEntity({ partitionKey: request.params.organisationId, rowKey: request.params.id, ...body, updatedAt: new Date().toISOString() }, "Merge");
        await history(request.params.id, "place", "updated", adminName(request), String(body.name || "Place updated"));
        return { status: 204 };
    }
});
//# sourceMappingURL=places.js.map