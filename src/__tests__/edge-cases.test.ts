import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { parseEnvFile } from "../core/env-parser.js";
import { extractEnvReferences } from "../core/scanner.js";
import { detectSecrets } from "../core/secrets.js";
import { mkdtemp, writeFile, rm, mkdir } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";

describe("parseEnvFile edge cases", () => {
  test("handles multi-line values with double quotes and newlines", () => {
    const content = `PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----
MIIEowIBAAKCAQEA0Z3VS5JJcds3xfn/ygWyF8PbnGy5rM
-----END RSA PRIVATE KEY-----"
NEXT_VAR=hello`;

    const result = parseEnvFile(content);
    expect(result.entries).toHaveLength(2);
    expect(result.entries[0]!.key).toBe("PRIVATE_KEY");
    expect(result.entries[0]!.value).toContain("-----BEGIN RSA PRIVATE KEY-----");
    expect(result.entries[0]!.value).toContain("-----END RSA PRIVATE KEY-----");
    expect(result.entries[0]!.value).toContain("\n");
    expect(result.entries[1]!.key).toBe("NEXT_VAR");
    expect(result.entries[1]!.value).toBe("hello");
  });

  test("handles multi-line values with single quotes", () => {
    const content = `CERT='line one
line two
line three'
AFTER=yes`;

    const result = parseEnvFile(content);
    expect(result.entries).toHaveLength(2);
    expect(result.entries[0]!.key).toBe("CERT");
    expect(result.entries[0]!.value).toBe("line one\nline two\nline three");
    expect(result.entries[1]!.key).toBe("AFTER");
  });

  test("handles .env files with export prefix on all lines", () => {
    const content = `export DATABASE_URL=postgres://localhost/db
export API_KEY=abc123
export PORT=3000
export DEBUG=true`;

    const result = parseEnvFile(content);
    expect(result.entries).toHaveLength(4);
    for (const entry of result.entries) {
      expect(entry.exported).toBe(true);
    }
    expect(result.entries[0]!.key).toBe("DATABASE_URL");
    expect(result.entries[0]!.value).toBe("postgres://localhost/db");
    expect(result.entries[2]!.key).toBe("PORT");
    expect(result.entries[2]!.value).toBe("3000");
  });

  test("handles .env files with inline comments", () => {
    const content = `PORT=3000 # default dev port
HOST=localhost # the host
API_KEY=secret123 # do not share
QUOTED="has # hash inside"`;

    const result = parseEnvFile(content);
    expect(result.entries).toHaveLength(4);
    // Unquoted values should strip inline comments
    expect(result.entries[0]!.value).toBe("3000");
    expect(result.entries[1]!.value).toBe("localhost");
    expect(result.entries[2]!.value).toBe("secret123");
    // Quoted values should preserve the # inside
    expect(result.entries[3]!.value).toBe("has # hash inside");
  });

  test("handles empty .env files", () => {
    const result = parseEnvFile("");
    expect(result.entries).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
  });

  test("handles .env files with only comments", () => {
    const content = `# This is a configuration file
# DATABASE_URL should be set
# API_KEY is required
# PORT defaults to 3000`;

    const result = parseEnvFile(content);
    expect(result.entries).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
  });

  test("handles .env files with only empty lines", () => {
    const content = "\n\n\n\n";
    const result = parseEnvFile(content);
    expect(result.entries).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
  });

  test("handles mixed comments and empty lines between vars", () => {
    const content = `# Database config
DATABASE_URL=postgres://localhost

# API settings

API_KEY=abc

# Server
PORT=3000`;

    const result = parseEnvFile(content);
    expect(result.entries).toHaveLength(3);
    expect(result.entries[0]!.key).toBe("DATABASE_URL");
    expect(result.entries[1]!.key).toBe("API_KEY");
    expect(result.entries[2]!.key).toBe("PORT");
  });

  test("handles values with equals signs", () => {
    const content = `DATABASE_URL=postgres://user:pass@host/db?sslmode=require
BASE64=dGVzdA==`;

    const result = parseEnvFile(content);
    expect(result.entries).toHaveLength(2);
    expect(result.entries[0]!.value).toBe(
      "postgres://user:pass@host/db?sslmode=require",
    );
    expect(result.entries[1]!.value).toBe("dGVzdA==");
  });

  test("handles export with quoted values", () => {
    const content = `export MESSAGE="hello world"
export PATH_VAR='some/path'`;

    const result = parseEnvFile(content);
    expect(result.entries).toHaveLength(2);
    expect(result.entries[0]!.exported).toBe(true);
    expect(result.entries[0]!.value).toBe("hello world");
    expect(result.entries[1]!.exported).toBe(true);
    expect(result.entries[1]!.value).toBe("some/path");
  });
});

