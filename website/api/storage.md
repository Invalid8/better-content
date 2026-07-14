# Storage

## better-content/storage/cloudinary (client)

```ts
function cloudinaryStorage(config?: CloudinaryClientConfig): ClientStorageAdapter;

interface CloudinaryClientConfig {
  signEndpoint?: string;   // default "/api/admin/sign"
  folder?: string;         // legacy fallback; the server-signed folder wins
}
```

Pure fetch, safe in client components. `upload(file)`:

1. POSTs to `signEndpoint` for `{ timestamp, signature, folder, cloudName, apiKey }`,
2. posts the file directly to
   `https://api.cloudinary.com/v1_1/{cloudName}/auto/upload`,
3. resolves `{ url: secure_url }`.

Throws on a failed signature request or a failed upload. The folder returned
by the signer overrides any client-side folder.

## better-content/storage/cloudinary/server

```ts
function cloudinarySign(config?: CloudinaryServerConfig): ServerStorageAdapter;

interface CloudinaryServerConfig {
  cloudName?: string;
  apiKey?: string;
  apiSecret?: string;
  folder?: string;         // default "uploads"
}
```

Issues the upload signature. Imports the Cloudinary SDK, so import it only
from server code; mount it through `createCmsHandlers({ storage }).sign`,
which puts it behind the admin gate.

Peer: `cloudinary` >= 2 (server half only).
