import React, { useState, useEffect } from 'react';
import { WordItem } from '../types';
import { Button } from './Button';
import { playPronunciation } from '../services/geminiService';
import { Volume2, CheckCircle, XCircle, ArrowRight, Star } from 'lucide-react';

interface QuizCardProps {
  wordData: WordItem;
  onResult: (isCorrect: boolean) => void;
  onNext: () => void;
  currentIndex: number;
  total: number;
}

export const QuizCard: React.FC<QuizCardProps> = ({ 
  wordData, 
  onResult, 
  onNext, 
  currentIndex, 
  total 
}) => {
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);

  // Reset state when word changes
  useEffect(() => {
    setSelectedOption(null);
    setIsAnswered(false);
  }, [wordData]);

  const handleSelect = (option: string) => {
    if (isAnswered) return;
    
    setSelectedOption(option);
    setIsAnswered(true);
    
    const correct = option === wordData.correctMeaning;
    onResult(correct);

    if (correct) {
      // Auto-advance logic for correct answer
      // Wait a brief moment to show the green "Correct" state, then move on.
      setTimeout(() => {
        onNext();
      }, 700); 
    } else {
      // Wrong answer logic
      // Play audio automatically so they learn the pronunciation
      // Keep UI interactive so they can read the correct meaning and click "Next" manually
      handlePlayAudio(); 
    }
  };

  const handlePlayAudio = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (isLoadingAudio) return;
    setIsLoadingAudio(true);
    try {
      await playPronunciation(wordData.word);
    } finally {
      setIsLoadingAudio(false);
    }
  };

  const isWrong = isAnswered && selectedOption !== wordData.correctMeaning;

  return (
    <div className="w-full max-w-md mx-auto animate-pop">
      {/* Progress */}
      <div className="mb-6 flex justify-between items-center text-sm font-medium text-gray-500">
        <span>Word {currentIndex + 1} of {total}</span>
        <div className="h-2 w-32 bg-gray-200 rounded-full overflow-hidden">
          <div 
            className="h-full bg-indigo-500 transition-all duration-500"
            style={{ width: `${((currentIndex + 1) / total) * 100}%` }}
          />
        </div>
      </div>

      {/* Card Content */}
      <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-8 text-center relative overflow-hidden">
        
        {/* Word Display */}
        <div className="mb-8 relative">
           {/* Decorative background element */}
           <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 bg-indigo-50 rounded-full -z-10 blur-xl"></div>
           
          <h2 className="text-4xl font-bold text-gray-800 mb-2 tracking-tight">{wordData.word}</h2>
          <button 
            onClick={handlePlayAudio}
            disabled={isLoadingAudio}
            className="inline-flex items-center gap-2 text-indigo-500 hover:text-indigo-700 transition-colors text-sm font-medium bg-white border border-indigo-100 px-4 py-1.5 rounded-full shadow-sm"
          >
            <Volume2 size={16} className={isLoadingAudio ? 'animate-pulse' : ''} />
            {isLoadingAudio ? 'Loading...' : 'Play Audio'}
          </button>
        </div>

        {/* Options */}
        <div className="space-y-3">
          {wordData.options.map((option, idx) => {
            let btnStyle = "bg-gray-50 text-gray-700 hover:bg-gray-100 border-transparent hover:shadow-md";
            let icon = null;

            if (isAnswered) {
              if (option === wordData.correctMeaning) {
                // Correct answer style
                btnStyle = "bg-green-50 text-green-800 border-green-400 ring-1 ring-green-400 font-medium";
                icon = <CheckCircle size={20} className="text-green-600 flex-shrink-0" />;
              } else if (option === selectedOption) {
                // Wrong selection style
                btnStyle = "bg-red-50 text-red-800 border-red-400 ring-1 ring-red-400";
                icon = <XCircle size={20} className="text-red-600 flex-shrink-0" />;
              } else {
                // Other options fade out
                btnStyle = "opacity-40 bg-gray-50 cursor-default";
              }
            }

            return (
              <button
                key={idx}
                onClick={() => handleSelect(option)}
                disabled={isAnswered}
                className={`w-full p-4 rounded-xl text-left border-2 transition-all duration-200 flex justify-between items-center group ${btnStyle}`}
              >
                <span className="text-lg leading-snug">{option}</span>
                {icon}
              </button>
            );
          })}
        </div>

        {/* Feedback / Next Button - ONLY SHOW IF WRONG */}
        {isWrong && (
          <div className="mt-8 pt-6 border-t border-gray-100 animate-pop">
            <div className="mb-6 min-h-[3rem] flex items-center justify-center">
              <div className="text-red-500 font-medium flex flex-col items-center animate-shake">
                <span className="text-lg font-bold">Not quite.</span>
                <span className="text-sm text-gray-600 mt-1">
                  The correct meaning is <span className="font-bold text-gray-800">"{wordData.correctMeaning}"</span>
                </span>
              </div>
            </div>
            <Button onClick={onNext} fullWidth className="group bg-indigo-600 hover:bg-indigo-700 text-white shadow-xl shadow-indigo-100">
              Next Word <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
