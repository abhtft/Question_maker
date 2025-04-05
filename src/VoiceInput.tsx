import React, { useState, useRef, useEffect } from 'react';

interface VoiceInputProps {
  onTextReceived: (text: string) => void;
}

// Declare the SpeechRecognition type
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

const VoiceInput: React.FC<VoiceInputProps> = ({ onTextReceived }) => {
  const [isRecording, setIsRecording] = useState(false);
  
  // Speech recognition ref
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    // Check for browser support and HTTPS
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const isSecure = window.location.protocol === 'https:';
    
    if (!isLocalhost && !isSecure) {
      console.error('Voice recording requires HTTPS (except on localhost)');
      alert('Voice input requires HTTPS. Please use HTTPS or localhost.');
      return;
    }

    // Initialize speech recognition
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.error('Speech recognition not supported');
      alert('Speech recognition is not supported in this browser');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event: any) => {
      const last = event.results.length - 1;
      const text = event.results[last][0].transcript;
      
      if (event.results[last].isFinal) {
        onTextReceived(text);
      }
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      setIsRecording(false);
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    recognitionRef.current = recognition;

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, [onTextReceived]);

  const startRecording = () => {
    if (!recognitionRef.current) {
      console.error('Speech recognition not initialized');
      return;
    }

    try {
      recognitionRef.current.start();
      setIsRecording(true);
      console.log('Started recording...');
    } catch (error) {
      console.error('Error starting recording:', error);
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    if (!recognitionRef.current) {
      return;
    }

    try {
      recognitionRef.current.stop();
      console.log('Stopped recording...');
    } catch (error) {
      console.error('Error stopping recording:', error);
      setIsRecording(false);
    }
  };

  return (
    <div 
      className="voice-input-container"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onMouseUp={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      onTouchEnd={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        className={`voice-button ${isRecording ? 'recording' : ''}`}
        onPointerDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          startRecording();
          return false;
        }}
        onPointerUp={(e) => {
          e.preventDefault();
          e.stopPropagation();
          stopRecording();
          return false;
        }}
        onPointerLeave={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (isRecording) {
            stopRecording();
          }
          return false;
        }}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          return false;
        }}
      >
        🎤
      </button>
    </div>
  );
};

export default VoiceInput;