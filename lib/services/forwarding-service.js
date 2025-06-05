// masezahedi/telegram/telegram-d6c70a55b97a0f9dece1b87e2fa06cd5164ff70d/lib/services/forwarding-service.js
const PRODUCTION_SERVER_URL = "http://sna.freebotmoon.ir:3332";
const DEVELOPMENT_SERVER_URL = "http://localhost:3332";

const currentEnv =
  typeof process !== "undefined" && process.env && process.env.NODE_ENV
    ? process.env.NODE_ENV
    : "development";

const envSpecificServerUrl =
  currentEnv === "production" ? PRODUCTION_SERVER_URL : DEVELOPMENT_SERVER_URL;

const ForwardingService = {
  async getServices() {
    try {
      const token = localStorage.getItem("auth_token");
      const response = await fetch("/api/services", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();
      return data.success ? data.services : [];
    } catch (error) {
      console.error("Get services error:", error);
      return [];
    }
  },

  async createService(serviceData) {
    try {
      const token = localStorage.getItem("auth_token");
      const response = await fetch("/api/services", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...serviceData,
          type: serviceData.type || "forward",
          copyHistory: serviceData.copyHistory || false,
          historyLimit: serviceData.historyLimit || 100,
        }),
      });

      return await response.json();
    } catch (error) {
      console.error("Create service error:", error);
      return { success: false, error: error.message }; // Consistent error reporting
    }
  },

  async updateService(id, serviceData) {
    try {
      const token = localStorage.getItem("auth_token");

      const response = await fetch(`/api/services/${id}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...serviceData,
          type: serviceData.type || "forward",
          copyHistory: serviceData.copyHistory || false,
          historyLimit: serviceData.historyLimit || 100,
        }),
      });

      const result = await response.json();

      if (!result.success) {
        return result;
      }

      // Stop the service first by calling the Next.js API route
      await fetch("/api/services", {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id, isActive: false }),
      });

      // Then restart it if it was active by calling the Next.js API route
      if (serviceData.isActive) {
        await fetch("/api/services", {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ id, isActive: true }),
        });
      }

      return result;
    } catch (error) {
      console.error("Update service error:", error);
      return { success: false, error: error.message }; // Consistent error reporting
    }
  },

  async updateServiceStatus(id, isActive) {
    try {
      const token = localStorage.getItem("auth_token");

      // Only call the Next.js API route.
      // This route handles updating the DB and calling the appropriate service manager functions.
      const response = await fetch("/api/services", {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id, isActive }),
      });

      return await response.json();
    } catch (error) {
      console.error("Update service status error:", error);
      return { success: false, error: error.message }; // Consistent error reporting
    }
  },

  async startCopyHistory(id) {
    try {
      const token = localStorage.getItem("auth_token");
      const response = await fetch("/api/services", {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id, isActive: true, isCopyHistoryStart: true }), // Add flag for history copy start
      });
      return await response.json();
    } catch (error) {
      console.error("Start copy history service error:", error);
      return { success: false, error: error.message };
    }
  },

  async stopCopyHistory(id) {
    try {
      const token = localStorage.getItem("auth_token");
      const response = await fetch("/api/services", {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id, isActive: false, isCopyHistoryStop: true }), // Add flag for history copy stop
      });
      return await response.json();
    } catch (error) {
      console.error("Stop copy history service error:", error);
      return { success: false, error: error.message };
    }
  },

  async deleteService(id) {
    try {
      const token = localStorage.getItem("auth_token");
      const response = await fetch("/api/services", {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id }),
      });

      return await response.json();
    } catch (error) {
      console.error("Delete service error:", error);
      return { success: false, error: error.message }; // Consistent error reporting
    }
  },
};

export { ForwardingService };