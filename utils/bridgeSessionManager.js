// Bridge Session Manager - Separate from coordinate plane session
const BRIDGE_SESSION_KEY = 'bridgePlaneSession';

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

export const bridgeSessionManager = {
  // Get storage warning if using fallback
  getStorageWarning: () => {
    if (usingMemoryFallback && !storageWarningShown) {
      storageWarningShown = true;
      return 'SessionStorage is unavailable. Using memory-only mode. Your bridge session will be lost if you close this tab.';
    }
    return null;
  },

  // Check if using memory fallback
  isUsingMemoryFallback: () => usingMemoryFallback,

  // Save complete session
  saveSession: (data) => {
    try {
      if (typeof window !== 'undefined' && isSessionStorageAvailable()) {
        sessionStorage.setItem(BRIDGE_SESSION_KEY, JSON.stringify(data));
        return true;
      }
      // Fallback to memory storage
      memoryStore = data;
      usingMemoryFallback = true;
      return true;
    } catch (error) {
      // SessionStorage full or disabled, use memory fallback
      console.warn('Bridge SessionStorage failed, using memory fallback:', error.message);
      memoryStore = data;
      usingMemoryFallback = true;
      return true;
    }
  },

  // Load session
  loadSession: () => {
    try {
      if (typeof window !== 'undefined' && isSessionStorageAvailable()) {
        const data = sessionStorage.getItem(BRIDGE_SESSION_KEY);
        if (data) {
          return JSON.parse(data);
        }
      }
      // Try memory fallback
      return memoryStore;
    } catch (error) {
      console.warn('Failed to load bridge from sessionStorage, using memory fallback:', error.message);
      return memoryStore;
    }
  },

  // Initialize new bridge session
  initSession: (textA, textB, selectedModel = 'haiku-4.5') => {
    const session = {
      textA,
      textB,
      selectedModel,
      positions: {
        "0": textA,    // Position 0 is Text A (verbatim)
        "10": textB    // Position 10 is Text B (verbatim)
      },
      progress: {
        currentRound: 0,
        totalGenerated: 0, // Not counting the anchors (0 and 10)
        status: 'idle' // "idle" | "generating" | "complete" | "error"
      }
    };
    bridgeSessionManager.saveSession(session);
    return session;
  },

  // Update single position
  updatePosition: (position, text) => {
    const session = bridgeSessionManager.loadSession();
    if (!session) return false;
    
    session.positions[position] = text;
    // Count generated positions (excluding anchors 0 and 10)
    const generatedPositions = Object.keys(session.positions)
      .filter(pos => pos !== "0" && pos !== "10")
      .length;
    session.progress.totalGenerated = generatedPositions;
    
    bridgeSessionManager.saveSession(session);
    return true;
  },

  // Update progress
  updateProgress: (updates) => {
    const session = bridgeSessionManager.loadSession();
    if (!session) return false;
    
    session.progress = { ...session.progress, ...updates };
    bridgeSessionManager.saveSession(session);
    return true;
  },

  // Clear session
  clearSession: () => {
    try {
      if (typeof window !== 'undefined' && isSessionStorageAvailable()) {
        sessionStorage.removeItem(BRIDGE_SESSION_KEY);
      }
      // Also clear memory fallback
      memoryStore = null;
      usingMemoryFallback = false;
      storageWarningShown = false;
      return true;
    } catch (error) {
      console.warn('Failed to clear bridge sessionStorage, clearing memory fallback:', error.message);
      memoryStore = null;
      usingMemoryFallback = false;
      storageWarningShown = false;
      return true;
    }
  },

  // Check if position exists
  hasPosition: (position) => {
    const session = bridgeSessionManager.loadSession();
    return session && session.positions[position.toString()] !== undefined;
  },

  // Get specific position
  getPosition: (position) => {
    const session = bridgeSessionManager.loadSession();
    return session?.positions[position.toString()] || null;
  },

  // Get all positions
  getAllPositions: () => {
    const session = bridgeSessionManager.loadSession();
    return session?.positions || {};
  }
};
