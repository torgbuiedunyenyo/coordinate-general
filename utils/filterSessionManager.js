const FILTER_SESSION_KEY = 'filterStackSession';

// In-memory fallback storage (same pattern as other session managers)
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

export const filterSessionManager = {
  // Get storage warning if using fallback
  getStorageWarning: () => {
    if (usingMemoryFallback && !storageWarningShown) {
      storageWarningShown = true;
      return 'SessionStorage unavailable. Using memory mode. Session lost if tab closed.';
    }
    return null;
  },

  // Check if using memory fallback
  isUsingMemoryFallback: () => usingMemoryFallback,

  // Save complete session
  saveSession: (data) => {
    try {
      if (typeof window !== 'undefined' && isSessionStorageAvailable()) {
        sessionStorage.setItem(FILTER_SESSION_KEY, JSON.stringify(data));
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
        const data = sessionStorage.getItem(FILTER_SESSION_KEY);
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
  initSession: (originalText, selectedModel, filters) => {
    const session = {
      originalText,
      selectedModel,
      filterStackInitialized: true,
      filters,
      layers: [], // Support both filters and layers for compatibility
      cache: {
        'original': originalText
      },
      finalResult: null,
      totalTokens: {
        input: 0,
        output: 0
      },
      lastModified: new Date().toISOString()
    };
    filterSessionManager.saveSession(session);
    return session;
  },

  // Update cache
  updateCache: (cacheKey, text) => {
    const session = filterSessionManager.loadSession();
    if (!session) return false;
    
    session.cache[cacheKey] = text;
    session.lastModified = new Date().toISOString();
    
    filterSessionManager.saveSession(session);
    return true;
  },

  // Update filter
  updateFilter: (filterId, updates) => {
    const session = filterSessionManager.loadSession();
    if (!session) return false;
    
    const filterIndex = session.filters.findIndex(f => f.id === filterId);
    if (filterIndex === -1) return false;
    
    session.filters[filterIndex] = {
      ...session.filters[filterIndex],
      ...updates
    };
    session.lastModified = new Date().toISOString();
    
    filterSessionManager.saveSession(session);
    return true;
  },

  // Update all filters at once
  updateAllFilters: (filters) => {
    const session = filterSessionManager.loadSession();
    if (!session) return false;
    
    session.filters = filters;
    session.lastModified = new Date().toISOString();
    
    filterSessionManager.saveSession(session);
    return true;
  },

  // Update tokens
  updateTokens: (inputTokens, outputTokens) => {
    const session = filterSessionManager.loadSession();
    if (!session) return false;
    
    session.totalTokens.input += inputTokens;
    session.totalTokens.output += outputTokens;
    session.lastModified = new Date().toISOString();
    
    filterSessionManager.saveSession(session);
    return true;
  },

  // Update final result
  updateFinalResult: (text) => {
    const session = filterSessionManager.loadSession();
    if (!session) return false;
    
    session.finalResult = text;
    session.lastModified = new Date().toISOString();
    
    filterSessionManager.saveSession(session);
    return true;
  },

  // Clear session
  clearSession: () => {
    try {
      if (typeof window !== 'undefined' && isSessionStorageAvailable()) {
        sessionStorage.removeItem(FILTER_SESSION_KEY);
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

  // Check if cache exists
  hasCache: (cacheKey) => {
    const session = filterSessionManager.loadSession();
    return session && session.cache[cacheKey] !== undefined;
  },

  // Get specific cache
  getCache: (cacheKey) => {
    const session = filterSessionManager.loadSession();
    return session?.cache[cacheKey] || null;
  }
};
