import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  ArrowLeft,
  ArrowRight,
  Download,
  Heart,
  ShieldCheck,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { generateDynamicQuestions } from '../data/seedData';
import type {
  AdminQuizItem,
  AdvisorProfile,
  Motorcycle,
  QuizQuestion,
  TimeGuideEntry,
} from '../types';
import {
  playCollectSound,
  playCorrectSound,
  playCrashSound,
  playJumpSound,
  playWrongSound,
} from '../utils/soundFx';

interface MotoRunnerGameProps {
  motorcycles: Motorcycle[];
  timeGuides: TimeGuideEntry[];
  adminQuizItems: AdminQuizItem[];
  user: User | null;
  advisorProfile: AdvisorProfile | null;
  leaderboard: AdvisorProfile[];
  onOpenProfileModal: () => void;
  onSaveGameHighScore: (newScore: number) => Promise<void>;
}

type ArcadeMode = 'runner' | 'ruta';
type GameState = 'READY' | 'PLAYING' | 'CHECKPOINT' | 'GAME_OVER';

interface RunnerObstacle {
  x: number;
  y: number;
  w: number;
  h: number;
  kind: 'cone' | 'crate' | 'sign';
}

interface RunnerPickup {
  x: number;
  y: number;
  r: number;
  kind: 'oil' | 'stamp';
  collected: boolean;
}

interface DustParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
}

interface RutaEntity {
  lane: number; // 0, 1, 2
  y: number;
  kind: 'barrier' | 'car' | 'barrel' | 'helmet' | 'wrench' | 'turbo';
  isPickup: boolean;
  pts: number;
}

function getUnitPalette(moto?: Motorcycle): {
  primary: string;
  secondary: string;
  styleTag: 'urban' | 'adventure' | 'piston';
} {
  if (!moto) {
    return { primary: '#EA580C', secondary: '#FBBF24', styleTag: 'urban' };
  }
  if (moto.brand === 'AMERICAN PISTON') {
    return { primary: '#DC2626', secondary: '#F4F4F5', styleTag: 'piston' };
  }
  if (
    moto.family === 'Doble Propósito' ||
    moto.family === 'Adventure' ||
    moto.family === 'Cuatrimotos'
  ) {
    return {
      primary: '#D97706',
      secondary: '#E4E4E7',
      styleTag: 'adventure',
    };
  }
  if (moto.family === 'Rebeldes') {
    return { primary: '#7C3AED', secondary: '#E4E4E7', styleTag: 'urban' };
  }
  if (moto.family === 'Trabajo') {
    return { primary: '#16A34A', secondary: '#FEF08A', styleTag: 'urban' };
  }
  if (moto.family === 'Motonetas' || moto.family === 'Ciudad') {
    return { primary: '#0284C7', secondary: '#E0F2FE', styleTag: 'urban' };
  }
  return { primary: '#EA580C', secondary: '#FBBF24', styleTag: 'urban' };
}

function buildCheckpointQuestion(
  pool: QuizQuestion[],
  units: Motorcycle[]
): QuizQuestion | null {
  if (pool.length > 0) {
    return pool[Math.floor(Math.random() * pool.length)];
  }
  if (units.length === 0) return null;
  const target = units[Math.floor(Math.random() * units.length)];
  const correctFamily =
    target.brand === 'AMERICAN PISTON' ? 'American Pistón' : target.family;
  const allFamilies = Array.from(
    new Set(
      units.map((u) =>
        u.brand === 'AMERICAN PISTON' ? 'American Pistón' : u.family
      )
    )
  ).filter((f) => f !== correctFamily);

  const distractors: string[] = [];
  const fPool = [...allFamilies];
  while (distractors.length < 2 && fPool.length > 0) {
    const idx = Math.floor(Math.random() * fPool.length);
    distractors.push(fPool.splice(idx, 1)[0]);
  }
  const options = [correctFamily, ...distractors];
  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [options[i], options[j]] = [options[j], options[i]];
  }
  return {
    id: `fallback-${target.id}`,
    topic: 'Familias',
    brand: target.brand,
    sourceSection: 'Ficha Técnica · Familia',
    question: `¿A qué familia pertenece la unidad ${target.model} (${target.displacementCc} cc)?`,
    options,
    correctIndex: options.indexOf(correctFamily),
    explanation: `${target.model} pertenece a la familia ${correctFamily}.`,
  };
}

