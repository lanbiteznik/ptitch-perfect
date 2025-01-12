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
    gravityEnabled: boolean
  }
  pipes: Pipe[]
  score: number
  frameCount: number
}

const BIRD_WIDTH = 80
const BIRD_HEIGHT = 80
const PIPE_WIDTH = 60
const GRAVITY = 0.5
const JUMP_FORCE = 5
const INITIAL_GAME_SPEED = 3
const PIPE_GAP = 100;
const GROUND_HEIGHT = 2;
const PIPE_SPACING = 800;
const SAFE_GROUND_MARGIN = 3; // Pixels above ground where bird stops falling

// Define songs using pipe heights that correspond to notes
const KUZA_PAZI = [
  257, 257, 257, 257,  // Fa Fa Fa Fa
  204, 204, 204, 204,  // Sol Sol Sol Sol
  151, 151, 204, 204,  // La La Sol Sol
  257, 257, 257,       // Fa Fa Fa
  257, 257, 257, 257,  // Fa Fa Fa Fa (repeat)
  204, 204, 204, 204,  // Sol Sol Sol Sol
  151, 151, 204, 204,  // La La Sol Sol
  257, 257, 257        // Fa Fa Fa
];

const MARKO_SKACE = [
  310, 204, 204, 204,  // Mi Sol Sol Sol
  310, 204, 204, 204,  // Mi Sol Sol Sol
  310, 310, 363, 363,  // Mi Mi Re Re
  416, 416,            // Do Do
  416, 363, 310, 204,  // Do Re Mi Sol
  204, 204, 310, 310,  // Sol Sol Mi Mi
  363, 363, 416, 416   // Re Re Do Do
];

const CUK_SE_JE_OZENIL = [
  310, 257, 204, 151,  // Mi Fa Sol La
  98, 98, 45, 45,      // Si Si Do4 Do4
  98, 45, 45, 98,      // Si Do4 Do4 Si
  151, 151, 151, 151,  // La La La La
  204, 204, 257, 257,  // Sol Sol Fa Fa
  98, 151, 151, 151, 151,  // Si La La La La
  204, 204, 257, 257,  // Sol Sol Fa Fa
  310                   // Mi
];

// Combine all songs into one array
const ALL_SONGS = [...KUZA_PAZI, ...MARKO_SKACE, ...CUK_SE_JE_OZENIL];
let currentNoteIndex = 0;

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

