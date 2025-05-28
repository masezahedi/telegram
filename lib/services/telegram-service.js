import axios from "axios";

const API_BASE_URL = "http://sna.freebotmoon.ir:3332";
//const API_BASE_URL = "http://localhost:3332";

export const TelegramService = {
  async sendCode(phoneNumber) {
    try {
      const response = await axios.post(`${API_BASE_URL}/sendCode`, {
        phoneNumber,
      });
      return response.data;
    } catch (error) {
      console.error("Send code error:", error);
      return {
        success: false,
        error: error.response?.data?.error || error.message,
      };
    }
  },

  async signIn(data) {
    try {
      const response = await axios.post(`${API_BASE_URL}/signIn`, data);
      return response.data;
    } catch (error) {
      console.error("Sign in error:", error);
      return {
        success: false,
        error: error.response?.data?.error || error.message,
      };
    }
  },

  async checkPassword(data) {
    try {
      const response = await axios.post(`${API_BASE_URL}/checkPassword`, data);
      return response.data;
    } catch (error) {
      console.error("Check password error:", error);
      return {
        success: false,
        error: error.response?.data?.error || error.message,
      };
    }
  },
};
