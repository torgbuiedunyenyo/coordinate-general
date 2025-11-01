import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import styles from '../styles/Generate.module.css';
import { sessionManager } from '../utils/sessionManager';
import { getRingCoordinates, getRingNumber } from '../utils/ringGenerator';

export default function Generate() {
  const router = useRouter();
  const [session, setSession] = useState(null);
  const [progress, setProgress] = useState(0);
  const [currentRing, setCurrentRing] = useState(0);
  const [canExplore, setCanExplore] = useState(false);
  const [error, setError] = useState(null);
  const [generationStatus, setGenerationStatus] = useState({}); // coord -> 'pending'|'generating'|'complete'|'error'
  const isGeneratingRef = useRef(false);
  const sessionIdRef = useRef(null);

  useEffect(() => {
    // Load session
    const loadedSession = sessionManager.loadSession();
    
    if (!loadedSession) {
      // No session, redirect to setup
      router.push('/setup');
      return;
    }

    setSession(loadedSession);
    
    // Create a unique session ID based on the input data
    const newSessionId = JSON.stringify({
      text: loadedSession.originalText,
      adjectives: loadedSession.adjectives
    });
    
    // Store the session ID for tracking
    if (!sessionIdRef.current) {
      sessionIdRef.current = newSessionId;
    }
    
    // Check existing generations and set initial state
    const existingGenerations = loadedSession.generations || {};
    const existingCount = Object.keys(existingGenerations).length;
    setProgress(existingCount);
    
    // Set generation status based on existing data
    const initialStatus = {};
    Object.keys(existingGenerations).forEach(coord => {
      initialStatus[coord] = 'complete';
    });
    setGenerationStatus(initialStatus);
    
    // Check if center point exists to enable explore
    if (existingGenerations['0,0']) {
      setCanExplore(true);
    }
    
    // Determine current ring based on existing generations
    let maxRing = 0;
    for (let ring = 0; ring <= 5; ring++) {
      const ringCoords = getRingCoordinates(ring);
      const ringComplete = ringCoords.every(coord => existingGenerations[coord]);
      if (ringComplete) {
        maxRing = ring + 1;
      } else {
        break;
      }
    }
    setCurrentRing(Math.min(maxRing, 5));
    
    // Only start generation if there are missing coordinates and not already generating
    const totalCoordinates = 121; // 11x11 grid
    const needsGeneration = existingCount < totalCoordinates && loadedSession.progress.status !== 'complete';
    
    if (!isGeneratingRef.current && needsGeneration) {
      isGeneratingRef.current = true;
      continueGeneration(loadedSession);
    } else if (existingCount === totalCoordinates) {
      // All coordinates generated, mark as complete
      sessionManager.updateProgress({ status: 'complete', currentRing: 5 });
    }
  }, []);

  const continueGeneration = async (sessionData) => {
    try {
      sessionManager.updateProgress({ status: 'generating' });
      
      const existingGenerations = sessionData.generations || {};

      // Check and generate each ring
      for (let ring = 0; ring <= 5; ring++) {
        const ringCoords = getRingCoordinates(ring);
        const missingCoords = ringCoords.filter(coord => !existingGenerations[coord]);
        
        if (missingCoords.length > 0) {
          // Generate missing coordinates for this ring
          await generateRing(ring, sessionData, missingCoords);
          
          // Enable explore after Ring 0 is complete
          if (ring === 0 && sessionManager.hasGeneration('0,0')) {
            setCanExplore(true);
          }
        }
        
        // Update current ring display
        if (ring < 5) {
          setCurrentRing(ring + 1);
        }
      }

      sessionManager.updateProgress({ status: 'complete', currentRing: 5 });
      
    } catch (err) {
      console.error('Generation error:', err);
      setError('An error occurred during generation. Some variations may be incomplete.');
      sessionManager.updateProgress({ status: 'error' });
    }
  };

  const generateRing = async (ringNumber, sessionData, coordinatesToGenerate = null) => {
    // Use provided coordinates or get all coordinates for the ring
    const coordinates = coordinatesToGenerate || getRingCoordinates(ringNumber);
    
    // Skip if no coordinates to generate
    if (coordinates.length === 0) {
      return;
    }
    
    // Mark all as pending
    const newStatus = {};
    coordinates.forEach(coord => {
      newStatus[coord] = 'pending';
    });
    setGenerationStatus(prev => ({ ...prev, ...newStatus }));

    // Process in batches of 2 (parallel requests) - reduced to avoid overloading API
    const batchSize = 2;
    
    for (let i = 0; i < coordinates.length; i += batchSize) {
      const batch = coordinates.slice(i, i + batchSize);
      
      // Mark as generating
      const generatingStatus = {};
      batch.forEach(coord => {
        generatingStatus[coord] = 'generating';
      });
      setGenerationStatus(prev => ({ ...prev, ...generatingStatus }));

      // Generate all in parallel
      await Promise.all(
        batch.map(coord => generateCoordinate(coord, sessionData))
      );

      // Delay between batches to avoid overloading the API
      if (i + batchSize < coordinates.length) {
        await new Promise(resolve => setTimeout(resolve, 2000)); // Increased to 2 seconds
      }
    }
  };

  const generateCoordinate = async (coordinate, sessionData) => {
    const maxRetries = 3;
    let lastError;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const response = await fetch('/api/generate-single', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text: sessionData.originalText,
            adjectives: sessionData.adjectives,
            coordinate
          })
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `API error: ${response.status}`);
        }

        const result = await response.json();
        
        // Store in sessionStorage
        sessionManager.updateGeneration(coordinate, result.text);
        
        // Update status
        setGenerationStatus(prev => ({ ...prev, [coordinate]: 'complete' }));
        setProgress(prev => prev + 1);
        
        return result;

      } catch (error) {
        console.error(`Error generating ${coordinate} (attempt ${attempt + 1}):`, error);
        lastError = error;
        
        // Exponential backoff with longer delay for overloaded errors
        if (attempt < maxRetries - 1) {
          const isOverloaded = error.message?.includes('Overloaded');
          const baseDelay = isOverloaded ? 5000 : 1000; // 5 seconds base for overloaded
          const delay = baseDelay * Math.pow(2, attempt);
          console.log(`Retrying ${coordinate} after ${delay}ms delay...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    // All retries failed
    setGenerationStatus(prev => ({ ...prev, [coordinate]: 'error' }));
    setProgress(prev => prev + 1);
    console.error(`Failed to generate ${coordinate} after ${maxRetries} attempts:`, lastError);
  };

  const getSquareStatus = (x, y) => {
    const coord = `${x},${y}`;
    return generationStatus[coord] || 'pending';
  };

  const getSquareColor = (status) => {
    switch (status) {
      case 'complete': return '#51cf66';
      case 'generating': return '#4c6ef5';
      case 'error': return '#ff6b6b';
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
        <title>Generating Variations - Coordinate Plane</title>
        <meta name="description" content="Generating text variations using AI" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className={styles.main}>
        <h1 className={styles.title}>Generating Text Variations</h1>
        
        <div className={styles.progressInfo}>
          <p className={styles.progressText}>
            Progress: {progress} / 121 variations
          </p>
          <p className={styles.ringText}>
            Current Ring: {currentRing} / 5
          </p>
        </div>

        <div className={styles.progressBar}>
          <div 
            className={styles.progressFill}
            style={{ width: `${(progress / 121) * 100}%` }}
          />
        </div>

        {/* Visual Grid */}
        <div className={styles.gridContainer}>
          <div className={styles.grid}>
            {Array.from({ length: 11 }, (_, row) => (
              <div key={row} className={styles.gridRow}>
                {Array.from({ length: 11 }, (_, col) => {
                  const x = col - 5;
                  const y = 5 - row;
                  const status = getSquareStatus(x, y);
                  const color = getSquareColor(status);
                  
                  return (
                    <div
                      key={`${x},${y}`}
                      className={styles.gridSquare}
                      style={{ backgroundColor: color }}
                      title={`(${x}, ${y}): ${status}`}
                    />
                  );
                })}
              </div>
            ))}
          </div>
          
          <div className={styles.legend}>
            <div className={styles.legendItem}>
              <div className={styles.legendColor} style={{ backgroundColor: '#e9ecef' }} />
              <span>Pending</span>
            </div>
            <div className={styles.legendItem}>
              <div className={styles.legendColor} style={{ backgroundColor: '#4c6ef5' }} />
              <span>Generating</span>
            </div>
            <div className={styles.legendItem}>
              <div className={styles.legendColor} style={{ backgroundColor: '#51cf66' }} />
              <span>Complete</span>
            </div>
            <div className={styles.legendItem}>
              <div className={styles.legendColor} style={{ backgroundColor: '#ff6b6b' }} />
              <span>Error</span>
            </div>
          </div>
        </div>

        {error && (
          <div className={styles.errorBox}>
            {error}
          </div>
        )}

        {canExplore && !error && (
          <div className={styles.exploreSection}>
            <p className={styles.exploreText}>
              Center point generated! You can start exploring now while the rest generate in the background.
            </p>
            <button
              onClick={() => router.push('/explore')}
              className={styles.exploreButton}
            >
              Start Exploring
            </button>
          </div>
        )}

        {progress === 121 && (
          <div className={styles.completeSection}>
            <h2 className={styles.completeTitle}>✓ Generation Complete!</h2>
            <p className={styles.completeText}>
              All 121 variations have been generated.
            </p>
            <button
              onClick={() => router.push('/explore')}
              className={styles.exploreButton}
            >
              Explore Your Variations
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
