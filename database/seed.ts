import "dotenv/config";
import * as bcrypt from "bcrypt";
import {
  initializeSchema,
  openSqliteDatabase,
} from "../src/common/database/database.utils";

async function seed(): Promise<void> {
  const database = openSqliteDatabase();

  try {
    initializeSchema(database);

    const existingAdmin = database
      .prepare<
        [string],
        { id: number }
      >("SELECT id FROM users WHERE username = ?")
      .get("admin");

    if (!existingAdmin) {
      const passwordHash = await bcrypt.hash("admin123", 12);

      database
        .prepare<[string, string, string]>(
          `INSERT INTO users (name, username, password_hash)
           VALUES (?, ?, ?)`,
        )
        .run("Warehouse Manager", "admin", passwordHash);
    }

    console.log("Default admin seed completed");
  } finally {
    database.close();
  }
}

void seed().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
