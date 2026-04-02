import { describe, test, expect } from "bun:test";
import { extractEnvReferences } from "../core/scanner.js";

describe("extractEnvReferences", () => {
  test("detects JavaScript process.env.VAR", () => {
    const content = `const url = process.env.DATABASE_URL;
const port = process.env.PORT;`;

    const refs = extractEnvReferences("test.ts", content);
    expect(refs).toHaveLength(2);
    expect(refs[0]!.varName).toBe("DATABASE_URL");
    expect(refs[0]!.line).toBe(1);
    expect(refs[1]!.varName).toBe("PORT");
    expect(refs[1]!.line).toBe(2);
  });

  test("detects JavaScript bracket notation", () => {
    const content = `const a = process.env['API_KEY'];
const b = process.env["SECRET_KEY"];`;

    const refs = extractEnvReferences("test.ts", content);
    expect(refs).toHaveLength(2);
    expect(refs[0]!.varName).toBe("API_KEY");
    expect(refs[1]!.varName).toBe("SECRET_KEY");
  });

  test("detects Python os.environ and os.getenv", () => {
    const content = `db_url = os.environ['DATABASE_URL']
port = os.environ.get('PORT')
key = os.getenv('API_KEY')`;

    const refs = extractEnvReferences("test.py", content);
    expect(refs).toHaveLength(3);
    expect(refs.map((r) => r.varName)).toEqual([
      "DATABASE_URL",
      "PORT",
      "API_KEY",
    ]);
  });

  test("detects Ruby ENV patterns", () => {
    const content = `db = ENV['DATABASE_URL']
key = ENV.fetch('API_KEY')`;

    const refs = extractEnvReferences("test.rb", content);
    expect(refs).toHaveLength(2);
    expect(refs[0]!.varName).toBe("DATABASE_URL");
    expect(refs[1]!.varName).toBe("API_KEY");
  });

  test("detects Go os.Getenv", () => {
    const content = `port := os.Getenv("PORT")
host := os.Getenv("HOST")`;

    const refs = extractEnvReferences("test.go", content);
    expect(refs).toHaveLength(2);
    expect(refs[0]!.varName).toBe("PORT");
    expect(refs[1]!.varName).toBe("HOST");
  });

  test("detects Rust env::var", () => {
    const content = `let key = env::var("API_KEY").unwrap();
let key2 = std::env::var("SECRET").unwrap();`;

    const refs = extractEnvReferences("test.rs", content);
    expect(refs).toHaveLength(2);
    expect(refs[0]!.varName).toBe("API_KEY");
    expect(refs[1]!.varName).toBe("SECRET");
  });

  test("detects PHP patterns", () => {
    const content = `$key = getenv('API_KEY');
$db = $_ENV['DATABASE_URL'];
$host = $_SERVER['APP_HOST'];`;

    const refs = extractEnvReferences("test.php", content);
    expect(refs).toHaveLength(3);
    expect(refs.map((r) => r.varName)).toEqual([
      "API_KEY",
      "DATABASE_URL",
      "APP_HOST",
    ]);
  });

  test("detects Java/Kotlin System.getenv", () => {
    const content = `String key = System.getenv("API_KEY");`;

    const refs = extractEnvReferences("Test.java", content);
    expect(refs).toHaveLength(1);
    expect(refs[0]!.varName).toBe("API_KEY");
  });

  test("detects env file variable references", () => {
    const content = `DATABASE_URL=postgres://\${DB_HOST}:\${DB_PORT}/mydb`;

    const refs = extractEnvReferences(".env.production", content);
    expect(refs).toHaveLength(2);
    expect(refs[0]!.varName).toBe("DB_HOST");
    expect(refs[1]!.varName).toBe("DB_PORT");
  });

  test("handles multiple references on one line", () => {
    const content = `const url = \`\${process.env.HOST}:\${process.env.PORT}\`;`;

    const refs = extractEnvReferences("test.ts", content);
    expect(refs).toHaveLength(2);
    expect(refs[0]!.varName).toBe("HOST");
    expect(refs[1]!.varName).toBe("PORT");
  });
});
