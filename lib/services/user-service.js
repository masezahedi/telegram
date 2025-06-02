// lib/services/user-service.js
const UserService = {
  async getCurrentUser() {
    try {
      const token = localStorage.getItem("auth_token"); //
      if (!token) return null; //

      const response = await fetch("/api/users/me", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }); //

      if (!response.ok) return null; //

      const data = await response.json(); //
      // The API returns { success: true, user: {...} }
      // So, we should return the user object nested within data if success is true
      if (data.success && data.user) {
        return {
          // Ensure the structure matches what AuthService.getStoredUser might expect
          ...data.user,
          telegramId: data.user.telegramId || null,
          isAdmin: Boolean(data.user.isAdmin),
        };
      }
      return null; //
    } catch (error) {
      console.error("Get current user error:", error); //
      return null; //
    }
  },

  async updateProfile(profileData) {
    try {
      const token = localStorage.getItem("auth_token"); //
      const response = await fetch("/api/users/profile", {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(profileData),
      }); //

      return await response.json(); //
    } catch (error) {
      console.error("Update profile error:", error); //
      return { success: false, message: error.message }; //
    }
  },

  async updatePassword(passwordData) {
    try {
      const token = localStorage.getItem("auth_token"); //
      const response = await fetch("/api/users/password", {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(passwordData),
      }); //

      return await response.json(); //
    } catch (error) {
      console.error("Update password error:", error); //
      return { success: false, message: error.message }; //
    }
  },

  async updateTelegramSession(data) {
    // data includes { telegramSession, phoneNumber, telegramId }
    try {
      const token = localStorage.getItem("auth_token"); //
      const response = await fetch("/api/telegram", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      }); //

      const result = await response.json(); //

      if (result.success && result.user) {
        // User data in localStorage will be updated by TelegramConnection component via onConnectionUpdate
        // and AuthService.login logic if needed.
        // For direct calls, if needed, ensure this service also updates localStorage.
        // For now, relying on the calling component to manage localStorage update via callback.
      }

      return result; //
    } catch (error) {
      console.error("Update Telegram session error:", error); //
      return { success: false, message: error.message }; //
    }
  },

  async disconnectTelegram() {
    try {
      const token = localStorage.getItem("auth_token"); //
      const response = await fetch("/api/telegram", {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }); //

      const result = await response.json(); //

      if (result.success && result.user) {
        // Similar to updateTelegramSession, relying on calling component for localStorage update.
      }

      return result; //
    } catch (error) {
      console.error("Disconnect Telegram error:", error); //
      return { success: false, message: error.message }; //
    }
  },

  async getAllUsers() {
    try {
      const token = localStorage.getItem("auth_token"); //
      const response = await fetch("/api/users", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }); //

      if (!response.ok) return []; //

      const data = await response.json(); //
      return data.users; //
    } catch (error) {
      console.error("Get all users error:", error); //
      return []; //
    }
  },

  async getUserDetails(userId) {
    try {
      const token = localStorage.getItem("auth_token"); //
      const response = await fetch(`/api/users/${userId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }); //

      if (!response.ok) return null; //

      const data = await response.json(); //
      // Ensure the returned user object has the consistent structure
      if (data.success && data.user) {
        return {
          ...data.user,
          isAdmin: Boolean(data.user.is_admin), // Ensure boolean
          telegramId: data.user.telegram_id || null, // Map telegram_id to telegramId
        };
      }
      return null; //
    } catch (error) {
      console.error("Get user details error:", error); //
      return null; //
    }
  },
};

export { UserService };
