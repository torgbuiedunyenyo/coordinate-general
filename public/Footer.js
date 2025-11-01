import React from 'react';

const Footer = () => {
  const footerStyle = {
    marginTop: '3rem',
    padding: '2rem 0',
    borderTop: '1px solid #dee2e6',
    textAlign: 'center',
    color: '#6c757d',
    fontSize: '0.9rem'
  };

  const linkStyle = {
    color: '#4c6ef5',
    textDecoration: 'none',
    marginLeft: '0.25rem'
  };

  return (
    <footer style={footerStyle}>
      <p>
        Powered by
        <a 
          href="https://www.anthropic.com/" 
          target="_blank" 
          rel="noopener noreferrer"
          style={linkStyle}
        >
          Claude Haiku 4.5
        </a>
      </p>
      <p style={{ marginTop: '0.5rem' }}>
        © 2025 Coordinate Plane Text Transformer
      </p>
    </footer>
  );
};

export default Footer;
