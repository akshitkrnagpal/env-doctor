import { readFile } from "fs/promises";
import { parseEnvFile, type EnvEntry } from "./env-parser.js";

export interface FixOptions {
  /** Path to the .env file to fix */
  envFilePath: string;
  /** Path to .env.example for adding missing vars */
  exampleFilePath?: string;
  /** Sort keys alphabetically */
  sort?: boolean;
  /** Remove duplicate keys (keep last) */
  removeDuplicates?: boolean;
  /** Add missing vars from .env.example with placeholder values */
  addMissing?: boolean;
}

export interface FixChange {
  type: "remove-duplicate" | "sort" | "add-missing";
  key: string;
  detail: string;
}

export interface FixResult {
  /** The fixed .env file content */
  content: string;
  /** List of changes that were made (or would be made in dry-run) */
  changes: FixChange[];
  /** Original content before fixes */
  originalContent: string;
}

/**
 * Auto-fix common .env issues.
 * Returns the fixed content and a list of changes made.
 */
export async function fixEnvFile(options: FixOptions): Promise<FixResult> {
  const {
    envFilePath,
    exampleFilePath,
    sort = true,
    removeDuplicates = true,
    addMissing = true,
  } = options;

  const originalContent = await readFile(envFilePath, "utf-8");
  const changes: FixChange[] = [];

  // Parse the env file
  const { entries } = parseEnvFile(originalContent);

  // Step 1: Remove duplicates (keep last occurrence)
  let workingEntries: EnvEntry[] = [...entries];
  if (removeDuplicates) {
    const seen = new Map<string, number>();
    const duplicateIndices = new Set<number>();

    for (let i = 0; i < workingEntries.length; i++) {
      const entry = workingEntries[i]!;
      if (seen.has(entry.key)) {
        // Mark the earlier one for removal
        duplicateIndices.add(seen.get(entry.key)!);
        changes.push({
          type: "remove-duplicate",
          key: entry.key,
          detail: `Removed duplicate (kept last value: "${entry.value}")`,
        });
      }
      seen.set(entry.key, i);
    }

    workingEntries = workingEntries.filter(
      (_, idx) => !duplicateIndices.has(idx),
    );
  }

  // Step 2: Add missing vars from .env.example
  if (addMissing && exampleFilePath) {
    try {
      const exampleContent = await readFile(exampleFilePath, "utf-8");
      const { entries: exampleEntries } = parseEnvFile(exampleContent);
      const existingKeys = new Set(workingEntries.map((e) => e.key));

      for (const exEntry of exampleEntries) {
        if (!existingKeys.has(exEntry.key)) {
          const placeholderValue = exEntry.hasValue
            ? exEntry.value
            : "CHANGE_ME";
          workingEntries.push({
            key: exEntry.key,
            value: placeholderValue,
            line: -1,
            hasValue: true,
          });
          changes.push({
            type: "add-missing",
            key: exEntry.key,
            detail: `Added from .env.example with value "${placeholderValue}"`,
          });
        }
      }
    } catch {
      // .env.example not found or unreadable, skip
    }
  }

  // Step 3: Sort alphabetically
  if (sort) {
    const originalOrder = workingEntries.map((e) => e.key).join(",");
    workingEntries.sort((a, b) => a.key.localeCompare(b.key));
    const newOrder = workingEntries.map((e) => e.key).join(",");

    if (originalOrder !== newOrder) {
      changes.push({
        type: "sort",
        key: "*",
        detail: "Sorted all keys alphabetically",
      });
    }
  }

  // Reconstruct the file content
  // Preserve comments from the original file at the top
  const originalLines = originalContent.split("\n");
  const headerComments: string[] = [];
  for (const line of originalLines) {
    const trimmed = line.trim();
    if (trimmed === "" || trimmed.startsWith("#")) {
      headerComments.push(line);
    } else {
      break;
    }
  }

  const outputLines: string[] = [...headerComments];
  for (const entry of workingEntries) {
    const prefix = entry.exported ? "export " : "";
    const value = entry.value.includes("\n")
      ? `"${entry.value}"`
      : entry.value;
    outputLines.push(`${prefix}${entry.key}=${value}`);
  }

  // Ensure trailing newline
  const content = outputLines.join("\n").trimEnd() + "\n";

  return {
    content,
    changes,
    originalContent,
  };
}
