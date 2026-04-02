#!/usr/bin/env bun
import { Command } from "commander";
import { registerCheckCommand } from "./commands/check.js";
import { registerUnusedCommand } from "./commands/unused.js";
import { registerMissingCommand } from "./commands/missing.js";
import { registerDriftCommand } from "./commands/drift.js";
import { registerSecretsCommand } from "./commands/secrets.js";
import { registerValidateCommand } from "./commands/validate.js";
import { registerSyncCommand } from "./commands/sync.js";
import { registerInitCommand } from "./commands/init.js";
import { registerFixCommand } from "./commands/fix.js";
import { registerCompletionCommand } from "./commands/completion.js";
import { registerGitCheckCommand } from "./commands/git-check.js";
import { registerDiffCommand } from "./commands/diff.js";
import { registerReportCommand } from "./commands/report.js";
import { registerWatchCommand } from "./commands/watch.js";
import { loadConfig } from "../core/config.js";

async function main() {
  const program = new Command();

  program
    .name("env-doctor")
    .description("Audit .env files across your codebase")
    .version("0.1.0")
    .option("-v, --verbose", "verbose output")
    .option("-q, --quiet", "suppress non-essential output")
    .option("--no-color", "disable color output")
    .option("--json", "output as JSON")
    .option("-d, --dir <path>", "target directory", process.cwd())
    .option("-e, --env-file <path>", "path to .env file")
    .option("--ignore <patterns...>", "directories/files to ignore");

  registerCheckCommand(program);
  registerUnusedCommand(program);
  registerMissingCommand(program);
  registerDriftCommand(program);
  registerSecretsCommand(program);
  registerValidateCommand(program);
  registerSyncCommand(program);
  registerInitCommand(program);
  registerFixCommand(program);
  registerCompletionCommand(program);
  registerGitCheckCommand(program);
  registerDiffCommand(program);
  registerReportCommand(program);
  registerWatchCommand(program);

  // Load config before parsing so defaults can be applied
  const dir = extractDirFromArgs(process.argv);
  const config = await loadConfig(dir);

  // Apply config defaults for env-file if not specified on CLI
  if (config.envFile && !process.argv.includes("-e") && !process.argv.includes("--env-file")) {
    program.setOptionValue("envFile", config.envFile);
  } else if (!process.argv.includes("-e") && !process.argv.includes("--env-file")) {
    program.setOptionValue("envFile", ".env");
  }

  // Apply config defaults for ignore if not specified on CLI
  if (config.ignore && !process.argv.includes("--ignore")) {
    program.setOptionValue("ignore", config.ignore);
  }

  program.parse();
}

/**
 * Extract --dir / -d value from argv before commander parses.
 */
function extractDirFromArgs(argv: string[]): string {
  for (let i = 0; i < argv.length; i++) {
    if ((argv[i] === "-d" || argv[i] === "--dir") && argv[i + 1]) {
      return argv[i + 1]!;
    }
  }
  return process.cwd();
}

main();
