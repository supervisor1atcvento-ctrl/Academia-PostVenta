import { useState, useEffect } from 'react';
import type { User } from 'firebase/auth';
import { LogOut, Trophy, X } from 'lucide-react';
import { OPERATIONAL_CHANNELS } from '../data/seedData';
import type { AdvisorProfile } from '../types';

interface AdvisorModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  advisorProfile: AdvisorProfile | null;
  isAdmin: boolean;
  onSignIn: () => Promise<void>;
  onSignOut: () => Promise<void>;
  onSaveProfile: (displayName: string, branch: string) => Promise<void>;
}

export default function AdvisorModal({
  isOpen,
  onClose,
  user,
  advisorProfile,
  isAdmin,
  onSignIn,
  onSignOut,
  onSaveProfile,
}: AdvisorModalProps) {
  const [displayName, setDisplayName] = useState('');
  const [branch, setBranch] = useState('');
  const [saving, setSaving] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [savedNotice, setSavedNotice] = useState('');

  useEffect(() => {
    if (isOpen) {
      setDisplayName(advisorProfile?.displayName || user?.displayName || '');
      setBranch(advisorProfile?.branch || '');
      setErrorMsg('');
      setSavedNotice('');
    }
  }, [isOpen, advisorProfile, user]);

  if (!isOpen) return null;

  const handleSignIn = async () => {
    setAuthLoading(true);
    setErrorMsg('');
    try {
      await onSignIn();
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'No se pudo iniciar sesión con Google.'
      );
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = displayName.trim();
    if (cleanName.length < 2 || cleanName.length > 60) {
      setErrorMsg('Ingresa tu nombre de asesor (entre 2 y 60 caracteres).');
      return;
    }
    setSaving(true);
    setErrorMsg('');
    setSavedNotice('');
    try {
      await onSaveProfile(cleanName, branch.trim().slice(0, 60));
      setSavedNotice('Perfil actualizado en el ranking en vivo.');
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Error al guardar tu perfil.'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/60 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="advisor-modal-title"
    >
      <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-zinc-100 pb-4">
          <div>
            <h2
              id="advisor-modal-title"
              className="font-display text-2xl font-bold tracking-tight text-zinc-950"
            >
              {user ? 'Perfil de Asesor' : 'Únete al Ranking de Asesores'}
            </h2>
            <p className="mt-1 text-sm text-zinc-600">
              {user
                ? 'Personaliza tu nombre visible en la tabla de posiciones.'
                : 'Inicia sesión con Google para registrar tu nombre y sumar puntos oficiales.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar ventana"
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {!user ? (
          <div className="mt-5 space-y-4">
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700 space-y-2">
              <p className="font-semibold text-zinc-900">
                ¿Qué obtienes al registrarte?
              </p>
              <ul className="space-y-1 text-xs text-zinc-600">
                <li>· Tu nombre y CESVE / Sucursal en el Ranking nacional en vivo.</li>
                <li>· Acumulación automática de puntos en quizzes técnicos y garantías.</li>
                <li>· Registro de tu récord en el juego Moto Runner.</li>
              </ul>
            </div>

            {errorMsg && (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {errorMsg}
              </p>
            )}

            <button
              type="button"
              onClick={handleSignIn}
              disabled={authLoading}
              className="flex w-full items-center justify-center gap-3 rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-900 shadow-xs hover:bg-zinc-50 disabled:opacity-60 cursor-pointer transition-colors"
            >
              <svg
                className="h-4 w-4 shrink-0"
                viewBox="0 0 48 48"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <path
                  fill="#EA4335"
                  d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                />
                <path
                  fill="#4285F4"
                  d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                />
                <path
                  fill="#FBBC05"
                  d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                />
                <path
                  fill="#34A853"
                  d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                />
              </svg>
              <span>{authLoading ? 'Conectando...' : 'Sign in with Google'}</span>
            </button>
          </div>
        ) : (
          <div className="mt-5 space-y-5">
            <div className="grid grid-cols-3 gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3.5 text-center">
              <div>
                <div className="font-mono text-lg font-semibold text-zinc-950 tabular-nums">
                  {(advisorProfile?.quizPoints ?? 0).toLocaleString('es-MX')}
                </div>
                <div className="text-[11px] text-zinc-500">Pts. Quiz</div>
              </div>
              <div>
                <div className="font-mono text-lg font-semibold text-zinc-950 tabular-nums">
                  {(advisorProfile?.gameHighScore ?? 0).toLocaleString('es-MX')}
                </div>
                <div className="text-[11px] text-zinc-500">Moto Runner</div>
              </div>
              <div>
                <div className="font-mono text-lg font-semibold text-[#EA580C] tabular-nums">
                  {(advisorProfile?.totalPoints ?? 0).toLocaleString('es-MX')}
                </div>
                <div className="text-[11px] text-zinc-500">Total Ranking</div>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="advisor-name"
                  className="block text-xs font-semibold text-zinc-700"
                >
                  Nombre del Asesor (visible en Ranking)
                </label>
                <input
                  id="advisor-name"
                  type="text"
                  required
                  maxLength={60}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Ej. Carlos Mendoza"
                  className="mt-1.5 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-[#EA580C] focus:outline-none focus:ring-2 focus:ring-[#EA580C]/20"
                />
              </div>

              <div>
                <label
                  htmlFor="advisor-branch"
                  className="block text-xs font-semibold text-zinc-700"
                >
                  Canal de Atención / Sucursal / CESVE (opcional)
                </label>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {OPERATIONAL_CHANNELS.map((channel) => {
                    const selected = branch.trim() === channel;
                    return (
                      <button
                        key={channel}
                        type="button"
                        onClick={() => setBranch(channel)}
                        className={`rounded-md border px-2 py-1 text-[11px] font-medium whitespace-nowrap cursor-pointer transition-colors ${
                          selected
                            ? 'border-zinc-950 bg-zinc-950 text-white'
                            : 'border-zinc-200 bg-zinc-50 text-zinc-700 hover:border-zinc-300 hover:bg-zinc-100'
                        }`}
                      >
                        {channel}
                      </button>
                    );
                  })}
                </div>
                <input
                  id="advisor-branch"
                  type="text"
                  maxLength={60}
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  placeholder="O escribe tu CESVE / Sucursal (ej. CESVE Norte CDMX)"
                  className="mt-2 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-[#EA580C] focus:outline-none focus:ring-2 focus:ring-[#EA580C]/20"
                />
              </div>

              <div className="flex items-center justify-between text-xs text-zinc-500">
                <span>Cuenta: {user.email}</span>
                {isAdmin && (
                  <span className="font-semibold text-[#EA580C]">
                    Administrador Activo
                  </span>
                )}
              </div>

              {errorMsg && (
                <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  {errorMsg}
                </p>
              )}

              {savedNotice && (
                <p className="flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                  <Trophy className="h-3.5 w-3.5 shrink-0" />
                  <span>{savedNotice}</span>
                </p>
              )}

              <div className="flex items-center justify-between gap-3 pt-1">
                <button
                  type="button"
                  onClick={onSignOut}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-100 cursor-pointer"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Cerrar sesión
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-zinc-950 px-4 py-2 text-xs font-semibold text-white hover:bg-zinc-800 disabled:opacity-60 cursor-pointer"
                >
                  {saving ? 'Guardando...' : 'Guardar Nombre'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
