import type { Command } from "commander";
import ora from "ora";
import { detectDrift } from "../../core/drift.js";
import { getGlobalOpts } from "./helpers.js";
import {
  formatHeader,
  formatSuccess,
  formatVar,
  formatSummary,
  printJsonOutput,
} from "../../utils/output.js";
import chalk from "chalk";

export function registerDriftCommand(program: Command): void {
  program
    .command("drift")
    .description("Compare env files across environments")
    .argument("[files...]", "specific env files to compare")
    .action(async (files: string[], _opts, cmd) => {
      const globals = getGlobalOpts(cmd);
      const spinner = globals.quiet ? null : ora("Comparing env files...").start();

      try {
        const result = await detectDrift(
          globals.dir,
          files.length > 0 ? files : undefined,
        );

        spinner?.stop();

        if (globals.json) {
          printJsonOutput(result);
          process.exit(result.drift.length > 0 ? 1 : 0);
        }

        if (!globals.quiet) {
          console.log(formatHeader("Environment Drift"));
        }

        if (result.files.length < 2) {
          console.log(
            chalk.yellow(
              "  Need at least 2 env files to compare. Found: " +
                (result.files.length === 0
                  ? "none"
                  : result.files.join(", ")),
            ),
          );
          process.exit(0);
        }

        if (!globals.quiet) {
          console.log(
            `  Comparing: ${result.files.map((f) => chalk.cyan(f)).join(", ")}\n`,
          );
        }

        if (result.drift.length === 0) {
          console.log(formatSuccess("No drift detected"));
          process.exit(0);
        }

        for (const entry of result.drift) {
          const missingStr = entry.missingFrom
            .map((f) => chalk.red(f))
            .join(", ");
          console.log(
            `  ${formatVar(entry.key)}  missing from: ${missingStr}`,
          );
        }

        if (!globals.quiet) {
          console.log(
            formatSummary(
              "Variables with drift",
              result.drift.length,
              result.allKeys.length,
            ),
          );
          console.log();
        }

        process.exit(1);
      } catch (err: any) {
        spinner?.fail(err.message);
        process.exit(2);
      }
    });
}
