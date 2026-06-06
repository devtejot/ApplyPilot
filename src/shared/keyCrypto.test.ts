// @vitest-environment node
import { describe, it, expect } from "vitest";
import { encryptKey, decryptKey } from "./keyCrypto";

describe("keyCrypto", () => {
  it("round-trips a key with the correct passphrase", async () => {
    const enc = await encryptKey("sk-ant-secret-123", "hunter2");
    expect(enc.ciphertext).toBeTruthy();
    expect(await decryptKey(enc, "hunter2")).toBe("sk-ant-secret-123");
  });

  it("rejects a wrong passphrase", async () => {
    const enc = await encryptKey("sk-ant-secret-123", "hunter2");
    await expect(decryptKey(enc, "wrong")).rejects.toBeTruthy();
  });

  it("uses a fresh salt + iv each time", async () => {
    const a = await encryptKey("k", "p");
    const b = await encryptKey("k", "p");
    expect(a.salt).not.toBe(b.salt);
    expect(a.iv).not.toBe(b.iv);
  });
});
