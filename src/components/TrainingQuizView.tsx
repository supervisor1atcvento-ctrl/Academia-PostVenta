import { useState } from 'react';
import { Award, CheckCircle, Play, Trophy, XCircle } from 'lucide-react';
import type {
  AdminQuizItem,
  AdvisorProfile,
  LocalUser,
  Motorcycle,
  QuizTopic,
  TimeGuideEntry,
} from '../types';

interface TrainingQuizViewProps {
  motorcycles: Motorcycle[];
  timeGuides: TimeGuideEntry[];
  adminQuizItems: AdminQuizItem[];
  user: LocalUser | null;
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

export default function TrainingQuizView({
  adminQuizItems,
  user,
  leaderboard,
  onOpenProfileModal,
  onCompleteQuiz,
}: TrainingQuizViewProps) {
  const [selectedTopic, setSelectedTopic] = useState<QuizTopic>('mixed');
  const [quizStarted, setQuizStarted] = useState(false);
  const [questions, setQuestions] = useState<AdminQuizItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [streak, setStreak] = useState(0);
  const [maxStreak, setMaxStreak] = useState(0);
  const [finished, setFinished] = useState(false);
  const [saving, setSaving] = useState(false);

  const startQuiz = () => {
    const pool = adminQuizItems.filter(
      (q) => selectedTopic === 'mixed' || q.topic === selectedTopic
    );
    const activePool = pool.length > 0 ? pool : adminQuizItems;
    const shuffled = [...activePool].sort(() => Math.random() - 0.5).slice(0, 10);

    setQuestions(shuffled);
    setCurrentIndex(0);
    setSelectedOption(null);
    setScore(0);
    setCorrectCount(0);
    setStreak(0);
    setMaxStreak(0);
    setFinished(false);
    setQuizStarted(true);
  };

  const handleAnswer = (idx: number) => {
    if (selectedOption !== null) return;
    setSelectedOption(idx);
    const currentQ = questions[currentIndex];
    if (idx === currentQ.correctIndex) {
      const nextStreak = streak + 1;
      setStreak(nextStreak);
      setMaxStreak((prev) => Math.max(prev, nextStreak));
      setCorrectCount((prev) => prev + 1);
      setScore((prev) => prev + 25 + nextStreak * 5);
    } else {
      setStreak(0);
    }
  };

  const handleNext = async () => {
    if (currentIndex + 1 < questions.length) {
      setCurrentIndex((prev) => prev + 1);
      setSelectedOption(null);
    } else {
      setFinished(true);
      if (user) {
        setSaving(true);
        try {
          await onCompleteQuiz({
            topic: selectedTopic,
            score,
            correctCount,
            totalQuestions: questions.length,
            maxStreak,
          });
        } finally {
          setSaving(false);
        }
      }
    }
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2">
        {!quizStarted ? (
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
            <span className="rounded bg-[#F28F17] px-2.5 py-1 text-xs font-bold uppercase text-[#231F20]">
              Evaluación Continua
            </span>
            <h2 className="mt-2 font-display text-3xl font-extrabold text-[#231F20]">
              Simulador de Capacitación Técnica
            </h2>
            <p className="mt-1 text-sm text-zinc-600">
              Selecciona un módulo temático para sumar puntos al ranking oficial en Google Sheets.
            </p>

            {!user && (
              <div className="mt-4 flex items-center justify-between rounded-xl border border-orange-300 bg-orange-50 p-4">
                <span className="text-xs font-medium text-orange-950">
                  Inicia sesión con tu perfil de asesor para guardar tu puntaje en el ranking.
                </span>
                <button
                  onClick={onOpenProfileModal}
                  className="rounded-lg bg-[#231F20] px-3 py-1.5 text-xs font-bold text-[#F28F17]"
                >
                  Identificarme
                </button>
              </div>
            )}

            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {(
                [
                  { id: 'mixed', label: 'Mixto General' },
                  { id: 'catalog', label: 'Fichas Técnicas' },
                  { id: 'warranty', label: 'Garantías' },
                  { id: 'times', label: 'Tiempos CESVE' },
                ] as { id: QuizTopic; label: string }[]
              ).map((t) => (
                <button
                  key={t.id}
                  onClick={() => setSelectedTopic(t.id)}
                  className={`rounded-xl border p-3 text-left text-xs font-bold transition ${
                    selectedTopic === t.id
                      ? 'border-[#F28F17] bg-[#231F20] text-[#F28F17]'
                      : 'border-zinc-200 bg-zinc-50 text-zinc-700 hover:border-zinc-300'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <button
              onClick={startQuiz}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-[#F28F17] py-3.5 text-sm font-extrabold uppercase text-[#231F20] shadow hover:bg-[#e07d0a]"
            >
              <Play className="h-5 w-5" /> Comenzar Evaluación
            </button>
          </div>
        ) : finished ? (
          <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm">
            <Award className="mx-auto h-16 w-16 text-[#F28F17]" />
            <h3 className="mt-3 font-display text-4xl font-extrabold text-[#231F20]">
              ¡Evaluación Completada!
            </h3>
            <div className="mt-4 flex justify-center gap-6">
              <div className="rounded-xl bg-zinc-100 px-5 py-3">
                <div className="text-xs text-zinc-500">Puntaje Obtenido</div>
                <div className="font-mono text-2xl font-extrabold text-[#F28F17]">+{score} pts</div>
              </div>
              <div className="rounded-xl bg-zinc-100 px-5 py-3">
                <div className="text-xs text-zinc-500">Aciertos</div>
                <div className="font-mono text-2xl font-extrabold text-[#231F20]">
                  {correctCount} / {questions.length}
                </div>
              </div>
            </div>
            {saving && (
              <p className="mt-3 text-xs font-semibold text-[#F28F17]">
                Guardando resultados en Google Sheets...
              </p>
            )}
            <button
              onClick={() => setQuizStarted(false)}
              className="mt-6 rounded-xl bg-[#231F20] px-6 py-3 text-xs font-bold uppercase text-white hover:bg-[#F28F17] hover:text-[#231F20]"
            >
              Volver al Inicio del Quiz
            </button>
          </div>
        ) : (
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between border-b border-zinc-200 pb-3 text-xs">
              <span className="font-bold text-zinc-500">
                Pregunta {currentIndex + 1} de {questions.length}
              </span>
              <span className="font-mono font-bold text-[#F28F17]">Puntos: {score}</span>
            </div>

            <h3 className="mt-4 text-lg font-bold text-[#231F20]">
              {questions[currentIndex]?.question}
            </h3>

            <div className="mt-4 space-y-2.5">
              {questions[currentIndex]?.options.map((opt, idx) => {
                const isAnswered = selectedOption !== null;
                const isCorrect = idx === questions[currentIndex].correctIndex;
                const isSelected = idx === selectedOption;

                let btnStyle = 'border-zinc-200 bg-white hover:border-[#F28F17]';
                if (isAnswered) {
                  if (isCorrect) btnStyle = 'border-emerald-500 bg-emerald-50 text-emerald-900';
                  else if (isSelected) btnStyle = 'border-red-500 bg-red-50 text-red-900';
                  else btnStyle = 'border-zinc-200 opacity-60';
                }

                return (
                  <button
                    key={idx}
                    onClick={() => handleAnswer(idx)}
                    disabled={isAnswered}
                    className={`flex w-full items-center justify-between rounded-xl border p-3.5 text-left text-sm font-medium transition ${btnStyle}`}
                  >
                    <span>{opt}</span>
                    {isAnswered && isCorrect && <CheckCircle className="h-5 w-5 text-emerald-600" />}
                    {isAnswered && isSelected && !isCorrect && (
                      <XCircle className="h-5 w-5 text-red-600" />
                    )}
                  </button>
                );
              })}
            </div>

            {selectedOption !== null && (
              <div className="mt-4 rounded-xl bg-zinc-100 p-4 text-xs text-zinc-800">
                <strong>Explicación: </strong>
                {questions[currentIndex]?.explanation}
              </div>
            )}

            {selectedOption !== null && (
              <button
                onClick={handleNext}
                className="mt-5 w-full rounded-xl bg-[#231F20] py-3 text-xs font-bold uppercase text-[#F28F17]"
              >
                {currentIndex + 1 < questions.length ? 'Siguiente Pregunta →' : 'Finalizar Quiz'}
              </button>
            )}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2 border-b border-zinc-200 pb-3">
          <Trophy className="h-5 w-5 text-[#F28F17]" />
          <h3 className="font-display text-xl font-bold uppercase text-[#231F20]">
            Ranking de Asesores
          </h3>
        </div>

        <div className="mt-4 space-y-2.5">
          {leaderboard.slice(0, 10).map((adv, idx) => (
            <div
              key={adv.uid}
              className="flex items-center justify-between rounded-xl bg-zinc-50 px-3 py-2.5 text-xs"
            >
              <div className="flex items-center gap-2.5">
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-full font-mono font-bold ${
                    idx === 0
                      ? 'bg-[#F28F17] text-[#231F20]'
                      : 'bg-[#231F20] text-white'
                  }`}
                >
                  {idx + 1}
                </span>
                <div>
                  <div className="font-bold text-zinc-900">{adv.displayName}</div>
                  <div className="text-[11px] text-zinc-500">{adv.branch || 'Asesor'}</div>
                </div>
              </div>
              <span className="font-mono font-bold text-[#F28F17]">{adv.totalPoints} pts</span>
            </div>
          ))}
          {leaderboard.length === 0 && (
            <p className="text-xs text-zinc-500">Aún no hay puntajes registrados en Sheets.</p>
          )}
        </div>
      </div>
    </div>
  );
}
