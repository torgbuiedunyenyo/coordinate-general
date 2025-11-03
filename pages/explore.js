import React, { useRef, useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import styles from '../styles/Home.module.css';
import Footer from '../public/Footer';
import { sessionManager } from '../utils/sessionManager';
import { useMobileDetect } from '../utils/mobileDetection';
import { requireAuth } from '../utils/authManager';

export default function Explore() {
  const router = useRouter();
  const coordinatePlaneRef = useRef(null);
  const circleRef = useRef(null);
  const debounceTimerRef = useRef(null);
  const [currentSquare, setCurrentSquare] = useState("0,0");
  const [isDragging, setIsDragging] = useState(false);
  const [currentText, setCurrentText] = useState('');
  const [session, setSession] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [storageWarning, setStorageWarning] = useState(null);
  const { isMobile, isTablet } = useMobileDetect();
  const [showMobileControls, setShowMobileControls] = useState(false);

  useEffect(() => {
    // Check authentication first
    requireAuth();
    
    // Load session
    const loadedSession = sessionManager.loadSession();

    if (!loadedSession) {
      router.push('/setup');
      return;
    }

    setSession(loadedSession);

    // Load initial text
    const initialText = loadedSession.generations['0,0'] || 'Generating...';
    setCurrentText(initialText);

    // Check for storage warning
    const warning = sessionManager.getStorageWarning();
    if (warning) {
      setStorageWarning(warning);
    }
  }, [router]);

  useEffect(() => {
    if (!session) return;

    const coordinatePlane = coordinatePlaneRef.current;
    const circle = circleRef.current;
    if (!coordinatePlane || !circle) return;

    const squareSize = 300 / 11;

    const setCirclePosition = (col, row) => {
      const x = (col + 5) * squareSize + squareSize / 2 - circle.offsetWidth / 2;
      const y = (5 - row) * squareSize + squareSize / 2 - circle.offsetHeight / 2;
      circle.style.transform = `translate(${x}px, ${y}px)`;
    };

    // Initialize circle position
    const [initCol, initRow] = currentSquare.split(",").map(Number);
    setCirclePosition(initCol, initRow);

    const startDragging = (e) => {
      e.preventDefault();
      setIsDragging(true);
    };

    const drag = (e) => {
      if (!isDragging) return;

      const coordinatePlaneRect = coordinatePlane.getBoundingClientRect();
      const x = e.clientX - coordinatePlaneRect.left;
      const y = e.clientY - coordinatePlaneRect.top;

      const col = Math.floor(x / squareSize) - 5;
      const row = 5 - Math.floor(y / squareSize);

      if (col < -5 || col > 5 || row < -5 || row > 5) return;

      const newCoord = `${col},${row}`;
      if (newCoord !== currentSquare) {
        setCurrentSquare(newCoord);
        debouncedUpdateText(newCoord);
        setCirclePosition(col, row);
      }
    };

    const stopDragging = () => {
      setIsDragging(false);
    };

    const moveWithArrowKeys = (e) => {
      const [currentCol, currentRow] = currentSquare.split(",").map(Number);
      let newCol = currentCol;
      let newRow = currentRow;

      switch (e.key) {
        case 'ArrowUp':
          if (currentRow < 5) newRow = currentRow + 1;
          break;
        case 'ArrowDown':
          if (currentRow > -5) newRow = currentRow - 1;
          break;
        case 'ArrowLeft':
          if (currentCol > -5) newCol = currentCol - 1;
          break;
        case 'ArrowRight':
          if (currentCol < 5) newCol = currentCol + 1;
          break;
        default:
          return;
      }

      const newCoord = `${newCol},${newRow}`;
      setCurrentSquare(newCoord);
      updateText(newCoord);
      setCirclePosition(newCol, newRow);
    };

    const moveWithClick = (e) => {
      const coordinatePlaneRect = coordinatePlane.getBoundingClientRect();
      const x = e.clientX - coordinatePlaneRect.left;
      const y = e.clientY - coordinatePlaneRect.top;

      const col = Math.floor(x / squareSize) - 5;
      const row = 5 - Math.floor(y / squareSize);

      if (col < -5 || col > 5 || row < -5 || row > 5) return;

      const newCoord = `${col},${row}`;
      setCurrentSquare(newCoord);
      updateText(newCoord);
      setCirclePosition(col, row);
    };

    // Touch events for mobile
    const handleTouchStart = (e) => {
      e.preventDefault();
      setIsDragging(true);
    };

    const handleTouchMove = (e) => {
      if (!isDragging) return;

      const touch = e.touches[0];
      const coordinatePlaneRect = coordinatePlane.getBoundingClientRect();
      const x = touch.clientX - coordinatePlaneRect.left;
      const y = touch.clientY - coordinatePlaneRect.top;

      const col = Math.floor(x / squareSize) - 5;
      const row = 5 - Math.floor(y / squareSize);

      if (col < -5 || col > 5 || row < -5 || row > 5) return;

      const newCoord = `${col},${row}`;
      if (newCoord !== currentSquare) {
        setCurrentSquare(newCoord);
        debouncedUpdateText(newCoord);
        setCirclePosition(col, row);
      }
    };

    const handleTouchEnd = () => {
      setIsDragging(false);
    };

    // Add event listeners
    circle.addEventListener('mousedown', startDragging);
    circle.addEventListener('touchstart', handleTouchStart);
    document.addEventListener('mousemove', drag);
    document.addEventListener('touchmove', handleTouchMove);
    document.addEventListener('mouseup', stopDragging);
    document.addEventListener('touchend', handleTouchEnd);
    document.addEventListener('keydown', moveWithArrowKeys);
    coordinatePlane.addEventListener('click', moveWithClick);

    return () => {
      circle.removeEventListener('mousedown', startDragging);
      circle.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('mousemove', drag);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('mouseup', stopDragging);
      document.removeEventListener('touchend', handleTouchEnd);
      document.removeEventListener('keydown', moveWithArrowKeys);
      coordinatePlane.removeEventListener('click', moveWithClick);
    };
  }, [currentSquare, isDragging, session]);

  const updateText = async (coordinate, shouldPreload = true) => {
    if (!session) return;

    // Preserve scroll position before updating
    const scrollY = window.scrollY;
    const scrollX = window.scrollX;

    // Check if we have this generation
    if (session.generations[coordinate]) {
      setCurrentText(session.generations[coordinate]);
      setIsGenerating(false); // Reset loading state when showing existing text

      // Restore scroll position after React re-render
      requestAnimationFrame(() => {
        window.scrollTo(scrollX, scrollY);
      });

      // Preload adjacent coordinates in background
      if (shouldPreload) {
        preloadAdjacentCoordinates(coordinate);
      }
      return;
    }

    // Need to generate on-demand
    setCurrentText('Generating this variation...');
    setIsGenerating(true);

    try {
      const response = await fetch('/api/generate-single', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: session.originalText,
          adjectives: session.adjectives,
          coordinate
        })
      });

      if (!response.ok) {
        throw new Error('Generation failed');
      }

      const result = await response.json();
      sessionManager.updateGeneration(coordinate, result.text);

      // Update local session state
      const updatedSession = sessionManager.loadSession();
      setSession(updatedSession);
      setCurrentText(result.text);

      // Restore scroll position after React re-render
      requestAnimationFrame(() => {
        window.scrollTo(scrollX, scrollY);
      });

      // Preload adjacent coordinates in background
      if (shouldPreload) {
        preloadAdjacentCoordinates(coordinate);
      }

    } catch (error) {
      console.error('Error generating coordinate:', error);
      setCurrentText('Error generating this variation. Try another coordinate.');
    } finally {
      setIsGenerating(false);
      // Final scroll position restore
      requestAnimationFrame(() => {
        window.scrollTo(scrollX, scrollY);
      });
    }
  };

  // Debounced version of updateText for drag operations
  const debouncedUpdateText = (coordinate) => {
    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Set new timer
    debounceTimerRef.current = setTimeout(() => {
      updateText(coordinate);
    }, 150); // 150ms debounce
  };

  // Preload adjacent coordinates in the background
  const preloadAdjacentCoordinates = (coordinate) => {
    const [x, y] = coordinate.split(',').map(Number);

    // Get 4 adjacent coordinates (up, down, left, right)
    const adjacentCoords = [
      `${x},${y + 1}`, // up
      `${x},${y - 1}`, // down
      `${x - 1},${y}`, // left
      `${x + 1},${y}`, // right
    ];

    // Filter to valid coordinates within the grid
    const validCoords = adjacentCoords.filter(coord => {
      const [cx, cy] = coord.split(',').map(Number);
      return cx >= -5 && cx <= 5 && cy >= -5 && cy <= 5;
    });

    // Preload missing coordinates in background (without blocking UI)
    validCoords.forEach(coord => {
      if (!session.generations[coord]) {
        // Generate in background without showing loading state
        fetch('/api/generate-single', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text: session.originalText,
            adjectives: session.adjectives,
            coordinate: coord
          })
        })
        .then(response => response.json())
        .then(result => {
          sessionManager.updateGeneration(coord, result.text);
          // Update local session state silently
          const updatedSession = sessionManager.loadSession();
          setSession(updatedSession);
        })
        .catch(error => {
          // Silently fail for background preloading
          console.log(`Background preload failed for ${coord}:`, error.message);
        });
      }
    });
  };

  const handleStartOver = () => {
    if (confirm('Are you sure you want to start over? This will clear all generated variations.')) {
      sessionManager.clearSession();
      router.push('/setup');
    }
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
        <title>Explore - Coordinate Plane Text Transformer</title>
        <meta name="description" content="Explore AI-generated text variations" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className={styles.main}>
        {/* Feature Navigation */}
        <nav className={styles.featureNav}>
          <Link href="/setup" className={`${styles.navLink} ${styles.active}`}>
            Coordinate Plane
          </Link>
          <span className={styles.separator}>|</span>
          <Link href="/bridge-setup" className={styles.navLink}>
            Bridge
          </Link>
          <span className={styles.separator}>|</span>
          <Link href="/filters" className={styles.navLink}>
            Filters
          </Link>
        </nav>
        
        <div className={styles.navigation}>
          <Link href="/setup" className={styles.navLink}>
            ← Setup
          </Link>
          <Link href="/bridge-setup" className={styles.navLink}>
            Text Bridge →
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
                currentText || "Move the cursor to see variations"
              )}
            </div>
          </div>
        </div>

        {storageWarning && (
          <div style={{
            backgroundColor: '#fff3cd',
            border: '1px solid #ffc107',
            borderRadius: '8px',
            padding: '1rem',
            margin: '1rem 0',
            color: '#856404',
            textAlign: 'center'
          }}>
            ⚠️ {storageWarning}
          </div>
        )}

        <div className={styles.coordinatePlaneContainer}>
          <div className={styles.coordinatePlane} ref={coordinatePlaneRef}>
            {Array.from({ length: 121 }, (_, i) => (
              <div key={i} className={styles.square}></div>
            ))}
            <div className={styles.circle} ref={circleRef}></div>
            <div className={styles.arrowX}></div>
            <div className={styles.arrowY}></div>
            <div className={`${styles.label} ${styles['label-top']}`}>
              More {session.adjectives.yPositive}
            </div>
            <div className={`${styles.label} ${styles['label-bottom']}`}>
              More {session.adjectives.yNegative}
            </div>
            <div className={`${styles.label} ${styles['label-left']}`}>
              More {session.adjectives.xNegative}
            </div>
            <div className={`${styles.label} ${styles['label-right']}`}>
              More {session.adjectives.xPositive}
            </div>
          </div>
        </div>

        <div className={styles.controlsContainer}>
          <button onClick={handleStartOver} className={styles.startOverButton}>
            Start Over
          </button>
          <p className={styles.coordinateDisplay}>
            Current Position: ({currentSquare})
          </p>
        </div>

        {/* Mobile Navigation Controls */}
        {(isMobile || isTablet) && (
          <div className={styles.mobileControls}>
            <button 
              className={styles.toggleControlsBtn}
              onClick={() => setShowMobileControls(!showMobileControls)}
            >
              {showMobileControls ? 'Hide' : 'Show'} Navigation Helper
            </button>
            
            {showMobileControls && (
              <div className={styles.mobileNavSection}>
                <div className={styles.mobileNavPad}>
                  <button 
                    className={`${styles.navButton} ${styles.navUp}`}
                    onClick={() => {
                      const [col, row] = currentSquare.split(",").map(Number);
                      if (row < 5) {
                        const newCoord = `${col},${row + 1}`;
                        setCurrentSquare(newCoord);
                        updateText(newCoord);
                        if (circleRef.current && coordinatePlaneRef.current) {
                          const squareSize = 300 / 11;
                          const circle = circleRef.current;
                          const x = (col + 5) * squareSize + squareSize / 2 - circle.offsetWidth / 2;
                          const y = (5 - (row + 1)) * squareSize + squareSize / 2 - circle.offsetHeight / 2;
                          circle.style.transform = `translate(${x}px, ${y}px)`;
                        }
                      }
                    }}
                    disabled={currentSquare.split(",")[1] === "5"}
                  >
                    ↑
                  </button>
                  <div className={styles.navMiddleRow}>
                    <button 
                      className={`${styles.navButton} ${styles.navLeft}`}
                      onClick={() => {
                        const [col, row] = currentSquare.split(",").map(Number);
                        if (col > -5) {
                          const newCoord = `${col - 1},${row}`;
                          setCurrentSquare(newCoord);
                          updateText(newCoord);
                          if (circleRef.current && coordinatePlaneRef.current) {
                            const squareSize = 300 / 11;
                            const circle = circleRef.current;
                            const x = (col - 1 + 5) * squareSize + squareSize / 2 - circle.offsetWidth / 2;
                            const y = (5 - row) * squareSize + squareSize / 2 - circle.offsetHeight / 2;
                            circle.style.transform = `translate(${x}px, ${y}px)`;
                          }
                        }
                      }}
                      disabled={currentSquare.split(",")[0] === "-5"}
                    >
                      ←
                    </button>
                    <button 
                      className={`${styles.navButton} ${styles.navCenter}`}
                      onClick={() => {
                        const newCoord = "0,0";
                        setCurrentSquare(newCoord);
                        updateText(newCoord);
                        if (circleRef.current && coordinatePlaneRef.current) {
                          const squareSize = 300 / 11;
                          const circle = circleRef.current;
                          const x = 5 * squareSize + squareSize / 2 - circle.offsetWidth / 2;
                          const y = 5 * squareSize + squareSize / 2 - circle.offsetHeight / 2;
                          circle.style.transform = `translate(${x}px, ${y}px)`;
                        }
                      }}
                    >
                      ⌖
                    </button>
                    <button 
                      className={`${styles.navButton} ${styles.navRight}`}
                      onClick={() => {
                        const [col, row] = currentSquare.split(",").map(Number);
                        if (col < 5) {
                          const newCoord = `${col + 1},${row}`;
                          setCurrentSquare(newCoord);
                          updateText(newCoord);
                          if (circleRef.current && coordinatePlaneRef.current) {
                            const squareSize = 300 / 11;
                            const circle = circleRef.current;
                            const x = (col + 1 + 5) * squareSize + squareSize / 2 - circle.offsetWidth / 2;
                            const y = (5 - row) * squareSize + squareSize / 2 - circle.offsetHeight / 2;
                            circle.style.transform = `translate(${x}px, ${y}px)`;
                          }
                        }
                      }}
                      disabled={currentSquare.split(",")[0] === "5"}
                    >
                      →
                    </button>
                  </div>
                  <button 
                    className={`${styles.navButton} ${styles.navDown}`}
                    onClick={() => {
                      const [col, row] = currentSquare.split(",").map(Number);
                      if (row > -5) {
                        const newCoord = `${col},${row - 1}`;
                        setCurrentSquare(newCoord);
                        updateText(newCoord);
                        if (circleRef.current && coordinatePlaneRef.current) {
                          const squareSize = 300 / 11;
                          const circle = circleRef.current;
                          const x = (col + 5) * squareSize + squareSize / 2 - circle.offsetWidth / 2;
                          const y = (5 - (row - 1)) * squareSize + squareSize / 2 - circle.offsetHeight / 2;
                          circle.style.transform = `translate(${x}px, ${y}px)`;
                        }
                      }
                    }}
                    disabled={currentSquare.split(",")[1] === "-5"}
                  >
                    ↓
                  </button>
                </div>
              </div>
            )}
            
            <div className={styles.mobileInstructions}>
              <p>💡 <strong>Tip:</strong> Tap anywhere on the grid to jump directly to that variation!</p>
            </div>
          </div>
        )}

        <Footer />
      </main>
    </div>
  );
}
