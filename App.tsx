import React, { useState, useEffect } from 'react';
import GameCanvas from './components/GameCanvas';
import { GameMode, GameState, AIStrategy } from './types';
import { INITIAL_AI_STRATEGY, WIN_SCORE } from './constants';
import { fetchAIStrategy } from './services/geminiService';

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>({
    score: { player: 0, ai: 0 },
    isPlaying: false,
    isPaused: false,
    gameResult: null,
    mode: GameMode.ROOKIE,
    commentary: "Welcome to the arena! Select a mode to start.",
    aiStrategy: INITIAL_AI_STRATEGY
  });

  const [loadingAI, setLoadingAI] = useState(false);

  // Initial Strategy Setup based on Mode
  const setMode = (mode: GameMode) => {
    let strategy: AIStrategy = { ...INITIAL_AI_STRATEGY };
    
    if (mode === GameMode.ROOKIE) {
      strategy = { ...strategy, speedMultiplier: 0.6, aggression: 0.2, name: "Rookie Bot" };
    } else if (mode === GameMode.PRO) {
      strategy = { ...strategy, speedMultiplier: 1.2, aggression: 0.8, name: "Pro Bot" };
    } else if (mode === GameMode.GEMINI_ADAPTIVE) {
      strategy = { ...strategy, name: "Gemini AI" };
    }

    setGameState(prev => ({
      ...prev,
      mode,
      aiStrategy: strategy,
      score: { player: 0, ai: 0 },
      gameResult: null,
      commentary: mode === GameMode.GEMINI_ADAPTIVE ? "Connecting to Gemini Neural Net..." : "Game Reset. Good luck!",
      isPlaying: false
    }));

    if (mode === GameMode.GEMINI_ADAPTIVE) {
      triggerGeminiUpdate(0, 0, 'GAME_START');
    }
  };

  const triggerGeminiUpdate = async (pScore: number, aScore: number, event: 'GOAL_PLAYER' | 'GOAL_AI' | 'GAME_START') => {
    if (gameState.mode !== GameMode.GEMINI_ADAPTIVE) return;

    setLoadingAI(true);
    const data = await fetchAIStrategy(pScore, aScore, gameState.commentary, event);
    setLoadingAI(false);

    setGameState(prev => ({
      ...prev,
      commentary: data.commentary,
      aiStrategy: {
        ...prev.aiStrategy,
        speedMultiplier: data.aiSpeed,
        aggression: data.aiAggression,
        reactionTime: data.aiReactionDelay
      }
    }));
  };

  const handleScoreUpdate = (newPlayerScore: number, newAiScore: number, scorer: 'player' | 'ai') => {
    // Check for Win Condition
    if (newPlayerScore >= WIN_SCORE || newAiScore >= WIN_SCORE) {
        setGameState(prev => ({
            ...prev,
            score: { player: newPlayerScore, ai: newAiScore },
            isPlaying: false,
            gameResult: newPlayerScore >= WIN_SCORE ? 'WIN' : 'LOSS',
            commentary: newPlayerScore >= WIN_SCORE ? "VICTORY! You dominated the ice!" : "DEFEAT! The AI was superior today."
        }));
        return;
    }

    setGameState(prev => ({
      ...prev,
      score: { player: newPlayerScore, ai: newAiScore }
    }));

    if (gameState.mode === GameMode.GEMINI_ADAPTIVE) {
      triggerGeminiUpdate(newPlayerScore, newAiScore, scorer === 'player' ? 'GOAL_PLAYER' : 'GOAL_AI');
    } else {
        // Simple scripted commentary for standard modes
        const comments = scorer === 'player' ? 
            ["Nice shot!", "What a goal!", "You're on fire!"] : 
            ["AI scores!", "Better luck next time.", "Defense needed!"];
        setGameState(prev => ({
            ...prev,
            commentary: comments[Math.floor(Math.random() * comments.length)]
        }));
    }
  };

  const startGame = () => {
    if (gameState.gameResult) {
        // If restarting from game over, reset scores
        setMode(gameState.mode);
        setGameState(prev => ({ ...prev, isPlaying: true, isPaused: false }));
    } else {
        setGameState(prev => ({ ...prev, isPlaying: true, isPaused: false }));
    }
  };

  const togglePause = () => {
    setGameState(prev => ({ ...prev, isPaused: !prev.isPaused }));
  };

  return (
    // Use 100dvh for dynamic viewport height on mobile
    <div className="flex flex-col h-[100dvh] w-full bg-slate-900 overflow-hidden touch-none">
      {/* HUD Header */}
      <header className="flex-none h-16 md:h-20 bg-slate-800 border-b border-slate-700 flex items-center justify-between px-4 md:px-6 z-10 shadow-lg shrink-0">
        <div className="flex flex-col">
          <h1 className="text-sm md:text-xl font-display font-bold text-blue-400 leading-tight">GEMINI<br className="md:hidden"/> HOCKEY</h1>
          <span className="hidden md:inline text-xs text-slate-400">Mode: {gameState.mode.replace('_', ' ')}</span>
        </div>

        {/* Scoreboard */}
        <div className="flex items-center gap-4 md:gap-8">
            <div className="text-center">
                <div className="text-[10px] md:text-sm text-blue-400 font-bold">YOU</div>
                <div className="text-2xl md:text-4xl font-display text-white">{gameState.score.player}</div>
            </div>
            <div className="text-slate-500 text-xl font-bold">:</div>
            <div className="text-center">
                <div className="text-[10px] md:text-sm text-red-400 font-bold">AI</div>
                <div className="text-2xl md:text-4xl font-display text-white">{gameState.score.ai}</div>
            </div>
        </div>

        <button 
          onClick={gameState.isPlaying ? togglePause : startGame}
          className={`px-4 py-1 md:px-6 md:py-2 text-sm md:text-base rounded-full font-bold transition-all whitespace-nowrap ${
            gameState.isPlaying 
              ? 'bg-amber-500 hover:bg-amber-600 text-slate-900' 
              : 'bg-green-500 hover:bg-green-600 text-slate-900 animate-pulse'
          }`}
        >
          {gameState.isPlaying ? (gameState.isPaused ? "RESUME" : "PAUSE") : (gameState.gameResult ? "RESTART" : "START")}
        </button>
      </header>

      {/* Main Game Area - Flex center with padding to ensure full view */}
      <main className="flex-1 relative flex items-center justify-center bg-slate-950 p-2 md:p-4 overflow-hidden">
        
        {/* Game Canvas Container - Aspect ratio maintained, scales to fit */}
        <div className="relative w-full max-w-[500px] lg:max-w-[600px] h-full max-h-full aspect-[2/3] shadow-2xl rounded-lg overflow-hidden border-4 border-slate-800 bg-slate-900">
            <GameCanvas gameState={gameState} onScoreUpdate={handleScoreUpdate} />
            
            {/* Overlay: Game Over or Start Menu */}
            {!gameState.isPlaying && (
                <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center p-6 z-20 backdrop-blur-sm text-center">
                    
                    {gameState.gameResult ? (
                        <div className="animate-in fade-in zoom-in duration-300">
                            <h2 className={`text-4xl md:text-6xl font-display mb-4 ${gameState.gameResult === 'WIN' ? 'text-green-400' : 'text-red-500'}`}>
                                {gameState.gameResult === 'WIN' ? 'YOU WON!' : 'GAME OVER'}
                            </h2>
                            <p className="text-slate-300 mb-8 text-lg">{gameState.gameResult === 'WIN' ? 'Amazing performance!' : 'Better luck next time.'}</p>
                            <button 
                                onClick={() => {
                                    // Reset score manually before starting
                                    setMode(gameState.mode);
                                    setTimeout(startGame, 50); 
                                }}
                                className="px-8 py-3 bg-white text-slate-900 font-display font-bold text-xl rounded-full hover:scale-105 transition-transform"
                            >
                                PLAY AGAIN
                            </button>
                        </div>
                    ) : (
                        <>
                            <h2 className="text-2xl md:text-3xl font-display mb-6 text-white">SELECT MODE</h2>
                            <div className="grid gap-3 w-full max-w-xs overflow-y-auto max-h-[70%]">
                                <button 
                                    onClick={() => setMode(GameMode.ROOKIE)}
                                    className={`p-3 md:p-4 rounded-xl border-2 transition-all text-left group ${gameState.mode === GameMode.ROOKIE ? 'border-blue-500 bg-blue-500/20' : 'border-slate-600 hover:border-slate-400'}`}
                                >
                                    <div className="font-bold text-base md:text-lg text-white group-hover:text-blue-300">ROOKIE</div>
                                    <div className="text-xs md:text-sm text-slate-400">Slow, predictable. Good for practice.</div>
                                </button>
                                <button 
                                    onClick={() => setMode(GameMode.PRO)}
                                    className={`p-3 md:p-4 rounded-xl border-2 transition-all text-left group ${gameState.mode === GameMode.PRO ? 'border-purple-500 bg-purple-500/20' : 'border-slate-600 hover:border-slate-400'}`}
                                >
                                    <div className="font-bold text-base md:text-lg text-white group-hover:text-purple-300">PRO</div>
                                    <div className="text-xs md:text-sm text-slate-400">Fast, aggressive. A real challenge.</div>
                                </button>
                                <button 
                                    onClick={() => setMode(GameMode.GEMINI_ADAPTIVE)}
                                    className={`p-3 md:p-4 rounded-xl border-2 transition-all text-left group relative overflow-hidden ${gameState.mode === GameMode.GEMINI_ADAPTIVE ? 'border-amber-400 bg-amber-500/20' : 'border-slate-600 hover:border-amber-400'}`}
                                >
                                    <div className="absolute top-0 right-0 p-1 bg-amber-400 text-slate-900 text-[9px] font-bold">GENAI</div>
                                    <div className="font-bold text-base md:text-lg text-white group-hover:text-amber-300">GEMINI ADAPTIVE</div>
                                    <div className="text-xs md:text-sm text-slate-400">Dynamically adapts strategy. Talks trash.</div>
                                </button>
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>

        {/* AI Stats / Commentary Panel */}
        <div className="absolute top-4 left-4 max-w-[180px] hidden lg:block z-20">
             <div className="bg-slate-800/90 backdrop-blur border border-slate-700 p-4 rounded-xl shadow-lg">
                <h3 className="text-xs font-bold text-slate-400 uppercase mb-2">Coach Commentary</h3>
                <div className="min-h-[60px] text-sm italic text-blue-200 mb-4">
                   "{gameState.commentary}"
                   {loadingAI && <span className="inline-block w-2 h-2 ml-2 bg-blue-400 rounded-full animate-ping"></span>}
                </div>
                
                {gameState.mode === GameMode.GEMINI_ADAPTIVE && (
                    <>
                        <div className="h-px bg-slate-700 my-2"></div>
                        <h3 className="text-xs font-bold text-slate-400 uppercase mb-2">Live Analysis</h3>
                        <div className="space-y-2 text-xs">
                            <div className="flex justify-between">
                                <span>Speed</span>
                                <div className="w-16 h-2 bg-slate-700 rounded-full overflow-hidden mt-1">
                                    <div className="h-full bg-blue-500 transition-all duration-1000" style={{ width: `${(gameState.aiStrategy.speedMultiplier / 2) * 100}%` }}></div>
                                </div>
                            </div>
                            <div className="flex justify-between">
                                <span>Aggression</span>
                                <div className="w-16 h-2 bg-slate-700 rounded-full overflow-hidden mt-1">
                                    <div className="h-full bg-red-500 transition-all duration-1000" style={{ width: `${gameState.aiStrategy.aggression * 100}%` }}></div>
                                </div>
                            </div>
                        </div>
                    </>
                )}
             </div>
        </div>

        {/* Mobile Commentary Toast */}
        <div className="lg:hidden absolute bottom-6 left-6 right-6 z-20 pointer-events-none">
            <div className="bg-slate-800/90 backdrop-blur border border-slate-700 p-3 rounded-lg text-center shadow-lg">
                <p className="text-xs md:text-sm italic text-blue-200">"{gameState.commentary}"</p>
            </div>
        </div>

      </main>
    </div>
  );
};

export default App;