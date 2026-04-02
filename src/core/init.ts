import { readFile } from "fs/promises";
import { parseEnvFile } from "./env-parser.js";

/**
 * Generate a .env.example content from an existing .env file.
 * Strips values but preserves keys and comments.
 */
export async function generateEnvExample(
  envFilePath: string,
): Promise<string> {
  const content = await readFile(envFilePath, "utf-8");
  const lines = content.split("\n");
  const outputLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    // Preserve empty lines and comments
    if (trimmed === "" || trimmed.startsWith("#")) {
      outputLines.push(line);
      continue;
    }

    // Strip value but keep key
    let workLine = trimmed;
    let prefix = "";
    if (workLine.startsWith("export ")) {
      prefix = "export ";
      workLine = workLine.slice(7).trim();
    }

    const eqIndex = workLine.indexOf("=");
    if (eqIndex === -1) {
      outputLines.push(line);
      continue;
    }

    const key = workLine.slice(0, eqIndex).trim();
    outputLines.push(`${prefix}${key}=`);
  }

  return outputLines.join("\n");
}
