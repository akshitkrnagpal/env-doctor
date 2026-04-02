export interface EnvEntry {
  key: string;
  value: string;
  line: number;
  hasValue: boolean;
  comment?: string;
  exported?: boolean;
}

export interface EnvParseResult {
  entries: EnvEntry[];
  errors: EnvParseError[];
}

export interface EnvParseError {
  line: number;
  message: string;
  raw: string;
}

/**
 * Parse a .env file content string into structured entries.
 * Handles comments, export prefix, quoted values, and multiline values.
 */
export function parseEnvFile(content: string): EnvParseResult {
  const lines = content.split("\n");
  const entries: EnvEntry[] = [];
  const errors: EnvParseError[] = [];
  const seenKeys = new Map<string, number>();

  let i = 0;
  while (i < lines.length) {
    const rawLine = lines[i]!;
    const trimmed = rawLine.trim();

    // Skip empty lines and comments
    if (trimmed === "" || trimmed.startsWith("#")) {
      i++;
      continue;
    }

    // Check for export prefix
    let line = trimmed;
    let exported = false;
    if (line.startsWith("export ")) {
      exported = true;
      line = line.slice(7).trim();
    }

    // Must contain =
    const eqIndex = line.indexOf("=");
    if (eqIndex === -1) {
      errors.push({
        line: i + 1,
        message: "Line does not contain '=' separator",
        raw: rawLine,
      });
      i++;
      continue;
    }

    const key = line.slice(0, eqIndex).trim();

    // Validate key format
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)) {
      errors.push({
        line: i + 1,
        message: `Invalid variable name: "${key}"`,
        raw: rawLine,
      });
      i++;
      continue;
    }

    let value = line.slice(eqIndex + 1);

    // Handle quoted values (may be multiline)
    const quoteChar = value.startsWith('"')
      ? '"'
      : value.startsWith("'")
        ? "'"
        : null;

    if (quoteChar) {
      value = value.slice(1); // remove opening quote
      // Check if closing quote is on same line
      const closeIndex = value.indexOf(quoteChar);
      if (closeIndex !== -1) {
        value = value.slice(0, closeIndex);
      } else {
        // Multiline value
        const parts = [value];
        i++;
        while (i < lines.length) {
          const nextLine = lines[i]!;
          const closeIdx = nextLine.indexOf(quoteChar);
          if (closeIdx !== -1) {
            parts.push(nextLine.slice(0, closeIdx));
            break;
          }
          parts.push(nextLine);
          i++;
        }
        value = parts.join("\n");
      }
    } else {
      // Unquoted: strip inline comments
      const commentIndex = value.indexOf(" #");
      if (commentIndex !== -1) {
        value = value.slice(0, commentIndex);
      }
      value = value.trim();
    }

    // Track duplicates
    if (seenKeys.has(key)) {
      errors.push({
        line: i + 1,
        message: `Duplicate key "${key}" (first defined on line ${seenKeys.get(key)})`,
        raw: rawLine,
      });
    }
    seenKeys.set(key, i + 1);

    entries.push({
      key,
      value,
      line: i + 1,
      hasValue: value !== "",
      exported,
    });

    i++;
  }

  return { entries, errors };
}

/**
 * Get a map of key -> value from parsed env entries.
 */
export function envEntriesToMap(entries: EnvEntry[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const entry of entries) {
    map.set(entry.key, entry.value);
  }
  return map;
}
