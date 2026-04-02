import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { validateEnvFormat } from "../core/validate.js";
import { mkdtemp, writeFile, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";

describe("validateEnvFormat", () => {
  let tempDir: string;

  beforeAll(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "env-doctor-validate-"));
  });

  afterAll(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  test("validates a clean .env file", async () => {
    const filePath = join(tempDir, ".env.clean");
    await writeFile(filePath, `DATABASE_URL=postgres://localhost\nPORT=3000`);

    const result = await validateEnvFormat(filePath);
    expect(result.valid).toBe(true);
    expect(result.issues).toHaveLength(0);
    expect(result.totalEntries).toBe(2);
  });

  test("reports duplicate keys", async () => {
    const filePath = join(tempDir, ".env.dupes");
    await writeFile(filePath, `API_KEY=first\nPORT=3000\nAPI_KEY=second`);

    const result = await validateEnvFormat(filePath);
    expect(result.valid).toBe(false);
    const dupeIssues = result.issues.filter((i) =>
      i.message.includes("Duplicate"),
    );
    expect(dupeIssues.length).toBeGreaterThan(0);
  });

  test("warns about empty values", async () => {
    const filePath = join(tempDir, ".env.empty");
    await writeFile(filePath, `API_KEY=\nPORT=3000`);

    const result = await validateEnvFormat(filePath);
    const emptyWarnings = result.issues.filter((i) =>
      i.message.includes("no value"),
    );
    expect(emptyWarnings.length).toBeGreaterThan(0);
    expect(emptyWarnings[0]!.severity).toBe("warning");
  });

  test("reports invalid lines", async () => {
    const filePath = join(tempDir, ".env.invalid");
    await writeFile(filePath, `VALID=yes\nthis is not valid\nALSO_VALID=yep`);

    const result = await validateEnvFormat(filePath);
    expect(result.valid).toBe(false);
    const invalidIssues = result.issues.filter(
      (i) => i.severity === "error",
    );
    expect(invalidIssues.length).toBeGreaterThan(0);
  });

  test("warns about trailing whitespace", async () => {
    const filePath = join(tempDir, ".env.trailing");
    await writeFile(filePath, `PORT=3000   \nHOST=localhost`);

    const result = await validateEnvFormat(filePath);
    const trailingWarnings = result.issues.filter((i) =>
      i.message.includes("trailing whitespace"),
    );
    expect(trailingWarnings.length).toBeGreaterThan(0);
  });
});
