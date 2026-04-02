import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { generateReport, formatReportMarkdown } from "../core/report.js";
import { mkdtemp, writeFile, rm, mkdir } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";

describe("generateReport", () => {
  let tempDir: string;

  beforeAll(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "env-doctor-report-"));
    // Create a basic .env and source file
    await writeFile(join(tempDir, ".env"), "API_KEY=test123\nPORT=3000\n");
    const srcDir = join(tempDir, "src");
    await mkdir(srcDir, { recursive: true });
    await writeFile(
      join(srcDir, "app.ts"),
      "const key = process.env.API_KEY;\nconst port = process.env.PORT;\n",
    );
  });

  afterAll(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  test("generates a report with all sections", async () => {
    const report = await generateReport({
      dir: tempDir,
      envFile: join(tempDir, ".env"),
    });

    expect(report.timestamp).toBeDefined();
    expect(report.projectPath).toBe(tempDir);
    expect(report.sections.length).toBeGreaterThan(0);
    expect(typeof report.passCount).toBe("number");
    expect(typeof report.failCount).toBe("number");
    expect(typeof report.skipCount).toBe("number");
  });

  test("includes format validation section", async () => {
    const report = await generateReport({
      dir: tempDir,
      envFile: join(tempDir, ".env"),
    });

    const formatSection = report.sections.find(
      (s) => s.title === "Format Validation",
    );
    expect(formatSection).toBeDefined();
  });

  test("skips format validation when no .env file", async () => {
    const emptyDir = await mkdtemp(join(tmpdir(), "env-doctor-report-empty-"));
    try {
      const report = await generateReport({
        dir: emptyDir,
        envFile: join(emptyDir, ".env"),
      });

      const formatSection = report.sections.find(
        (s) => s.title === "Format Validation",
      );
      expect(formatSection?.status).toBe("skip");
    } finally {
      await rm(emptyDir, { recursive: true, force: true });
    }
  });
});

describe("formatReportMarkdown", () => {
  test("produces valid markdown", () => {
    const markdown = formatReportMarkdown({
      timestamp: "2025-01-01T00:00:00.000Z",
      projectPath: "/test/project",
      sections: [
        {
          title: "Format Validation",
          status: "pass",
          items: ["2 entries, all valid"],
        },
        {
          title: "Unused Variables",
          status: "fail",
          items: ["UNUSED_VAR (.env:3)"],
        },
      ],
      passCount: 1,
      failCount: 1,
      skipCount: 0,
    });

    expect(markdown).toContain("# env-doctor Audit Report");
    expect(markdown).toContain("## Summary");
    expect(markdown).toContain("## Format Validation [PASS]");
    expect(markdown).toContain("## Unused Variables [FAIL]");
    expect(markdown).toContain("- 2 entries, all valid");
    expect(markdown).toContain("- UNUSED_VAR (.env:3)");
    expect(markdown).toContain("/test/project");
    expect(markdown).toContain("2025-01-01");
  });

  test("shows overall PASS when no failures", () => {
    const markdown = formatReportMarkdown({
      timestamp: "2025-01-01T00:00:00.000Z",
      projectPath: "/test",
      sections: [],
      passCount: 3,
      failCount: 0,
      skipCount: 0,
    });

    expect(markdown).toContain("**PASS**");
  });

  test("shows overall FAIL when failures exist", () => {
    const markdown = formatReportMarkdown({
      timestamp: "2025-01-01T00:00:00.000Z",
      projectPath: "/test",
      sections: [],
      passCount: 2,
      failCount: 1,
      skipCount: 0,
    });

    expect(markdown).toContain("**FAIL**");
  });
});
