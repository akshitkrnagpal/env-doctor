import type { Command } from "commander";
import { existsSync } from "fs";
import chalk from "chalk";
import { diffEnvFiles } from "../../core/diff.js";
import { getGlobalOpts } from "./helpers.js";
import {
  formatHeader,
  formatSummary,
  printJsonOutput,
} from "../../utils/output.js";

export function registerDiffCommand(program: Command): void {
  program
    .command("diff")
    .description("Show detailed diff between two .env files")
    .argument("<fileA>", "first .env file")
    .argument("<fileB>", "second .env file")
    .action(async (fileA: string, fileB: string, _opts, cmd) => {
      const globals = getGlobalOpts(cmd);

      if (!existsSync(fileA)) {
        console.error(chalk.red(`File not found: ${fileA}`));
        process.exit(2);
      }
      if (!existsSync(fileB)) {
        console.error(chalk.red(`File not found: ${fileB}`));
        process.exit(2);
      }

      try {
        const result = await diffEnvFiles(fileA, fileB);

        if (globals.json) {
          printJsonOutput(result);
          process.exit(
            result.added + result.removed + result.changed > 0 ? 1 : 0,
          );
        }

        console.log(
          formatHeader(`Diff: ${chalk.cyan(fileA)} ${chalk.gray("vs")} ${chalk.cyan(fileB)}`),
        );

        for (const entry of result.entries) {
          switch (entry.type) {
            case "added":
              console.log(
                chalk.green(`  + ${entry.key}=${entry.newValue}`),
              );
              break;
            case "removed":
              console.log(
                chalk.red(`  - ${entry.key}=${entry.oldValue}`),
              );
              break;
            case "changed":
              console.log(
                chalk.yellow(
                  `  ~ ${entry.key}: ${chalk.red(String(entry.oldValue))} ${chalk.gray("\u2192")} ${chalk.green(String(entry.newValue))}`,
                ),
              );
              break;
            case "unchanged":
              if (globals.verbose) {
                console.log(
                  chalk.gray(`    ${entry.key}=${entry.oldValue}`),
                );
              }
              break;
          }
        }

        console.log();
        if (result.added > 0)
          console.log(chalk.green(`  ${result.added} added`));
        if (result.removed > 0)
          console.log(chalk.red(`  ${result.removed} removed`));
        if (result.changed > 0)
          console.log(chalk.yellow(`  ${result.changed} changed`));
        console.log(chalk.gray(`  ${result.unchanged} unchanged`));
        console.log();

        process.exit(
          result.added + result.removed + result.changed > 0 ? 1 : 0,
        );
      } catch (err: any) {
        console.error(chalk.red(err.message));
        process.exit(2);
      }
    });
}
