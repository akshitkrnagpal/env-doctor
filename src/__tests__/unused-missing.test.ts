import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { findUnusedVars } from "../core/unused.js";
import { findMissingVars } from "../core/missing.js";
import { mkdtemp, writeFile, rm, mkdir } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";

describe("findUnusedVars", () => {
  let tempDir: string;

  beforeAll(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "env-doctor-unused-"));
    await mkdir(join(tempDir, "src"), { recursive: true });
  });

  afterAll(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  test("finds unused variables", async () => {
    const envPath = join(tempDir, ".env");
    await writeFile(
      envPath,
      `DATABASE_URL=postgres://localhost
API_KEY=secret123
UNUSED_VAR=something
PORT=3000`,
    );

    await writeFile(
      join(tempDir, "src", "app.ts"),
      `const db = process.env.DATABASE_URL;
const key = process.env.API_KEY;
const port = process.env.PORT;`,
    );

    const result = await findUnusedVars(envPath, { dir: tempDir });
    expect(result.unused).toHaveLength(1);
    expect(result.unused[0]!.key).toBe("UNUSED_VAR");
    expect(result.totalVars).toBe(4);
  });

  test("returns empty when all vars are used", async () => {
    const subDir = join(tempDir, "allused");
    await mkdir(join(subDir, "src"), { recursive: true });

    const envPath = join(subDir, ".env");
    await writeFile(envPath, `PORT=3000\nHOST=localhost`);
    await writeFile(
      join(subDir, "src", "index.ts"),
      `console.log(process.env.PORT, process.env.HOST);`,
    );

    const result = await findUnusedVars(envPath, { dir: subDir });
    expect(result.unused).toHaveLength(0);
  });
});

describe("findMissingVars", () => {
  let tempDir: string;

  beforeAll(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "env-doctor-missing-"));
    await mkdir(join(tempDir, "src"), { recursive: true });
  });

  afterAll(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  test("finds missing variables", async () => {
    const envPath = join(tempDir, ".env");
    await writeFile(envPath, `DATABASE_URL=postgres://localhost\nPORT=3000`);

    await writeFile(
      join(tempDir, "src", "app.ts"),
      `const db = process.env.DATABASE_URL;
const port = process.env.PORT;
const secret = process.env.JWT_SECRET;
const key = process.env.API_KEY;`,
    );

    const result = await findMissingVars(envPath, { dir: tempDir });
    expect(result.missing).toHaveLength(2);
    const missingKeys = result.missing.map((m) => m.key).sort();
    expect(missingKeys).toEqual(["API_KEY", "JWT_SECRET"]);
  });

  test("returns empty when all referenced vars are defined", async () => {
    const subDir = join(tempDir, "alldefined");
    await mkdir(join(subDir, "src"), { recursive: true });

    const envPath = join(subDir, ".env");
    await writeFile(envPath, `PORT=3000\nHOST=localhost`);
    await writeFile(
      join(subDir, "src", "index.ts"),
      `console.log(process.env.PORT);`,
    );

    const result = await findMissingVars(envPath, { dir: subDir });
    expect(result.missing).toHaveLength(0);
  });

  test("handles missing .env file gracefully", async () => {
    const subDir = join(tempDir, "noenv");
    await mkdir(join(subDir, "src"), { recursive: true });

    await writeFile(
      join(subDir, "src", "app.ts"),
      `const port = process.env.PORT;`,
    );

    const result = await findMissingVars(
      join(subDir, ".env"),
      { dir: subDir },
    );
    expect(result.missing).toHaveLength(1);
    expect(result.missing[0]!.key).toBe("PORT");
  });
});
