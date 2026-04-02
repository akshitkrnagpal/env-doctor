import type { Command } from "commander";
import ora from "ora";
import { findUnusedVars } from "../../core/unused.js";
import { getGlobalOpts } from "./helpers.js";
import {
  formatHeader,
  formatSuccess,
  formatBullet,
  formatVar,
  formatFile,
  formatSummary,
  printJsonOutput,
} from "../../utils/output.js";

export function registerUnusedCommand(program: Command): void {
  program
    .command("unused")
    .description("Find env variables defined but never referenced in code")
    .action(async (_opts, cmd) => {
      const globals = getGlobalOpts(cmd);
      const spinner = globals.quiet ? null : ora("Scanning for unused variables...").start();

      try {
        const result = await findUnusedVars(globals.envFile, {
          dir: globals.dir,
          ignore: globals.ignore,
        });

        spinner?.stop();

        if (globals.json) {
          printJsonOutput(result);
          process.exit(result.unused.length > 0 ? 1 : 0);
        }

        if (!globals.quiet) {
          console.log(formatHeader("Unused Environment Variables"));
        }

        if (result.unused.length === 0) {
          if (!globals.quiet) {
            console.log(formatSuccess("No unused variables found"));
          }
          process.exit(0);
        }

        for (const item of result.unused) {
          console.log(
            `  ${formatVar(item.key)}  ${formatFile(item.envFile, item.line)}`,
          );
        }

        if (!globals.quiet) {
          console.log(
            formatSummary(
              "Unused variables",
              result.unused.length,
              result.totalVars,
            ),
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
