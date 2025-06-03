const AuthService = {
  async register(userData) {
    try {
      const response = await fetch("/api/auth/register", {
        //
        method: "POST", //
        headers: {
          "Content-Type": "application/json", //
        },
        body: JSON.stringify(userData), //
      });

      const data = await response.json(); //
      if (!response.ok) {
        return {
          success: false, //
          message: data.error || "Registration failed. Please try again.", //
        };
      }

      return data; //
    } catch (error) {
      console.error("Registration error:", error); //
      return { success: false, message: error.message }; //
    }
  },

  async login(credentials) {
    try {
      const response = await fetch("/api/auth/login", {
        //
        method: "POST", //
        headers: {
          "Content-Type": "application/json", //
        },
        body: JSON.stringify(credentials), //
      });

      const data = await response.json(); //
      if (!response.ok) {
        return {
          success: false, //
          message: data.error || "Login failed. Please try again.", //
        };
      }

      if (data.success && typeof window !== "undefined") {
        //
        localStorage.setItem("auth_token", data.token); //
        // Destructure all new fields from data.user
        const {
          telegramSession,
          is_admin,
          is_premium,
          premium_expiry_date,
          service_creation_count,
          ...restOfUser
        } = data.user; //
        localStorage.setItem(
          "user",
          JSON.stringify({
            ...restOfUser, //
            isTelegramConnected: Boolean(telegramSession), //
            isAdmin: Boolean(is_admin), // Changed from data.user.is_admin //
            isPremium: Boolean(is_premium), // New
            premiumExpiryDate: premium_expiry_date, // New
            serviceCreationCount: service_creation_count, // New
          })
        );
      }

      return data; //
    } catch (error) {
      console.error("Login error:", error); //
      return { success: false, message: error.message }; //
    }
  },

  async logout() {
    try {
      if (typeof window !== "undefined") {
        localStorage.removeItem("auth_token"); //
        localStorage.removeItem("user"); //
      }
      return { success: true }; //
    } catch (error) {
      console.error("Logout error:", error); //
      return { success: false, message: error.message }; //
    }
  },

  async isAuthenticated() {
    try {
      if (typeof window === "undefined") return false; //

      const token = localStorage.getItem("auth_token"); //
      if (!token) return false; //

      const response = await fetch("/api/auth/verify", {
        //
        headers: {
          Authorization: `Bearer ${token}`, //
        },
      });

      const data = await response.json(); //

      if (!response.ok || !data.success) {
        //
        await this.logout(); //
        return false; //
      }

      return true; //
    } catch (error) {
      console.error("Auth check error:", error); //
      await this.logout(); //
      return false; //
    }
  },

  getStoredUser() {
    try {
      if (typeof window === "undefined") return null; //

      const userStr = localStorage.getItem("user"); //
      if (!userStr) return null; //

      const user = JSON.parse(userStr); //
      // Ensure all fields, including new ones, are returned correctly
      return {
        ...user, //
        isAdmin: Boolean(user.isAdmin), //
        isPremium: Boolean(user.isPremium), // Ensure this is handled if present
        premiumExpiryDate: user.premiumExpiryDate || null, // Ensure this is handled
        serviceCreationCount: user.serviceCreationCount || 0, // Ensure this is handled
      };
    } catch (error) {
      console.error("Error getting stored user:", error); //
      return null; //
    }
  },
};

export { AuthService };
