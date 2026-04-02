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
  .option("-e, --env-file <path>", "path to .env file", ".env")
  .option("--ignore <patterns...>", "directories/files to ignore");

registerCheckCommand(program);
registerUnusedCommand(program);
registerMissingCommand(program);
registerDriftCommand(program);
registerSecretsCommand(program);
registerValidateCommand(program);
registerSyncCommand(program);
registerInitCommand(program);

program.parse();
