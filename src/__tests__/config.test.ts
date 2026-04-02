import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { loadConfig } from "../core/config.js";
import { mkdtemp, writeFile, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";

describe("loadConfig", () => {
  let tempDir: string;

  beforeAll(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "env-doctor-config-"));
  });

  afterAll(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  test("returns empty config when no config files exist", async () => {
    const config = await loadConfig(tempDir);
    expect(config).toEqual({});
  });

  test("loads config from .envdoctorrc.json", async () => {
    const dir = await mkdtemp(join(tmpdir(), "env-doctor-config-rc-"));
    await writeFile(
      join(dir, ".envdoctorrc.json"),
      JSON.stringify({
        ignore: ["vendor", "tmp"],
        envFile: ".env.local",
      }),
    );

    const config = await loadConfig(dir);
    expect(config.ignore).toEqual(["vendor", "tmp"]);
    expect(config.envFile).toBe(".env.local");

    await rm(dir, { recursive: true, force: true });
  });

  test("loads config from package.json env-doctor key", async () => {
    const dir = await mkdtemp(join(tmpdir(), "env-doctor-config-pkg-"));
    await writeFile(
      join(dir, "package.json"),
      JSON.stringify({
        name: "test-project",
        "env-doctor": {
          ignore: ["dist"],
          envFile: ".env.production",
        },
      }),
    );

    const config = await loadConfig(dir);
    expect(config.ignore).toEqual(["dist"]);
    expect(config.envFile).toBe(".env.production");

    await rm(dir, { recursive: true, force: true });
  });

  test("prefers .envdoctorrc.json over package.json", async () => {
    const dir = await mkdtemp(join(tmpdir(), "env-doctor-config-both-"));
    await writeFile(
      join(dir, ".envdoctorrc.json"),
      JSON.stringify({ envFile: ".env.rc" }),
    );
    await writeFile(
      join(dir, "package.json"),
      JSON.stringify({
        name: "test",
        "env-doctor": { envFile: ".env.pkg" },
      }),
    );

    const config = await loadConfig(dir);
    expect(config.envFile).toBe(".env.rc");

    await rm(dir, { recursive: true, force: true });
  });

  test("handles custom secret patterns", async () => {
    const dir = await mkdtemp(join(tmpdir(), "env-doctor-config-secrets-"));
    await writeFile(
      join(dir, ".envdoctorrc.json"),
      JSON.stringify({
        secretPatterns: [
          { name: "Custom Token", regex: "CUSTOM_[A-Z0-9]{32}", severity: "high" },
        ],
      }),
    );

    const config = await loadConfig(dir);
    expect(config.secretPatterns).toHaveLength(1);
    expect(config.secretPatterns![0]!.name).toBe("Custom Token");

    await rm(dir, { recursive: true, force: true });
  });
});
