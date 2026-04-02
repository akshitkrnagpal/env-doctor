import type { Command } from "commander";
import ora from "ora";
import { detectSecrets } from "../../core/secrets.js";
import { getGlobalOpts } from "./helpers.js";
import {
  formatHeader,
  formatSuccess,
  formatFile,
  formatSeverity,
  formatSummary,
  printJsonOutput,
} from "../../utils/output.js";
import chalk from "chalk";

export function registerSecretsCommand(program: Command): void {
  program
    .command("secrets")
    .description("Scan for hardcoded secrets in source code")
    .action(async (_opts, cmd) => {
      const globals = getGlobalOpts(cmd);
      const spinner = globals.quiet ? null : ora("Scanning for hardcoded secrets...").start();

      try {
        const result = await detectSecrets({
          dir: globals.dir,
          ignore: globals.ignore,
        });

        spinner?.stop();

        if (globals.json) {
          printJsonOutput(result);
          process.exit(result.secrets.length > 0 ? 1 : 0);
        }

        if (!globals.quiet) {
          console.log(formatHeader("Hardcoded Secrets"));
        }

        if (result.secrets.length === 0) {
          if (!globals.quiet) {
            console.log(
              formatSuccess("No hardcoded secrets detected"),
            );
          }
          process.exit(0);
        }

        for (const secret of result.secrets) {
          console.log(
            `\n  ${formatSeverity(secret.severity)}  ${chalk.white(secret.pattern)}`,
          );
          console.log(`    ${formatFile(secret.file, secret.line)}`);
          if (globals.verbose) {
            console.log(`    ${chalk.gray(secret.match)}`);
          }
        }

        const highCount = result.secrets.filter(
          (s) => s.severity === "high",
        ).length;
        const medCount = result.secrets.filter(
          (s) => s.severity === "medium",
        ).length;

        if (!globals.quiet) {
          console.log(
            formatSummary("Secrets found", result.secrets.length),
          );
          if (highCount > 0)
            console.log(`  ${chalk.red(`  High: ${highCount}`)}`);
          if (medCount > 0)
            console.log(
              `  ${chalk.yellow(`  Medium: ${medCount}`)}`,
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
