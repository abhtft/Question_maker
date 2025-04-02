import React, { useState, useEffect } from 'react';

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

  useEffect(() => {
    // Initialize speech recognition when component mounts
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognitionInstance = new SpeechRecognition() as SpeechRecognition;
      recognitionInstance.lang = 'en-US';
      recognitionInstance.continuous = true;
      recognitionInstance.interimResults = true;

      recognitionInstance.onstart = () => {
        setIsRecording(true);
        setError('');
      };

      recognitionInstance.onresult = (event: SpeechRecognitionEvent) => {
        let finalTranscript = '';
        let interimTranscript = '';

        // Combine all results
        const results = event.results;
        for (let i = 0; i < Object.keys(results).length; i++) {
          const result = results[i];
          if (result && result[0]) {
            const transcript = result[0].transcript;
            if (result[0].isFinal) {
              finalTranscript += transcript + ' ';
            } else {
              interimTranscript += transcript;
            }
          }
        }

        // Update the text field with both final and interim results
        onTextReceived((finalTranscript + interimTranscript).trim());
      };

      recognitionInstance.onerror = (event: { error: string }) => {
        setError('Error occurred in recognition: ' + event.error);
        setIsRecording(false);
        recognitionInstance.stop();
        setRecognition(null);
      };

      recognitionInstance.onend = () => {
        setIsRecording(false);
        setRecognition(null);
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
    };
  }, []);

  const startRecording = () => {
    if (recognition) {
      try {
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