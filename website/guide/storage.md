# Image storage

Storage has two halves by design, so server SDKs and secrets never end up in
client bundles:

```ts
interface ClientStorageAdapter {           // browser side
  upload(file: File): Promise<{ url: string }>;
}

interface ServerStorageAdapter {           // server side
  sign(req: Request): Promise<unknown>;
}
```

The client half performs the upload (usually straight to the storage
provider) after asking your server for a short-lived signature. The server
half issues that signature. The route factory mounts it for you.

## Cloudinary, built in

Client:

```tsx
import { cloudinaryStorage } from "better-content/storage/cloudinary";

<PageProvider
  transport={restTransport()}
  storage={cloudinaryStorage({ signEndpoint: "/api/admin/sign" })} // default shown
>
```

Server, mounted through the handlers:

```ts
// app/api/admin/sign/route.ts
import { createCmsHandlers } from "better-content/server";
import { cloudinarySign } from "better-content/storage/cloudinary/server";

export const POST = createCmsHandlers({
  data,
  auth,
  storage: cloudinarySign({
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    apiSecret: process.env.CLOUDINARY_API_SECRET,
    folder: "uploads",
  }),
}).sign;
```

Flow: the client requests a signature from `signEndpoint` (a POST behind the
same admin gate as every write), then posts the file directly to Cloudinary
with it. The folder returned by the server signer is authoritative; client
configuration cannot redirect uploads. Your API never proxies file bytes.

Peer: `cloudinary` (server half only; the client half is pure fetch).

## When uploads happen

Never on selection. `EditableImage` queues the file and shows a local
preview; the actual upload runs inside the save flush, and the hosted URL is
written into the item just before it persists. Abandoned edits never create
orphaned files. See [the editing model](/guide/editing-model).

## Bringing your own storage

For the engine, only the client half is required, and it is one method.
Upload anywhere that gives you back a URL:

```ts
const s3Storage: ClientStorageAdapter = {
  async upload(file) {
    const { uploadUrl, publicUrl } = await fetch("/api/admin/sign", { method: "POST" })
      .then(r => r.json());
    await fetch(uploadUrl, { method: "PUT", body: file });
    return { url: publicUrl };
  },
};
```

The live demo's storage adapter is four lines: it turns the file into a data
URL and stores it in the database, which is exactly right for a
self-contained demo and exactly wrong for production. The seam does not
care.
