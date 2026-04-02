import { resolve, join } from "path";
import type { Command } from "commander";

export interface GlobalOpts {
  dir: string;
  envFile: string;
  verbose: boolean;
  quiet: boolean;
  json: boolean;
  color: boolean;
  ignore?: string[];
}

/**
 * Extract global options from the root command.
 */
export function getGlobalOpts(cmd: Command): GlobalOpts {
  const root = cmd.parent ?? cmd;
  const opts = root.opts();
  const dir = resolve(opts.dir ?? process.cwd());
  const envFile = resolve(dir, opts.envFile ?? ".env");

  return {
    dir,
    envFile,
    verbose: opts.verbose ?? false,
    quiet: opts.quiet ?? false,
    json: opts.json ?? false,
    color: opts.color !== false,
    ignore: opts.ignore,
  };
}
