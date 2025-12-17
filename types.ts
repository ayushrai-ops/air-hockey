export enum GameMode {
  ROOKIE = 'ROOKIE',
  PRO = 'PRO',
  GEMINI_ADAPTIVE = 'GEMINI_ADAPTIVE'
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
  speedMultiplier: number; // 0.5 to 1.5
  aggression: number; // 0.0 (defensive) to 1.0 (aggressive)
  reactionTime: number; // lower is better
  name: string;
}

export interface GeminiResponse {
  commentary: string;
  aiSpeed: number;
  aiAggression: number;
  aiReactionDelay: number;
}