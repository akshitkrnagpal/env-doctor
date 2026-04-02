import { describe, test, expect } from "bun:test";
import { parseEnvFile, envEntriesToMap } from "../core/env-parser.js";

describe("parseEnvFile", () => {
  test("parses simple key=value pairs", () => {
    const content = `DATABASE_URL=postgres://localhost:5432/mydb
API_KEY=abc123
PORT=3000`;

    const result = parseEnvFile(content);
    expect(result.entries).toHaveLength(3);
    expect(result.errors).toHaveLength(0);

    expect(result.entries[0]!.key).toBe("DATABASE_URL");
    expect(result.entries[0]!.value).toBe("postgres://localhost:5432/mydb");
    expect(result.entries[1]!.key).toBe("API_KEY");
    expect(result.entries[1]!.value).toBe("abc123");
    expect(result.entries[2]!.key).toBe("PORT");
    expect(result.entries[2]!.value).toBe("3000");
  });

  test("handles quoted values", () => {
    const content = `NAME="hello world"
SINGLE='single quoted'
UNQUOTED=noquotes`;

    const result = parseEnvFile(content);
    expect(result.entries).toHaveLength(3);
    expect(result.entries[0]!.value).toBe("hello world");
    expect(result.entries[1]!.value).toBe("single quoted");
    expect(result.entries[2]!.value).toBe("noquotes");
  });

  test("skips comments and empty lines", () => {
    const content = `# This is a comment
DATABASE_URL=test

# Another comment
PORT=3000`;

    const result = parseEnvFile(content);
    expect(result.entries).toHaveLength(2);
  });

  test("handles export prefix", () => {
    const content = `export DATABASE_URL=test
export API_KEY=abc`;

    const result = parseEnvFile(content);
    expect(result.entries).toHaveLength(2);
    expect(result.entries[0]!.exported).toBe(true);
    expect(result.entries[0]!.key).toBe("DATABASE_URL");
    expect(result.entries[0]!.value).toBe("test");
  });

  test("detects duplicate keys", () => {
    const content = `API_KEY=first
PORT=3000
API_KEY=second`;

    const result = parseEnvFile(content);
    expect(result.entries).toHaveLength(3);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]!.message).toContain("Duplicate key");
    expect(result.errors[0]!.message).toContain("API_KEY");
  });

  test("handles empty values", () => {
    const content = `EMPTY=
HAS_VALUE=something`;

    const result = parseEnvFile(content);
    expect(result.entries).toHaveLength(2);
    expect(result.entries[0]!.hasValue).toBe(false);
    expect(result.entries[0]!.value).toBe("");
    expect(result.entries[1]!.hasValue).toBe(true);
  });

  test("strips inline comments from unquoted values", () => {
    const content = `PORT=3000 # default port
HOST=localhost # the host`;

    const result = parseEnvFile(content);
    expect(result.entries[0]!.value).toBe("3000");
    expect(result.entries[1]!.value).toBe("localhost");
  });

  test("handles multiline quoted values", () => {
    const content = `PRIVATE_KEY="line1
line2
line3"
NEXT=value`;

    const result = parseEnvFile(content);
    expect(result.entries).toHaveLength(2);
    expect(result.entries[0]!.value).toBe("line1\nline2\nline3");
    expect(result.entries[1]!.key).toBe("NEXT");
  });

  test("reports invalid lines", () => {
    const content = `VALID=yes
invalid line without equals
ALSO_VALID=yep`;

    const result = parseEnvFile(content);
    expect(result.entries).toHaveLength(2);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]!.message).toContain("does not contain '='");
  });

  test("reports invalid variable names", () => {
    const content = `VALID=yes
123INVALID=no
ALSO_VALID=yep`;

    const result = parseEnvFile(content);
    expect(result.entries).toHaveLength(2);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]!.message).toContain("Invalid variable name");
  });

  test("records line numbers correctly", () => {
    const content = `# comment
FIRST=1

SECOND=2`;

    const result = parseEnvFile(content);
    expect(result.entries[0]!.line).toBe(2);
    expect(result.entries[1]!.line).toBe(4);
  });
});

describe("envEntriesToMap", () => {
  test("converts entries to a map", () => {
    const { entries } = parseEnvFile("A=1\nB=2\nC=3");
    const map = envEntriesToMap(entries);
    expect(map.get("A")).toBe("1");
    expect(map.get("B")).toBe("2");
    expect(map.get("C")).toBe("3");
  });
});