export default function MotoRunnerGame({
  motorcycles,
  timeGuides,
  adminQuizItems,
  user,
  advisorProfile,
  leaderboard,
  onOpenProfileModal,
  onSaveGameHighScore,
}: MotoRunnerGameProps) {
  const activeUnits = useMemo(() => {
    const active = motorcycles.filter((m) => m.isActive);
    return active.length > 0 ? active : motorcycles;
  }, [motorcycles]);

  const checkpointPool = useMemo(
    () => generateDynamicQuestions(motorcycles, timeGuides, adminQuizItems),
    [motorcycles, timeGuides, adminQuizItems]
  );
  const checkpointPoolRef = useRef<QuizQuestion[]>(checkpointPool);
  checkpointPoolRef.current = checkpointPool;

  const [arcadeMode, setArcadeMode] = useState<ArcadeMode>('runner');
  const [selectedMotoId, setSelectedMotoId] = useState<string>(
    'vento-tornado-300'
  );
  const selectedMoto = useMemo(
    () =>
      activeUnits.find((m) => m.id === selectedMotoId) || activeUnits[0],
    [activeUnits, selectedMotoId]
  );
  const unitPalette = useMemo(
    () => getUnitPalette(selectedMoto),
    [selectedMoto]
  );

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [gameState, setGameState] = useState<GameState>('READY');
  const [hudScore, setHudScore] = useState(0);
  const [hudSpeed, setHudSpeed] = useState(48);
  const [hudLives, setHudLives] = useState(3);
  const [hudCombo, setHudCombo] = useState(1);
  const [hudDistance, setHudDistance] = useState(0);
  const [checkpointQ, setCheckpointQ] = useState<QuizQuestion | null>(null);
  const [checkpointFeedback, setCheckpointFeedback] = useState<string>('');
  const [localBest, setLocalBest] = useState(0);
  const [muted, setMuted] = useState(false);
  const [newRecordBanner, setNewRecordBanner] = useState(false);
  const [rankingLimit, setRankingLimit] = useState<'top15' | 'all'>('top15');

  const touchStartXRef = useRef<number | null>(null);

  const stateRef = useRef({
    arcadeMode: 'runner' as ArcadeMode,
    status: 'READY' as GameState,
    palette: unitPalette,
    muted: false,
    // Runner fields
    playerY: 0,
    playerVy: 0,
    isJumping: false,
    isDucking: false,
    wheelAngle: 0,
    speed: 6.2,
    distanceScore: 0,
    bonusScore: 0,
    runnerObstacles: [] as RunnerObstacle[],
    runnerPickups: [] as RunnerPickup[],
    particles: [] as DustParticle[],
    spawnTimer: 60,
    pickupTimer: 110,
    roadOffset: 0,
    gameOverAt: 0,
    // Ruta 3-lane fields
    lane: 1, // 0=left, 1=center, 2=right
    visualLaneX: 1,
    lives: 3,
    combo: 1,
    invulnFrames: 0,
    rutaDistanceM: 0,
    nextCheckpointM: 500,
    rutaEntities: [] as RutaEntity[],
    rutaSpawnTimer: 36,
    rutaSpeed: 4.8,
  });

  useEffect(() => {
    stateRef.current.palette = unitPalette;
  }, [unitPalette]);

  useEffect(() => {
    stateRef.current.muted = muted;
  }, [muted]);

  const personalBest = Math.max(localBest, advisorProfile?.gameHighScore ?? 0);

  const finalizeGameOver = useCallback(
    (finalScore: number) => {
      const s = stateRef.current;
      s.status = 'GAME_OVER';
      s.gameOverAt = performance.now();
      setGameState('GAME_OVER');
      setHudScore(finalScore);
      playCrashSound(s.muted);

      const prevBest = Math.max(
        localBest,
        advisorProfile?.gameHighScore ?? 0
      );
      if (finalScore > prevBest) {
        setLocalBest(finalScore);
        setNewRecordBanner(true);
        if (user) {
          onSaveGameHighScore(finalScore).catch(() => {});
        }
      }
    },
    [advisorProfile?.gameHighScore, localBest, onSaveGameHighScore, user]
  );

  const startRun = useCallback(() => {
    const s = stateRef.current;
    s.arcadeMode = arcadeMode;
    s.status = 'PLAYING';
    // Reset Runner state
    s.playerY = 0;
    s.playerVy = 0;
    s.isJumping = false;
    s.isDucking = false;
    s.speed = 6.4;
    s.distanceScore = 0;
    s.bonusScore = 0;
    s.runnerObstacles = [];
    s.runnerPickups = [];
    s.particles = [];
    s.spawnTimer = 55;
    s.pickupTimer = 95;
    // Reset Ruta 3-lane state
    s.lane = 1;
    s.visualLaneX = 1;
    s.lives = 3;
    s.combo = 1;
    s.invulnFrames = 0;
    s.rutaDistanceM = 0;
    s.nextCheckpointM = 500;
    s.rutaEntities = [];
    s.rutaSpawnTimer = 30;
    s.rutaSpeed = 4.9;

    setHudScore(0);
    setHudSpeed(arcadeMode === 'ruta' ? 58 : 48);
    setHudLives(3);
    setHudCombo(1);
    setHudDistance(0);
    setCheckpointQ(null);
    setCheckpointFeedback('');
    setNewRecordBanner(false);
    setGameState('PLAYING');
  }, [arcadeMode]);

  const handleModeSwitch = (nextMode: ArcadeMode) => {
    setArcadeMode(nextMode);
    const s = stateRef.current;
    s.arcadeMode = nextMode;
    s.status = 'READY';
    setCheckpointQ(null);
    setCheckpointFeedback('');
    setGameState('READY');
    setHudScore(0);
    setHudLives(3);
    setHudCombo(1);
    setHudDistance(0);
  };

  // Runner actions
  const triggerJump = useCallback(() => {
    const s = stateRef.current;
    if (s.arcadeMode !== 'runner') return;
    if (s.status === 'READY') {
      startRun();
      return;
    }
    if (s.status === 'GAME_OVER') {
      if (performance.now() - s.gameOverAt > 350) {
        startRun();
      }
      return;
    }
    if (s.status === 'PLAYING' && !s.isJumping) {
      s.playerVy = 13.8;
      s.isJumping = true;
      s.isDucking = false;
      playJumpSound(s.muted);
    }
  }, [startRun]);

  const setDuck = useCallback((ducking: boolean) => {
    const s = stateRef.current;
    if (s.arcadeMode !== 'runner' || s.status !== 'PLAYING') return;
    s.isDucking = ducking;
    if (ducking && s.isJumping && s.playerVy > -8) {
      s.playerVy = -9;
    }
  }, []);

  // Ruta 3-lane actions
  const moveLane = useCallback((delta: -1 | 1) => {
    const s = stateRef.current;
    if (s.arcadeMode !== 'ruta' || s.status !== 'PLAYING') return;
    const nextLane = Math.max(0, Math.min(2, s.lane + delta));
    if (nextLane !== s.lane) {
      s.lane = nextLane;
      playJumpSound(s.muted);
    }
  }, []);

  const handleAnswerCheckpoint = (selectedIndex: number) => {
    if (!checkpointQ || stateRef.current.status !== 'CHECKPOINT') return;
    const s = stateRef.current;

    if (selectedIndex === checkpointQ.correctIndex) {
      const nextCombo = Math.min(5, s.combo + 1);
      const bonus = 300 * nextCombo;
      s.combo = nextCombo;
      s.bonusScore += bonus;
      setHudCombo(nextCombo);
      setCheckpointFeedback(`¡Correcto! +${bonus} pts (Combo ${nextCombo}x)`);
      playCorrectSound(s.muted);
    } else {
      s.combo = 1;
      s.lives = Math.max(0, s.lives - 1);
      setHudCombo(1);
      setHudLives(s.lives);
      const rightAnswer =
        checkpointQ.options[checkpointQ.correctIndex] || 'Opción correcta';
      setCheckpointFeedback(
        `Incorrecto · Respuesta: ${rightAnswer} (-1 vida)`
      );
      playWrongSound(s.muted);
    }

    window.setTimeout(() => {
      if (s.lives <= 0) {
        const total = Math.floor(s.distanceScore + s.bonusScore);
        setCheckpointQ(null);
        setCheckpointFeedback('');
        finalizeGameOver(total);
        return;
      }
      s.invulnFrames = 60;
      s.rutaEntities = s.rutaEntities.filter((e) => e.y < 140);
      s.status = 'PLAYING';
      setCheckpointQ(null);
      setCheckpointFeedback('');
      setGameState('PLAYING');
    }, 850);
  };

  // Keyboard bindings
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }
      const s = stateRef.current;
      if (s.arcadeMode === 'runner') {
        if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
          e.preventDefault();
          triggerJump();
        } else if (e.code === 'ArrowDown' || e.code === 'KeyS') {
          e.preventDefault();
          setDuck(true);
        }
      } else if (s.arcadeMode === 'ruta') {
        if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
          e.preventDefault();
          moveLane(-1);
        } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
          e.preventDefault();
          moveLane(1);
        } else if (e.code === 'Space' && s.status === 'READY') {
          e.preventDefault();
          startRun();
        }
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'ArrowDown' || e.code === 'KeyS') {
        setDuck(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [triggerJump, setDuck, moveLane, startRun]);

  // Unified 60fps Canvas Loop for both Arcade modes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = 860;
    const H = 300;
    const GROUND_Y = 242;
    const PLAYER_X = 96;

    let rafId = 0;
    let frameCounter = 0;

    const drawSideMotorcycle = (
      x: number,
      groundY: number,
      jumpY: number,
      ducking: boolean,
      wheelAngle: number,
      palette: { primary: string; secondary: string; styleTag: 'urban' | 'adventure' | 'piston' }
    ) => {
      const y = groundY - jumpY;
      const bodyTilt = jumpY > 5 ? -0.14 : ducking ? 0.08 : 0;

      ctx.save();
      ctx.translate(x + 34, y - 22);
      ctx.rotate(bodyTilt);
      ctx.translate(-(x + 34), -(y - 22));

      if (jumpY < 130) {
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        const shadowScale = Math.max(0.4, 1 - jumpY / 160);
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.beginPath();
        ctx.ellipse(
          x + 36,
          GROUND_Y + 4,
          34 * shadowScale,
          5 * shadowScale,
          0,
          0,
          Math.PI * 2
        );
        ctx.fill();
        ctx.restore();
      }

      const drawWheel = (wx: number, wy: number) => {
        ctx.fillStyle = '#09090B';
        ctx.beginPath();
        ctx.arc(wx, wy, 14, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#71717A';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(wx, wy, 9, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = palette.secondary;
        ctx.lineWidth = 1.5;
        for (let i = 0; i < 4; i++) {
          const a = wheelAngle + (i * Math.PI) / 2;
          ctx.beginPath();
          ctx.moveTo(wx + Math.cos(a) * 8, wy + Math.sin(a) * 8);
          ctx.lineTo(wx - Math.cos(a) * 8, wy - Math.sin(a) * 8);
          ctx.stroke();
        }
      };

      drawWheel(x + 14, y - 14);
      drawWheel(x + 60, y - 14);

      ctx.strokeStyle = '#A1A1AA';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x + 14, y - 14);
      ctx.lineTo(x + 34, y - 22);
      ctx.stroke();

      ctx.fillStyle = '#52525B';
      ctx.fillRect(x + 4, y - 20, 24, 5);

      ctx.fillStyle = '#3F3F46';
      ctx.fillRect(x + 28, y - 28, 17, 14);

      ctx.strokeStyle = palette.styleTag === 'urban' ? '#F59E0B' : '#D4D4D8';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(x + 60, y - 14);
      ctx.lineTo(x + 49, y - 42);
      ctx.stroke();

      ctx.fillStyle = palette.primary;
      ctx.beginPath();
      ctx.moveTo(x + 14, y - 30);
      ctx.lineTo(x + 34, y - 34);
      ctx.lineTo(x + 52, y - 40);
      ctx.lineTo(x + 58, y - 28);
      ctx.lineTo(x + 30, y - 25);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#FDE68A';
      ctx.beginPath();
      ctx.arc(x + 57, y - 36, 3.5, 0, Math.PI * 2);
      ctx.fill();

      const riderDrop = ducking ? 12 : 0;
      ctx.strokeStyle = '#F4F4F5';
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x + 25, y - 33);
      ctx.lineTo(x + (ducking ? 38 : 31), y - 50 + riderDrop);
      ctx.stroke();

      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(x + (ducking ? 42 : 34), y - 57 + riderDrop, 7.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = palette.primary;
      ctx.fillRect(x + (ducking ? 43 : 35), y - 59 + riderDrop, 7, 3.5);

      ctx.strokeStyle = '#D4D4D8';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x + (ducking ? 38 : 32), y - 48 + riderDrop);
      ctx.lineTo(x + 48, y - 40);
      ctx.stroke();

      ctx.restore();
    };

    const drawTopDownBike = (
      cx: number,
      cy: number,
      palette: { primary: string; secondary: string },
      invuln: number
    ) => {
      if (invuln > 0 && Math.floor(invuln / 4) % 2 === 0) return;

      ctx.save();
      ctx.translate(cx, cy);

      // Headlight cone ahead
      const beam = ctx.createLinearGradient(0, -18, 0, -90);
      beam.addColorStop(0, 'rgba(253, 224, 71, 0.32)');
      beam.addColorStop(1, 'rgba(253, 224, 71, 0)');
      ctx.fillStyle = beam;
      ctx.beginPath();
      ctx.moveTo(-6, -22);
      ctx.lineTo(-30, -92);
      ctx.lineTo(30, -92);
      ctx.lineTo(6, -22);
      ctx.closePath();
      ctx.fill();

      // Rear & front tires
      ctx.fillStyle = '#09090B';
      ctx.fillRect(-5, 10, 10, 16);
      ctx.fillRect(-4, -26, 8, 15);

      // Handlebars
      ctx.strokeStyle = '#E4E4E7';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(-18, -14);
      ctx.lineTo(18, -14);
      ctx.stroke();

      // Chassis / Fuel tank fairing
      ctx.fillStyle = palette.primary;
      ctx.beginPath();
      ctx.moveTo(-10, -16);
      ctx.lineTo(10, -16);
      ctx.lineTo(13, 4);
      ctx.lineTo(7, 18);
      ctx.lineTo(-7, 18);
      ctx.lineTo(-13, 4);
      ctx.closePath();
      ctx.fill();

      // Racing stripe
      ctx.fillStyle = palette.secondary;
      ctx.fillRect(-2, -16, 4, 30);

      // Rider shoulders & helmet
      ctx.fillStyle = '#27272A';
      ctx.beginPath();
      ctx.ellipse(0, 3, 12, 6, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(0, -1, 7.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = palette.primary;
      ctx.fillRect(-4, -6, 8, 3);

      ctx.restore();
    };

    const tick = () => {
      frameCounter++;
      const s = stateRef.current;

      if (s.arcadeMode === 'runner') {
        // --- MODE 1: SIDE-SCROLLING MOTO RUNNER ---
        ctx.fillStyle = '#111318';
        ctx.fillRect(0, 0, W, H);

        ctx.strokeStyle = 'rgba(255,255,255,0.04)';
        ctx.lineWidth = 1;
        for (let gx = 0; gx < W; gx += 60) {
          ctx.beginPath();
          ctx.moveTo(gx, 0);
          ctx.lineTo(gx, GROUND_Y);
          ctx.stroke();
        }

        ctx.fillStyle = '#1C1F26';
        ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y);
        ctx.strokeStyle = s.palette.primary;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, GROUND_Y);
        ctx.lineTo(W, GROUND_Y);
        ctx.stroke();

        ctx.fillStyle = 'rgba(255,255,255,0.22)';
        for (let dx = -s.roadOffset; dx < W; dx += 64) {
          ctx.fillRect(dx, GROUND_Y + 26, 32, 3);
        }

        if (s.status === 'PLAYING') {
          s.roadOffset = (s.roadOffset + s.speed) % 64;
          s.wheelAngle += s.speed * 0.08;
          s.distanceScore += s.speed * 0.085;
          s.speed = Math.min(13.5, 6.4 + s.distanceScore * 0.0022);

          if (s.isJumping || s.playerY > 0) {
            s.playerY += s.playerVy;
            s.playerVy -= 0.72;
            if (s.playerY <= 0) {
              s.playerY = 0;
              s.playerVy = 0;
              s.isJumping = false;
            }
          }

          if (frameCounter % 3 === 0) {
            s.particles.push({
              x: PLAYER_X + 2,
              y: GROUND_Y - s.playerY - 18,
              vx: -s.speed * 0.5,
              vy: -0.4 - Math.random() * 0.7,
              life: 16,
            });
          }
          s.particles = s.particles.filter((p) => {
            p.x += p.vx;
            p.y += p.vy;
            p.life -= 1;
            return p.life > 0;
          });

          s.spawnTimer -= 1;
          if (s.spawnTimer <= 0) {
            const roll = Math.random();
            if (roll < 0.42) {
              s.runnerObstacles.push({
                x: W + 20,
                y: GROUND_Y - 34,
                w: 24,
                h: 34,
                kind: 'cone',
              });
            } else if (roll < 0.76) {
              s.runnerObstacles.push({
                x: W + 20,
                y: GROUND_Y - 40,
                w: 42,
                h: 40,
                kind: 'crate',
              });
            } else {
              s.runnerObstacles.push({
                x: W + 20,
                y: GROUND_Y - 86,
                w: 62,
                h: 42,
                kind: 'sign',
              });
            }
            const minGap = Math.max(46, 88 - s.speed * 3);
            s.spawnTimer = minGap + Math.random() * 44;
          }

          s.pickupTimer -= 1;
          if (s.pickupTimer <= 0) {
            s.runnerPickups.push({
              x: W + 30,
              y: GROUND_Y - (Math.random() > 0.5 ? 88 : 34),
              r: 11,
              kind: Math.random() > 0.75 ? 'stamp' : 'oil',
              collected: false,
            });
            s.pickupTimer = 95 + Math.random() * 90;
          }

          s.runnerPickups = s.runnerPickups.filter((pk) => {
            pk.x -= s.speed;
            if (!pk.collected) {
              const px = PLAYER_X + 36;
              const py = GROUND_Y - s.playerY - (s.isDucking ? 20 : 30);
              const dist = Math.hypot(pk.x - px, pk.y - py);
              if (dist < pk.r + 24) {
                pk.collected = true;
                s.bonusScore += pk.kind === 'stamp' ? 50 : 25;
                playCollectSound(s.muted);
              }
            }
            return pk.x > -30 && !pk.collected;
          });

          const hitboxX = PLAYER_X + 14;
          const hitboxW = 46;
          const hitboxH = s.isDucking ? 34 : 54;
          const hitboxY = GROUND_Y - s.playerY - hitboxH;

          let collided = false;
          s.runnerObstacles = s.runnerObstacles.filter((ob) => {
            ob.x -= s.speed;
            const margin = 6;
            if (
              hitboxX + margin < ob.x + ob.w - margin &&
              hitboxX + hitboxW - margin > ob.x + margin &&
              hitboxY + margin < ob.y + ob.h - margin &&
              hitboxY + hitboxH - margin > ob.y + margin
            ) {
              collided = true;
            }
            return ob.x + ob.w > -40;
          });

          const totalScore = Math.floor(s.distanceScore + s.bonusScore);
          if (frameCounter % 4 === 0) {
            setHudScore(totalScore);
            setHudSpeed(Math.round(s.speed * 7.8));
          }

          if (collided) {
            finalizeGameOver(totalScore);
          }
        }

        for (const p of s.particles) {
          ctx.fillStyle = `rgba(161, 161, 170, ${p.life / 28})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
          ctx.fill();
        }

        for (const pk of s.runnerPickups) {
          ctx.save();
          ctx.fillStyle = pk.kind === 'stamp' ? '#10B981' : '#F59E0B';
          ctx.beginPath();
          ctx.arc(pk.x, pk.y, pk.r, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#111318';
          ctx.font = 'bold 10px JetBrains Mono, monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(pk.kind === 'stamp' ? 'C+' : '4T', pk.x, pk.y + 0.5);
          ctx.restore();
        }

        for (const ob of s.runnerObstacles) {
          if (ob.kind === 'cone') {
            ctx.fillStyle = '#EA580C';
            ctx.beginPath();
            ctx.moveTo(ob.x + ob.w / 2, ob.y);
            ctx.lineTo(ob.x + ob.w, ob.y + ob.h);
            ctx.lineTo(ob.x, ob.y + ob.h);
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(ob.x + 6, ob.y + 15, ob.w - 12, 5);
          } else if (ob.kind === 'crate') {
            ctx.fillStyle = '#92400E';
            ctx.fillRect(ob.x, ob.y, ob.w, ob.h);
            ctx.strokeStyle = '#F59E0B';
            ctx.lineWidth = 2;
            ctx.strokeRect(ob.x, ob.y, ob.w, ob.h);
            ctx.fillStyle = '#FDE68A';
            ctx.font = 'bold 9px JetBrains Mono, monospace';
            ctx.textAlign = 'center';
            ctx.fillText('CAJA', ob.x + ob.w / 2, ob.y + 23);
          } else {
            ctx.fillStyle = '#27272A';
            ctx.fillRect(ob.x, ob.y, ob.w, ob.h);
            ctx.strokeStyle = '#DC2626';
            ctx.lineWidth = 2;
            ctx.strokeRect(ob.x, ob.y, ob.w, ob.h);
            ctx.fillStyle = '#F4F4F5';
            ctx.font = 'bold 10px JetBrains Mono, monospace';
            ctx.textAlign = 'center';
            ctx.fillText('AGACHA', ob.x + ob.w / 2, ob.y + 25);
          }
        }

        drawSideMotorcycle(
          PLAYER_X,
          GROUND_Y,
          s.playerY,
          s.isDucking,
          s.wheelAngle,
          s.palette
        );
      } else {
        // --- MODE 2: RUTA VENTO (3-LANE TOP-DOWN HIGHWAY + CHECKPOINTS) ---
        const roadW = 390;
        const roadLeft = (W - roadW) / 2;
        const laneW = roadW / 3;
        const bikeY = H - 54;

        // Highway shoulders
        ctx.fillStyle = '#0B0D12';
        ctx.fillRect(0, 0, W, H);

        // Asphalt surface
        ctx.fillStyle = '#1C1F26';
        ctx.fillRect(roadLeft, 0, roadW, H);

        // Shoulder curbing lines
        ctx.fillStyle = s.palette.primary;
        ctx.fillRect(roadLeft - 6, 0, 6, H);
        ctx.fillRect(roadLeft + roadW, 0, 6, H);

        // Scrolling lane dividers
        ctx.fillStyle = 'rgba(244, 244, 245, 0.35)';
        for (let l = 1; l <= 2; l++) {
          const lx = roadLeft + laneW * l - 2;
          for (let dy = -60 + (s.roadOffset % 60); dy < H; dy += 60) {
            ctx.fillRect(lx, dy, 4, 30);
          }
        }

        if (s.status === 'PLAYING') {
          s.roadOffset = (s.roadOffset + s.rutaSpeed * 1.4) % 60;
          s.visualLaneX += (s.lane - s.visualLaneX) * 0.25;
          if (s.invulnFrames > 0) s.invulnFrames -= 1;

          s.rutaDistanceM += s.rutaSpeed * 0.35;
          s.distanceScore += s.rutaSpeed * 0.12;
          s.rutaSpeed = Math.min(9.5, 4.9 + s.rutaDistanceM * 0.0012);

          // Spawn obstacles or pickups
          s.rutaSpawnTimer -= 1;
          if (s.rutaSpawnTimer <= 0) {
            const lane = Math.floor(Math.random() * 3);
            const isPickup = Math.random() < 0.36;
            if (isPickup) {
              const roll = Math.random();
              const kind =
                roll < 0.45 ? 'helmet' : roll < 0.8 ? 'wrench' : 'turbo';
              const pts = kind === 'helmet' ? 50 : kind === 'wrench' ? 75 : 100;
              s.rutaEntities.push({
                lane,
                y: -30,
                kind,
                isPickup: true,
                pts,
              });
            } else {
              const roll = Math.random();
              const kind =
                roll < 0.4 ? 'barrier' : roll < 0.75 ? 'car' : 'barrel';
              s.rutaEntities.push({
                lane,
                y: -45,
                kind,
                isPickup: false,
                pts: 0,
              });
            }
            s.rutaSpawnTimer = Math.max(18, 36 - s.rutaSpeed * 1.8) + Math.random() * 14;
          }

          const bikeLaneCenterX = roadLeft + (s.visualLaneX + 0.5) * laneW;
          let hitObstacle = false;

          s.rutaEntities = s.rutaEntities.filter((ent) => {
            ent.y += s.rutaSpeed;
            const ex = roadLeft + (ent.lane + 0.5) * laneW;
            const dx = Math.abs(ex - bikeLaneCenterX);
            const dy = Math.abs(ent.y - bikeY);

            if (dx < 28 && dy < 28) {
              if (ent.isPickup) {
                s.bonusScore += ent.pts * s.combo;
                playCollectSound(s.muted);
                return false;
              } else if (s.invulnFrames <= 0) {
                hitObstacle = true;
                return false;
              }
            }
            return ent.y < H + 50;
          });

          if (hitObstacle) {
            s.lives = Math.max(0, s.lives - 1);
            s.combo = 1;
            s.invulnFrames = 65;
            setHudLives(s.lives);
            setHudCombo(1);
            playWrongSound(s.muted);
            if (s.lives <= 0) {
              const total = Math.floor(s.distanceScore + s.bonusScore);
              finalizeGameOver(total);
            }
          }

          const totalScore = Math.floor(s.distanceScore + s.bonusScore);
          if (frameCounter % 4 === 0) {
            setHudScore(totalScore);
            setHudSpeed(Math.round(s.rutaSpeed * 13));
            setHudDistance(Math.floor(s.rutaDistanceM));
          }

          // Trigger Catalog Checkpoint every 500m
          if (
            s.status === 'PLAYING' &&
            s.rutaDistanceM >= s.nextCheckpointM &&
            activeUnits.length > 0
          ) {
            s.nextCheckpointM += 500;
            const q = buildCheckpointQuestion(
              checkpointPoolRef.current,
              activeUnits
            );
            if (q) {
              s.status = 'CHECKPOINT';
              setCheckpointQ(q);
              setCheckpointFeedback('');
              setGameState('CHECKPOINT');
            }
          }
        }

        // Draw entities on 3-lane highway
        for (const ent of s.rutaEntities) {
          const ex = roadLeft + (ent.lane + 0.5) * laneW;
          ctx.save();
          ctx.translate(ex, ent.y);

          if (ent.kind === 'barrier') {
            ctx.fillStyle = '#EA580C';
            ctx.fillRect(-28, -10, 56, 20);
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(-20, -4, 14, 8);
            ctx.fillRect(6, -4, 14, 8);
          } else if (ent.kind === 'car') {
            ctx.fillStyle = '#52525B';
            ctx.beginPath();
            ctx.roundRect(-22, -30, 44, 60, 6);
            ctx.fill();
            ctx.fillStyle = '#18181B';
            ctx.fillRect(-16, -14, 32, 16);
            ctx.fillStyle = '#EF4444';
            ctx.fillRect(-18, 25, 10, 4);
            ctx.fillRect(8, 25, 10, 4);
          } else if (ent.kind === 'barrel') {
            ctx.fillStyle = '#DC2626';
            ctx.beginPath();
            ctx.arc(0, 0, 16, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#FACC15';
            ctx.lineWidth = 3;
            ctx.stroke();
          } else if (ent.kind === 'helmet') {
            ctx.fillStyle = '#FACC15';
            ctx.beginPath();
            ctx.arc(0, 0, 14, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#111318';
            ctx.font = 'bold 10px JetBrains Mono, monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('+50', 0, 1);
          } else if (ent.kind === 'wrench') {
            ctx.fillStyle = '#38BDF8';
            ctx.beginPath();
            ctx.arc(0, 0, 14, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#111318';
            ctx.font = 'bold 10px JetBrains Mono, monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('+75', 0, 1);
          } else {
            // turbo
            ctx.fillStyle = '#10B981';
            ctx.beginPath();
            ctx.arc(0, 0, 15, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#111318';
            ctx.font = 'bold 10px JetBrains Mono, monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('TURBO', 0, 1);
          }
          ctx.restore();
        }

        const bikeCenterX = roadLeft + (s.visualLaneX + 0.5) * laneW;
        drawTopDownBike(bikeCenterX, bikeY, s.palette, s.invulnFrames);
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [activeUnits, finalizeGameOver]);

  const handleCanvasPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const s = stateRef.current;
    if (s.arcadeMode === 'runner') {
      triggerJump();
      return;
    }
    if (s.status === 'READY') {
      startRun();
      return;
    }
    touchStartXRef.current = e.clientX;
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = e.clientX - rect.left;
    if (relX < rect.width / 2) {
      moveLane(-1);
    } else {
      moveLane(1);
    }
  };

  const handleExportCsv = () => {
    const header = [
      'Posicion',
      'Asesor',
      'Canal_Sucursal',
      'Aciertos_Quiz',
      'Puntos_Quiz',
      'Record_Arcade',
      'Total_Puntos',
    ];
    const rows = leaderboard.map((row, idx) => [
      String(idx + 1),
      `"${(row.displayName || '').replace(/"/g, '""')}"`,
      `"${(row.branch || 'Sin sucursal').replace(/"/g, '""')}"`,
      String(row.correctAnswers ?? 0),
      String(row.quizPoints ?? 0),
      String(row.gameHighScore ?? 0),
      String(row.totalPoints ?? 0),
    ]);
    const csvContent =
      '\uFEFF' + [header.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ranking-vento-piston-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const visibleLeaderboard =
    rankingLimit === 'top15' ? leaderboard.slice(0, 15) : leaderboard;

  return (
    <div className="space-y-8">
      {/* Arcade Stage */}
      <section className="rounded-xl border border-zinc-200 bg-white p-6">
        <div className="flex flex-col gap-4 border-b border-zinc-100 pb-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight text-zinc-950 sm:text-4xl">
              Pista Arcade · Moto Runner &amp; Ruta VENTO
            </h1>
            <p className="mt-1 text-xs text-zinc-600">
              {arcadeMode === 'runner' ? (
                <>
                  Salta conos y cajas con{' '}
                  <span className="font-mono font-semibold">Espacio / ↑ / Clic</span>,
                  agáchate bajo letreros con{' '}
                  <span className="font-mono font-semibold">↓</span> y recolecta aceite 4T (+25) o sellos CESVE (+50).
                </>
              ) : (
                <>
                  Cambia de carril con{' '}
                  <span className="font-mono font-semibold">← / → / A / D</span> o
                  tocando los lados, esquiva obstáculos y supera Checkpoints de Catálogo cada 500 m (+300 × Combo).
                </>
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Arcade Mode Segmented Toggle */}
            <div className="inline-flex rounded-lg border border-zinc-200 bg-zinc-50 p-1">
              <button
                type="button"
                onClick={() => handleModeSwitch('runner')}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold whitespace-nowrap cursor-pointer ${
                  arcadeMode === 'runner'
                    ? 'bg-zinc-950 text-white'
                    : 'text-zinc-600 hover:text-zinc-950'
                }`}
              >
                Moto Runner (Saltar)
              </button>
              <button
                type="button"
                onClick={() => handleModeSwitch('ruta')}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold whitespace-nowrap cursor-pointer ${
                  arcadeMode === 'ruta'
                    ? 'bg-[#EA580C] text-white'
                    : 'text-zinc-600 hover:text-zinc-950'
                }`}
              >
                Ruta VENTO (3 Carriles)
              </button>
            </div>

            <button
              type="button"
              onClick={() => setMuted((m) => !m)}
              aria-label={muted ? 'Activar sonido' : 'Silenciar'}
              className="rounded-lg border border-zinc-200 p-2 text-zinc-600 hover:bg-zinc-50 cursor-pointer"
            >
              {muted ? (
                <VolumeX className="h-4 w-4" />
              ) : (
                <Volume2 className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        {/* Live Catalog Unit Selector Strip */}
        <div className="mt-4 flex flex-col gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2.5 text-xs">
            <span
              className="h-3 w-3 shrink-0 rounded-sm"
              style={{ backgroundColor: unitPalette.primary }}
            />
            <span className="font-semibold text-zinc-800">
              Unidad en Pista:
            </span>
            {selectedMoto && (
              <span className="font-mono text-zinc-600 tabular-nums">
                {selectedMoto.displacementCc} cc · {selectedMoto.family}
              </span>
            )}
          </div>

          <select
            aria-label="Seleccionar motocicleta del catálogo"
            value={selectedMoto?.id || ''}
            onChange={(e) => setSelectedMotoId(e.target.value)}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-900 focus:border-[#EA580C] focus:outline-none"
          >
            {activeUnits.map((moto) => (
              <option key={moto.id} value={moto.id}>
                {moto.model} ({moto.displacementCc} cc · {moto.family})
              </option>
            ))}
          </select>
        </div>

        {/* Unobtrusive Top HUD */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-4 rounded-t-xl border border-b-0 border-zinc-800 bg-zinc-950 px-5 py-3 text-xs text-zinc-300">
          <div className="flex flex-wrap items-center gap-5 font-mono tabular-nums">
            <span>
              UNIDAD:{' '}
              <strong className="text-white">
                {selectedMoto?.model || 'VENTO Sport'}
              </strong>
            </span>
            <span>
              VELOCIDAD:{' '}
              <strong className="text-[#EA580C]">{hudSpeed} km/h</strong>
            </span>
            {arcadeMode === 'ruta' && (
              <>
                <span>
                  DISTANCIA:{' '}
                  <strong className="text-white">{hudDistance} m</strong>
                </span>
                <span className="inline-flex items-center gap-1">
                  VIDAS:
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Heart
                      key={i}
                      className={`h-3.5 w-3.5 ${
                        i < hudLives
                          ? 'fill-red-500 text-red-500'
                          : 'text-zinc-600'
                      }`}
                    />
                  ))}
                </span>
                <span>
                  COMBO: <strong className="text-emerald-400">{hudCombo}x</strong>
                </span>
              </>
            )}
          </div>
          <div className="flex items-center gap-6 font-mono tabular-nums">
            <span>
              RÉCORD:{' '}
              <strong className="text-white">
                {personalBest.toLocaleString('es-MX')}
              </strong>
            </span>
            <span>
              PUNTOS:{' '}
              <strong className="text-[#FBBF24]">
                {hudScore.toLocaleString('es-MX')}
              </strong>
            </span>
          </div>
        </div>

        {/* Canvas Playfield */}
        <div className="relative overflow-hidden rounded-b-xl border border-zinc-800 bg-[#111318]">
          <canvas
            ref={canvasRef}
            width={860}
            height={300}
            onPointerDown={handleCanvasPointerDown}
            className="block w-full h-auto cursor-pointer select-none touch-manipulation"
          />

          {gameState === 'READY' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950/60 p-4 text-center">
              <p className="font-display text-3xl font-bold text-white">
                {arcadeMode === 'runner'
                  ? '¿Listo para rodar en Pista?'
                  : 'Ruta VENTO · Autopista de 3 Carriles'}
              </p>
              <p className="mt-1 text-xs text-zinc-300">
                {arcadeMode === 'runner'
                  ? 'Presiona Espacio, ↑ o haz clic para arrancar'
                  : 'Esquiva obstáculos con ← / → y responde Checkpoints del catálogo'}
              </p>
              <button
                type="button"
                onClick={startRun}
                className="mt-4 rounded-lg bg-[#EA580C] px-6 py-2.5 text-xs font-semibold text-white hover:bg-[#C2410C] cursor-pointer"
              >
                Iniciar Carrera
              </button>
            </div>
          )}

          {gameState === 'CHECKPOINT' && checkpointQ && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950/90 p-4 text-center backdrop-blur-xs">
              <div className="w-full max-w-lg rounded-xl border border-zinc-700 bg-zinc-900 p-5 text-left">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-[#FB923C]">
                  <span className="inline-flex items-center gap-1.5">
                    <ShieldCheck className="h-4 w-4" />
                    CHECKPOINT · +300 × COMBO
                  </span>
                  {checkpointQ.sourceSection && (
                    <span className="font-mono text-[11px] text-zinc-400">
                      {checkpointQ.sourceSection}
                    </span>
                  )}
                </div>
                <p className="mt-2 font-display text-xl font-bold text-white leading-snug">
                  {checkpointQ.question}
                </p>

                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {checkpointQ.options.map((opt, idx) => (
                    <button
                      key={idx}
                      type="button"
                      disabled={Boolean(checkpointFeedback)}
                      onClick={() => handleAnswerCheckpoint(idx)}
                      className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-left text-xs font-semibold text-white hover:border-[#EA580C] hover:bg-zinc-700 disabled:opacity-60 cursor-pointer"
                    >
                      {opt}
                    </button>
                  ))}
                </div>

                {checkpointFeedback && (
                  <p className="mt-3 font-mono text-xs font-semibold text-[#FBBF24]">
                    {checkpointFeedback}
                  </p>
                )}
              </div>
            </div>
          )}

          {gameState === 'GAME_OVER' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950/78 p-4 text-center backdrop-blur-[2px]">
              <p className="font-display text-3xl font-bold text-white">
                Fin de la Ruta · {hudScore.toLocaleString('es-MX')} pts
              </p>
              {newRecordBanner && (
                <p className="mt-1 text-xs font-semibold text-[#FBBF24]">
                  ¡Nuevo récord personal registrado!
                </p>
              )}
              {!user && (
                <p className="mt-1 text-xs text-zinc-300">
                  Inicia sesión en &quot;Unirme al Ranking&quot; para guardar tu récord en la tabla oficial.
                </p>
              )}
              <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={startRun}
                  className="rounded-lg bg-[#EA580C] px-5 py-2 text-xs font-semibold text-white hover:bg-[#C2410C] cursor-pointer"
                >
                  Jugar de Nuevo
                </button>
                {!user && (
                  <button
                    type="button"
                    onClick={onOpenProfileModal}
                    className="rounded-lg border border-zinc-600 bg-zinc-900 px-4 py-2 text-xs font-semibold text-white hover:bg-zinc-800 cursor-pointer"
                  >
                    Guardar en Ranking
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Dedicated Touch Controls for mobile/tablet */}
        {arcadeMode === 'runner' ? (
          <div className="mt-3 flex items-center justify-center gap-3 sm:hidden">
            <button
              type="button"
              onTouchStart={(e) => {
                e.preventDefault();
                setDuck(true);
              }}
              onTouchEnd={() => setDuck(false)}
              onMouseDown={() => setDuck(true)}
              onMouseUp={() => setDuck(false)}
              className="flex-1 rounded-lg border border-zinc-300 bg-zinc-50 py-3 text-xs font-semibold text-zinc-900 active:bg-zinc-200"
            >
              Agachar (↓)
            </button>
            <button
              type="button"
              onClick={triggerJump}
              className="flex-1 rounded-lg bg-[#EA580C] py-3 text-xs font-semibold text-white active:bg-[#C2410C]"
            >
              Saltar (↑)
            </button>
          </div>
        ) : (
          <div className="mt-3 flex items-center justify-center gap-3 sm:hidden">
            <button
              type="button"
              onClick={() => moveLane(-1)}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-zinc-300 bg-zinc-50 py-3 text-xs font-semibold text-zinc-900 active:bg-zinc-200"
            >
              <ArrowLeft className="h-4 w-4" />
              Carril Izquierdo
            </button>
            <button
              type="button"
              onClick={() => moveLane(1)}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#EA580C] py-3 text-xs font-semibold text-white active:bg-[#C2410C]"
            >
              Carril Derecho
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </section>

      {/* Full Live Ranking Table with Filter & CSV Export */}
      <section className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
        <div className="flex flex-col gap-3 border-b border-zinc-200 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-display text-2xl font-bold text-zinc-950">
              Tabla General de Asesores (Ranking en Vivo)
            </h2>
            <p className="mt-0.5 text-xs text-zinc-500">
              Clasificación combinada: Puntos de Capacitación Técnica + Récord Arcade.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {leaderboard.length > 0 && (
              <>
                <div className="inline-flex rounded-lg border border-zinc-200 bg-zinc-50 p-1">
                  <button
                    type="button"
                    onClick={() => setRankingLimit('top15')}
                    className={`rounded-md px-2.5 py-1 text-xs font-semibold whitespace-nowrap cursor-pointer ${
                      rankingLimit === 'top15'
                        ? 'bg-zinc-950 text-white'
                        : 'text-zinc-600 hover:text-zinc-950'
                    }`}
                  >
                    Top 15
                  </button>
                  <button
                    type="button"
                    onClick={() => setRankingLimit('all')}
                    className={`rounded-md px-2.5 py-1 text-xs font-semibold whitespace-nowrap cursor-pointer ${
                      rankingLimit === 'all'
                        ? 'bg-zinc-950 text-white'
                        : 'text-zinc-600 hover:text-zinc-950'
                    }`}
                  >
                    Todos ({leaderboard.length})
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleExportCsv}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 cursor-pointer whitespace-nowrap"
                >
                  <Download className="h-3.5 w-3.5" />
                  Exportar CSV
                </button>
              </>
            )}

            {!user && (
              <button
                type="button"
                onClick={onOpenProfileModal}
                className="rounded-lg bg-[#EA580C] px-4 py-2 text-xs font-semibold text-white hover:bg-[#C2410C] whitespace-nowrap cursor-pointer"
              >
                Registrar mi Nombre
              </button>
            )}
          </div>
        </div>

        {leaderboard.length === 0 ? (
          <div className="p-10 text-center text-xs text-zinc-500">
            Todavía no hay asesores en el ranking. Registra tu nombre para inaugurar la tabla.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50 text-zinc-500">
                  <th className="py-3 pl-6 pr-3 font-semibold">#</th>
                  <th className="py-3 px-3 font-semibold">Asesor</th>
                  <th className="py-3 px-3 font-semibold">Canal / CESVE</th>
                  <th className="py-3 px-3 font-semibold text-right">
                    Aciertos Quiz
                  </th>
                  <th className="py-3 px-3 font-semibold text-right">
                    Pts. Quiz
                  </th>
                  <th className="py-3 px-3 font-semibold text-right">
                    Récord Arcade
                  </th>
                  <th className="py-3 pl-3 pr-6 font-semibold text-right">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {visibleLeaderboard.map((row, idx) => {
                  const isMe = advisorProfile?.uid === row.uid;
                  return (
                    <tr
                      key={row.uid}
                      className={
                        isMe
                          ? 'bg-[#EA580C]/8 font-semibold'
                          : 'hover:bg-zinc-50'
                      }
                    >
                      <td className="py-3 pl-6 pr-3 font-mono font-bold text-[#EA580C] tabular-nums">
                        {idx + 1}
                      </td>
                      <td className="py-3 px-3 text-zinc-950">
                        {row.displayName}
                        {isMe ? ' (Tú)' : ''}
                      </td>
                      <td className="py-3 px-3 text-zinc-600">
                        {row.branch || 'Sin sucursal'}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-zinc-700 tabular-nums">
                        {row.correctAnswers}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-zinc-700 tabular-nums">
                        {row.quizPoints.toLocaleString('es-MX')}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-zinc-700 tabular-nums">
                        {row.gameHighScore.toLocaleString('es-MX')}
                      </td>
                      <td className="py-3 pl-3 pr-6 text-right font-mono font-bold text-zinc-950 tabular-nums">
                        {row.totalPoints.toLocaleString('es-MX')}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
