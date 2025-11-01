import React, { useRef, useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import styles from '../styles/Home.module.css';
import Footer from '../public/Footer';
import { sessionManager } from '../utils/sessionManager';

export default function Explore() {
  const router = useRouter();
  const coordinatePlaneRef = useRef(null);
  const circleRef = useRef(null);
  const [currentSquare, setCurrentSquare] = useState("0,0");
  const [isDragging, setIsDragging] = useState(false);
  const [currentText, setCurrentText] = useState('');
  const [session, setSession] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
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
        updateText(newCoord);
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
        updateText(newCoord);
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

  const updateText = async (coordinate) => {
    if (!session) return;

    // Check if we have this generation
    if (session.generations[coordinate]) {
      setCurrentText(session.generations[coordinate]);
      setIsGenerating(false); // Reset loading state when showing existing text
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

    } catch (error) {
      console.error('Error generating coordinate:', error);
      setCurrentText('Error generating this variation. Please try another coordinate.');
    } finally {
      setIsGenerating(false);
    }
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
        <div className={styles.messageDisplayContainer}>
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

        <Footer />
      </main>
    </div>
  );
}
