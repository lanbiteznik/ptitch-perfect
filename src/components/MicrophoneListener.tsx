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
  const minFreq = 130.81;  // Do3
  const maxFreq = 265.0;   // Slightly above Do4 (261.63 Hz)
  const minPeriod = Math.floor(options.sampleRate / maxFreq);
  const maxPeriod = Math.ceil(options.sampleRate / minFreq);

  const c = acf(buf);
  const { max, maxIndex } = findMax(c, minPeriod, maxPeriod);
  
  if (maxIndex <= 0) return null;
  
  const threshold = 0.2;
  const normalizedMax = max / c[0];
  if (normalizedMax < threshold) return null;
  
  const interpolatedIndex = parabolicInterpolation(c, maxIndex);
  const frequency = options.sampleRate / interpolatedIndex;
  
  if (frequency < minFreq || frequency > maxFreq) return null;
  
  return frequency;
};

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
  const thresholdDb = -15;

  const updatePitch = (analyser: AnalyserNode, options: { sampleRate: number }) => {
    const buf = new Float32Array(analyser.fftSize);
    analyser.getFloatTimeDomainData(buf);

    const rms = Math.sqrt(buf.reduce((sum, value) => sum + value * value, 0) / buf.length);
    const db = 20 * Math.log10(rms);
    setCurrentDb(Math.round(db));

    if (db > thresholdDb) {
      const detectedPitch = calculatePitch(buf, options);
      
      if (detectedPitch) {
        pitchHistory.current.push(detectedPitch);
        if (pitchHistory.current.length > 5) {
          pitchHistory.current.shift();
        }
        
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
    onPitchChange(pitch);
  }, [pitch, onPitchChange]);

  const getVocalRange = (frequency: number): string => {
    if (frequency < 160) return 'Bass';
    if (frequency < 240) return 'Tenor';
    if (frequency < 340) return 'Alto';
    return 'Soprano';
  };

  const getNoteName = (frequency: number): string | null => {
    const noteFrequencies = [
      { note: 'Do3', freq: 130.81 },
      { note: 'Re3', freq: 146.83 },
      { note: 'Mi3', freq: 164.81 },
      { note: 'Fa3', freq: 174.61 },
      { note: 'Sol3', freq: 196.00 },
      { note: 'La3', freq: 220.00 },
      { note: 'Si3', freq: 246.94 },
      { note: 'Do4', freq: 261.63 }
    ];

    let closestNote = noteFrequencies[0];
    let minDiff = Math.abs(frequency - noteFrequencies[0].freq);

    for (const note of noteFrequencies) {
      const diff = Math.abs(frequency - note.freq);
      if (diff < minDiff) {
        minDiff = diff;
        closestNote = note;
      }
    }

    return closestNote.note;
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