import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import styles from '../styles/Bridge.module.css';
import { bridgeSessionManager } from '../utils/bridgeSessionManager';
import { validateBridgeInputs } from '../utils/bridgePromptBuilder';

export default function BridgeSetup() {
  const router = useRouter();
  const [textA, setTextA] = useState('');
  const [textB, setTextB] = useState('');
  const [selectedModel, setSelectedModel] = useState('haiku-4.5');
  const [errors, setErrors] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasExistingSession, setHasExistingSession] = useState(false);
  const [storageWarning, setStorageWarning] = useState(null);

  // Model configurations (same as coordinate plane)
  const models = [
    {
      id: 'haiku-4.5',
      name: 'Claude Haiku 4.5',
      description: 'Fast & cost-effective ($0.25/$1.25 per M tokens)',
      provider: 'anthropic'
    },
    {
      id: 'sonnet-4.5',
      name: 'Claude Sonnet 4.5',
      description: 'Advanced reasoning ($3/$15 per M tokens)',
      provider: 'anthropic'
    },
    {
      id: 'gemini-2.5-flash',
      name: 'Gemini 2.5 Flash',
      description: 'Google\'s fast multimodal model',
      provider: 'google'
    }
  ];

  // Load existing session data on mount
  useEffect(() => {
    const session = bridgeSessionManager.loadSession();
    if (session) {
      // Pre-fill form with existing session values
      setTextA(session.textA || '');
      setTextB(session.textB || '');
      setSelectedModel(session.selectedModel || 'haiku-4.5');
      setHasExistingSession(true);
    }

    // Check for storage warning
    const warning = bridgeSessionManager.getStorageWarning();
    if (warning) {
      setStorageWarning(warning);
    }
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Validate inputs
    const validationErrors = validateBridgeInputs(textA, textB);
    
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }

    setErrors([]);
    setIsSubmitting(true);

    // Check if we need to reinitialize the session
    const currentSession = bridgeSessionManager.loadSession();
    const trimmedTextA = textA.trim();
    const trimmedTextB = textB.trim();

    // Only reinitialize if the texts or model have changed
    const hasChanges = !currentSession || 
      currentSession.textA !== trimmedTextA ||
      currentSession.textB !== trimmedTextB ||
      currentSession.selectedModel !== selectedModel;

    if (hasChanges) {
      // Initialize new bridge session
      bridgeSessionManager.initSession(trimmedTextA, trimmedTextB, selectedModel);
    }

    // Navigate to bridge generation page
    router.push('/bridge-generate');
  };

  const charCountA = textA.length;
  const charCountB = textB.length;
  const charCountColorA = charCountA < 50 ? '#dc3545' : charCountA > 1000 ? '#dc3545' : '#28a745';
  const charCountColorB = charCountB < 50 ? '#dc3545' : charCountB > 1000 ? '#dc3545' : '#28a745';

  return (
    <div className={styles.container}>
      <Head>
        <title>Bridge Setup - Text Bridge</title>
        <meta name="description" content="Create smooth interpolations between two different texts" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className={styles.main}>
        <div className={styles.navigation}>
          <Link href="/setup" className={styles.navLink}>
            ← Coordinate Plane
          </Link>
          {hasExistingSession && (
            <Link href="/bridge-explore" className={styles.navLink}>
              Bridge Explore →
            </Link>
          )}
        </div>

        <h1 className={styles.title}>Text Bridge</h1>
        <p className={styles.description}>
          Create smooth interpolations between two completely different texts.
        </p>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.textInputGrid}>
            {/* Text A Input */}
            <div className={styles.formGroup}>
              <label htmlFor="textA" className={styles.label}>
                Text A (Start)
                <span className={styles.charCount} style={{ color: charCountColorA }}>
                  {charCountA}/1000 characters
                </span>
              </label>
              <textarea
                id="textA"
                value={textA}
                onChange={(e) => setTextA(e.target.value)}
                className={styles.textarea}
                placeholder="Enter your first text here (50-1000 characters)..."
                rows={8}
                maxLength={1000}
              />
            </div>

            {/* Text B Input */}
            <div className={styles.formGroup}>
              <label htmlFor="textB" className={styles.label}>
                Text B (End)
                <span className={styles.charCount} style={{ color: charCountColorB }}>
                  {charCountB}/1000 characters
                </span>
              </label>
              <textarea
                id="textB"
                value={textB}
                onChange={(e) => setTextB(e.target.value)}
                className={styles.textarea}
                placeholder="Enter your second text here (50-1000 characters)..."
                rows={8}
                maxLength={1000}
              />
            </div>
          </div>

          {/* Error Messages */}
          {errors.length > 0 && (
            <div className={styles.errorContainer}>
              {errors.map((error, index) => (
                <p key={index} className={styles.error}>
                  {error}
                </p>
              ))}
            </div>
          )}

          {/* Storage Warning */}
          {storageWarning && (
            <div className={styles.warningContainer}>
              <p className={styles.warning}>
                ⚠️ {storageWarning}
              </p>
            </div>
          )}

          {/* Session Status Info */}
          {hasExistingSession && (
            <div className={styles.sessionInfo}>
              <p>
                {(() => {
                  const currentSession = bridgeSessionManager.loadSession();
                  const trimmedTextA = textA.trim();
                  const trimmedTextB = textB.trim();
                  
                  const hasChanges = !currentSession || 
                    currentSession.textA !== trimmedTextA ||
                    currentSession.textB !== trimmedTextB ||
                    currentSession.selectedModel !== selectedModel;
                  
                  if (hasChanges) {
                    return "⚠️ Clicking 'Generate Bridge' will start a new session with these values.";
                  } else {
                    return "✓ Continue with existing bridge session. Change values and click 'Generate Bridge' to start over.";
                  }
                })()}
              </p>
            </div>
          )}

          {/* Model Selection and Submit Button */}
          <div className={styles.submitSection}>
            <select 
              value={selectedModel} 
              onChange={(e) => setSelectedModel(e.target.value)}
              className={styles.modelSelect}
            >
              {models.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.name}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className={styles.submitButton}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Starting...' : 'Generate Bridge'}
            </button>
          </div>
        </form>

        <div className={styles.infoBox}>
          <h3>How Text Bridge Works:</h3>
          <ol>
            <li>Enter two completely different texts (50-1000 characters each)</li>
            <li>AI generates 9 intermediate variations using recursive midpoint blending</li>
            <li>Creates a smooth 11-position bridge from Text A to Text B</li>
            <li>Explore the full spectrum with an interactive slider</li>
          </ol>
          <p className={styles.infoNote}>
            <strong>Note:</strong> This uses recursive midpoint generation (not linear percentages) 
            for more natural blending between texts.
          </p>
        </div>
      </main>
    </div>
  );
}
