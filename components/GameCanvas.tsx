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
  
  // Ref-based state for performance
  const puck = useRef<Entity>({ x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2, radius: PUCK_RADIUS, velocity: { x: 0, y: 0 }, mass: PUCK_MASS });
  const player = useRef<Entity>({ x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT - 200, radius: PADDLE_RADIUS, velocity: { x: 0, y: 0 }, mass: PADDLE_MASS });
  const ai = useRef<Entity>({ x: CANVAS_WIDTH / 2, y: 200, radius: PADDLE_RADIUS, velocity: { x: 0, y: 0 }, mass: PADDLE_MASS });
  
  const isResetting = useRef<boolean>(false);
  const inputTarget = useRef<{x: number, y: number} | null>(null);
  const [goalOverlay, setGoalOverlay] = useState<{ text: string } | null>(null);

  const GOAL_LEFT_X = (CANVAS_WIDTH - GOAL_WIDTH) / 2;
  const GOAL_RIGHT_X = (CANVAS_WIDTH + GOAL_WIDTH) / 2;
  const POST_RADIUS = 22;

  const resetPositions = (scorer: 'player' | 'ai') => {
    isResetting.current = true;
    setGoalOverlay({ text: scorer === 'player' ? 'GOAL!' : 'AI GOAL!' });

    // Stop movement
    puck.current.velocity = { x: 0, y: 0 };
    player.current.velocity = { x: 0, y: 0 };
    ai.current.velocity = { x: 0, y: 0 };

    // Reset center
    puck.current.x = CANVAS_WIDTH / 2;
    puck.current.y = CANVAS_HEIGHT / 2;
    player.current.x = CANVAS_WIDTH / 2;
    player.current.y = CANVAS_HEIGHT - 200;
    ai.current.x = CANVAS_WIDTH / 2;
    ai.current.y = 200;

    inputTarget.current = null;

    setTimeout(() => {
        setGoalOverlay(null);
        isResetting.current = false;
        // Serve puck towards the one who was scored on
        const dirY = scorer === 'player' ? 1 : -1;
        puck.current.velocity = { x: (Math.random() - 0.5) * 10, y: dirY * 10 };
    }, 1000);
  };

  const resolveCollision = (e1: Entity, e2: Entity) => {
    const dx = e2.x - e1.x;
    const dy = e2.y - e1.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const minDist = e1.radius + e2.radius;

    if (distance < minDist) {
      const angle = Math.atan2(dy, dx);
      const sin = Math.sin(angle);
      const cos = Math.cos(angle);

      // Position correction to prevent overlap
      const overlap = minDist - distance;
      const totalMass = e1.mass + e2.mass;
      const ratio1 = e2.mass / totalMass;
      const ratio2 = e1.mass / totalMass;

      // In air hockey, paddles are usually "immovable" by the puck but we use mass to simulate bounce
      // Here we assume e1 is the paddle and e2 is the puck
      e2.x += cos * (overlap + 0.5);
      e2.y += sin * (overlap + 0.5);

      // Velocity reflection
      const relativeVelocity = {
        x: e2.velocity.x - e1.velocity.x,
        y: e2.velocity.y - e1.velocity.y
      };

      const velAlongNormal = relativeVelocity.x * cos + relativeVelocity.y * sin;
      if (velAlongNormal > 0) return;

      const restitution = 1.1; // Energy boost
      const impulseScalar = -(1 + restitution) * velAlongNormal;
      const impulse = impulseScalar / (1 / e1.mass + 1 / e2.mass);

      e2.velocity.x += (impulse / e2.mass) * cos;
      e2.velocity.y += (impulse / e2.mass) * sin;

      // Speed limit
      const speed = Math.sqrt(e2.velocity.x**2 + e2.velocity.y**2);
      if (speed > MAX_SPEED) {
        e2.velocity.x = (e2.velocity.x / speed) * MAX_SPEED;
        e2.velocity.y = (e2.velocity.y / speed) * MAX_SPEED;
      }
    }
  };

  const checkBoundaries = (dt: number) => {
    if (isResetting.current) return;
    const p = puck.current;

    p.x += p.velocity.x * dt;
    p.y += p.velocity.y * dt;

    const friction = Math.pow(FRICTION, dt);
    p.velocity.x *= friction;
    p.velocity.y *= friction;

    // Goal Check
    if (p.x > GOAL_LEFT_X && p.x < GOAL_RIGHT_X) {
      if (p.y < -p.radius) { onScoreUpdate(gameState.score.player + 1, gameState.score.ai, 'player'); resetPositions('player'); return; }
      if (p.y > CANVAS_HEIGHT + p.radius) { onScoreUpdate(gameState.score.player, gameState.score.ai + 1, 'ai'); resetPositions('ai'); return; }
    }

    // Walls
    if (p.x < p.radius) { p.x = p.radius; p.velocity.x = Math.abs(p.velocity.x) * WALL_ELASTICITY; }
    if (p.x > CANVAS_WIDTH - p.radius) { p.x = CANVAS_WIDTH - p.radius; p.velocity.x = -Math.abs(p.velocity.x) * WALL_ELASTICITY; }
    
    // Top/Bottom walls (excluding goal)
    if (p.x < GOAL_LEFT_X || p.x > GOAL_RIGHT_X) {
      if (p.y < p.radius) { p.y = p.radius; p.velocity.y = Math.abs(p.velocity.y) * WALL_ELASTICITY; }
      if (p.y > CANVAS_HEIGHT - p.radius) { p.y = CANVAS_HEIGHT - p.radius; p.velocity.y = -Math.abs(p.velocity.y) * WALL_ELASTICITY; }
    }

    // Goal Posts
    const posts = [
      {x: GOAL_LEFT_X, y: 0}, {x: GOAL_RIGHT_X, y: 0},
      {x: GOAL_LEFT_X, y: CANVAS_HEIGHT}, {x: GOAL_RIGHT_X, y: CANVAS_HEIGHT}
    ];
    posts.forEach(post => {
      const dx = p.x - post.x;
      const dy = p.y - post.y;
      const dist = Math.sqrt(dx*dx + dy*dy);
      if (dist < p.radius + POST_RADIUS) {
        const angle = Math.atan2(dy, dx);
        p.x = post.x + Math.cos(angle) * (p.radius + POST_RADIUS + 0.1);
        p.y = post.y + Math.sin(angle) * (p.radius + POST_RADIUS + 0.1);
        const dot = p.velocity.x * Math.cos(angle) + p.velocity.y * Math.sin(angle);
        p.velocity.x = (p.velocity.x - 2 * dot * Math.cos(angle)) * WALL_ELASTICITY;
        p.velocity.y = (p.velocity.y - 2 * dot * Math.sin(angle)) * WALL_ELASTICITY;
      }
    });
  };

  const updateAI = (dt: number) => {
    if (isResetting.current) return;
    const a = ai.current;
    const pk = puck.current;
    const { speedMultiplier, aggression } = gameState.aiStrategy;

    let tx = a.x;
    let ty = a.y;
    const homeX = CANVAS_WIDTH / 2;
    const homeY = 180;

    // AI logic: If puck is in AI half, attack. Else, stay defensive.
    if (pk.y < CANVAS_HEIGHT / 2) {
      // Offensive
      if (pk.y < a.y - 10) {
        // Recover behind puck
        tx = homeX; ty = 100;
      } else {
        // Track puck and push
        const prediction = aggression * 8; // Look ahead
        tx = pk.x + pk.velocity.x * prediction;
        ty = pk.y + 15;
      }
    } else {
      // Defensive
      tx = pk.x;
      const guardOffset = (pk.y - CANVAS_HEIGHT / 2) * (aggression * 0.3);
      ty = clamp(homeY + guardOffset, 80, CANVAS_HEIGHT * 0.45);
    }

    const dx = tx - a.x;
    const dy = ty - a.y;
    const d = Math.sqrt(dx*dx + dy*dy);
    
    // Steering force logic for smooth movement
    const deadzone = 2;
    if (d > deadzone) {
      const maxS = MAX_SPEED * 0.7 * speedMultiplier;
      const targetVx = (dx / d) * maxS;
      const targetVy = (dy / d) * maxS;
      
      const lerp = 0.18 * dt;
      a.velocity.x += (targetVx - a.velocity.x) * lerp;
      a.velocity.y += (targetVy - a.velocity.y) * lerp;
    } else {
      a.velocity.x *= 0.7;
      a.velocity.y *= 0.7;
    }

    a.x += a.velocity.x * dt;
    a.y += a.velocity.y * dt;

    // Constraints
    a.x = clamp(a.x, a.radius, CANVAS_WIDTH - a.radius);
    a.y = clamp(a.y, a.radius, CANVAS_HEIGHT / 2 - a.radius);
  };

  const update = (time: number) => {
    if (!gameState.isPlaying || gameState.isPaused) {
      lastTimeRef.current = 0;
      requestRef.current = requestAnimationFrame(update);
      return;
    }

    if (lastTimeRef.current === 0) {
      lastTimeRef.current = time;
      requestRef.current = requestAnimationFrame(update);
      return;
    }

    const dt = clamp((time - lastTimeRef.current) / 16.67, 0, 3);
    lastTimeRef.current = time;

    // Player Follow
    if (inputTarget.current && !isResetting.current) {
      const p = player.current;
      const lerp = 0.45 * dt;
      p.velocity.x = (inputTarget.current.x - p.x) * lerp;
      p.velocity.y = (inputTarget.current.y - p.y) * lerp;
      p.x += p.velocity.x * dt;
      p.y += p.velocity.y * dt;
    } else {
      player.current.velocity.x *= 0.8;
      player.current.velocity.y *= 0.8;
    }
    
    player.current.x = clamp(player.current.x, player.current.radius, CANVAS_WIDTH - player.current.radius);
    player.current.y = clamp(player.current.y, CANVAS_HEIGHT / 2 + player.current.radius, CANVAS_HEIGHT - player.current.radius);

    updateAI(dt);

    // Multi-stepping for collision stability
    const subSteps = 6;
    const stepDt = dt / subSteps;
    for (let i = 0; i < subSteps; i++) {
      checkBoundaries(stepDt);
      resolveCollision(player.current, puck.current);
      resolveCollision(ai.current, puck.current);
    }

    draw();
    requestRef.current = requestAnimationFrame(update);
  };

  const draw = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    // Pitch
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Grid pattern
    ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 1;
    for(let i=0; i<CANVAS_WIDTH; i+=100){ ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, CANVAS_HEIGHT); ctx.stroke(); }
    for(let i=0; i<CANVAS_HEIGHT; i+=100){ ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(CANVAS_WIDTH, i); ctx.stroke(); }

    // Rink Markings
    ctx.strokeStyle = '#334155'; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(0, CANVAS_HEIGHT/2); ctx.lineTo(CANVAS_WIDTH, CANVAS_HEIGHT/2);
    ctx.strokeStyle = '#ef4444'; ctx.stroke();

    ctx.beginPath(); ctx.arc(CANVAS_WIDTH/2, CANVAS_HEIGHT/2, 160, 0, Math.PI*2);
    ctx.strokeStyle = '#3b82f6'; ctx.stroke();

    // Creases
    ctx.strokeStyle = '#3b82f6'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(CANVAS_WIDTH/2, 0, 120, 0, Math.PI); ctx.stroke();
    ctx.beginPath(); ctx.arc(CANVAS_WIDTH/2, CANVAS_HEIGHT, 120, Math.PI, 0); ctx.stroke();

    // Goals (Dark zones)
    ctx.fillStyle = '#020617';
    ctx.fillRect(GOAL_LEFT_X, -50, GOAL_WIDTH, 50);
    ctx.fillRect(GOAL_LEFT_X, CANVAS_HEIGHT, GOAL_WIDTH, 50);

    // Entities
    const drawItem = (ent: Entity, col: string, glow: string) => {
      ctx.shadowColor = glow; ctx.shadowBlur = 20;
      ctx.beginPath(); ctx.arc(ent.x, ent.y, ent.radius, 0, Math.PI*2);
      ctx.fillStyle = col; ctx.fill();
      ctx.shadowBlur = 0;
      // Reflection highlight
      ctx.beginPath(); ctx.arc(ent.x - ent.radius*0.3, ent.y - ent.radius*0.3, ent.radius*0.1, 0, Math.PI*2);
      ctx.fillStyle = 'white'; ctx.fill();
    };

    drawItem(puck.current, '#f8fafc', '#38bdf8');
    drawItem(player.current, '#3b82f6', '#60a5fa');
    drawItem(ai.current, '#ef4444', '#f87171');

    // Posts
    ctx.fillStyle = '#cbd5e1';
    [GOAL_LEFT_X, GOAL_RIGHT_X].forEach(x => {
      ctx.beginPath(); ctx.arc(x, 0, POST_RADIUS, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(x, CANVAS_HEIGHT, POST_RADIUS, 0, Math.PI*2); ctx.fill();
    });

    if (goalOverlay) {
      ctx.save();
      ctx.translate(CANVAS_WIDTH/2, CANVAS_HEIGHT/2);
      ctx.font = '900 80px Orbitron'; ctx.fillStyle = 'white';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.shadowColor = 'black'; ctx.shadowBlur = 40;
      ctx.fillText(goalOverlay.text, 0, 0);
      ctx.restore();
    }
  };

  const handleInput = (cx: number, cy: number) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const sx = CANVAS_WIDTH / rect.width;
    const sy = CANVAS_HEIGHT / rect.height;
    inputTarget.current = { x: (cx - rect.left) * sx, y: (cy - rect.top) * sy };
  };

  useEffect(() => {
    requestRef.current = requestAnimationFrame(update);
    return () => cancelAnimationFrame(requestRef.current);
  }, [gameState.isPlaying, gameState.isPaused, gameState.aiStrategy, goalOverlay]);

  return (
    <canvas
      ref={canvasRef}
      width={CANVAS_WIDTH}
      height={CANVAS_HEIGHT}
      className="w-full h-full object-contain cursor-none touch-none"
      onMouseMove={(e) => handleInput(e.clientX, e.clientY)}
      onMouseDown={(e) => handleInput(e.clientX, e.clientY)}
      onTouchMove={(e) => { e.preventDefault(); handleInput(e.touches[0].clientX, e.touches[0].clientY); }}
      onTouchStart={(e) => { e.preventDefault(); handleInput(e.touches[0].clientX, e.touches[0].clientY); }}
    />
  );
};

function clamp(v: number, min: number, max: number) { return Math.min(Math.max(v, min), max); }

export default GameCanvas;
