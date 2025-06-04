const TariffService = {
    async getTariffSettings() {
      try {
        const token = localStorage.getItem('auth_token');
        const response = await fetch('/api/admin/tariffs', { // Changed to Next.js API route
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
  
        const data = await response.json();
        return data.success ? data.settings : null;
      } catch (error) {
        console.error('Get tariff settings error:', error);
        return null;
      }
    },
  
    async updateTariffSettings(settingsData) {
      try {
        const token = localStorage.getItem('auth_token');
        const response = await fetch('/api/admin/tariffs', { // Changed to Next.js API route
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(settingsData),
        });
  
        return await response.json();
      } catch (error) {
        console.error('Update tariff settings error:', error);
        return { success: false, message: error.message };
      }
    },
  };
  
  export { TariffService };