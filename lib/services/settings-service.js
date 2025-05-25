const SettingsService = {
  async getSettings() {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch('/api/settings', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      const data = await response.json();
      return data.success ? data.settings : null;
    } catch (error) {
      console.error('Get settings error:', error);
      return null;
    }
  },

  async updateSettings(settings) {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(settings),
      });
      
      return await response.json();
    } catch (error) {
      console.error('Update settings error:', error);
      return { success: false, message: error.message };
    }
  }
};

export { SettingsService };