/**
 * Mobile detection utility for responsive UI/UX
 */

export const isMobileDevice = () => {
  if (typeof window === 'undefined') return false;
  
  // Check for touch capability
  const hasTouch = 'ontouchstart' in window || 
                   navigator.maxTouchPoints > 0 ||
                   navigator.msMaxTouchPoints > 0;
  
  // Check viewport width
  const isSmallScreen = window.innerWidth <= 768;
  
  // Check user agent for mobile devices
  const mobileRegex = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;
  const isMobileUA = mobileRegex.test(navigator.userAgent);
  
  // Return true if it's a mobile device or small screen with touch
  return isMobileUA || (hasTouch && isSmallScreen);
};

export const isTablet = () => {
  if (typeof window === 'undefined') return false;
  
  const width = window.innerWidth;
  const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  
  // Tablet is typically between 768px and 1024px with touch
  return hasTouch && width > 768 && width <= 1024;
};

export const getDeviceType = () => {
  if (typeof window === 'undefined') return 'desktop';
  
  if (isMobileDevice()) return 'mobile';
  if (isTablet()) return 'tablet';
  return 'desktop';
};

// Hook for React components
export const useMobileDetect = () => {
  const [deviceType, setDeviceType] = useState('desktop');
  
  useEffect(() => {
    const checkDevice = () => {
      setDeviceType(getDeviceType());
    };
    
    checkDevice();
    window.addEventListener('resize', checkDevice);
    
    return () => window.removeEventListener('resize', checkDevice);
  }, []);
  
  return {
    isMobile: deviceType === 'mobile',
    isTablet: deviceType === 'tablet',
    isDesktop: deviceType === 'desktop',
    deviceType
  };
};

// Add this import at the top of the file
import { useState, useEffect } from 'react';
