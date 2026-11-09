export const profiles = {
  list: async () => {
    if (window.skydeck && window.skydeck.profiles) {
      const res = await window.skydeck.profiles.list();
      return res.data || [];
    }
    // Browser fallback
    try {
      const local = localStorage.getItem('skydeck_profiles_mock');
      return local ? JSON.parse(local) : [];
    } catch (e) {
      return [];
    }
  },

  save: async (profileList) => {
    if (window.skydeck && window.skydeck.profiles) {
      return window.skydeck.profiles.save(profileList);
    }
    localStorage.setItem('skydeck_profiles_mock', JSON.stringify(profileList));
    return { success: true };
  },

  selectKeyFile: async () => {
    if (window.skydeck && window.skydeck.dialog) {
      return window.skydeck.dialog.selectKeyFile();
    }
    return { canceled: true };
  },
};

