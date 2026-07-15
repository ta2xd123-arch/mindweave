import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKey = process.env.MINDWEAVE_GEMINI_KEY;

if (!apiKey) {
  console.warn('[Gemini] GEMINI_API_KEY is not set. AI features will be disabled.');
} else {
  console.log('[Gemini] Loaded key:', apiKey.substring(0, 10) + '... length:', apiKey.length);
}

export const isGeminiConfigured = Boolean(apiKey);

export const isMockMode = process.env.NODE_ENV === 'development' || process.env.USE_MOCK_AI === 'true';

export const gemini = apiKey && !isMockMode
  ? new GoogleGenerativeAI(apiKey)
  : null;

export const model = gemini
  ? gemini.getGenerativeModel({
      model: 'gemini-3.5-flash',
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.4,
      },
    })
  : null;
