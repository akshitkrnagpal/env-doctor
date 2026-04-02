import type { Command } from "commander";
import { resolve } from "path";
import ora from "ora";
import { syncEnvExample } from "../../core/sync.js";
import { getGlobalOpts } from "./helpers.js";
import {
  formatHeader,
  formatSuccess,
  formatVar,
  formatSummary,
  printJsonOutput,
} from "../../utils/output.js";
import chalk from "chalk";

export function registerSyncCommand(program: Command): void {
  program
    .command("sync")
    .description("Show what needs to be added to .env from .env.example")
    .option(
      "--example <path>",
      "path to example file",
      ".env.example",
    )
    .action(async (opts, cmd) => {
      const globals = getGlobalOpts(cmd);
      const examplePath = resolve(globals.dir, opts.example);
      const spinner = globals.quiet ? null : ora("Comparing with .env.example...").start();

      try {
        const result = await syncEnvExample(
          globals.envFile,
          examplePath,
        );

        spinner?.stop();

        if (globals.json) {
          printJsonOutput(result);
          process.exit(result.missing.length > 0 ? 1 : 0);
        }

        if (!globals.quiet) {
          console.log(formatHeader("Sync with .env.example"));
        }

        if (result.missing.length === 0) {
          if (!globals.quiet) {
            console.log(
              formatSuccess(
                "Your .env has all variables from .env.example",
              ),
            );
          }
          process.exit(0);
        }

        console.log(
          chalk.gray("  Add these to your .env file:\n"),
        );
        for (const item of result.missing) {
          const defaultStr = item.hasDefault
            ? chalk.gray(` (default: ${item.defaultValue})`)
            : "";
          console.log(`  ${formatVar(item.key)}${defaultStr}`);
        }

        if (!globals.quiet) {
          console.log(
            formatSummary("Missing from .env", result.missing.length),
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