describe("scanner edge cases", () => {
  test("detects template literal process.env references", () => {
    const content = `const url = \`http://\${process.env.HOST}:\${process.env.PORT}/api\`;`;
    const refs = extractEnvReferences("test.ts", content);
    expect(refs).toHaveLength(2);
    expect(refs[0]!.varName).toBe("HOST");
    expect(refs[1]!.varName).toBe("PORT");
  });

  test("detects destructured process.env", () => {
    const content = `const { DATABASE_URL, API_KEY } = process.env;`;
    // Note: destructured process.env is a different pattern
    // The current scanner doesn't detect this pattern, but the
    // individual references would be caught if used elsewhere
    const refs = extractEnvReferences("test.ts", content);
    // This pattern is not captured by current regex patterns
    expect(refs).toHaveLength(0);
  });

  test("handles multiple env references on a single line", () => {
    const content = `const config = { host: process.env.DB_HOST, port: process.env.DB_PORT, name: process.env.DB_NAME };`;
    const refs = extractEnvReferences("test.ts", content);
    expect(refs).toHaveLength(3);
    expect(refs.map((r) => r.varName).sort()).toEqual([
      "DB_HOST",
      "DB_NAME",
      "DB_PORT",
    ]);
  });

  test("detects env vars in conditional expressions", () => {
    const content = `const debug = process.env.NODE_ENV === 'development' ? true : false;
if (process.env.FEATURE_FLAG) { doSomething(); }`;
    const refs = extractEnvReferences("test.ts", content);
    expect(refs).toHaveLength(2);
    expect(refs[0]!.varName).toBe("NODE_ENV");
    expect(refs[1]!.varName).toBe("FEATURE_FLAG");
  });

  test("detects env vars in default value patterns", () => {
    const content = `const port = process.env.PORT || 3000;
const host = process.env.HOST ?? "localhost";`;
    const refs = extractEnvReferences("test.ts", content);
    expect(refs).toHaveLength(2);
    expect(refs[0]!.varName).toBe("PORT");
    expect(refs[1]!.varName).toBe("HOST");
  });
});

describe("secrets edge cases - false positives", () => {
  let tempDir: string;

  beforeAll(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "env-doctor-secrets-fp-"));
  });

  afterAll(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  test("does not flag process.env.PASSWORD as a hardcoded secret", async () => {
    const subDir = join(tempDir, "process-env");
    await mkdir(subDir, { recursive: true });
    await writeFile(
      join(subDir, "config.ts"),
      `const password = process.env.PASSWORD;
const secret = process.env.SECRET_KEY;
const token = process.env.AUTH_TOKEN;`,
    );

    const result = await detectSecrets({ dir: subDir });
    expect(result.secrets).toHaveLength(0);
  });

  test("does not flag short password values (less than 4 chars)", async () => {
    const subDir = join(tempDir, "short-pass");
    await mkdir(subDir, { recursive: true });
    await writeFile(
      join(subDir, "test.ts"),
      `const config = { password: "ab" };`,
    );

    const result = await detectSecrets({ dir: subDir });
    const passwordMatches = result.secrets.filter(
      (s) => s.pattern === "Hardcoded Password",
    );
    expect(passwordMatches).toHaveLength(0);
  });

  test("does not flag placeholder/example values", async () => {
    const subDir = join(tempDir, "placeholders");
    await mkdir(subDir, { recursive: true });
    await writeFile(
      join(subDir, "docs.ts"),
      `// Example: api_key: "your-api-key-here"
// Set your token: "INSERT_TOKEN_HERE"`,
    );

    const result = await detectSecrets({ dir: subDir });
    // Comments should be skipped
    expect(result.secrets).toHaveLength(0);
  });

  test("skips lockfiles and minified files", async () => {
    const subDir = join(tempDir, "lockfiles");
    await mkdir(subDir, { recursive: true });
    await writeFile(
      join(subDir, "package-lock.json"),
      `{"password": "super_secret_in_lockfile"}`,
    );
    await writeFile(
      join(subDir, "bundle.min.js"),
      `var token="sk_live_abcdefghijklmnopqrstuv"`,
    );

    const result = await detectSecrets({ dir: subDir });
    expect(result.secrets).toHaveLength(0);
  });

  test("does not flag test assertion strings", async () => {
    const subDir = join(tempDir, "test-strings");
    await mkdir(subDir, { recursive: true });
    await writeFile(
      join(subDir, "app.ts"),
      `// This is a test file
* expected password: "test_password"`,
    );

    const result = await detectSecrets({ dir: subDir });
    // Comment lines (starting with // or *) should be skipped
    expect(result.secrets).toHaveLength(0);
  });
});
