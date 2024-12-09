'use client'

import React, { useEffect, useRef, useState, useCallback } from 'react'

interface Pipe {
  x: number
  topHeight: number
  gap: number
  width: number
  passed: boolean
}

interface GameState {
  bird: {
    x: number
    y: number
    velocity: number
    width: number
    height: number
  }
  pipes: Pipe[]
  score: number
  frameCount: number
}

const BIRD_WIDTH = 40
const BIRD_HEIGHT = 40
const PIPE_WIDTH = 60
const GRAVITY = 0.5
const JUMP_FORCE = 5
const INITIAL_GAME_SPEED = 3
const PIPE_GAP = 100;
const GROUND_HEIGHT = 2;
const PIPE_SPACING = 800;

// First, define the pipe heights with equal intervals
const PIPE_HEIGHTS = [
  45,
  98,    // 45 + 53
  151,    // 45 + (53 * 2)
  204,    // 45 + (53 * 3)
  257,    // 45 + (53 * 4)
  310,    // 45 + (53 * 5)
  363,    // 45 + (53 * 6)
  416     // Highest
];

// Increase pipe spacing significantly more
 // Increased from 500 to ensure max 2 pipes on screen

// First, define the initial state type and values at the component level
const createInitialState = (): GameState => ({
  bird: {
    x: 100,
    y: 250,
    velocity: 0,
    width: BIRD_WIDTH,
    height: BIRD_HEIGHT
  },
  pipes: [],
  score: 0,
  frameCount: 0
});

interface PtitchPerfectProps {
  currentPitch: number | null;
  gameStarted: boolean;
  onReset: () => void;
}

const NOTE_LINES = [
  { note: 'Do4', freq: 261.63, color: '#FF6B6B', height: 45 + 50 },
  { note: 'Si3', freq: 246.94, color: '#4ECDC4', height: 98 + 50 },
  { note: 'La3', freq: 220.00, color: '#45B7D1', height: 151 + 50 },
  { note: 'Sol3', freq: 196.00, color: '#96CEB4', height: 204 + 50 },
  { note: 'Fa3', freq: 174.61, color: '#FFEEAD', height: 257 + 50 },
  { note: 'Mi3', freq: 164.81, color: '#D4A5A5', height: 310 + 50 },
  { note: 'Re3', freq: 146.83, color: '#9B59B6', height: 363 + 50 },
  { note: 'Do3', freq: 130.81, color: '#E74C3C', height: 416 + 50 },
];

const freqToY = (freq: number, canvasHeight: number): number => {
  // Find the matching note line
  const noteLine = NOTE_LINES.find(line => line.freq === freq);
  if (noteLine) {
    return noteLine.height;
  }
  
  // For frequencies between notes, interpolate between the heights
  const minFreq = 130.81; // Do3
  const maxFreq = 261.63; // Do4
  const normalizedFreq = (freq - minFreq) / (maxFreq - minFreq);
  return 482 - (normalizedFreq * (482 - 108)); // Interpolate from bottom to top
};

