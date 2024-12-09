'use client'

import { useState } from 'react';
import PtitchPerfect from "@/components/PtitchPerfect";
import MicrophoneListener from "@/components/MicrophoneListener";

export default function Home() {
  const [currentPitch, setCurrentPitch] = useState<number | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [gameKey, setGameKey] = useState(0);

  const handlePitchChange = (pitch: number | null) => {
    setCurrentPitch(pitch);
  };

  const handleListeningChange = (listening: boolean) => {
    setIsListening(listening);
    if (listening) {
      setGameKey(prev => prev + 1);
    }
  };

  const handleGameReset = () => {
    setGameKey(prev => prev + 1);
  };

  return (
    <main className="flex flex-col items-center">
      <PtitchPerfect 
        key={gameKey}
        currentPitch={currentPitch} 
        gameStarted={isListening}
        onReset={handleGameReset}
      />
      <MicrophoneListener 
        onPitchChange={handlePitchChange}
        onListeningChange={handleListeningChange}
      />
    </main>
  );
}
