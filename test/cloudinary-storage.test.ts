import { afterEach, describe, expect, it, vi } from "vitest";
import { cloudinaryStorage } from "../src/storage/cloudinary";
import { cloudinarySign } from "../src/storage/cloudinary/server";

afterEach(() => vi.unstubAllGlobals());

describe("cloudinaryStorage", () => {
  it("uses the server-signed folder instead of duplicated client configuration", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          timestamp: 1,
          signature: "signature",
          folder: "server-folder",
          cloudName: "demo",
          apiKey: "key",
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ secure_url: "https://cdn.test/image.png" }),
      });
    vi.stubGlobal("fetch", fetch);

    const storage = cloudinaryStorage({ folder: "stale-client-folder" });
    const result = await storage.upload(new File(["image"], "image.png"));

    expect(result).toEqual({ url: "https://cdn.test/image.png" });
    expect(fetch.mock.calls[0]![0]).toBe("/api/admin/sign");
    expect(fetch.mock.calls[1]![0]).toBe(
      "https://api.cloudinary.com/v1_1/demo/auto/upload",
    );
    const uploadBody = fetch.mock.calls[1]![1].body as FormData;
    expect(uploadBody.get("folder")).toBe("server-folder");
  });

  it("throws when the sign endpoint fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    await expect(
      cloudinaryStorage().upload(new File(["x"], "x.png")),
    ).rejects.toThrow("Failed to get upload signature");
  });
});

describe("cloudinarySign", () => {
  it("returns a signed payload carrying the configured folder", async () => {
    const signer = cloudinarySign({
      cloudName: "demo",
      apiKey: "key",
      apiSecret: "secret",
      folder: "custom",
    });
    const payload = (await signer.sign(
      new Request("http://test/api/admin/sign", { method: "POST" }),
    )) as Record<string, unknown>;

    expect(payload).toMatchObject({
      folder: "custom",
      cloudName: "demo",
      apiKey: "key",
    });
    expect(typeof payload.timestamp).toBe("number");
    expect(typeof payload.signature).toBe("string");
    expect((payload.signature as string).length).toBeGreaterThan(0);
  });
});
