const express = require("express");
const { verifyToken } = require("../utils/auth");
const { openDb } = require("../utils/db");

const router = express.Router();

// GET tariff settings (admin only)
router.get("/", async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    const decoded = await verifyToken(token);

    if (!decoded) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    const db = await openDb();
    const adminCheck = await db.get("SELECT is_admin FROM users WHERE id = ?", [
      decoded.userId,
    ]);

    if (!adminCheck?.is_admin) {
      return res.status(403).json({ success: false, error: "Forbidden. Admin access required." });
    }

    const settings = await db.get("SELECT * FROM tariff_settings LIMIT 1");

    res.json({ success: true, settings });
  } catch (error) {
    console.error("Get tariff settings error:", error);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

// PUT tariff settings (admin only)
router.put("/", async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    const decoded = await verifyToken(token);

    if (!decoded) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    const db = await openDb();
    const adminCheck = await db.get("SELECT is_admin FROM users WHERE id = ?", [
      decoded.userId,
    ]);

    if (!adminCheck?.is_admin) {
      return res.status(403).json({ success: false, error: "Forbidden. Admin access required." });
    }

    const {
      normal_user_trial_days,
      premium_user_default_days,
      normal_user_max_active_services,
      premium_user_max_active_services,
      normal_user_max_channels_per_service,
      premium_user_max_channels_per_service,
    } = req.body;

    // Validate inputs
    if (
      typeof normal_user_trial_days !== "number" || normal_user_trial_days < 0 ||
      typeof premium_user_default_days !== "number" || premium_user_default_days < 0 ||
      typeof normal_user_max_active_services !== "number" || normal_user_max_active_services < 0 ||
      typeof premium_user_max_active_services !== "number" || premium_user_max_active_services < 0 ||
      typeof normal_user_max_channels_per_service !== "number" || normal_user_max_channels_per_service < 0 ||
      typeof premium_user_max_channels_per_service !== "number" || premium_user_max_channels_per_service < 0
    ) {
      return res.status(400).json({ success: false, error: "Invalid input values. All tariff settings must be non-negative numbers." });
    }

    await db.run(
      `
      UPDATE tariff_settings
      SET
        normal_user_trial_days = ?,
        premium_user_default_days = ?,
        normal_user_max_active_services = ?,
        premium_user_max_active_services = ?,
        normal_user_max_channels_per_service = ?,
        premium_user_max_channels_per_service = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = 1
      `,
      [
        normal_user_trial_days,
        premium_user_default_days,
        normal_user_max_active_services,
        premium_user_max_active_services,
        normal_user_max_channels_per_service,
        premium_user_max_channels_per_service,
      ]
    );

    res.json({ success: true, message: "Tariff settings updated successfully." });
  } catch (error) {
    console.error("Update tariff settings error:", error);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

module.exports = router;