const PIPE_HEIGHTS = [416, 363, 310, 257, 204, 151, 98, 45];

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
  const [victory, setVictory] = useState(false);
  const [score, setScore] = useState(0)
  const [imagesLoaded, setImagesLoaded] = useState(false)
  const [gameSpeed, setGameSpeed] = useState(INITIAL_GAME_SPEED)
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioBuffers = useRef<{ [key: string]: AudioBuffer }>({});
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);

  // Initialize the game state ref with the initial state
  const gameStateRef = useRef<GameState>({
    bird: {
      x: 100,
      y: 250,
      velocity: 0,
      width: BIRD_WIDTH,
      height: BIRD_HEIGHT,
      gravityEnabled: true
    },
    pipes: [],
    score: 0,
    frameCount: 0
  });

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

    birdImageRef.current.src = 'assets/images/Bird2.png'
    pipeImageRef.current.src = 'assets/images/Note.png'
    backgroundImageRef.current.src = 'assets/images/scale.png'
  }, [])

  const resetGame = useCallback(() => {
    gameStateRef.current = {
      bird: {
        x: 100,
        y: 250,
        velocity: 0,
        width: BIRD_WIDTH,
        height: BIRD_HEIGHT,
        gravityEnabled: true
      },
      pipes: [],
      score: 0,
      frameCount: 0
    };
    gameOverRef.current = false;
    pipeCountRef.current = 0; // Reset pipe counter
    setScore(0);
    setGameOver(false);
    setVictory(false);
    setGameStarted(false);
    setGameSpeed(INITIAL_GAME_SPEED);
  }, []);

  useEffect(() => {
    if (micStarted && !gameStarted && !gameOver) {
      setGameStarted(true);
      // Resume AudioContext after user interaction
      if (audioContextRef.current?.state === 'suspended') {
        audioContextRef.current.resume().catch(error => {
          console.error('Failed to resume AudioContext:', error);
        });
      }
    } else if (!micStarted && gameStarted) {
      // Optionally reset the game when mic stops
      setGameStarted(false);
      resetGame();
    }
  }, [micStarted, gameStarted, gameOver, resetGame]);

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (!gameStarted || gameOver || victory) return;
      
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
          if (gameOver || victory) {
            resetGame();
          }
          break;
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [gameStarted, gameOver, victory, resetGame]);

  useEffect(() => {
    const handleSpaceBar = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !gameStarted && !gameOver && !victory) {
        setGameStarted(true);
      }
    };

    document.addEventListener('keydown', handleSpaceBar);
    return () => document.removeEventListener('keydown', handleSpaceBar);
  }, [gameStarted, gameOver, victory]);

  useEffect(() => {
    if (!gameStarted || gameOver || victory || !currentPitch || !canvasRef.current) return;

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

    // If gravity is enabled and this is first pitch after pipe, disable gravity
    if (state.bird.gravityEnabled) {
      state.bird.velocity = 0;
      state.bird.gravityEnabled = false;
    }

  }, [currentPitch, gameStarted, gameOver, victory]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !imagesLoaded) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;

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
        
        // Draw solid line across entire canvas
        ctx.beginPath();
        ctx.setLineDash([]);
        ctx.strokeStyle = 'black';
        ctx.globalAlpha = 0.8;
        ctx.lineWidth = 2;
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      });

      // Reset line style
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;

      // If game over or victory, draw final frame and stop
      if (gameOver || victory) {
        // Draw final state of pipes and bird
        state.pipes.forEach(pipe => {
          if (pipeImageRef.current && canvas) {
            const aspectRatio = pipeImageRef.current.width / pipeImageRef.current.height;
            const desiredHeight = pipe.width / aspectRatio;

            // Draw bottom pipe normally
            ctx.drawImage(
              pipeImageRef.current,
              0,                           // sourceX
              0,                           // sourceY
              pipeImageRef.current.width,  // sourceWidth
              pipeImageRef.current.height * 0.7, // only use top 70%
              pipe.x,                      // destX
              pipe.topHeight + pipe.gap,   // destY
              pipe.width,                  // destWidth
              desiredHeight               // maintain aspect ratio
            );

            // Draw top pipe with rotation and mirroring
            ctx.save();
            ctx.translate(pipe.x + pipe.width/2, pipe.topHeight/2);
            ctx.rotate(Math.PI);
            ctx.scale(-1, 1);
            ctx.drawImage(
              pipeImageRef.current,
              0,                           // sourceX
              0,                           // sourceY
              pipeImageRef.current.width,  // sourceWidth
              pipeImageRef.current.height * 0.7, // only use top 70%
              -pipe.width/2,              // destX
              -pipe.topHeight/2,          // destY
              pipe.width,                 // destWidth
              desiredHeight              // maintain aspect ratio
            );
            ctx.restore();
          }
        });

        // Draw bird in final position
        if (birdImageRef.current) {
          ctx.save();
          ctx.translate(
            state.bird.x + state.bird.width / 2,
            state.bird.y + state.bird.height / 2
          );
          ctx.drawImage(
            birdImageRef.current,
            -state.bird.width / 2,
            -state.bird.height / 2,
            state.bird.width,
            state.bird.height
          );
          ctx.restore();
        }
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
        animationFrameId = requestAnimationFrame(gameLoop);
        return;
      }

      // Generate new pipes based on the song patterns
      const lastPipe = state.pipes[state.pipes.length - 1];
      if (!canvasRef.current) return;
      if (!lastPipe || lastPipe.x < canvasRef.current.width - PIPE_SPACING) {
        addPipe();
      }

      // Update and draw pipes
      state.pipes = state.pipes.filter(pipe => {
        pipe.x -= gameSpeed;

        // Check if pipe is at 3/4 of canvas width and play corresponding note
        const canvas = canvasRef.current;
        if (canvas) {
          // Check pipe's position relative to canvas width
          if (pipe.x == 8.7*canvas.width / 10) {
            console.log('Pipe position:', pipe.x, 'Target position:', canvas.width / 4);
            // Find the note line closest to the pipe's top height
            const closestNote = NOTE_LINES.reduce((prev, curr) => {
              return Math.abs(curr.height - pipe.topHeight) < Math.abs(prev.height - pipe.topHeight) ? curr : prev;
            });
            playNote(closestNote.note);
          }
        }

        // Check collisions FIRST, before any other pipe processing
        const hasCollision = 
          state.bird.x + state.bird.width > pipe.x &&
          state.bird.x < pipe.x + pipe.width &&
          (state.bird.y < pipe.topHeight || 
           state.bird.y + state.bird.height > pipe.topHeight + pipe.gap);

        if (hasCollision) {
          gameOverRef.current = true;
          setGameOver(true);
          stopGame();
          return true;
        }

        // Only proceed with drawing and scoring if there's no collision
        if (!gameOver) {
          // Draw pipes
          if (pipeImageRef.current && canvas) {
            const aspectRatio = pipeImageRef.current.width / pipeImageRef.current.height;
            const desiredHeight = pipe.width / aspectRatio;

            // Draw bottom pipe normally
            ctx.drawImage(
              pipeImageRef.current,
              0,                           // sourceX
              0,                           // sourceY
              pipeImageRef.current.width,  // sourceWidth
              pipeImageRef.current.height * 0.7, // only use top 70%
              pipe.x,                      // destX
              pipe.topHeight + pipe.gap,   // destY
              pipe.width,                  // destWidth
              desiredHeight               // maintain aspect ratio
            );

            // Draw top pipe with rotation and mirroring
            ctx.save();
            ctx.translate(pipe.x + pipe.width/2, pipe.topHeight/2);
            ctx.rotate(Math.PI);
            ctx.scale(-1, 1);
            ctx.drawImage(
              pipeImageRef.current,
              0,                           // sourceX
              0,                           // sourceY
              pipeImageRef.current.width,  // sourceWidth
              pipeImageRef.current.height * 0.7, // only use top 70%
              -pipe.width/2,              // destX
              -pipe.topHeight/2,          // destY
              pipe.width,                 // destWidth
              desiredHeight              // maintain aspect ratio
            );
            ctx.restore();
          }

          // Update score
          if (!gameOverRef.current && !pipe.passed && pipe.x + pipe.width < state.bird.x) {
            pipe.passed = true;
            setScore(prev => prev + 1);
            state.bird.gravityEnabled = true; // Enable gravity after passing pipe
            state.bird.velocity = 0; // Reset velocity for new fall
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
        stopGame();
        return; // Stop the game loop immediately
      }

      // Draw bird with gravity
      if (birdImageRef.current) {
        // Apply gravity only if enabled
        if (state.bird.gravityEnabled && gameStarted) {
          state.bird.velocity += GRAVITY;
          const safeGroundLevel = canvas.height - GROUND_HEIGHT - state.bird.height - SAFE_GROUND_MARGIN;
          state.bird.y = Math.min(
            safeGroundLevel,
            state.bird.y + state.bird.velocity
          );

          // Check if bird hit the safe ground level
          if (state.bird.y >= safeGroundLevel) {
            state.bird.velocity = 0;
            state.bird.y = safeGroundLevel;
          }
        }

        ctx.save();
        ctx.translate(
          state.bird.x + state.bird.width / 2,
          state.bird.y + state.bird.height / 2
        );
        // Rotate bird based on velocity only when gravity is enabled
        const rotation = state.bird.gravityEnabled ? Math.min(Math.max(state.bird.velocity * 0.05, -0.5), 0.5) : 0;
        ctx.rotate(rotation);
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
      if (!gameOver && !victory) {
        animationFrameId = requestAnimationFrame(gameLoop);
      }
    };

    // Start the game loop
    gameLoop();
    
    // Cleanup
    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [gameStarted, gameOver, victory, imagesLoaded, gameSpeed]);

  useEffect(() => {
    // Only create AudioContext when game starts after user interaction
    if (typeof window !== 'undefined' && !audioContextRef.current && gameStarted) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      // Load audio files immediately after creating context
      loadAudio();
    }
    
    // Cleanup on unmount
    return () => {
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        try {
          audioContextRef.current.close();
        } catch (e) {
          console.error('Error closing AudioContext:', e);
        }
      }
    };
  }, [gameStarted]); // Add gameStarted as dependency

  const loadAudio = async () => {
    const context = audioContextRef.current;
    if (!context || context.state === 'closed') return;
    
    for (const { note } of NOTE_LINES) {
      try {
        const response = await fetch(`/assets/notes/${note}.wav`);
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await context.decodeAudioData(arrayBuffer);
        audioBuffers.current[note] = audioBuffer;
      } catch (error) {
        console.error(`Error loading audio for note ${note}:`, error);
      }
    }
  };

  const playNote = useCallback((note: string) => {
    const context = audioContextRef.current;
    if (!context || context.state !== 'running' || !audioBuffers.current[note]) return;
    
    // Stop previous note if it's playing
    if (audioSourceRef.current) {
      try {
        audioSourceRef.current.stop();
      } catch (e) {
        // Ignore if already stopped
      }
    }
    
    try {
      const source = context.createBufferSource();
      source.buffer = audioBuffers.current[note];
      source.connect(context.destination);
      source.start();
      audioSourceRef.current = source;
      
      // Stop the note after 2 seconds
      setTimeout(() => {
        try {
          source.stop();
        } catch (e) {
          // Ignore if already stopped
        }
      }, 2000); // 2000ms duration (2 seconds)
    } catch (e) {
      console.error('Error playing note:', e);
    }
  }, []);

  // Add function to stop all audio and game processes
  const stopGame = useCallback(() => {
    // Stop audio
    if (audioSourceRef.current) {
      try {
        audioSourceRef.current.stop();
      } catch (e) {
        // Ignore if already stopped
      }
      audioSourceRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.suspend();
    }
    // Stop all movement
    setGameSpeed(0);
    if (gameStateRef.current) {
      gameStateRef.current.bird.velocity = 0;
      gameStateRef.current.bird.gravityEnabled = false;
    }
  }, []);

  // Add effect to handle game over state
  useEffect(() => {
    if (gameOver || victory) {
      stopGame();
    }
  }, [gameOver, victory, stopGame]);

  // Modify the addPipe function to use the song patterns
  const addPipe = () => {
    const state = gameStateRef.current;
    if (!canvasRef.current) return;

    let topHeight;
    
    if (pipeCountRef.current < PIPE_HEIGHTS.length) {
      // First 8 pipes, use sequential heights from Do3 to Do4
      topHeight = PIPE_HEIGHTS[pipeCountRef.current];
      pipeCountRef.current++;
    } else {
      // After first 8 pipes, use song patterns
      const songIndex = pipeCountRef.current - PIPE_HEIGHTS.length;
      if (songIndex >= ALL_SONGS.length) {
        setVictory(true);
        return;
      }
      topHeight = ALL_SONGS[songIndex];
      pipeCountRef.current++;
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
      if (e.code === 'KeyR' && (gameOver || victory) && micStarted) {
        onReset();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [gameOver, victory, micStarted, onReset]);

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
                </div>
              </div>
            );
          })}
          {/* Current pitch indicator */}
          {currentPitch && gameStarted && !gameOver && !victory && (
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

          {imagesLoaded && !micStarted && !gameOver && !victory && (
            <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
              <div className="text-center">
                <div className="text-4xl font-bold text-white mb-4">
                  Ptitch Perfect
                </div>
                <div className="text-xl text-white mb-2">
                  Click &ldquo;Start Listening&rdquo; below to play
                </div>
                <div className="text-sm text-gray-300">
                  Control with your voice: higher pitch = up, lower pitch = down
                </div>
              </div>
            </div>
          )}

          {imagesLoaded && (gameOver || victory) && (
            <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
              <div className="text-center">
                {victory ? (
                  <>
                    <div className="text-4xl font-bold text-green-400 mb-4">
                      Congratulations!
                    </div>
                    <div className="text-2xl text-white mb-4">
                      You&apos;ve mastered all the songs!
                    </div>
                    <div className="text-xl text-white mb-6">
                      <div className="mb-2">Kuža pazi</div>
                      <div className="mb-2">Marko skače</div>
                      <div className="mb-2">Čuk se je oženil</div>
                    </div>
                    <div className="text-xl text-white mb-4">
                      Final Score: {score}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="text-4xl font-bold text-white mb-4">
                      Game Over!
                    </div>
                    <div className="text-2xl text-white mb-4">
                      Score: {score}
                    </div>
                  </>
                )}
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