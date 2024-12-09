//Mikrofon
'use client'

import React, { useEffect, useRef, useState } from 'react';

// Utility functions for pitch detection
const acf = (values: number[] | Float32Array) => {
  const SIZE = values.length;
  const c = new Array(SIZE).fill(0);
  for (let i = 0; i < SIZE; i++) {
    for (let j = 0; j < SIZE - i; j++) {
      c[i] = c[i] + values[j] * values[j + i];
    }
  }
  return c;
};

const findMax = (c: number[], minPeriod: number, maxPeriod: number) => {
  let max = 0;
  let maxIndex = -1;
  // Only look for peaks in the human voice range
  for (let i = minPeriod; i < maxPeriod; i++) {
    if (c[i] > max) {
      max = c[i];
      maxIndex = i;
    }
  }
  return { max, maxIndex };
};

const parabolicInterpolation = (c: number[], i: number) => {
  const y0 = c[i - 1];
  const y1 = c[i];
  const y2 = c[i + 1];
  const a = (y0 + y2) / 2 - y1;
  const b = (y2 - y0) / 2;
  if (a === 0) return i;
  return i - b / (2 * a);
};

const calculatePitch = (buf: Float32Array, options: { sampleRate: number }) => {
  // Update maxFreq to slightly above Do4 to ensure it's detected
  const minFreq = 130.81;  // Do3
  const maxFreq = 265.0;   // Slightly above Do4 (261.63 Hz)
  const minPeriod = Math.floor(options.sampleRate / maxFreq);
  const maxPeriod = Math.ceil(options.sampleRate / minFreq);

  const c = acf(buf);
  const { max, maxIndex } = findMax(c, minPeriod, maxPeriod);
  
  if (maxIndex <= 0) return null;
  
  // Add amplitude threshold to avoid noise
  const threshold = 0.2;
  const normalizedMax = max / c[0];
  if (normalizedMax < threshold) return null;
  
  const interpolatedIndex = parabolicInterpolation(c, maxIndex);
  const frequency = options.sampleRate / interpolatedIndex;
  
  // Return null if outside human voice range
  if (frequency < minFreq || frequency > maxFreq) return null;
  
  return frequency;
};

// Add prop type for pitch updates
interface MicrophoneListenerProps {
  onPitchChange: (pitch: number | null) => void;
  onListeningChange: (isListening: boolean) => void;
}

const MicrophoneListener: React.FC<MicrophoneListenerProps> = ({ 
  onPitchChange, 
  onListeningChange 
}) => {
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const [pitch, setPitch] = useState<number | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestRef = useRef<number | null>(null);
  const pitchHistory = useRef<number[]>([]);
  const [currentDb, setCurrentDb] = useState<number | null>(null);
  const thresholdDb = -25; // Increased from -50 to -35 for better sensitivity

  const updatePitch = (analyser: AnalyserNode, options: { sampleRate: number }) => {
    const buf = new Float32Array(analyser.fftSize);
    analyser.getFloatTimeDomainData(buf);

    // Calculate RMS (Root Mean Square) to get the sound level in dB
    const rms = Math.sqrt(buf.reduce((sum, value) => sum + value * value, 0) / buf.length);
    const db = 20 * Math.log10(rms);
    setCurrentDb(Math.round(db));

    if (db > thresholdDb) {
      const detectedPitch = calculatePitch(buf, options);
      
      if (detectedPitch) {
        // Add to history
        pitchHistory.current.push(detectedPitch);
        // Keep only last 5 values 
        if (pitchHistory.current.length > 5) {
          pitchHistory.current.shift();
        }
        
        // Use median of last 5 values to smooth out fluctuations
        const sortedPitches = [...pitchHistory.current].sort((a, b) => a - b);
        const medianPitch = sortedPitches[Math.floor(sortedPitches.length / 2)];
        
        setPitch(Math.round(medianPitch));
      } else {
        pitchHistory.current = [];
        setPitch(null);
      }
    } else {
      pitchHistory.current = [];
      setPitch(null);
    }
    
    requestRef.current = window.requestAnimationFrame(() => updatePitch(analyser, options));
  };

  const startListening = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("getUserMedia not supported on your browser!");
      } 

      const audioContext = new AudioContext();
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      const mediaStreamSource = audioContext.createMediaStreamSource(stream);
      const analyserNode = audioContext.createAnalyser();
      analyserNode.fftSize = 2048;
      mediaStreamSource.connect(analyserNode);
      
      setAnalyser(analyserNode);
      setIsListening(true);
      setError(null);
      onListeningChange(true);

    } catch (err) {
      console.error('Error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      onListeningChange(false);
    }
  };

  const stopListening = () => {
    if (requestRef.current) {
      window.cancelAnimationFrame(requestRef.current);
    }
    setAnalyser(null);
    setIsListening(false);
    setPitch(null);
    pitchHistory.current = [];
    onListeningChange(false);
  };

  useEffect(() => {
    if (analyser) {
      const options = {
        sampleRate: analyser.context.sampleRate,
      };
      updatePitch(analyser, options);
      return () => {
        requestRef.current && window.cancelAnimationFrame(requestRef.current);
      };
    }
  }, [analyser]);

  useEffect(() => {
    // Notify parent component whenever pitch changes
    onPitchChange(pitch);
  }, [pitch, onPitchChange]);

  // Get vocal range classification
  const getVocalRange = (frequency: number): string => {
    if (frequency < 160) return 'Bass';
    if (frequency < 240) return 'Tenor';
    if (frequency < 340) return 'Alto';
    return 'Soprano';
  };

  // Convert Hz to solfège notation with octave
  const getNoteName = (frequency: number): string | null => {
    const noteNames = ['Do', 'Do#', 'Re', 'Re#', 'Mi', 'Fa', 'Fa#', 'Sol', 'Sol#', 'La', 'La#', 'Si'];
    
    // Calculate note index using frequency
    const noteNumber = 12 * (Math.log2(frequency / 130.81)); // 130.81 is Do3
    const noteIndex = Math.round(noteNumber) % 12;
    
    // If frequency is closer to Do4 (261.63 Hz) than Do3 (130.81 Hz)
    if (frequency >= 246.94) { // Si3 frequency
      return `${noteNames[noteIndex]}4`;
    } else {
      return `${noteNames[noteIndex]}3`;
    }
  };

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Voice Pitch Detector</h2>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      <div className="space-y-4">
        <button
          onClick={isListening ? stopListening : startListening}
          className={`px-4 py-2 rounded ${
            isListening 
              ? 'bg-red-500 hover:bg-red-600' 
              : 'bg-green-500 hover:bg-green-600'
          } text-white`}
        >
          {isListening ? 'Stop Listening' : 'Start Listening'}
        </button>

        <div>
          <p>Status: {isListening ? 'Listening' : 'Not Listening'}</p>
          {isListening && (
            <p>
              Volume: {currentDb ? `${currentDb} dB` : 'N/A'}
              {currentDb && (
                <span className={currentDb > thresholdDb ? ' text-green-600' : ' text-red-600'}>
                  {' '}({currentDb > thresholdDb ? 'Above' : 'Below'} threshold)
                </span>
              )}
            </p>
          )}
        </div>

        {pitch && (
          <div className="space-y-2">
            <p>Frequency: {pitch.toFixed(1)} Hz</p>
            <p>Note: {getNoteName(pitch) || 'Outside Do3-Do4 range'}</p>
            <p className="text-sm text-gray-600">
              Range: Do3 (130.81 Hz) to Do4 (261.63 Hz)
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default MicrophoneListener;