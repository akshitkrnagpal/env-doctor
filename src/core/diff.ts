import { readFile } from "fs/promises";
import { parseEnvFile, type EnvEntry } from "./env-parser.js";

export interface DiffEntry {
  key: string;
  type: "added" | "removed" | "changed" | "unchanged";
  /** Value in the first file (undefined if added) */
  oldValue?: string;
  /** Value in the second file (undefined if removed) */
  newValue?: string;
}

export interface DiffResult {
  entries: DiffEntry[];
  added: number;
  removed: number;
  changed: number;
  unchanged: number;
  fileA: string;
  fileB: string;
}

/**
 * Build a map of key -> value from env entries.
 */
function entriesToMap(entries: EnvEntry[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const entry of entries) {
    map.set(entry.key, entry.value);
  }
  return map;
}

/**
 * Compute a detailed diff between two .env files.
 */
export async function diffEnvFiles(
  fileA: string,
  fileB: string,
): Promise<DiffResult> {
  const [contentA, contentB] = await Promise.all([
    readFile(fileA, "utf-8"),
    readFile(fileB, "utf-8"),
  ]);

  return diffEnvContents(contentA, contentB, fileA, fileB);
}

/**
 * Compute a detailed diff between two .env content strings.
 */
export function diffEnvContents(
  contentA: string,
  contentB: string,
  nameA: string = "file-a",
  nameB: string = "file-b",
): DiffResult {
  const parsedA = parseEnvFile(contentA);
  const parsedB = parseEnvFile(contentB);

  const mapA = entriesToMap(parsedA.entries);
  const mapB = entriesToMap(parsedB.entries);

  const allKeys = new Set<string>();
  for (const key of mapA.keys()) allKeys.add(key);
  for (const key of mapB.keys()) allKeys.add(key);

  const entries: DiffEntry[] = [];
  let added = 0;
  let removed = 0;
  let changed = 0;
  let unchanged = 0;

  for (const key of [...allKeys].sort()) {
    const inA = mapA.has(key);
    const inB = mapB.has(key);
    const valA = mapA.get(key);
    const valB = mapB.get(key);

    if (inA && !inB) {
      entries.push({ key, type: "removed", oldValue: valA });
      removed++;
    } else if (!inA && inB) {
      entries.push({ key, type: "added", newValue: valB });
      added++;
    } else if (valA !== valB) {
      entries.push({ key, type: "changed", oldValue: valA, newValue: valB });
      changed++;
    } else {
      entries.push({ key, type: "unchanged", oldValue: valA, newValue: valB });
      unchanged++;
    }
  }

  return { entries, added, removed, changed, unchanged, fileA: nameA, fileB: nameB };
}
