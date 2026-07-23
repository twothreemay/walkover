import { TableClient } from "@azure/data-tables";
import { BlobServiceClient } from "@azure/storage-blob";

function connectionString() {
  const value = process.env.AZURE_STORAGE_CONNECTION_STRING;
  if (!value) throw new Error("AZURE_STORAGE_CONNECTION_STRING is not configured");
  return value;
}

export const projectsTable = () => TableClient.fromConnectionString(connectionString(), "walkoverprojects");
export const observationsTable = () => TableClient.fromConnectionString(connectionString(), "walkoverobservations");
export const sharesTable = () => TableClient.fromConnectionString(connectionString(), "walkovershares");
export const filesTable = () => TableClient.fromConnectionString(connectionString(), "walkoverfiles");

export async function ensureTables() {
  await Promise.all([projectsTable(), observationsTable(), sharesTable(), filesTable()].map((table) => table.createTable().catch((error: { statusCode?: number }) => {
    if (error.statusCode !== 409) throw error;
  })));
}

export async function modelsContainer() {
  const name = process.env.AZURE_STORAGE_CONTAINER || "walkover-files";
  const container = BlobServiceClient.fromConnectionString(connectionString()).getContainerClient(name);
  await container.createIfNotExists();
  return container;
}

export function entity<T extends object>(value: T) {
  const { partitionKey: _partitionKey, rowKey: _rowKey, etag: _etag, timestamp: _timestamp, ...rest } = value as T & {
    partitionKey?: string; rowKey?: string; etag?: string; timestamp?: Date;
  };
  return rest;
}

export function safeName(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 140);
}
