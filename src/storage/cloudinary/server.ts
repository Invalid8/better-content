import { v2 as cloudinary } from "cloudinary";
import type { ServerStorageAdapter } from "better-content/core";

export interface CloudinaryServerConfig {
  cloudName?: string;
  apiKey?: string;
  apiSecret?: string;
  folder?: string;
}

export function cloudinarySign(
  config: CloudinaryServerConfig = {},
): ServerStorageAdapter {
  const folder = config.folder ?? "uploads";

  return {
    async sign() {
      cloudinary.config({
        ...(config.cloudName !== undefined && { cloud_name: config.cloudName }),
        ...(config.apiKey !== undefined && { api_key: config.apiKey }),
        ...(config.apiSecret !== undefined && { api_secret: config.apiSecret }),
      });
      const timestamp = Math.floor(Date.now() / 1000);
      const signature = cloudinary.utils.api_sign_request(
        { timestamp, folder },
        config.apiSecret!,
      );
      return {
        timestamp,
        signature,
        folder,
        cloudName: config.cloudName,
        apiKey: config.apiKey,
      };
    },
  };
}
