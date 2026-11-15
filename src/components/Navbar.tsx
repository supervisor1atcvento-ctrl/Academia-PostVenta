import type { User } from 'firebase/auth';
import type { AdvisorProfile, AppTab } from '../types';

interface NavbarProps {
  activeTab: AppTab;
  onSelectTab: (tab: AppTab) => void;
  user: User | null;
  advisorProfile: AdvisorProfile | null;
  onOpenProfileModal: () => void;
}

const NAV_ITEMS: { id: AppTab; label: string }[] = [
  { id: 'catalog', label: 'Catálogo' },
  { id: 'warranty', label: 'Garantías' },
  { id: 'training', label: 'Entrenamiento' },
  { id: 'runner', label: 'Moto Runner' },
  { id: 'admin', label: 'Admin' },
];

export default function Navbar({
  activeTab,
  onSelectTab,
  user,
  advisorProfile,
  onOpenProfileModal,
}: NavbarProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-zinc-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-8 px-4 py-3.5 sm:px-6 lg:px-8">
        {/* Zone 1: Single-element Brand Wordmark */}
        <button
          type="button"
          onClick={() => onSelectTab('catalog')}
          className="font-display text-2xl font-bold tracking-tight text-zinc-950 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#EA580C] rounded"
        >
          Vento &amp; Pistón Academy
        </button>

        {/* Zone 2: Concise single-line navigation links */}
        <nav
          aria-label="Navegación principal"
          className="hidden md:flex items-center gap-7 text-sm font-medium"
        >
          {NAV_ITEMS.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                className={`relative py-1.5 whitespace-nowrap shrink-0 cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#EA580C] rounded ${
                  isActive
                    ? 'text-zinc-950 font-semibold'
                    : 'text-zinc-500 hover:text-zinc-900'
                }`}
              >
                {item.label}
                {isActive && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-0 -bottom-[15px] h-0.5 bg-[#EA580C]"
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Single primary action */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={onOpenProfileModal}
            className={`px-4 py-2 text-xs font-semibold rounded-lg whitespace-nowrap shrink-0 cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#EA580C] ${
              user
                ? 'bg-zinc-950 text-white hover:bg-zinc-800'
                : 'bg-[#EA580C] text-white hover:bg-[#C2410C]'
            }`}
          >
            {user
              ? `${advisorProfile?.displayName || user.displayName || 'Asesor'} · ${(advisorProfile?.totalPoints ?? 0).toLocaleString('es-MX')} pts`
              : 'Unirme al Ranking'}
          </button>
        </div>
      </div>

      {/* Compact mobile navigation row */}
      <nav
        aria-label="Navegación móvil"
        className="flex md:hidden items-center gap-4 overflow-x-auto border-t border-zinc-100 px-4 py-2 text-xs font-medium"
      >
        {NAV_ITEMS.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectTab(item.id)}
              className={`py-1 whitespace-nowrap shrink-0 cursor-pointer ${
                isActive
                  ? 'text-[#EA580C] font-semibold border-b-2 border-[#EA580C]'
                  : 'text-zinc-600'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </nav>
    </header>
  );
}
