import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, ShieldAlert, RotateCcw, Languages, Info } from 'lucide-react';
import confetti from 'canvas-confetti';

// --- Types & Constants ---

type GameState = 'START' | 'PLAYING' | 'PAUSED' | 'WON' | 'LOST' | 'ROUND_END';
type Language = 'en' | 'zh';

interface Point {
  x: number;
  y: number;
}

interface Rocket {
  id: number;
  start: Point;
  pos: Point;
  target: Point;
  speed: number;
  destroyed: boolean;
}

interface Interceptor {
  id: number;
  start: Point;
  pos: Point;
  target: Point;
  speed: number;
  state: 'FLYING' | 'EXPLODING';
  explosionRadius: number;
  maxExplosionRadius: number;
  explosionTimer: number;
}

interface City {
  id: number;
  x: number;
  active: boolean;
  shields: number;
}

interface Battery {
  id: number;
  x: number;
  missiles: number;
  maxMissiles: number;
  active: boolean;
}

const WORLD_WIDTH = 1000;
const WORLD_HEIGHT = 800;
const EXPLOSION_SPEED = 2.0;
const INTERCEPTOR_SPEED = 12;
const ROCKET_BASE_SPEED = 0.5; // Slightly slower start for level 1
const WIN_SCORE_PER_LEVEL = 200; // Score needed to pass each level
const MAX_LEVELS = 10;
const BG_IMAGE_URL = '/sky.png';

interface Star {
  x: number;
  y: number;
  size: number;
  opacity: number;
}

const TRANSLATIONS = {
  en: {
    title: 'Millie Nova Defense',
    start: 'Start Game',
    restart: 'Play Again',
    exit: 'Exit',
    won: 'Mission Success!',
    lost: 'Defense Failed',
    score: 'Score',
    missiles: 'Missiles',
    pause: 'Pause',
    resume: 'Resume',
    rules: 'Rules: Click to launch interceptors. Protect 6 cities. Each battery has limited ammo. Reach 1000 points to win!',
    instructions: 'Intercept incoming rockets before they hit your cities.',
    finalScore: 'Final Score',
    roundComplete: 'Round Complete',
    nextRound: 'Next Round',
    replayPrev: 'Replay Previous Level',
  },
  zh: {
    title: 'Millie 新星防御',
    start: '开始游戏',
    restart: '再玩一次',
    exit: '退出',
    won: '任务成功！',
    lost: '防御失败',
    score: '得分',
    missiles: '导弹',
    pause: '暂停',
    resume: '继续',
    rules: '规则：点击屏幕发射拦截导弹。保护底部的6座城市。炮台弹药有限，每轮结束后补充。达到1000分即获胜！',
    instructions: '在敌方火箭摧毁城市前拦截它们。',
    finalScore: '最终得分',
    roundComplete: '回合结束',
    nextRound: '下一回合',
    replayPrev: '重玩上一关',
  }
};

// --- Game Component ---

