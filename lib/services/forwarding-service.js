// Define the possible server URLs
const PRODUCTION_SERVER_URL = "http://sna.freebotmoon.ir:3332";
const DEVELOPMENT_SERVER_URL = "http://localhost:3332";

// Determine the current environment
const currentEnv =
  typeof process !== "undefined" && process.env && process.env.NODE_ENV
    ? process.env.NODE_ENV
    : "development";

// Select the server URL based on the current environment
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
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(serviceData),
      });

      return await response.json();
    } catch (error) {
      console.error("Create service error:", error);
      return { success: false, message: error.message };
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
        body: JSON.stringify(serviceData),
      });

      const result = await response.json();

      if (!result.success) {
        return result;
      }

      await fetch("/api/services", {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id, isActive: false }),
      });

      await fetch("/api/services", {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id, isActive: true }),
      });

      return result;
    } catch (error) {
      console.error("Update service error:", error);
      return { success: false, message: error.message };
    }
  },

  async updateServiceStatus(id, isActive) {
    try {
      const token = localStorage.getItem("auth_token");

      const updateResponse = await fetch("/api/services", {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id, isActive }),
      });

      const updateResult = await updateResponse.json();

      if (!updateResult.success) {
        return updateResult;
      }

      const serverEndpoint = isActive ? "/services/start" : "/services/stop";
      const serverResponse = await fetch(
        `${envSpecificServerUrl}${serverEndpoint}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          credentials: "include",
        }
      );

      const serverResult = await serverResponse.json();

      if (!serverResult.success) {
        await fetch("/api/services", {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ id, isActive: !isActive }),
        });

        return {
          success: false,
          error: serverResult.error || "خطا در اجرای سرویس",
        };
      }

      return { success: true };
    } catch (error) {
      console.error("Update service status error:", error);
      return { success: false, message: error.message };
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
      return { success: false, message: error.message };
    }
  },
};

export { ForwardingService };
