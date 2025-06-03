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
      is_premium INTEGER DEFAULT 0,                 -- New column
      premium_expiry_date DATETIME,              -- New column
      service_creation_count INTEGER DEFAULT 0,  -- New column
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
      service_activated_at DATETIME,            -- Will be added in a later phase if needed for service-specific expiry
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

  // Schema migration for users table
  const userTableInfo = await db.all(`PRAGMA table_info(users);`);
  const userColumnNames = userTableInfo.map((col) => col.name);

  const requiredUserColumns = [
    {
      name: "is_admin",
      sql: "ALTER TABLE users ADD COLUMN is_admin INTEGER DEFAULT 0;",
    },
    {
      name: "is_premium",
      sql: "ALTER TABLE users ADD COLUMN is_premium INTEGER DEFAULT 0;",
    },
    {
      name: "premium_expiry_date",
      sql: "ALTER TABLE users ADD COLUMN premium_expiry_date DATETIME;",
    },
    {
      name: "service_creation_count",
      sql: "ALTER TABLE users ADD COLUMN service_creation_count INTEGER DEFAULT 0;",
    },
  ];

  for (const column of requiredUserColumns) {
    if (!userColumnNames.includes(column.name)) {
      try {
        await db.exec(column.sql);
        console.log(`✅ Added column ${column.name} to users table`);
      } catch (error) {
        // Ignore error if column already exists (e.g., due to concurrent execution)
        if (!error.message.includes("duplicate column name")) {
          console.error(
            `❌ Error adding column ${column.name} to users table:`,
            error
          );
        }
      }
    }
  }

  // Schema migration for forwarding_services table
  const forwardingServicesTableInfo = await db.all(
    `PRAGMA table_info(forwarding_services);`
  );
  const forwardingServicesColumnNames = forwardingServicesTableInfo.map(
    (col) => col.name
  );

  const requiredForwardingServiceColumns = [
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
    // service_activated_at will be added in a later phase for service-specific expiry for normal users
    // { name: "service_activated_at", sql: "ALTER TABLE forwarding_services ADD COLUMN service_activated_at DATETIME;" },
  ];

  for (const column of requiredForwardingServiceColumns) {
    if (!forwardingServicesColumnNames.includes(column.name)) {
      try {
        await db.exec(column.sql);
        console.log(
          `✅ Added column ${column.name} to forwarding_services table`
        );
      } catch (error) {
        if (!error.message.includes("duplicate column name")) {
          console.error(
            `❌ Error adding column ${column.name} to forwarding_services table:`,
            error
          );
        }
      }
    }
  }

  // Update existing user to be admin (if not already handled)
  // This part might need to be run only once or handled differently in production
  try {
    const adminUser = await db.get(
      "SELECT id FROM users WHERE email = ? AND is_admin = 1",
      ["boyitnew@yahoo.com"]
    );
    if (!adminUser) {
      await db.run("UPDATE users SET is_admin = 1 WHERE email = ?", [
        "boyitnew@yahoo.com",
      ]);
      console.log(`✅ Set user boyitnew@yahoo.com as admin`);
    }
  } catch (error) {
    console.error(`❌ Error updating admin user:`, error);
  }

  return db;
}

export { openDb };
