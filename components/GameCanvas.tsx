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
  
  // Refs for performance-sensitive physics data
  const puck = useRef<Entity>({ x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2, radius: PUCK_RADIUS, velocity: { x: 0, y: 0 }, mass: PUCK_MASS });
  const player = useRef<Entity>({ x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT - 250, radius: PADDLE_RADIUS, velocity: { x: 0, y: 0 }, mass: PADDLE_MASS });
  const ai = useRef<Entity>({ x: CANVAS_WIDTH / 2, y: 250, radius: PADDLE_RADIUS, velocity: { x: 0, y: 0 }, mass: PADDLE_MASS });
  
  const isResetting = useRef<boolean>(false);
  const inputTarget = useRef<{x: number, y: number} | null>(null);
  const [goalOverlay, setGoalOverlay] = useState<string | null>(null);

  const GOAL_LEFT_X = (CANVAS_WIDTH - GOAL_WIDTH) / 2;
  const GOAL_RIGHT_X = (CANVAS_WIDTH + GOAL_WIDTH) / 2;
  const POST_RADIUS = 25;

  const resetPuck = (scorer: 'player' | 'ai') => {
    isResetting.current = true;
    setGoalOverlay(scorer === 'player' ? 'YOU SCORE!' : 'AI SCORED!');

    puck.current.velocity = { x: 0, y: 0 };
    player.current.velocity = { x: 0, y: 0 };
    ai.current.velocity = { x: 0, y: 0 };

    puck.current.x = CANVAS_WIDTH / 2;
    puck.current.y = CANVAS_HEIGHT / 2;
    player.current.x = CANVAS_WIDTH / 2;
    player.current.y = CANVAS_HEIGHT - 250;
    ai.current.x = CANVAS_WIDTH / 2;
    ai.current.y = 250;

    inputTarget.current = null;

    setTimeout(() => {
        setGoalOverlay(null);
        isResetting.current = false;
        const serveDir = scorer === 'player' ? 1 : -1;
        puck.current.velocity = { x: (Math.random() - 0.5) * 15, y: serveDir * 12 };
    }, 1200);
  };

  const resolvePaddleCollision = (pdl: Entity, pck: Entity) => {
    const dx = pck.x - pdl.x;
    const dy = pck.y - pdl.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const minDist = pdl.radius + pck.radius;

    if (distance < minDist) {
      const nx = dx / distance;
      const ny = dy / distance;

      // Position correction to prevent tunneling/sticking
      const overlap = minDist - distance;
      pck.x += nx * (overlap + 1);
      pck.y += ny * (overlap + 1);

      const relativeVelocity = {
        x: pck.velocity.x - pdl.velocity.x,
        y: pck.velocity.y - pdl.velocity.y
      };

      const velAlongNormal = relativeVelocity.x * nx + relativeVelocity.y * ny;
      if (velAlongNormal > 0) return;

      const bounce = 1.15; // High performance bounce
      const impulse = -(1 + bounce) * velAlongNormal / (1 / pdl.mass + 1 / pck.mass);

      pck.velocity.x += (impulse / pck.mass) * nx;
      pck.velocity.y += (impulse / pck.mass) * ny;

      // Cap speed for playability
      const currentSpeed = Math.sqrt(pck.velocity.x**2 + pck.velocity.y**2);
      if (currentSpeed > MAX_SPEED) {
        pck.velocity.x = (pck.velocity.x / currentSpeed) * MAX_SPEED;
        puck.current.velocity.y = (pck.velocity.y / currentSpeed) * MAX_SPEED;
      }
    }
  };

  const physicsStep = (dt: number) => {
    if (isResetting.current) return;
    const p = puck.current;

    p.x += p.velocity.x * dt;
    p.y += p.velocity.y * dt;

    const friction = Math.pow(FRICTION, dt);
    p.velocity.x *= friction;
    p.velocity.y *= friction;

    // Goals
    if (p.x > GOAL_LEFT_X && p.x < GOAL_RIGHT_X) {
      if (p.y < -p.radius) { onScoreUpdate(gameState.score.player + 1, gameState.score.ai, 'player'); resetPuck('player'); return; }
      if (p.y > CANVAS_HEIGHT + p.radius) { onScoreUpdate(gameState.score.player, gameState.score.ai + 1, 'ai'); resetPuck('ai'); return; }
    }

    // Walls with high-quality bounce
    if (p.x < p.radius) { p.x = p.radius; p.velocity.x = Math.abs(p.velocity.x) * WALL_ELASTICITY; }
    if (p.x > CANVAS_WIDTH - p.radius) { p.x = CANVAS_WIDTH - p.radius; p.velocity.x = -Math.abs(p.velocity.x) * WALL_ELASTICITY; }
    
    if (p.x < GOAL_LEFT_X || p.x > GOAL_RIGHT_X) {
      if (p.y < p.radius) { p.y = p.radius; p.velocity.y = Math.abs(p.velocity.y) * WALL_ELASTICITY; }
      if (p.y > CANVAS_HEIGHT - p.radius) { p.y = CANVAS_HEIGHT - p.radius; p.velocity.y = -Math.abs(p.velocity.y) * WALL_ELASTICITY; }
    }

    // Circular Goal Posts
    const posts = [
      {x: GOAL_LEFT_X, y: 0}, {x: GOAL_RIGHT_X, y: 0},
      {x: GOAL_LEFT_X, y: CANVAS_HEIGHT}, {x: GOAL_RIGHT_X, y: CANVAS_HEIGHT}
    ];
    posts.forEach(post => {
      const dx = p.x - post.x;
      const dy = p.y - post.y;
      const dist = Math.sqrt(dx*dx + dy*dy);
      const minP = p.radius + POST_RADIUS;
      if (dist < minP) {
        const nx = dx / dist;
        const ny = dy / dist;
        p.x = post.x + nx * (minP + 0.5);
        p.y = post.y + ny * (minP + 0.5);
        const dot = p.velocity.x * nx + p.velocity.y * ny;
        p.velocity.x = (p.velocity.x - 2 * dot * nx) * WALL_ELASTICITY;
        p.velocity.y = (p.velocity.y - 2 * dot * ny) * WALL_ELASTICITY;
      }
    });

    resolvePaddleCollision(player.current, p);
    resolvePaddleCollision(ai.current, p);
  };

  const updateAI = (dt: number) => {
    if (isResetting.current) return;
    const a = ai.current;
    const p = puck.current;
    const { speedMultiplier, aggression } = gameState.aiStrategy;

    let tx = a.x;
    let ty = a.y;
    const homeX = CANVAS_WIDTH / 2;
    const homeY = 200;

    // Advanced Decision Logic
    if (p.y < CANVAS_HEIGHT / 2) {
      // Offensive / Predictive Targeting
      const prediction = aggression * 10;
      tx = p.x + p.velocity.x * prediction;
      ty = p.y + 20;

      // Ensure AI doesn't get stuck behind puck
      if (p.y < a.y - 10) { tx = homeX; ty = 100; }
    } else {
      // Defensive Tracking
      tx = p.x;
      const offset = (p.y - CANVAS_HEIGHT / 2) * (aggression * 0.25);
      ty = clamp(homeY + offset, 100, CANVAS_HEIGHT * 0.45);
    }

    const dx = tx - a.x;
    const dy = ty - a.y;
    const dist = Math.sqrt(dx*dx + dy*dy);
    
    if (dist > 5) {
      const maxS = MAX_SPEED * 0.7 * speedMultiplier;
      const targetVx = (dx / dist) * maxS;
      const targetVy = (dy / dist) * maxS;
      
      const lerp = 0.22 * dt;
      a.velocity.x += (targetVx - a.velocity.x) * lerp;
      a.velocity.y += (targetVy - a.velocity.y) * lerp;
    } else {
      a.velocity.x *= 0.8;
      a.velocity.y *= 0.8;
    }

    a.x += a.velocity.x * dt;
    a.y += a.velocity.y * dt;

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
      const pl = player.current;
      const lerp = 0.5 * dt;
      pl.velocity.x = (inputTarget.current.x - pl.x) * lerp;
      pl.velocity.y = (inputTarget.current.y - pl.y) * lerp;
      pl.x += pl.velocity.x * dt;
      pl.y += pl.velocity.y * dt;
    } else {
      player.current.velocity.x *= 0.8;
      player.current.velocity.y *= 0.8;
    }
    
    player.current.x = clamp(player.current.x, player.current.radius, CANVAS_WIDTH - player.current.radius);
    player.current.y = clamp(player.current.y, CANVAS_HEIGHT / 2 + player.current.radius, CANVAS_HEIGHT - player.current.radius);

    updateAI(dt);

    // High-frequency sub-stepping for physics stability
    const subSteps = 8;
    const stepDt = dt / subSteps;
    for (let i = 0; i < subSteps; i++) {
      physicsStep(stepDt);
    }

    render();
    requestRef.current = requestAnimationFrame(update);
  };

  const render = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d', { alpha: false });
    if (!ctx) return;

    // Rink Base
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Center Lines
    ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 1;
    for(let i=0; i<CANVAS_WIDTH; i+=100){ ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, CANVAS_HEIGHT); ctx.stroke(); }
    for(let i=0; i<CANVAS_HEIGHT; i+=100){ ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(CANVAS_WIDTH, i); ctx.stroke(); }

    // Rink Markings
    ctx.strokeStyle = '#334155'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(0, CANVAS_HEIGHT/2); ctx.lineTo(CANVAS_WIDTH, CANVAS_HEIGHT/2);
    ctx.strokeStyle = '#ef444466'; ctx.stroke();

    ctx.beginPath(); ctx.arc(CANVAS_WIDTH/2, CANVAS_HEIGHT/2, 160, 0, Math.PI*2);
    ctx.strokeStyle = '#3b82f644'; ctx.stroke();

    // Creases
    ctx.strokeStyle = '#3b82f666'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(CANVAS_WIDTH/2, 0, 150, 0, Math.PI); ctx.stroke();
    ctx.beginPath(); ctx.arc(CANVAS_WIDTH/2, CANVAS_HEIGHT, 150, Math.PI, 0); ctx.stroke();

    // Goal Visuals
    ctx.fillStyle = '#020617';
    ctx.fillRect(GOAL_LEFT_X, -50, GOAL_WIDTH, 50);
    ctx.fillRect(GOAL_LEFT_X, CANVAS_HEIGHT, GOAL_WIDTH, 50);

    // Dynamic Entities
    const drawEnt = (e: Entity, col: string, glow: string) => {
      ctx.shadowColor = glow; ctx.shadowBlur = 25;
      ctx.beginPath(); ctx.arc(e.x, e.y, e.radius, 0, Math.PI*2);
      ctx.fillStyle = col; ctx.fill();
      ctx.shadowBlur = 0;
      // High-end shine
      ctx.beginPath(); ctx.arc(e.x - e.radius*0.3, e.y - e.radius*0.3, e.radius*0.15, 0, Math.PI*2);
      ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.fill();
    };

    drawEnt(puck.current, '#f8fafc', '#38bdf8');
    drawEnt(player.current, '#3b82f6', '#60a5fa');
    drawEnt(ai.current, '#ef4444', '#f87171');

    // Goal Posts
    ctx.fillStyle = '#475569';
    [GOAL_LEFT_X, GOAL_RIGHT_X].forEach(x => {
      ctx.beginPath(); ctx.arc(x, 0, POST_RADIUS, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(x, CANVAS_HEIGHT, POST_RADIUS, 0, Math.PI*2); ctx.fill();
    });

    if (goalOverlay) {
      ctx.save();
      ctx.translate(CANVAS_WIDTH/2, CANVAS_HEIGHT/2);
      ctx.font = '900 70px Orbitron'; ctx.fillStyle = 'white';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.shadowColor = 'rgba(0,0,0,0.8)'; ctx.shadowBlur = 40;
      ctx.fillText(goalOverlay, 0, 0);
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