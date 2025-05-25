const jwt = require("jsonwebtoken");
const { JWT_SECRET } = require("../config");

async function verifyToken(token) {
  if (!token) return null;

  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    console.error("Token verification error:", error);
    return null;
  }
}

module.exports = { verifyToken };