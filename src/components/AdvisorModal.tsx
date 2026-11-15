import { useState } from 'react';
import { LogOut, UserCheck } from 'lucide-react';
import type { AdvisorProfile, LocalUser } from '../types';

interface AdvisorModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: LocalUser | null;
  advisorProfile: AdvisorProfile | null;
  isAdmin: boolean;
  onSignIn: (email: string, displayName: string, branch: string) => Promise<void>;
  onSignOut: () => void;
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
  const [email, setEmail] = useState(user?.email || '');
  const [displayName, setDisplayName] = useState(
    advisorProfile?.displayName || user?.displayName || ''
  );
  const [branch, setBranch] = useState(advisorProfile?.branch || 'Call Center');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !displayName.trim()) return;
    setLoading(true);
    try {
      if (!user) {
        await onSignIn(email.trim().toLowerCase(), displayName.trim(), branch.trim());
      } else {
        await onSaveProfile(displayName.trim(), branch.trim());
      }
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-zinc-200 pb-3">
          <h3 className="font-display text-2xl font-extrabold uppercase text-[#231F20]">
            Perfil de Asesor
          </h3>
          <button
            onClick={onClose}
            className="rounded bg-zinc-100 px-2.5 py-1 text-xs font-bold text-zinc-600"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4 text-sm">
          <div>
            <label className="block text-xs font-bold text-zinc-700">Correo Corporativo</label>
            <input
              type="email"
              required
              disabled={Boolean(user)}
              placeholder="nombre@vento.com"
              value={user ? user.email : email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 disabled:bg-zinc-100"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-zinc-700">Nombre Completo</label>
            <input
              type="text"
              required
              placeholder="Ej. Ivan Moreno"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-zinc-700">Área / Sucursal</label>
            <input
              type="text"
              placeholder="Ej. Atención a Clientes / CESVE"
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2"
            />
          </div>

          {isAdmin && (
            <div className="rounded-lg bg-[#231F20] px-3 py-2 text-xs font-bold text-[#F28F17]">
              ✓ Permisos de Administrador Activos
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            {user ? (
              <button
                type="button"
                onClick={onSignOut}
                className="flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50"
              >
                <LogOut className="h-4 w-4" /> Cerrar Sesión
              </button>
            ) : (
              <div />
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-1.5 rounded-xl bg-[#F28F17] px-5 py-2.5 text-xs font-extrabold uppercase text-[#231F20]"
            >
              <UserCheck className="h-4 w-4" />
              {loading ? 'Guardando en Sheets...' : 'Guardar Perfil'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
