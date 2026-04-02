import { existsSync } from "fs";
import { resolve, basename } from "path";
import { findUnusedVars } from "./unused.js";
import { findMissingVars } from "./missing.js";
import { detectSecrets } from "./secrets.js";
import { detectDrift } from "./drift.js";
import { validateEnvFormat } from "./validate.js";
import { syncEnvExample } from "./sync.js";
import { checkGitSafety } from "./git-check.js";

export interface ReportOptions {
  dir: string;
  envFile: string;
  ignore?: string[];
}

export interface ReportSection {
  title: string;
  status: "pass" | "fail" | "skip";
  items: string[];
}

export interface ReportResult {
  timestamp: string;
  projectPath: string;
  sections: ReportSection[];
  passCount: number;
  failCount: number;
  skipCount: number;
}

/**
 * Generate a full audit report as structured data.
 */
export async function generateReport(
  options: ReportOptions,
): Promise<ReportResult> {
  const sections: ReportSection[] = [];
  let passCount = 0;
  let failCount = 0;
  let skipCount = 0;

  // 1. Format validation
  if (existsSync(options.envFile)) {
    const result = await validateEnvFormat(options.envFile);
    if (result.issues.length > 0) {
      failCount++;
      sections.push({
        title: "Format Validation",
        status: "fail",
        items: result.issues.map(
          (i) => `Line ${i.line} (${i.severity}): ${i.message}`,
        ),
      });
    } else {
      passCount++;
      sections.push({
        title: "Format Validation",
        status: "pass",
        items: [`${result.totalEntries} entries, all valid`],
      });
    }
  } else {
    skipCount++;
    sections.push({
      title: "Format Validation",
      status: "skip",
      items: [`No .env file found at ${options.envFile}`],
    });
  }

  // 2. Unused variables
  if (existsSync(options.envFile)) {
    const result = await findUnusedVars(options.envFile, {
      dir: options.dir,
      ignore: options.ignore,
    });
    if (result.unused.length > 0) {
      failCount++;
      sections.push({
        title: "Unused Variables",
        status: "fail",
        items: result.unused.map(
          (u) => `${u.key} (${basename(u.envFile)}:${u.line})`,
        ),
      });
    } else {
      passCount++;
      sections.push({
        title: "Unused Variables",
        status: "pass",
        items: [`All ${result.totalVars} variables are used`],
      });
    }
  }

  // 3. Missing variables
  if (existsSync(options.envFile)) {
    const result = await findMissingVars(options.envFile, {
      dir: options.dir,
      ignore: options.ignore,
    });
    if (result.missing.length > 0) {
      failCount++;
      sections.push({
        title: "Missing Variables",
        status: "fail",
        items: result.missing.map(
          (m) =>
            `${m.key} (${m.references.length} reference${m.references.length > 1 ? "s" : ""})`,
        ),
      });
    } else {
      passCount++;
      sections.push({
        title: "Missing Variables",
        status: "pass",
        items: ["No missing variables"],
      });
    }
  }

  // 4. Secret scanning
  const secretsResult = await detectSecrets({
    dir: options.dir,
    ignore: options.ignore,
  });
  if (secretsResult.secrets.length > 0) {
    failCount++;
    sections.push({
      title: "Hardcoded Secrets",
      status: "fail",
      items: secretsResult.secrets.map(
        (s) => `[${s.severity.toUpperCase()}] ${s.pattern} in ${s.file}:${s.line}`,
      ),
    });
  } else {
    passCount++;
    sections.push({
      title: "Hardcoded Secrets",
      status: "pass",
      items: [`Scanned ${secretsResult.totalFilesScanned} files, no secrets found`],
    });
  }

  // 5. Drift
  const driftResult = await detectDrift(options.dir);
  if (driftResult.drift.length > 0) {
    failCount++;
    sections.push({
      title: "Environment Drift",
      status: "fail",
      items: driftResult.drift.map(
        (d) =>
          `${d.key} missing from: ${d.missingFrom.join(", ")}`,
      ),
    });
  } else if (driftResult.files.length >= 2) {
    passCount++;
    sections.push({
      title: "Environment Drift",
      status: "pass",
      items: [`${driftResult.files.length} files compared, no drift`],
    });
  } else {
    skipCount++;
    sections.push({
      title: "Environment Drift",
      status: "skip",
      items: ["Fewer than 2 env files found"],
    });
  }

  // 6. Sync with .env.example
  const examplePath = resolve(options.dir, ".env.example");
  if (existsSync(examplePath) && existsSync(options.envFile)) {
    const syncResult = await syncEnvExample(options.envFile, examplePath);
    if (syncResult.missing.length > 0) {
      failCount++;
      sections.push({
        title: "Example Sync",
        status: "fail",
        items: syncResult.missing.map(
          (m) => `${m.key} in .env.example but missing from .env`,
        ),
      });
    } else {
      passCount++;
      sections.push({
        title: "Example Sync",
        status: "pass",
        items: ["In sync with .env.example"],
      });
    }
  } else {
    skipCount++;
    sections.push({
      title: "Example Sync",
      status: "skip",
      items: ["No .env.example found or no .env file"],
    });
  }

  // 7. Git safety
  const gitResult = await checkGitSafety(options.dir);
  if (gitResult.isGitRepo) {
    const gitItems: string[] = [];
    let gitFailed = false;

    if (!gitResult.envInGitignore) {
      gitFailed = true;
      gitItems.push(".env is NOT in .gitignore");
    } else {
      gitItems.push(".env is in .gitignore");
    }

    if (gitResult.trackedEnvFiles.length > 0) {
      gitFailed = true;
      gitItems.push(
        `Tracked .env files: ${gitResult.trackedEnvFiles.join(", ")}`,
      );
    }

    if (gitResult.historyLeaks.length > 0) {
      gitFailed = true;
      gitItems.push(
        `${gitResult.historyLeaks.length} .env file(s) found in git history`,
      );
    }

    if (!gitResult.exampleTracked) {
      gitItems.push("Consider tracking .env.example in git");
    }

    if (gitFailed) {
      failCount++;
      sections.push({ title: "Git Safety", status: "fail", items: gitItems });
    } else {
      passCount++;
      sections.push({ title: "Git Safety", status: "pass", items: gitItems });
    }
  } else {
    skipCount++;
    sections.push({
      title: "Git Safety",
      status: "skip",
      items: ["Not a git repository"],
    });
  }

  return {
    timestamp: new Date().toISOString(),
    projectPath: options.dir,
    sections,
    passCount,
    failCount,
    skipCount,
  };
}

/**
 * Format a report as Markdown.
 */
export function formatReportMarkdown(report: ReportResult): string {
  const lines: string[] = [];

  lines.push("# env-doctor Audit Report");
  lines.push("");
  lines.push(`**Project:** \`${report.projectPath}\``);
  lines.push(`**Date:** ${report.timestamp}`);
  lines.push("");

  // Summary
  lines.push("## Summary");
  lines.push("");
  const statusIcon = report.failCount > 0 ? "FAIL" : "PASS";
  lines.push(
    `| Status | Count |`,
  );
  lines.push(`| --- | --- |`);
  lines.push(`| Pass | ${report.passCount} |`);
  lines.push(`| Fail | ${report.failCount} |`);
  lines.push(`| Skip | ${report.skipCount} |`);
  lines.push(`| **Overall** | **${statusIcon}** |`);
  lines.push("");

  // Sections
  for (const section of report.sections) {
    const icon =
      section.status === "pass"
        ? "PASS"
        : section.status === "fail"
          ? "FAIL"
          : "SKIP";
    lines.push(`## ${section.title} [${icon}]`);
    lines.push("");
    for (const item of section.items) {
      lines.push(`- ${item}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}
