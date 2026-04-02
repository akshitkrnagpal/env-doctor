import { readFile } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import { execSync } from "child_process";

export interface GitCheckResult {
  envInGitignore: boolean;
  trackedEnvFiles: string[];
  exampleTracked: boolean;
  historyLeaks: GitHistoryLeak[];
  isGitRepo: boolean;
}

export interface GitHistoryLeak {
  file: string;
  commit: string;
  date: string;
  author: string;
}

/**
 * Check if a pattern exists in .gitignore
 */
function isInGitignore(dir: string, pattern: string): boolean {
  const gitignorePath = join(dir, ".gitignore");
  if (!existsSync(gitignorePath)) return false;

  try {
    const content = require("fs").readFileSync(gitignorePath, "utf-8") as string;
    const lines = content.split("\n").map((l: string) => l.trim());
    return lines.some(
      (line: string) =>
        line === pattern ||
        line === `/${pattern}` ||
        line === `${pattern}/` ||
        (pattern === ".env" && line === ".env*") ||
        (pattern === ".env" && line === ".env.*"),
    );
  } catch {
    return false;
  }
}

/**
 * Check if a file is tracked by git
 */
function isTrackedByGit(dir: string, file: string): boolean {
  try {
    execSync(`git ls-files --error-unmatch "${file}"`, {
      cwd: dir,
      stdio: "pipe",
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if the directory is a git repository
 */
function isGitRepo(dir: string): boolean {
  try {
    execSync("git rev-parse --is-inside-work-tree", {
      cwd: dir,
      stdio: "pipe",
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get list of tracked .env files
 */
function getTrackedEnvFiles(dir: string): string[] {
  try {
    const output = execSync('git ls-files -- ".env" ".env.*"', {
      cwd: dir,
      encoding: "utf-8",
    }).trim();

    if (!output) return [];
    return output
      .split("\n")
      .filter((f) => {
        const name = f.split("/").pop() ?? f;
        // Exclude .env.example and .env.sample from the warning
        return (
          name !== ".env.example" &&
          name !== ".env.sample" &&
          (name === ".env" || name.startsWith(".env."))
        );
      });
  } catch {
    return [];
  }
}

/**
 * Scan git history for accidentally committed .env files
 */
function scanGitHistory(dir: string): GitHistoryLeak[] {
  try {
    const output = execSync(
      'git log --all --diff-filter=A --format="%H|%ai|%an" --name-only -- ".env" ".env.*"',
      { cwd: dir, encoding: "utf-8" },
    ).trim();

    if (!output) return [];

    const leaks: GitHistoryLeak[] = [];
    const lines = output.split("\n");
    let currentCommit = "";
    let currentDate = "";
    let currentAuthor = "";

    for (const line of lines) {
      if (line.includes("|")) {
        const parts = line.split("|");
        currentCommit = parts[0]?.slice(0, 8) ?? "";
        currentDate = parts[1]?.trim() ?? "";
        currentAuthor = parts[2]?.trim() ?? "";
      } else if (line.trim()) {
        const name = line.trim().split("/").pop() ?? line.trim();
        // Only flag actual secret-containing env files, not .env.example
        if (
          name === ".env" ||
          (name.startsWith(".env.") &&
            name !== ".env.example" &&
            name !== ".env.sample")
        ) {
          leaks.push({
            file: line.trim(),
            commit: currentCommit,
            date: currentDate,
            author: currentAuthor,
          });
        }
      }
    }

    return leaks;
  } catch {
    return [];
  }
}

/**
 * Run all git safety checks for .env files.
 */
export async function checkGitSafety(dir: string): Promise<GitCheckResult> {
  if (!isGitRepo(dir)) {
    return {
      envInGitignore: false,
      trackedEnvFiles: [],
      exampleTracked: false,
      historyLeaks: [],
      isGitRepo: false,
    };
  }

  const envInGitignore = isInGitignore(dir, ".env");
  const trackedEnvFiles = getTrackedEnvFiles(dir);
  const exampleTracked = isTrackedByGit(dir, ".env.example");
  const historyLeaks = scanGitHistory(dir);

  return {
    envInGitignore,
    trackedEnvFiles,
    exampleTracked,
    historyLeaks,
    isGitRepo: true,
  };
}
