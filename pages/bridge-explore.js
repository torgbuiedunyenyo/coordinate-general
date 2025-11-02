import React, { useRef, useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import styles from '../styles/Bridge.module.css';
import { bridgeSessionManager } from '../utils/bridgeSessionManager';
import { buildBridgePrompt } from '../utils/bridgePromptBuilder';
import { getPositionDependencies } from '../utils/bridgeGenerator';

export default function BridgeExplore() {
  const router = useRouter();
  const sliderRef = useRef(null);
  const [currentPosition, setCurrentPosition] = useState(5); // Start at center
  const [currentText, setCurrentText] = useState('');
  const [session, setSession] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [storageWarning, setStorageWarning] = useState(null);

  useEffect(() => {
    // Load session
    const loadedSession = bridgeSessionManager.loadSession();

    if (!loadedSession) {
      router.push('/bridge-setup');
      return;
    }

    setSession(loadedSession);

    // Load initial text (position 5 or fallback to position 0)
    const initialText = loadedSession.positions['5'] || loadedSession.positions['0'] || 'Generating...';
    setCurrentText(initialText);

    // Check for storage warning
    const warning = bridgeSessionManager.getStorageWarning();
    if (warning) {
      setStorageWarning(warning);
    }
  }, [router]);

  const updateText = async (position) => {
    if (!session) return;

    // Preserve scroll position
    const scrollY = window.scrollY;
    const scrollX = window.scrollX;

    // Check if we have this position
    if (session.positions[position]) {
      setCurrentText(session.positions[position]);
      setIsGenerating(false);

      // Restore scroll position
      requestAnimationFrame(() => {
        window.scrollTo(scrollX, scrollY);
      });
      return;
    }

    // Need to generate on-demand
    if (position !== 0 && position !== 10) {
      setCurrentText('Generating this variation...');
      setIsGenerating(true);

      try {
        // Get dependencies for this position
        const deps = getPositionDependencies(position);
        if (!deps) {
          throw new Error(`Invalid position: ${position}`);
        }

        const [leftPos, rightPos] = deps;
        const textLeft = session.positions[leftPos];
        const textRight = session.positions[rightPos];

        if (!textLeft || !textRight) {
          throw new Error(`Dependencies not available for position ${position}`);
        }

        const response = await fetch('/api/generate-single', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            mode: 'bridge',
            textLeft,
            textRight,
            selectedModel: session.selectedModel || 'haiku-4.5'
          })
        });

        if (!response.ok) {
          throw new Error('Generation failed');
        }

        const result = await response.json();
        bridgeSessionManager.updatePosition(position, result.text);

        // Update local session state
        const updatedSession = bridgeSessionManager.loadSession();
        setSession(updatedSession);
        setCurrentText(result.text);

        // Restore scroll position
        requestAnimationFrame(() => {
          window.scrollTo(scrollX, scrollY);
        });

      } catch (error) {
        console.error('Error generating position:', error);
        setCurrentText('Error generating this variation. Try another position.');
      } finally {
        setIsGenerating(false);
        // Final scroll restore
        requestAnimationFrame(() => {
          window.scrollTo(scrollX, scrollY);
        });
      }
    }
  };

  const handleSliderChange = (e) => {
    const newPosition = parseInt(e.target.value);
    setCurrentPosition(newPosition);
    updateText(newPosition);
  };

  const handleKeyDown = (e) => {
    // Prevent default arrow key behavior to avoid double-jumping
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      
      if (e.key === 'ArrowLeft' && currentPosition > 0) {
        const newPosition = currentPosition - 1;
        setCurrentPosition(newPosition);
        updateText(newPosition);
      } else if (e.key === 'ArrowRight' && currentPosition < 10) {
        const newPosition = currentPosition + 1;
        setCurrentPosition(newPosition);
        updateText(newPosition);
      }
    }
  };

  const handleStartOver = () => {
    if (confirm('Are you sure you want to start over? This will clear the current bridge.')) {
      bridgeSessionManager.clearSession();
      router.push('/bridge-setup');
    }
  };

  const getPositionStatus = (pos) => {
    if (!session) return 'pending';
    return session.positions[pos] ? 'complete' : 'pending';
  };

  if (!session) {
    return (
      <div className={styles.container}>
        <div className={styles.loadingContainer}>Loading...</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <Head>
        <title>Explore Bridge - Text Bridge</title>
        <meta name="description" content="Explore text bridge variations" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className={styles.main}>
        {/* Feature Navigation */}
        <nav className={styles.featureNav}>
          <Link href="/setup" className={styles.navLink}>
            Coordinate Plane
          </Link>
          <span className={styles.separator}>|</span>
          <Link href="/bridge-setup" className={`${styles.navLink} ${styles.active}`}>
            Bridge
          </Link>
          <span className={styles.separator}>|</span>
          <Link href="/filters" className={styles.navLink}>
            Filters
          </Link>
        </nav>
        
        <div className={styles.navigation}>
          <Link href="/bridge-setup" className={styles.navLink}>
            ← Bridge Setup
          </Link>
          <Link href="/setup" className={styles.navLink}>
            Coordinate Plane →
          </Link>
        </div>

        <div className={styles.messageDisplayContainer}>
          <div className={styles.messageDisplayWrapper}>
            <div className={styles.messageDisplay}>
              {isGenerating ? (
                <div className={styles.generatingIndicator}>
                  <div className={styles.spinner}></div>
                  <p>Generating...</p>
                </div>
              ) : (
                currentText || "Move the slider to explore variations"
              )}
            </div>
          </div>
        </div>

        {storageWarning && (
          <div className={styles.warningBox}>
            ⚠️ {storageWarning}
          </div>
        )}

        <div className={styles.sliderContainer}>
          <div className={styles.sliderLabels}>
            <span className={styles.sliderLabel}>Text A</span>
            <span className={styles.sliderLabel}>Text B</span>
          </div>
          
          <div className={styles.sliderWrapper}>
            <div className={styles.sliderGradient}></div>
            <input
              ref={sliderRef}
              type="range"
              min="0"
              max="10"
              value={currentPosition}
              onChange={handleSliderChange}
              onKeyDown={handleKeyDown}
              className={styles.slider}
              aria-label="Position slider"
            />
            <div className={styles.sliderTicks}>
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(pos => (
                <div 
                  key={pos} 
                  className={`${styles.tick} ${getPositionStatus(pos) === 'complete' ? styles.tickComplete : ''}`}
                >
                  {pos === currentPosition && <div className={styles.tickActive}></div>}
                </div>
              ))}
            </div>
          </div>

          <div className={styles.positionIndicator}>
            Position: {currentPosition} / 10
          </div>
        </div>

        <div className={styles.controlsContainer}>
          <button onClick={handleStartOver} className={styles.startOverButton}>
            Start Over
          </button>
          <div className={styles.instructions}>
            Use the slider or arrow keys to explore the bridge between texts
          </div>
        </div>

        <div className={styles.infoBox}>
          <h3>Bridge Positions:</h3>
          <ul className={styles.positionList}>
            <li><strong>0:</strong> Text A (your starting text)</li>
            <li><strong>5:</strong> Perfect midpoint blend</li>
            <li><strong>10:</strong> Text B (your ending text)</li>
            <li><strong>1-9:</strong> AI-generated transitions</li>
          </ul>
        </div>
      </main>
    </div>
  );
}
