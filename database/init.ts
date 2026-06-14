import "dotenv/config";
import {
  initializeSchema,
  openSqliteDatabase,
} from "../src/common/database/database.utils";

const database = openSqliteDatabase();

try {
  initializeSchema(database);
  console.log(`SQLite schema initialized at ${database.name}`);
} finally {
  database.close();
}
