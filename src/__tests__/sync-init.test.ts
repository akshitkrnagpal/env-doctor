import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { syncEnvExample } from "../core/sync.js";
import { generateEnvExample } from "../core/init.js";
import { mkdtemp, writeFile, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";

describe("syncEnvExample", () => {
  let tempDir: string;

  beforeAll(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "env-doctor-sync-"));
  });

  afterAll(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  test("finds missing variables from example", async () => {
    const envPath = join(tempDir, ".env");
    const examplePath = join(tempDir, ".env.example");

    await writeFile(envPath, `DATABASE_URL=postgres://localhost\nPORT=3000`);
    await writeFile(
      examplePath,
      `DATABASE_URL=
PORT=
API_KEY=
JWT_SECRET=`,
    );

    const result = await syncEnvExample(envPath, examplePath);
    expect(result.missing).toHaveLength(2);
    const missingKeys = result.missing.map((m) => m.key).sort();
    expect(missingKeys).toEqual(["API_KEY", "JWT_SECRET"]);
  });

  test("returns empty when env has all example vars", async () => {
    const envPath = join(tempDir, ".env.full");
    const examplePath = join(tempDir, ".env.example.full");

    await writeFile(envPath, `A=1\nB=2\nC=3`);
    await writeFile(examplePath, `A=\nB=\nC=`);

    const result = await syncEnvExample(envPath, examplePath);
    expect(result.missing).toHaveLength(0);
  });

  test("reports defaults from example", async () => {
    const envPath = join(tempDir, ".env.defaults");
    const examplePath = join(tempDir, ".env.example.defaults");

    await writeFile(envPath, `A=1`);
    await writeFile(examplePath, `A=\nPORT=3000\nDEBUG=`);

    const result = await syncEnvExample(envPath, examplePath);
    expect(result.missing).toHaveLength(2);
    const portEntry = result.missing.find((m) => m.key === "PORT");
    expect(portEntry!.hasDefault).toBe(true);
    expect(portEntry!.defaultValue).toBe("3000");

    const debugEntry = result.missing.find((m) => m.key === "DEBUG");
    expect(debugEntry!.hasDefault).toBe(false);
  });
});

describe("generateEnvExample", () => {
  let tempDir: string;

  beforeAll(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "env-doctor-init-"));
  });

  afterAll(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  test("strips values from env file", async () => {
    const envPath = join(tempDir, ".env");
    await writeFile(
      envPath,
      `DATABASE_URL=postgres://user:pass@localhost:5432/db
API_KEY=sk-abc123
PORT=3000`,
    );

    const result = await generateEnvExample(envPath);
    expect(result).toBe(`DATABASE_URL=\nAPI_KEY=\nPORT=`);
  });

  test("preserves comments and empty lines", async () => {
    const envPath = join(tempDir, ".env.comments");
    await writeFile(
      envPath,
      `# Database settings
DATABASE_URL=postgres://localhost

# API settings
API_KEY=secret`,
    );

    const result = await generateEnvExample(envPath);
    expect(result).toContain("# Database settings");
    expect(result).toContain("# API settings");
    expect(result).toContain("DATABASE_URL=");
    expect(result).toContain("API_KEY=");
    expect(result).not.toContain("postgres://localhost");
    expect(result).not.toContain("secret");
  });

  test("preserves export prefix", async () => {
    const envPath = join(tempDir, ".env.export");
    await writeFile(envPath, `export API_KEY=secret123`);

    const result = await generateEnvExample(envPath);
    expect(result).toBe("export API_KEY=");
  });
});
