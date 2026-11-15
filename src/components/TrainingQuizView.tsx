import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import { motion } from 'motion/react';
import {
  CheckCircle2,
  Clock,
  Flame,
  RotateCcw,
  Trophy,
  Volume2,
  VolumeX,
  XCircle,
} from 'lucide-react';
import { generateDynamicQuestions } from '../data/seedData';
import type {
  AdminQuizItem,
  AdvisorProfile,
  Motorcycle,
  QuizQuestion,
  QuizTopic,
  TimeGuideEntry,
} from '../types';
import { playRevClimbSound, playSkidCrashSound } from '../utils/soundFx';
import QuizRaceTrack, {
  type QuizBikeStyle,
  type RaceTrackState,
} from './QuizRaceTrack';

interface TrainingQuizViewProps {
  motorcycles: Motorcycle[];
  timeGuides: TimeGuideEntry[];
  adminQuizItems: AdminQuizItem[];
  user: User | null;
  advisorProfile: AdvisorProfile | null;
  leaderboard: AdvisorProfile[];
  onOpenProfileModal: () => void;
  onCompleteQuiz: (result: {
    topic: QuizTopic;
    score: number;
    correctCount: number;
    totalQuestions: number;
    maxStreak: number;
  }) => Promise<void>;
}

type TrainingMode = 'ASCENSO' | 'CONTRARRELOJ';

const TOPICS: { id: QuizTopic; label: string; description: string }[] = [
  {
    id: 'Mixto',
    label: 'Entrenamiento Mixto',
    description:
      'Combina familias, especificaciones técnicas, pólizas y guía de tiempos.',
  },
  {
    id: 'Especificaciones',
    label: 'Especificaciones Técnicas',
    description:
      'Transmisión, motor, cilindrada y enfriamiento de unidades vigentes.',
  },
  {
    id: 'Familias',
    label: 'Familias VENTO',
    description:
      'Clasificación oficial de las 8 familias y sus límites de asentamiento.',
  },
  {
    id: 'Garantías',
    label: 'Pólizas de Garantía',
    description:
      'Vento 2025 (36m / 33,000 km) y American Pistón (3a / 30,000 km).',
  },
  {
    id: 'Guía de Tiempos',
    label: 'Guía de Tiempos VC / VM',
    description:
      'Plazos exactos por componente, accesorios y regla de 48 horas.',
  },
];

const LAP_STEPS = 10;
const SPRINT_DURATION_SEC = 60;

function shuffleArray<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function getBikeVisuals(moto?: Motorcycle): {
  style: QuizBikeStyle;
  color: string;
} {
  if (!moto) return { style: 'sport', color: '#EA580C' };
  if (moto.brand === 'AMERICAN PISTON') {
    return { style: 'piston', color: '#DC2626' };
  }
  const fam = moto.family;
  if (fam === 'Doble Propósito' || fam === 'Adventure' || fam === 'Cuatrimotos') {
    return { style: 'dual', color: '#D97706' };
  }
  if (fam === 'Rebeldes') {
    return { style: 'sport', color: '#7C3AED' };
  }
  if (fam === 'Trabajo') {
    return { style: 'sport', color: '#16A34A' };
  }
  if (fam === 'Motonetas' || fam === 'Ciudad') {
    return { style: 'sport', color: '#0284C7' };
  }
  return { style: 'sport', color: '#EA580C' };
}

