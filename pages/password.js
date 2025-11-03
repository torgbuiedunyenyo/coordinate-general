import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import styles from '../styles/Password.module.css';
import { verifyPassword, isAuthenticated } from '../utils/authManager';

export default function Password() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    // Check if already authenticated
    if (isAuthenticated()) {
      // Get the redirect path or go to home
      const redirectPath = sessionStorage.getItem('coordinate_general_redirect_after_auth') || '/';
      sessionStorage.removeItem('coordinate_general_redirect_after_auth');
      router.push(redirectPath);
    } else {
      setChecking(false);
    }
  }, [router]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const isValid = await verifyPassword(password);
      
      if (isValid) {
        // Get the redirect path or go to home
        const redirectPath = sessionStorage.getItem('coordinate_general_redirect_after_auth') || '/';
        sessionStorage.removeItem('coordinate_general_redirect_after_auth');
        router.push(redirectPath);
      } else {
        setError('Invalid password. Please try again.');
        setPassword('');
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
      console.error('Password verification error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && password && !loading) {
      handleSubmit(e);
    }
  };

  if (checking) {
    return (
      <div className={styles.container}>
        <Head>
          <title>Checking Authentication - Coordinate General</title>
          <meta name="description" content="Checking authentication status" />
        </Head>
        <main className={styles.main}>
          <div className={styles.loadingContainer}>
            <p>Checking authentication...</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <Head>
        <title>Enter Password - Coordinate General</title>
        <meta name="description" content="Enter password to access Coordinate General" />
      </Head>

      <main className={styles.main}>
        <div className={styles.passwordCard}>
          <h1 className={styles.title}>Coordinate General</h1>
          
          <p className={styles.subtitle}>
            Enter password to access the application
          </p>

          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.inputGroup}>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Enter password"
                className={styles.passwordInput}
                disabled={loading}
                autoFocus
              />
            </div>

            {error && (
              <div className={styles.error}>
                {error}
              </div>
            )}

            <button
              type="submit"
              className={styles.submitButton}
              disabled={!password || loading}
            >
              {loading ? 'Verifying...' : 'Enter'}
            </button>
          </form>

          <div className={styles.hint}>
            <p>This application is password protected.</p>
            <p>Contact the administrator if you need access.</p>
          </div>
        </div>
      </main>
    </div>
  );
}
