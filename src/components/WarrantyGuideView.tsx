import { useState } from 'react';
import { AlertTriangle, Clock, FileCheck, Search } from 'lucide-react';
import type { TimeGuideEntry, WarrantyPolicy } from '../types';

interface WarrantyGuideViewProps {
  policies: WarrantyPolicy[];
  timeGuides: TimeGuideEntry[];
}

export default function WarrantyGuideView({ policies, timeGuides }: WarrantyGuideViewProps) {
  const [subTab, setSubTab] = useState<'policies' | 'times'>('policies');
  const [searchTime, setSearchTime] = useState('');

  const filteredTimes = timeGuides.filter(
    (t) =>
      t.component.toLowerCase().includes(searchTime.toLowerCase()) ||
      t.code.toLowerCase().includes(searchTime.toLowerCase()) ||
      t.section.toLowerCase().includes(searchTime.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-[#231F20] p-6 text-white">
        <div>
          <h2 className="font-display text-3xl font-extrabold uppercase">
            Pólizas de Garantía &amp; Guía de Tiempos CESVE
          </h2>
          <p className="text-sm text-zinc-300">
            Criterios oficiales de dictaminación y tabulador de mano de obra.
          </p>
        </div>

        <div className="flex rounded-xl bg-zinc-800 p-1">
          <button
            onClick={() => setSubTab('policies')}
            className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold transition ${
              subTab === 'policies' ? 'bg-[#F28F17] text-[#231F20]' : 'text-zinc-300'
            }`}
          >
            <FileCheck className="h-4 w-4" /> Pólizas de Garantía
          </button>
          <button
            onClick={() => setSubTab('times')}
            className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold transition ${
              subTab === 'times' ? 'bg-[#F28F17] text-[#231F20]' : 'text-zinc-300'
            }`}
          >
            <Clock className="h-4 w-4" /> Guía de Tiempos
          </button>
        </div>
      </div>

      {subTab === 'policies' ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {policies
            .sort((a, b) => a.order - b.order)
            .map((pol) => (
              <div
                key={pol.id}
                className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <span className="rounded bg-[#231F20] px-2.5 py-1 text-xs font-bold text-[#F28F17]">
                    {pol.brand}
                  </span>
                  <span className="text-xs font-semibold text-zinc-500">{pol.category}</span>
                </div>

                <h3 className="mt-3 font-display text-2xl font-bold text-[#231F20]">{pol.title}</h3>
                <p className="mt-1 text-sm text-zinc-600">{pol.summary}</p>

                <div className="mt-4 flex items-start gap-2 rounded-xl border border-orange-200 bg-orange-50 p-3 text-xs text-orange-950">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-[#F28F17]" />
                  <div>
                    <strong className="font-bold">Regla Clave: </strong>
                    {pol.keyRule}
                  </div>
                </div>

                <ul className="mt-4 space-y-2 text-xs text-zinc-700">
                  {pol.details.map((d, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[#F28F17]" />
                      <span>{d}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
        </div>
      ) : (
        <div className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
            <input
              type="text"
              placeholder="Buscar por código, sección o componente..."
              value={searchTime}
              onChange={(e) => setSearchTime(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 py-2 pl-9 pr-3 text-sm focus:border-[#F28F17] focus:outline-none"
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-zinc-200 bg-[#231F20] text-white">
                <tr>
                  <th className="p-3">Código</th>
                  <th className="p-3">Sección</th>
                  <th className="p-3">Operación / Componente</th>
                  <th className="p-3">Motocicletas</th>
                  <th className="p-3">Motonetas</th>
                  <th className="p-3">Cuatrimotos</th>
                  <th className="p-3">Notas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {filteredTimes.map((t) => (
                  <tr key={t.id} className="hover:bg-zinc-50">
                    <td className="p-3 font-mono font-bold text-[#F28F17]">{t.code}</td>
                    <td className="p-3 font-semibold">{t.section}</td>
                    <td className="p-3 font-medium text-zinc-900">{t.component}</td>
                    <td className="p-3 font-mono font-semibold">{t.motocicletasTime}</td>
                    <td className="p-3 font-mono font-semibold">{t.motonetasTime}</td>
                    <td className="p-3 font-mono font-semibold">{t.cuatrimotosTime}</td>
                    <td className="p-3 text-zinc-600">{t.notes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
