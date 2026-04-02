import type { Command } from "commander";
import { writeFile } from "fs/promises";
import { resolve, dirname } from "path";
import ora from "ora";
import chalk from "chalk";
import { generateEnvExample } from "../../core/init.js";
import { getGlobalOpts } from "./helpers.js";
import { formatSuccess } from "../../utils/output.js";

export function registerInitCommand(program: Command): void {
  program
    .command("init")
    .description(
      "Create .env.example from existing .env (with values stripped)",
    )
    .option("-o, --output <path>", "output file path", ".env.example")
    .action(async (opts, cmd) => {
      const globals = getGlobalOpts(cmd);
      const outputPath = resolve(globals.dir, opts.output);
      const spinner = globals.quiet ? null : ora("Generating .env.example...").start();

      try {
        const content = await generateEnvExample(globals.envFile);

        await writeFile(outputPath, content, "utf-8");

        spinner?.stop();

        if (!globals.quiet) {
          console.log(
            formatSuccess(
              `Created ${chalk.cyan(outputPath)} from ${chalk.cyan(globals.envFile)}`,
            ),
          );
        }

        process.exit(0);
      } catch (err: any) {
        spinner?.fail(err.message);
        process.exit(2);
      }
    });
}
