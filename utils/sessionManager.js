const SESSION_KEY = 'coordinatePlaneSession';

// In-memory fallback storage
let memoryStore = null;
let usingMemoryFallback = false;
let storageWarningShown = false;

// Check if sessionStorage is available
const isSessionStorageAvailable = () => {
  try {
    if (typeof window === 'undefined') return false;
    const testKey = '__storage_test__';
    sessionStorage.setItem(testKey, 'test');
    sessionStorage.removeItem(testKey);
    return true;
  } catch (error) {
    return false;
  }
};

export const sessionManager = {
  // Get storage warning if using fallback
  getStorageWarning: () => {
    if (usingMemoryFallback && !storageWarningShown) {
      storageWarningShown = true;
      return 'SessionStorage is unavailable. Using memory-only mode. Your session will be lost if you close this tab.';
    }
    return null;
  },

  // Check if using memory fallback
  isUsingMemoryFallback: () => usingMemoryFallback,

  // Save complete session
  saveSession: (data) => {
    try {
      if (typeof window !== 'undefined' && isSessionStorageAvailable()) {
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(data));
        return true;
      }
      // Fallback to memory storage
      memoryStore = data;
      usingMemoryFallback = true;
      return true;
    } catch (error) {
      // SessionStorage full or disabled, use memory fallback
      console.warn('SessionStorage failed, using memory fallback:', error.message);
      memoryStore = data;
      usingMemoryFallback = true;
      return true;
    }
  },

  // Load session
  loadSession: () => {
    try {
      if (typeof window !== 'undefined' && isSessionStorageAvailable()) {
        const data = sessionStorage.getItem(SESSION_KEY);
        if (data) {
          return JSON.parse(data);
        }
      }
      // Try memory fallback
      return memoryStore;
    } catch (error) {
      console.warn('Failed to load from sessionStorage, using memory fallback:', error.message);
      return memoryStore;
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
      if (typeof window !== 'undefined' && isSessionStorageAvailable()) {
        sessionStorage.removeItem(SESSION_KEY);
      }
      // Also clear memory fallback
      memoryStore = null;
      usingMemoryFallback = false;
      storageWarningShown = false;
      return true;
    } catch (error) {
      console.warn('Failed to clear sessionStorage, clearing memory fallback:', error.message);
      memoryStore = null;
      usingMemoryFallback = false;
      storageWarningShown = false;
      return true;
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
