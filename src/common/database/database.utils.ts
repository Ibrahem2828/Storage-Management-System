import Database = require("better-sqlite3");
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";

const DEFAULT_DATABASE_PATH = "./data/storage.sqlite";

export function resolveDatabasePath(
  configuredPath = process.env.DATABASE_PATH ?? DEFAULT_DATABASE_PATH,
): string {
  return isAbsolute(configuredPath)
    ? configuredPath
    : resolve(process.cwd(), configuredPath);
}

export function openSqliteDatabase(databasePath?: string): Database.Database {
  const resolvedPath = resolveDatabasePath(databasePath);

  mkdirSync(dirname(resolvedPath), { recursive: true });

  const database = new Database(resolvedPath, {
    timeout: 5_000,
  });

  database.pragma("foreign_keys = ON");
  database.pragma("journal_mode = DELETE");
  database.pragma("busy_timeout = 5000");

  return database;
}

export function initializeSchema(database: Database.Database): void {
  const schemaPath = resolve(process.cwd(), "database", "schema.sql");

  if (!existsSync(schemaPath)) {
    throw new Error(`Database schema file was not found at ${schemaPath}`);
  }

  database.exec(readFileSync(schemaPath, "utf8"));
}

export function toIsoTimestamp(value: string): string {
  if (value.includes("T")) {
    return new Date(value).toISOString();
  }

  return new Date(`${value.replace(" ", "T")}Z`).toISOString();
}

export function isSqliteConstraintError(error: unknown): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    typeof error.code === "string" &&
    error.code.startsWith("SQLITE_CONSTRAINT")
  );
}
