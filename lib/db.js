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
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);

  // Add new columns if they don't exist
  const columns = await db.all(`PRAGMA table_info(forwarding_services);`);

  if (!columns.some((col) => col.name === "type")) {
    await db.exec(
      `ALTER TABLE forwarding_services ADD COLUMN type TEXT NOT NULL DEFAULT 'forward';`
    );
  }

  if (!columns.some((col) => col.name === "copy_history")) {
    await db.exec(
      `ALTER TABLE forwarding_services ADD COLUMN copy_history INTEGER DEFAULT 0;`
    );
  }

  if (!columns.some((col) => col.name === "history_limit")) {
    await db.exec(
      `ALTER TABLE forwarding_services ADD COLUMN history_limit INTEGER DEFAULT 100;`
    );
  }

  // Check if is_admin column exists in users table
  const userColumns = await db.all(`PRAGMA table_info(users);`);
  const hasIsAdmin = userColumns.some((col) => col.name === "is_admin");

  if (!hasIsAdmin) {
    await db.exec(`ALTER TABLE users ADD COLUMN is_admin INTEGER DEFAULT 0;`);
  }

  // Update existing user to be admin
  await db.run("UPDATE users SET is_admin = 1 WHERE email = ?", [
    "boyitnew@yahoo.com",
  ]);

  return db;
}

export { openDb };
