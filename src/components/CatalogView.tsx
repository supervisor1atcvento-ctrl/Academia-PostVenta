import { useMemo, useState } from 'react';
import { ChevronRight, Search, X } from 'lucide-react';
import {
  getMotorcycleFieldValue,
  VENTO_FAMILIES_TABLE,
} from '../data/seedData';
import type { Brand, Motorcycle, SpecFieldConfig, SpecSection } from '../types';

interface CatalogViewProps {
  motorcycles: Motorcycle[];
  specFields: SpecFieldConfig[];
  onStartTrainingForTopic: () => void;
}

const SECTION_ORDER: SpecSection[] = [
  'Motor',
  'Transmisión',
  'Frenos y Suspensión',
  'Dimensiones y Capacidades',
  'Equipamiento y Tecnología',
  'Asentamiento y Garantía',
];

function MotoImage({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center bg-zinc-900 px-4 text-center text-zinc-400">
        <svg
          className="h-10 w-10 text-zinc-600"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <circle cx="5.5" cy="17.5" r="3.5" />
          <circle cx="18.5" cy="17.5" r="3.5" />
          <path d="M15 6h2l2 5m-7 6h5.5M5.5 17.5 9 11h4l2 6.5M9 11 7 6h3" />
        </svg>
        <span className="mt-2 text-xs font-medium text-zinc-400">{alt}</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
    />
  );
}

