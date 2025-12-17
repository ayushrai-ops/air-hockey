import React, { useRef, useEffect, useState } from 'react';
import { GameState, Entity, Vector2D } from '../types';
import { 
  CANVAS_WIDTH, CANVAS_HEIGHT, PUCK_RADIUS, PADDLE_RADIUS, 
  GOAL_WIDTH, FRICTION, WALL_ELASTICITY, PADDLE_MASS, PUCK_MASS, MAX_SPEED 
} from '../constants';

interface GameCanvasProps {
  gameState: GameState;
  onScoreUpdate: (playerScore: number, aiScore: number, scorer: 'player' | 'ai') => void;
}

const GameCanvas: React.FC<GameCanvasProps> = ({ gameState, onScoreUpdate }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  
  // Game State Refs
  const puckRef = useRef<Entity>({ x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2, radius: PUCK_RADIUS, velocity: { x: 0, y: 0 }, mass: PUCK_MASS });
  const playerRef = useRef<Entity>({ x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT - 150, radius: PADDLE_RADIUS, velocity: { x: 0, y: 0 }, mass: PADDLE_MASS });
  const aiRef = useRef<Entity>({ x: CANVAS_WIDTH / 2, y: 150, radius: PADDLE_RADIUS, velocity: { x: 0, y: 0 }, mass: PADDLE_MASS });
  
  // Internal state for "resetting" (pause after goal)
  const isResettingRef = useRef<boolean>(false);

  // Track input
  const inputRef = useRef<{x: number, y: number} | null>(null);
  
  // State for visual feedback
  const [goalOverlay, setGoalOverlay] = useState<{ text: string, alpha: number } | null>(null);

  // Constants
  const POST_RADIUS = 15; 
  const GOAL_LEFT_X = (CANVAS_WIDTH - GOAL_WIDTH) / 2;
  const GOAL_RIGHT_X = (CANVAS_WIDTH + GOAL_WIDTH) / 2;

  // Helper: Math
  const dist = (p1: Vector2D, p2: Vector2D) => Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
  const clamp = (val: number, min: number, max: number) => Math.min(Math.max(val, min), max);
  const len = (v: Vector2D) => Math.sqrt(v.x * v.x + v.y * v.y);

  const resetPositions = (scorer: 'player' | 'ai') => {
    isResettingRef.current = true;
    setGoalOverlay({ text: scorer === 'player' ? 'GOAL!' : 'AI SCORES!', alpha: 1.0 });

    // Stop everything
    puckRef.current.velocity = { x: 0, y: 0 };
    playerRef.current.velocity = { x: 0, y: 0 };
    aiRef.current.velocity = { x: 0, y: 0 };

    // Move to center instantly
    puckRef.current.x = CANVAS_WIDTH / 2;
    puckRef.current.y = CANVAS_HEIGHT / 2;
    
    playerRef.current.x = CANVAS_WIDTH / 2;
    playerRef.current.y = CANVAS_HEIGHT - 150;
    
    aiRef.current.x = CANVAS_WIDTH / 2;
    aiRef.current.y = 150;

    // Reset input target so paddle doesn't fly away
    inputRef.current = { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT - 150 };

    // Wait 1.2 seconds before releasing puck
    setTimeout(() => {
        setGoalOverlay(null);
        isResettingRef.current = false;
        
        // Serve
        const serveSpeed = 8;
        // Serve to the LOSER
        const dirY = scorer === 'player' ? 1 : -1; 
        // Add random X variance
        const dirX = (Math.random() * 6) - 3;
        
        puckRef.current.velocity = { x: dirX, y: dirY * serveSpeed };
    }, 1200);
  };

  const resolvePaddleCollision = (paddle: Entity, puck: Entity) => {
    const d = dist(puck, paddle);
    const minDist = puck.radius + paddle.radius;

    if (d < minDist) {
      const angle = Math.atan2(puck.y - paddle.y, puck.x - paddle.x);
      const overlap = minDist - d;
      
      // 1. Position Correction: Push puck out
      puck.x += Math.cos(angle) * (overlap + 0.5); 
      puck.y += Math.sin(angle) * (overlap + 0.5);

      // 2. Velocity Calculation
      const rotate = (v: Vector2D, theta: number) => ({
        x: v.x * Math.cos(theta) + v.y * Math.sin(theta),
        y: -v.x * Math.sin(theta) + v.y * Math.cos(theta)
      });

      const v1 = rotate(paddle.velocity, angle);
      const v2 = rotate(puck.velocity, angle);

      // Elastic Collision
      // We dampen the paddle's contribution slightly to prevent "cannon" shots from jittery input
      // but ensure mass difference still punches the puck.
      const v2FinalX = ((puck.mass - paddle.mass) * v2.x + 2 * paddle.mass * v1.x) / (paddle.mass + puck.mass);
      
      const v2Final = rotate({ x: v2FinalX, y: v2.y }, -angle);

      // Add a minimum "pop" speed if the paddle hits it, so it doesn't just stick
      const speed = len(v2Final);
      const minPop = 5;
      
      if (speed < minPop) {
        const boostFactor = minPop / (speed || 1);
        v2Final.x *= boostFactor;
        v2Final.y *= boostFactor;
      }

      puck.velocity = v2Final;
    }
  };

  const checkCircleCollision = (puck: Entity, cx: number, cy: number, r: number) => {
    const dx = puck.x - cx;
    const dy = puck.y - cy;
    const d = Math.sqrt(dx*dx + dy*dy);
    const minDist = puck.radius + r;
    
    if (d < minDist) {
      const nx = dx / d;
      const ny = dy / d;
      const overlap = minDist - d;
      
      puck.x += nx * (overlap + 0.1);
      puck.y += ny * (overlap + 0.1);

      // Reflect
      const dot = puck.velocity.x * nx + puck.velocity.y * ny;
      puck.velocity.x = (puck.velocity.x - 2 * dot * nx) * WALL_ELASTICITY;
      puck.velocity.y = (puck.velocity.y - 2 * dot * ny) * WALL_ELASTICITY;
    }
  };

  const constrainEntity = (e: Entity, bounds: {minY: number, maxY: number}) => {
     e.x = clamp(e.x, e.radius, CANVAS_WIDTH - e.radius);
     e.y = clamp(e.y, bounds.minY + e.radius, bounds.maxY - e.radius);
  };

  // Update physics using Delta Time
  const updatePhysics = (dt: number) => {
    const puck = puckRef.current;
    const player = playerRef.current;
    const ai = aiRef.current;

    if (isResettingRef.current) return false;

    // --- 1. Move Puck ---
    puck.x += puck.velocity.x * dt;
    puck.y += puck.velocity.y * dt;
    
    // Time-based friction
    // friction ^ dt approximates the decay over time
    const frictionFactor = Math.pow(FRICTION, dt);
    puck.velocity.x *= frictionFactor;
    puck.velocity.y *= frictionFactor;

    // Stop if very slow (prevent jitter)
    if (Math.abs(puck.velocity.x) < 0.05) puck.velocity.x = 0;
    if (Math.abs(puck.velocity.y) < 0.05) puck.velocity.y = 0;

    // Clamp Max Speed
    const currentSpeed = len(puck.velocity);
    if (currentSpeed > MAX_SPEED) {
        const scale = MAX_SPEED / currentSpeed;
        puck.velocity.x *= scale;
        puck.velocity.y *= scale;
    }

    // --- 2. Goal Detection ---
    if (puck.y < -puck.radius && puck.x > GOAL_LEFT_X && puck.x < GOAL_RIGHT_X) {
        onScoreUpdate(gameState.score.player + 1, gameState.score.ai, 'player');
        resetPositions('player');
        return true; 
    }
    if (puck.y > CANVAS_HEIGHT + puck.radius && puck.x > GOAL_LEFT_X && puck.x < GOAL_RIGHT_X) {
        onScoreUpdate(gameState.score.player, gameState.score.ai + 1, 'ai');
        resetPositions('ai');
        return true;
    }

    // --- 3. Wall Constraints (Strict) ---
    // Left
    if (puck.x < puck.radius) {
        puck.x = puck.radius;
        puck.velocity.x = Math.abs(puck.velocity.x) * WALL_ELASTICITY;
    }
    // Right
    if (puck.x > CANVAS_WIDTH - puck.radius) {
        puck.x = CANVAS_WIDTH - puck.radius;
        puck.velocity.x = -Math.abs(puck.velocity.x) * WALL_ELASTICITY;
    }
    // Top Wall
    if (puck.y < puck.radius) {
        if (puck.x < GOAL_LEFT_X || puck.x > GOAL_RIGHT_X) {
            puck.y = puck.radius;
            puck.velocity.y = Math.abs(puck.velocity.y) * WALL_ELASTICITY;
        }
    }
    // Bottom Wall
    if (puck.y > CANVAS_HEIGHT - puck.radius) {
        if (puck.x < GOAL_LEFT_X || puck.x > GOAL_RIGHT_X) {
            puck.y = CANVAS_HEIGHT - puck.radius;
            puck.velocity.y = -Math.abs(puck.velocity.y) * WALL_ELASTICITY;
        }
    }

    // --- 4. Post Collisions ---
    checkCircleCollision(puck, GOAL_LEFT_X, 0, POST_RADIUS);
    checkCircleCollision(puck, GOAL_RIGHT_X, 0, POST_RADIUS);
    checkCircleCollision(puck, GOAL_LEFT_X, CANVAS_HEIGHT, POST_RADIUS);
    checkCircleCollision(puck, GOAL_RIGHT_X, CANVAS_HEIGHT, POST_RADIUS);

    // --- 5. Paddle Constraints & Collisions ---
    constrainEntity(player, { minY: CANVAS_HEIGHT/2, maxY: CANVAS_HEIGHT });
    constrainEntity(ai, { minY: 0, maxY: CANVAS_HEIGHT/2 });

    resolvePaddleCollision(player, puck);
    resolvePaddleCollision(ai, puck);

    return false;
  };

  const updateAI = (dt: number) => {
    if (isResettingRef.current) return;
    
    const ai = aiRef.current;
    const puck = puckRef.current;
    const { speedMultiplier, aggression } = gameState.aiStrategy;

    let targetX = ai.x;
    let targetY = ai.y;
    
    const homeX = CANVAS_WIDTH / 2;
    const homeY = 150;
    const maxForward = CANVAS_HEIGHT * 0.45;

    // Decision
    if (puck.y < CANVAS_HEIGHT / 2) {
        // Attack
        if (puck.y < ai.y - 10) {
            // Panic/Recover
            targetX = homeX;
            targetY = 80;
        } else {
            // Strike
            targetX = puck.x;
            targetY = puck.y + 20; 
        }
    } else {
        // Defend
        targetX = puck.x;
        const aggressionOffset = (puck.y - CANVAS_HEIGHT/2) * (aggression * 0.4);
        targetY = clamp(homeY + aggressionOffset, 50, maxForward);
    }

    // Movement (Steering)
    const dx = targetX - ai.x;
    const dy = targetY - ai.y;
    const distToTarget = Math.sqrt(dx*dx + dy*dy);
    const maxSpeed = MAX_SPEED * 0.8 * speedMultiplier;

    if (distToTarget > 5) {
        const desiredVx = (dx / distToTarget) * maxSpeed;
        const desiredVy = (dy / distToTarget) * maxSpeed;
        
        // Acceleration speed (how fast it changes direction)
        const steerFactor = 0.1 * dt; 

        ai.velocity.x += (desiredVx - ai.velocity.x) * steerFactor;
        ai.velocity.y += (desiredVy - ai.velocity.y) * steerFactor;
    } else {
        ai.velocity.x *= 0.8;
        ai.velocity.y *= 0.8;
    }

    ai.x += ai.velocity.x * dt;
    ai.y += ai.velocity.y * dt;
  };

  const update = (time: number) => {
    if (!gameState.isPlaying || gameState.isPaused) {
      lastTimeRef.current = 0; // Reset time tracking on pause
      requestRef.current = requestAnimationFrame(update);
      return;
    }

    if (lastTimeRef.current === 0) {
        lastTimeRef.current = time;
        requestRef.current = requestAnimationFrame(update);
        return;
    }

    // Calculate Delta Time (Target 60fps = 16.67ms)
    const rawDt = (time - lastTimeRef.current) / 16.67;
    lastTimeRef.current = time;
    
    // Clamp dt to avoid explosions if tab was backgrounded
    const dt = clamp(rawDt, 0, 4);

    // Player Input
    if (inputRef.current && !isResettingRef.current) {
        const player = playerRef.current;
        const targetX = inputRef.current.x;
        const targetY = inputRef.current.y;

        // Smooth follow logic adapted for dt
        const lerpFactor = 0.3 * dt;
        
        player.velocity.x = (targetX - player.x) * lerpFactor;
        player.velocity.y = (targetY - player.y) * lerpFactor;
        
        player.x += player.velocity.x * dt;
        player.y += player.velocity.y * dt;
    }

    updateAI(dt);

    // Physics Sub-stepping
    // We divide dt by the number of steps to keep physics precise
    const steps = 4; // Higher steps = more stability
    const stepDt = dt / steps;
    
    for (let i = 0; i < steps; i++) {
        const reset = updatePhysics(stepDt);
        if (reset) break;
    }

    draw();
    requestRef.current = requestAnimationFrame(update);
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Background
    ctx.fillStyle = '#1e293b'; 
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    // Ice Markings
    ctx.strokeStyle = '#334155'; 
    ctx.lineWidth = 5;
    
    // Center Line
    ctx.beginPath();
    ctx.moveTo(0, CANVAS_HEIGHT / 2);
    ctx.lineTo(CANVAS_WIDTH, CANVAS_HEIGHT / 2);
    ctx.strokeStyle = '#ef4444'; 
    ctx.stroke();

    // Center Circle
    ctx.beginPath();
    ctx.arc(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, 100, 0, Math.PI * 2);
    ctx.strokeStyle = '#3b82f6';
    ctx.stroke();

    // Creases
    ctx.fillStyle = '#334155';
    ctx.beginPath();
    ctx.arc(CANVAS_WIDTH/2, 0, 80, 0, Math.PI, false);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(CANVAS_WIDTH/2, CANVAS_HEIGHT, 80, Math.PI, 0, false);
    ctx.fill();

    // Goal Areas (Back of net visual)
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(GOAL_LEFT_X, -20, GOAL_WIDTH, 20);
    ctx.fillRect(GOAL_LEFT_X, CANVAS_HEIGHT, GOAL_WIDTH, 20);

    // Entities
    const entities = [
      { e: puckRef.current, color: '#f8fafc', glow: '#38bdf8' }, 
      { e: playerRef.current, color: '#3b82f6', glow: '#60a5fa' },
      { e: aiRef.current, color: '#ef4444', glow: '#f87171' }    
    ];

    entities.forEach(({ e, color, glow }) => {
      ctx.shadowColor = glow;
      ctx.shadowBlur = 15;
      
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      
      ctx.shadowBlur = 0;
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.radius * 0.7, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0,0,0,0.1)';
      ctx.fill();
    });

    // Posts
    ctx.fillStyle = '#94a3b8';
    ctx.shadowBlur = 0;
    [GOAL_LEFT_X, GOAL_RIGHT_X].forEach(x => {
        ctx.beginPath(); ctx.arc(x, 0, POST_RADIUS, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(x, CANVAS_HEIGHT, POST_RADIUS, 0, Math.PI*2); ctx.fill();
    });

    // Score Overlay
    if (goalOverlay) {
        ctx.save();
        ctx.translate(CANVAS_WIDTH/2, CANVAS_HEIGHT/2);
        ctx.font = '900 80px Orbitron';
        ctx.fillStyle = `rgba(255, 255, 255, ${goalOverlay.alpha})`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = 'black';
        ctx.shadowBlur = 20;
        ctx.fillText(goalOverlay.text, 0, 0);
        ctx.restore();
    }
  };

  const handleInput = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = CANVAS_WIDTH / rect.width;
    const scaleY = CANVAS_HEIGHT / rect.height;
    
    inputRef.current = {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  };

  const handleTouch = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    handleInput(touch.clientX, touch.clientY);
  };

  useEffect(() => {
    requestRef.current = requestAnimationFrame(update);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState.isPlaying, gameState.isPaused, gameState.aiStrategy, goalOverlay]);

  return (
    <canvas
      ref={canvasRef}
      width={CANVAS_WIDTH}
      height={CANVAS_HEIGHT}
      className="w-full h-full object-contain cursor-none touch-none rounded-lg"
      onMouseMove={(e) => handleInput(e.clientX, e.clientY)}
      onTouchMove={handleTouch}
      onMouseDown={(e) => handleInput(e.clientX, e.clientY)}
      onTouchStart={handleTouch}
    />
  );
};

export default GameCanvas;