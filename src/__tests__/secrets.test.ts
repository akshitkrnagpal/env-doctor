import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { detectSecrets } from "../core/secrets.js";
import { mkdtemp, writeFile, rm, mkdir } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";

describe("detectSecrets", () => {
  let tempDir: string;

  beforeAll(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "env-doctor-secrets-"));
  });

  afterAll(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  test("detects AWS access keys", async () => {
    const filePath = join(tempDir, "config.ts");
    await writeFile(
      filePath,
      `const key = "AKIAIOSFODNN7EXAMPLE";`,
    );

    const result = await detectSecrets({ dir: tempDir });
    expect(result.secrets.length).toBeGreaterThan(0);
    expect(result.secrets[0]!.pattern).toBe("AWS Access Key");
    expect(result.secrets[0]!.severity).toBe("high");
  });

  test("detects Stripe secret keys", async () => {
    const filePath = join(tempDir, "payment.ts");
    await writeFile(
      filePath,
      `const stripe = new Stripe("sk_live_abcdefghijklmnopqrstuv");`,
    );

    const result = await detectSecrets({ dir: tempDir });
    const stripeSecrets = result.secrets.filter(
      (s) => s.pattern === "Stripe Secret Key",
    );
    expect(stripeSecrets.length).toBeGreaterThan(0);
  });

  test("detects hardcoded passwords", async () => {
    const filePath = join(tempDir, "db.ts");
    await writeFile(
      filePath,
      `const config = { password: "super_secret_password_123" };`,
    );

    const result = await detectSecrets({ dir: tempDir });
    const passwordMatches = result.secrets.filter(
      (s) => s.pattern === "Hardcoded Password",
    );
    expect(passwordMatches.length).toBeGreaterThan(0);
  });

  test("detects database connection strings with passwords", async () => {
    const filePath = join(tempDir, "database.ts");
    await writeFile(
      filePath,
      `const url = "postgres://user:password123@host:5432/db";`,
    );

    const result = await detectSecrets({ dir: tempDir });
    const dbMatches = result.secrets.filter(
      (s) => s.pattern === "Database URL with Password",
    );
    expect(dbMatches.length).toBeGreaterThan(0);
  });

  test("detects private keys", async () => {
    const filePath = join(tempDir, "key.ts");
    await writeFile(
      filePath,
      `const key = "-----BEGIN RSA PRIVATE KEY-----";`,
    );

    const result = await detectSecrets({ dir: tempDir });
    const keyMatches = result.secrets.filter(
      (s) => s.pattern === "Private Key",
    );
    expect(keyMatches.length).toBeGreaterThan(0);
  });

  test("skips comment lines", async () => {
    const subDir = join(tempDir, "comments");
    await mkdir(subDir, { recursive: true });
    const filePath = join(subDir, "clean.ts");
    await writeFile(
      filePath,
      `// password: "this is just a comment"
# token: "also a comment"
const x = 42;`,
    );

    const result = await detectSecrets({ dir: subDir });
    expect(result.secrets).toHaveLength(0);
  });

  test("returns file scan count", async () => {
    const result = await detectSecrets({ dir: tempDir });
    expect(result.totalFilesScanned).toBeGreaterThan(0);
  });
});
