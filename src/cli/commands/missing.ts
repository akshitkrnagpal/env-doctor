import type { Command } from "commander";
import ora from "ora";
import { findMissingVars } from "../../core/missing.js";
import { getGlobalOpts } from "./helpers.js";
import {
  formatHeader,
  formatSuccess,
  formatVar,
  formatFile,
  formatSummary,
  printJsonOutput,
} from "../../utils/output.js";
import chalk from "chalk";

export function registerMissingCommand(program: Command): void {
  program
    .command("missing")
    .description(
      "Find env variables referenced in code but not defined in .env",
    )
    .action(async (_opts, cmd) => {
      const globals = getGlobalOpts(cmd);
      const spinner = globals.quiet ? null : ora("Scanning for missing variables...").start();

      try {
        const result = await findMissingVars(globals.envFile, {
          dir: globals.dir,
          ignore: globals.ignore,
        });

        spinner?.stop();

        if (globals.json) {
          printJsonOutput(result);
          process.exit(result.missing.length > 0 ? 1 : 0);
        }

        if (!globals.quiet) {
          console.log(formatHeader("Missing Environment Variables"));
        }

        if (result.missing.length === 0) {
          if (!globals.quiet) {
            console.log(
              formatSuccess(
                "All referenced variables are defined in .env",
              ),
            );
          }
          process.exit(0);
        }

        for (const item of result.missing) {
          console.log(`\n  ${formatVar(item.key)}`);
          if (globals.verbose) {
            for (const ref of item.references) {
              console.log(
                `    ${chalk.gray("\u2192")} ${formatFile(ref.file, ref.line)}`,
              );
            }
          } else {
            console.log(
              `    Referenced in ${item.references.length} file(s)`,
            );
          }
        }

        if (!globals.quiet) {
          console.log(
            formatSummary("Missing variables", result.missing.length),
          );
          console.log(
            `  Files scanned: ${result.totalFilesScanned}\n`,
          );
        }

        process.exit(1);
      } catch (err: any) {
        spinner?.fail(err.message);
        process.exit(2);
      }
    });
}
