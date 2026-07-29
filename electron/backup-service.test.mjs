import { describe, expect, it } from "vitest";
import { decryptBackupPayload } from "../src/lib/backupCrypto";
import { encryptPayload } from "./backup-service.mjs";

describe("desktop automatic backup format", () => {
  it("writes the same encrypted format as manual backups", async () => {
    const plaintext = Buffer.from("portable backup payload");
    const encrypted = encryptPayload(
      plaintext,
      "correct horse battery staple",
    );
    const restored = await decryptBackupPayload(
      new Blob([encrypted]),
      "correct horse battery staple",
    );

    expect(Buffer.from(await restored.arrayBuffer()).toString()).toBe(
      "portable backup payload",
    );
  });
});
