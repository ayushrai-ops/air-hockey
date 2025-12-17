export const CANVAS_WIDTH = 800;
export const CANVAS_HEIGHT = 1200; 
export const PUCK_RADIUS = 25; 
export const PADDLE_RADIUS = 45; 
export const GOAL_WIDTH = 250; 
export const FRICTION = 0.992; // Adjusted for delta-time scaling
export const WALL_ELASTICITY = 0.85;
export const PADDLE_MASS = 200; // Heavier paddle for more authority
export const PUCK_MASS = 10;
export const MAX_SPEED = 35; // Slightly faster cap
export const WIN_SCORE = 7;

export const INITIAL_AI_STRATEGY = {
  speedMultiplier: 1.0,
  aggression: 0.5,
  reactionTime: 0.1,
  name: "Standard"
};