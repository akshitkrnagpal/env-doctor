import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { diffEnvFiles, diffEnvContents } from "../core/diff.js";
import { mkdtemp, writeFile, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";

describe("diffEnvContents", () => {
  test("detects added keys", () => {
    const a = "A=1\nB=2";
    const b = "A=1\nB=2\nC=3";

    const result = diffEnvContents(a, b);
    expect(result.added).toBe(1);
    expect(result.removed).toBe(0);
    expect(result.changed).toBe(0);
    expect(result.unchanged).toBe(2);

    const addedEntry = result.entries.find((e) => e.key === "C");
    expect(addedEntry).toBeDefined();
    expect(addedEntry!.type).toBe("added");
    expect(addedEntry!.newValue).toBe("3");
  });

  test("detects removed keys", () => {
    const a = "A=1\nB=2\nC=3";
    const b = "A=1\nB=2";

    const result = diffEnvContents(a, b);
    expect(result.added).toBe(0);
    expect(result.removed).toBe(1);
    expect(result.changed).toBe(0);
    expect(result.unchanged).toBe(2);

    const removedEntry = result.entries.find((e) => e.key === "C");
    expect(removedEntry).toBeDefined();
    expect(removedEntry!.type).toBe("removed");
    expect(removedEntry!.oldValue).toBe("3");
  });

  test("detects changed values", () => {
    const a = "A=1\nB=old";
    const b = "A=1\nB=new";

    const result = diffEnvContents(a, b);
    expect(result.changed).toBe(1);
    expect(result.unchanged).toBe(1);

    const changedEntry = result.entries.find((e) => e.key === "B");
    expect(changedEntry).toBeDefined();
    expect(changedEntry!.type).toBe("changed");
    expect(changedEntry!.oldValue).toBe("old");
    expect(changedEntry!.newValue).toBe("new");
  });

  test("detects unchanged keys", () => {
    const a = "A=same\nB=same";
    const b = "A=same\nB=same";

    const result = diffEnvContents(a, b);
    expect(result.added).toBe(0);
    expect(result.removed).toBe(0);
    expect(result.changed).toBe(0);
    expect(result.unchanged).toBe(2);
  });

  test("handles empty files", () => {
    const result = diffEnvContents("", "");
    expect(result.entries).toHaveLength(0);
    expect(result.added).toBe(0);
    expect(result.removed).toBe(0);
    expect(result.changed).toBe(0);
    expect(result.unchanged).toBe(0);
  });

  test("handles one empty file", () => {
    const result = diffEnvContents("", "A=1\nB=2");
    expect(result.added).toBe(2);
    expect(result.removed).toBe(0);
  });

  test("handles complex diff with all types", () => {
    const a = "KEEP=same\nCHANGE=old\nREMOVE=gone";
    const b = "KEEP=same\nCHANGE=new\nADD=fresh";

    const result = diffEnvContents(a, b);
    expect(result.added).toBe(1);
    expect(result.removed).toBe(1);
    expect(result.changed).toBe(1);
    expect(result.unchanged).toBe(1);
  });

  test("entries are sorted by key", () => {
    const a = "Z=1\nA=2\nM=3";
    const b = "Z=1\nA=2\nM=3";

    const result = diffEnvContents(a, b);
    const keys = result.entries.map((e) => e.key);
    expect(keys).toEqual(["A", "M", "Z"]);
  });
});

describe("diffEnvFiles", () => {
  let tempDir: string;

  beforeAll(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "env-doctor-diff-"));
  });

  afterAll(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  test("diffs two .env files on disk", async () => {
    const fileA = join(tempDir, ".env.dev");
    const fileB = join(tempDir, ".env.prod");

    await writeFile(fileA, "API_KEY=dev_key\nDEBUG=true\n");
    await writeFile(fileB, "API_KEY=prod_key\nSENTRY_DSN=https://sentry\n");

    const result = await diffEnvFiles(fileA, fileB);
    expect(result.added).toBe(1); // SENTRY_DSN
    expect(result.removed).toBe(1); // DEBUG
    expect(result.changed).toBe(1); // API_KEY
    expect(result.fileA).toBe(fileA);
    expect(result.fileB).toBe(fileB);
  });
});
