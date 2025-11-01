const SESSION_KEY = 'coordinatePlaneSession';

export const sessionManager = {
  // Save complete session
  saveSession: (data) => {
    try {
      if (typeof window !== 'undefined') {
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(data));
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to save session:', error);
      return false;
    }
  },

  // Load session
  loadSession: () => {
    try {
      if (typeof window !== 'undefined') {
        const data = sessionStorage.getItem(SESSION_KEY);
        return data ? JSON.parse(data) : null;
      }
      return null;
    } catch (error) {
      console.error('Failed to load session:', error);
      return null;
    }
  },

  // Initialize new session
  initSession: (originalText, adjectives) => {
    const session = {
      originalText,
      adjectives,
      generations: {},
      progress: {
        currentRing: 0,
        totalGenerated: 0,
        status: 'idle'
      }
    };
    sessionManager.saveSession(session);
    return session;
  },

  // Update single generation
  updateGeneration: (coordinate, text) => {
    const session = sessionManager.loadSession();
    if (!session) return false;
    
    session.generations[coordinate] = text;
    session.progress.totalGenerated = Object.keys(session.generations).length;
    
    sessionManager.saveSession(session);
    return true;
  },

  // Update progress
  updateProgress: (updates) => {
    const session = sessionManager.loadSession();
    if (!session) return false;
    
    session.progress = { ...session.progress, ...updates };
    sessionManager.saveSession(session);
    return true;
  },

  // Clear session
  clearSession: () => {
    try {
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem(SESSION_KEY);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to clear session:', error);
      return false;
    }
  },

  // Check if generation exists
  hasGeneration: (coordinate) => {
    const session = sessionManager.loadSession();
    return session && session.generations[coordinate] !== undefined;
  },

  // Get specific generation
  getGeneration: (coordinate) => {
    const session = sessionManager.loadSession();
    return session?.generations[coordinate] || null;
  }
};