export default function TrainingQuizView({
  motorcycles,
  timeGuides,
  adminQuizItems,
  user,
  advisorProfile,
  leaderboard,
  onOpenProfileModal,
  onCompleteQuiz,
}: TrainingQuizViewProps) {
  const activeUnits = useMemo(() => {
    const active = motorcycles.filter((m) => m.isActive);
    return active.length > 0 ? active : motorcycles;
  }, [motorcycles]);

  const [selectedTopic, setSelectedTopic] = useState<QuizTopic>('Mixto');
  const [trainingMode, setTrainingMode] = useState<TrainingMode>('ASCENSO');
  const [questionCount, setQuestionCount] = useState<5 | 10>(5);
  const [unitFamilyFilter, setUnitFamilyFilter] = useState<string>('Todas');
  const [selectedMotoId, setSelectedMotoId] = useState<string>(
    'vento-tornado-300'
  );

  const selectedMoto = useMemo(
    () =>
      activeUnits.find((m) => m.id === selectedMotoId) || activeUnits[0],
    [activeUnits, selectedMotoId]
  );

  const bikeVisuals = useMemo(
    () => getBikeVisuals(selectedMoto),
    [selectedMoto]
  );

  const unitFamilies = useMemo(() => {
    const set = new Set<string>(['Todas']);
    for (const m of activeUnits) {
      set.add(m.brand === 'AMERICAN PISTON' ? 'American Pistón' : m.family);
    }
    return Array.from(set);
  }, [activeUnits]);

  const filteredUnits = useMemo(() => {
    if (unitFamilyFilter === 'Todas') return activeUnits;
    if (unitFamilyFilter === 'American Pistón') {
      return activeUnits.filter((m) => m.brand === 'AMERICAN PISTON');
    }
    return activeUnits.filter(
      (m) => m.brand === 'VENTO' && m.family === unitFamilyFilter
    );
  }, [activeUnits, unitFamilyFilter]);

  const [phase, setPhase] = useState<'MENU' | 'PLAYING' | 'SUMMARY'>('MENU');
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [streak, setStreak] = useState(0);
  const [maxStreak, setMaxStreak] = useState(0);
  const [timeLeft, setTimeLeft] = useState(SPRINT_DURATION_SEC);
  const [trackStep, setTrackStep] = useState(0);
  const [lapNumber, setLapNumber] = useState(1);
  const [trackState, setTrackState] = useState<RaceTrackState>('IDLE');
  const [lastEarned, setLastEarned] = useState(0);
  const [eventNonce, setEventNonce] = useState(0);
  const [muted, setMuted] = useState(false);
  const [savingResult, setSavingResult] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  const autoAdvanceRef = useRef<number | null>(null);
  const finishedRef = useRef(false);
  const latestScoreRef = useRef({
    score: 0,
    correctCount: 0,
    answeredCount: 0,
    maxStreak: 0,
    questionsLen: 1,
    trackStep: 0,
  });

  latestScoreRef.current = {
    score,
    correctCount,
    answeredCount,
    maxStreak,
    questionsLen: questions.length || 1,
    trackStep,
  };

  const allQuestions = useMemo(
    () => generateDynamicQuestions(motorcycles, timeGuides, adminQuizItems),
    [motorcycles, timeGuides, adminQuizItems]
  );

  const clearAutoAdvance = useCallback(() => {
    if (autoAdvanceRef.current !== null) {
      window.clearTimeout(autoAdvanceRef.current);
      autoAdvanceRef.current = null;
    }
  }, []);

  useEffect(() => () => clearAutoAdvance(), [clearAutoAdvance]);

  const finishQuiz = useCallback(
    async (
      finalScoreInput?: number,
      finalCorrectInput?: number,
      finalAnsweredInput?: number,
      finalMaxStreakInput?: number
    ) => {
      if (finishedRef.current) return;
      finishedRef.current = true;
      clearAutoAdvance();

      const snap = latestScoreRef.current;
      const finalScore = Math.min(50000, finalScoreInput ?? snap.score);
      const finalCorrect = finalCorrectInput ?? snap.correctCount;
      const finalAnswered = finalAnsweredInput ?? snap.answeredCount;
      const finalMaxStreak = finalMaxStreakInput ?? snap.maxStreak;

      const totalQuestionsForCloud =
        trainingMode === 'CONTRARRELOJ'
          ? Math.max(1, Math.min(100, finalAnswered))
          : Math.max(1, Math.min(100, snap.questionsLen));

      setPhase('SUMMARY');
      if (
        trainingMode === 'ASCENSO' &&
        snap.trackStep >= snap.questionsLen * 0.8
      ) {
        setTrackState('VICTORY');
      } else {
        setTrackState('IDLE');
      }

      if (user) {
        setSavingResult(true);
        try {
          await onCompleteQuiz({
            topic: selectedTopic,
            score: finalScore,
            correctCount: finalCorrect,
            totalQuestions: totalQuestionsForCloud,
            maxStreak: finalMaxStreak,
          });
          setSaveMessage('Puntos sumados a tu perfil en el Ranking.');
        } catch {
          setSaveMessage('No se pudieron guardar los puntos en la nube.');
        } finally {
          setSavingResult(false);
        }
      }
    },
    [clearAutoAdvance, onCompleteQuiz, selectedTopic, trainingMode, user]
  );

  // Countdown timer during CONTRARRELOJ mode
  useEffect(() => {
    if (phase !== 'PLAYING' || trainingMode !== 'CONTRARRELOJ') return;
    const intervalId = window.setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          window.clearInterval(intervalId);
          finishQuiz();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(intervalId);
  }, [phase, trainingMode, finishQuiz]);

  const startQuiz = () => {
    clearAutoAdvance();
    finishedRef.current = false;

    const pool =
      selectedTopic === 'Mixto'
        ? allQuestions
        : allQuestions.filter((q) => q.topic === selectedTopic);

    const shuffled = shuffleArray(pool);
    const chosen =
      trainingMode === 'CONTRARRELOJ'
        ? shuffled
        : shuffled.slice(0, Math.min(questionCount, shuffled.length));

    setQuestions(chosen);
    setCurrentIndex(0);
    setSelectedOption(null);
    setScore(0);
    setCorrectCount(0);
    setAnsweredCount(0);
    setStreak(0);
    setMaxStreak(0);
    setTimeLeft(SPRINT_DURATION_SEC);
    setTrackStep(0);
    setLapNumber(1);
    setTrackState('IDLE');
    setLastEarned(0);
    setEventNonce((n) => n + 1);
    setSaveMessage('');
    setPhase('PLAYING');
  };

  const advanceQuestion = useCallback(
    (
      nextScore?: number,
      nextCorrect?: number,
      nextAnswered?: number,
      nextMaxStreak?: number
    ) => {
      if (finishedRef.current) return;
      if (currentIndex + 1 < questions.length) {
        if (trainingMode === 'CONTRARRELOJ' && trackStep >= LAP_STEPS) {
          setTrackStep(0);
          setLapNumber((l) => l + 1);
        }
        setCurrentIndex((prev) => prev + 1);
        setSelectedOption(null);
        setTrackState('IDLE');
        return;
      }
      finishQuiz(nextScore, nextCorrect, nextAnswered, nextMaxStreak);
    },
    [currentIndex, finishQuiz, questions.length, trackStep, trainingMode]
  );

  const handleSelectOption = useCallback(
    (optionIdx: number) => {
      if (selectedOption !== null || finishedRef.current) return;
      const currentQ = questions[currentIndex];
      if (!currentQ) return;
      setSelectedOption(optionIdx);

      const nextAnswered = answeredCount + 1;
      setAnsweredCount(nextAnswered);

      const targetTotalSteps =
        trainingMode === 'CONTRARRELOJ' ? LAP_STEPS : questions.length;

      let nextScoreVal = score;
      let nextCorrectVal = correctCount;
      let nextMaxStreakVal = maxStreak;

      if (optionIdx === currentQ.correctIndex) {
        const nextStreak = streak + 1;
        const comboMultiplier = Math.min(5, nextStreak);
        const earned =
          trainingMode === 'CONTRARRELOJ'
            ? 100 * comboMultiplier
            : 100 + Math.min((nextStreak - 1) * 20, 100);

        nextScoreVal = Math.min(50000, score + earned);
        nextCorrectVal = correctCount + 1;
        nextMaxStreakVal = Math.max(maxStreak, nextStreak);

        const nextStep = Math.min(targetTotalSteps, trackStep + 1);

        setScore(nextScoreVal);
        setCorrectCount(nextCorrectVal);
        setStreak(nextStreak);
        setMaxStreak(nextMaxStreakVal);
        setLastEarned(earned);
        setTrackStep(nextStep);
        setTrackState(
          nextStep >= targetTotalSteps ? 'VICTORY' : 'CLIMBING'
        );
        setEventNonce((n) => n + 1);
        playRevClimbSound(muted);
      } else {
        const droppedStep = Math.max(0, trackStep - 0.5);
        setStreak(0);
        setLastEarned(0);
        setTrackStep(droppedStep);
        setTrackState('CRASHED');
        setEventNonce((n) => n + 1);
        playSkidCrashSound(muted);
      }

      if (trainingMode === 'CONTRARRELOJ') {
        clearAutoAdvance();
        autoAdvanceRef.current = window.setTimeout(() => {
          advanceQuestion(
            nextScoreVal,
            nextCorrectVal,
            nextAnswered,
            nextMaxStreakVal
          );
        }, 650);
      }
    },
    [
      selectedOption,
      questions,
      currentIndex,
      answeredCount,
      trainingMode,
      score,
      correctCount,
      maxStreak,
      streak,
      trackStep,
      muted,
      clearAutoAdvance,
      advanceQuestion,
    ]
  );

  const handleNext = useCallback(() => {
    advanceQuestion();
  }, [advanceQuestion]);

  const handleExitToMenu = () => {
    clearAutoAdvance();
    finishedRef.current = true;
    setPhase('MENU');
  };

  const currentQuestion = questions[currentIndex];
  const comboDisplay = Math.min(5, streak + 1);

  // Keyboard shortcuts during PLAYING (1-4 / A-D to answer, Enter/Space to continue in ASCENSO)
  useEffect(() => {
    if (phase !== 'PLAYING' || !currentQuestion) return;
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) {
        return;
      }

      if (selectedOption === null) {
        const keyMap: Record<string, number> = {
          '1': 0,
          '2': 1,
          '3': 2,
          '4': 3,
          a: 0,
          b: 1,
          c: 2,
          d: 3,
        };
        const idx = keyMap[e.key.toLowerCase()];
        if (idx !== undefined && idx < currentQuestion.options.length) {
          e.preventDefault();
          handleSelectOption(idx);
        }
      } else if (
        trainingMode === 'ASCENSO' &&
        (e.key === 'Enter' || e.key === ' ')
      ) {
        e.preventDefault();
        handleNext();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    phase,
    currentQuestion,
    selectedOption,
    trainingMode,
    handleSelectOption,
    handleNext,
  ]);

  const totalStepsForTrack =
    trainingMode === 'CONTRARRELOJ'
      ? LAP_STEPS
      : Math.max(1, questions.length);

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
      {/* Main Training Stage */}
      <div className="lg:col-span-8">
        {phase === 'MENU' && (
          <section className="rounded-xl border border-zinc-200 bg-white p-6 sm:p-8">
            <div className="flex items-start justify-between gap-4 border-b border-zinc-100 pb-5">
              <div>
                <p className="text-xs font-semibold text-[#EA580C]">
                  Simulador de Certificación en Pista · VENTO &amp; American Pistón
                </p>
                <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-zinc-950 sm:text-4xl text-balance">
                  Entrenamiento Interactivo para Asesores
                </h1>
                <p className="mt-1.5 text-sm text-zinc-600">
                  Elige tu unidad del catálogo y compite en pista: cada acierto acelera cuesta arriba; si fallas, pierdes tracción y sufres una caída.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setMuted((m) => !m)}
                aria-label={muted ? 'Activar sonido' : 'Silenciar sonido'}
                className="rounded-lg border border-zinc-200 p-2 text-zinc-600 hover:bg-zinc-50 cursor-pointer shrink-0"
              >
                {muted ? (
                  <VolumeX className="h-4 w-4" />
                ) : (
                  <Volume2 className="h-4 w-4" />
                )}
              </button>
            </div>

            {/* 1. Training Mode Toggle */}
            <div className="mt-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-xs font-semibold text-zinc-700">
                  1. Modo de Entrenamiento
                </span>
                {trainingMode === 'ASCENSO' && (
                  <div className="inline-flex rounded-lg border border-zinc-200 bg-zinc-50 p-1">
                    {([5, 10] as const).map((len) => (
                      <button
                        key={len}
                        type="button"
                        onClick={() => setQuestionCount(len)}
                        className={`rounded-md px-3 py-1 text-xs font-semibold whitespace-nowrap cursor-pointer ${
                          questionCount === len
                            ? 'bg-zinc-950 text-white'
                            : 'text-zinc-600 hover:text-zinc-950'
                        }`}
                      >
                        {len} preguntas
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="mt-2.5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setTrainingMode('ASCENSO')}
                  className={`rounded-xl border p-4 text-left cursor-pointer transition-colors ${
                    trainingMode === 'ASCENSO'
                      ? 'border-zinc-950 bg-zinc-950 text-white'
                      : 'border-zinc-200 bg-white text-zinc-900 hover:border-zinc-300'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-display text-lg font-bold">
                      Ascenso por Etapas
                    </span>
                    <span
                      className={`font-mono text-[11px] ${
                        trainingMode === 'ASCENSO'
                          ? 'text-zinc-300'
                          : 'text-zinc-500'
                      }`}
                    >
                      Sin reloj
                    </span>
                  </div>
                  <p
                    className={`mt-1 text-xs leading-relaxed ${
                      trainingMode === 'ASCENSO'
                        ? 'text-zinc-300'
                        : 'text-zinc-600'
                    }`}
                  >
                    Repaso detallado con explicación técnica tras cada pregunta hasta conquistar la meta.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setTrainingMode('CONTRARRELOJ')}
                  className={`rounded-xl border p-4 text-left cursor-pointer transition-colors ${
                    trainingMode === 'CONTRARRELOJ'
                      ? 'border-[#EA580C] bg-[#EA580C]/10 text-zinc-950'
                      : 'border-zinc-200 bg-white text-zinc-900 hover:border-zinc-300'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-display text-lg font-bold">
                      Contrarreloj GP (60s)
                    </span>
                    <span className="inline-flex items-center gap-1 font-mono text-[11px] font-semibold text-[#EA580C]">
                      <Clock className="h-3.5 w-3.5" />
                      Combo hasta 5x
                    </span>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-zinc-600">
                    Sprint de 60 segundos (+100 × Combo). Avance automático tras cada respuesta para máxima velocidad.
                  </p>
                </button>
              </div>
            </div>

            {/* 2. Topic Grid */}
            <div className="mt-6">
              <span className="block text-xs font-semibold text-zinc-700">
                2. Módulo de Evaluación
              </span>
              <div className="mt-2.5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {TOPICS.map((topic) => {
                  const count =
                    topic.id === 'Mixto'
                      ? allQuestions.length
                      : allQuestions.filter((q) => q.topic === topic.id).length;
                  const active = selectedTopic === topic.id;
                  return (
                    <button
                      key={topic.id}
                      type="button"
                      onClick={() => setSelectedTopic(topic.id)}
                      className={`rounded-xl border p-4 text-left cursor-pointer transition-colors ${
                        active
                          ? 'border-[#EA580C] bg-[#EA580C]/5'
                          : 'border-zinc-200 bg-white hover:border-zinc-300'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-display text-lg font-bold text-zinc-950">
                          {topic.label}
                        </span>
                        <span className="font-mono text-xs text-zinc-500 tabular-nums">
                          {count} reactivos
                        </span>
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-zinc-600">
                        {topic.description}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 3. Live Catalog Unit Picker */}
            <div className="mt-6 border-t border-zinc-100 pt-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold text-zinc-700">
                  3. Elige tu Unidad del Catálogo ({activeUnits.length} disponibles)
                </span>
                {selectedMoto && (
                  <span className="font-mono text-xs font-semibold text-[#EA580C] tabular-nums">
                    {selectedMoto.model} · {selectedMoto.displacementCc} cc ·{' '}
                    {selectedMoto.family}
                  </span>
                )}
              </div>

              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {unitFamilies.map((fam) => (
                  <button
                    key={fam}
                    type="button"
                    onClick={() => setUnitFamilyFilter(fam)}
                    className={`rounded-md border px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                      unitFamilyFilter === fam
                        ? 'border-zinc-950 bg-zinc-950 text-white'
                        : 'border-zinc-200 bg-zinc-50 text-zinc-600 hover:text-zinc-950'
                    }`}
                  >
                    {fam}
                  </button>
                ))}
              </div>

              <div className="mt-3 grid max-h-44 grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-3">
                {filteredUnits.map((moto) => {
                  const isSelected = selectedMoto?.id === moto.id;
                  const visuals = getBikeVisuals(moto);
                  return (
                    <button
                      key={moto.id}
                      type="button"
                      onClick={() => setSelectedMotoId(moto.id)}
                      className={`flex flex-col items-start rounded-lg border px-3 py-2 text-left cursor-pointer transition-colors ${
                        isSelected
                          ? 'border-[#EA580C] bg-[#EA580C]/8'
                          : 'border-zinc-200 bg-white hover:border-zinc-300'
                      }`}
                    >
                      <div className="flex w-full items-center justify-between gap-2">
                        <span className="truncate text-xs font-bold text-zinc-950">
                          {moto.model}
                        </span>
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-sm"
                          style={{ backgroundColor: visuals.color }}
                        />
                      </div>
                      <span className="mt-0.5 truncate font-mono text-[11px] text-zinc-500 tabular-nums">
                        {moto.displacementCc} cc · {moto.family}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-zinc-100 pt-5">
                <span className="text-xs text-zinc-500">
                  Atajos: teclas A–D o 1–4 para responder
                  {trainingMode === 'ASCENSO' ? ' y Enter para avanzar.' : '.'}
                </span>
                <button
                  type="button"
                  onClick={startQuiz}
                  className="rounded-lg bg-[#EA580C] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#C2410C] cursor-pointer transition-colors whitespace-nowrap"
                >
                  {trainingMode === 'CONTRARRELOJ'
                    ? 'Iniciar Contrarreloj (60s)'
                    : 'Comenzar Entrenamiento'}
                </button>
              </div>
            </div>
          </section>
        )}

        {phase === 'PLAYING' && currentQuestion && (
          <section className="space-y-4">
            {/* Live Interactive Hill-Climb Race Track */}
            <QuizRaceTrack
              currentStep={trackStep}
              totalSteps={totalStepsForTrack}
              trackState={trackState}
              bikeStyle={bikeVisuals.style}
              brandHint={currentQuestion.brand}
              unitName={selectedMoto?.model}
              unitColor={bikeVisuals.color}
              lapNumber={trainingMode === 'CONTRARRELOJ' ? lapNumber : undefined}
              streak={streak}
              lastEarned={lastEarned}
              eventNonce={eventNonce}
            />

            <div className="rounded-xl border border-zinc-200 bg-white p-6 sm:p-7">
              {/* HUD */}
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-100 pb-4">
                <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-500">
                  <span className="font-semibold text-zinc-900">
                    {currentQuestion.topic}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>{currentQuestion.brand}</span>
                  {currentQuestion.sourceSection && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="text-zinc-600">
                        Fuente: {currentQuestion.sourceSection}
                      </span>
                    </>
                  )}
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums">
                    {trainingMode === 'CONTRARRELOJ'
                      ? `Respondidas: ${answeredCount}`
                      : `Pregunta ${currentIndex + 1} / ${questions.length}`}
                  </span>
                </div>

                <div className="flex items-center gap-4 text-xs">
                  {trainingMode === 'CONTRARRELOJ' && (
                    <span
                      className={`inline-flex items-center gap-1 font-mono font-bold tabular-nums ${
                        timeLeft <= 10 ? 'text-red-600' : 'text-zinc-950'
                      }`}
                    >
                      <Clock className="h-3.5 w-3.5" />
                      {timeLeft}s
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1 font-mono font-semibold text-zinc-700 tabular-nums">
                    <Flame className="h-3.5 w-3.5 text-[#EA580C]" />
                    {trainingMode === 'CONTRARRELOJ'
                      ? `Combo ${comboDisplay}x`
                      : `Racha ${streak}x`}
                  </span>
                  <span className="font-mono font-semibold text-[#EA580C] tabular-nums">
                    {score.toLocaleString('es-MX')} pts
                  </span>
                  <button
                    type="button"
                    onClick={() => setMuted((m) => !m)}
                    aria-label="Alternar sonido"
                    className="text-zinc-400 hover:text-zinc-700 cursor-pointer"
                  >
                    {muted ? (
                      <VolumeX className="h-4 w-4" />
                    ) : (
                      <Volume2 className="h-4 w-4" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={handleExitToMenu}
                    className="text-xs font-medium text-zinc-500 hover:text-zinc-950 cursor-pointer"
                  >
                    Salir
                  </button>
                </div>
              </div>

              <motion.div
                key={currentIndex}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              >
                <h2 className="mt-5 font-display text-2xl font-bold leading-snug text-zinc-950 sm:text-3xl text-balance">
                  {currentQuestion.question}
                </h2>

                {/* Options */}
                <div className="mt-5 space-y-2.5">
                  {currentQuestion.options.map((opt, idx) => {
                    const isAnswered = selectedOption !== null;
                    const isCorrectOpt = idx === currentQuestion.correctIndex;
                    const isSelectedOpt = idx === selectedOption;

                    let stateClasses =
                      'border-zinc-200 bg-white text-zinc-800 hover:border-zinc-400 hover:bg-zinc-50';
                    if (isAnswered) {
                      if (isCorrectOpt) {
                        stateClasses =
                          'border-emerald-600 bg-emerald-50 text-emerald-950 font-semibold';
                      } else if (isSelectedOpt) {
                        stateClasses =
                          'border-red-500 bg-red-50 text-red-950';
                      } else {
                        stateClasses =
                          'border-zinc-100 bg-zinc-50/50 text-zinc-400';
                      }
                    }

                    return (
                      <button
                        key={idx}
                        type="button"
                        disabled={isAnswered}
                        onClick={() => handleSelectOption(idx)}
                        className={`flex w-full items-center justify-between gap-4 rounded-xl border px-4 py-3 text-left text-sm transition-colors ${
                          isAnswered ? 'cursor-default' : 'cursor-pointer'
                        } ${stateClasses}`}
                      >
                        <div className="flex items-start gap-3">
                          <span className="font-mono text-xs font-semibold text-zinc-400 mt-0.5">
                            {String.fromCharCode(65 + idx)}.
                          </span>
                          <span>{opt}</span>
                        </div>

                        {isAnswered && isCorrectOpt && (
                          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                        )}
                        {isAnswered && isSelectedOpt && !isCorrectOpt && (
                          <XCircle className="h-4 w-4 shrink-0 text-red-600" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </motion.div>

              {/* Explanation & Next (full feedback in ASCENSO, compact status flash in CONTRARRELOJ) */}
              {selectedOption !== null && trainingMode === 'ASCENSO' && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.16 }}
                  className="mt-5 rounded-xl border border-zinc-200 bg-zinc-50 p-4"
                >
                  <div className="flex items-center gap-2 text-xs font-semibold">
                    {selectedOption === currentQuestion.correctIndex ? (
                      <span className="text-emerald-700">
                        Respuesta correcta · +{lastEarned} pts y subes 1 tramo en pista
                      </span>
                    ) : (
                      <span className="text-red-700">
                        Caída en pista · Pierdes la racha y retrocedes 0.5 tramos
                      </span>
                    )}
                  </div>
                  <p className="mt-1.5 text-xs leading-relaxed text-zinc-700">
                    {currentQuestion.explanation}
                  </p>
                  <div className="mt-4 flex justify-end">
                    <button
                      type="button"
                      onClick={handleNext}
                      className="rounded-lg bg-zinc-950 px-5 py-2 text-xs font-semibold text-white hover:bg-zinc-800 cursor-pointer whitespace-nowrap"
                    >
                      {currentIndex + 1 < questions.length
                        ? 'Siguiente pregunta'
                        : 'Ver resultado'}
                    </button>
                  </div>
                </motion.div>
              )}

              {selectedOption !== null && trainingMode === 'CONTRARRELOJ' && (
                <div className="mt-4 flex items-center justify-between rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-xs font-semibold">
                  {selectedOption === currentQuestion.correctIndex ? (
                    <span className="text-emerald-700">
                      ¡Correcto! +{lastEarned} pts · Siguiente pregunta...
                    </span>
                  ) : (
                    <span className="text-red-700">
                      Caída en pista · Combo reiniciado a 1x
                    </span>
                  )}
                </div>
              )}
            </div>
          </section>
        )}

        {phase === 'SUMMARY' && (
          <div className="space-y-4">
            <QuizRaceTrack
              currentStep={trackStep}
              totalSteps={totalStepsForTrack}
              trackState={trackState}
              bikeStyle={bikeVisuals.style}
              unitName={selectedMoto?.model}
              unitColor={bikeVisuals.color}
              lapNumber={trainingMode === 'CONTRARRELOJ' ? lapNumber : undefined}
              streak={maxStreak}
              lastEarned={score}
              eventNonce={eventNonce}
            />

            <section className="rounded-xl border border-zinc-200 bg-white p-6 sm:p-8 text-center">
              <Trophy className="mx-auto h-10 w-10 text-[#EA580C]" />
              <h2 className="mt-3 font-display text-3xl font-bold text-zinc-950">
                {trainingMode === 'CONTRARRELOJ'
                  ? 'Contrarreloj GP Finalizado'
                  : 'Entrenamiento Completado'}
              </h2>
              <p className="mt-1 text-sm text-zinc-600">
                Módulo: {selectedTopic}
                {selectedMoto ? ` · Unidad: ${selectedMoto.model}` : ''}
              </p>

              <div className="mx-auto mt-6 grid max-w-lg grid-cols-3 gap-4 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
                <div>
                  <div className="font-mono text-2xl font-bold text-[#EA580C] tabular-nums">
                    {score.toLocaleString('es-MX')}
                  </div>
                  <div className="text-xs text-zinc-500">Puntos ganados</div>
                </div>
                <div>
                  <div className="font-mono text-2xl font-bold text-zinc-950 tabular-nums">
                    {correctCount}/
                    {trainingMode === 'CONTRARRELOJ'
                      ? answeredCount
                      : questions.length}
                  </div>
                  <div className="text-xs text-zinc-500">Aciertos</div>
                </div>
                <div>
                  <div className="font-mono text-2xl font-bold text-zinc-950 tabular-nums">
                    {maxStreak}x
                  </div>
                  <div className="text-xs text-zinc-500">Mejor racha</div>
                </div>
              </div>

              {!user ? (
                <div className="mx-auto mt-6 max-w-md rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-xs text-zinc-700">
                  <p className="font-semibold text-zinc-900">
                    ¿Quieres guardar tu puntuación en el Ranking?
                  </p>
                  <p className="mt-1 text-zinc-600">
                    Inicia sesión y registra tu nombre de asesor para competir con el equipo.
                  </p>
                  <button
                    type="button"
                    onClick={onOpenProfileModal}
                    className="mt-3 rounded-lg bg-[#EA580C] px-4 py-2 text-xs font-semibold text-white hover:bg-[#C2410C] cursor-pointer"
                  >
                    Unirme al Ranking
                  </button>
                </div>
              ) : (
                <p className="mt-5 text-xs font-medium text-emerald-700">
                  {savingResult ? 'Guardando resultados...' : saveMessage}
                </p>
              )}

              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setPhase('MENU')}
                  className="rounded-lg border border-zinc-300 px-4 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 cursor-pointer whitespace-nowrap"
                >
                  Cambiar tema o modo
                </button>
                <button
                  type="button"
                  onClick={startQuiz}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-950 px-5 py-2 text-xs font-semibold text-white hover:bg-zinc-800 cursor-pointer whitespace-nowrap"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Volver a intentar
                </button>
              </div>
            </section>
          </div>
        )}
      </div>

      {/* Right Sidebar: Advisor Live Ranking */}
      <aside className="lg:col-span-4 space-y-5">
        <div className="rounded-xl border border-zinc-200 bg-white p-5">
          <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
            <div>
              <h3 className="font-display text-xl font-bold text-zinc-950">
                Ranking de Asesores
              </h3>
              <p className="text-xs text-zinc-500">
                Puntos acumulados (Quiz + Pista Arcade)
              </p>
            </div>
            {!user && (
              <button
                type="button"
                onClick={onOpenProfileModal}
                className="text-xs font-semibold text-[#EA580C] hover:underline cursor-pointer"
              >
                Unirme
              </button>
            )}
          </div>

          {leaderboard.length === 0 ? (
            <div className="py-8 text-center text-xs text-zinc-500">
              Aún no hay asesores registrados en la tabla. ¡Sé el primero en unirte!
            </div>
          ) : (
            <div className="mt-3 divide-y divide-zinc-100">
              {leaderboard.slice(0, 10).map((entry, idx) => {
                const isMe = advisorProfile?.uid === entry.uid;
                return (
                  <div
                    key={entry.uid}
                    className={`flex items-center justify-between gap-3 py-2.5 text-xs ${
                      isMe ? 'font-semibold text-zinc-950' : 'text-zinc-700'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className={`font-mono w-5 text-right tabular-nums ${
                          idx < 3 ? 'font-bold text-[#EA580C]' : 'text-zinc-400'
                        }`}
                      >
                        {idx + 1}.
                      </span>
                      <div className="min-w-0">
                        <div className="truncate">
                          {entry.displayName}
                          {isMe ? ' (Tú)' : ''}
                        </div>
                        {entry.branch && (
                          <div className="truncate text-[11px] text-zinc-400 font-normal">
                            {entry.branch}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="font-mono font-semibold text-zinc-950 tabular-nums shrink-0">
                      {entry.totalPoints.toLocaleString('es-MX')} pts
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
