import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKey = process.env.MINDWEAVE_GEMINI_KEY;

if (!apiKey) {
  console.warn('[Gemini] MINDWEAVE_GEMINI_KEY is not set. AI features will be disabled.');
} else {
  console.log('[Gemini] API key configured.');
}

export const isGeminiConfigured = Boolean(apiKey);
export const geminiModelName = 'gemini-3.5-flash';

// Real Gemini is the default in every environment. Set USE_MOCK_AI=true only for explicit demo/testing runs.
export const isMockMode = process.env.USE_MOCK_AI === 'true';

export const gemini = apiKey && !isMockMode
  ? new GoogleGenerativeAI(apiKey)
  : null;

export const model = gemini
  ? gemini.getGenerativeModel({
      model: geminiModelName,
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.4,
      },
    })
  : null;
