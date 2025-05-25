const API_ID = 24554364;
const API_HASH = "5db6997246b3bc3b6a8ac6097b1ef937";
const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret_key";
const PORT = process.env.PORT || 3001;

module.exports = {
  API_ID,
  API_HASH,
  JWT_SECRET,
  PORT
};