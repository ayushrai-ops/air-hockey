import { GoogleGenAI, Type } from "@google/genai";
import { GeminiResponse } from "../types";

const apiKey = process.env.API_KEY || '';

// Initialize Gemini
// Note: We create the client lazily or handle the missing key gracefully in the UI.
const getClient = () => {
  if (!apiKey) return null;
  return new GoogleGenAI({ apiKey });
};

export const fetchAIStrategy = async (
  playerScore: number,
  aiScore: number,
  currentCommentary: string,
  event: 'GOAL_PLAYER' | 'GOAL_AI' | 'GAME_START' | 'TIMEOUT'
): Promise<GeminiResponse> => {
  const client = getClient();
  if (!client) {
    console.warn("API Key missing, returning default strategy.");
    return {
      commentary: "API Key missing. Using fallback logic.",
      aiSpeed: 1.0,
      aiAggression: 0.5,
      aiReactionDelay: 0.1
    };
  }

  const prompt = `
    You are an AI Ice Hockey Coach controlling the opponent bot.
    Current Score -> Player: ${playerScore}, AI: ${aiScore}.
    Event: ${event}.
    
    Determine the new AI strategy and provide a short, trash-talking or encouraging commentary line (max 10 words).
    
    If the AI is losing, maybe increase aggression or speed.
    If the AI is winning, maybe play defensively or gloat.
    
    Return JSON.
  `;

  try {
    const response = await client.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            commentary: { type: Type.STRING },
            aiSpeed: { type: Type.NUMBER, description: "Multiplier between 0.5 (slow) and 2.0 (super fast)" },
            aiAggression: { type: Type.NUMBER, description: "Between 0.0 (stays in goal) and 1.0 (chases puck everywhere)" },
            aiReactionDelay: { type: Type.NUMBER, description: "Delay in seconds, 0.0 to 0.5" }
          },
          required: ["commentary", "aiSpeed", "aiAggression", "aiReactionDelay"]
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response text");
    
    return JSON.parse(text) as GeminiResponse;
  } catch (error) {
    console.error("Gemini API Error:", error);
    // Fallback if API fails
    return {
      commentary: "System malfunction... rebooting strategy...",
      aiSpeed: 1.0,
      aiAggression: 0.5,
      aiReactionDelay: 0.1
    };
  }
};
