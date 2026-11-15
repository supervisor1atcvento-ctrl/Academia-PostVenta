import { Fragment, useMemo, useState } from 'react';
import { ExternalLink, Search } from 'lucide-react';
import {
  PISTON_SERVICE_SCHEDULE,
  VENTO_SERVICE_SCHEDULE,
} from '../data/seedData';
import type { TimeGuideEntry, WarrantyPolicy } from '../types';

interface WarrantyGuideViewProps {
  policies: WarrantyPolicy[];
  timeGuides: TimeGuideEntry[];
}

type WarrantySubTab = 'vento' | 'piston' | 'timeguide' | 'compare';

export default function WarrantyGuideView({
  policies,
  timeGuides,
}: WarrantyGuideViewProps) {
  const [subTab, setSubTab] = useState<WarrantySubTab>('vento');
  const [sectionFilter, setSectionFilter] = useState<'TODAS' | 'VC' | 'VM'>('TODAS');
  const [guideSearch, setGuideSearch] = useState('');
  const [expandedGuideId, setExpandedGuideId] = useState<string | null>(null);

  const activePolicies = useMemo(
    () =>
      policies
        .filter((p) => p.isActive)
        .sort((a, b) => a.order - b.order),
    [policies]
  );

  const ventoPolicies = useMemo(
    () => activePolicies.filter((p) => p.brand === 'VENTO'),
    [activePolicies]
  );

  const pistonPolicies = useMemo(
    () => activePolicies.filter((p) => p.brand === 'AMERICAN PISTON'),
    [activePolicies]
  );

  const activeGuides = useMemo(() => {
    const q = guideSearch.trim().toLowerCase();
    return timeGuides
      .filter((g) => g.isActive)
      .filter((g) => sectionFilter === 'TODAS' || g.section === sectionFilter)
      .filter((g) => {
        if (!q) return true;
        return (
          g.code.toLowerCase().includes(q) ||
          g.component.toLowerCase().includes(q) ||
          g.notes.toLowerCase().includes(q) ||
          g.accessories.some((a) => a.toLowerCase().includes(q))
        );
      })
      .sort((a, b) => a.code.localeCompare(b.code));
  }, [timeGuides, sectionFilter, guideSearch]);

  return (
    <div className="space-y-8">
      {/* Header & Sub-navigation */}
      <section className="rounded-xl border border-zinc-200 bg-white p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <h1 className="font-display text-3xl font-bold tracking-tight text-zinc-950 sm:text-4xl text-balance">
              Pólizas de Garantía y Guía de Tiempos 2025
            </h1>
            <p className="mt-1.5 text-sm text-zinc-600">
              Consulta reglas vigentes de Vento Motocicletas, American Pistón y los tiempos oficiales por componente (VC Carrocería y VM Motor).
            </p>
          </div>

          <div className="inline-flex flex-wrap items-center gap-1 rounded-lg border border-zinc-200 bg-zinc-50 p-1">
            {(
              [
                { id: 'vento', label: 'Póliza VENTO 2025' },
                { id: 'piston', label: 'Póliza American Pistón' },
                { id: 'timeguide', label: 'Guía de Tiempos VC/VM' },
                { id: 'compare', label: 'Comparador Rápido' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSubTab(tab.id)}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                  subTab === tab.id
                    ? 'bg-zinc-950 text-white'
                    : 'text-zinc-600 hover:text-zinc-950'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* VENTO 2025 Policy View */}
      {subTab === 'vento' && (
        <div className="space-y-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs font-medium text-zinc-500">
              Documento base: Póliza de Garantía VENTO 2025 (V11) · MOTOTRANSP, S.A.
            </p>
            <a
              href="/assets/aistudio/PolizaDeGarantiaVento2025_3f57d1ad.pdf"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#EA580C] hover:underline"
            >
              Ver PDF original VENTO 2025
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            {ventoPolicies.map((policy) => (
              <article
                key={policy.id}
                className="flex flex-col justify-between rounded-xl border border-zinc-200 bg-white p-6"
              >
                <div>
                  <div className="text-xs text-zinc-500">
                    <span className="font-semibold text-[#EA580C]">VENTO</span>
                    <span className="mx-2">·</span>
                    <span>{policy.category}</span>
                  </div>
                  <h2 className="mt-1.5 font-display text-2xl font-bold text-zinc-950">
                    {policy.title}
                  </h2>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-600">
                    {policy.summary}
                  </p>
                  <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 font-mono text-xs font-medium text-zinc-900">
                    {policy.keyRule}
                  </div>
                </div>

                <ul className="mt-4 space-y-2 border-t border-zinc-100 pt-4 text-xs text-zinc-700">
                  {policy.details.map((item, idx) => (
                    <li key={idx} className="leading-relaxed">
                      · {item}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>

          {/* 13 Services Table */}
          <section className="rounded-xl border border-zinc-200 bg-white p-6">
            <h3 className="font-display text-2xl font-bold text-zinc-950">
              Tabla de 13 Servicios Preventivos Obligatorios VENTO
            </h3>
            <p className="mt-1 text-xs text-zinc-500">
              Lo que ocurra primero (kilometraje o tiempo) en Centros de Servicio VENTO (CESVE). Omitir cualquier servicio anula la garantía.
            </p>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-zinc-200 text-zinc-500">
                    <th className="py-2.5 pr-4 font-semibold">Servicio</th>
                    <th className="py-2.5 px-4 font-semibold">Antes de (Km)</th>
                    <th className="py-2.5 px-4 font-semibold">O antes de (Tiempo)</th>
                    <th className="py-2.5 pl-4 font-semibold">Notas técnicas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {VENTO_SERVICE_SCHEDULE.map((row) => (
                    <tr key={row.service} className="hover:bg-zinc-50">
                      <td className="py-2.5 pr-4 font-semibold text-zinc-950 whitespace-nowrap">
                        {row.service}
                      </td>
                      <td className="py-2.5 px-4 font-mono text-zinc-800 tabular-nums whitespace-nowrap">
                        {row.km}
                      </td>
                      <td className="py-2.5 px-4 font-mono text-zinc-700 tabular-nums whitespace-nowrap">
                        {row.time}
                      </td>
                      <td className="py-2.5 pl-4 text-zinc-600">{row.notes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {/* AMERICAN PISTON Policy View */}
      {subTab === 'piston' && (
        <div className="space-y-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs font-medium text-zinc-500">
              Documento base: Póliza de Garantía American Pistón · MOTOTRANSP, S.A. · Tel. 55 5029 6960
            </p>
            <a
              href="/assets/aistudio/_Po_liza_de_Garantia_American_Pisto_n_af721d31.pdf"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#DC2626] hover:underline"
            >
              Ver PDF original American Pistón
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            {pistonPolicies.map((policy) => (
              <article
                key={policy.id}
                className="flex flex-col justify-between rounded-xl border border-zinc-200 bg-white p-6"
              >
                <div>
                  <div className="text-xs text-zinc-500">
                    <span className="font-semibold text-[#DC2626]">
                      AMERICAN PISTÓN
                    </span>
                    <span className="mx-2">·</span>
                    <span>{policy.category}</span>
                  </div>
                  <h2 className="mt-1.5 font-display text-2xl font-bold text-zinc-950">
                    {policy.title}
                  </h2>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-600">
                    {policy.summary}
                  </p>
                  <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 font-mono text-xs font-medium text-zinc-900">
                    {policy.keyRule}
                  </div>
                </div>

                <ul className="mt-4 space-y-2 border-t border-zinc-100 pt-4 text-xs text-zinc-700">
                  {policy.details.map((item, idx) => (
                    <li key={idx} className="leading-relaxed">
                      · {item}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>

          {/* 6 Services Table American Piston */}
          <section className="rounded-xl border border-zinc-200 bg-white p-6">
            <h3 className="font-display text-2xl font-bold text-zinc-950">
              Tabla de 6 Servicios Preventivos American Pistón
            </h3>
            <p className="mt-1 text-xs text-zinc-500">
              Cobertura por 3 años o 30,000 kilómetros (lo que ocurra primero). Cadena cada 1,000 km y ajuste de válvulas cada 42,000 km.
            </p>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-zinc-200 text-zinc-500">
                    <th className="py-2.5 pr-4 font-semibold">Servicio</th>
                    <th className="py-2.5 px-4 font-semibold">Antes de</th>
                    <th className="py-2.5 px-4 font-semibold">Criterio</th>
                    <th className="py-2.5 pl-4 font-semibold">Actividades clave</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {PISTON_SERVICE_SCHEDULE.map((row) => (
                    <tr key={row.service} className="hover:bg-zinc-50">
                      <td className="py-2.5 pr-4 font-semibold text-zinc-950 whitespace-nowrap">
                        {row.service}
                      </td>
                      <td className="py-2.5 px-4 font-mono text-zinc-800 tabular-nums whitespace-nowrap">
                        {row.km}
                      </td>
                      <td className="py-2.5 px-4 text-zinc-600 whitespace-nowrap">
                        {row.time}
                      </td>
                      <td className="py-2.5 pl-4 text-zinc-700">{row.notes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {/* TIME GUIDE VC / VM View */}
      {subTab === 'timeguide' && (
        <div className="space-y-6">
          <div className="flex flex-col gap-4 rounded-xl border border-zinc-200 bg-white p-5 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap items-center gap-3">
              <div className="inline-flex rounded-lg border border-zinc-200 bg-zinc-50 p-1">
                {(
                  [
                    { id: 'TODAS', label: `Todas (${timeGuides.filter((g) => g.isActive).length})` },
                    { id: 'VC', label: 'VC · Carrocería' },
                    { id: 'VM', label: 'VM · Motor' },
                  ] as const
                ).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSectionFilter(item.id)}
                    className={`rounded-md px-3 py-1.5 text-xs font-semibold whitespace-nowrap cursor-pointer ${
                      sectionFilter === item.id
                        ? 'bg-[#EA580C] text-white'
                        : 'text-zinc-600 hover:text-zinc-950'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <a
                href="/assets/aistudio/GU_A_DE_TIEMPOS_DE_GARANT_A_VERSI_N_1_2025_422a1f67.pdf"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-700 hover:text-[#EA580C]"
              >
                PDF Guía de Tiempos 2025
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>

            <div className="relative w-full md:w-80">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                value={guideSearch}
                onChange={(e) => setGuideSearch(e.target.value)}
                placeholder="Buscar código (VC10, VM03), pieza o accesorio..."
                className="w-full rounded-lg border border-zinc-200 bg-white py-2 pl-9 pr-3 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-[#EA580C] focus:outline-none focus:ring-2 focus:ring-[#EA580C]/20"
              />
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-950 text-white">
                    <th className="py-3 pl-5 pr-3 font-semibold">Código</th>
                    <th className="py-3 px-3 font-semibold">Componente / Sección</th>
                    <th className="py-3 px-3 font-semibold">Cuatrimotos</th>
                    <th className="py-3 px-3 font-semibold">Motonetas</th>
                    <th className="py-3 px-3 font-semibold">Motocicletas</th>
                    <th className="py-3 pl-3 pr-5 font-semibold text-right">Accesorios</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {activeGuides.map((entry) => {
                    const isOpen = expandedGuideId === entry.id;
                    return (
                      <Fragment key={entry.id}>
                        <tr
                          onClick={() =>
                            setExpandedGuideId(isOpen ? null : entry.id)
                          }
                          className="cursor-pointer hover:bg-zinc-50 transition-colors"
                        >
                          <td className="py-3 pl-5 pr-3 font-mono font-semibold text-[#EA580C] whitespace-nowrap">
                            {entry.code}
                          </td>
                          <td className="py-3 px-3 font-semibold text-zinc-950">
                            {entry.component}
                          </td>
                          <td className="py-3 px-3 text-zinc-700">
                            {entry.cuatrimotosTime}
                          </td>
                          <td className="py-3 px-3 text-zinc-700">
                            {entry.motonetasTime}
                          </td>
                          <td className="py-3 px-3 text-zinc-700">
                            {entry.motocicletasTime}
                          </td>
                          <td className="py-3 pl-3 pr-5 text-right font-mono text-zinc-500 tabular-nums whitespace-nowrap">
                            {entry.accessories.length} piezas
                          </td>
                        </tr>
                        {isOpen && (
                          <tr className="bg-zinc-50/80">
                            <td colSpan={6} className="px-5 py-4">
                              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                <div>
                                  <div className="text-[11px] font-semibold text-zinc-500">
                                    Accesorios y despiece incluido
                                  </div>
                                  <p className="mt-1 text-xs leading-relaxed text-zinc-800">
                                    {entry.accessories.length > 0
                                      ? entry.accessories.join(' · ')
                                      : 'Sin accesorios listados.'}
                                  </p>
                                </div>
                                <div>
                                  <div className="text-[11px] font-semibold text-zinc-500">
                                    Regla operativa / Notas de soporte
                                  </div>
                                  <p className="mt-1 text-xs leading-relaxed text-zinc-700">
                                    {entry.notes || 'Sometido a valoración técnica.'}
                                  </p>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {activeGuides.length === 0 && (
              <div className="p-8 text-center text-xs text-zinc-500">
                No hay componentes que coincidan con tu búsqueda.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Quick Side-by-Side Comparison */}
      {subTab === 'compare' && (
        <section className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
          <div className="border-b border-zinc-200 p-6">
            <h2 className="font-display text-2xl font-bold text-zinc-950">
              Comparador Operativo: VENTO vs. AMERICAN PISTÓN
            </h2>
            <p className="mt-1 text-xs text-zinc-500">
              Diferencias críticas que todo asesor debe dominar al atender clientes y centros de servicio.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50 text-zinc-600">
                  <th className="py-3 pl-6 pr-4 font-semibold">Criterio</th>
                  <th className="py-3 px-4 font-semibold text-[#EA580C]">
                    VENTO Motocicletas (2025)
                  </th>
                  <th className="py-3 pl-4 pr-6 font-semibold text-[#DC2626]">
                    AMERICAN PISTÓN
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                <tr>
                  <td className="py-3.5 pl-6 pr-4 font-semibold text-zinc-900">
                    Vigencia máxima de garantía
                  </td>
                  <td className="py-3.5 px-4 font-mono text-zinc-800">
                    36 meses o 33,000 km (lo que ocurra primero)
                  </td>
                  <td className="py-3.5 pl-4 pr-6 font-mono text-zinc-800">
                    3 años o 30,000 km (lo que ocurra primero)
                  </td>
                </tr>
                <tr>
                  <td className="py-3.5 pl-6 pr-4 font-semibold text-zinc-900">
                    Defecto de ensamble / mano de obra
                  </td>
                  <td className="py-3.5 px-4 text-zinc-700">
                    30 días siguientes a la entrega
                  </td>
                  <td className="py-3.5 pl-4 pr-6 text-zinc-700">
                    30 días siguientes a la entrega
                  </td>
                </tr>
                <tr>
                  <td className="py-3.5 pl-6 pr-4 font-semibold text-zinc-900">
                    Periodo de asentamiento
                  </td>
                  <td className="py-3.5 px-4 text-zinc-700">
                    0 – 3,000 km · Máx 5,000 RPM · 40-50 km/h (Cuatrimotos: 1/2 carrera)
                  </td>
                  <td className="py-3.5 pl-4 pr-6 text-zinc-700">
                    Primeros 1,000 km · Sin exceder 60% de capacidad del motor
                  </td>
                </tr>
                <tr>
                  <td className="py-3.5 pl-6 pr-4 font-semibold text-zinc-900">
                    Primer servicio obligatorio
                  </td>
                  <td className="py-3.5 px-4 font-mono text-zinc-800">
                    300 km o 30 días (1 mes)
                  </td>
                  <td className="py-3.5 pl-4 pr-6 font-mono text-zinc-800">
                    1,000 kilómetros
                  </td>
                </tr>
                <tr>
                  <td className="py-3.5 pl-6 pr-4 font-semibold text-zinc-900">
                    Total de servicios en póliza
                  </td>
                  <td className="py-3.5 px-4 font-mono text-zinc-800">
                    13 servicios (300 km hasta 33,000 km)
                  </td>
                  <td className="py-3.5 pl-4 pr-6 font-mono text-zinc-800">
                    6 servicios (1,000 km hasta 30,000 km)
                  </td>
                </tr>
                <tr>
                  <td className="py-3.5 pl-6 pr-4 font-semibold text-zinc-900">
                    Red de atención y contacto
                  </td>
                  <td className="py-3.5 px-4 text-zinc-700">
                    Red CESVE (+800) · WA 56 1414 1172 · ayuda.vento.com · Tel 55 2487 7141
                  </td>
                  <td className="py-3.5 pl-4 pr-6 text-zinc-700">
                    Taller Autorizado Pistón · Tel 55 5029 6960 (Buffon 41, CDMX)
                  </td>
                </tr>
                <tr>
                  <td className="py-3.5 pl-6 pr-4 font-semibold text-zinc-900">
                    Detalle en 10 Puntos de Seguridad
                  </td>
                  <td className="py-3.5 px-4 text-zinc-700">
                    Incluye Carburación (#6) y Ajustes generales (#8)
                  </td>
                  <td className="py-3.5 pl-4 pr-6 text-zinc-700">
                    Incluye Batería (#6) y Ajustes generales de Chicotes (#8)
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
