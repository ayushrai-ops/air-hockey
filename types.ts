
export enum GameMode {
  ROOKIE = 'ROOKIE',
  PRO = 'PRO'
}

export interface Vector2D {
  x: number;
  y: number;
}

export interface Entity extends Vector2D {
  radius: number;
  velocity: Vector2D;
  mass: number;
}

export interface GameState {
  score: { player: number; ai: number };
  isPlaying: boolean;
  isPaused: boolean;
  gameResult: 'WIN' | 'LOSS' | null;
  mode: GameMode;
  commentary: string;
  aiStrategy: AIStrategy;
}

export interface AIStrategy {
  speedMultiplier: number;
  aggression: number;
  reactionTime: number;
  name: string;
}

/**
 * Interface representing the structured response from the Gemini AI Coach.
 */
export interface GeminiResponse {
  commentary: string;
  aiSpeed: number;
  aiAggression: number;
  aiReactionDelay: number;
}
