// lib/db.js
import sqlite3 from "sqlite3";
import { open } from "sqlite";

let db = null;

async function openDb() {
  if (db) return db;

  db = await open({
    filename: "./data.sqlite",
    driver: sqlite3.Database,
  });

  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      telegram_session TEXT,
      phone_number TEXT,
      is_admin INTEGER DEFAULT 0,
      is_premium INTEGER DEFAULT 0,
      premium_expiry_date DATETIME,      -- This will now serve as account_expiry_date
      trial_activated_at DATETIME,       -- New: For normal user's 15-day trial start
      service_creation_count INTEGER DEFAULT 0,
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
      service_activated_at DATETIME, -- Retaining for potential admin edits, but main logic shifts to user's trial/premium
      prompt_template TEXT,
      copy_history INTEGER DEFAULT 0,
      history_limit INTEGER DEFAULT 100,
      history_direction TEXT DEFAULT 'newest',
      start_from_id TEXT,
      copy_direction TEXT DEFAULT 'before',
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
    -- New table for tariff settings
    CREATE TABLE IF NOT EXISTS tariff_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      normal_user_trial_days INTEGER DEFAULT 15,
      premium_user_default_days INTEGER DEFAULT 30,
      normal_user_max_active_services INTEGER DEFAULT 1,
      premium_user_max_active_services INTEGER DEFAULT 5,
      normal_user_max_channels_per_service INTEGER DEFAULT 1,
      premium_user_max_channels_per_service INTEGER DEFAULT 10,
      premium_price REAL DEFAULT 100000, -- NEW: Premium price
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

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
    {
      name: "trial_activated_at",
      sql: "ALTER TABLE users ADD COLUMN trial_activated_at DATETIME;",
    },
  ];

  for (const column of requiredUserColumns) {
    if (!userColumnNames.includes(column.name)) {
      try {
        await db.exec(column.sql);
        console.log(`✅ Added column ${column.name} to users table`);
      } catch (error) {
        if (!error.message.includes("duplicate column name")) {
          console.error(
            `❌ Error adding column ${column.name} to users table:`,
            error
          );
        }
      }
    }
  }

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
    {
      name: "service_activated_at",
      sql: "ALTER TABLE forwarding_services ADD COLUMN service_activated_at DATETIME;",
    },
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

  // NEW: Add premium_price column to tariff_settings if it doesn't exist
  const tariffSettingsTableInfo = await db.all(`PRAGMA table_info(tariff_settings);`);
  const tariffSettingsColumnNames = tariffSettingsTableInfo.map((col) => col.name);

  if (!tariffSettingsColumnNames.includes('premium_price')) {
    try {
      await db.exec("ALTER TABLE tariff_settings ADD COLUMN premium_price REAL DEFAULT 100000;");
      console.log(`✅ Added column premium_price to tariff_settings table`);
    } catch (error) {
      if (!error.message.includes("duplicate column name")) {
        console.error(`❌ Error adding column premium_price to tariff_settings table:`, error);
      }
    }
  }

  try {
    // Insert default tariff settings if table is empty
    const tariffSettingsCount = await db.get(
      "SELECT COUNT(*) as count FROM tariff_settings"
    );
    if (tariffSettingsCount.count === 0) {
      await db.run(
        `
        INSERT INTO tariff_settings (
          normal_user_trial_days, 
          premium_user_default_days, 
          normal_user_max_active_services, 
          premium_user_max_active_services,
          normal_user_max_channels_per_service,
          premium_user_max_channels_per_service,
          premium_price -- Added premium_price here for initial insert
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
        [15, 30, 1, 5, 1, 10, 100000] // Default values including price
      );
      console.log(`✅ Default tariff settings inserted.`);
    } else {
      // Ensure default premium_price is set if row existed but column was just added
      const existingSettings = await db.get("SELECT premium_price FROM tariff_settings LIMIT 1");
      if (existingSettings.premium_price === null || existingSettings.premium_price === undefined) {
        await db.run("UPDATE tariff_settings SET premium_price = 100000 WHERE id = 1;");
        console.log(`✅ Updated premium_price default for existing tariff settings.`);
      }
    }
  } catch (error) {
    console.error(`❌ Error inserting default tariff settings:`, error);
  }

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