import type { Command } from "commander";
import chalk from "chalk";
import { watch } from "fs";
import { basename, resolve } from "path";
import { existsSync } from "fs";
import { getGlobalOpts } from "./helpers.js";
import { findUnusedVars } from "../../core/unused.js";
import { findMissingVars } from "../../core/missing.js";
import { validateEnvFormat } from "../../core/validate.js";
import { detectSecrets } from "../../core/secrets.js";

export function registerWatchCommand(program: Command) {
  program
    .command("watch")
    .description("Watch .env files for changes and re-run audits")
    .option("--checks <checks...>", "Checks to run: unused, missing, validate, secrets")
    .action(async (opts) => {
      const { dir, envFile, quiet, verbose, ignore } = getGlobalOpts(program);

      if (!existsSync(envFile)) {
        console.error(chalk.red(`File not found: ${envFile}`));
        process.exit(1);
      }

      const checks: string[] = opts.checks || ["unused", "missing", "validate", "secrets"];
      const scanOpts = { dir, ignore: ignore || [] };

      if (!quiet) {
        console.log(chalk.bold(`\n  Watching ${basename(envFile)} for changes...\n`));
        console.log(chalk.gray(`  Checks: ${checks.join(", ")}`));
        console.log(chalk.gray(`  Press Ctrl+C to stop\n`));
      }

      async function runChecks() {
        const timestamp = new Date().toLocaleTimeString();
        console.log(chalk.gray(`\n[${timestamp}] Running checks...\n`));

        let issues = 0;

        try {
          if (checks.includes("validate")) {
            const result = await validateEnvFormat(envFile);
            if (result.issues.length > 0) {
              console.log(chalk.yellow(`  Format: ${result.issues.length} issues`));
              if (verbose) {
                for (const issue of result.issues) {
                  console.log(chalk.gray(`    - ${issue.message} (line ${issue.line})`));
                }
              }
              issues += result.issues.length;
            } else {
              console.log(chalk.green("  Format: OK"));
            }
          }

          if (checks.includes("unused")) {
            const result = await findUnusedVars(envFile, scanOpts);
            if (result.unused.length > 0) {
              console.log(chalk.yellow(`  Unused: ${result.unused.length} variables`));
              if (verbose) {
                for (const v of result.unused) console.log(chalk.gray(`    - ${v.key}`));
              }
              issues += result.unused.length;
            } else {
              console.log(chalk.green("  Unused: none"));
            }
          }

          if (checks.includes("missing")) {
            const result = await findMissingVars(envFile, scanOpts);
            if (result.missing.length > 0) {
              console.log(chalk.yellow(`  Missing: ${result.missing.length} variables`));
              if (verbose) {
                for (const v of result.missing) console.log(chalk.gray(`    - ${v.key}`));
              }
              issues += result.missing.length;
            } else {
              console.log(chalk.green("  Missing: none"));
            }
          }

          if (checks.includes("secrets")) {
            const result = await detectSecrets(dir, ignore);
            if (result.matches.length > 0) {
              console.log(chalk.yellow(`  Secrets: ${result.matches.length} found`));
              issues += result.matches.length;
            } else {
              console.log(chalk.green("  Secrets: none"));
            }
          }

          if (issues === 0) {
            console.log(chalk.green("\n  All checks passed!"));
          } else {
            console.log(chalk.yellow(`\n  ${issues} issues found`));
          }
        } catch (error) {
          console.error(chalk.red(`  Error: ${error instanceof Error ? error.message : String(error)}`));
        }
      }

      await runChecks();

      let debounceTimer: ReturnType<typeof setTimeout> | null = null;

      watch(envFile, () => {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(runChecks, 300);
      });

      const examplePath = resolve(dir, ".env.example");
      if (existsSync(examplePath)) {
        watch(examplePath, () => {
          if (debounceTimer) clearTimeout(debounceTimer);
          debounceTimer = setTimeout(runChecks, 300);
        });
      }
    });
}
