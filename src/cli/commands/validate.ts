import type { Command } from "commander";
import ora from "ora";
import { validateEnvFormat } from "../../core/validate.js";
import { getGlobalOpts } from "./helpers.js";
import {
  formatHeader,
  formatSuccess,
  formatError,
  formatWarning,
  formatSummary,
  printJsonOutput,
} from "../../utils/output.js";

export function registerValidateCommand(program: Command): void {
  program
    .command("validate")
    .description("Validate .env file format")
    .action(async (_opts, cmd) => {
      const globals = getGlobalOpts(cmd);
      const spinner = globals.quiet ? null : ora("Validating .env format...").start();

      try {
        const result = await validateEnvFormat(globals.envFile);

        spinner?.stop();

        if (globals.json) {
          printJsonOutput(result);
          process.exit(result.valid ? 0 : 1);
        }

        if (!globals.quiet) {
          console.log(formatHeader("Format Validation"));
        }

        if (result.issues.length === 0) {
          if (!globals.quiet) {
            console.log(formatSuccess("No format issues found"));
          }
          process.exit(0);
        }

        for (const issue of result.issues) {
          const formatter =
            issue.severity === "error" ? formatError : formatWarning;
          console.log(
            formatter(`Line ${issue.line}: ${issue.message}`),
          );
        }

        const errorCount = result.issues.filter(
          (i) => i.severity === "error",
        ).length;
        const warnCount = result.issues.filter(
          (i) => i.severity === "warning",
        ).length;

        if (!globals.quiet) {
          console.log(
            formatSummary("Issues", result.issues.length, result.totalEntries),
          );
          if (errorCount > 0) console.log(`    Errors: ${errorCount}`);
          if (warnCount > 0) console.log(`    Warnings: ${warnCount}`);
          console.log();
        }

        process.exit(result.valid ? 0 : 1);
      } catch (err: any) {
        spinner?.fail(err.message);
        process.exit(2);
      }
    });
}
