import type { Command } from "commander";

export function registerCompletionCommand(program: Command): void {
  program
    .command("completion")
    .description("Generate shell completion script")
    .argument("<shell>", "Shell type: bash, zsh, or fish")
    .action((shell: string) => {
      const commands =
        "check unused missing drift secrets validate sync init fix completion git-check diff report";
      const globalFlags =
        "--verbose --quiet --no-color --json --dir --env-file --ignore --help --version";

      switch (shell) {
        case "bash":
          console.log(`# env-doctor bash completion
# Add to ~/.bashrc: eval "$(env-doctor completion bash)"
_env_doctor_completions() {
  local cur="\${COMP_WORDS[COMP_CWORD]}"
  local commands="${commands}"
  local global_flags="${globalFlags}"

  if [ "\${COMP_CWORD}" -eq 1 ]; then
    COMPREPLY=( $(compgen -W "\${commands}" -- "\${cur}") )
  else
    case "\${COMP_WORDS[1]}" in
      fix)
        COMPREPLY=( $(compgen -W "--dry-run --sort --remove-duplicates --add-missing" -- "\${cur}") )
        ;;
      drift)
        COMPREPLY=( $(compgen -f -- "\${cur}") )
        ;;
      diff)
        COMPREPLY=( $(compgen -f -- "\${cur}") )
        ;;
      report)
        COMPREPLY=( $(compgen -W "--output" -- "\${cur}") )
        ;;
      *)
        COMPREPLY=( $(compgen -W "\${global_flags}" -- "\${cur}") )
        ;;
    esac
  fi
}
complete -F _env_doctor_completions env-doctor`);
          break;

        case "zsh":
          console.log(`# env-doctor zsh completion
# Add to ~/.zshrc: eval "$(env-doctor completion zsh)"
_env_doctor() {
  local -a commands=(
    'check:Run all audits'
    'unused:Find unused env variables'
    'missing:Find missing env variables'
    'drift:Detect env drift across files'
    'secrets:Scan for hardcoded secrets'
    'validate:Validate .env file format'
    'sync:Check .env against .env.example'
    'init:Generate .env.example from .env'
    'fix:Auto-fix common .env issues'
    'completion:Generate shell completions'
    'git-check:Check git safety for .env files'
    'diff:Show diff between two .env files'
    'report:Generate audit report'
  )

  _arguments -C \\
    '-v[Verbose output]' \\
    '-q[Quiet mode]' \\
    '--json[JSON output]' \\
    '-d[Target directory]:directory:_directories' \\
    '-e[Env file path]:file:_files' \\
    '--ignore[Ignore patterns]:patterns:' \\
    '--no-color[Disable colors]' \\
    '1:command:->cmds' \\
    '*::arg:->args'

  case "\$state" in
    cmds)
      _describe 'command' commands
      ;;
    args)
      case "\$words[1]" in
        fix)
          _arguments \\
            '--dry-run[Preview changes without writing]' \\
            '--sort[Sort keys alphabetically]' \\
            '--remove-duplicates[Remove duplicate keys]' \\
            '--add-missing[Add missing vars from .env.example]'
          ;;
      esac
      ;;
  esac
}
compdef _env_doctor env-doctor`);
          break;

        case "fish":
          console.log(`# env-doctor fish completion
# Save to ~/.config/fish/completions/env-doctor.fish
complete -c env-doctor -n '__fish_use_subcommand' -a 'check' -d 'Run all audits'
complete -c env-doctor -n '__fish_use_subcommand' -a 'unused' -d 'Find unused env variables'
complete -c env-doctor -n '__fish_use_subcommand' -a 'missing' -d 'Find missing env variables'
complete -c env-doctor -n '__fish_use_subcommand' -a 'drift' -d 'Detect env drift across files'
complete -c env-doctor -n '__fish_use_subcommand' -a 'secrets' -d 'Scan for hardcoded secrets'
complete -c env-doctor -n '__fish_use_subcommand' -a 'validate' -d 'Validate .env file format'
complete -c env-doctor -n '__fish_use_subcommand' -a 'sync' -d 'Check .env against .env.example'
complete -c env-doctor -n '__fish_use_subcommand' -a 'init' -d 'Generate .env.example from .env'
complete -c env-doctor -n '__fish_use_subcommand' -a 'fix' -d 'Auto-fix common .env issues'
complete -c env-doctor -n '__fish_use_subcommand' -a 'completion' -d 'Generate shell completions'
complete -c env-doctor -n '__fish_use_subcommand' -a 'git-check' -d 'Check git safety for .env files'
complete -c env-doctor -n '__fish_use_subcommand' -a 'diff' -d 'Show diff between two .env files'
complete -c env-doctor -n '__fish_use_subcommand' -a 'report' -d 'Generate audit report'
complete -c env-doctor -s v -l verbose -d 'Verbose output'
complete -c env-doctor -s q -l quiet -d 'Quiet mode'
complete -c env-doctor -l json -d 'JSON output'
complete -c env-doctor -s d -l dir -d 'Target directory' -r -F
complete -c env-doctor -s e -l env-file -d 'Env file path' -r -F
complete -c env-doctor -l ignore -d 'Ignore patterns'
complete -c env-doctor -l no-color -d 'Disable colors'
complete -c env-doctor -n '__fish_seen_subcommand_from fix' -l dry-run -d 'Preview changes'
complete -c env-doctor -n '__fish_seen_subcommand_from fix' -l sort -d 'Sort keys'
complete -c env-doctor -n '__fish_seen_subcommand_from fix' -l remove-duplicates -d 'Remove duplicates'
complete -c env-doctor -n '__fish_seen_subcommand_from fix' -l add-missing -d 'Add missing vars'`);
          break;

        default:
          console.error(
            `Unknown shell: ${shell}. Supported: bash, zsh, fish`,
          );
          process.exit(1);
      }
    });
}
