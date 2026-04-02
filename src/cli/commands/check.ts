import type { Command } from "commander";
import { existsSync } from "fs";
import { resolve } from "path";
import ora from "ora";
import chalk from "chalk";
import { findUnusedVars } from "../../core/unused.js";
import { findMissingVars } from "../../core/missing.js";
import { detectSecrets } from "../../core/secrets.js";
import { detectDrift } from "../../core/drift.js";
import { validateEnvFormat } from "../../core/validate.js";
import { syncEnvExample } from "../../core/sync.js";
import { getGlobalOpts } from "./helpers.js";
import {
  formatHeader,
  formatSuccess,
  formatError,
  formatWarning,
  formatVar,
  formatFile,
  formatSeverity,
  formatSummary,
  printJsonOutput,
} from "../../utils/output.js";

export function registerCheckCommand(program: Command): void {
  program
    .command("check", { isDefault: true })
    .description("Run all audits on the current directory")
    .action(async (_opts, cmd) => {
      const globals = getGlobalOpts(cmd);
      let hasIssues = false;

      if (globals.json) {
        // Collect all results and output as single JSON
        const results: Record<string, unknown> = {};

        if (existsSync(globals.envFile)) {
          const [unusedResult, missingResult, validateResult] =
            await Promise.all([
              findUnusedVars(globals.envFile, {
                dir: globals.dir,
                ignore: globals.ignore,
              }),
              findMissingVars(globals.envFile, {
                dir: globals.dir,
                ignore: globals.ignore,
              }),
              validateEnvFormat(globals.envFile),
            ]);

          results.unused = unusedResult;
          results.missing = missingResult;
          results.validation = validateResult;

          if (
            unusedResult.unused.length > 0 ||
            missingResult.missing.length > 0 ||
            !validateResult.valid
          ) {
            hasIssues = true;
          }
        }

        const [secretsResult, driftResult] = await Promise.all([
          detectSecrets({ dir: globals.dir, ignore: globals.ignore }),
          detectDrift(globals.dir),
        ]);

        results.secrets = secretsResult;
        results.drift = driftResult;

        if (secretsResult.secrets.length > 0 || driftResult.drift.length > 0) {
          hasIssues = true;
        }

        // Check .env.example sync
        const examplePath = resolve(globals.dir, ".env.example");
        if (existsSync(examplePath) && existsSync(globals.envFile)) {
          const syncResult = await syncEnvExample(
            globals.envFile,
            examplePath,
          );
          results.sync = syncResult;
          if (syncResult.missing.length > 0) hasIssues = true;
        }

        printJsonOutput(results);
        process.exit(hasIssues ? 1 : 0);
      }

      // Pretty output mode
      console.log(
        chalk.bold("\n  env-doctor") +
          chalk.gray(" v0.1.0") +
          chalk.gray("  \u2014  auditing your environment\n"),
      );

      // 1. Validate format
      if (existsSync(globals.envFile)) {
        const spinner = globals.quiet ? null : ora("Validating .env format...").start();
        try {
          const result = await validateEnvFormat(globals.envFile);
          spinner?.stop();

          if (result.issues.length > 0) {
            hasIssues = true;
            console.log(formatHeader("Format Issues"));
            for (const issue of result.issues) {
              const formatter =
                issue.severity === "error"
                  ? formatError
                  : formatWarning;
              console.log(
                formatter(`Line ${issue.line}: ${issue.message}`),
              );
            }
          } else if (!globals.quiet) {
            console.log(formatSuccess("Format: valid"));
          }
        } catch {
          spinner?.stop();
        }
      } else if (!globals.quiet) {
        console.log(
          formatWarning(`No .env file found at ${globals.envFile}`),
        );
      }

      // 2. Unused variables
      if (existsSync(globals.envFile)) {
        const spinner = globals.quiet ? null : ora("Checking for unused variables...").start();
        try {
          const result = await findUnusedVars(globals.envFile, {
            dir: globals.dir,
            ignore: globals.ignore,
          });
          spinner?.stop();

          if (result.unused.length > 0) {
            hasIssues = true;
            console.log(formatHeader("Unused Variables"));
            for (const item of result.unused) {
              console.log(
                `  ${formatVar(item.key)}  ${formatFile(item.envFile, item.line)}`,
              );
            }
            console.log(
              formatSummary(
                "Unused",
                result.unused.length,
                result.totalVars,
              ),
            );
          } else if (!globals.quiet) {
            console.log(formatSuccess("No unused variables"));
          }
        } catch {
          spinner?.stop();
        }
      }

      // 3. Missing variables
      if (existsSync(globals.envFile)) {
        const spinner = globals.quiet ? null : ora("Checking for missing variables...").start();
        try {
          const result = await findMissingVars(globals.envFile, {
            dir: globals.dir,
            ignore: globals.ignore,
          });
          spinner?.stop();

          if (result.missing.length > 0) {
            hasIssues = true;
            console.log(formatHeader("Missing Variables"));
            for (const item of result.missing) {
              console.log(
                `  ${formatVar(item.key)}  (${item.references.length} reference${item.references.length > 1 ? "s" : ""})`,
              );
            }
            console.log(
              formatSummary("Missing", result.missing.length),
            );
          } else if (!globals.quiet) {
            console.log(
              formatSuccess("No missing variables"),
            );
          }
        } catch {
          spinner?.stop();
        }
      }

      // 4. Secrets scan
      {
        const spinner = globals.quiet ? null : ora("Scanning for hardcoded secrets...").start();
        try {
          const result = await detectSecrets({
            dir: globals.dir,
            ignore: globals.ignore,
          });
          spinner?.stop();

          if (result.secrets.length > 0) {
            hasIssues = true;
            console.log(formatHeader("Hardcoded Secrets"));
            for (const secret of result.secrets) {
              console.log(
                `  ${formatSeverity(secret.severity)}  ${chalk.white(secret.pattern)}  ${formatFile(secret.file, secret.line)}`,
              );
            }
            console.log(
              formatSummary("Secrets", result.secrets.length),
            );
          } else if (!globals.quiet) {
            console.log(
              formatSuccess("No hardcoded secrets detected"),
            );
          }
        } catch {
          spinner?.stop();
        }
      }

      // 5. Drift
      {
        const spinner = globals.quiet ? null : ora("Checking for env drift...").start();
        try {
          const result = await detectDrift(globals.dir);
          spinner?.stop();

          if (result.drift.length > 0) {
            hasIssues = true;
            console.log(formatHeader("Environment Drift"));
            for (const entry of result.drift) {
              const missingStr = entry.missingFrom
                .map((f) => chalk.red(f))
                .join(", ");
              console.log(
                `  ${formatVar(entry.key)}  missing from: ${missingStr}`,
              );
            }
            console.log(
              formatSummary("Drift issues", result.drift.length),
            );
          } else if (result.files.length >= 2 && !globals.quiet) {
            console.log(
              formatSuccess("No environment drift"),
            );
          }
        } catch {
          spinner?.stop();
        }
      }

      // 6. Sync with .env.example
      const examplePath = resolve(globals.dir, ".env.example");
      if (existsSync(examplePath) && existsSync(globals.envFile)) {
        const spinner = globals.quiet ? null : ora("Comparing with .env.example...").start();
        try {
          const result = await syncEnvExample(
            globals.envFile,
            examplePath,
          );
          spinner?.stop();

          if (result.missing.length > 0) {
            hasIssues = true;
            console.log(formatHeader("Missing from .env (in .env.example)"));
            for (const item of result.missing) {
              console.log(`  ${formatVar(item.key)}`);
            }
            console.log(
              formatSummary(
                "Out of sync",
                result.missing.length,
              ),
            );
          } else if (!globals.quiet) {
            console.log(
              formatSuccess("In sync with .env.example"),
            );
          }
        } catch {
          spinner?.stop();
        }
      }

      // Final summary
      console.log();
      if (hasIssues) {
        console.log(
          chalk.red.bold("  Issues found. Run individual commands for details.\n"),
        );
      } else {
        console.log(
          chalk.green.bold("  All checks passed!\n"),
        );
      }

      process.exit(hasIssues ? 1 : 0);
    });
}
