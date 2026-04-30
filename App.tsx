import React, { useState, useCallback, useEffect } from 'react';
import { Upload, FileText, Loader2, Trophy, RefreshCcw, BookOpen, AlertCircle, BookMarked, Trash2, Volume2, PlayCircle, Home } from 'lucide-react';
import { Button } from './components/Button';
import { QuizCard } from './components/QuizCard';
import { extractVocabFromPdf, playPronunciation } from './services/geminiService';
import { getNotebook, saveToNotebook, removeFromNotebook } from './services/storageService';
import { WordItem, AppState, QuizState } from './types';

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.UPLOAD);
  const [words, setWords] = useState<WordItem[]>([]);
  const [notebookWords, setNotebookWords] = useState<WordItem[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);
  const [loadingText, setLoadingText] = useState("Initializing...");
  const [foundCount, setFoundCount] = useState(0); // Track real-time count
  
  const [quizState, setQuizState] = useState<QuizState>({
    currentIndex: 0,
    score: 0,
    correctIds: [],
    wrongIds: [],
    streak: 0
  });

  // Load notebook on mount
  useEffect(() => {
    setNotebookWords(getNotebook());
  }, []);

  // Handle File Upload
  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      setErrorMsg("Please upload a PDF file.");
      return;
    }

    setAppState(AppState.PROCESSING);
    setErrorMsg(null);
    setFoundCount(0);
    // Initial state: uploading and waiting for the first token
    setLoadingText("Uploading & Analyzing PDF...");

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const base64String = (e.target?.result as string).split(',')[1];
        
        // Pass a callback to update UI in real-time
        const extractedWords = await extractVocabFromPdf(base64String, (count, statusMsg) => {
          setFoundCount(count);
          setLoadingText(statusMsg);
        });
        
        if (extractedWords.length === 0) {
          throw new Error("No suitable vocabulary found in this document.");
        }

        setWords(extractedWords);
        setAppState(AppState.QUIZ);
        setQuizState({
          currentIndex: 0,
          score: 0,
          correctIds: [],
          wrongIds: [],
          streak: 0
        });
      } catch (err: any) {
        console.error(err);
        setErrorMsg(err.message || "Failed to process PDF. Please check your connection.");
        setAppState(AppState.UPLOAD);
      }
    };
    reader.readAsDataURL(file);
  }, []);

  // Quiz Logic
  const handleQuizResult = (isCorrect: boolean) => {
    const currentWord = words[quizState.currentIndex];
    
    // Auto-save to notebook if wrong
    if (!isCorrect) {
      saveToNotebook(currentWord);
      // Update local state to reflect change immediately if needed
      setNotebookWords(getNotebook());
    }

    setQuizState(prev => ({
      ...prev,
      score: isCorrect ? prev.score + 1 : prev.score,
      streak: isCorrect ? prev.streak + 1 : 0,
      correctIds: isCorrect ? [...prev.correctIds, currentWord.id] : prev.correctIds,
      wrongIds: !isCorrect ? [...prev.wrongIds, currentWord.id] : prev.wrongIds,
    }));
  };

  const handleNextQuestion = () => {
    if (quizState.currentIndex < words.length - 1) {
      setQuizState(prev => ({
        ...prev,
        currentIndex: prev.currentIndex + 1
      }));
    } else {
      setAppState(AppState.SUMMARY);
    }
  };

  const handleRestart = () => {
    setAppState(AppState.UPLOAD);
    setWords([]);
  };

  const handleRetryWrong = () => {
    const wrongWords = words.filter(w => quizState.wrongIds.includes(w.id));
    startQuiz(wrongWords);
  };

  const startQuiz = (quizWords: WordItem[]) => {
    setWords(quizWords);
    setQuizState({
      currentIndex: 0,
      score: 0,
      correctIds: [],
      wrongIds: [],
      streak: 0
    });
    setAppState(AppState.QUIZ);
  };

  // Notebook Logic
  const handleOpenNotebook = () => {
    setNotebookWords(getNotebook());
    setAppState(AppState.NOTEBOOK);
  };

  const handleRemoveFromNotebook = (e: React.MouseEvent, word: string) => {
    e.stopPropagation();
    removeFromNotebook(word);
    setNotebookWords(getNotebook());
  };

  const handleNotebookAudio = async (e: React.MouseEvent, word: string) => {
    e.stopPropagation();
    if (playingAudio) return;
    setPlayingAudio(word);
    try {
      await playPronunciation(word);
    } finally {
      setPlayingAudio(null);
    }
  };

  // Render Screens
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      
      {/* Header */}
      <header className="fixed top-0 left-0 w-full p-4 md:p-6 flex justify-between items-center z-50 bg-gradient-to-b from-gray-50 to-transparent pointer-events-none">
        <button 
          onClick={() => setAppState(AppState.UPLOAD)}
          className="flex items-center gap-2 text-indigo-700 pointer-events-auto hover:opacity-80 transition-opacity"
        >
          <BookOpen className="w-6 h-6" />
          <h1 className="font-bold text-xl tracking-tight hidden md:block">KaoyanVocab</h1>
        </button>

        <div className="flex gap-3 pointer-events-auto">
          {appState === AppState.QUIZ ? (
            <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-full shadow-sm border border-gray-100">
              <span className="text-orange-500">🔥</span>
              <span className="font-bold text-gray-700">{quizState.streak}</span>
            </div>
          ) : (
            <>
              {appState !== AppState.UPLOAD && (
                <button 
                  onClick={() => setAppState(AppState.UPLOAD)}
                  className="p-2 bg-white rounded-full shadow-sm border border-gray-200 text-gray-600 hover:text-indigo-600 transition-colors"
                  title="Home"
                >
                  <Home size={20} />
                </button>
              )}
              {appState !== AppState.NOTEBOOK && (
                <button 
                  onClick={handleOpenNotebook}
                  className="flex items-center gap-2 px-4 py-2 bg-white rounded-full shadow-sm border border-gray-200 text-gray-700 hover:text-indigo-600 hover:border-indigo-200 transition-all font-medium"
                >
                  <BookMarked size={18} />
                  <span className="hidden sm:inline">Notebook</span>
                </button>
              )}
            </>
          )}
        </div>
      </header>

      <main className="w-full max-w-2xl flex flex-col items-center pt-16">
        
        {/* Screen: UPLOAD */}
        {appState === AppState.UPLOAD && (
          <div className="text-center w-full max-w-md animate-pop mt-8">
            <div className="bg-white p-10 rounded-3xl shadow-xl border border-dashed border-gray-300 hover:border-indigo-400 transition-colors cursor-pointer relative group">
              <input 
                type="file" 
                accept="application/pdf"
                onChange={handleFileUpload}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              />
              <div className="bg-indigo-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-300">
                <Upload className="w-10 h-10 text-indigo-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-800 mb-2">Upload Exam PDF</h2>
              <p className="text-gray-500 mb-6">Drag & drop your Kaoyan reading paper here.</p>
              <Button className="pointer-events-none">Select PDF File</Button>
            </div>
            
            {errorMsg && (
              <div className="mt-6 bg-red-50 text-red-600 p-4 rounded-xl flex items-center gap-3 animate-shake">
                <AlertCircle size={20} />
                <p className="font-medium">{errorMsg}</p>
              </div>
            )}
            
            <p className="mt-8 text-sm text-gray-400">
              AI-powered analysis covers Cloze, Reading & Translation sections.
            </p>
          </div>
        )}

        {/* Screen: PROCESSING */}
        {appState === AppState.PROCESSING && (
          <div className="text-center animate-pop mt-20">
            <div className="relative">
              <div className="absolute inset-0 bg-indigo-200 rounded-full blur-xl opacity-20 animate-pulse"></div>
              <Loader2 className="w-16 h-16 text-indigo-600 animate-spin mx-auto relative z-10" />
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mt-8 mb-2">Analyzing Paper...</h2>
            
            {/* Real-time Progress Indicator */}
            <div className="flex flex-col items-center gap-2">
              <div className="bg-indigo-50 text-indigo-700 px-4 py-1 rounded-full text-sm font-bold shadow-sm">
                Words Found: {foundCount}
              </div>
              <p className="text-gray-500 max-w-sm mx-auto min-h-[1.5rem] transition-all duration-300 font-mono text-sm text-center">
                {loadingText}
              </p>
              {foundCount === 0 && (
                 <p className="text-xs text-gray-400 mt-2 animate-pulse">Large PDFs may take a moment to start...</p>
              )}
            </div>
          </div>
        )}

        {/* Screen: QUIZ */}
        {appState === AppState.QUIZ && words.length > 0 && (
          <div className="w-full mt-4">
             <QuizCard 
               wordData={words[quizState.currentIndex]}
               onResult={handleQuizResult}
               onNext={handleNextQuestion}
               currentIndex={quizState.currentIndex}
               total={words.length}
             />
          </div>
        )}

        {/* Screen: NOTEBOOK */}
        {appState === AppState.NOTEBOOK && (
          <div className="w-full max-w-xl animate-pop pb-20">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-gray-800 mb-2">My Word Notebook</h2>
              <p className="text-gray-500">Words you missed are saved here automatically.</p>
            </div>

            {notebookWords.length === 0 ? (
              <div className="text-center py-20 bg-white rounded-3xl border border-gray-100 shadow-sm">
                <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <BookMarked className="text-gray-300" size={32} />
                </div>
                <p className="text-gray-400 font-medium">No words saved yet.</p>
                <p className="text-sm text-gray-300 mt-1">Mistakes from quizzes will appear here.</p>
                <Button onClick={() => setAppState(AppState.UPLOAD)} variant="secondary" className="mt-6">
                  Start a Quiz
                </Button>
              </div>
            ) : (
              <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
                <div className="p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                  <span className="font-semibold text-gray-600 pl-2">{notebookWords.length} Words</span>
                  <Button onClick={() => startQuiz(notebookWords)} className="px-4 py-2 text-sm">
                    <PlayCircle size={16} /> Review All
                  </Button>
                </div>
                <div className="divide-y divide-gray-100 max-h-[60vh] overflow-y-auto">
                  {notebookWords.map((item) => (
                    <div key={item.word} className="p-4 hover:bg-indigo-50 transition-colors flex justify-between items-center group">
                      <div>
                        <div className="font-bold text-gray-800 text-lg">{item.word}</div>
                        <div className="text-gray-500 text-sm">{item.correctMeaning}</div>
                      </div>
                      <div className="flex items-center gap-2 opacity-60 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={(e) => handleNotebookAudio(e, item.word)}
                          className={`p-2 rounded-full hover:bg-white hover:shadow-sm text-indigo-500 transition-all ${playingAudio === item.word ? 'animate-pulse bg-indigo-100' : ''}`}
                          title="Pronounce"
                        >
                          <Volume2 size={20} />
                        </button>
                        <button 
                          onClick={(e) => handleRemoveFromNotebook(e, item.word)}
                          className="p-2 rounded-full hover:bg-white hover:shadow-sm text-gray-400 hover:text-red-500 transition-all"
                          title="Remove"
                        >
                          <Trash2 size={20} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Screen: SUMMARY */}
        {appState === AppState.SUMMARY && (
          <div className="text-center w-full max-w-md animate-pop mt-8">
            <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-8">
              <div className="w-24 h-24 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <Trophy className="w-12 h-12 text-yellow-600" />
              </div>
              
              <h2 className="text-3xl font-bold text-gray-800 mb-2">Quiz Complete!</h2>
              <p className="text-gray-500 mb-8">Mistakes have been added to your notebook.</p>

              <div className="grid grid-cols-2 gap-4 mb-8">
                <div className="bg-gray-50 p-4 rounded-2xl">
                  <div className="text-3xl font-bold text-indigo-600">{quizState.score}</div>
                  <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">Correct</div>
                </div>
                <div className="bg-gray-50 p-4 rounded-2xl">
                  <div className="text-3xl font-bold text-indigo-600">{words.length}</div>
                  <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">Total</div>
                </div>
              </div>

              <div className="space-y-3">
                {quizState.wrongIds.length > 0 && (
                  <Button onClick={handleRetryWrong} variant="secondary" fullWidth>
                    <RefreshCcw size={18} /> Review Mistakes Now
                  </Button>
                )}
                <Button onClick={handleOpenNotebook} variant="outline" fullWidth>
                  <BookMarked size={18} /> Go to Notebook
                </Button>
                <Button onClick={handleRestart} fullWidth>
                  <FileText size={18} /> Upload New PDF
                </Button>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
};

export default App;