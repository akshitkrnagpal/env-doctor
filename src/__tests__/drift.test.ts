import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { detectDrift } from "../core/drift.js";
import { mkdtemp, writeFile, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";

describe("detectDrift", () => {
  let tempDir: string;

  beforeAll(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "env-doctor-drift-"));
  });

  afterAll(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  test("detects drift between env files", async () => {
    await writeFile(
      join(tempDir, ".env.development"),
      `DATABASE_URL=dev_db
API_KEY=dev_key
DEBUG=true`,
    );
    await writeFile(
      join(tempDir, ".env.production"),
      `DATABASE_URL=prod_db
API_KEY=prod_key
SENTRY_DSN=https://sentry`,
    );

    const result = await detectDrift(tempDir);
    expect(result.files).toHaveLength(2);
    expect(result.drift.length).toBeGreaterThan(0);

    const debugDrift = result.drift.find((d) => d.key === "DEBUG");
    expect(debugDrift).toBeDefined();
    expect(debugDrift!.missingFrom).toContain(".env.production");

    const sentryDrift = result.drift.find((d) => d.key === "SENTRY_DSN");
    expect(sentryDrift).toBeDefined();
    expect(sentryDrift!.missingFrom).toContain(".env.development");
  });

  test("returns no drift when files match", async () => {
    const subDir = join(tempDir, "matching");
    const { mkdir } = await import("fs/promises");
    await mkdir(subDir, { recursive: true });

    await writeFile(join(subDir, ".env.staging"), "A=1\nB=2");
    await writeFile(join(subDir, ".env.test"), "A=x\nB=y");

    const result = await detectDrift(subDir);
    expect(result.drift).toHaveLength(0);
  });

  test("excludes .env.example from drift comparison", async () => {
    const subDir = join(tempDir, "example");
    const { mkdir } = await import("fs/promises");
    await mkdir(subDir, { recursive: true });

    await writeFile(
      join(subDir, ".env.example"),
      "A=\nB=\nC=",
    );
    await writeFile(join(subDir, ".env.development"), "A=1\nB=2");

    const result = await detectDrift(subDir);
    // Only one file after excluding .env.example, so no comparison
    expect(result.drift).toHaveLength(0);
  });

  test("handles missing directory gracefully", async () => {
    const result = await detectDrift("/nonexistent/path");
    expect(result.files).toHaveLength(0);
    expect(result.drift).toHaveLength(0);
  });
});
