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
const JUMP_FORCE = 10
const INITIAL_GAME_SPEED = 3
const PIPE_GAP = 100;
const GROUND_HEIGHT = 2;

// First, define the pipe heights with equal intervals
const PIPE_HEIGHTS = [
  58,     // Lowest
  111,    // 58 + 53
  164,    // 58 + (53 * 2)
  217,    // 58 + (53 * 3)
  270,    // 58 + (53 * 4)
  323,    // 58 + (53 * 5)
  376,    // 58 + (53 * 6)
  432     // Highest
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

const FlappyBird: React.FC = () => {
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

  const handleClick = useCallback(() => {
    if (!gameStarted) {
      setGameStarted(true);
      return;
    }
    
    if (!gameOver) {  // Only jump if game is not over
      const state = gameStateRef.current;
      state.bird.velocity = -JUMP_FORCE;
    }
  }, [gameStarted, gameOver]);

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        if (!gameOver) {  // Only allow jumping if game is not over
          handleClick();
        }
      } else if (e.code === 'KeyR' && gameOver) {  // Only 'R' can restart the game
        resetGame();
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [handleClick, resetGame, gameOver]);

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

      // Update game state
      state.bird.velocity += GRAVITY;
      state.bird.y += state.bird.velocity;

      // Only constrain bird position while game is active (not game over)
      if (gameStarted && !gameOverRef.current) {
        if (state.bird.y <= 0) {
          state.bird.y = 0;
          state.bird.velocity = 0;
        } else if (state.bird.y >= canvas.height - GROUND_HEIGHT - state.bird.height) {
          state.bird.y = canvas.height - GROUND_HEIGHT - state.bird.height;
          state.bird.velocity = 0;
        }
      }

      // Generate new pipes based on the last pipe's position
      const lastPipe = state.pipes[state.pipes.length - 1];
      if (!canvasRef.current) return;
      if (!lastPipe || lastPipe.x < canvasRef.current.width - 600) {
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

  return (
    <div className="flex items-center justify-center bg-black bg-opacity-50">
      <div className="relative">
        <canvas
          ref={canvasRef}
          width={800}
          height={600}
          className="bg-sky-200 rounded-lg"
          onClick={handleClick}
        />
        
        <div className="absolute top-4 left-4 text-2xl font-bold text-white">
          <div>Score: {score}</div>
          <div>Speed: {gameSpeed.toFixed(1)}x</div>
        </div>

        {!imagesLoaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
            <div className="text-2xl font-bold text-white">
              Loading...
            </div>
          </div>
        )}

        {imagesLoaded && !gameStarted && !gameOver && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
            <div className="text-center">
              <div className="text-4xl font-bold text-white mb-4">
                Flappy Bird
              </div>
              <div className="text-xl text-white mb-2">
                Click or press Space to start
              </div>
              <div className="text-sm text-gray-300">
      
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
  )
}

export default FlappyBird 