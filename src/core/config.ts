import { readFile } from "fs/promises";
import { join } from "path";

export interface EnvDoctorConfig {
  /** Glob patterns to ignore when scanning */
  ignore?: string[];
  /** Additional secret patterns (regex strings) */
  secretPatterns?: Array<{
    name: string;
    regex: string;
    severity: "high" | "medium" | "low";
  }>;
  /** Path to the .env file (relative to project root) */
  envFile?: string;
}

/**
 * Load config from .envdoctorrc.json or package.json "env-doctor" key.
 * Returns an empty config if neither is found.
 */
export async function loadConfig(dir: string): Promise<EnvDoctorConfig> {
  // Try .envdoctorrc.json first
  try {
    const rcPath = join(dir, ".envdoctorrc.json");
    const content = await readFile(rcPath, "utf-8");
    return JSON.parse(content) as EnvDoctorConfig;
  } catch {
    // Not found or invalid, try package.json
  }

  // Try package.json "env-doctor" key
  try {
    const pkgPath = join(dir, "package.json");
    const content = await readFile(pkgPath, "utf-8");
    const pkg = JSON.parse(content);
    if (pkg["env-doctor"] && typeof pkg["env-doctor"] === "object") {
      return pkg["env-doctor"] as EnvDoctorConfig;
    }
  } catch {
    // Not found or invalid
  }

  return {};
}

/**
 * Merge CLI options with loaded config. CLI options take precedence.
 */
export function mergeConfig(
  cliOpts: {
    ignore?: string[];
    envFile?: string;
  },
  config: EnvDoctorConfig,
): { ignore?: string[]; envFile?: string } {
  return {
    ignore: cliOpts.ignore ?? config.ignore,
    envFile: cliOpts.envFile ?? config.envFile,
  };
}
