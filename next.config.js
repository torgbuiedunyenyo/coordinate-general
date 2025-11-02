/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
}

module.exports = {
  // ... existing config
  
  // Suppress specific console warnings in development
  webpack: (config, { dev }) => {
    if (dev) {
      const originalWarn = console.warn;
      console.warn = (...args) => {
        const message = args[0];
        // Suppress viewport warning
        if (typeof message === 'string' && message.includes('viewport meta tags should not be used in _document.js')) {
          return;
        }
        originalWarn.apply(console, args);
      };
    }
    return config;
  },
};
