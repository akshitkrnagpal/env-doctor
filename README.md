# env-doctor

A `.env` file auditor for developers. Detect unused variables, missing variables, hardcoded secrets, environment drift, and more across your entire codebase or monorepo.

## Features

- **Unused detection** - Find variables defined in `.env` but never referenced in code
- **Missing detection** - Find variables referenced in code but missing from `.env`
- **Secret scanning** - Detect hardcoded API keys, tokens, passwords, and connection strings
- **Env drift** - Compare `.env.development` vs `.env.production` and find inconsistencies
- **Format validation** - Catch duplicate keys, empty values, syntax errors
- **Example sync** - Ensure `.env` has all variables from `.env.example`
- **Init** - Generate `.env.example` from an existing `.env` (values stripped)

## Multi-language support

env-doctor scans for environment variable usage across multiple languages:

- **JavaScript/TypeScript** - `process.env.VAR`, `process.env['VAR']`, `process.env["VAR"]`
- **Python** - `os.environ['VAR']`, `os.environ.get('VAR')`, `os.getenv('VAR')`
- **Ruby** - `ENV['VAR']`, `ENV.fetch('VAR')`
- **Go** - `os.Getenv("VAR")`
- **Rust** - `env::var("VAR")`, `std::env::var("VAR")`
- **PHP** - `getenv('VAR')`, `$_ENV['VAR']`, `$_SERVER['VAR']`
- **Java/Kotlin** - `System.getenv("VAR")`
- **.env files** - `${VAR}` references

## Installation

```bash
# Using bun
bun add -g env-doctor

# Using npm
npm install -g env-doctor
```

## Usage

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
```

## Global flags

```
-v, --verbose              Verbose output with extra details
-q, --quiet                Suppress non-essential output
    --no-color             Disable color output
    --json                 Output as JSON (for CI integration)
-d, --dir <path>           Target directory (default: cwd)
-e, --env-file <path>      Specific .env file (default: .env)
    --ignore <patterns...> Directories/files to ignore
```

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
```

## CI Integration

env-doctor exits with code 0 when no issues are found and code 1 when issues are detected, making it suitable for CI pipelines:

```yaml
# GitHub Actions
- name: Audit env files
  run: bunx env-doctor --json
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

# Build binary
bun run build
```

## License

MIT
