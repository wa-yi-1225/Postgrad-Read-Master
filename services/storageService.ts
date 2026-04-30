import { WordItem } from '../types';

const STORAGE_KEY = 'kaoyan_vocab_notebook_v1';

export const getNotebook = (): WordItem[] => {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.error("Failed to load notebook", e);
    return [];
  }
};

export const saveToNotebook = (word: WordItem) => {
  const current = getNotebook();
  // Avoid duplicates by checking word text (case-insensitive)
  const exists = current.some(w => w.word.toLowerCase() === word.word.toLowerCase());
  
  if (!exists) {
    const updated = [word, ...current];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  }
};

export const removeFromNotebook = (wordText: string) => {
  const current = getNotebook();
  const updated = current.filter(w => w.word !== wordText);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
};

export const clearNotebook = () => {
  localStorage.removeItem(STORAGE_KEY);
};
