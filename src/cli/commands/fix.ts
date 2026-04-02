import type { Command } from "commander";
import { existsSync } from "fs";
import { writeFile } from "fs/promises";
import { resolve } from "path";
import ora from "ora";
import chalk from "chalk";
import { fixEnvFile } from "../../core/fix.js";
import { getGlobalOpts } from "./helpers.js";
import {
  formatHeader,
  formatSuccess,
  formatWarning,
  formatVar,
  formatSummary,
  printJsonOutput,
} from "../../utils/output.js";

export function registerFixCommand(program: Command): void {
  program
    .command("fix")
    .description("Auto-fix common .env file issues")
    .option("--dry-run", "preview fixes without writing to disk")
    .option("--sort", "sort keys alphabetically (default: true)")
    .option("--no-sort", "do not sort keys")
    .option(
      "--remove-duplicates",
      "remove duplicate keys, keep last (default: true)",
    )
    .option("--no-remove-duplicates", "do not remove duplicates")
    .option(
      "--add-missing",
      "add missing vars from .env.example (default: true)",
    )
    .option("--no-add-missing", "do not add missing vars")
    .action(async (opts, cmd) => {
      const globals = getGlobalOpts(cmd);

      if (!existsSync(globals.envFile)) {
        if (globals.json) {
          printJsonOutput({ error: "No .env file found" });
        } else {
          console.log(formatWarning(`No .env file found at ${globals.envFile}`));
        }
        process.exit(1);
      }

      const examplePath = resolve(globals.dir, ".env.example");
      const spinner =
        globals.quiet || opts.dryRun
          ? null
          : ora("Fixing .env file...").start();

      try {
        const result = await fixEnvFile({
          envFilePath: globals.envFile,
          exampleFilePath: existsSync(examplePath) ? examplePath : undefined,
          sort: opts.sort !== false,
          removeDuplicates: opts.removeDuplicates !== false,
          addMissing: opts.addMissing !== false,
        });

        spinner?.stop();

        if (globals.json) {
          printJsonOutput({
            dryRun: opts.dryRun ?? false,
            changes: result.changes,
            content: opts.dryRun ? result.content : undefined,
          });
          if (!opts.dryRun && result.changes.length > 0) {
            await writeFile(globals.envFile, result.content);
          }
          process.exit(0);
        }

        if (result.changes.length === 0) {
          console.log(formatSuccess("No issues to fix"));
          process.exit(0);
        }

        console.log(
          formatHeader(
            opts.dryRun ? "Proposed Fixes (dry run)" : "Applied Fixes",
          ),
        );

        for (const change of result.changes) {
          const icon =
            change.type === "remove-duplicate"
              ? chalk.red("-")
              : change.type === "add-missing"
                ? chalk.green("+")
                : chalk.blue("\u2195");
          console.log(`  ${icon}  ${formatVar(change.key)}  ${chalk.gray(change.detail)}`);
        }

        console.log(
          formatSummary(
            opts.dryRun ? "Changes to apply" : "Changes applied",
            result.changes.length,
          ),
        );

        if (opts.dryRun) {
          console.log(
            chalk.gray(
              "\n  Run without --dry-run to apply these fixes.\n",
            ),
          );
        } else {
          await writeFile(globals.envFile, result.content);
          console.log(
            chalk.green(`\n  Wrote fixed file to ${globals.envFile}\n`),
          );
        }

        process.exit(0);
      } catch (err: any) {
        spinner?.fail(err.message);
        process.exit(2);
      }
    });
}