export default function Game() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [gameState, setGameState] = useState<GameState>('START');
  const [lang, setLang] = useState<Language>('zh');
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [round, setRound] = useState(1);
  
  // Game Objects
  const bgImageRef = useRef<HTMLImageElement | null>(null);
  const starsRef = useRef<Star[]>([]);
  const rocketsRef = useRef<Rocket[]>([]);
  const interceptorsRef = useRef<Interceptor[]>([]);
  const citiesRef = useRef<City[]>([
    { id: 1, x: 200, active: true, shields: 3 },
    { id: 2, x: 300, active: true, shields: 3 },
    { id: 3, x: 400, active: true, shields: 3 },
    { id: 4, x: 600, active: true, shields: 3 },
    { id: 5, x: 700, active: true, shields: 3 },
    { id: 6, x: 800, active: true, shields: 3 },
  ]);
  const batteriesRef = useRef<Battery[]>([
    { id: 0, x: 100, missiles: 20, maxMissiles: 20, active: true },
    { id: 1, x: 500, missiles: 40, maxMissiles: 40, active: true },
    { id: 2, x: 900, missiles: 20, maxMissiles: 20, active: true },
  ]);

  const t = TRANSLATIONS[lang];

  // --- Initialization & Reset ---

  const resetGame = useCallback(() => {
    setScore(0);
    setLevel(1);
    setRound(1);
    rocketsRef.current = [];
    interceptorsRef.current = [];
    citiesRef.current = citiesRef.current.map(c => ({ ...c, active: true, shields: 3 }));
    batteriesRef.current = batteriesRef.current.map(b => ({ ...b, active: true, missiles: b.maxMissiles }));
    
    // Load background image
    const img = new Image();
    img.src = BG_IMAGE_URL;
    img.onload = () => {
      bgImageRef.current = img;
    };

    // Initialize stars (as fallback/overlay)
    const stars: Star[] = [];
    for (let i = 0; i < 150; i++) {
      stars.push({
        x: Math.random() * WORLD_WIDTH,
        y: Math.random() * WORLD_HEIGHT,
        size: Math.random() * 2,
        opacity: Math.random()
      });
    }
    starsRef.current = stars;
    
    setGameState('PLAYING');
  }, []);

  const nextRound = useCallback(() => {
    setRound(prev => prev + 1);
    rocketsRef.current = [];
    interceptorsRef.current = [];
    // Refill missiles and REPAIR batteries (as per "batteries stay")
    batteriesRef.current = batteriesRef.current.map(b => ({ ...b, active: true, missiles: b.maxMissiles }));
    setGameState('PLAYING');
  }, []);

  const nextLevel = useCallback(() => {
    if (level >= MAX_LEVELS) {
      setGameState('WON');
      confetti({
        particleCount: 200,
        spread: 100,
        origin: { y: 0.6 }
      });
      return;
    }
    setLevel(prev => prev + 1);
    setRound(1);
    rocketsRef.current = [];
    interceptorsRef.current = [];
    batteriesRef.current = batteriesRef.current.map(b => ({ ...b, active: true, missiles: b.maxMissiles }));
    setGameState('PLAYING');
  }, [level]);

  const replayPreviousLevel = useCallback(() => {
    const prevLevel = Math.max(1, level - 1);
    setLevel(prevLevel);
    setRound(1);
    setScore((prevLevel - 1) * WIN_SCORE_PER_LEVEL);
    rocketsRef.current = [];
    interceptorsRef.current = [];
    citiesRef.current = citiesRef.current.map(c => ({ ...c, active: true }));
    batteriesRef.current = batteriesRef.current.map(b => ({ ...b, active: true, missiles: b.maxMissiles }));
    setGameState('PLAYING');
  }, [level]);

  // --- Game Logic ---

  const spawnRocket = useCallback(() => {
    const targets = [
      ...citiesRef.current.filter(c => c.active).map(c => ({ x: c.x, y: WORLD_HEIGHT - 20 })),
      ...batteriesRef.current.filter(b => b.active).map(b => ({ x: b.x, y: WORLD_HEIGHT - 20 }))
    ];
    
    if (targets.length === 0) return;

    const target = targets[Math.floor(Math.random() * targets.length)];
    const startX = Math.random() * WORLD_WIDTH;
    
    // Speed increases with level
    const speed = ROCKET_BASE_SPEED + (level * 0.3) + (round * 0.1);
    
    const newRocket: Rocket = {
      id: Date.now() + Math.random(),
      start: { x: startX, y: 0 },
      pos: { x: startX, y: 0 },
      target: target,
      speed: speed,
      destroyed: false
    };
    
    rocketsRef.current.push(newRocket);
  }, [level, round]);

  const fireInterceptor = (targetX: number, targetY: number) => {
    if (gameState !== 'PLAYING') return;

    // Find closest active battery with missiles
    let bestBattery: Battery | null = null;
    let minDist = Infinity;

    batteriesRef.current.forEach(b => {
      if (b.active && b.missiles > 0) {
        const dist = Math.abs(b.x - targetX);
        if (dist < minDist) {
          minDist = dist;
          bestBattery = b;
        }
      }
    });

    if (bestBattery) {
      const battery = bestBattery as Battery;
      battery.missiles -= 1;
      
      const createInterceptor = (offsetX: number = 0) => ({
        id: Date.now() + Math.random(),
        start: { x: battery.x + offsetX, y: WORLD_HEIGHT - 40 },
        pos: { x: battery.x + offsetX, y: WORLD_HEIGHT - 40 },
        target: { x: targetX + offsetX, y: targetY },
        speed: INTERCEPTOR_SPEED,
        state: 'FLYING' as const,
        explosionRadius: 0,
        maxExplosionRadius: 60,
        explosionTimer: 0
      });

      if (battery.id === 1) { // Middle battery fires triple
        interceptorsRef.current.push(createInterceptor(-30));
        interceptorsRef.current.push(createInterceptor(0));
        interceptorsRef.current.push(createInterceptor(30));
      } else {
        interceptorsRef.current.push(createInterceptor(0));
      }
    }
  };

  const togglePause = () => {
    if (gameState === 'PLAYING') setGameState('PAUSED');
    else if (gameState === 'PAUSED') setGameState('PLAYING');
  };

  const exitToMenu = () => {
    setGameState('START');
    setScore(0);
    setRound(1);
    rocketsRef.current = [];
    interceptorsRef.current = [];
    citiesRef.current = citiesRef.current.map(c => ({ ...c, active: true }));
    batteriesRef.current = batteriesRef.current.map(b => ({ ...b, active: true, missiles: b.maxMissiles }));
  };

  // --- Main Loop ---

  useEffect(() => {
    if (gameState !== 'PLAYING') return;

    let animationFrameId: number;
    let lastSpawnTime = 0;
    // Density increases with level (interval decreases)
    const spawnInterval = Math.max(300, 2000 - (level * 150) - (round * 100));

    const update = (time: number) => {
      // Spawn rockets - Base density adjusted by level
      if (time - lastSpawnTime > spawnInterval) {
        spawnRocket();
        lastSpawnTime = time;
      }

      // Update Rockets
      rocketsRef.current.forEach(rocket => {
        const dx = rocket.target.x - rocket.start.x;
        const dy = rocket.target.y - rocket.start.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const vx = (dx / dist) * rocket.speed;
        const vy = (dy / dist) * rocket.speed;

        rocket.pos.x += vx;
        rocket.pos.y += vy;

        // Check if hit target
        if (rocket.pos.y >= rocket.target.y) {
          rocket.destroyed = true;
          // Damage city or battery
          const city = citiesRef.current.find(c => c.x === rocket.target.x);
          if (city && city.active) {
            city.shields -= 1;
            if (city.shields <= 0) city.active = false;
          }
          const battery = batteriesRef.current.find(b => b.x === rocket.target.x);
          if (battery) battery.active = false;
        }
      });

      // Update Interceptors
      interceptorsRef.current.forEach(inter => {
        if (inter.state === 'FLYING') {
          const dx = inter.target.x - inter.start.x;
          const dy = inter.target.y - inter.start.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const vx = (dx / dist) * inter.speed;
          const vy = (dy / dist) * inter.speed;

          inter.pos.x += vx;
          inter.pos.y += vy;

          // Check if reached target
          const distToTarget = Math.sqrt(
            Math.pow(inter.pos.x - inter.target.x, 2) + 
            Math.pow(inter.pos.y - inter.target.y, 2)
          );

          if (distToTarget < inter.speed) {
            inter.state = 'EXPLODING';
          }
        } else {
          // Explosion logic
          if (inter.explosionTimer < 30) {
            inter.explosionRadius += EXPLOSION_SPEED;
          } else {
            inter.explosionRadius -= EXPLOSION_SPEED;
          }
          inter.explosionTimer++;
          
          // Collision detection with rockets
          rocketsRef.current.forEach(rocket => {
            if (!rocket.destroyed) {
              const dist = Math.sqrt(
                Math.pow(rocket.pos.x - inter.pos.x, 2) + 
                Math.pow(rocket.pos.y - inter.pos.y, 2)
              );
              if (dist < inter.explosionRadius) {
                rocket.destroyed = true;
                setScore(s => s + 20);
              }
            }
          });
        }
      });

      // Cleanup
      rocketsRef.current = rocketsRef.current.filter(r => !r.destroyed);
      interceptorsRef.current = interceptorsRef.current.filter(i => i.explosionRadius > 0 || i.state === 'FLYING');

      // Check Game Over / Win
      if (batteriesRef.current.every(b => !b.active)) {
        setGameState('LOST');
      } else if (score >= level * WIN_SCORE_PER_LEVEL) {
        setGameState('ROUND_END');
      }

      // Check Round End (No more missiles and no more active rockets/interceptors)
      const totalMissiles = batteriesRef.current.reduce((acc, b) => acc + b.missiles, 0);
      if (totalMissiles === 0 && rocketsRef.current.length === 0 && interceptorsRef.current.length === 0) {
        // Bonus points for remaining cities and shields
        const activeCities = citiesRef.current.filter(c => c.active);
        const bonus = activeCities.length * 50 + activeCities.reduce((acc, c) => acc + c.shields * 20, 0);
        setScore(s => s + bonus);
        setGameState('ROUND_END');
      }

      draw();
      animationFrameId = requestAnimationFrame(update);
    };

    const draw = () => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (!canvas || !ctx) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      const scaleX = canvas.width / WORLD_WIDTH;
      const scaleY = canvas.height / WORLD_HEIGHT;

      // Draw Background Image
      if (bgImageRef.current) {
        ctx.drawImage(bgImageRef.current, 0, 0, canvas.width, canvas.height);
      } else {
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      // Draw Stars (Overlay)
      ctx.fillStyle = '#ffffff';
      starsRef.current.forEach(star => {
        ctx.globalAlpha = star.opacity;
        ctx.beginPath();
        ctx.arc(star.x * scaleX, star.y * scaleY, star.size * scaleX, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1.0;

      // Draw Rockets - Missile Icons
      rocketsRef.current.forEach(r => {
        const x = r.pos.x * scaleX;
        const y = r.pos.y * scaleY;
        
        // Draw a small red missile shape
        ctx.save();
        ctx.translate(x, y);
        
        // Calculate angle
        const angle = Math.atan2(r.target.y - r.start.y, r.target.x - r.start.x);
        ctx.rotate(angle + Math.PI / 2);
        
        // Missile Body
        ctx.fillStyle = '#ff4d4d';
        ctx.beginPath();
        ctx.moveTo(0, -8);
        ctx.lineTo(4, 4);
        ctx.lineTo(-4, 4);
        ctx.closePath();
        ctx.fill();
        
        // Fins
        ctx.fillStyle = '#cc0000';
        ctx.fillRect(-5, 2, 2, 4);
        ctx.fillRect(3, 2, 2, 4);
        
        // Flame
        if (Math.random() > 0.3) {
          ctx.fillStyle = '#ffa500';
          ctx.beginPath();
          ctx.moveTo(-2, 4);
          ctx.lineTo(0, 10);
          ctx.lineTo(2, 4);
          ctx.fill();
        }
        
        ctx.restore();
      });

      // Draw Interceptors
      interceptorsRef.current.forEach(i => {
        if (i.state === 'FLYING') {
          ctx.strokeStyle = '#4da6ff';
          ctx.beginPath();
          ctx.moveTo(i.start.x * scaleX, i.start.y * scaleY);
          ctx.lineTo(i.pos.x * scaleX, i.pos.y * scaleY);
          ctx.stroke();
          
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(i.pos.x * scaleX - 1, i.pos.y * scaleY - 1, 2, 2);
        } else {
          // Explosion
          const gradient = ctx.createRadialGradient(
            i.pos.x * scaleX, i.pos.y * scaleY, 0,
            i.pos.x * scaleX, i.pos.y * scaleY, i.explosionRadius * scaleX
          );
          gradient.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
          gradient.addColorStop(0.5, 'rgba(255, 200, 50, 0.6)');
          gradient.addColorStop(1, 'rgba(255, 50, 0, 0)');
          
          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.arc(i.pos.x * scaleX, i.pos.y * scaleY, i.explosionRadius * scaleX, 0, Math.PI * 2);
          ctx.fill();
        }
      });

      // Draw X marks for targets
      interceptorsRef.current.forEach(i => {
        if (i.state === 'FLYING') {
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
          ctx.lineWidth = 1;
          const x = i.target.x * scaleX;
          const y = i.target.y * scaleY;
          const s = 5;
          ctx.beginPath();
          ctx.moveTo(x - s, y - s);
          ctx.lineTo(x + s, y + s);
          ctx.moveTo(x + s, y - s);
          ctx.lineTo(x - s, y + s);
          ctx.stroke();
        }
      });

      // Draw Ground
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(0, canvas.height - 20, canvas.width, 20);

      // Draw Cities
      citiesRef.current.forEach(c => {
        if (c.active) {
          // Draw Shield
          if (c.shields > 0) {
            ctx.save();
            ctx.beginPath();
            ctx.arc(c.x * scaleX, (WORLD_HEIGHT - 35) * scaleY, 30 * scaleX, Math.PI, 0);
            const shieldOpacity = c.shields / 3 * 0.4;
            ctx.fillStyle = `rgba(77, 166, 255, ${shieldOpacity})`;
            ctx.strokeStyle = `rgba(255, 255, 255, ${shieldOpacity * 2})`;
            ctx.lineWidth = 2;
            ctx.fill();
            ctx.stroke();
            ctx.restore();
          }

          ctx.fillStyle = '#4da6ff';
          ctx.fillRect(c.x * scaleX - 15, canvas.height - 35, 30, 15);
          ctx.fillStyle = '#2d5a8a';
          ctx.fillRect(c.x * scaleX - 10, canvas.height - 45, 20, 10);
        }
      });

      // Draw Batteries
      batteriesRef.current.forEach(b => {
        if (b.active) {
          ctx.fillStyle = '#ffcc00';
          ctx.beginPath();
          ctx.moveTo(b.x * scaleX - 20, canvas.height - 20);
          ctx.lineTo(b.x * scaleX, canvas.height - 50);
          ctx.lineTo(b.x * scaleX + 20, canvas.height - 20);
          ctx.fill();
          
          // Draw missile count visually
          ctx.fillStyle = '#ffffff';
          ctx.font = '10px monospace';
          ctx.textAlign = 'center';
          ctx.fillText(b.missiles.toString(), b.x * scaleX, canvas.height - 5);
        }
      });
    };

    animationFrameId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(animationFrameId);
  }, [gameState, round, score, spawnRocket]);

  // --- Resize Handling ---

  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current && canvasRef.current) {
        canvasRef.current.width = containerRef.current.clientWidth;
        canvasRef.current.height = containerRef.current.clientHeight;
      }
    };

    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleCanvasClick = (e: React.MouseEvent | React.TouchEvent) => {
    if (gameState !== 'PLAYING') return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    let clientX, clientY;

    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const x = ((clientX - rect.left) / canvas.width) * WORLD_WIDTH;
    const y = ((clientY - rect.top) / canvas.height) * WORLD_HEIGHT;
    
    // Direct hit detection
    let directHit = false;
    rocketsRef.current.forEach(rocket => {
      const dist = Math.sqrt(Math.pow(rocket.pos.x - x, 2) + Math.pow(rocket.pos.y - y, 2));
      if (dist < 30) { // Hitbox for direct click
        rocket.destroyed = true;
        setScore(s => s + 20);
        directHit = true;
        
        // Create an immediate explosion at the hit point
        const newInterceptor: Interceptor = {
          id: Date.now() + Math.random(),
          start: { x: rocket.pos.x, y: rocket.pos.y },
          pos: { x: rocket.pos.x, y: rocket.pos.y },
          target: { x: rocket.pos.x, y: rocket.pos.y },
          speed: INTERCEPTOR_SPEED,
          state: 'EXPLODING',
          explosionRadius: 10,
          maxExplosionRadius: 60,
          explosionTimer: 0
        };
        interceptorsRef.current.push(newInterceptor);
      }
    });

    if (!directHit) {
      fireInterceptor(x, y);
    }
  };

  return (
    <div ref={containerRef} className="relative w-full h-full bg-black overflow-hidden font-sans select-none touch-none">
      {/* Game Canvas */}
      <canvas
        ref={canvasRef}
        onClick={handleCanvasClick}
        onTouchStart={handleCanvasClick}
        className="block w-full h-full cursor-crosshair"
      />

      {/* UI Overlay */}
      <div className="absolute top-0 left-0 w-full p-4 flex justify-between items-start pointer-events-none">
        <div className="bg-black/50 backdrop-blur-md border border-white/10 p-3 rounded-xl pointer-events-auto">
          <div className="text-xs text-white/50 uppercase tracking-widest mb-1">{t.score}</div>
          <div className="text-3xl font-bold text-white tabular-nums">{score.toLocaleString()}</div>
          <div className="flex items-center gap-2 mt-1">
            <div className="text-[10px] text-emerald-400 uppercase tracking-tighter">GOAL: {level * WIN_SCORE_PER_LEVEL}</div>
            <div className="w-1 h-1 rounded-full bg-white/20" />
            <div className="text-[10px] text-white/60 uppercase tracking-tighter">LEVEL {level}</div>
            <div className="w-1 h-1 rounded-full bg-white/20" />
            <div className="text-[10px] text-white/60 uppercase tracking-tighter">ROUND {round}</div>
          </div>
        </div>

        <div className="flex gap-2 pointer-events-auto">
          {gameState === 'PLAYING' || gameState === 'PAUSED' ? (
            <button 
              onClick={togglePause}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors text-white text-xs font-bold flex items-center gap-2"
            >
              {gameState === 'PAUSED' ? t.resume : t.pause}
            </button>
          ) : null}
          <button 
            onClick={() => setLang(l => l === 'en' ? 'zh' : 'en')}
            className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors text-white"
          >
            <Languages size={20} />
          </button>
        </div>
      </div>

      {/* Game State Screens */}
      <AnimatePresence>
        {gameState !== 'PLAYING' && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-6 z-50"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="max-w-md w-full bg-zinc-900 border border-white/10 rounded-3xl p-8 text-center shadow-2xl"
            >
              {gameState === 'START' && (
                <>
                  <h1 className="text-4xl font-bold text-white mb-4 tracking-tight">{t.title}</h1>
                  <p className="text-zinc-400 mb-4 leading-relaxed">{t.instructions}</p>
                  <div className="bg-white/5 border border-white/10 rounded-2xl p-4 mb-8 text-left">
                    <div className="flex items-center gap-2 text-emerald-400 mb-2">
                      <Info size={16} />
                      <span className="text-xs font-bold uppercase tracking-wider">Game Rules / 游戏规则</span>
                    </div>
                    <p className="text-sm text-zinc-300 leading-relaxed">
                      {t.rules}
                    </p>
                  </div>
                  <button 
                    onClick={resetGame}
                    className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-2xl transition-all transform hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2"
                  >
                    {t.start}
                  </button>
                </>
              )}

              {gameState === 'PAUSED' && (
                <>
                  <h2 className="text-3xl font-bold text-white mb-8">{t.pause}</h2>
                  <div className="flex flex-col gap-3">
                    <button 
                      onClick={togglePause}
                      className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-2xl transition-all flex items-center justify-center gap-2"
                    >
                      {t.resume}
                    </button>
                    <button 
                      onClick={exitToMenu}
                      className="w-full py-4 bg-white/10 hover:bg-white/20 text-white font-bold rounded-2xl transition-all flex items-center justify-center gap-2"
                    >
                      {t.exit}
                    </button>
                  </div>
                </>
              )}

              {gameState === 'WON' && (
                <>
                  <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Trophy className="text-emerald-500" size={40} />
                  </div>
                  <h2 className="text-3xl font-bold text-white mb-2">{t.won}</h2>
                  <div className="text-zinc-400 mb-8">
                    {t.finalScore}: <span className="text-white font-bold">{score}</span>
                  </div>
                  <div className="flex flex-col gap-3">
                    <button 
                      onClick={resetGame}
                      className="w-full py-4 bg-white text-black font-bold rounded-2xl transition-all hover:bg-zinc-200 flex items-center justify-center gap-2"
                    >
                      <RotateCcw size={20} />
                      {t.restart}
                    </button>
                    <button 
                      onClick={exitToMenu}
                      className="w-full py-4 bg-white/10 hover:bg-white/20 text-white font-bold rounded-2xl transition-all flex items-center justify-center gap-2"
                    >
                      {t.exit}
                    </button>
                  </div>
                </>
              )}

              {gameState === 'LOST' && (
                <>
                  <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                    <ShieldAlert className="text-red-500" size={40} />
                  </div>
                  <h2 className="text-3xl font-bold text-white mb-2">{t.lost}</h2>
                  <div className="text-zinc-400 mb-8">
                    {t.finalScore}: <span className="text-white font-bold">{score}</span>
                  </div>
                  <div className="flex flex-col gap-3">
                    <button 
                      onClick={resetGame}
                      className="w-full py-4 bg-red-500 hover:bg-red-400 text-white font-bold rounded-2xl transition-all flex items-center justify-center gap-2"
                    >
                      <RotateCcw size={20} />
                      {t.restart}
                    </button>
                    <button 
                      onClick={exitToMenu}
                      className="w-full py-4 bg-white/10 hover:bg-white/20 text-white font-bold rounded-2xl transition-all flex items-center justify-center gap-2"
                    >
                      {t.exit}
                    </button>
                  </div>
                </>
              )}

              {gameState === 'ROUND_END' && (
                <>
                  <h2 className="text-3xl font-bold text-white mb-2">{t.roundComplete}</h2>
                  <div className="text-zinc-400 mb-8">
                    {t.score}: <span className="text-white font-bold">{score}</span>
                  </div>
                  <div className="flex flex-col gap-3">
                    <button 
                      onClick={nextLevel}
                      className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-2xl transition-all flex items-center justify-center gap-2"
                    >
                      {t.nextRound}
                    </button>
                    {level > 1 && (
                      <button 
                        onClick={replayPreviousLevel}
                        className="w-full py-4 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 font-bold rounded-2xl transition-all flex items-center justify-center gap-2 border border-amber-500/30"
                      >
                        <RotateCcw size={20} />
                        {t.replayPrev}
                      </button>
                    )}
                    <button 
                      onClick={exitToMenu}
                      className="w-full py-4 bg-white/10 hover:bg-white/20 text-white font-bold rounded-2xl transition-all flex items-center justify-center gap-2"
                    >
                      {t.exit}
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom Info Bar */}
      <div className="absolute bottom-6 left-0 w-full px-6 flex justify-center pointer-events-none">
        <div className="flex gap-4 bg-black/40 backdrop-blur-sm px-4 py-2 rounded-full border border-white/5">
          {batteriesRef.current.map(b => (
            <div key={b.id} className={`flex items-center gap-2 ${b.active ? 'text-white' : 'text-white/20'}`}>
              <div className={`w-2 h-2 rounded-full ${b.active ? (b.missiles > 5 ? 'bg-emerald-500' : 'bg-amber-500') : 'bg-red-500'}`} />
              <span className="text-xs font-mono">{b.missiles}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
