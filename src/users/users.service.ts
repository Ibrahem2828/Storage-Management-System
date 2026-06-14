import { Injectable } from "@nestjs/common";
import * as bcrypt from "bcrypt";
import { DatabaseService } from "../common/database/database.service";
import { toIsoTimestamp } from "../common/database/database.utils";
import { SafeUser, UserRecord } from "./user.types";

interface UserRow {
  id: number;
  name: string;
  username: string;
  passwordHash: string;
  createdAt: string;
  updatedAt: string;
}

const userSelect = `
  SELECT
    id,
    name,
    username,
    password_hash AS passwordHash,
    created_at AS createdAt,
    updated_at AS updatedAt
  FROM users
`;

@Injectable()
export class UsersService {
  constructor(private readonly database: DatabaseService) {}

  findByUsername(username: string): UserRecord | undefined {
    const row = this.database.get<UserRow>(`${userSelect} WHERE username = ?`, [
      username,
    ]);

    return row ? this.toUserRecord(row) : undefined;
  }

  findById(id: number): UserRecord | undefined {
    const row = this.database.get<UserRow>(`${userSelect} WHERE id = ?`, [id]);

    return row ? this.toUserRecord(row) : undefined;
  }

  async createDefaultAdmin(): Promise<void> {
    if (this.findByUsername("admin")) {
      return;
    }

    const passwordHash = await bcrypt.hash("admin123", 12);

    this.database.run(
      `INSERT OR IGNORE INTO users (name, username, password_hash)
       VALUES (?, ?, ?)`,
      ["Warehouse Manager", "admin", passwordHash],
    );
  }

  toSafeUser(user: UserRecord): SafeUser {
    return {
      id: user.id,
      name: user.name,
      username: user.username,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  private toUserRecord(row: UserRow): UserRecord {
    return {
      ...row,
      createdAt: toIsoTimestamp(row.createdAt),
      updatedAt: toIsoTimestamp(row.updatedAt),
    };
  }
}
