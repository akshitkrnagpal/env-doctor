import { readFile } from "fs/promises";
import { basename } from "path";
import { parseEnvFile } from "./env-parser.js";
import { findEnvFiles } from "./scanner.js";

export interface DriftEntry {
  key: string;
  presentIn: string[];
  missingFrom: string[];
}

export interface DriftResult {
  drift: DriftEntry[];
  files: string[];
  allKeys: string[];
}

/**
 * Compare env files to detect drift (keys present in some but not others).
 */
export async function detectDrift(
  dir: string,
  specificFiles?: string[],
): Promise<DriftResult> {
  const envFilePaths = specificFiles ?? (await findEnvFiles(dir));

  // Filter out .env.example / .env.sample from drift comparison
  const filesToCompare = envFilePaths.filter((f) => {
    const name = basename(f);
    return name !== ".env.example" && name !== ".env.sample";
  });

  if (filesToCompare.length < 2) {
    return { drift: [], files: filesToCompare, allKeys: [] };
  }

  // Parse all files
  const fileEntries = new Map<string, Set<string>>();
  for (const filePath of filesToCompare) {
    const content = await readFile(filePath, "utf-8").catch(() => "");
    const { entries } = parseEnvFile(content);
    fileEntries.set(
      basename(filePath),
      new Set(entries.map((e) => e.key)),
    );
  }

  // Collect all unique keys
  const allKeysSet = new Set<string>();
  for (const keys of fileEntries.values()) {
    for (const key of keys) {
      allKeysSet.add(key);
    }
  }
  const allKeys = [...allKeysSet].sort();
  const fileNames = [...fileEntries.keys()];

  // Find drift
  const drift: DriftEntry[] = [];
  for (const key of allKeys) {
    const presentIn: string[] = [];
    const missingFrom: string[] = [];

    for (const [fileName, keys] of fileEntries) {
      if (keys.has(key)) {
        presentIn.push(fileName);
      } else {
        missingFrom.push(fileName);
      }
    }

    if (missingFrom.length > 0) {
      drift.push({ key, presentIn, missingFrom });
    }
  }

  return {
    drift,
    files: fileNames,
    allKeys,
  };
}
