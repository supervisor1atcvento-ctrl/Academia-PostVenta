import {
  ArrowRight,
  Award,
  Bike,
  BookOpen,
  CheckCircle2,
  Flame,
  Gamepad2,
  GraduationCap,
  ShieldCheck,
  Sparkles,
  Target,
  Trophy,
  Zap,
} from 'lucide-react';
import type { AdvisorProfile, AppTab, LocalUser } from '../types';

interface HomeViewProps {
  user: LocalUser | null;
  advisorProfile: AdvisorProfile | null;
  leaderboard: AdvisorProfile[];
  isConnected: boolean;
  motorcycleCount: number;
  policyCount: number;
  onNavigate: (tab: AppTab) => void;
  onOpenProfile: () => void;
}

export default function HomeView({
  user,
  advisorProfile,
  leaderboard,
  isConnected,
  motorcycleCount,
  policyCount,
  onNavigate,
  onOpenProfile,
}: HomeViewProps) {
  const firstName = (advisorProfile?.displayName || user?.displayName || 'asesor').trim().split(' ')[0];
  const rank = [...leaderboard]
    .sort((a, b) => (b.totalPoints || 0) - (a.totalPoints || 0))
    .findIndex((advisor) => advisor.uid === user?.uid || advisor.email === user?.email) + 1;

  const learningCards = [
    {
      title: 'Reto relámpago',
      description: 'Pon a prueba lo que sabes y gana puntos para el ranking.',
      action: 'Jugar quiz',
      tab: 'training' as AppTab,
      icon: Zap,
      color: 'bg-[#F28F17] text-[#231F20]',
      tag: '5 MIN',
    },
    {
      title: 'Explora el catálogo',
      description: 'Descubre modelos, especificaciones y argumentos de venta.',
      action: 'Ver unidades',
      tab: 'catalog' as AppTab,
      icon: Bike,
      color: 'bg-sky-100 text-sky-800',
      tag: `${motorcycleCount} MODELOS`,
    },
    {
      title: 'Misión: Moto Runner',
      description: 'Salta obstáculos, supera tu récord y reta al equipo.',
      action: 'Empezar misión',
      tab: 'runner' as AppTab,
      icon: Gamepad2,
      color: 'bg-violet-100 text-violet-800',
      tag: 'JUEGA',
    },
  ];

  return (
    <div className="space-y-7 pb-8">
      <section className="relative overflow-hidden rounded-[2rem] bg-[#231F20] px-6 py-8 text-white shadow-xl sm:px-10 sm:py-11">
        <div className="absolute -right-10 -top-20 h-72 w-72 rounded-full bg-[#F28F17]/20 blur-3xl" />
        <div className="absolute -bottom-28 right-1/3 h-56 w-56 rounded-full bg-orange-500/10 blur-3xl" />
        <div className="relative grid gap-8 md:grid-cols-[1fr_auto] md:items-end">
          <div className="max-w-2xl">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-orange-200">
              <Sparkles className="h-4 w-4 text-[#F28F17]" /> APRENDE · JUEGA · AVANZA
            </div>
            <p className="text-sm font-semibold text-zinc-300">Tu taller de aprendizaje comienza aquí</p>
            <h2 className="mt-1 font-display text-5xl font-extrabold uppercase leading-[0.95] sm:text-6xl">
              ¡Qué onda, <span className="text-[#F28F17]">{firstName}!</span>
            </h2>
            <p className="mt-4 max-w-xl text-sm leading-6 text-zinc-300 sm:text-base">
              Cada reto te acerca a ser la persona experta que tus clientes necesitan. ¿Qué misión vas a completar hoy?
            </p>
            <button
              onClick={() => onNavigate('training')}
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#F28F17] px-5 py-3 text-sm font-extrabold text-[#231F20] shadow-lg shadow-orange-950/30 transition hover:-translate-y-0.5 hover:bg-orange-300"
            >
              <Target className="h-4 w-4" /> Aceptar reto del día <ArrowRight className="h-4 w-4" />
            </button>
          </div>
          <div className="hidden h-36 w-36 items-center justify-center rounded-full border border-white/10 bg-white/5 md:flex">
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-[#F28F17] text-[#231F20] shadow-[0_0_55px_rgba(242,143,23,0.35)]">
              <GraduationCap className="h-12 w-12" />
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex items-center justify-between text-zinc-500"><span className="text-xs font-semibold">Mis puntos</span><Award className="h-4 w-4 text-[#F28F17]" /></div>
          <div className="mt-2 font-display text-3xl font-extrabold text-[#231F20]">{advisorProfile?.totalPoints || 0}<span className="ml-1 text-sm font-bold text-zinc-400">pts</span></div>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex items-center justify-between text-zinc-500"><span className="text-xs font-semibold">Quizzes completados</span><CheckCircle2 className="h-4 w-4 text-emerald-500" /></div>
          <div className="mt-2 font-display text-3xl font-extrabold text-[#231F20]">{advisorProfile?.quizzesCompleted || 0}<span className="ml-1 text-sm font-bold text-zinc-400">retos</span></div>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex items-center justify-between text-zinc-500"><span className="text-xs font-semibold">Mejor racha</span><Flame className="h-4 w-4 text-orange-500" /></div>
          <div className="mt-2 font-display text-3xl font-extrabold text-[#231F20]">{advisorProfile?.streakBest || 0}<span className="ml-1 text-sm font-bold text-zinc-400">aciertos</span></div>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex items-center justify-between text-zinc-500"><span className="text-xs font-semibold">Lugar en ranking</span><Trophy className="h-4 w-4 text-amber-500" /></div>
          <div className="mt-2 font-display text-3xl font-extrabold text-[#231F20]">{rank || '—'}<span className="ml-1 text-sm font-bold text-zinc-400">{rank ? 'º lugar' : 'juega para entrar'}</span></div>
        </div>
      </section>

      <section>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#C66B00]">Tu siguiente nivel</p>
            <h3 className="mt-1 font-display text-3xl font-extrabold uppercase text-[#231F20]">Elige tu aventura</h3>
          </div>
          <span className="text-xs text-zinc-500">Aprender también puede ser divertido ✨</span>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {learningCards.map((card) => {
            const Icon = card.icon;
            return (
              <article key={card.title} className="group flex min-h-56 flex-col rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
                <div className="flex items-start justify-between">
                  <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${card.color}`}><Icon className="h-5 w-5" /></div>
                  <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-[10px] font-extrabold tracking-wide text-zinc-500">{card.tag}</span>
                </div>
                <h4 className="mt-4 font-display text-2xl font-bold text-[#231F20]">{card.title}</h4>
                <p className="mt-1 flex-1 text-sm leading-5 text-zinc-500">{card.description}</p>
                <button onClick={() => onNavigate(card.tab)} className="mt-4 inline-flex items-center gap-2 text-xs font-extrabold uppercase text-[#A95700] transition group-hover:gap-3">
                  {card.action} <ArrowRight className="h-4 w-4" />
                </button>
              </article>
            );
          })}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#C66B00]">Kit de confianza</p>
              <h3 className="mt-1 font-display text-2xl font-extrabold uppercase text-[#231F20]">Respuestas para dar el mejor servicio</h3>
            </div>
            <ShieldCheck className="hidden h-8 w-8 text-emerald-600 sm:block" />
          </div>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">Consulta reglas de garantía y tiempos de servicio cuando lo necesites. La información del equipo está a un clic.</p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button onClick={() => onNavigate('warranty')} className="inline-flex items-center gap-2 rounded-xl bg-[#231F20] px-4 py-2.5 text-xs font-bold text-white transition hover:bg-zinc-700">
              <BookOpen className="h-4 w-4 text-[#F28F17]" /> Consultar garantías y tiempos
            </button>
            <span className="text-xs text-zinc-500">{policyCount} guías disponibles</span>
          </div>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-zinc-500">Tu academia</p><h3 className="mt-1 font-display text-2xl font-extrabold uppercase text-[#231F20]">Progreso conectado</h3></div>
            <span className={`h-3 w-3 rounded-full ${isConnected ? 'bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,0.12)]' : 'bg-amber-400'}`} />
          </div>
          <p className="mt-2 text-sm leading-6 text-zinc-500">{isConnected ? 'Tus modelos, guías y avances se sincronizan con Google Sheets.' : 'La academia está lista. Los datos se mostrarán al conectar Google Sheets.'}</p>
          {!user && <button onClick={onOpenProfile} className="mt-4 text-xs font-extrabold uppercase text-[#A95700] hover:underline">Identifícate para guardar tus puntos →</button>}
          {user && <p className="mt-4 text-xs font-semibold text-emerald-700">¡Vamos, {firstName}! Tu siguiente punto está a una misión.</p>}
        </div>
      </section>
    </div>
  );
}
