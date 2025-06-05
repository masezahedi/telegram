// lib/services/user-service.js
const UserService = {
  async getCurrentUser() {
    try {
      const token = localStorage.getItem("auth_token");
      if (!token) return null;

      const response = await fetch("/api/users/me", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) return null;

      const userData = await response.json();
      return userData; // This already returns { user: ... }
    } catch (error) {
      console.error("Get current user error:", error);
      return null;
    }
  },

  async updateProfile(profileData) {
    try {
      const token = localStorage.getItem("auth_token");
      const response = await fetch("/api/users/profile", {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(profileData),
      });

      return await response.json();
    } catch (error) {
      console.error("Update profile error:", error);
      return { success: false, message: error.message };
    }
  },

  async updatePassword(passwordData) {
    try {
      const token = localStorage.getItem("auth_token");
      const response = await fetch("/api/users/password", {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(passwordData),
      });

      return await response.json();
    } catch (error) {
      console.error("Update password error:", error);
      return { success: false, message: error.message };
    }
  },

  async updateTelegramSession(data) {
    try {
      const token = localStorage.getItem("auth_token");
      const response = await fetch("/api/telegram", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (result.success && result.user) {
        // Fetch the full, updated user object from the backend
        const updatedUserDataResponse = await UserService.getCurrentUser();
        if (updatedUserDataResponse.user) {
          localStorage.setItem(
            "user",
            JSON.stringify({
              ...updatedUserDataResponse.user,
              // Ensure these are correctly set as booleans based on the API response
              isTelegramConnected: Boolean(updatedUserDataResponse.user.telegram_session), // Use telegram_session
              isAdmin: Boolean(updatedUserDataResponse.user.isAdmin),
              isPremium: Boolean(updatedUserDataResponse.user.isPremium),
            })
          );
        }
      }

      return result;
    } catch (error) {
      console.error("Update Telegram session error:", error);
      return { success: false, message: error.message };
    }
  },

  async disconnectTelegram() {
    try {
      const token = localStorage.getItem("auth_token");
      const response = await fetch("/api/telegram", {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const result = await response.json();

      if (result.success) {
        // Fetch the full, updated user object from the backend
        const updatedUserDataResponse = await UserService.getCurrentUser();
        if (updatedUserDataResponse.user) {
          localStorage.setItem(
            "user",
            JSON.stringify({
              ...updatedUserDataResponse.user,
              // Ensure these are correctly set as booleans based on the API response
              isTelegramConnected: Boolean(updatedUserDataResponse.user.telegram_session), // Use telegram_session
              isAdmin: Boolean(updatedUserDataResponse.user.isAdmin),
              isPremium: Boolean(updatedUserDataResponse.user.isPremium),
            })
          );
        }
      }

      return result;
    } catch (error) {
      console.error("Disconnect Telegram error:", error);
      return { success: false, message: error.message };
    }
  },

  async activateTrial() {
    try {
      const token = localStorage.getItem("auth_token");
      const response = await fetch("/api/users/activate-trial", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
      });

      const result = await response.json();
      if (result.success && result.user) {
        // Update localStorage with fresh user data from API
        localStorage.setItem(
          "user",
          JSON.stringify({
            ...result.user,
            isTelegramConnected: Boolean(result.user.telegram_session), // Use telegram_session
            isAdmin: Boolean(result.user.is_admin),
            isPremium: Boolean(result.user.is_premium),
          })
        );
      }
      return result;
    } catch (error) {
      console.error("Activate trial error:", error);
      return { success: false, message: error.message };
    }
  },

  async getAllUsers() {
    try {
      const token = localStorage.getItem("auth_token");
      const response = await fetch("/api/users", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) return [];

      const data = await response.json();
      return data.users;
    } catch (error) {
      console.error("Get all users error:", error);
      return [];
    }
  },

  async getUserDetails(userId) {
    try {
      const token = localStorage.getItem("auth_token");
      const response = await fetch(`/api/users/${userId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) return null;

      const data = await response.json();
      return data; // Returns { user: { ... } }
    } catch (error) {
      console.error("Get user details error:", error);
      return null;
    }
  },

  async checkPhoneNumber(phoneNumber) {
    try {
      const token = localStorage.getItem("auth_token");
      if (!token) {
        return {
          success: false,
          inUse: false,
          error: "Authentication token not found.",
        };
      }
      const response = await fetch(
        `/api/telegram/check-phone?phoneNumber=${encodeURIComponent(
          phoneNumber
        )}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ error: "Failed to check phone number" }));
        return {
          success: false,
          inUse: false,
          error: errorData.error || "Failed to check phone number",
        };
      }
      return await response.json();
    } catch (error) {
      console.error("Check phone number service error:", error);
      return { success: false, inUse: false, error: error.message };
    }
  },
};

export { UserService };