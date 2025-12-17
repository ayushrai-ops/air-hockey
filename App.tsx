
import React, { useState } from 'react';
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
    commentary: "Choose your difficulty and start the match!",
    aiStrategy: INITIAL_AI_STRATEGY
  });

  const setMode = (mode: GameMode) => {
    let strategy: AIStrategy = { ...INITIAL_AI_STRATEGY };
    
    if (mode === GameMode.ROOKIE) {
      strategy = { ...strategy, speedMultiplier: 0.65, aggression: 0.25, name: "Rookie" };
    } else if (mode === GameMode.PRO) {
      strategy = { ...strategy, speedMultiplier: 1.1, aggression: 0.85, name: "Pro" };
    }

    setGameState(prev => ({
      ...prev,
      mode,
      aiStrategy: strategy,
      score: { player: 0, ai: 0 },
      gameResult: null,
      commentary: `Difficulty set to ${mode === GameMode.ROOKIE ? 'Rookie' : 'Pro'}. Ready?`,
      isPlaying: false
    }));
  };

  /**
   * Updates scores and triggers the Gemini AI Coach for real-time strategy adjustments.
   */
  const handleScoreUpdate = (newPlayerScore: number, newAiScore: number, scorer: 'player' | 'ai') => {
    if (newPlayerScore >= WIN_SCORE || newAiScore >= WIN_SCORE) {
        setGameState(prev => ({
            ...prev,
            score: { player: newPlayerScore, ai: newAiScore },
            isPlaying: false,
            gameResult: newPlayerScore >= WIN_SCORE ? 'WIN' : 'LOSS',
            commentary: newPlayerScore >= WIN_SCORE ? "Match over! You won!" : "Match over! AI wins."
        }));
        return;
    }

    // Default immediate feedback comments
    const comments = scorer === 'player' ? 
        ["Nice shot!", "Goal!", "What a play!", "Keep it up!"] : 
        ["AI scores!", "Watch out!", "Focus on defense!", "Close one!"];
    
    const initialComment = comments[Math.floor(Math.random() * comments.length)];
    
    setGameState(prev => ({
      ...prev,
      score: { player: newPlayerScore, ai: newAiScore },
      commentary: initialComment
    }));

    // Trigger AI Coach to analyze the score and update strategy
    fetchAIStrategy(
      newPlayerScore, 
      newAiScore, 
      initialComment, 
      scorer === 'player' ? 'GOAL_PLAYER' : 'GOAL_AI'
    ).then(update => {
      setGameState(prev => ({
        ...prev,
        commentary: update.commentary,
        aiStrategy: {
          ...prev.aiStrategy,
          speedMultiplier: update.aiSpeed,
          aggression: update.aiAggression,
          reactionTime: update.aiReactionDelay
        }
      }));
    }).catch(err => console.error("Coach update failed:", err));
  };

  const startGame = () => {
    setGameState(prev => ({ ...prev, isPlaying: true, isPaused: false, gameResult: null }));
  };

  const togglePause = () => {
    setGameState(prev => ({ ...prev, isPaused: !prev.isPaused }));
  };

  const exitGame = () => {
    setGameState(prev => ({
      ...prev,
      isPlaying: false,
      isPaused: false,
      gameResult: null,
      score: { player: 0, ai: 0 },
      commentary: "Match abandoned. Select a mode."
    }));
  };

  return (
    <div className="flex flex-col h-[100dvh] w-full bg-slate-900 overflow-hidden touch-none text-white">
      <header className="flex-none h-16 md:h-20 bg-slate-800 border-b border-slate-700 flex items-center justify-between px-4 md:px-8 z-10 shadow-lg shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex flex-col">
            <h1 className="text-xl md:text-2xl font-display font-black text-blue-400 tracking-tighter">AIR HOCKEY</h1>
            <span className="hidden md:inline text-[10px] text-slate-400 uppercase tracking-[0.2em] font-bold">{gameState.mode} MODE</span>
          </div>
          
          {gameState.isPlaying && (
            <button 
              onClick={exitGame}
              className="px-3 py-1 text-[10px] font-black border-2 border-red-500/30 text-red-500 rounded-md hover:bg-red-500 hover:text-white transition-all uppercase"
            >
              Exit
            </button>
          )}
        </div>

        <div className="flex items-center gap-4 md:gap-10 bg-slate-950 px-5 py-2 rounded-2xl border border-slate-700 shadow-inner">
            <div className="flex flex-col items-center">
                <span className="text-[8px] font-bold text-blue-500 uppercase">You</span>
                <span className="text-2xl md:text-3xl font-display font-bold leading-none">{gameState.score.player}</span>
            </div>
            <div className="text-slate-700 text-xl font-black">:</div>
            <div className="flex flex-col items-center">
                <span className="text-[8px] font-bold text-red-500 uppercase">AI</span>
                <span className="text-2xl md:text-3xl font-display font-bold leading-none">{gameState.score.ai}</span>
            </div>
        </div>

        <button 
          onClick={gameState.isPlaying ? togglePause : startGame}
          className={`px-5 py-2 md:px-8 md:py-2.5 text-xs md:text-sm rounded-xl font-black transition-all transform active:scale-95 shadow-xl ${
            gameState.isPlaying 
              ? (gameState.isPaused ? 'bg-blue-500 hover:bg-blue-600' : 'bg-slate-700 hover:bg-slate-600') 
              : 'bg-green-500 hover:bg-green-600 text-slate-950'
          }`}
        >
          {gameState.isPlaying ? (gameState.isPaused ? "RESUME" : "PAUSE") : (gameState.gameResult ? "PLAY AGAIN" : "START MATCH")}
        </button>
      </header>

      <main className="flex-1 relative flex items-center justify-center bg-slate-950 overflow-hidden">
        <div className="relative w-full h-full max-w-[800px] max-h-full aspect-[2/3] flex items-center justify-center p-2 md:p-6">
            <div className="relative w-full h-full border-4 border-slate-800 rounded-2xl overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)] bg-slate-900">
                <GameCanvas gameState={gameState} onScoreUpdate={handleScoreUpdate} />
                
                {!gameState.isPlaying && (
                    <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md flex flex-col items-center justify-center p-8 z-20 text-center animate-in fade-in duration-300">
                        {gameState.gameResult ? (
                            <div className="animate-in zoom-in duration-500">
                                <h2 className={`text-5xl md:text-7xl font-display font-black mb-2 tracking-tighter ${gameState.gameResult === 'WIN' ? 'text-green-400' : 'text-red-500'}`}>
                                    {gameState.gameResult === 'WIN' ? 'WINNER' : 'DEFEATED'}
                                </h2>
                                <p className="text-slate-400 mb-10 text-sm md:text-lg font-medium">Final Score: {gameState.score.player} - {gameState.score.ai}</p>
                                <button 
                                    onClick={() => setMode(gameState.mode)}
                                    className="px-12 py-4 bg-white text-slate-950 font-display font-black text-xl rounded-2xl hover:bg-blue-400 hover:scale-105 transition-all shadow-2xl"
                                >
                                    BACK TO MENU
                                </button>
                            </div>
                        ) : (
                            <div className="w-full max-w-sm flex flex-col gap-6">
                                <div className="space-y-2 mb-4">
                                  <h2 className="text-2xl font-display font-black text-white tracking-widest uppercase">Select Difficulty</h2>
                                  <div className="h-1 w-20 bg-blue-500 mx-auto rounded-full"></div>
                                </div>
                                
                                <button 
                                    onClick={() => setMode(GameMode.ROOKIE)}
                                    className={`group relative p-6 rounded-2xl border-2 transition-all text-left bg-slate-900/40 hover:bg-slate-800 ${gameState.mode === GameMode.ROOKIE ? 'border-blue-500 ring-4 ring-blue-500/20' : 'border-slate-700'}`}
                                >
                                    <div className="flex justify-between items-center">
                                      <span className="font-black text-xl tracking-tight">ROOKIE</span>
                                      <div className="flex gap-1">
                                        <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                                        <div className="w-2 h-2 rounded-full bg-slate-700"></div>
                                        <div className="w-2 h-2 rounded-full bg-slate-700"></div>
                                      </div>
                                    </div>
                                    <p className="text-xs text-slate-500 mt-2 font-medium">Slower AI, perfect for learning the controls.</p>
                                </button>

                                <button 
                                    onClick={() => setMode(GameMode.PRO)}
                                    className={`group relative p-6 rounded-2xl border-2 transition-all text-left bg-slate-900/40 hover:bg-slate-800 ${gameState.mode === GameMode.PRO ? 'border-red-500 ring-4 ring-red-500/20' : 'border-slate-700'}`}
                                >
                                    <div className="flex justify-between items-center">
                                      <span className="font-black text-xl tracking-tight">PRO</span>
                                      <div className="flex gap-1">
                                        <div className="w-2 h-2 rounded-full bg-red-500"></div>
                                        <div className="w-2 h-2 rounded-full bg-red-500"></div>
                                        <div className="w-2 h-2 rounded-full bg-red-500"></div>
                                      </div>
                                    </div>
                                    <p className="text-xs text-slate-500 mt-2 font-medium">Fast reactions, aggressive attacks. Be ready.</p>
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>

        {/* Floating Commentary Toast */}
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-30 pointer-events-none px-4 w-full max-w-xs text-center">
            <div className="bg-slate-800/90 backdrop-blur-md border border-slate-700 py-2 px-6 rounded-full shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
                <p className="text-xs font-bold text-blue-200 uppercase tracking-wider italic">"{gameState.commentary}"</p>
            </div>
        </div>
      </main>
    </div>
  );
};

export default App;
