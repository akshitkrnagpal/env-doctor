import { parseEnvFile } from "./env-parser.js";
import {
  scanSourceFiles,
  extractEnvReferences,
  type ScanOptions,
  type EnvReference,
} from "./scanner.js";
import { readFile } from "fs/promises";

export interface MissingVar {
  key: string;
  references: EnvReference[];
}

export interface MissingResult {
  missing: MissingVar[];
  totalReferencedVars: number;
  totalFilesScanned: number;
}

/**
 * Find env variables referenced in code but not defined in .env.
 */
export async function findMissingVars(
  envFilePath: string,
  scanOptions: ScanOptions,
): Promise<MissingResult> {
  // Parse the .env file
  const envContent = await readFile(envFilePath, "utf-8").catch(() => "");
  const { entries } = parseEnvFile(envContent);
  const definedVars = new Set(entries.map((e) => e.key));

  // Scan source files
  const sourceFiles = await scanSourceFiles(scanOptions);

  // Collect all references grouped by var name
  const refsByVar = new Map<string, EnvReference[]>();
  for (const file of sourceFiles) {
    const refs = extractEnvReferences(file.path, file.content);
    for (const ref of refs) {
      if (!refsByVar.has(ref.varName)) {
        refsByVar.set(ref.varName, []);
      }
      refsByVar.get(ref.varName)!.push(ref);
    }
  }

  // Find referenced vars not in .env
  const missing: MissingVar[] = [];
  for (const [varName, references] of refsByVar) {
    if (!definedVars.has(varName)) {
      missing.push({ key: varName, references });
    }
  }

  missing.sort((a, b) => a.key.localeCompare(b.key));

  return {
    missing,
    totalReferencedVars: refsByVar.size,
    totalFilesScanned: sourceFiles.length,
  };
}