export default function CatalogView({
  motorcycles,
  specFields,
  onStartTrainingForTopic,
}: CatalogViewProps) {
  const [brandFilter, setBrandFilter] = useState<'TODAS' | Brand>('TODAS');
  const [familyFilter, setFamilyFilter] = useState<string>('TODAS');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMoto, setSelectedMoto] = useState<Motorcycle | null>(null);
  const [showFamiliesTable, setShowFamiliesTable] = useState(true);

  const visibleSpecFields = useMemo(
    () =>
      specFields
        .filter((f) => f.isVisible)
        .sort((a, b) => (a.order ?? 99) - (b.order ?? 99)),
    [specFields]
  );

  const groupedSelectedSpecs = useMemo(() => {
    if (!selectedMoto) return [];
    const unitHidden = new Set(selectedMoto.hiddenFields ?? []);
    const activeForUnit = visibleSpecFields.filter(
      (f) => !unitHidden.has(f.key)
    );

    return SECTION_ORDER.map((sectionName) => {
      const rows = activeForUnit
        .filter((f) => f.section === sectionName)
        .map((f) => ({
          key: f.key,
          label: f.label,
          value: getMotorcycleFieldValue(selectedMoto, f.key) || '—',
        }));
      return { section: sectionName, rows };
    }).filter((g) => g.rows.length > 0);
  }, [selectedMoto, visibleSpecFields]);

  const activeMotos = useMemo(
    () => motorcycles.filter((m) => m.isActive),
    [motorcycles]
  );

  const availableFamilies = useMemo(() => {
    const set = new Set<string>();
    activeMotos.forEach((m) => {
      if (brandFilter === 'TODAS' || m.brand === brandFilter) {
        set.add(m.family);
      }
    });
    return ['TODAS', ...Array.from(set)];
  }, [activeMotos, brandFilter]);

  const filteredMotos = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return activeMotos.filter((m) => {
      if (brandFilter !== 'TODAS' && m.brand !== brandFilter) return false;
      if (familyFilter !== 'TODAS' && m.family !== familyFilter) return false;
      if (!q) return true;
      return (
        m.model.toLowerCase().includes(q) ||
        m.family.toLowerCase().includes(q) ||
        m.brand.toLowerCase().includes(q) ||
        String(m.displacementCc).includes(q) ||
        m.engineType.toLowerCase().includes(q)
      );
    });
  }, [activeMotos, brandFilter, familyFilter, searchQuery]);

  return (
    <div className="space-y-10">
      {/* Hero Banner */}
      <section className="rounded-xl border border-zinc-200 bg-white p-6 sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl space-y-3">
            <p className="text-xs font-semibold tracking-wide text-[#EA580C]">
              Manual Técnico de Unidades · Vento Motocicletas &amp; American Pistón
            </p>
            <h1 className="font-display text-4xl font-bold tracking-tight text-zinc-950 sm:text-5xl text-balance">
              Domina cada familia, cilindrada y ficha técnica en minutos
            </h1>
            <p className="text-sm leading-relaxed text-zinc-600 sm:text-base">
              Consulta especificaciones vigentes, parámetros oficiales de asentamiento por familia y prepara tu equipo de asesores con evaluaciones rápidas.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setShowFamiliesTable((prev) => !prev)}
              className="rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-xs font-semibold text-zinc-800 hover:bg-zinc-50 whitespace-nowrap cursor-pointer transition-colors"
            >
              {showFamiliesTable ? 'Ocultar Tabla de Familias' : 'Ver Familias VENTO'}
            </button>
            <button
              type="button"
              onClick={onStartTrainingForTopic}
              className="rounded-lg bg-[#EA580C] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#C2410C] whitespace-nowrap cursor-pointer transition-colors"
            >
              Iniciar Quiz Rápido
            </button>
          </div>
        </div>

        {/* Summary strip */}
        <div className="mt-8 grid grid-cols-2 gap-4 border-t border-zinc-100 pt-6 sm:grid-cols-4">
          <div>
            <div className="font-mono text-2xl font-semibold text-zinc-950 tabular-nums">
              {activeMotos.length}
            </div>
            <div className="text-xs text-zinc-500">Unidades vigentes</div>
          </div>
          <div>
            <div className="font-mono text-2xl font-semibold text-zinc-950 tabular-nums">
              {VENTO_FAMILIES_TABLE.length}
            </div>
            <div className="text-xs text-zinc-500">Familias oficiales VENTO</div>
          </div>
          <div>
            <div className="font-mono text-2xl font-semibold text-zinc-950 tabular-nums">
              36 meses
            </div>
            <div className="text-xs text-zinc-500">Cobertura máx. VENTO / 33,000 km</div>
          </div>
          <div>
            <div className="font-mono text-2xl font-semibold text-zinc-950 tabular-nums">
              3 años
            </div>
            <div className="text-xs text-zinc-500">Cobertura Pistón / 30,000 km</div>
          </div>
        </div>
      </section>

      {/* Official VENTO Families Reference Table */}
      {showFamiliesTable && (
        <section className="rounded-xl border border-zinc-200 bg-white p-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-zinc-100 pb-4">
            <div>
              <h2 className="font-display text-2xl font-bold text-zinc-950">
                Familias VENTO y Tabla de Asentamiento (0 – 3,000 km)
              </h2>
              <p className="text-xs text-zinc-500">
                Haz clic en cualquier familia para filtrar el catálogo de unidades.
              </p>
            </div>
            <span className="font-mono text-xs text-zinc-500">
              Póliza Oficial VENTO 2025 · Pág. 6
            </span>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-200 text-zinc-500">
                  <th className="py-2.5 pr-4 font-semibold">Familia</th>
                  <th className="py-2.5 px-4 font-semibold">Cilindradas</th>
                  <th className="py-2.5 px-4 font-semibold">Periodo</th>
                  <th className="py-2.5 px-4 font-semibold">RPM Máx.</th>
                  <th className="py-2.5 pl-4 font-semibold">Velocidad Máx.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {VENTO_FAMILIES_TABLE.map((row) => {
                  const isSelected = familyFilter === row.family;
                  return (
                    <tr
                      key={row.family}
                      onClick={() => {
                        setBrandFilter('VENTO');
                        setFamilyFilter(isSelected ? 'TODAS' : row.family);
                      }}
                      className={`cursor-pointer transition-colors ${
                        isSelected ? 'bg-[#EA580C]/8' : 'hover:bg-zinc-50'
                      }`}
                    >
                      <td className="py-2.5 pr-4 font-semibold text-zinc-950 whitespace-nowrap">
                        {row.family}
                      </td>
                      <td className="py-2.5 px-4 font-mono text-zinc-700 tabular-nums">
                        {row.displacements}
                      </td>
                      <td className="py-2.5 px-4 font-mono text-zinc-700 tabular-nums whitespace-nowrap">
                        {row.breakInPeriod}
                      </td>
                      <td className="py-2.5 px-4 font-mono text-zinc-700 tabular-nums whitespace-nowrap">
                        {row.maxRpm}
                      </td>
                      <td className="py-2.5 pl-4 font-mono text-zinc-700 tabular-nums whitespace-nowrap">
                        {row.maxSpeed}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Filter & Search Toolbar */}
      <section className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            {/* Brand segmented control */}
            <div className="inline-flex items-center rounded-lg border border-zinc-200 bg-white p-1">
              {(['TODAS', 'VENTO', 'AMERICAN PISTON'] as const).map((brand) => (
                <button
                  key={brand}
                  type="button"
                  onClick={() => {
                    setBrandFilter(brand);
                    setFamilyFilter('TODAS');
                  }}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                    brandFilter === brand
                      ? brand === 'AMERICAN PISTON'
                        ? 'bg-[#DC2626] text-white'
                        : 'bg-zinc-950 text-white'
                      : 'text-zinc-600 hover:text-zinc-950'
                  }`}
                >
                  {brand === 'TODAS' ? 'Todas las marcas' : brand}
                </button>
              ))}
            </div>

            {/* Family selector */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              {availableFamilies.map((fam) => (
                <button
                  key={fam}
                  type="button"
                  onClick={() => setFamilyFilter(fam)}
                  className={`rounded-md border px-2.5 py-1.5 text-xs font-medium whitespace-nowrap cursor-pointer transition-colors ${
                    familyFilter === fam
                      ? 'border-[#EA580C] bg-[#EA580C]/10 text-[#C2410C] font-semibold'
                      : 'border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:text-zinc-900'
                  }`}
                >
                  {fam === 'TODAS' ? 'Todas las familias' : fam}
                </button>
              ))}
            </div>
          </div>

          {/* Search input */}
          <div className="relative w-full md:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar modelo, cc o motor..."
              className="w-full rounded-lg border border-zinc-200 bg-white py-2 pl-9 pr-3 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-[#EA580C] focus:outline-none focus:ring-2 focus:ring-[#EA580C]/20"
            />
          </div>
        </div>

        {/* Motorcycles Grid */}
        {filteredMotos.length === 0 ? (
          <div className="rounded-xl border border-zinc-200 bg-white p-12 text-center">
            <p className="font-display text-xl font-semibold text-zinc-900">
              No se encontraron unidades vigentes con ese filtro
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              Prueba seleccionando otra familia o limpiando la búsqueda.
            </p>
            <button
              type="button"
              onClick={() => {
                setBrandFilter('TODAS');
                setFamilyFilter('TODAS');
                setSearchQuery('');
              }}
              className="mt-4 rounded-lg bg-zinc-950 px-4 py-2 text-xs font-semibold text-white hover:bg-zinc-800 cursor-pointer"
            >
              Mostrar todo el catálogo
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filteredMotos.map((moto) => (
              <article
                key={moto.id}
                onClick={() => setSelectedMoto(moto)}
                className="group flex flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white transition-colors hover:border-zinc-300 cursor-pointer"
              >
                <div className="aspect-[4/3] w-full overflow-hidden bg-zinc-900">
                  <MotoImage src={moto.imageUrl} alt={`${moto.brand} ${moto.model}`} />
                </div>

                <div className="flex flex-1 flex-col justify-between p-5">
                  <div>
                    {/* Zero-pill metadata line */}
                    <div className="flex items-center gap-2 text-xs text-zinc-500">
                      <span
                        className={`font-semibold ${
                          moto.brand === 'AMERICAN PISTON'
                            ? 'text-[#DC2626]'
                            : 'text-[#EA580C]'
                        }`}
                      >
                        {moto.brand}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{moto.family}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">
                        {moto.displacementCc} cc
                      </span>
                    </div>

                    <h3 className="mt-1.5 font-display text-2xl font-bold tracking-tight text-zinc-950">
                      {moto.model}
                    </h3>

                    <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-zinc-600">
                      {moto.engineType} · {moto.transmission}
                    </p>
                  </div>

                  <div className="mt-5 flex items-center justify-between border-t border-zinc-100 pt-3.5 text-xs">
                    <div className="flex items-center gap-4 font-mono text-zinc-700 tabular-nums">
                      <span>{moto.powerHp}</span>
                      <span className="text-zinc-300">/</span>
                      <span>{moto.topSpeedKmh} km/h</span>
                    </div>
                    <span className="inline-flex items-center gap-1 font-semibold text-zinc-900 group-hover:text-[#EA580C] transition-colors">
                      Ficha técnica
                      <ChevronRight className="h-3.5 w-3.5" />
                    </span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* Motorcycle Detail Modal — Official Vento Datasheet Style */}
      {selectedMoto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/65 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-labelledby="moto-detail-title"
          onClick={() => setSelectedMoto(null)}
        >
          <div
            className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-xl border border-zinc-200 bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Vento-Style Dark Header + Studio Showcase */}
            <div className="grid grid-cols-1 border-b border-zinc-200 bg-zinc-950 text-white md:grid-cols-12">
              <div className="aspect-[4/3] w-full overflow-hidden bg-zinc-900 md:col-span-5 md:aspect-auto md:min-h-[250px]">
                <MotoImage
                  src={selectedMoto.imageUrl}
                  alt={`${selectedMoto.brand} ${selectedMoto.model}`}
                />
              </div>

              <div className="flex flex-col justify-between p-6 md:col-span-7">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 text-xs text-zinc-400">
                      <span
                        className={`font-semibold ${
                          selectedMoto.brand === 'AMERICAN PISTON'
                            ? 'text-red-400'
                            : 'text-[#FB923C]'
                        }`}
                      >
                        {selectedMoto.brand}
                      </span>
                      <span>·</span>
                      <span>{selectedMoto.family}</span>
                      <span>·</span>
                      <span>Ficha Técnica Oficial</span>
                    </div>
                    <h2
                      id="moto-detail-title"
                      className="mt-1 font-display text-3xl font-bold tracking-tight text-white sm:text-4xl"
                    >
                      {selectedMoto.model}
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedMoto(null)}
                    aria-label="Cerrar ficha técnica"
                    className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white cursor-pointer"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                {/* Key Telemetry Strip (Vento website hero stats) */}
                {(() => {
                  const unitHidden = new Set(selectedMoto.hiddenFields ?? []);
                  const visibleKeys = new Set(visibleSpecFields.map((f) => f.key));
                  const heroMetrics = [
                    {
                      key: 'displacementCc',
                      label: 'Cilindrada',
                      value: `${selectedMoto.displacementCc} cc`,
                      accent: false,
                    },
                    {
                      key: 'powerHp',
                      label: 'Potencia',
                      value: selectedMoto.powerHp,
                      accent: true,
                    },
                    {
                      key: 'topSpeedKmh',
                      label: 'Vel. Máx.',
                      value: `${selectedMoto.topSpeedKmh} km/h`,
                      accent: false,
                    },
                    {
                      key: 'tankLiters',
                      label: 'Tanque',
                      value: selectedMoto.tankLiters,
                      accent: false,
                    },
                  ].filter(
                    (m) => visibleKeys.has(m.key) && !unitHidden.has(m.key)
                  );
                  if (heroMetrics.length === 0) return null;
                  return (
                    <div className="mt-5 grid grid-cols-2 gap-3 border-t border-zinc-800 pt-4 sm:grid-cols-4">
                      {heroMetrics.map((m) => (
                        <div key={m.key}>
                          <div className="text-[11px] text-zinc-400">
                            {m.label}
                          </div>
                          <div
                            className={`font-mono text-base font-bold tabular-nums ${
                              m.accent ? 'text-[#FB923C]' : 'text-white'
                            }`}
                          >
                            {m.value}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Grouped Vento Datasheet Sections */}
            <div className="p-6">
              {groupedSelectedSpecs.length === 0 ? (
                <p className="py-6 text-center text-xs text-zinc-500">
                  Todos los campos de esta ficha técnica están ocultos por configuración de administración.
                </p>
              ) : (
                <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                  {groupedSelectedSpecs.map((group) => (
                    <div
                      key={group.section}
                      className="overflow-hidden rounded-lg border border-zinc-200 bg-white"
                    >
                      <div className="flex items-center justify-between border-b border-zinc-200 bg-zinc-900 px-4 py-2.5">
                        <h3 className="font-display text-sm font-bold tracking-wide text-white uppercase">
                          {group.section}
                        </h3>
                        <span className="h-1.5 w-6 rounded-xs bg-[#EA580C]" />
                      </div>
                      <dl className="divide-y divide-zinc-100 text-xs">
                        {group.rows.map((row, idx) => (
                          <div
                            key={row.key}
                            className={`flex items-start justify-between gap-4 px-4 py-2.5 ${
                              idx % 2 === 1 ? 'bg-zinc-50/70' : 'bg-white'
                            }`}
                          >
                            <dt className="font-medium text-zinc-500">
                              {row.label}
                            </dt>
                            <dd className="text-right font-semibold text-zinc-950">
                              {row.value}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-6 flex items-center justify-end gap-3 border-t border-zinc-100 pt-4">
                <button
                  type="button"
                  onClick={() => setSelectedMoto(null)}
                  className="rounded-lg border border-zinc-300 px-4 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 cursor-pointer"
                >
                  Cerrar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedMoto(null);
                    onStartTrainingForTopic();
                  }}
                  className="rounded-lg bg-[#EA580C] px-4 py-2 text-xs font-semibold text-white hover:bg-[#C2410C] cursor-pointer"
                >
                  Evaluarme en Specs
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
