
import { GoogleGenAI, Type } from "@google/genai";
import { GeminiResponse } from "../types";

// Note: Gemini client is initialized using process.env.API_KEY directly as a named parameter.
// We initialize inside the function to ensure the correct context and most recent API key state.

/**
 * Fetches dynamic AI strategy adjustments and coach commentary based on game events.
 * Uses the latest Gemini 3 Flash model for low-latency reasoning.
 */
export const fetchAIStrategy = async (
  playerScore: number,
  aiScore: number,
  currentCommentary: string,
  event: 'GOAL_PLAYER' | 'GOAL_AI' | 'GAME_START' | 'TIMEOUT'
): Promise<GeminiResponse> => {
  // Initialize client with the mandatory named parameter and direct environment variable access.
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

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
    const response = await ai.models.generateContent({
      // Use gemini-3-flash-preview for real-time interactive tasks.
      model: 'gemini-3-flash-preview',
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

    // Access the text property directly from the response object as per SDK guidelines.
    const text = response.text;
    if (!text) throw new Error("No response text received from Gemini.");
    
    return JSON.parse(text) as GeminiResponse;
  } catch (error) {
    console.error("Gemini API Error:", error);
    // Return safe fallback strategy parameters to ensure game continuity.
    return {
      commentary: "System glitch... rebooting tactics...",
      aiSpeed: 1.0,
      aiAggression: 0.5,
      aiReactionDelay: 0.1
    };
  }
};
