# Walkover

Standalone React and Vite prototype for exploring highway reality captures.

## Requirements

- Node.js 20 or later
- npm

## Run locally

```bash
npm install
npm run dev
```

## Production build

```bash
npm run build
```

The deployable static site is written to `dist/`.

## Azure Static Web Apps

Use these build settings:

- App location: `/`
- Build command: `npm run build`
- Output location: `dist`

`staticwebapp.config.json` provides the single-page application fallback and
GLB/GLTF MIME types required by the 3D viewer.

## Prototype data

This standalone package does not require OpenAI Sites, Cloudflare, D1, R2, or
Next.js. Projects created in the admin screen are stored in the current
browser's local storage. A model selected from the admin screen is available
for the current browser session. For a multi-user production service, connect
the interface to Azure Entra ID, Azure SQL/Cosmos DB, and Azure Blob Storage.
