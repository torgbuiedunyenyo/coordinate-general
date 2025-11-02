import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import styles from '../styles/Bridge.module.css';
import { bridgeSessionManager } from '../utils/bridgeSessionManager';
import { buildBridgePrompt } from '../utils/bridgePromptBuilder';
import { 
  getRoundPositions, 
  getPositionDependencies, 
  getTotalPositionsUpToRound 
} from '../utils/bridgeGenerator';

export default function BridgeGenerate() {
  const router = useRouter();
  const [session, setSession] = useState(null);
  const [currentRound, setCurrentRound] = useState(0);
  const [totalGenerated, setTotalGenerated] = useState(0);
  const [canExplore, setCanExplore] = useState(false);
  const [error, setError] = useState(null);
  const [storageWarning, setStorageWarning] = useState(null);
  const [generationStatus, setGenerationStatus] = useState({});
  const isGeneratingRef = useRef(false);

  useEffect(() => {
    // Load session
    const loadedSession = bridgeSessionManager.loadSession();

    if (!loadedSession) {
      // No session, redirect to bridge setup
      router.push('/bridge-setup');
      return;
    }

    setSession(loadedSession);

    // Check for storage warning
    const warning = bridgeSessionManager.getStorageWarning();
    if (warning) {
      setStorageWarning(warning);
    }
    
    // Check existing generations
    const existingPositions = loadedSession.positions || {};
    const existingCount = Object.keys(existingPositions)
      .filter(pos => pos !== "0" && pos !== "10")
      .length;
    setTotalGenerated(existingCount);
    
    // Set generation status based on existing data
    const initialStatus = {};
    Object.keys(existingPositions).forEach(pos => {
      if (pos !== "0" && pos !== "10") {
        initialStatus[pos] = 'complete';
      }
    });
    setGenerationStatus(initialStatus);
    
    // Check if we can explore (after Round 1 completes)
    if (existingPositions['5']) {
      setCanExplore(true);
    }
    
    // Determine current round based on existing generations
    let maxRound = 0;
    for (let round = 1; round <= 4; round++) {
      const roundPositions = getRoundPositions(round);
      const roundComplete = roundPositions.every(pos => existingPositions[pos]);
      if (roundComplete) {
        maxRound = round;
      } else {
        break;
      }
    }
    setCurrentRound(maxRound);
    
    // Only start generation if there are missing positions
    const needsGeneration = existingCount < 9 && loadedSession.progress.status !== 'complete';
    
    if (!isGeneratingRef.current && needsGeneration) {
      isGeneratingRef.current = true;
      generateBridge(loadedSession);
    } else if (existingCount === 9) {
      // All positions generated, mark as complete
      bridgeSessionManager.updateProgress({ status: 'complete', currentRound: 4 });
    }
  }, []);

  const generateBridge = async (sessionData) => {
    try {
      bridgeSessionManager.updateProgress({ status: 'generating' });
      
      const existingPositions = sessionData.positions || {};
      const selectedModel = sessionData.selectedModel || 'haiku-4.5';

      // Generate each round in sequence
      for (let round = 1; round <= 4; round++) {
        const roundPositions = getRoundPositions(round);
        const missingPositions = roundPositions.filter(pos => !existingPositions[pos]);
        
        if (missingPositions.length > 0) {
          setCurrentRound(round);
          bridgeSessionManager.updateProgress({ currentRound: round });
          
          // Generate missing positions for this round
          await generateRound(round, sessionData, missingPositions);
          
          // Update existingPositions for next round
          const updatedSession = bridgeSessionManager.loadSession();
          Object.assign(existingPositions, updatedSession.positions);
          
          // Enable explore after Round 1 is complete
          if (round === 1 && bridgeSessionManager.hasPosition(5)) {
            setCanExplore(true);
          }
        }
      }

      bridgeSessionManager.updateProgress({ status: 'complete', currentRound: 4 });
      
    } catch (err) {
      console.error('Bridge generation error:', err);
      setError('An error occurred during generation. Some variations may be incomplete.');
      bridgeSessionManager.updateProgress({ status: 'error' });
    }
  };

  const generateRound = async (roundNumber, sessionData, positionsToGenerate) => {
    // Mark all as pending
    const newStatus = {};
    positionsToGenerate.forEach(pos => {
      newStatus[pos] = 'pending';
    });
    setGenerationStatus(prev => ({ ...prev, ...newStatus }));

    // Model-specific batch sizes
    const batchSize = sessionData.selectedModel === 'gemini-2.5-flash' ? 4 : 
                     sessionData.selectedModel === 'sonnet-4.5' ? 2 : 1;
    
    // Process positions in batches
    for (let i = 0; i < positionsToGenerate.length; i += batchSize) {
      const batch = positionsToGenerate.slice(i, i + batchSize);
      
      // Mark as generating
      const generatingStatus = {};
      batch.forEach(pos => {
        generatingStatus[pos] = 'generating';
      });
      setGenerationStatus(prev => ({ ...prev, ...generatingStatus }));

      // Generate all in parallel
      await Promise.all(
        batch.map(pos => generatePosition(pos, sessionData))
      );
      
      // Small delay between batches to avoid overloading
      if (i + batchSize < positionsToGenerate.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
  };

  const generatePosition = async (position, sessionData) => {
    const maxRetries = 3;
    let lastError;

    // Get dependencies for this position
    const [leftPos, rightPos] = getPositionDependencies(position);
    const textLeft = bridgeSessionManager.getPosition(leftPos);
    const textRight = bridgeSessionManager.getPosition(rightPos);

    if (!textLeft || !textRight) {
      console.error(`Missing dependencies for position ${position}: left=${leftPos}, right=${rightPos}`);
      setGenerationStatus(prev => ({ ...prev, [position]: 'error' }));
      return;
    }

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const response = await fetch('/api/generate-single', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            mode: 'bridge',
            textLeft,
            textRight,
            selectedModel: sessionData.selectedModel || 'haiku-4.5'
          })
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `API error: ${response.status}`);
        }

        const result = await response.json();
        
        // Store in sessionStorage
        bridgeSessionManager.updatePosition(position, result.text);
        
        // Update status
        setGenerationStatus(prev => ({ ...prev, [position]: 'complete' }));
        setTotalGenerated(prev => prev + 1);
        
        return result;

      } catch (error) {
        console.error(`Error generating position ${position} (attempt ${attempt + 1}):`, error);
        lastError = error;
        
        // Exponential backoff with model-specific delays
        if (attempt < maxRetries - 1) {
          const isOverloaded = error.message?.includes('Overloaded');
          const isGemini = sessionData.selectedModel === 'gemini-2.5-flash';
          const baseDelay = isOverloaded ? 
            (isGemini ? 1000 : 3000) :
            (isGemini ? 300 : 1000);
          const delay = baseDelay * Math.pow(2, attempt);
          console.log(`Retrying position ${position} after ${delay}ms delay...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    // All retries failed
    setGenerationStatus(prev => ({ ...prev, [position]: 'error' }));
    setTotalGenerated(prev => prev + 1);
    console.error(`Failed to generate position ${position} after ${maxRetries} attempts:`, lastError);
  };

  const getPositionStatus = (position) => {
    if (position === 0 || position === 10) return 'anchor';
    return generationStatus[position] || 'pending';
  };

  const getPositionColor = (status) => {
    switch (status) {
      case 'complete': return '#51cf66';
      case 'generating': return '#4c6ef5';
      case 'error': return '#ff6b6b';
      case 'anchor': return '#2C2C2C';
      default: return '#e9ecef';
    }
  };

  if (!session) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Loading...</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <Head>
        <title>Generating Bridge - Text Bridge</title>
        <meta name="description" content="Generating text bridge using AI" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className={styles.main}>
        <div className={styles.navigation}>
          <Link href="/bridge-setup" className={styles.navLink}>
            ← Bridge Setup
          </Link>
        </div>

        <h1 className={styles.title}>Generating Text Bridge</h1>
        
        <div className={styles.progressInfo}>
          <p className={styles.progressText}>
            Round: {currentRound} / 4
          </p>
          <p className={styles.progressText}>
            Progress: {totalGenerated} / 9 variations
          </p>
        </div>

        <div className={styles.progressBar}>
          <div 
            className={styles.progressFill}
            style={{ width: `${(totalGenerated / 9) * 100}%` }}
          />
        </div>

        {/* Visual Position Indicator */}
        <div className={styles.positionsContainer}>
          <div className={styles.positions}>
            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(pos => (
              <div
                key={pos}
                className={styles.positionSquare}
                style={{ backgroundColor: getPositionColor(getPositionStatus(pos)) }}
                title={`Position ${pos}: ${getPositionStatus(pos)}`}
              >
                <span className={styles.positionLabel}>{pos}</span>
              </div>
            ))}
          </div>
          
          <div className={styles.positionLabels}>
            <span className={styles.anchorLabel}>Text A</span>
            <span className={styles.anchorLabel}>Text B</span>
          </div>
        </div>

        {/* Round Breakdown */}
        <div className={styles.roundBreakdown}>
          <h3>Generation Rounds:</h3>
          <div className={styles.rounds}>
            <div className={`${styles.round} ${currentRound >= 1 ? styles.roundComplete : ''}`}>
              <strong>Round 1:</strong> Position 5 (center)
            </div>
            <div className={`${styles.round} ${currentRound >= 2 ? styles.roundComplete : ''}`}>
              <strong>Round 2:</strong> Positions 2, 7 (quarters)
            </div>
            <div className={`${styles.round} ${currentRound >= 3 ? styles.roundComplete : ''}`}>
              <strong>Round 3:</strong> Positions 1, 3, 6, 8 (eighths)
            </div>
            <div className={`${styles.round} ${currentRound >= 4 ? styles.roundComplete : ''}`}>
              <strong>Round 4:</strong> Positions 4, 9 (final gaps)
            </div>
          </div>
        </div>

        {error && (
          <div className={styles.errorBox}>
            {error}
          </div>
        )}

        {storageWarning && (
          <div className={styles.warningBox}>
            ⚠️ {storageWarning}
          </div>
        )}

        {canExplore && !error && (
          <div className={styles.exploreSection}>
            <p className={styles.exploreText}>
              Ready to explore! You can start exploring while generation continues.
            </p>
            <button
              onClick={() => router.push('/bridge-explore')}
              className={styles.exploreButton}
            >
              Start Exploring Bridge
            </button>
          </div>
        )}

        {totalGenerated === 9 && (
          <div className={styles.completeSection}>
            <h2 className={styles.completeTitle}>✓ Bridge Complete!</h2>
            <p className={styles.completeText}>
              All 11 positions have been generated.
            </p>
            <button
              onClick={() => router.push('/bridge-explore')}
              className={styles.exploreButton}
            >
              Explore Your Bridge
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
