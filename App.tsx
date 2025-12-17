
import React, { useState, useCallback } from 'react';
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
    commentary: "Ready for a match?",
    aiStrategy: INITIAL_AI_STRATEGY
  });

  const selectMode = (mode: GameMode) => {
    let strategy: AIStrategy = { ...INITIAL_AI_STRATEGY };
    
    // Set baseline strategies based on the chosen mode
    if (mode === GameMode.ROOKIE) {
      strategy = { speedMultiplier: 0.6, aggression: 0.3, reactionTime: 0.2, name: "Rookie Bot" };
    } else if (mode === GameMode.PRO) {
      strategy = { speedMultiplier: 1.15, aggression: 0.9, reactionTime: 0.05, name: "Pro Bot" };
    }

    setGameState(prev => ({
      ...prev,
      mode,
      aiStrategy: strategy,
      score: { player: 0, ai: 0 },
      gameResult: null,
      commentary: mode === GameMode.PRO ? "Pro mode selected. Prepare yourself." : "Rookie mode. Perfect for practice.",
      isPlaying: false
    }));
  };

  // Handle scoring events and trigger dynamic AI strategy updates via Gemini API
  const handleScoreUpdate = useCallback(async (newPlayerScore: number, newAiScore: number, scorer: 'player' | 'ai') => {
    if (newPlayerScore >= WIN_SCORE || newAiScore >= WIN_SCORE) {
        setGameState(prev => ({
            ...prev,
            score: { player: newPlayerScore, ai: newAiScore },
            isPlaying: false,
            gameResult: newPlayerScore >= WIN_SCORE ? 'WIN' : 'LOSS',
            commentary: newPlayerScore >= WIN_SCORE ? "VICTORY!" : "DEFEAT!"
        }));
        return;
    }

    // Update the score immediately in state
    setGameState(prev => ({
      ...prev,
      score: { player: newPlayerScore, ai: newAiScore }
    }));

    // Fetch adaptive strategy and trash-talk/commentary from Gemini
    const event = scorer === 'player' ? 'GOAL_PLAYER' : 'GOAL_AI';
    try {
      const geminiData = await fetchAIStrategy(newPlayerScore, newAiScore, gameState.commentary, event);
      setGameState(prev => ({
        ...prev,
        commentary: geminiData.commentary,
        aiStrategy: {
          ...prev.aiStrategy,
          speedMultiplier: geminiData.aiSpeed,
          aggression: geminiData.aiAggression,
          reactionTime: geminiData.aiReactionDelay
        }
      }));
    } catch (error) {
      console.error("Gemini sync error:", error);
    }
  }, [gameState.commentary]);

  const startGame = () => {
    // Call Gemini on game start to set the tone and initial adaptive strategy
    const triggerStart = async () => {
      try {
        const geminiData = await fetchAIStrategy(0, 0, "Match Initiated", 'GAME_START');
        setGameState(prev => ({
          ...prev,
          commentary: geminiData.commentary,
          aiStrategy: {
            ...prev.aiStrategy,
            speedMultiplier: geminiData.aiSpeed,
            aggression: geminiData.aiAggression,
            reactionTime: geminiData.aiReactionDelay
          },
          isPlaying: true,
          isPaused: false,
          gameResult: null
        }));
      } catch {
        setGameState(prev => ({ ...prev, isPlaying: true, isPaused: false, gameResult: null }));
      }
    };
    
    triggerStart();
  };

  const togglePause = () => {
    setGameState(prev => ({ ...prev, isPaused: !prev.isPaused }));
  };

  const exitToMenu = () => {
    setGameState(prev => ({
      ...prev,
      isPlaying: false,
      isPaused: false,
      gameResult: null,
      score: { player: 0, ai: 0 },
      commentary: "Select a challenge."
    }));
  };

  return (
    <div className="flex flex-col h-[100dvh] w-full bg-slate-950 overflow-hidden touch-none text-slate-100">
      {/* HUD / Header */}
      <header className="flex-none h-16 md:h-20 bg-slate-900/80 backdrop-blur-md border-b border-white/5 flex items-center justify-between px-4 md:px-12 z-50">
        <div className="flex items-center gap-4">
          <div className="flex flex-col">
            <h1 className="text-xl md:text-2xl font-display font-black tracking-tight text-white italic">
              AIR<span className="text-blue-500">HOCKEY</span>
            </h1>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest hidden md:block">
              {gameState.mode} PROTOCOL
            </span>
          </div>
          
          {gameState.isPlaying && (
            <button 
              onClick={exitToMenu}
              className="ml-2 px-3 py-1 text-[10px] font-black bg-red-500/10 border border-red-500/50 text-red-500 rounded hover:bg-red-500 hover:text-white transition-all uppercase active:scale-90"
            >
              Exit
            </button>
          )}
        </div>

        {/* Score Display */}
        <div className="flex items-center gap-4 md:gap-8 bg-black/40 px-3 py-1.5 md:px-4 md:py-2 rounded-2xl border border-white/5 shadow-inner">
          <div className="flex flex-col items-center">
            <span className="text-[9px] font-bold text-blue-400 uppercase tracking-tighter">YOU</span>
            <span className="text-xl md:text-3xl font-display font-bold leading-none">{gameState.score.player}</span>
          </div>
          <div className="h-6 md:h-8 w-px bg-white/10 mx-1"></div>
          <div className="flex flex-col items-center">
            <span className="text-[9px] font-bold text-red-400 uppercase tracking-tighter">AI</span>
            <span className="text-xl md:text-3xl font-display font-bold leading-none">{gameState.score.ai}</span>
          </div>
        </div>

        <button 
          onClick={gameState.isPlaying ? togglePause : startGame}
          className={`px-4 py-1.5 md:px-8 md:py-2.5 text-[10px] md:text-sm rounded-full font-black tracking-widest transition-all transform active:scale-95 shadow-lg shadow-black/40 ${
            gameState.isPlaying 
              ? (gameState.isPaused ? 'bg-blue-500 hover:bg-blue-400' : 'bg-slate-700 hover:bg-slate-600') 
              : 'bg-white text-slate-950 hover:bg-blue-50'
          }`}
        >
          {gameState.isPlaying ? (gameState.isPaused ? "RESUME" : "PAUSE") : (gameState.gameResult ? "PLAY AGAIN" : "START")}
        </button>
      </header>

      {/* Main Game Area */}
      <main className="flex-1 relative flex items-center justify-center p-2 md:p-4 lg:p-6 overflow-hidden">
        {/* Aspect ratio container that fits both width and height */}
        <div className="relative max-h-full max-w-full aspect-[2/3] bg-slate-900 rounded-2xl md:rounded-3xl overflow-hidden shadow-[0_0_100px_rgba(0,0,0,0.8)] border-[4px] md:border-[6px] border-slate-800 flex items-center justify-center">
          <GameCanvas gameState={gameState} onScoreUpdate={handleScoreUpdate} />
          
          {/* Main Menu / Result Overlay */}
          {!gameState.isPlaying && (
            <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-xl flex flex-col items-center justify-center p-4 md:p-8 z-[60] text-center">
              {gameState.gameResult ? (
                <div className="animate-in zoom-in duration-500">
                  <h2 className={`text-5xl md:text-8xl font-display font-black mb-2 md:mb-4 tracking-tighter ${gameState.gameResult === 'WIN' ? 'text-blue-400' : 'text-red-500'}`}>
                    {gameState.gameResult === 'WIN' ? 'VICTORY' : 'DEFEATED'}
                  </h2>
                  <p className="text-slate-400 mb-8 md:mb-12 text-sm md:text-lg font-medium">Final Score {gameState.score.player} to {gameState.score.ai}</p>
                  <button 
                    onClick={exitToMenu}
                    className="px-10 py-4 md:px-16 md:py-5 bg-white text-slate-950 font-display font-black text-lg md:text-xl rounded-2xl hover:bg-blue-400 hover:scale-105 transition-all shadow-2xl active:scale-95"
                  >
                    CONTINUE
                  </button>
                </div>
              ) : (
                <div className="w-full max-w-sm space-y-4 md:space-y-8 animate-in fade-in duration-500">
                  <div className="space-y-2 md:space-y-4">
                    <h2 className="text-2xl md:text-5xl font-display font-black text-white italic tracking-tighter uppercase">CHALLENGE</h2>
                    <div className="h-1 w-16 md:w-24 bg-blue-500 mx-auto rounded-full"></div>
                  </div>
                  
                  <div className="grid gap-3 md:gap-4">
                    <button 
                      onClick={() => selectMode(GameMode.ROOKIE)}
                      className={`group relative p-4 md:p-8 rounded-2xl md:rounded-3xl border-2 transition-all text-left bg-slate-900/40 hover:bg-slate-800/60 ${gameState.mode === GameMode.ROOKIE ? 'border-blue-500 ring-4 ring-blue-500/20' : 'border-slate-800'}`}
                    >
                      <div className="flex justify-between items-center mb-1 md:mb-2">
                        <span className="font-black text-lg md:text-2xl tracking-tight">ROOKIE</span>
                        <div className="flex gap-1">
                          <div className="w-2 md:w-3 h-2 md:h-3 rounded-full bg-blue-500"></div>
                          <div className="w-2 md:w-3 h-2 md:h-3 rounded-full bg-slate-800"></div>
                          <div className="w-2 md:w-3 h-2 md:h-3 rounded-full bg-slate-800"></div>
                        </div>
                      </div>
                      <p className="text-[10px] md:text-sm text-slate-500 font-medium leading-relaxed italic">Casual AI behavior. Ideal for warmups.</p>
                    </button>

                    <button 
                      onClick={() => selectMode(GameMode.PRO)}
                      className={`group relative p-4 md:p-8 rounded-2xl md:rounded-3xl border-2 transition-all text-left bg-slate-900/40 hover:bg-slate-800/60 ${gameState.mode === GameMode.PRO ? 'border-red-500 ring-4 ring-red-500/20' : 'border-slate-800'}`}
                    >
                      <div className="flex justify-between items-center mb-1 md:mb-2">
                        <span className="font-black text-lg md:text-2xl tracking-tight">PRO</span>
                        <div className="flex gap-1">
                          <div className="w-2 md:w-3 h-2 md:h-3 rounded-full bg-red-500"></div>
                          <div className="w-2 md:w-3 h-2 md:h-3 rounded-full bg-red-500"></div>
                          <div className="w-2 md:w-3 h-2 md:h-3 rounded-full bg-red-500"></div>
                        </div>
                      </div>
                      <p className="text-[10px] md:text-sm text-slate-500 font-medium leading-relaxed italic">High velocity, predictive strikes. Extreme focus required.</p>
                    </button>
                  </div>
                  
                  <p className="text-slate-600 font-bold text-[8px] md:text-[10px] tracking-[0.3em] uppercase">First to 7 wins</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Commentary Toast */}
        <div className="absolute bottom-6 md:bottom-10 left-1/2 -translate-x-1/2 z-[70] pointer-events-none w-full px-4 flex justify-center">
          <div className="bg-slate-900/90 backdrop-blur-md border border-white/10 px-6 py-2 md:px-8 md:py-3 rounded-full shadow-2xl animate-in slide-in-from-bottom-4 duration-500">
            <p className="text-[10px] md:text-sm font-black text-blue-400 uppercase tracking-widest italic leading-none whitespace-nowrap">
              {gameState.commentary}
            </p>
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;
