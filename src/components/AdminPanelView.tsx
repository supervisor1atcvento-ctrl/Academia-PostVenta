import { useState } from 'react';
import { Database, Plus, Trash2, UploadCloud } from 'lucide-react';
import type {
  AdminQuizItem,
  BrandType,
  LocalUser,
  Motorcycle,
  SpecFieldConfig,
  TimeGuideEntry,
  WarrantyPolicy,
} from '../types';

interface AdminPanelViewProps {
  user: LocalUser | null;
  isAdmin: boolean;
  onOpenProfileModal: () => void;
  motorcycles: Motorcycle[];
  policies: WarrantyPolicy[];
  timeGuides: TimeGuideEntry[];
  specFields: SpecFieldConfig[];
  adminQuizItems: AdminQuizItem[];
  isCloudSeeded: boolean;
  onSyncSeedToCloud: () => Promise<void>;
  onSaveMotorcycle: (m: Motorcycle) => Promise<void>;
  onDeleteMotorcycle: (id: string) => Promise<void>;
  onSavePolicy: (p: WarrantyPolicy) => Promise<void>;
  onDeletePolicy: (id: string) => Promise<void>;
}

export default function AdminPanelView({
  user,
  isAdmin,
  onOpenProfileModal,
  motorcycles,
  policies,
  isCloudSeeded,
  onSyncSeedToCloud,
  onSaveMotorcycle,
  onDeleteMotorcycle,
  onSavePolicy,
  onDeletePolicy,
}: AdminPanelViewProps) {
  const [section, setSection] = useState<'motos' | 'policies'>('motos');
  const [syncingSeed, setSyncingSeed] = useState(false);

  const [model, setModel] = useState('');
  const [brand, setBrand] = useState<BrandType>('VENTO');
  const [family, setFamily] = useState('Trabajo');
  const [displacementCc, setDisplacementCc] = useState(150);
  const [powerHp, setPowerHp] = useState('12 HP');
  const [transmission, setTransmission] = useState('5 Velocidades');

  const [polTitle, setPolTitle] = useState('');
  const [polSummary, setPolSummary] = useState('');
  const [polRule, setPolRule] = useState('');

  if (!user || !isAdmin) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm">
        <Database className="mx-auto h-12 w-12 text-[#F28F17]" />
        <h2 className="mt-3 font-display text-3xl font-extrabold text-[#231F20]">
          Acceso Restringido · Panel Google Sheets
        </h2>
        <p className="mt-1 text-sm text-zinc-600">
          Inicia sesión con el correo administrador configurado para editar la base de datos.
        </p>
        <button
          onClick={onOpenProfileModal}
          className="mt-4 rounded-xl bg-[#231F20] px-6 py-3 text-xs font-bold uppercase text-[#F28F17]"
        >
          Iniciar Sesión como Admin
        </button>
      </div>
    );
  }

  const handleSeed = async () => {
    setSyncingSeed(true);
    try {
      await onSyncSeedToCloud();
    } finally {
      setSyncingSeed(false);
    }
  };

  const handleAddMoto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!model.trim()) return;
    await onSaveMotorcycle({
      id: `moto_${Date.now()}`,
      brand,
      family,
      model,
      displacementCc: Number(displacementCc),
      engineType: '4 Tiempos Monocilíndrico',
      powerHp,
      transmission,
      cooling: 'Aire',
      brakes: 'Disco / Tambor',
      tankLiters: 12,
      topSpeedKmh: 100,
      breakInNotes: 'Primer servicio a los 500 km.',
      imageUrl: 'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?w=800',
      isActive: true,
      highlights: ['Garantía Oficial'],
    });
    setModel('');
  };

  const handleAddPolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!polTitle.trim()) return;
    await onSavePolicy({
      id: `pol_${Date.now()}`,
      brand,
      category: 'Cobertura',
      title: polTitle,
      summary: polSummary,
      keyRule: polRule,
      details: [polSummary],
      order: policies.length + 1,
      isActive: true,
    });
    setPolTitle('');
    setPolSummary('');
    setPolRule('');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-[#231F20] p-6 text-white">
        <div>
          <h2 className="font-display text-3xl font-extrabold uppercase">
            Administrador de Google Sheets
          </h2>
          <p className="text-xs text-zinc-400">
            Todos los cambios se escriben directamente en las pestañas de tu libro de Google Sheets.
          </p>
        </div>

        {!isCloudSeeded && (
          <button
            onClick={handleSeed}
            disabled={syncingSeed}
            className="flex items-center gap-2 rounded-xl bg-[#F28F17] px-4 py-2.5 text-xs font-extrabold uppercase text-[#231F20]"
          >
            <UploadCloud className="h-4 w-4" />
            {syncingSeed ? 'Subiendo datos iniciales...' : 'Poblar Sheets con Datos Base'}
          </button>
        )}
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => setSection('motos')}
          className={`rounded-lg px-4 py-2 text-xs font-bold ${
            section === 'motos' ? 'bg-[#231F20] text-[#F28F17]' : 'bg-white text-zinc-700'
          }`}
        >
          Motocicletas ({motorcycles.length})
        </button>
        <button
          onClick={() => setSection('policies')}
          className={`rounded-lg px-4 py-2 text-xs font-bold ${
            section === 'policies' ? 'bg-[#231F20] text-[#F28F17]' : 'bg-white text-zinc-700'
          }`}
        >
          Pólizas ({policies.length})
        </button>
      </div>

      {section === 'motos' ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <form
            onSubmit={handleAddMoto}
            className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-5 text-xs"
          >
            <h3 className="font-display text-xl font-bold uppercase text-[#231F20]">
              Agregar Unidad a Sheets
            </h3>
            <select
              value={brand}
              onChange={(e) => setBrand(e.target.value as BrandType)}
              className="w-full rounded-lg border border-zinc-300 p-2"
            >
              <option value="VENTO">VENTO</option>
              <option value="AMERICAN PISTON">AMERICAN PISTON</option>
            </select>
            <input
              type="text"
              required
              placeholder="Modelo (Ej. Nitrox 250)"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 p-2"
            />
            <input
              type="text"
              placeholder="Familia (Ej. Deportiva)"
              value={family}
              onChange={(e) => setFamily(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 p-2"
            />
            <input
              type="number"
              placeholder="Cilindrada CC"
              value={displacementCc}
              onChange={(e) => setDisplacementCc(Number(e.target.value))}
              className="w-full rounded-lg border border-zinc-300 p-2"
            />
            <input
              type="text"
              placeholder="Potencia (Ej. 18 HP)"
              value={powerHp}
              onChange={(e) => setPowerHp(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 p-2"
            />
            <input
              type="text"
              placeholder="Transmisión"
              value={transmission}
              onChange={(e) => setTransmission(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 p-2"
            />
            <button
              type="submit"
              className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#F28F17] py-2.5 font-extrabold uppercase text-[#231F20]"
            >
              <Plus className="h-4 w-4" /> Guardar en Sheet
            </button>
          </form>

          <div className="space-y-2 rounded-2xl border border-zinc-200 bg-white p-5 lg:col-span-2">
            <h3 className="font-display text-xl font-bold uppercase text-[#231F20]">
              Unidades Registradas
            </h3>
            {motorcycles.map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between rounded-xl border border-zinc-200 p-3 text-xs"
              >
                <div>
                  <span className="font-bold text-[#F28F17]">{m.brand}</span> ·{' '}
                  <strong>{m.model}</strong> ({m.displacementCc} cc)
                </div>
                <button
                  onClick={() => onDeleteMotorcycle(m.id)}
                  className="rounded p-1.5 text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <form
            onSubmit={handleAddPolicy}
            className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-5 text-xs"
          >
            <h3 className="font-display text-xl font-bold uppercase text-[#231F20]">
              Nueva Póliza en Sheets
            </h3>
            <select
              value={brand}
              onChange={(e) => setBrand(e.target.value as BrandType)}
              className="w-full rounded-lg border border-zinc-300 p-2"
            >
              <option value="VENTO">VENTO</option>
              <option value="AMERICAN PISTON">AMERICAN PISTON</option>
            </select>
            <input
              type="text"
              required
              placeholder="Título de la póliza"
              value={polTitle}
              onChange={(e) => setPolTitle(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 p-2"
            />
            <textarea
              required
              placeholder="Resumen"
              value={polSummary}
              onChange={(e) => setPolSummary(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 p-2"
            />
            <input
              type="text"
              required
              placeholder="Regla clave"
              value={polRule}
              onChange={(e) => setPolRule(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 p-2"
            />
            <button
              type="submit"
              className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#F28F17] py-2.5 font-extrabold uppercase text-[#231F20]"
            >
              <Plus className="h-4 w-4" /> Guardar Póliza
            </button>
          </form>

          <div className="space-y-2 rounded-2xl border border-zinc-200 bg-white p-5 lg:col-span-2">
            {policies.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between rounded-xl border border-zinc-200 p-3 text-xs"
              >
                <div>
                  <span className="font-bold text-[#F28F17]">{p.brand}</span> ·{' '}
                  <strong>{p.title}</strong>
                </div>
                <button
                  onClick={() => onDeletePolicy(p.id)}
                  className="rounded p-1.5 text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
