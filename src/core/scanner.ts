import { readdir, readFile, stat } from "fs/promises";
import { join, extname, basename } from "path";

/** File extensions to scan for env var usage */
const SCANNABLE_EXTENSIONS = new Set([
  ".js",
  ".jsx",
  ".ts",
  ".tsx",
  ".mjs",
  ".cjs",
  ".py",
  ".rb",
  ".go",
  ".rs",
  ".php",
  ".java",
  ".kt",
  ".kts",
  ".scala",
  ".env",
  ".vue",
  ".svelte",
]);

/** Directories to always ignore */
const DEFAULT_IGNORE = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  ".next",
  ".nuxt",
  "__pycache__",
  ".venv",
  "venv",
  "vendor",
  "target",
  ".cache",
  "coverage",
  ".turbo",
]);

export interface ScanOptions {
  dir: string;
  ignore?: string[];
}

export interface ScannedFile {
  path: string;
  content: string;
}

/**
 * Recursively scan a directory for source files.
 */
export async function scanSourceFiles(
  options: ScanOptions,
): Promise<ScannedFile[]> {
  const ignoreSet = new Set([
    ...DEFAULT_IGNORE,
    ...(options.ignore ?? []),
  ]);
  const files: ScannedFile[] = [];

  async function walk(dir: string): Promise<void> {
    let dirEntries: string[];
    try {
      dirEntries = await readdir(dir) as unknown as string[];
    } catch {
      return;
    }

    const tasks: Promise<void>[] = [];

    for (const entryName of dirEntries) {
      const name = String(entryName);
      if (ignoreSet.has(name) || name.startsWith(".")) continue;

      const fullPath = join(dir, name);
      tasks.push(
        (async () => {
          const s = await stat(fullPath).catch(() => null);
          if (!s) return;

          if (s.isDirectory()) {
            await walk(fullPath);
          } else if (s.isFile()) {
            const ext = extname(name);
            if (SCANNABLE_EXTENSIONS.has(ext)) {
              try {
                const content = await readFile(fullPath, "utf-8");
                files.push({ path: fullPath, content });
              } catch {
                // Skip unreadable files
              }
            }
          }
        })(),
      );
    }

    await Promise.all(tasks);
  }

  await walk(options.dir);
  return files;
}

/**
 * Patterns to match env var references in various languages.
 * Each returns an array of variable names referenced.
 */
const ENV_VAR_PATTERNS: RegExp[] = [
  // JavaScript/TypeScript: process.env.VAR_NAME
  /process\.env\.([A-Z_][A-Z0-9_]*)/g,
  // JavaScript/TypeScript: process.env['VAR_NAME'] or process.env["VAR_NAME"]
  /process\.env\[['"]([A-Z_][A-Z0-9_]*)['"]\]/g,
  // Python: os.environ['VAR'], os.environ.get('VAR'), os.getenv('VAR')
  /os\.environ\[['"]([A-Z_][A-Z0-9_]*)['"]\]/g,
  /os\.environ\.get\(\s*['"]([A-Z_][A-Z0-9_]*)['"]/g,
  /os\.getenv\(\s*['"]([A-Z_][A-Z0-9_]*)['"]/g,
  // Ruby: ENV['VAR'], ENV.fetch('VAR') — negative lookbehind to avoid matching os.environ / $_ENV
  /(?<![a-zA-Z._$])ENV\[['"]([A-Z_][A-Z0-9_]*)['"]\]/g,
  /(?<![a-zA-Z._$])ENV\.fetch\(\s*['"]([A-Z_][A-Z0-9_]*)['"]/g,
  // Go: os.Getenv("VAR")
  /os\.Getenv\(\s*"([A-Z_][A-Z0-9_]*)"\s*\)/g,
  // Rust: env::var("VAR"), std::env::var("VAR")
  /(?:std::)?env::var\(\s*"([A-Z_][A-Z0-9_]*)"\s*\)/g,
  // PHP: getenv('VAR'), $_ENV['VAR'], $_SERVER['VAR']
  /(?<!\.)getenv\(\s*['"]([A-Z_][A-Z0-9_]*)['"]\s*\)/g,
  /\$_ENV\[['"]([A-Z_][A-Z0-9_]*)['"]\]/g,
  /\$_SERVER\[['"]([A-Z_][A-Z0-9_]*)['"]\]/g,
  // Java/Kotlin: System.getenv("VAR")
  /System\.getenv\(\s*"([A-Z_][A-Z0-9_]*)"\s*\)/g,
  // .env file references: ${VAR}
  /\$\{([A-Z_][A-Z0-9_]*)\}/g,
];

export interface EnvReference {
  varName: string;
  file: string;
  line: number;
  match: string;
}

/**
 * Extract all env var references from a file's content.
 */
export function extractEnvReferences(
  filePath: string,
  content: string,
): EnvReference[] {
  const refs: EnvReference[] = [];
  const lines = content.split("\n");

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const lineContent = lines[lineIdx]!;
    for (const pattern of ENV_VAR_PATTERNS) {
      // Reset lastIndex since patterns have /g flag
      pattern.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(lineContent)) !== null) {
        const varName = match[1];
        if (varName) {
          refs.push({
            varName,
            file: filePath,
            line: lineIdx + 1,
            match: match[0],
          });
        }
      }
    }
  }

  return refs;
}

/**
 * Find all .env* files in a directory (non-recursive).
 */
export async function findEnvFiles(dir: string): Promise<string[]> {
  const entries = (await readdir(dir).catch(() => [])) as unknown as string[];
  return entries
    .map(String)
    .filter(
      (e) =>
        e === ".env" ||
        e.startsWith(".env.") ||
        e === ".env.example" ||
        e === ".env.sample",
    )
    .map((e) => join(dir, e))
    .sort();
}
