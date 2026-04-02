import { scanSourceFiles, type ScanOptions } from "./scanner.js";

export interface SecretMatch {
  file: string;
  line: number;
  pattern: string;
  match: string;
  severity: "high" | "medium" | "low";
}

export interface SecretsResult {
  secrets: SecretMatch[];
  totalFilesScanned: number;
}

interface SecretPattern {
  name: string;
  regex: RegExp;
  severity: "high" | "medium" | "low";
}

const SECRET_PATTERNS: SecretPattern[] = [
  // AWS Access Key
  {
    name: "AWS Access Key",
    regex: /(?:^|[^a-zA-Z0-9])(AKIA[0-9A-Z]{16})(?:$|[^a-zA-Z0-9])/,
    severity: "high",
  },
  // AWS Secret Key (generic pattern)
  {
    name: "AWS Secret Key",
    regex:
      /(?:aws_secret_access_key|aws_secret)\s*[=:]\s*['"]?([a-zA-Z0-9/+=]{40})['"]?/i,
    severity: "high",
  },
  // Stripe keys
  {
    name: "Stripe Secret Key",
    regex: /(?:^|[^a-zA-Z0-9])(sk_live_[a-zA-Z0-9]{20,})(?:$|[^a-zA-Z0-9])/,
    severity: "high",
  },
  {
    name: "Stripe Publishable Key",
    regex: /(?:^|[^a-zA-Z0-9])(pk_live_[a-zA-Z0-9]{20,})(?:$|[^a-zA-Z0-9])/,
    severity: "medium",
  },
  // OpenAI-style keys
  {
    name: "OpenAI API Key",
    regex: /(?:^|[^a-zA-Z0-9])(sk-[a-zA-Z0-9]{32,})(?:$|[^a-zA-Z0-9])/,
    severity: "high",
  },
  // JWT tokens (three base64 sections separated by dots)
  {
    name: "JWT Token",
    regex:
      /['"]?(eyJ[a-zA-Z0-9_-]{10,}\.eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,})['"]?/,
    severity: "high",
  },
  // Private keys
  {
    name: "Private Key",
    regex: /-----BEGIN (?:RSA |EC |DSA )?PRIVATE KEY-----/,
    severity: "high",
  },
  // Database connection strings with passwords
  {
    name: "Database URL with Password",
    regex:
      /(?:mongodb|postgres|postgresql|mysql|redis):\/\/[^:]+:[^@\s'"]+@[^\s'"]+/i,
    severity: "high",
  },
  // Generic password assignments
  {
    name: "Hardcoded Password",
    regex:
      /(?:password|passwd|pwd)\s*[=:]\s*['"][^'"]{4,}['"]/i,
    severity: "medium",
  },
  // Generic secret assignments
  {
    name: "Hardcoded Secret",
    regex: /(?:secret|secret_key)\s*[=:]\s*['"][^'"]{4,}['"]/i,
    severity: "medium",
  },
  // Generic token assignments
  {
    name: "Hardcoded Token",
    regex:
      /(?:token|api_token|access_token|auth_token)\s*[=:]\s*['"][^'"]{8,}['"]/i,
    severity: "medium",
  },
  // Generic API key assignments
  {
    name: "Hardcoded API Key",
    regex: /(?:api_key|apikey|api[-_]?secret)\s*[=:]\s*['"][^'"]{8,}['"]/i,
    severity: "medium",
  },
  // GitHub tokens
  {
    name: "GitHub Token",
    regex:
      /(?:^|[^a-zA-Z0-9])(ghp_[a-zA-Z0-9]{36}|gho_[a-zA-Z0-9]{36}|ghu_[a-zA-Z0-9]{36}|ghs_[a-zA-Z0-9]{36}|ghr_[a-zA-Z0-9]{36})(?:$|[^a-zA-Z0-9])/,
    severity: "high",
  },
  // Slack tokens
  {
    name: "Slack Token",
    regex:
      /(?:^|[^a-zA-Z0-9])(xox[baprs]-[a-zA-Z0-9-]{10,})(?:$|[^a-zA-Z0-9])/,
    severity: "high",
  },
];

/** Files to skip for secret scanning (test fixtures, lockfiles, etc.) */
function shouldSkipForSecrets(filePath: string): boolean {
  const lower = filePath.toLowerCase();
  return (
    lower.includes(".lock") ||
    lower.includes("lock.") ||
    lower.includes("package-lock") ||
    lower.includes(".min.") ||
    lower.includes("__snapshot") ||
    lower.includes(".snap")
  );
}

/**
 * Scan source files for hardcoded secrets.
 */
export async function detectSecrets(
  scanOptions: ScanOptions,
): Promise<SecretsResult> {
  const sourceFiles = await scanSourceFiles(scanOptions);
  const secrets: SecretMatch[] = [];

  for (const file of sourceFiles) {
    if (shouldSkipForSecrets(file.path)) continue;

    const lines = file.content.split("\n");
    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      const lineContent = lines[lineIdx]!;

      // Skip comment lines
      const trimmed = lineContent.trim();
      if (
        trimmed.startsWith("//") ||
        trimmed.startsWith("#") ||
        trimmed.startsWith("*") ||
        trimmed.startsWith("/*")
      ) {
        continue;
      }

      for (const pattern of SECRET_PATTERNS) {
        if (pattern.regex.test(lineContent)) {
          // Truncate the matched line for display
          const displayLine =
            lineContent.length > 120
              ? lineContent.slice(0, 120) + "..."
              : lineContent;

          secrets.push({
            file: file.path,
            line: lineIdx + 1,
            pattern: pattern.name,
            match: displayLine.trim(),
            severity: pattern.severity,
          });
          break; // Only one match per line to avoid noise
        }
      }
    }
  }

  return {
    secrets,
    totalFilesScanned: sourceFiles.length,
  };
}
