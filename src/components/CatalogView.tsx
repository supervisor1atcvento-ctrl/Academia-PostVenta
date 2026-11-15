import { useMemo, useState } from 'react';
import { Award, CheckCircle2, Gauge, Search, Wrench } from 'lucide-react';
import type { BrandType, Motorcycle, SpecFieldConfig } from '../types';

interface CatalogViewProps {
  motorcycles: Motorcycle[];
  specFields: SpecFieldConfig[];
  onStartTrainingForTopic: () => void;
}

export default function CatalogView({
  motorcycles,
  specFields,
  onStartTrainingForTopic,
}: CatalogViewProps) {
  const [brandFilter, setBrandFilter] = useState<'ALL' | BrandType>('ALL');
  const [familyFilter, setFamilyFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMoto, setSelectedMoto] = useState<Motorcycle | null>(null);

  const families = useMemo(() => {
    const set = new Set(motorcycles.map((m) => m.family));
    return ['ALL', ...Array.from(set)];
  }, [motorcycles]);

  const filteredMotos = useMemo(() => {
    return motorcycles.filter((m) => {
      if (brandFilter !== 'ALL' && m.brand !== brandFilter) return false;
      if (familyFilter !== 'ALL' && m.family !== familyFilter) return false;
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchModel = m.model.toLowerCase().includes(q);
        const matchCc = String(m.displacementCc).includes(q);
        const matchFamily = m.family.toLowerCase().includes(q);
        if (!matchModel && !matchCc && !matchFamily) return false;
      }
      return true;
    });
  }, [motorcycles, brandFilter, familyFilter, searchTerm]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 rounded-2xl bg-[#231F20] p-6 text-white sm:flex-row sm:items-center">
        <div>
          <span className="inline-block rounded bg-[#F28F17] px-2 py-0.5 text-[11px] font-bold uppercase text-[#231F20]">
            Fichas Técnicas Oficiales
          </span>
          <h2 className="mt-1 font-display text-3xl font-extrabold uppercase tracking-tight">
            Catálogo de Unidades VENTO &amp; American Pistón
          </h2>
          <p className="text-sm text-zinc-300">
            Consulta especificaciones técnicas, notas de asentamiento y argumentario de venta.
          </p>
        </div>
        <button
          onClick={onStartTrainingForTopic}
          className="flex items-center justify-center gap-2 rounded-xl bg-[#F28F17] px-5 py-3 text-sm font-bold text-[#231F20] transition hover:bg-[#e07d0a]"
        >
          <Award className="h-5 w-5" />
          Evaluar Conocimiento
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 rounded-xl border border-zinc-200 bg-white p-4 sm:grid-cols-4">
        <div className="relative sm:col-span-2">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
          <input
            type="text"
            placeholder="Buscar modelo, cilindrada (ej. 250) o familia..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-lg border border-zinc-300 py-2 pl-9 pr-3 text-sm focus:border-[#F28F17] focus:outline-none"
          />
        </div>

        <select
          value={brandFilter}
          onChange={(e) => setBrandFilter(e.target.value as any)}
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium focus:border-[#F28F17] focus:outline-none"
        >
          <option value="ALL">Todas las Marcas</option>
          <option value="VENTO">VENTO Motorcycles</option>
          <option value="AMERICAN PISTON">American Pistón</option>
        </select>

        <select
          value={familyFilter}
          onChange={(e) => setFamilyFilter(e.target.value)}
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium focus:border-[#F28F17] focus:outline-none"
        >
          {families.map((fam) => (
            <option key={fam} value={fam}>
              {fam === 'ALL' ? 'Todas las Familias' : fam}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {filteredMotos.map((moto) => (
          <div
            key={moto.id}
            className="flex flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm transition hover:shadow-md"
          >
            <div className="relative h-48 bg-zinc-900">
              <img
                src={moto.imageUrl || 'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?w=600'}
                alt={moto.model}
                className="h-full w-full object-cover opacity-90"
              />
              <span
                className={`absolute left-3 top-3 rounded-md px-2.5 py-1 text-[11px] font-bold uppercase ${
                  moto.brand === 'VENTO'
                    ? 'bg-[#F28F17] text-[#231F20]'
                    : 'bg-[#231F20] text-white border border-zinc-700'
                }`}
              >
                {moto.brand}
              </span>
              <span className="absolute bottom-3 right-3 rounded bg-black/80 px-2 py-0.5 font-mono text-xs font-semibold text-white">
                {moto.displacementCc} CC
              </span>
            </div>

            <div className="flex flex-1 flex-col p-5">
              <div className="text-xs font-semibold uppercase tracking-wider text-[#F28F17]">
                {moto.family}
              </div>
              <h3 className="font-display text-2xl font-bold text-[#231F20]">{moto.model}</h3>

              <div className="mt-3 grid grid-cols-2 gap-2 rounded-lg bg-zinc-50 p-3 text-xs">
                <div>
                  <span className="text-zinc-500">Potencia:</span>
                  <div className="font-semibold text-zinc-900">{moto.powerHp}</div>
                </div>
                <div>
                  <span className="text-zinc-500">Vel. Máx:</span>
                  <div className="font-mono font-semibold text-zinc-900">{moto.topSpeedKmh} km/h</div>
                </div>
                <div>
                  <span className="text-zinc-500">Transmisión:</span>
                  <div className="font-semibold text-zinc-900">{moto.transmission}</div>
                </div>
                <div>
                  <span className="text-zinc-500">Tanque:</span>
                  <div className="font-mono font-semibold text-zinc-900">{moto.tankLiters} L</div>
                </div>
              </div>

              {moto.highlights?.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {moto.highlights.map((h, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2.5 py-0.5 text-[11px] font-medium text-orange-800"
                    >
                      <CheckCircle2 className="h-3 w-3 text-[#F28F17]" />
                      {h}
                    </span>
                  ))}
                </div>
              )}

              <button
                onClick={() => setSelectedMoto(moto)}
                className="mt-5 w-full rounded-xl bg-[#231F20] py-2.5 text-xs font-bold uppercase tracking-wider text-white transition hover:bg-[#F28F17] hover:text-[#231F20]"
              >
                Ver Ficha Técnica Completa
              </button>
            </div>
          </div>
        ))}
      </div>

      {selectedMoto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between border-b border-zinc-200 pb-4">
              <div>
                <span className="rounded bg-[#F28F17] px-2 py-0.5 text-xs font-bold text-[#231F20]">
                  {selectedMoto.brand} · {selectedMoto.family}
                </span>
                <h3 className="mt-1 font-display text-3xl font-extrabold text-[#231F20]">
                  {selectedMoto.model} ({selectedMoto.displacementCc} cc)
                </h3>
              </div>
              <button
                onClick={() => setSelectedMoto(null)}
                className="rounded-lg bg-zinc-100 px-3 py-1.5 text-sm font-bold text-zinc-700 hover:bg-zinc-200"
              >
                Cerrar ✕
              </button>
            </div>

            <div className="mt-4 space-y-4 text-sm">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {specFields
                  .filter((sf) => !selectedMoto.hiddenFields?.includes(sf.key))
                  .map((sf) => {
                    const value =
                      (selectedMoto as any)[sf.key] ??
                      selectedMoto.customSpecs?.[sf.key] ??
                      'N/A';
                    return (
                      <div key={sf.id} className="rounded-lg border border-zinc-200 p-3">
                        <div className="text-xs text-zinc-500">{sf.label}</div>
                        <div className="font-semibold text-zinc-900">{String(value)}</div>
                      </div>
                    );
                  })}
              </div>

              {selectedMoto.customSpecs && Object.keys(selectedMoto.customSpecs).length > 0 && (
                <div className="rounded-xl bg-zinc-50 p-4">
                  <h4 className="flex items-center gap-1.5 font-bold text-[#231F20]">
                    <Gauge className="h-4 w-4 text-[#F28F17]" /> Especificaciones Adicionales
                  </h4>
                  <dl className="mt-2 grid grid-cols-2 gap-2 text-xs">
                    {Object.entries(selectedMoto.customSpecs).map(([k, v]) => (
                      <div key={k}>
                        <dt className="uppercase text-zinc-500">{k}</dt>
                        <dd className="font-semibold text-zinc-900">{v}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              )}

              <div className="rounded-xl border border-orange-200 bg-orange-50 p-4">
                <h4 className="flex items-center gap-1.5 font-bold text-orange-900">
                  <Wrench className="h-4 w-4 text-[#F28F17]" /> Notas de Asentamiento y Servicio
                </h4>
                <p className="mt-1 text-xs text-orange-950">{selectedMoto.breakInNotes}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
