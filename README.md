# Walkover

Azure-backed React/Vite application for managing and sharing highway reality
captures.

## Architecture

- Vite and React front end, built to `dist`
- Azure Static Web Apps Microsoft Entra ID authentication
- Static Web Apps `admin` role for all administration routes and APIs
- Azure Functions v4 API in `api/`
- Azure Table Storage for projects, observations, share links and file metadata
- Private Azure Blob Storage container for Polycam models and site images

No application credentials or administrator passwords are stored in the front
end. Static Web Apps supplies the signed `x-ms-client-principal` identity to the
Functions API. The API independently checks the `admin` role before every
administrative operation.

## Build

```bash
npm install
npm run build

cd api
npm install
npm run build
```

The front-end deployment output is `dist`.

## Azure Static Web Apps settings

The included GitHub Actions workflow uses:

- App location: `/`
- API location: `api`
- Output location: `dist`

Add these application settings to the Static Web App:

| Setting | Purpose |
| --- | --- |
| `AZURE_STORAGE_CONNECTION_STRING` | Table and Blob Storage connection |
| `AZURE_STORAGE_CONTAINER` | Optional private Blob container name; defaults to `walkover-files` |

The storage account connection string is server-only. Do not prefix it with
`VITE_` or expose it to the browser.

## Authentication and administrator role

1. Deploy the Static Web App.
2. Open `/.auth/login/aad` to sign in with Microsoft Entra ID.
3. In the Azure portal, open the Static Web App's **Role management** page.
4. Invite the required account and assign the custom role `admin`.
5. Sign out and back in so the new role is included in the principal.

`staticwebapp.config.json` protects `/admin` and `/api/projects*` with the
`admin` role. Public project viewers only receive data through an active,
unrevoked and unexpired share token.

## Local development

Use Azure Static Web Apps CLI with Azurite and an emulated authenticated
principal when testing the complete application locally. Copy
`api/local.settings.example.json` to `api/local.settings.json` and insert an
Azurite or development storage connection string. Never commit the resulting
file.
