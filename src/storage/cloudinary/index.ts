import type { ClientStorageAdapter } from "better-content/core";

export interface CloudinaryClientConfig {
  folder?: string;
  signEndpoint?: string;
}

export function cloudinaryStorage(
  config: CloudinaryClientConfig = {},
): ClientStorageAdapter {
  const folder = config.folder ?? "uploads";
  const signEndpoint = config.signEndpoint ?? "/api/admin/sign";

  return {
    async upload(file: File) {
      const signRes = await fetch(signEndpoint, { method: "POST" });
      if (!signRes.ok) throw new Error("Failed to get upload signature");
      const { timestamp, signature, folder: signedFolder, cloudName, apiKey } =
        await signRes.json();

      const formData = new FormData();
      formData.append("file", file);
      formData.append("api_key", apiKey);
      formData.append("timestamp", String(timestamp));
      formData.append("signature", signature);
      formData.append("folder", signedFolder ?? folder);

      const uploadRes = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`,
        { method: "POST", body: formData },
      );
      if (!uploadRes.ok) throw new Error("Cloudinary upload failed");
      const data = await uploadRes.json();
      return { url: data.secure_url as string };
    },
  };
}
