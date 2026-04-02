import chalk from "chalk";

export interface OutputOptions {
  json: boolean;
  quiet: boolean;
  verbose: boolean;
  noColor: boolean;
}

const icons = {
  success: "\u2713",
  error: "\u2717",
  warning: "\u26A0",
  info: "\u2139",
  bullet: "\u2022",
  arrow: "\u2192",
};

export function formatHeader(title: string): string {
  return `\n${chalk.bold.underline(title)}\n`;
}

export function formatSuccess(msg: string): string {
  return chalk.green(`  ${icons.success} ${msg}`);
}

export function formatError(msg: string): string {
  return chalk.red(`  ${icons.error} ${msg}`);
}

export function formatWarning(msg: string): string {
  return chalk.yellow(`  ${icons.warning} ${msg}`);
}

export function formatInfo(msg: string): string {
  return chalk.blue(`  ${icons.info} ${msg}`);
}

export function formatBullet(msg: string): string {
  return chalk.gray(`  ${icons.bullet} ${msg}`);
}

export function formatFile(filePath: string, line?: number): string {
  if (line !== undefined) {
    return chalk.cyan(`${filePath}:${line}`);
  }
  return chalk.cyan(filePath);
}

export function formatVar(name: string): string {
  return chalk.bold.yellow(name);
}

export function formatSeverity(severity: "high" | "medium" | "low"): string {
  switch (severity) {
    case "high":
      return chalk.bgRed.white.bold(` HIGH `);
    case "medium":
      return chalk.bgYellow.black.bold(` MED  `);
    case "low":
      return chalk.bgBlue.white.bold(` LOW  `);
  }
}

export function formatSummary(
  label: string,
  count: number,
  total?: number,
): string {
  const countStr =
    count === 0 ? chalk.green(`${count}`) : chalk.red(`${count}`);
  const totalStr = total !== undefined ? chalk.gray(` / ${total} total`) : "";
  return `\n  ${label}: ${countStr}${totalStr}`;
}

export function printJsonOutput(data: unknown): void {
  console.log(JSON.stringify(data, null, 2));
}
