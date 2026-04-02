import { readFile } from "fs/promises";
import { parseEnvFile } from "./env-parser.js";

export interface ValidationIssue {
  line: number;
  severity: "error" | "warning";
  message: string;
  raw?: string;
}

export interface ValidationResult {
  issues: ValidationIssue[];
  totalEntries: number;
  valid: boolean;
}

/**
 * Validate a .env file for format issues.
 */
export async function validateEnvFormat(
  envFilePath: string,
): Promise<ValidationResult> {
  const content = await readFile(envFilePath, "utf-8");
  const { entries, errors } = parseEnvFile(content);
  const issues: ValidationIssue[] = [];

  // Add parse errors
  for (const err of errors) {
    issues.push({
      line: err.line,
      severity: "error",
      message: err.message,
      raw: err.raw,
    });
  }

  // Check for empty values
  for (const entry of entries) {
    if (!entry.hasValue) {
      issues.push({
        line: entry.line,
        severity: "warning",
        message: `Variable "${entry.key}" has no value`,
      });
    }
  }

  // Check for suspicious patterns
  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const trimmed = line.trim();

    if (trimmed === "" || trimmed.startsWith("#")) continue;

    // Check for trailing whitespace (after the value)
    if (line !== line.trimEnd()) {
      issues.push({
        line: i + 1,
        severity: "warning",
        message: "Line has trailing whitespace",
      });
    }

    // Check for spaces around =
    const eqMatch = trimmed.match(/^(?:export\s+)?([^=]+?)\s+=|=\s+/);
    if (eqMatch && !trimmed.startsWith("#")) {
      // Only warn if there are spaces around = that aren't part of the value
      const keyPart = trimmed.startsWith("export ")
        ? trimmed.slice(7)
        : trimmed;
      const eqIdx = keyPart.indexOf("=");
      if (eqIdx !== -1) {
        const beforeEq = keyPart.slice(0, eqIdx);
        if (beforeEq !== beforeEq.trim()) {
          issues.push({
            line: i + 1,
            severity: "warning",
            message: "Spaces before '=' sign",
          });
        }
      }
    }
  }

  // Sort by line number
  issues.sort((a, b) => a.line - b.line);

  return {
    issues,
    totalEntries: entries.length,
    valid: issues.filter((i) => i.severity === "error").length === 0,
  };
}
