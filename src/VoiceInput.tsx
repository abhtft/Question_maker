import React, { useState, useEffect, useRef } from 'react';

interface VoiceInputProps {
  onTextReceived: (text: string) => void;
  isRecording: boolean;
  setIsRecording: (isRecording: boolean) => void;
}

// Add type definitions for SpeechRecognition API
interface SpeechRecognitionResult {
  [key: number]: {
    [key: number]: {
      transcript: string;
      isFinal: boolean;
    };
  };
}

interface SpeechRecognitionEvent {
  results: SpeechRecognitionResult;
}

interface SpeechRecognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onstart: () => void;
  onresult: (event: SpeechRecognitionEvent) => void;
  onerror: (event: { error: string }) => void;
  onend: () => void;
  onspeechend: () => void;
  onnomatch: () => void;
}

// Declare global types for Web Speech API
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

const VoiceInput: React.FC<VoiceInputProps> = ({ onTextReceived, isRecording, setIsRecording }) => {
  const [error, setError] = useState<string>('');
  const [recognition, setRecognition] = useState<SpeechRecognition | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const finalTranscriptRef = useRef<string>('');

  useEffect(() => {
    // Initialize speech recognition when component mounts
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognitionInstance = new SpeechRecognition() as SpeechRecognition;
      recognitionInstance.lang = 'en-US';
      recognitionInstance.continuous = false; // Changed to false to stop after each utterance
      recognitionInstance.interimResults = true;

      recognitionInstance.onstart = () => {
        setIsRecording(true);
        setError('');
        finalTranscriptRef.current = '';
      };

      recognitionInstance.onresult = (event: SpeechRecognitionEvent) => {
        let finalTranscript = finalTranscriptRef.current;
        let interimTranscript = '';

        // Combine all results
        const results = event.results;
        for (let i = 0; i < Object.keys(results).length; i++) {
          const result = results[i];
          if (result && result[0]) {
            const transcript = result[0].transcript;
            if (result[0].isFinal) {
              finalTranscript += transcript + ' ';
              finalTranscriptRef.current = finalTranscript;
            } else {
              interimTranscript += transcript;
            }
          }
        }

        // Update the text field with both final and interim results
        onTextReceived((finalTranscript + interimTranscript).trim());

        // Reset the auto-stop timer
        if (timeoutRef.current) {
          window.clearTimeout(timeoutRef.current);
        }
        timeoutRef.current = window.setTimeout(() => {
          if (recognition && isRecording) {
            recognition.stop();
          }
        }, 1500); // Stop after 1.5 seconds of silence
      };

      recognitionInstance.onerror = (event: { error: string }) => {
        if (event.error !== 'no-speech') { // Ignore no-speech errors
          setError('Error occurred in recognition: ' + event.error);
        }
        setIsRecording(false);
        recognitionInstance.stop();
      };

      recognitionInstance.onend = () => {
        setIsRecording(false);
        if (timeoutRef.current) {
          window.clearTimeout(timeoutRef.current);
        }
      };

      recognitionInstance.onspeechend = () => {
        // Stop recognition when speech ends
        recognitionInstance.stop();
      };

      setRecognition(recognitionInstance);
    } else {
      setError('Speech recognition is not supported in this browser.');
    }

    // Cleanup when component unmounts
    return () => {
      if (recognition) {
        recognition.stop();
      }
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const startRecording = () => {
    if (recognition) {
      try {
        finalTranscriptRef.current = '';
        recognition.start();
      } catch (error) {
        setError('Failed to start recording. Please try again.');
      }
    } else {
      setError('Speech recognition is not available.');
    }
  };

  const stopRecording = () => {
    if (recognition) {
      recognition.stop();
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
    }
  };

  return (
    <div className="voice-input-container">
      <button
        type="button"
        className={`voice-button ${isRecording ? 'recording' : ''}`}
        onClick={isRecording ? stopRecording : startRecording}
        title={isRecording ? "Stop recording" : "Start recording"}
        disabled={!recognition}
      >
        <svg 
          viewBox="0 0 24 24" 
          width="24" 
          height="24" 
          stroke="currentColor" 
          strokeWidth="2" 
          fill="none" 
          strokeLinecap="round" 
          strokeLinejoin="round"
        >
          {isRecording ? (
            // Stop icon when recording
            <rect x="6" y="6" width="12" height="12" />
          ) : (
            // Microphone icon when not recording
            <>
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
              <line x1="12" y1="19" x2="12" y2="23"></line>
              <line x1="8" y1="23" x2="16" y2="23"></line>
            </>
          )}
        </svg>
      </button>
      {error && <div className="error-message">{error}</div>}
    </div>
  );
};

export default VoiceInput; 