import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Database = require("better-sqlite3");
import { initializeSchema, openSqliteDatabase } from "./database.utils";

export type SqlValue = string | number | bigint | Buffer | null;
export type RunResult = Database.RunResult;

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private database?: Database.Database;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit(): void {
    this.database = openSqliteDatabase(
      this.configService.get<string>("DATABASE_PATH", "./data/storage.sqlite"),
    );
    initializeSchema(this.database);
  }

  onModuleDestroy(): void {
    if (this.database?.open) {
      this.database.close();
    }
  }

  get<T>(sql: string, params: SqlValue[] = []): T | undefined {
    return this.connection.prepare<SqlValue[], T>(sql).get(...params);
  }

  all<T>(sql: string, params: SqlValue[] = []): T[] {
    return this.connection.prepare<SqlValue[], T>(sql).all(...params);
  }

  run(sql: string, params: SqlValue[] = []): RunResult {
    return this.connection.prepare<SqlValue[]>(sql).run(...params);
  }

  transaction<T>(fn: () => T): T {
    return this.connection.transaction(fn).immediate();
  }

  ping(): void {
    this.get<{ ok: number }>("SELECT 1 AS ok");
  }

  private get connection(): Database.Database {
    if (!this.database?.open) {
      throw new Error("SQLite database is not initialized");
    }

    return this.database;
  }
}
