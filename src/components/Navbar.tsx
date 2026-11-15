import { Award, BookOpen, Gamepad2, Home, RefreshCw, ShieldCheck, Sliders, UserCircle } from 'lucide-react';
import type { AdvisorProfile, AppTab, LocalUser } from '../types';

interface NavbarProps {
  activeTab: AppTab;
  onSelectTab: (tab: AppTab) => void;
  user: LocalUser | null;
  advisorProfile: AdvisorProfile | null;
  onOpenProfileModal: () => void;
  onRefreshData: () => void;
  isSyncing: boolean;
}

export default function Navbar({
  activeTab,
  onSelectTab,
  user,
  advisorProfile,
  onOpenProfileModal,
  onRefreshData,
  isSyncing,
}: NavbarProps) {
  const navItems: { id: AppTab; label: string; icon: typeof Home }[] = [
    { id: 'home', label: 'Inicio', icon: Home },
    { id: 'catalog', label: 'Unidades', icon: BookOpen },
    { id: 'warranty', label: 'Garantías', icon: ShieldCheck },
    { id: 'training', label: 'Retos & Quiz', icon: Award },
    { id: 'runner', label: 'Moto Runner', icon: Gamepad2 },
    { id: 'admin', label: 'Admin', icon: Sliders },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-zinc-800 bg-[#231F20] text-white shadow-md">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <button onClick={() => onSelectTab('home')} className="flex items-center gap-3 text-left" aria-label="Ir al inicio">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#F28F17] font-display text-2xl font-extrabold text-[#231F20]">V&amp;P</div>
          <div>
            <h1 className="font-display text-xl font-bold uppercase leading-none tracking-wide text-white">Vento &amp; Pistón <span className="text-[#F28F17]">Academy</span></h1>
            <p className="text-[11px] text-zinc-400">Aprende · juega · avanza</p>
          </div>
        </button>

        <nav aria-label="Navegación principal" className="flex flex-wrap items-center gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                aria-current={active ? 'page' : undefined}
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-semibold transition sm:px-3 ${active ? 'bg-[#F28F17] text-[#231F20]' : 'text-zinc-300 hover:bg-zinc-800 hover:text-white'}`}
              >
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          <button
            onClick={onRefreshData}
            disabled={isSyncing}
            title="Sincronizar con Google Sheets"
            className="flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800/80 px-2.5 py-1.5 text-xs text-zinc-200 hover:border-[#F28F17] hover:text-white disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-[#F28F17] ${isSyncing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{isSyncing ? 'Sincronizando...' : 'Sincronizar'}</span>
          </button>
          <button onClick={onOpenProfileModal} className="flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs font-medium hover:border-[#F28F17]">
            <UserCircle className="h-4 w-4 text-[#F28F17]" />
            <div className="text-left">
              <div className="font-semibold text-white">{advisorProfile?.displayName || user?.displayName || 'Identificarme'}</div>
              {advisorProfile && <div className="font-mono text-[10px] text-[#F28F17]">{advisorProfile.totalPoints} pts</div>}
            </div>
          </button>
        </div>
      </div>
    </header>
  );
}
