import { useEffect, useRef, useState } from 'react';
import { Gamepad2, Play, RotateCcw, Trophy } from 'lucide-react';
import type {
  AdminQuizItem,
  AdvisorProfile,
  LocalUser,
  Motorcycle,
  TimeGuideEntry,
} from '../types';

interface MotoRunnerGameProps {
  motorcycles: Motorcycle[];
  timeGuides: TimeGuideEntry[];
  adminQuizItems: AdminQuizItem[];
  user: LocalUser | null;
  advisorProfile: AdvisorProfile | null;
  leaderboard: AdvisorProfile[];
  onOpenProfileModal: () => void;
  onSaveGameHighScore: (newScore: number) => Promise<void>;
}

export default function MotoRunnerGame({
  user,
  advisorProfile,
  leaderboard,
  onOpenProfileModal,
  onSaveGameHighScore,
}: MotoRunnerGameProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [currentScore, setCurrentScore] = useState(0);

  const gameState = useRef({
    motoY: 180,
    velocityY: 0,
    isJumping: false,
    obstacles: [] as { x: number; width: number; height: number }[],
    score: 0,
    speed: 6,
    frame: 0,
  });

  const jump = () => {
    if (!gameState.current.isJumping) {
      gameState.current.velocityY = -13;
      gameState.current.isJumping = true;
    }
  };

  const startGame = () => {
    gameState.current = {
      motoY: 180,
      velocityY: 0,
      isJumping: false,
      obstacles: [],
      score: 0,
      speed: 6,
      frame: 0,
    };
    setCurrentScore(0);
    setGameOver(false);
    setIsPlaying(true);
  };

  useEffect(() => {
    if (!isPlaying) return;
    let animationId: number;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const loop = () => {
      const state = gameState.current;
      state.frame++;
      state.score += 1;
      if (state.frame % 10 === 0) setCurrentScore(state.score);
      if (state.frame % 400 === 0) state.speed += 0.5;

      state.velocityY += 0.7;
      state.motoY += state.velocityY;
      if (state.motoY >= 180) {
        state.motoY = 180;
        state.velocityY = 0;
        state.isJumping = false;
      }

      if (state.frame % Math.max(55, Math.floor(110 - state.speed * 4)) === 0) {
        state.obstacles.push({
          x: canvas.width,
          width: 28,
          height: 36,
        });
      }

      for (let i = state.obstacles.length - 1; i >= 0; i--) {
        const obs = state.obstacles[i];
        obs.x -= state.speed;

        const motoBox = { x: 60, y: state.motoY, w: 46, h: 32 };
        const obsBox = { x: obs.x, y: 212 - obs.height, w: obs.width, h: obs.height };

        if (
          motoBox.x < obsBox.x + obsBox.w &&
          motoBox.x + motoBox.w > obsBox.x &&
          motoBox.y < obsBox.y + obsBox.h &&
          motoBox.y + motoBox.h > obsBox.y
        ) {
          setIsPlaying(false);
          setGameOver(true);
          if (user) {
            onSaveGameHighScore(state.score);
          }
          return;
        }

        if (obs.x + obs.width < 0) {
          state.obstacles.splice(i, 1);
        }
      }

      ctx.fillStyle = '#231F20';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = '#3F3F46';
      ctx.fillRect(0, 212, canvas.width, 38);
      ctx.fillStyle = '#F28F17';
      ctx.fillRect(0, 212, canvas.width, 3);

      ctx.fillStyle = '#F28F17';
      ctx.fillRect(60, state.motoY, 46, 26);
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(70, state.motoY + 28, 7, 0, Math.PI * 2);
      ctx.arc(98, state.motoY + 28, 7, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#EF4444';
      state.obstacles.forEach((obs) => {
        ctx.fillRect(obs.x, 212 - obs.height, obs.width, obs.height);
      });

      animationId = requestAnimationFrame(loop);
    };

    animationId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animationId);
  }, [isPlaying, user, onSaveGameHighScore]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'ArrowUp') {
        e.preventDefault();
        if (isPlaying) jump();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isPlaying]);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm lg:col-span-2">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="flex items-center gap-2 font-display text-3xl font-extrabold uppercase text-[#231F20]">
              <Gamepad2 className="h-7 w-7 text-[#F28F17]" /> Moto Runner VENTO
            </h2>
            <p className="text-xs text-zinc-500">
              Presiona <strong>ESPACIO</strong> o haz clic en la pista para saltar obstáculos.
            </p>
          </div>
          <div className="text-right">
            <div className="text-xs text-zinc-500">Puntaje Actual</div>
            <div className="font-mono text-2xl font-extrabold text-[#F28F17]">{currentScore}</div>
          </div>
        </div>

        <div
          onClick={() => isPlaying && jump()}
          className="relative cursor-pointer overflow-hidden rounded-xl border-2 border-[#231F20]"
        >
          <canvas ref={canvasRef} width={700} height={250} className="w-full bg-[#231F20]" />

          {!isPlaying && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/75 p-4 text-center text-white">
              {gameOver ? (
                <>
                  <h3 className="font-display text-4xl font-extrabold text-[#F28F17]">
                    ¡Fin de la Carrera!
                  </h3>
                  <p className="mt-1 font-mono text-lg">Puntaje: {currentScore} pts</p>
                  <button
                    onClick={startGame}
                    className="mt-4 flex items-center gap-2 rounded-xl bg-[#F28F17] px-6 py-3 text-xs font-extrabold uppercase text-[#231F20]"
                  >
                    <RotateCcw className="h-4 w-4" /> Jugar de Nuevo
                  </button>
                </>
              ) : (
                <>
                  <h3 className="font-display text-3xl font-extrabold">¿Listo para rodar?</h3>
                  {!user && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenProfileModal();
                      }}
                      className="mt-2 text-xs text-[#F28F17] underline"
                    >
                      Inicia sesión para guardar tu récord en Sheets
                    </button>
                  )}
                  <button
                    onClick={startGame}
                    className="mt-4 flex items-center gap-2 rounded-xl bg-[#F28F17] px-6 py-3 text-xs font-extrabold uppercase text-[#231F20]"
                  >
                    <Play className="h-4 w-4" /> Iniciar Carrera
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {advisorProfile && (
          <div className="rounded-xl bg-zinc-100 px-4 py-2.5 text-xs font-semibold text-zinc-700">
            Tu Récord Personal en Sheets:{' '}
            <span className="font-mono font-bold text-[#F28F17]">
              {advisorProfile.gameHighScore} pts
            </span>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2 border-b border-zinc-200 pb-3">
          <Trophy className="h-5 w-5 text-[#F28F17]" />
          <h3 className="font-display text-xl font-bold uppercase text-[#231F20]">
            Top Pilotos Moto Runner
          </h3>
        </div>
        <div className="mt-4 space-y-2">
          {[...leaderboard]
            .sort((a, b) => (b.gameHighScore || 0) - (a.gameHighScore || 0))
            .slice(0, 8)
            .map((adv, i) => (
              <div
                key={adv.uid}
                className="flex items-center justify-between rounded-lg bg-zinc-50 px-3 py-2 text-xs"
              >
                <span className="font-semibold text-zinc-800">
                  {i + 1}. {adv.displayName}
                </span>
                <span className="font-mono font-bold text-[#F28F17]">
                  {adv.gameHighScore || 0} pts
                </span>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
