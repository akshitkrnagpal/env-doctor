# env-doctor

[![CI](https://github.com/akshitkrnagpal/env-doctor/actions/workflows/ci.yml/badge.svg)](https://github.com/akshitkrnagpal/env-doctor/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/@akshitkrnagpal/env-doctor.svg)](https://www.npmjs.com/package/@akshitkrnagpal/env-doctor)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A `.env` file auditor for developers. Detect unused variables, missing variables, hardcoded secrets, environment drift, and more across your entire codebase or monorepo.

## Features

- **Unused detection** -- Find variables defined in `.env` but never referenced in code
- **Missing detection** -- Find variables referenced in code but missing from `.env`
- **Secret scanning** -- Detect hardcoded API keys, tokens, passwords, and connection strings
- **Env drift** -- Compare `.env.development` vs `.env.production` and find inconsistencies
- **Format validation** -- Catch duplicate keys, empty values, syntax errors
- **Example sync** -- Ensure `.env` has all variables from `.env.example`
- **Init** -- Generate `.env.example` from an existing `.env` (values stripped)
- **Auto-fix** -- Remove duplicates, sort keys, add missing vars from `.env.example`
- **Git safety** -- Check if `.env` is gitignored, tracked, or leaked in git history
- **Env diff** -- Detailed colored diff between two `.env` files showing added, removed, and changed values
- **Audit report** -- Generate a markdown report with pass/fail summaries across all checks
- **Config file** -- Load settings from `.envdoctorrc.json` or `package.json`
- **Shell completions** -- Bash, Zsh, and Fish completion scripts

## Multi-language support

env-doctor scans for environment variable usage across multiple languages:

- **JavaScript/TypeScript** -- `process.env.VAR`, `process.env['VAR']`, `process.env["VAR"]`
- **Python** -- `os.environ['VAR']`, `os.environ.get('VAR')`, `os.getenv('VAR')`
- **Ruby** -- `ENV['VAR']`, `ENV.fetch('VAR')`
- **Go** -- `os.Getenv("VAR")`
- **Rust** -- `env::var("VAR")`, `std::env::var("VAR")`
- **PHP** -- `getenv('VAR')`, `$_ENV['VAR']`, `$_SERVER['VAR']`
- **Java/Kotlin** -- `System.getenv("VAR")`
- **.env files** -- `${VAR}` references

## Installation

```bash
# Using npm
npm install -g @akshitkrnagpal/env-doctor

# Run without installing
npx @akshitkrnagpal/env-doctor

# Using bun
bunx @akshitkrnagpal/env-doctor
```

## Usage

### Commands

```bash
# Run all audits (default command)
env-doctor

# Individual commands
env-doctor unused          # Find unused env vars
env-doctor missing         # Find missing env vars
env-doctor drift           # Compare env files across environments
env-doctor secrets         # Scan for hardcoded secrets
env-doctor validate        # Validate .env file format
env-doctor sync            # Check .env against .env.example
env-doctor init            # Create .env.example from .env
env-doctor fix             # Auto-fix common issues
env-doctor git-check       # Check git safety for .env files
env-doctor diff <a> <b>    # Detailed diff between two .env files
env-doctor report          # Generate markdown audit report
env-doctor completion      # Generate shell completions
```

### Global flags

```
-v, --verbose              Verbose output with extra details
-q, --quiet                Suppress non-essential output
    --no-color             Disable color output
    --json                 Output as JSON (for CI integration)
-d, --dir <path>           Target directory (default: cwd)
-e, --env-file <path>      Specific .env file (default: .env)
    --ignore <patterns...> Directories/files to ignore
```

### Fix command

Auto-fix common `.env` file issues:

```bash
# Preview fixes without writing
env-doctor fix --dry-run

# Apply all fixes (remove duplicates, sort, add missing)
env-doctor fix

# Selective fixes
env-doctor fix --no-sort                 # Skip sorting
env-doctor fix --no-remove-duplicates    # Keep duplicates
env-doctor fix --no-add-missing          # Don't add from .env.example
```

The fix command:
- **Removes duplicate keys** -- keeps the last occurrence
- **Sorts keys alphabetically** -- for consistent ordering
- **Adds missing variables** -- from `.env.example` with placeholder values

### Git check command

Check git safety for `.env` files:

```bash
# Run standalone
env-doctor git-check

# Also included in the default check command
env-doctor check
```

The git-check command:
- **Checks `.gitignore`** -- warns if `.env` is not listed in `.gitignore`
- **Checks tracked files** -- warns if any `.env` files are tracked by git
- **Checks `.env.example`** -- suggests adding `.env.example` to git if missing
- **Scans git history** -- detects accidentally committed `.env` files

### Diff command

Show a detailed diff between two `.env` files:

```bash
# Compare two env files
env-doctor diff .env.development .env.production

# Show unchanged keys too
env-doctor diff .env.local .env.staging --verbose

# JSON output
env-doctor diff .env .env.example --json
```

The diff shows:
- **Added keys** in green
- **Removed keys** in red
- **Changed values** in yellow with old and new values
- **Unchanged keys** in gray (only with `--verbose`)

### Report command

Generate a markdown audit report:

```bash
# Print report to stdout
env-doctor report

# Write report to a file
env-doctor report --output audit-report.md

# JSON output
env-doctor report --json
```

The report includes:
- Summary with pass/fail/skip counts
- Sections for format validation, unused/missing variables, secrets, drift, sync, and git safety
- Timestamp and project path

### Shell completions

```bash
# Bash (add to ~/.bashrc)
eval "$(env-doctor completion bash)"

# Zsh (add to ~/.zshrc)
eval "$(env-doctor completion zsh)"

# Fish (save to completions dir)
env-doctor completion fish > ~/.config/fish/completions/env-doctor.fish
```

## Configuration

env-doctor loads settings from `.envdoctorrc.json` or the `"env-doctor"` key in `package.json`. CLI flags always take precedence over config file values.

### `.envdoctorrc.json`

```json
{
  "ignore": ["vendor", "tmp", "generated"],
  "envFile": ".env.local",
  "secretPatterns": [
    {
      "name": "Custom Internal Token",
      "regex": "INTERNAL_[A-Z0-9]{32}",
      "severity": "high"
    }
  ]
}
```

### `package.json`

```json
{
  "env-doctor": {
    "ignore": ["vendor"],
    "envFile": ".env.local"
  }
}
```

### Config options

| Option           | Type     | Description                                    |
| ---------------- | -------- | ---------------------------------------------- |
| `ignore`         | string[] | Glob patterns to ignore when scanning          |
| `envFile`        | string   | Path to the `.env` file (relative to root)     |
| `secretPatterns` | array    | Additional secret patterns with name, regex, severity |

## Examples

```bash
# Scan a specific project directory
env-doctor -d ./my-project

# Use a specific env file
env-doctor -e .env.local

# JSON output for CI pipelines
env-doctor --json

# Ignore certain directories
env-doctor --ignore vendor tmp

# Compare specific env files
env-doctor drift .env.staging .env.production

# Generate .env.example
env-doctor init -o .env.example

# Verbose output for debugging
env-doctor missing -v

# Fix issues in dry-run mode
env-doctor fix --dry-run
```

## CI Integration

env-doctor exits with code 0 when no issues are found and code 1 when issues are detected, making it suitable for CI pipelines.

### GitHub Actions

```yaml
name: Env Audit
on: [push, pull_request]
jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - run: bunx @akshitkrnagpal/env-doctor --json
```

## Development

```bash
# Install dependencies
bun install

# Run in dev mode
bun dev

# Run tests
bun test

# Type check
bun run typecheck

# Build for npm
bun run build:npm
```

## License

MIT
