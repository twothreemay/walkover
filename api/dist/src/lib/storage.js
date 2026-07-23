import { TableClient } from "@azure/data-tables";
import { BlobServiceClient } from "@azure/storage-blob";
const TABLES = {
    organisations: "tporganisations",
    places: "tpplaces",
    projects: "tpprojects",
    walkovers: "tpwalkovers",
    observations: "tpobservations",
    shares: "tpshares",
    files: "tpfiles",
    history: "tphistory"
};
function connectionString() {
    const value = process.env.AZURE_STORAGE_CONNECTION_STRING;
    if (!value)
        throw new Error("AZURE_STORAGE_CONNECTION_STRING is not configured");
    return value;
}
export function table(name) {
    return TableClient.fromConnectionString(connectionString(), TABLES[name]);
}
export async function ensureTables() {
    await Promise.all(Object.keys(TABLES).map(async (name) => {
        try {
            await table(name).createTable();
        }
        catch (error) {
            if (error.statusCode !== 409)
                throw error;
        }
    }));
}
export async function filesContainer() {
    const name = process.env.AZURE_STORAGE_CONTAINER || "twinplaces-files";
    const container = BlobServiceClient.fromConnectionString(connectionString()).getContainerClient(name);
    await container.createIfNotExists();
    return container;
}
export function clean(value) {
    const { partitionKey: _partitionKey, rowKey: _rowKey, etag: _etag, timestamp: _timestamp, ...rest } = value;
    return rest;
}
export async function list(name, filter) {
    const results = [];
    for await (const item of table(name).listEntities({ queryOptions: filter ? { filter } : undefined }))
        results.push(clean(item));
    return results;
}
export function escapeOData(value) {
    return value.replaceAll("'", "''");
}
export function safeName(value) {
    return value.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 140);
}
export async function history(scopeId, type, action, actor, summary) {
    const id = `${Date.now().toString().padStart(16, "0")}-${crypto.randomUUID()}`;
    await table("history").createEntity({
        partitionKey: scopeId, rowKey: id, id, scopeId, type, action, actor, summary, createdAt: new Date().toISOString()
    });
}
export function exactCode(value) {
    const code = value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 10);
    return code.length === 10 ? code : null;
}
//# sourceMappingURL=storage.js.map