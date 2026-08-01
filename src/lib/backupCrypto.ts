const MAGIC = new TextEncoder().encode("ZHIYE-BACKUP-V2\n");
const PBKDF2_ITERATIONS = 600_000;
const MIN_PASSPHRASE_LENGTH = 12;
export const MAX_BACKUP_PAYLOAD_BYTES = 256 * 1024 * 1024;
const MAX_ENCRYPTED_BACKUP_BYTES = MAX_BACKUP_PAYLOAD_BYTES + 64 * 1024;
const LEGACY_ZIP_SIGNATURES = [
  [0x50, 0x4b, 0x03, 0x04],
  [0x50, 0x4b, 0x05, 0x06],
  [0x50, 0x4b, 0x07, 0x08],
] as const;
const DECRYPTION_FAILURE = "备份密码错误或文件已损坏";

interface EncryptedBackupHeader {
  version: 2;
  kdf: "PBKDF2-HMAC-SHA256";
  iterations: number;
  salt: string;
  cipher: "AES-256-GCM";
  iv: string;
}

export type BackupFormat = "encrypted-v2" | "legacy-v1";

export function validateBackupPassphrase(passphrase: string): void {
  if (passphrase.length < MIN_PASSPHRASE_LENGTH) {
    throw new Error(`备份密码至少需要 ${MIN_PASSPHRASE_LENGTH} 个字符`);
  }
}

export async function inspectBackupFormat(blob: Blob): Promise<BackupFormat> {
  const prefix = new Uint8Array(
    await blob.slice(0, MAGIC.length).arrayBuffer(),
  );
  if (equalBytes(prefix, MAGIC)) return "encrypted-v2";
  if (
    LEGACY_ZIP_SIGNATURES.some((signature) =>
      equalBytes(
        prefix.subarray(0, signature.length),
        Uint8Array.from(signature),
      ),
    )
  ) {
    return "legacy-v1";
  }
  throw new Error(DECRYPTION_FAILURE);
}

export async function encryptBackupPayload(
  payload: Blob,
  passphrase: string,
): Promise<Blob> {
  validateBackupPassphrase(passphrase);
  if (payload.size > MAX_BACKUP_PAYLOAD_BYTES) {
    throw new Error("完整备份超过 256 MB 上限，请减少教材后重试");
  }
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const header: EncryptedBackupHeader = {
    version: 2,
    kdf: "PBKDF2-HMAC-SHA256",
    iterations: PBKDF2_ITERATIONS,
    salt: toBase64(salt),
    cipher: "AES-256-GCM",
    iv: toBase64(iv),
  };
  const headerBytes = new TextEncoder().encode(JSON.stringify(header));
  const key = await deriveKey(passphrase, salt, header.iterations);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: headerBytes },
    key,
    await payload.arrayBuffer(),
  );
  const length = new Uint8Array(4);
  new DataView(length.buffer).setUint32(0, headerBytes.length, false);
  return new Blob([MAGIC, length, headerBytes, ciphertext], {
    type: "application/octet-stream",
  });
}

export async function decryptBackupPayload(
  backup: Blob,
  passphrase: string,
): Promise<Blob> {
  try {
    if (backup.size > MAX_ENCRYPTED_BACKUP_BYTES) {
      throw new Error("oversized");
    }
    const bytes = new Uint8Array(await backup.arrayBuffer());
    if (!equalBytes(bytes.subarray(0, MAGIC.length), MAGIC)) {
      throw new Error("not-encrypted");
    }
    const headerLength = new DataView(
      bytes.buffer,
      bytes.byteOffset + MAGIC.length,
      4,
    ).getUint32(0, false);
    const headerStart = MAGIC.length + 4;
    const headerEnd = headerStart + headerLength;
    if (headerLength < 2 || headerEnd >= bytes.length)
      throw new Error("header");
    const headerBytes = bytes.subarray(headerStart, headerEnd);
    const header = JSON.parse(
      new TextDecoder().decode(headerBytes),
    ) as EncryptedBackupHeader;
    if (
      header.version !== 2 ||
      header.kdf !== "PBKDF2-HMAC-SHA256" ||
      header.cipher !== "AES-256-GCM" ||
      header.iterations !== PBKDF2_ITERATIONS
    ) {
      throw new Error("header");
    }
    const salt = fromBase64(header.salt);
    const iv = fromBase64(header.iv);
    if (salt.length !== 16 || iv.length !== 12) throw new Error("header");
    const key = await deriveKey(passphrase, salt, header.iterations);
    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv, additionalData: headerBytes },
      key,
      bytes.subarray(headerEnd),
    );
    return new Blob([plaintext], { type: "application/zip" });
  } catch {
    throw new Error(DECRYPTION_FAILURE);
  }
}

async function deriveKey(
  passphrase: string,
  salt: Uint8Array<ArrayBuffer>,
  iterations: number,
): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

function equalBytes(left: Uint8Array, right: Uint8Array): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function toBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}

function fromBase64(value: string): Uint8Array<ArrayBuffer> {
  const decoded = atob(value);
  return Uint8Array.from(decoded, (character) => character.charCodeAt(0));
}
