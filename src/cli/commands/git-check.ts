import type { Command } from "commander";
import ora from "ora";
import chalk from "chalk";
import { checkGitSafety } from "../../core/git-check.js";
import { getGlobalOpts } from "./helpers.js";
import {
  formatHeader,
  formatSuccess,
  formatError,
  formatWarning,
  formatInfo,
  formatFile,
  formatSummary,
  printJsonOutput,
} from "../../utils/output.js";

export function registerGitCheckCommand(program: Command): void {
  program
    .command("git-check")
    .description("Check git safety for .env files")
    .action(async (_opts, cmd) => {
      const globals = getGlobalOpts(cmd);
      const spinner = globals.quiet
        ? null
        : ora("Checking git safety...").start();

      try {
        const result = await checkGitSafety(globals.dir);
        spinner?.stop();

        if (globals.json) {
          printJsonOutput(result);
          const hasIssues =
            !result.envInGitignore ||
            result.trackedEnvFiles.length > 0 ||
            result.historyLeaks.length > 0;
          process.exit(hasIssues ? 1 : 0);
        }

        if (!result.isGitRepo) {
          console.log(
            formatWarning("Not a git repository, skipping git checks"),
          );
          process.exit(0);
        }

        let hasIssues = false;

        console.log(formatHeader("Git Safety Check"));

        // .gitignore check
        if (result.envInGitignore) {
          console.log(formatSuccess(".env is listed in .gitignore"));
        } else {
          hasIssues = true;
          console.log(
            formatWarning(
              ".env is NOT in .gitignore -- secrets may be committed",
            ),
          );
        }

        // Tracked .env files
        if (result.trackedEnvFiles.length > 0) {
          hasIssues = true;
          console.log(
            formatError(
              `${result.trackedEnvFiles.length} .env file(s) tracked by git:`,
            ),
          );
          for (const file of result.trackedEnvFiles) {
            console.log(`    ${formatFile(file)}`);
          }
        } else {
          console.log(formatSuccess("No .env files tracked by git"));
        }

        // .env.example check
        if (result.exampleTracked) {
          console.log(formatSuccess(".env.example is tracked by git"));
        } else {
          console.log(
            formatInfo(
              "Consider adding .env.example to git for team onboarding",
            ),
          );
        }

        // History leaks
        if (result.historyLeaks.length > 0) {
          hasIssues = true;
          console.log(
            formatWarning(
              `Found ${result.historyLeaks.length} .env file(s) in git history:`,
            ),
          );
          for (const leak of result.historyLeaks) {
            console.log(
              `    ${formatFile(leak.file)}  ${chalk.gray(`commit ${leak.commit}`)}  ${chalk.gray(leak.date)}  ${chalk.gray(leak.author)}`,
            );
          }
        } else {
          console.log(
            formatSuccess("No .env files found in git history"),
          );
        }

        console.log();
        process.exit(hasIssues ? 1 : 0);
      } catch (err: any) {
        spinner?.fail(err.message);
        process.exit(2);
      }
    });
}
