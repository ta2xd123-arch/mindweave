import 'server-only';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { sourceAnalysisConfig } from './source-analysis-config';

const apiKey = process.env.MINDWEAVE_GEMINI_KEY;
const client = apiKey ? new GoogleGenerativeAI(apiKey) : null;

export const isSourceGeminiConfigured = Boolean(apiKey);
export const sourceChunkModelName = sourceAnalysisConfig.chunkModel;
export const sourceSynthesisModelName = sourceAnalysisConfig.synthesisModel;

export const sourceChunkModel = client?.getGenerativeModel({
  model: sourceChunkModelName,
  generationConfig: { responseMimeType: 'application/json', temperature: 0.2 },
}) ?? null;

export const sourceSynthesisModel = client?.getGenerativeModel({
  model: sourceSynthesisModelName,
  generationConfig: { responseMimeType: 'application/json', temperature: 0.3 },
}) ?? null;
