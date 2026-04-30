export interface WordItem {
  id: string;
  word: string;
  correctMeaning: string; // Chinese meaning
  options: string[]; // Mixed correct and incorrect options
  originalContext?: string; // Optional sentence from text
}

export enum AppState {
  UPLOAD,
  PROCESSING,
  QUIZ,
  SUMMARY,
  NOTEBOOK
}

export interface QuizState {
  currentIndex: number;
  score: number;
  correctIds: string[];
  wrongIds: string[];
  streak: number;
}
