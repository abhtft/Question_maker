import React, { useState, useRef, useEffect } from 'react';

interface VoiceInputProps {
  onTextReceived: (text: string) => void;
  isRecording: boolean;
  setIsRecording: (isRecording: boolean) => void;
  onTranscriptCorrected?: (original: string, corrected: string) => void;
}

// Common word replacements for better accuracy
const WORD_REPLACEMENTS: { [key: string]: string } = {
  'bank': 'brand',
  'brands': 'brand',
  'x': 'eggs',
  'eggs': 'eggs',
  'packs': 'packets',
  'packet': 'packets',
  'package': 'packets',
  'packages': 'packets',
  'kg': 'kg',
  'kgs': 'kg',
  'kilos': 'kg',
  'kilogram': 'kg',
  'kilograms': 'kg',
  'dozen': 'dozen',
  'dozens': 'dozen',
  'doz': 'dozen',
  'hi': 'high',
  'height': 'high',
  'hide': 'high',
  'low': 'low',
  'medium': 'medium',
  'mid': 'medium',
};

const PROMPT_TEMPLATE = "[QUANTITY] [UNIT] of [ITEM] from [BRAND] with [PRIORITY] priority [DETAILS]";
const PROMPT_EXAMPLES = [
  "5 dozen eggs from Farm Fresh with medium priority and ensure they are organic",
  "2 kg rice from India Gate with high priority and basmati quality",
  "3 packets biscuits from Parle with low priority and glucose flavor"
];

const VoiceInput: React.FC<VoiceInputProps> = ({ 
  onTextReceived, 
  isRecording, 
  setIsRecording,
  onTranscriptCorrected 
}) => {
  const [error, setError] = useState<string>('');
  const [showPromptGuide, setShowPromptGuide] = useState(false);
  const [isSpeechSupported, setIsSpeechSupported] = useState(true);
  const recognitionRef = useRef<any>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  // Check browser support on mount
  useEffect(() => {
    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) {
      setIsSpeechSupported(false);
      setError('Speech recognition is not supported in this browser. Please try Chrome, Edge, or Safari.');
    }
  }, []);

  const processTranscript = (text: string): string => {
    // Convert to lowercase for better matching
    let processedText = text.toLowerCase();

    // Replace common misheard words
    const words = processedText.split(' ');
    const correctedWords = words.map(word => {
      const trimmedWord = word.trim();
      return WORD_REPLACEMENTS[trimmedWord] || trimmedWord;
    });

    // Join words back and capitalize first letter of sentences
    const result = correctedWords.join(' ')
      .replace(/(?:^|\.\s+)([a-z])/g, (match) => match.toUpperCase());

    // If there's a correction callback and the text was modified, notify
    if (onTranscriptCorrected && result !== text) {
      onTranscriptCorrected(text, result);
    }

    return result;
  };

  const startRecording = async () => {
    if (!isSpeechSupported) {
      setError('Speech recognition is not supported in this browser. Please try Chrome, Edge, or Safari.');
      return;
    }

    try {
      // Get audio stream first
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      // Initialize Web Speech API
      const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognitionAPI();
      recognitionRef.current = recognition;

      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      let finalTranscript = '';

      recognition.onresult = (event: any) => {
        let interimTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript + ' ';
          } else {
            interimTranscript += transcript;
          }
        }
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        let errorMessage = 'Speech recognition error. Please try again.';
        
        switch (event.error) {
          case 'network':
            errorMessage = 'Network error occurred. Please check your internet connection.';
            break;
          case 'not-allowed':
          case 'permission-denied':
            errorMessage = 'Microphone access denied. Please allow microphone access and try again.';
            break;
          case 'no-speech':
            errorMessage = 'No speech detected. Please try speaking again.';
            break;
          case 'audio-capture':
            errorMessage = 'No microphone detected. Please ensure your microphone is connected.';
            break;
        }
        
        setError(errorMessage);
        stopRecording();
      };

      recognition.onend = () => {
        setIsRecording(false);
        // Process and send the final transcript when recording ends
        if (finalTranscript) {
          const processedText = processTranscript(finalTranscript.trim());
          onTextReceived(processedText);
        }
      };

      recognition.start();
      setIsRecording(true);
      setError('');
    } catch (error: any) {
      let errorMessage = 'Failed to start speech recognition. Please check browser compatibility.';
      
      if (error.name === 'NotAllowedError') {
        errorMessage = 'Microphone access denied. Please allow microphone access and try again.';
      } else if (error.name === 'NotFoundError') {
        errorMessage = 'No microphone detected. Please ensure your microphone is connected.';
      }
      
      setError(errorMessage);
      console.error('Speech recognition error:', error);
    }
  };

  const stopRecording = () => {
    if (recognitionRef.current && isRecording) {
      recognitionRef.current.stop();
      setIsRecording(false);

      // Clean up audio resources
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
        mediaStreamRef.current = null;
      }
    }
  };

  const handlePointerDown = async (e: React.PointerEvent) => {
    e.preventDefault(); // Prevent default to enable hold gesture
    await startRecording();
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    e.preventDefault();
    stopRecording();
  };

  const handlePointerLeave = (e: React.PointerEvent) => {
    e.preventDefault();
    if (isRecording) {
      stopRecording();
    }
  };

  if (!isSpeechSupported) {
    return (
      <div className="voice-input-wrapper">
        <div className="voice-input-container">
          <div className="error-message">
            Speech recognition is not supported in this browser. Please try Chrome, Edge, or Safari.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="voice-input-wrapper">
      <div className="voice-input-container">
        <button
          type="button"
          className={`voice-button ${isRecording ? 'recording' : ''}`}
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerLeave}
          title="Press and hold to speak"
          onMouseEnter={() => setShowPromptGuide(true)}
          onMouseLeave={() => setShowPromptGuide(false)}
          disabled={!isSpeechSupported}
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
              <rect x="6" y="6" width="12" height="12" />
            ) : (
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
      
      {showPromptGuide && (
        <div className="prompt-guide">
          <div className="prompt-template">
            <h4>Press and hold to speak:</h4>
            <p>{PROMPT_TEMPLATE}</p>
          </div>
          <div className="prompt-examples">
            <h4>Examples:</h4>
            <ul>
              {PROMPT_EXAMPLES.map((example, index) => (
                <li key={index}>{example}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

export default VoiceInput;