import { describe, expect, it } from "vitest";
import {
  decryptBackupPayload,
  encryptBackupPayload,
  inspectBackupFormat,
  MAX_BACKUP_PAYLOAD_BYTES,
} from "./backupCrypto";

describe("encrypted backup format", () => {
  const password = "correct horse battery staple";
  const plaintext = "教材正文：离散数学命题与逻辑";

  it("round-trips without exposing plaintext and uses fresh randomness", async () => {
    const source = new Blob([plaintext]);
    const first = await encryptBackupPayload(source, password);
    const second = await encryptBackupPayload(source, password);

    expect(await inspectBackupFormat(first)).toBe("encrypted-v2");
    expect(await first.text()).not.toContain(plaintext);
    expect(await first.text()).not.toBe(await second.text());
    await expect(
      decryptBackupPayload(first, password).then((blob) => blob.text()),
    ).resolves.toBe(plaintext);
  });

  it("returns the same safe error for a wrong password or tampering", async () => {
    const encrypted = await encryptBackupPayload(
      new Blob([plaintext]),
      password,
    );
    await expect(
      decryptBackupPayload(encrypted, "this password is definitely wrong"),
    ).rejects.toThrow("备份密码错误或文件已损坏");

    const bytes = new Uint8Array(await encrypted.arrayBuffer());
    bytes[bytes.length - 1] ^= 1;
    await expect(
      decryptBackupPayload(new Blob([bytes]), password),
    ).rejects.toThrow("备份密码错误或文件已损坏");

    const damagedMagic = new Uint8Array(await encrypted.arrayBuffer());
    damagedMagic[0] ^= 1;
    await expect(inspectBackupFormat(new Blob([damagedMagic]))).rejects.toThrow(
      "备份密码错误或文件已损坏",
    );
  });

  it("recognizes legacy zip payloads without treating them as encrypted", async () => {
    await expect(
      inspectBackupFormat(new Blob(["PK\u0003\u0004legacy"])),
    ).resolves.toBe("legacy-v1");
  });

  it("rejects export passwords shorter than twelve characters", async () => {
    await expect(
      encryptBackupPayload(new Blob(["payload"]), "too-short"),
    ).rejects.toThrow("至少需要 12 个字符");
  });

  it("rejects an oversized plaintext payload before reading it into memory", async () => {
    const oversized = {
      size: MAX_BACKUP_PAYLOAD_BYTES + 1,
      arrayBuffer: () => {
        throw new Error("payload should not be read");
      },
    } as unknown as Blob;

    await expect(encryptBackupPayload(oversized, password)).rejects.toThrow(
      "超过 256 MB 上限",
    );
  });
});
