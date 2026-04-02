# env-doctor

A CLI tool that audits `.env` files in a project. Use it to detect unused variables, missing variables, hardcoded secrets, environment drift, format issues, and sync problems.

## When to use

Use env-doctor when working on a project that uses `.env` files for configuration. Run it to catch common issues before they cause runtime errors or security problems.

## Commands

```bash
# Run all audits at once (default)
env-doctor

# Find variables defined in .env but never used in code
env-doctor unused

# Find variables used in code but missing from .env
env-doctor missing

# Compare .env files across environments (e.g., .env.development vs .env.production)
env-doctor drift

# Scan source code for hardcoded secrets (API keys, tokens, passwords)
env-doctor secrets

# Validate .env file format (duplicates, empty values, syntax errors)
env-doctor validate

# Check .env against .env.example for missing variables
env-doctor sync

# Generate .env.example from an existing .env file (strips values)
env-doctor init

# Auto-fix common issues (remove duplicates, sort keys, add missing vars)
env-doctor fix
env-doctor fix --dry-run  # preview without writing

# Generate shell completions
env-doctor completion bash|zsh|fish
```

## Common flags

```bash
-d, --dir <path>           # target directory (default: cwd)
-e, --env-file <path>      # specific .env file (default: .env)
--json                     # output as JSON for CI pipelines
-v, --verbose              # show extra details
-q, --quiet                # suppress non-essential output
--ignore <patterns...>     # directories/files to ignore
```

## CI integration

env-doctor exits with code 0 when no issues are found and code 1 when issues are detected. Use `--json` for machine-readable output.

```yaml
- name: Audit env files
  run: bunx env-doctor --json
```

## Configuration

Settings can be stored in `.envdoctorrc.json` or in the `"env-doctor"` key of `package.json`:

```json
{
  "ignore": ["vendor", "tmp"],
  "envFile": ".env.local",
  "secretPatterns": [
    { "name": "Custom Token", "regex": "CUSTOM_[A-Z0-9]{32}", "severity": "high" }
  ]
}
```

## Multi-language support

Detects env variable usage in: JavaScript/TypeScript, Python, Ruby, Go, Rust, PHP, Java/Kotlin, and `.env` file references.
