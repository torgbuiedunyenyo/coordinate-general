import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import styles from '../styles/Setup.module.css';
import { sessionManager } from '../utils/sessionManager';
import { validatePromptInputs } from '../utils/promptBuilder';

export default function Setup() {
  const router = useRouter();
  const [text, setText] = useState('');
  const [selectedModel, setSelectedModel] = useState('haiku-4.5'); // Track selected AI model
  const [adjectives, setAdjectives] = useState({
    yPositive: '',
    yNegative: '',
    xPositive: '',
    xNegative: ''
  });
  const [errors, setErrors] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasExistingSession, setHasExistingSession] = useState(false);
  const [storageWarning, setStorageWarning] = useState(null);

  // Model configurations
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

  // Load existing session data on mount to pre-fill the form
  useEffect(() => {
    const session = sessionManager.loadSession();
    if (session) {
      // Pre-fill form with existing session values
      setText(session.originalText || '');
      setAdjectives(session.adjectives || {
        yPositive: '',
        yNegative: '',
        xPositive: '',
        xNegative: ''
      });
      setSelectedModel(session.selectedModel || 'haiku-4.5'); // Load saved model
      setHasExistingSession(true);
    }

    // Check for storage warning
    const warning = sessionManager.getStorageWarning();
    if (warning) {
      setStorageWarning(warning);
    }
  }, []);

  const handleAdjectiveChange = (key, value) => {
    setAdjectives(prev => ({ ...prev, [key]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Validate inputs
    const validationErrors = validatePromptInputs(text, adjectives);
    
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }

    setErrors([]);
    setIsSubmitting(true);

    // Check if we need to reinitialize the session
    const currentSession = sessionManager.loadSession();
    const trimmedText = text.trim();
    const trimmedAdjectives = {
      yPositive: adjectives.yPositive.trim(),
      yNegative: adjectives.yNegative.trim(),
      xPositive: adjectives.xPositive.trim(),
      xNegative: adjectives.xNegative.trim()
    };

    // Only reinitialize if the text, adjectives, or model have changed
    const hasChanges = !currentSession || 
      currentSession.originalText !== trimmedText ||
      JSON.stringify(currentSession.adjectives) !== JSON.stringify(trimmedAdjectives) ||
      currentSession.selectedModel !== selectedModel;

    if (hasChanges) {
      // Initialize new session with the current form values and selected model
      sessionManager.initSession(trimmedText, trimmedAdjectives, selectedModel);
    }

    // Navigate to generation page
    router.push('/generate');
  };

  const charCount = text.length;
  const charCountColor = charCount < 50 ? '#dc3545' : charCount > 1000 ? '#dc3545' : '#28a745';

  return (
    <div className={styles.container}>
      <Head>
        <title>Setup - Coordinate Plane Text Transformer</title>
        <meta name="description" content="Transform your text along two dimensions of style and tone" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className={styles.main}>
        <div className={styles.navigation}>
          <Link href="/bridge-setup" className={styles.navLink}>
            Try Text Bridge →
          </Link>
        </div>
        
        <h1 className={styles.title}>Coordinate Plane Text Transformer</h1>
        <p className={styles.description}>
          Transform your text along two dimensions of style and tone.
        </p>

        <form onSubmit={handleSubmit} className={styles.form}>
          {/* Text Input */}
          <div className={styles.formGroup}>
            <label htmlFor="text" className={styles.label}>
              Your Text
              <span className={styles.charCount} style={{ color: charCountColor }}>
                {charCount}/1000 characters
              </span>
            </label>
            <textarea
              id="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              className={styles.textarea}
              placeholder="Enter your text here (50-1000 characters)..."
              rows={8}
              maxLength={1000}
            />
          </div>

          {/* Adjective Inputs */}
          <div className={styles.adjectivesGrid}>
            <div className={styles.formGroup}>
              <label htmlFor="yPositive" className={styles.label}>
                Y-Axis Positive (Top)
              </label>
              <input
                id="yPositive"
                type="text"
                value={adjectives.yPositive}
                onChange={(e) => handleAdjectiveChange('yPositive', e.target.value)}
                className={styles.input}
                placeholder="e.g., Ominous"
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="yNegative" className={styles.label}>
                Y-Axis Negative (Bottom)
              </label>
              <input
                id="yNegative"
                type="text"
                value={adjectives.yNegative}
                onChange={(e) => handleAdjectiveChange('yNegative', e.target.value)}
                className={styles.input}
                placeholder="e.g., Auspicious"
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="xPositive" className={styles.label}>
                X-Axis Positive (Right)
              </label>
              <input
                id="xPositive"
                type="text"
                value={adjectives.xPositive}
                onChange={(e) => handleAdjectiveChange('xPositive', e.target.value)}
                className={styles.input}
                placeholder="e.g., Metaphorical"
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="xNegative" className={styles.label}>
                X-Axis Negative (Left)
              </label>
              <input
                id="xNegative"
                type="text"
                value={adjectives.xNegative}
                onChange={(e) => handleAdjectiveChange('xNegative', e.target.value)}
                className={styles.input}
                placeholder="e.g., Literal"
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
            <div className={styles.errorContainer} style={{ backgroundColor: '#fff3cd', borderColor: '#ffc107', color: '#856404' }}>
              <p className={styles.error} style={{ color: '#856404' }}>
                ⚠️ {storageWarning}
              </p>
            </div>
          )}

          {/* Session Status Info */}
          {hasExistingSession && (
            <div className={styles.sessionInfo}>
              <p>
                {(() => {
                  const currentSession = sessionManager.loadSession();
                  const trimmedText = text.trim();
                  const trimmedAdjectives = {
                    yPositive: adjectives.yPositive.trim(),
                    yNegative: adjectives.yNegative.trim(),
                    xPositive: adjectives.xPositive.trim(),
                    xNegative: adjectives.xNegative.trim()
                  };
                  
                  const hasChanges = !currentSession || 
                    currentSession.originalText !== trimmedText ||
                    JSON.stringify(currentSession.adjectives) !== JSON.stringify(trimmedAdjectives) ||
                    currentSession.selectedModel !== selectedModel;
                  
                  if (hasChanges) {
                    return "⚠️ Clicking 'Generate Variations' will start a new session with these values.";
                  } else {
                    return "✓ Continue with existing session. Change values and click 'Generate Variations' to start over.";
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
              {isSubmitting ? 'Starting...' : 'Generate Variations'}
            </button>
          </div>
        </form>

        <div className={styles.infoBox}>
          <h3>How it works:</h3>
          <ol>
            <li>Enter your text (50-1000 characters)</li>
            <li>Choose adjectives for each axis to define transformation directions</li>
            <li>We'll generate 121 variations using AI (takes 2-5 minutes)</li>
            <li>Explore by dragging the cursor around the coordinate plane</li>
          </ol>
        </div>
      </main>
    </div>
  );
}
