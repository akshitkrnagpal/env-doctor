import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { checkGitSafety } from "../core/git-check.js";
import { mkdtemp, writeFile, rm, mkdir } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { execSync } from "child_process";

describe("checkGitSafety", () => {
  let tempDir: string;

  beforeAll(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "env-doctor-git-"));
  });

  afterAll(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  test("returns isGitRepo false for non-git directory", async () => {
    const nonGitDir = await mkdtemp(join(tmpdir(), "env-doctor-nogit-"));
    try {
      const result = await checkGitSafety(nonGitDir);
      expect(result.isGitRepo).toBe(false);
      expect(result.trackedEnvFiles).toHaveLength(0);
      expect(result.historyLeaks).toHaveLength(0);
    } finally {
      await rm(nonGitDir, { recursive: true, force: true });
    }
  });

  test("detects when .env is in .gitignore", async () => {
    const dir = await mkdtemp(join(tmpdir(), "env-doctor-gitignore-"));
    try {
      execSync("git init", { cwd: dir, stdio: "pipe" });
      await writeFile(join(dir, ".gitignore"), ".env\nnode_modules\n");
      execSync("git add .gitignore", { cwd: dir, stdio: "pipe" });
      execSync('git commit -m "init"', { cwd: dir, stdio: "pipe" });

      const result = await checkGitSafety(dir);
      expect(result.isGitRepo).toBe(true);
      expect(result.envInGitignore).toBe(true);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("detects when .env is NOT in .gitignore", async () => {
    const dir = await mkdtemp(join(tmpdir(), "env-doctor-nogitignore-"));
    try {
      execSync("git init", { cwd: dir, stdio: "pipe" });
      await writeFile(join(dir, ".gitignore"), "node_modules\n");
      execSync("git add .gitignore", { cwd: dir, stdio: "pipe" });
      execSync('git commit -m "init"', { cwd: dir, stdio: "pipe" });

      const result = await checkGitSafety(dir);
      expect(result.envInGitignore).toBe(false);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("detects tracked .env files", async () => {
    const dir = await mkdtemp(join(tmpdir(), "env-doctor-tracked-"));
    try {
      execSync("git init", { cwd: dir, stdio: "pipe" });
      await writeFile(join(dir, ".env"), "SECRET=abc123\n");
      execSync("git add .env", { cwd: dir, stdio: "pipe" });
      execSync('git commit -m "oops"', { cwd: dir, stdio: "pipe" });

      const result = await checkGitSafety(dir);
      expect(result.trackedEnvFiles).toContain(".env");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("detects .env.example tracking status", async () => {
    const dir = await mkdtemp(join(tmpdir(), "env-doctor-example-"));
    try {
      execSync("git init", { cwd: dir, stdio: "pipe" });
      await writeFile(join(dir, ".env.example"), "API_KEY=\n");
      execSync("git add .env.example", { cwd: dir, stdio: "pipe" });
      execSync('git commit -m "add example"', { cwd: dir, stdio: "pipe" });

      const result = await checkGitSafety(dir);
      expect(result.exampleTracked).toBe(true);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("detects .env files in git history", async () => {
    const dir = await mkdtemp(join(tmpdir(), "env-doctor-history-"));
    try {
      execSync("git init", { cwd: dir, stdio: "pipe" });
      await writeFile(join(dir, ".env"), "SECRET=leak\n");
      execSync("git add .env", { cwd: dir, stdio: "pipe" });
      execSync('git commit -m "accidental commit"', {
        cwd: dir,
        stdio: "pipe",
      });

      const result = await checkGitSafety(dir);
      expect(result.historyLeaks.length).toBeGreaterThan(0);
      expect(result.historyLeaks[0]!.file).toBe(".env");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("excludes .env.example from tracked file warnings", async () => {
    const dir = await mkdtemp(join(tmpdir(), "env-doctor-exclude-example-"));
    try {
      execSync("git init", { cwd: dir, stdio: "pipe" });
      await writeFile(join(dir, ".env.example"), "API_KEY=\n");
      execSync("git add .env.example", { cwd: dir, stdio: "pipe" });
      execSync('git commit -m "add example"', { cwd: dir, stdio: "pipe" });

      const result = await checkGitSafety(dir);
      // .env.example should NOT appear in trackedEnvFiles warnings
      expect(result.trackedEnvFiles).not.toContain(".env.example");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
