import { Pool } from "pg";
import * as fs from "fs";
import * as path from "path";

async function migrate() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL must be set.");
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    const schemaPath = path.join(process.cwd(), "schema.sql");
    const schema = fs.readFileSync(schemaPath, "utf-8");

    await pool.query(schema);
    console.log("✓ Database migration completed successfully");
  } catch (error) {
    console.error("✗ Database migration failed:", error);
    throw error;
  } finally {
    await pool.end();
  }
}

migrate();

