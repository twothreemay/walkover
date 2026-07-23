# TwinPlaces

TwinPlaces is a place-based digital twin prototype for local authorities,
engineering consultants and asset owners. A **Place** is the long-term
container for projects, site walkovers, reality and design models, inspections,
observations, documents and change over time.

## Architecture

- React and Vite front end
- Azure Static Web Apps, output directory `dist`
- Azure Functions v4 in `api`
- Azure Table Storage repositories for organisations, places, projects,
  walkovers, observations/actions, shares, files and history
- Private Azure Blob Storage for models, photographs and documents
- Standalone administrator login with a bcrypt hash held only in Azure settings
- Signed, Secure, HttpOnly, SameSite=Strict session cookie

The storage layer is isolated behind Functions so it can later be replaced by
PostgreSQL, Azure SQL or Cosmos DB without rebuilding the React interface.

## Build

```bash
npm ci
npm run build

cd api
npm ci
npm run build
```

The Static Web Apps workflow uses:

- `app_location: /`
- `api_location: api`
- `output_location: dist`

## Required Azure environment variables

| Variable | Purpose |
| --- | --- |
| `ADMIN_USERNAME` | Standalone administrator username |
| `ADMIN_PASSWORD_HASH` | bcrypt hash of the administrator password |
| `SESSION_SECRET` | Random secret of at least 32 characters used to sign sessions |
| `AZURE_STORAGE_CONNECTION_STRING` | Server-side Table and Blob Storage connection |

Optional: `AZURE_STORAGE_CONTAINER` changes the private Blob container name
from its default, `twinplaces-files`.

Generate the bcrypt password hash outside the repository using your approved
secrets-management process. Never commit a real password, hash, connection
string or session secret.
