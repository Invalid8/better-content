# Storage

Cloudinary is the only provider that ships today. More are being added
gradually.

As with auth, the seam is small. A client storage adapter is one method, and
`EditableImage` never learns where the bytes went:

```ts
import type { ClientStorageAdapter } from "better-content/core";

export const storage: ClientStorageAdapter = {
  async upload(file) {
    // sign on your server, post the file, return the public URL
    return { url: await putSomewhere(file) };
  },
};
```

S3, R2, UploadThing, or your own endpoint all fit that shape. Keep the
credentials on the server and hand the browser a short-lived signature, which
is what the Cloudinary adapter below does.

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
