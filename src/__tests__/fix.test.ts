import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { fixEnvFile } from "../core/fix.js";
import { mkdtemp, writeFile, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";

describe("fixEnvFile", () => {
  let tempDir: string;

  beforeAll(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "env-doctor-fix-"));
  });

  afterAll(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  test("removes duplicate keys (keeps last)", async () => {
    const envPath = join(tempDir, ".env.dupes");
    await writeFile(envPath, "API_KEY=first\nPORT=3000\nAPI_KEY=second\n");

    const result = await fixEnvFile({
      envFilePath: envPath,
      removeDuplicates: true,
      sort: false,
      addMissing: false,
    });

    expect(result.changes.some((c) => c.type === "remove-duplicate")).toBe(true);
    expect(result.content).toContain("API_KEY=second");
    expect(result.content.match(/API_KEY=/g)?.length).toBe(1);
  });

  test("sorts keys alphabetically", async () => {
    const envPath = join(tempDir, ".env.unsorted");
    await writeFile(envPath, "ZEBRA=1\nAPPLE=2\nMIDDLE=3\n");

    const result = await fixEnvFile({
      envFilePath: envPath,
      sort: true,
      removeDuplicates: false,
      addMissing: false,
    });

    const lines = result.content.trim().split("\n");
    expect(lines[0]).toBe("APPLE=2");
    expect(lines[1]).toBe("MIDDLE=3");
    expect(lines[2]).toBe("ZEBRA=1");
  });

  test("adds missing vars from .env.example", async () => {
    const envPath = join(tempDir, ".env.incomplete");
    const examplePath = join(tempDir, ".env.example.test");
    await writeFile(envPath, "PORT=3000\n");
    await writeFile(examplePath, "PORT=\nDATABASE_URL=\nAPI_KEY=default_key\n");

    const result = await fixEnvFile({
      envFilePath: envPath,
      exampleFilePath: examplePath,
      sort: false,
      removeDuplicates: false,
      addMissing: true,
    });

    expect(result.changes.some((c) => c.type === "add-missing" && c.key === "DATABASE_URL")).toBe(true);
    expect(result.changes.some((c) => c.type === "add-missing" && c.key === "API_KEY")).toBe(true);
    expect(result.content).toContain("DATABASE_URL=CHANGE_ME");
    expect(result.content).toContain("API_KEY=default_key");
  });

  test("reports no changes for a clean file", async () => {
    const envPath = join(tempDir, ".env.clean");
    await writeFile(envPath, "APPLE=1\nBANANA=2\nCHERRY=3\n");

    const result = await fixEnvFile({
      envFilePath: envPath,
      sort: true,
      removeDuplicates: true,
      addMissing: false,
    });

    // Already sorted, no duplicates
    expect(result.changes).toHaveLength(0);
  });

  test("preserves header comments", async () => {
    const envPath = join(tempDir, ".env.comments");
    await writeFile(envPath, "# My config file\n\nZZZ=1\nAAA=2\n");

    const result = await fixEnvFile({
      envFilePath: envPath,
      sort: true,
      removeDuplicates: false,
      addMissing: false,
    });

    expect(result.content).toMatch(/^# My config file\n/);
  });

  test("handles all fixes together", async () => {
    const envPath = join(tempDir, ".env.allfixes");
    const examplePath = join(tempDir, ".env.example.allfixes");
    await writeFile(envPath, "Z_VAR=1\nA_VAR=2\nZ_VAR=3\n");
    await writeFile(examplePath, "A_VAR=\nM_VAR=\nZ_VAR=\n");

    const result = await fixEnvFile({
      envFilePath: envPath,
      exampleFilePath: examplePath,
      sort: true,
      removeDuplicates: true,
      addMissing: true,
    });

    // Should remove duplicate Z_VAR, add M_VAR, and sort
    expect(result.changes.some((c) => c.type === "remove-duplicate")).toBe(true);
    expect(result.changes.some((c) => c.type === "add-missing")).toBe(true);

    const lines = result.content.trim().split("\n");
    const keys = lines.filter((l) => l.includes("=")).map((l) => l.split("=")[0]);
    // Should be sorted
    expect(keys).toEqual([...keys].sort());
    // Only one Z_VAR
    expect(keys.filter((k) => k === "Z_VAR")).toHaveLength(1);
    // M_VAR added
    expect(keys).toContain("M_VAR");
  });
});
