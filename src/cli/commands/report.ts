import type { Command } from "commander";
import { writeFile } from "fs/promises";
import ora from "ora";
import chalk from "chalk";
import { generateReport, formatReportMarkdown } from "../../core/report.js";
import { getGlobalOpts } from "./helpers.js";
import { printJsonOutput } from "../../utils/output.js";

export function registerReportCommand(program: Command): void {
  program
    .command("report")
    .description("Generate a markdown audit report")
    .option("-o, --output <file>", "write report to file instead of stdout")
    .action(async (opts, cmd) => {
      const globals = getGlobalOpts(cmd);
      const spinner = globals.quiet
        ? null
        : ora("Generating audit report...").start();

      try {
        const report = await generateReport({
          dir: globals.dir,
          envFile: globals.envFile,
          ignore: globals.ignore,
        });

        spinner?.stop();

        if (globals.json) {
          printJsonOutput(report);
          process.exit(report.failCount > 0 ? 1 : 0);
        }

        const markdown = formatReportMarkdown(report);

        if (opts.output) {
          await writeFile(opts.output, markdown, "utf-8");
          console.log(
            chalk.green(`  Report written to ${opts.output}`),
          );
        } else {
          console.log(markdown);
        }

        process.exit(report.failCount > 0 ? 1 : 0);
      } catch (err: any) {
        spinner?.fail(err.message);
        process.exit(2);
      }
    });
}
