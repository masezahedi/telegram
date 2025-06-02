import sqlite3 from "sqlite3";
import { open } from "sqlite";

let db = null;

async function openDb() {
  if (db) return db;

  db = await open({
    filename: "./data.sqlite",
    driver: sqlite3.Database,
  });

  // Create tables if they don't exist
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      telegram_session TEXT,
      phone_number TEXT,
      telegram_user_id TEXT UNIQUE,
      is_admin INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS user_settings (
      user_id TEXT PRIMARY KEY,
      gemini_api_key TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS forwarding_services (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'forward',
      source_channels TEXT NOT NULL,
      target_channels TEXT NOT NULL,
      search_replace_rules TEXT DEFAULT '[]',
      is_active INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      activated_at DATETIME,
      prompt_template TEXT,
      copy_history INTEGER DEFAULT 0,
      history_limit INTEGER DEFAULT 100,
      history_direction TEXT DEFAULT 'newest',
      start_from_id TEXT,
      copy_direction TEXT DEFAULT 'before',
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);

  // Check existing columns in forwarding_services table
  const columns = await db.all(`PRAGMA table_info(forwarding_services);`);
  const columnNames = columns.map((col) => col.name);

  // Add new columns if they don't exist
  const requiredColumns = [
    {
      name: "type",
      sql: "ALTER TABLE forwarding_services ADD COLUMN type TEXT NOT NULL DEFAULT 'forward';",
    },
    {
      name: "copy_history",
      sql: "ALTER TABLE forwarding_services ADD COLUMN copy_history INTEGER DEFAULT 0;",
    },
    {
      name: "history_limit",
      sql: "ALTER TABLE forwarding_services ADD COLUMN history_limit INTEGER DEFAULT 100;",
    },
    {
      name: "history_direction",
      sql: "ALTER TABLE forwarding_services ADD COLUMN history_direction TEXT DEFAULT 'newest';",
    },
    {
      name: "start_from_id",
      sql: "ALTER TABLE forwarding_services ADD COLUMN start_from_id TEXT;",
    },
    {
      name: "copy_direction",
      sql: "ALTER TABLE forwarding_services ADD COLUMN copy_direction TEXT DEFAULT 'before';",
    },
  ];

  for (const column of requiredColumns) {
    if (!columnNames.includes(column.name)) {
      try {
        await db.exec(column.sql);
        console.log(
          `✅ Added column ${column.name} to forwarding_services table`
        );
      } catch (error) {
        console.error(`❌ Error adding column ${column.name}:`, error);
      }
    }
  }

  // Check if is_admin column exists in users table
  const userColumns = await db.all(`PRAGMA table_info(users);`);
  const userColumnNames = userColumns.map((col) => col.name);
  const hasIsAdmin = userColumns.some((col) => col.name === "is_admin");

  if (!hasIsAdmin) {
    try {
      await db.exec(`ALTER TABLE users ADD COLUMN is_admin INTEGER DEFAULT 0;`);
      console.log(`✅ Added is_admin column to users table`);
    } catch (error) {
      console.error(`❌ Error adding is_admin column:`, error);
    }
  }

  // Update existing user to be admin
  try {
    await db.run("UPDATE users SET is_admin = 1 WHERE email = ?", [
      "boyitnew@yahoo.com",
    ]);
  } catch (error) {
    console.error(`❌ Error updating admin user:`, error);
  }

  if (!userColumnNames.includes("telegram_user_id")) {
    try {
      await db.exec(
        `ALTER TABLE users ADD COLUMN telegram_user_id TEXT UNIQUE;`
      );
      console.log(`✅ Added telegram_user_id column to users table`);
    } catch (error) {
      console.error(`❌ Error adding telegram_user_id column:`, error);
    }
  }

  return db;
}

export { openDb };
