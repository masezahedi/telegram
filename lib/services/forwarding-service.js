// Define the possible server URLs
const PRODUCTION_SERVER_URL = "http://sna.freebotmoon.ir:3332";
const DEVELOPMENT_SERVER_URL = "http://localhost:3332";

// Determine the current environment.
// This typically relies on your build process (e.g., Webpack, Vite, Parcel)
// setting the `process.env.NODE_ENV` variable.
// For frontend projects, `process.env.NODE_ENV` is usually replaced at build time.
// If `process.env.NODE_ENV` is not available, it defaults to 'development'.
const currentEnv =
  typeof process !== "undefined" && process.env && process.env.NODE_ENV
    ? process.env.NODE_ENV
    : "development";

// Select the server URL based on the current environment
const envSpecificServerUrl =
  currentEnv === "production" ? PRODUCTION_SERVER_URL : DEVELOPMENT_SERVER_URL;

// If you are not using a build process that defines process.env.NODE_ENV,
// you might need a different strategy, such as:
// 1. Using a global configuration object set in your HTML:
//    <script>window.APP_CONFIG = { API_URL: 'http://localhost:3332' };</script>
//    And then: const envSpecificServerUrl = window.APP_CONFIG.API_URL;
// 2. Checking window.location.hostname:
//    const envSpecificServerUrl = window.location.hostname === 'your.production.domain'
//      ? PRODUCTION_SERVER_URL
//      : DEVELOPMENT_SERVER_URL;

const ForwardingService = {
  async getServices() {
    try {
      const token = localStorage.getItem("auth_token");
      // This fetch call is to a relative path, assuming it's on the same host as your frontend.
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
      // This fetch call is to a relative path.
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

      // First update the service in the database (relative path)
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

      // Stop and restart the service to apply changes (calls to relative /api/services)
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

      // Update the service status in the database (relative path)
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

      // Then start or stop the service on the EXTERNAL server
      // The envSpecificServerUrl is defined above based on the environment
      const serverEndpoint = isActive ? "/services/start" : "/services/stop";
      const serverResponse = await fetch(
        `${envSpecificServerUrl}${serverEndpoint}`,
        {
          // Use the environment-specific URL
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`, // Consider if this token is valid for the external service
            "Content-Type": "application/json",
          },
          credentials: "include", // Ensure CORS is properly configured on the target server
        }
      );

      const serverResult = await serverResponse.json();

      if (!serverResult.success) {
        // If server operation fails, revert the database status
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
          error: serverResult.error || "خطا در اجرای سرویس", // "Error executing service"
        };
      }

      return { success: true };
    } catch (error) {
      console.error("Update service status error:", error);
      // Consider reverting database changes here as well if the external call fails due to network/other errors
      return { success: false, message: error.message };
    }
  },

  async deleteService(id) {
    try {
      const token = localStorage.getItem("auth_token");
      // This fetch call is to a relative path.
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
