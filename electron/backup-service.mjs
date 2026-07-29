import { createCipheriv, pbkdf2Sync, randomBytes } from "node:crypto";
import { mkdir, readFile, readdir, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

const MAGIC = Buffer.from("ZHIYE-BACKUP-V2\n", "utf8");
const ITERATIONS = 600_000;

export class BackupService {
  constructor({ userData, safeStorage }) {
    this.configPath = path.join(userData, "auto-backup.json");
    this.safeStorage = safeStorage;
  }

  async settings() {
    try {
      const value = JSON.parse(await readFile(this.configPath, "utf8"));
      return {
        enabled: Boolean(value.enabled),
        directory: typeof value.directory === "string" ? value.directory : "",
        retention: Number(value.retention) || 7,
        lastBackupAt: Number(value.lastBackupAt) || 0,
      };
    } catch {
      return { enabled: false, directory: "", retention: 7, lastBackupAt: 0 };
    }
  }

  async configure({ directory, passphrase, enabled }) {
    if (enabled && (!directory || String(passphrase || "").length < 12)) {
      throw new Error("自动备份需要目录和至少 12 个字符的密码");
    }
    const previous = await this.readRaw();
    const encryptedPassphrase = passphrase
      ? this.safeStorage.encryptString(String(passphrase)).toString("base64")
      : previous.encryptedPassphrase || "";
    await mkdir(path.dirname(this.configPath), { recursive: true });
    await writeFile(
      this.configPath,
      JSON.stringify({
        ...previous,
        enabled: Boolean(enabled),
        directory: directory || previous.directory || "",
        retention: 7,
        encryptedPassphrase,
      }),
      { encoding: "utf8", mode: 0o600 },
    );
    return this.settings();
  }

  async writePortableBackup(payload) {
    const raw = await this.readRaw();
    if (!raw.enabled || !raw.directory || !raw.encryptedPassphrase) return false;
    const passphrase = this.safeStorage.decryptString(
      Buffer.from(raw.encryptedPassphrase, "base64"),
    );
    const encrypted = encryptPayload(Buffer.from(payload), passphrase);
    await mkdir(raw.directory, { recursive: true });
    const date = new Date().toISOString().slice(0, 10);
    const target = path.join(raw.directory, `知页自动备份-${date}.zhiye-backup`);
    const temporary = `${target}.tmp`;
    await writeFile(temporary, encrypted);
    await rename(temporary, target);
    await rotate(raw.directory, Number(raw.retention) || 7);
    await this.configure({
      directory: raw.directory,
      enabled: true,
      passphrase: "",
    });
    const next = await this.readRaw();
    next.lastBackupAt = Date.now();
    await writeFile(this.configPath, JSON.stringify(next), {
      encoding: "utf8",
      mode: 0o600,
    });
    return true;
  }

  async readRaw() {
    try {
      return JSON.parse(await readFile(this.configPath, "utf8"));
    } catch {
      return {};
    }
  }
}

export function encryptPayload(payload, passphrase) {
  if (String(passphrase).length < 12) throw new Error("备份密码过短");
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const header = {
    version: 2,
    kdf: "PBKDF2-HMAC-SHA256",
    iterations: ITERATIONS,
    salt: salt.toString("base64"),
    cipher: "AES-256-GCM",
    iv: iv.toString("base64"),
  };
  const headerBytes = Buffer.from(JSON.stringify(header));
  const key = pbkdf2Sync(passphrase, salt, ITERATIONS, 32, "sha256");
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(headerBytes);
  const ciphertext = Buffer.concat([
    cipher.update(payload),
    cipher.final(),
    cipher.getAuthTag(),
  ]);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(headerBytes.length);
  return Buffer.concat([MAGIC, length, headerBytes, ciphertext]);
}

async function rotate(directory, retention) {
  const files = (await readdir(directory))
    .filter((name) => /^知页自动备份-\d{4}-\d{2}-\d{2}\.zhiye-backup$/.test(name))
    .sort()
    .reverse();
  await Promise.all(
    files.slice(retention).map((name) => unlink(path.join(directory, name))),
  );
}
