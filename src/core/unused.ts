import { parseEnvFile, type EnvEntry } from "./env-parser.js";
import {
  scanSourceFiles,
  extractEnvReferences,
  type ScanOptions,
} from "./scanner.js";
import { readFile } from "fs/promises";

export interface UnusedVar {
  key: string;
  line: number;
  envFile: string;
}

export interface UnusedResult {
  unused: UnusedVar[];
  totalVars: number;
  totalFilesScanned: number;
}

/**
 * Find env variables defined in .env but never referenced in source code.
 */
export async function findUnusedVars(
  envFilePath: string,
  scanOptions: ScanOptions,
): Promise<UnusedResult> {
  // Parse the .env file
  const envContent = await readFile(envFilePath, "utf-8");
  const { entries } = parseEnvFile(envContent);

  // Scan source files for references
  const sourceFiles = await scanSourceFiles(scanOptions);

  // Collect all referenced var names
  const referencedVars = new Set<string>();
  for (const file of sourceFiles) {
    const refs = extractEnvReferences(file.path, file.content);
    for (const ref of refs) {
      referencedVars.add(ref.varName);
    }
  }

  // Find vars that are defined but never referenced
  const unused: UnusedVar[] = entries
    .filter((entry) => !referencedVars.has(entry.key))
    .map((entry) => ({
      key: entry.key,
      line: entry.line,
      envFile: envFilePath,
    }));

  return {
    unused,
    totalVars: entries.length,
    totalFilesScanned: sourceFiles.length,
  };
}
