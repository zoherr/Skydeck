export const auth = {
  isSetup: async () => {
    if (window.skydeck && window.skydeck.auth) {
      return window.skydeck.auth.isSetup();
    }
    // Browser fallback
    const local = localStorage.getItem('skydeck_auth_mock');
    return { isSetup: !!local };
  },

  setup: async (password) => {
    if (window.skydeck && window.skydeck.auth) {
      return window.skydeck.auth.setup(password);
    }
    localStorage.setItem('skydeck_auth_mock', 'true');
    return { success: true };
  },

  verify: async (password) => {
    if (window.skydeck && window.skydeck.auth) {
      return window.skydeck.auth.verify(password);
    }
    return { success: true };
  },

  reset: async () => {
    if (window.skydeck && window.skydeck.auth) {
      return window.skydeck.auth.reset();
    }
    localStorage.removeItem('skydeck_auth_mock');
    localStorage.removeItem('skydeck_profiles_mock');
    return { success: true };
  },

  changePassword: async (currentPassword, newPassword) => {
    if (window.skydeck && window.skydeck.auth) {
      return window.skydeck.auth.changePassword(currentPassword, newPassword);
    }
    return { success: true };
  },

  lock: async () => {
    if (window.skydeck && window.skydeck.auth) {
      return window.skydeck.auth.lock();
    }
    return { success: true };
  },
};
