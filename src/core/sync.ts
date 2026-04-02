import { readFile } from "fs/promises";
import { parseEnvFile } from "./env-parser.js";

export interface SyncEntry {
  key: string;
  exampleLine: number;
  hasDefault: boolean;
  defaultValue?: string;
}

export interface SyncResult {
  missing: SyncEntry[];
  totalExampleVars: number;
  totalEnvVars: number;
}

/**
 * Compare .env.example with .env and find missing variables.
 */
export async function syncEnvExample(
  envFilePath: string,
  exampleFilePath: string,
): Promise<SyncResult> {
  const envContent = await readFile(envFilePath, "utf-8").catch(() => "");
  const exampleContent = await readFile(exampleFilePath, "utf-8");

  const envResult = parseEnvFile(envContent);
  const exampleResult = parseEnvFile(exampleContent);

  const envKeys = new Set(envResult.entries.map((e) => e.key));

  const missing: SyncEntry[] = exampleResult.entries
    .filter((entry) => !envKeys.has(entry.key))
    .map((entry) => ({
      key: entry.key,
      exampleLine: entry.line,
      hasDefault: entry.hasValue,
      defaultValue: entry.hasValue ? entry.value : undefined,
    }));

  return {
    missing,
    totalExampleVars: exampleResult.entries.length,
    totalEnvVars: envResult.entries.length,
  };
}
