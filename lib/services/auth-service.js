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
        localStorage.setItem(
          "user",
          JSON.stringify({
            ...data.user,
            isAdmin: Boolean(data.user.is_admin),
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
        ...user,
        isAdmin: Boolean(user.isAdmin),
      };
    } catch (error) {
      console.error("Error getting stored user:", error);
      return null;
    }
  },
};

export { AuthService };
