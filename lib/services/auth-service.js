const AuthService = {
  async register(userData) {
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(userData),
      });

      const data = await response.json();
      if (!response.ok) {
        return {
          success: false,
          message: data.error || "Registration failed. Please try again.",
        };
      }

      return data;
    } catch (error) {
      console.error("Registration error:", error);
      return { success: false, message: error.message };
    }
  },

  updateStoredUser(updatedPartialUser) {
    if (typeof window !== "undefined") {
      const userStr = localStorage.getItem("user");
      if (userStr) {
        const currentUser = JSON.parse(userStr);
        const newUser = { ...currentUser, ...updatedPartialUser };
        localStorage.setItem("user", JSON.stringify(newUser));
      } else {
        // اگر کاربری در localStorage نبود، اطلاعات جدید را مستقیم ذخیره کن
        localStorage.setItem("user", JSON.stringify(updatedPartialUser));
      }
    }
  },

  async login(credentials) {
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(credentials),
      });

      const data = await response.json();
      if (!response.ok) {
        return {
          success: false,
          message: data.error || "Login failed. Please try again.",
        };
      }

      if (data.success && typeof window !== "undefined") {
        localStorage.setItem("auth_token", data.token);
        const { telegramSession, telegram_user_id, is_admin, ...restOfUser } =
          data.user;
        localStorage.setItem(
          "user",
          JSON.stringify({
            ...restOfUser,
            isTelegramConnected: Boolean(telegramSession),
            telegramUserId: telegram_user_id, // ذخیره شناسه تلگرام
            isAdmin: Boolean(is_admin),
          })
        );
      }

      return data;
    } catch (error) {
      console.error("Login error:", error);
      return { success: false, message: error.message };
    }
  },

  async logout() {
    try {
      if (typeof window !== "undefined") {
        localStorage.removeItem("auth_token");
        localStorage.removeItem("user");
      }
      return { success: true };
    } catch (error) {
      console.error("Logout error:", error);
      return { success: false, message: error.message };
    }
  },

  async isAuthenticated() {
    try {
      if (typeof window === "undefined") return false;

      const token = localStorage.getItem("auth_token");
      if (!token) return false;

      const response = await fetch("/api/auth/verify", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        await this.logout();
        return false;
      }

      return true;
    } catch (error) {
      console.error("Auth check error:", error);
      await this.logout();
      return false;
    }
  },

  getStoredUser() {
    try {
      if (typeof window === "undefined") return null;

      const userStr = localStorage.getItem("user");
      if (!userStr) return null;

      const user = JSON.parse(userStr);
      return {
        id: user.id,
        name: user.name,
        email: user.email,
        isTelegramConnected: Boolean(user.isTelegramConnected),
        phoneNumber: user.phoneNumber,
        telegramUserId: user.telegramUserId, // بازگرداندن شناسه تلگرام
        isAdmin: Boolean(user.isAdmin),
      };
    } catch (error) {
      console.error("Error getting stored user:", error);
      return null;
    }
  },
};

export { AuthService };
