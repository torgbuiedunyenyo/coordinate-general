// Authentication manager for password protection
const AUTH_KEY = 'coordinate_general_authenticated';
const AUTH_EXPIRY_KEY = 'coordinate_general_auth_expiry';
const SESSION_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

/**
 * Check if the user is authenticated
 * @returns {boolean} True if authenticated and session valid, false otherwise
 */
export function isAuthenticated() {
  if (typeof window === 'undefined') {
    return false;
  }

  const authStatus = sessionStorage.getItem(AUTH_KEY);
  const authExpiry = sessionStorage.getItem(AUTH_EXPIRY_KEY);

  if (authStatus === 'true' && authExpiry) {
    const expiryTime = parseInt(authExpiry, 10);
    const currentTime = Date.now();

    if (currentTime < expiryTime) {
      return true;
    } else {
      // Session expired, clear auth
      clearAuth();
      return false;
    }
  }

  return false;
}

/**
 * Set authentication status
 * @param {boolean} status - Authentication status to set
 */
export function setAuthenticated(status) {
  if (typeof window === 'undefined') {
    return;
  }

  if (status) {
    sessionStorage.setItem(AUTH_KEY, 'true');
    // Set expiry time
    const expiryTime = Date.now() + SESSION_DURATION;
    sessionStorage.setItem(AUTH_EXPIRY_KEY, expiryTime.toString());
  } else {
    clearAuth();
  }
}

/**
 * Clear authentication status
 */
export function clearAuth() {
  if (typeof window === 'undefined') {
    return;
  }

  sessionStorage.removeItem(AUTH_KEY);
  sessionStorage.removeItem(AUTH_EXPIRY_KEY);
}

/**
 * Verify password with the API
 * @param {string} password - Password to verify
 * @returns {Promise<boolean>} True if password is valid, false otherwise
 */
export async function verifyPassword(password) {
  try {
    const response = await fetch('/api/verify-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ password }),
    });

    if (response.ok) {
      setAuthenticated(true);
      return true;
    } else {
      return false;
    }
  } catch (error) {
    console.error('Error verifying password:', error);
    return false;
  }
}

/**
 * Redirect to password page if not authenticated
 * Should be called from page components
 */
export function requireAuth() {
  if (typeof window === 'undefined') {
    return;
  }

  if (!isAuthenticated()) {
    // Store the intended destination
    const currentPath = window.location.pathname + window.location.search;
    if (currentPath !== '/password') {
      sessionStorage.setItem('coordinate_general_redirect_after_auth', currentPath);
    }
    
    // Redirect to password page
    window.location.href = '/password';
  }
}