const PtitchPerfect: React.FC<PtitchPerfectProps> = ({ 
  currentPitch,
  gameStarted: micStarted,
  onReset 
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const birdImageRef = useRef<HTMLImageElement | null>(null)
  const pipeImageRef = useRef<HTMLImageElement | null>(null)
  const backgroundImageRef = useRef<HTMLImageElement | null>(null)
  const gameOverRef = useRef(false);
  
  const [gameStarted, setGameStarted] = useState(false)
  const [gameOver, setGameOver] = useState(false)
  const [score, setScore] = useState(0)
  const [imagesLoaded, setImagesLoaded] = useState(false)
  const [gameSpeed, setGameSpeed] = useState(INITIAL_GAME_SPEED)

  // Initialize the game state ref with the initial state
  const gameStateRef = useRef<GameState>(createInitialState());

  // Add a counter for tracking the number of pipes generated
  const pipeCountRef = useRef(0);

  // Add key state to force re-render
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    // Load images
    birdImageRef.current = new Image()
    pipeImageRef.current = new Image()
    backgroundImageRef.current = new Image()

    let loadedImages = 0
    const totalImages = 3

    const handleImageLoad = () => {
      loadedImages++
      if (loadedImages === totalImages) {
        setImagesLoaded(true)
      }
    }

    birdImageRef.current.onload = handleImageLoad
    pipeImageRef.current.onload = handleImageLoad
    backgroundImageRef.current.onload = handleImageLoad

    birdImageRef.current.src = 'assets/images/bird.png'
    pipeImageRef.current.src = 'assets/images/pipe.png'
    backgroundImageRef.current.src = 'assets/images/background.png'
  }, [])

  const resetGame = useCallback(() => {
    gameStateRef.current = createInitialState();
    gameOverRef.current = false;
    pipeCountRef.current = 0; // Reset pipe counter
    setScore(0);
    setGameOver(false);
    setGameStarted(false);
    setGameSpeed(INITIAL_GAME_SPEED);
  }, []);

  useEffect(() => {
    if (micStarted && !gameStarted && !gameOver) {
      setGameStarted(true);
    } else if (!micStarted && gameStarted) {
      // Optionally reset the game when mic stops
      setGameStarted(false);
      resetGame();
    }
  }, [micStarted, gameStarted, gameOver,resetGame]);

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (!gameStarted || gameOver) return;
      
      const state = gameStateRef.current;
      switch (e.code) {
        case 'ArrowUp':
          state.bird.y = Math.max(0, state.bird.y - JUMP_FORCE);
          break;
        case 'ArrowDown':
          state.bird.y = Math.min(
            (canvasRef.current?.height || 0)  - GROUND_HEIGHT - state.bird.height,
            state.bird.y + JUMP_FORCE
          );
          break;
        case 'KeyR':
          if (gameOver) {
            resetGame();
          }
          break;
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [gameStarted, gameOver, resetGame]);

  useEffect(() => {
    const handleSpaceBar = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !gameStarted && !gameOver) {
        setGameStarted(true);
      }
    };

    document.addEventListener('keydown', handleSpaceBar);
    return () => document.removeEventListener('keydown', handleSpaceBar);
  }, [gameStarted, gameOver]);

  useEffect(() => {
    if (!gameStarted || gameOver || !currentPitch || !canvasRef.current) return;

    const state = gameStateRef.current;
    const canvas = canvasRef.current;

    // Find the closest note line and use its exact height
    const closestNoteLine = NOTE_LINES.reduce((prev, curr) => {
      return Math.abs(curr.freq - currentPitch) < Math.abs(prev.freq - currentPitch) ? curr : prev;
    });
    
    // Center the bird on the line by adding half its height
    const newY = closestNoteLine.height - (state.bird.height / 2);
    
    // Update bird position with bounds checking
    state.bird.y = Math.max(0, Math.min(
      canvas.height - GROUND_HEIGHT - state.bird.height,
      newY
    ));

  }, [currentPitch, gameStarted, gameOver]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !imagesLoaded) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const gameLoop = () => {
      const state = gameStateRef.current;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw background
      if (backgroundImageRef.current) {
        ctx.drawImage(backgroundImageRef.current, 0, 0, canvas.width, canvas.height);
      }

      // Draw just the guide lines
      NOTE_LINES.forEach(({ freq, color }) => {
        const y = freqToY(freq, canvas.height);
        
        // Draw horizontal guide line
        ctx.beginPath();
        ctx.setLineDash([5, 5]);
        ctx.strokeStyle = color;
        ctx.globalAlpha = 0.2;
        ctx.lineWidth = 1;
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      });

      // Reset line style
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;

      // If game over, draw final frame and stop
      if (gameOver) {
        // Draw pipes in their final positions
        state.pipes.forEach(pipe => {
          if (pipeImageRef.current) {
            ctx.drawImage(
              pipeImageRef.current,
              pipe.x,
              0,
              pipe.width,
              pipe.topHeight
            );
            ctx.drawImage(
              pipeImageRef.current,
              pipe.x,
              pipe.topHeight + pipe.gap,
              pipe.width,
              canvas.height - (pipe.topHeight + pipe.gap)
            );
          }
        });

        // Draw bird in final position
        if (birdImageRef.current) {
          ctx.save();
          ctx.translate(
            state.bird.x + state.bird.width / 2,
            state.bird.y + state.bird.height / 2
          );
          ctx.rotate(state.bird.velocity * 0.02);
          ctx.drawImage(
            birdImageRef.current,
            -state.bird.width / 2,
            -state.bird.height / 2,
            state.bird.width,
            state.bird.height
          );
          ctx.restore();
        }
        
        // Don't request next frame - stop the game loop
        return;
      }

      if (!gameStarted) {
        // Draw initial bird position
        if (birdImageRef.current) {
          ctx.drawImage(
            birdImageRef.current,
            state.bird.x,
            state.bird.y,
            BIRD_WIDTH,
            BIRD_HEIGHT
          );
        }
        requestAnimationFrame(gameLoop);
        return;
      }

      // Generate new pipes based on the last pipe's position
      const lastPipe = state.pipes[state.pipes.length - 1];
      if (!canvasRef.current) return;
      if (!lastPipe || lastPipe.x < canvasRef.current.width - PIPE_SPACING) {
        addPipe();
      }

      // Update and draw pipes
      state.pipes = state.pipes.filter(pipe => {
        pipe.x -= gameSpeed;

        // Check collisions FIRST, before any other pipe processing
        const hasCollision = 
          state.bird.x + state.bird.width > pipe.x &&
          state.bird.x < pipe.x + pipe.width &&
          (state.bird.y < pipe.topHeight || 
           state.bird.y + state.bird.height > pipe.topHeight + pipe.gap);

        if (hasCollision) {
          gameOverRef.current = true;
          setGameOver(true);
          return true; // Keep the pipe in the array but stop all other processing
        }

        // Only proceed with drawing and scoring if there's no collision
        if (!gameOver) {
          // Draw pipes
          if (pipeImageRef.current) {
            // Draw bottom pipe normally
            ctx.drawImage(
              pipeImageRef.current,
              pipe.x,
              pipe.topHeight + pipe.gap,
              pipe.width,
              canvas.height - (pipe.topHeight + pipe.gap)
            );

            // Draw top pipe with rotation and mirroring
            ctx.save();
            ctx.translate(pipe.x + pipe.width/2, pipe.topHeight/2);
            ctx.rotate(Math.PI);
            ctx.scale(-1, 1);
            ctx.drawImage(
              pipeImageRef.current,
              -pipe.width/2,
              -pipe.topHeight/2,
              pipe.width,
              pipe.topHeight
            );
            ctx.restore();
          }

          // Update score
          if (!gameOverRef.current && !pipe.passed && pipe.x + pipe.width < state.bird.x) {
            pipe.passed = true;
            setScore(prev => prev + 1);
          }
        }

        return pipe.x > -pipe.width;
      });

      // Check floor and ceiling collisions
      if (
        state.bird.y < 0 ||
        state.bird.y + state.bird.height > canvas.height
      ) {
        setGameOver(true);
        return; // Stop the game loop immediately
      }

      // Draw bird
      if (birdImageRef.current) {
        ctx.save();
        ctx.translate(
          state.bird.x + state.bird.width / 2,
          state.bird.y + state.bird.height / 2
        );
        ctx.rotate(state.bird.velocity * 0.02);
        ctx.drawImage(
          birdImageRef.current,
          -state.bird.width / 2,
          -state.bird.height / 2,
          state.bird.width,
          state.bird.height
        );
        ctx.restore();
      }

      // Only continue the game loop if not game over
      if (!gameOver) {
        requestAnimationFrame(gameLoop);
      }
    };

    // Start the game loop
    const animationFrame = requestAnimationFrame(gameLoop);
    
    // Cleanup
    return () => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
    };
  }, [gameStarted, gameOver, imagesLoaded, gameSpeed]);

  // Modify the pipe generation function
  const addPipe = () => {
    const state = gameStateRef.current;
    if (!canvasRef.current) return;

    let topHeight;
    
    if (pipeCountRef.current < PIPE_HEIGHTS.length) {
      // For first 8 pipes, use sequential heights from highest to lowest
      const reverseIndex = PIPE_HEIGHTS.length - 1 - pipeCountRef.current;
      topHeight = PIPE_HEIGHTS[reverseIndex];
      pipeCountRef.current++;
    } else {
      // After first 8 pipes, use random heights
      const randomIndex = Math.floor(Math.random() * PIPE_HEIGHTS.length);
      topHeight = PIPE_HEIGHTS[randomIndex];
    }

    const newPipe = {
      x: canvasRef.current.width,
      width: PIPE_WIDTH,
      topHeight: topHeight,
      gap: PIPE_GAP,
      passed: false
    };

    state.pipes.push(newPipe);
  };

  // Update the key press handler
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.code === 'KeyR' && gameOver && micStarted) {
        onReset();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [gameOver, micStarted, onReset]);

  return (
    <div className="flex items-center justify-center bg-black bg-opacity-50">
      <div className="relative flex">
        {/* Note lines container */}
        <div className="relative w-[100px] bg-black bg-opacity-30 flex flex-col justify-between py-[50px]">
          {NOTE_LINES.map(({ note, freq, color }) => {
            const canvas = canvasRef.current;
            if (!canvas) return null;
            
            const y = freqToY(freq, canvas.height);
            
            return (
              <div 
                key={note}
                className="absolute flex items-center w-full px-2"
                style={{ 
                  top: `${y}px`,
                  transform: 'translateY(-50%)'
                }}
              >
                <div 
                  className="w-full p-1 rounded flex justify-between items-center"
                  style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
                >
                  <span 
                    className="text-sm font-bold"
                    style={{ color }}
                  >
                    {note}
                  </span>
                  <span 
                    className="text-xs"
                    style={{ color }}
                  >
                    {Math.round(freq)}Hz
                  </span>
                </div>
              </div>
            );
          })}
          {/* Current pitch indicator */}
          {currentPitch && gameStarted && !gameOver && (
            <div 
              className="absolute right-0 w-8 h-8 flex items-center"
              style={{ 
                top: `${freqToY(currentPitch, canvasRef.current?.height || 600)}px`,
                transform: 'translateY(-50%)'
              }}
            >
              <div 
                className="w-0 h-0 border-t-[8px] border-t-transparent border-b-[8px] border-b-transparent border-r-[16px]"
                style={{ 
                  borderRightColor: NOTE_LINES.find(line => 
                    Math.abs(line.freq - currentPitch) === Math.min(...NOTE_LINES.map(l => 
                      Math.abs(l.freq - currentPitch)
                    ))
                  )?.color || '#FFD93D' 
                }}
              />
            </div>
          )}
        </div>

        {/* Canvas and existing overlays */}
        <div className="relative" key={refreshKey}>
          <canvas
            ref={canvasRef}
            width={1200}
            height={600}
            className="bg-sky-200 rounded-lg"
          />
          
          {/* Existing score display */}
          <div className="absolute top-4 left-4 text-2xl font-bold text-white">
            <div>Score: {score}</div>
          </div>

          {/* Existing conditional overlays */}
          {!imagesLoaded && (
            <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
              <div className="text-2xl font-bold text-white">
                Loading...
              </div>
            </div>
          )}

          {imagesLoaded && !micStarted && !gameOver && (
            <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
              <div className="text-center">
                <div className="text-4xl font-bold text-white mb-4">
                  Ptitch Perfect
                </div>
                <div className="text-xl text-white mb-2">
               {   `Click "Start Listening" below to plays`}
                </div>
                <div className="text-sm text-gray-300">
                  Control with your voice: higher pitch = up, lower pitch = down
                </div>
              </div>
            </div>
          )}

          {imagesLoaded && gameOver && (
            <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
              <div className="text-center">
                <div className="text-4xl font-bold text-white mb-4">
                  Game Over!
                </div>
                <div className="text-2xl text-white mb-4">
                  Score: {score}
                </div>
                <div className="text-xl text-white">
                  Press R to restart
                </div>
                <div className="text-sm text-gray-300">

                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default PtitchPerfect