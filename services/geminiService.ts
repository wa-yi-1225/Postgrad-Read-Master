import { GoogleGenAI, Modality, GenerateContentResponse } from "@google/genai";
import { WordItem } from "../types";

// Helper to shuffle array
const shuffleArray = <T,>(array: T[]): T[] => {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
};

// Helper: Decode Base64 to PCM AudioBuffer
async function decodeAudioData(
  base64Data: string,
  ctx: AudioContext,
  sampleRate: number = 24000,
  numChannels: number = 1
): Promise<AudioBuffer> {
  const binaryString = atob(base64Data);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  const dataInt16 = new Int16Array(bytes.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

// 1. Extract Words from PDF (Streaming Version)
export const extractVocabFromPdf = async (
  base64Pdf: string,
  onProgress?: (count: number, statusMessage: string) => void
): Promise<WordItem[]> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  // OPTIMIZATIONS:
  // 1. MAX OUTPUT TOKENS: Set to 8192 to allow for massive lists (300-500 words).
  // 2. EXHAUSTIVE PROMPT: Explicitly tell the model to be "dense" and "exhaustive".
  // 3. STREAMING: Immediate start.
  const systemInstruction = `
    You are a high-density vocabulary extractor for Kaoyan English exams.

    MANDATE:
    Extract **EVERY** difficult word from Section I, II, and III. 
    Do NOT filter aggressively. It is better to have too many words than too few.
    Target quantity: **300+ words** for a full paper.

    STRICT EXECUTION PATH:
    1. Print \`<<<SECTION: Cloze/完形>>>\`. Scan Section I (Use of English). Extract from text AND options.
    2. Print \`<<<SECTION: Reading/阅读>>>\`. Scan Section II (Reading A/B/C). 
       - Scan ALL 4 Texts.
       - Scan ALL Question Stems.
       - Scan ALL Options (A/B/C/D).
    3. Print \`<<<SECTION: Translation/翻译>>>\`. Scan Section III.

    EXCLUDE ONLY:
    - Section IV (Writing).
    - Extremely basic words (is, am, are, student, teacher).
    - Names/Places.

    OUTPUT FORMAT (Raw Text, No Markdown):
    Word|ChineseMeaning
    
    Example:
    <<<SECTION: Cloze/完形>>>
    ambiguous|模棱两可
    arbitrary|武断的
    ...
  `;

  try {
    const result = await ai.models.generateContentStream({
      model: "gemini-2.5-flash",
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: "application/pdf",
              data: base64Pdf
            }
          },
          {
            text: "Start immediately. Output section markers. List ALL words exhaustively. Do not stop early."
          }
        ]
      },
      config: {
        systemInstruction: systemInstruction,
        thinkingConfig: { thinkingBudget: 0 },
        maxOutputTokens: 8192, // CRITICAL: Allow large output for comprehensive lists
      }
    });

    let fullText = '';
    let buffer = '';
    let wordCount = 0;
    let currentStatus = "Starting analysis...";
    
    // Process the stream
    for await (const chunk of result) {
      const c = chunk as GenerateContentResponse;
      const chunkText = c.text || '';
      fullText += chunkText;
      buffer += chunkText;

      const lines = buffer.split('\n');
      
      // Process all complete lines
      if (lines.length > 1) {
        const completeLines = lines.slice(0, -1);
        for (const line of completeLines) {
           const trimmedLine = line.trim();
           
           // Check for Section Markers
           if (trimmedLine.startsWith('<<<SECTION:')) {
             const sectionName = trimmedLine.replace('<<<SECTION:', '').replace('>>>', '').trim();
             currentStatus = `Scanning: ${sectionName}`;
             onProgress?.(wordCount, currentStatus);
             continue; 
           }

           if (line.includes('|')) {
             const parts = line.split('|');
             const w = parts[0].replace(/^[\d\-\.\*\s]+/, '').trim();
             // Basic validation
             if (w && w.length > 2 && /^[a-zA-Z\-\s]+$/.test(w)) {
               wordCount++;
               onProgress?.(wordCount, `${currentStatus}`);
             }
           }
        }
        // Keep the last partial line in the buffer
        buffer = lines[lines.length - 1]; 
      }
    }

    // Clean up full text
    fullText = fullText.replace(/```\w*\n?/g, '').replace(/```/g, '');

    const lines = fullText.split('\n');
    const rawData: {word: string, correctMeaning: string}[] = [];
    const seenWords = new Set<string>();

    for (const line of lines) {
      if (line.startsWith('<<<')) continue; // Skip markers in final parsing
      if (!line.includes('|')) continue;
      
      const parts = line.split('|');
      if (parts.length >= 2) {
        let w = parts[0].trim();
        let m = parts.slice(1).join('|').trim();
        w = w.replace(/^[\d\-\.\*\s]+/, '').trim(); 
        
        if (w && m && w.length > 2 && /^[a-zA-Z\-\s]+$/.test(w)) { 
             if (!seenWords.has(w.toLowerCase())) {
               rawData.push({ word: w, correctMeaning: m });
               seenWords.add(w.toLowerCase());
             }
        }
      }
    }
    
    if (rawData.length === 0) {
      throw new Error("No vocabulary found. Please ensure the PDF is a readable English exam.");
    }

    // Client-side distractor generation
    const allMeanings = rawData.map(item => item.correctMeaning);

    const words: WordItem[] = rawData.map((item, index) => {
      const otherMeanings = allMeanings.filter(m => m !== item.correctMeaning);
      const shuffledOthers = shuffleArray(otherMeanings);
      const distractors = shuffledOthers.slice(0, 3);
      
      while (distractors.length < 3) {
        distractors.push("其他含义");
      }

      const allOptions = shuffleArray([item.correctMeaning, ...distractors]);

      return {
        id: `word-${index}-${Date.now()}`,
        word: item.word,
        correctMeaning: item.correctMeaning,
        options: allOptions
      };
    });

    return words;

  } catch (error: any) {
    console.error("Error processing PDF:", error);
    // Detect generic connection errors
    if (error.message?.includes("fetch") || error.message?.includes("Network")) {
        throw new Error("Network error connecting to Gemini AI. Please check your internet connection.");
    }
    if (error.message?.includes("Rpc failed") || error.message?.includes("413")) {
      throw new Error("PDF too large. Try uploading a smaller file.");
    }
    throw error;
  }
};

// 2. Generate Audio (TTS)
export const playPronunciation = async (text: string): Promise<void> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    
    if (!base64Audio) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-US';
      window.speechSynthesis.speak(utterance);
      return;
    }

    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({sampleRate: 24000});
    const audioBuffer = await decodeAudioData(base64Audio, audioContext, 24000, 1);
    
    const source = audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioContext.destination);
    source.start(0);

  } catch (error) {
    console.error("TTS Error:", error);
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    window.speechSynthesis.speak(utterance);
  }
};