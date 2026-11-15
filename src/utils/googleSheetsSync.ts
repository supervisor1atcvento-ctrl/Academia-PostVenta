import { STUDIO_PHOTO_PRESETS } from '../data/seedData';
import { clearGoogleAccessToken } from '../firebase';
import type {
  AdminQuizItem,
  AdvisorProfile,
  Brand,
  Motorcycle,
  PolicyCategory,
  QuestionKind,
  QuizTopic,
  SpecFieldConfig,
  SpecSection,
  TemplateScope,
  TimeGuideEntry,
  WarrantyPolicy,
} from '../types';

export const TAB_NAMES = {
  motorcycles: 'Motos',
  specFields: 'CamposFicha',
  quizQuestions: 'PreguntasJuegos',
  policies: 'Polizas',
  timeGuides: 'GuiaTiempos',
  leaderboard: 'RankingAsesores',
} as const;

export type SheetTabKey = keyof typeof TAB_NAMES;

export interface LinkedSpreadsheetInfo {
  spreadsheetId: string;
  title: string;
  spreadsheetUrl: string;
  sheetTitles: string[];
}

export interface AppSheetData {
  motorcycles: Motorcycle[];
  specFields: SpecFieldConfig[];
  adminQuizItems: AdminQuizItem[];
  policies: WarrantyPolicy[];
  timeGuides: TimeGuideEntry[];
  leaderboard?: AdvisorProfile[];
}

export interface SheetSyncResult {
  data: Partial<AppSheetData>;
  importedCounts: Partial<Record<SheetTabKey, number>>;
  missingTabs: string[];
  warnings: string[];
}

const VALID_SPEC_SECTIONS: SpecSection[] = [
  'Motor',
  'Transmisión',
  'Frenos y Suspensión',
  'Dimensiones y Capacidades',
  'Equipamiento y Tecnología',
  'Asentamiento y Garantía',
];

const VALID_POLICY_CATEGORIES: PolicyCategory[] = [
  'Condiciones',
  'Asentamiento',
  'Exclusiones',
  'Servicios',
  'Canales',
  'Seguridad',
];

const VALID_QUIZ_TOPICS: Exclude<QuizTopic, 'Mixto'>[] = [
  'Especificaciones',
  'Familias',
  'Garantías',
  'Guía de Tiempos',
];

const LOCAL_IMAGE_MARKER = '[IMAGEN_LOCAL_APP]';

export function extractSpreadsheetId(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  if (match && match[1]) return match[1];
  if (/^[a-zA-Z0-9_-]{15,128}$/.test(trimmed)) return trimmed;
  return '';
}

function parseBool(val: string | undefined, defaultVal = true): boolean {
  if (val === undefined || val.trim() === '') return defaultVal;
  const v = val.trim().toLowerCase();
  if (['no', 'false', '0', 'inactivo', 'oculto', 'baja'].includes(v)) return false;
  if (['si', 'sí', 'true', '1', 'activo', 'visible', 'vigente'].includes(v)) return true;
  return defaultVal;
}

function parseBrand(val: string | undefined): Brand {
  const v = (val || '').trim().toUpperCase();
  if (v.includes('PISTON') || v.includes('PISTÓN')) return 'AMERICAN PISTON';
  return 'VENTO';
}

function parseQuizBrand(val: string | undefined): Brand | 'AMBAS' {
  const v = (val || '').trim().toUpperCase();
  if (v === 'AMBAS' || v === 'BOTH') return 'AMBAS';
  return parseBrand(v);
}

function formatCustomSpecs(specs?: Record<string, string>): string {
  if (!specs) return '';
  return Object.entries(specs)
    .filter(([, v]) => Boolean(v && v.trim()))
    .map(([k, v]) => `${k}=${v.replace(/\|/g, '/')}`)
    .join(' | ');
}

function parseCustomSpecs(raw: string | undefined): Record<string, string> {
  if (!raw || !raw.trim()) return {};
  const trimmed = raw.trim();
  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed) as Record<string, unknown>;
      const out: Record<string, string> = {};
      for (const [k, v] of Object.entries(parsed)) {
        if (typeof v === 'string' && v.trim()) out[k.slice(0, 64)] = v.trim().slice(0, 120);
      }
      return out;
    } catch {
      // Fallback to key=value parsing
    }
  }
  const out: Record<string, string> = {};
  for (const part of trimmed.split('|')) {
    const eqIdx = part.indexOf('=');
    if (eqIdx > 0) {
      const k = part.slice(0, eqIdx).trim().slice(0, 64);
      const v = part.slice(eqIdx + 1).trim().slice(0, 120);
      if (k && v) out[k] = v;
    }
  }
  return out;
}

function safeCell(val: string): string {
  if (val.length > 45000) {
    return LOCAL_IMAGE_MARKER;
  }
  return val;
}

function encodeTabRange(tabName: string, range = 'A1:Z1000'): string {
  const escaped = tabName.replace(/'/g, "''");
  return `'${escaped}'!${range}`;
}

async function sheetsFetch<T>(
  url: string,
  accessToken: string,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  });

  if (!res.ok) {
    let detail = `Error ${res.status}`;
    try {
      const errJson = (await res.json()) as { error?: { message?: string; status?: string } };
      if (errJson?.error?.message) {
        detail = errJson.error.message;
      }
    } catch {
      // ignore json parse error
    }
    if (res.status === 401) {
      clearGoogleAccessToken();
      throw new Error(
        'Tu sesión de Google Sheets expiró. Haz clic en "Conectar Sheets" para autorizar nuevamente.'
      );
    }
    if (res.status === 403) {
      throw new Error(
        `Permiso denegado en Google Sheets (${detail}). Verifica que tengas acceso de edición en esta hoja.`
      );
    }
    throw new Error(`Google Sheets: ${detail}`);
  }

  return (await res.json()) as T;
}

export async function fetchSpreadsheetMetadata(
  accessToken: string,
  spreadsheetId: string
): Promise<LinkedSpreadsheetInfo> {
  const data = await sheetsFetch<{
    spreadsheetId: string;
    spreadsheetUrl?: string;
    properties?: { title?: string };
    sheets?: { properties?: { title?: string } }[];
  }>(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      spreadsheetId
    )}?fields=spreadsheetId,spreadsheetUrl,properties.title,sheets.properties.title`,
    accessToken
  );

  return {
    spreadsheetId: data.spreadsheetId || spreadsheetId,
    title: data.properties?.title || 'Google Sheet conectado',
    spreadsheetUrl:
      data.spreadsheetUrl ||
      `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
    sheetTitles: (data.sheets || [])
      .map((s) => s.properties?.title)
      .filter((t): t is string => Boolean(t)),
  };
}

function buildRowsFromData(
  data: AppSheetData,
  leaderboard?: AdvisorProfile[]
): {
  rowsByTab: Record<SheetTabKey, string[][]>;
  truncatedImageModels: string[];
} {
  const truncatedImageModels: string[] = [];

  const motoHeader = [
    'id',
    'marca',
    'familia',
    'modelo',
    'cilindrada_cc',
    'motor',
    'potencia',
    'transmision',
    'enfriamiento',
    'frenos',
    'tanque',
    'vel_max_kmh',
    'asentamiento',
    'imagen_url',
    'vigente',
    'destacados',
    'campos_ocultos',
    'campos_personalizados',
  ];
  const motoRows = data.motorcycles.map((m) => {
    const imgCell = safeCell(m.imageUrl || '');
    if (imgCell === LOCAL_IMAGE_MARKER) {
      truncatedImageModels.push(m.model);
    }
    return [
      m.id,
      m.brand,
      m.family,
      m.model,
      String(m.displacementCc),
      m.engineType,
      m.powerHp,
      m.transmission,
      m.cooling,
      m.brakes,
      m.tankLiters,
      String(m.topSpeedKmh),
      m.breakInNotes,
      imgCell,
      m.isActive ? 'SI' : 'NO',
      (m.highlights || []).join(' | '),
      (m.hiddenFields || []).join(', '),
      formatCustomSpecs(m.customSpecs),
    ];
  });

  const specHeader = [
    'id',
    'clave',
    'etiqueta',
    'seccion',
    'es_base',
    'visible',
    'orden',
    'placeholder',
  ];
  const specRows = data.specFields.map((f) => [
    f.id,
    f.key,
    f.label,
    f.section,
    f.isCore ? 'SI' : 'NO',
    f.isVisible ? 'SI' : 'NO',
    String(f.order),
    f.placeholder || '',
  ]);

  const quizHeader = [
    'id',
    'tipo',
    'tema',
    'marca',
    'apartado_origen',
    'campo_origen',
    'pregunta',
    'opcion_1',
    'opcion_2',
    'opcion_3',
    'opcion_4',
    'indice_correcto_0_a_3',
    'explicacion',
    'alcance',
    'familia_objetivo',
    'modelos_objetivo',
    'activa',
  ];
  const quizRows = data.adminQuizItems.map((q) => [
    q.id,
    q.kind,
    q.topic,
    q.brand,
    q.sourceSection,
    q.sourceField,
    q.question,
    q.options[0] || '',
    q.options[1] || '',
    q.options[2] || '',
    q.options[3] || '',
    String(q.correctIndex ?? 0),
    q.explanation || '',
    q.targetScope || 'ALL',
    q.targetFamily || '',
    (q.targetModelIds || []).join(', '),
    q.isActive ? 'SI' : 'NO',
  ]);

  const policyHeader = [
    'id',
    'marca',
    'categoria',
    'titulo',
    'resumen',
    'regla_clave',
    'detalles',
    'orden',
    'vigente',
  ];
  const policyRows = data.policies.map((p) => [
    p.id,
    p.brand,
    p.category,
    p.title,
    p.summary,
    p.keyRule,
    (p.details || []).join(' | '),
    String(p.order ?? 1),
    p.isActive ? 'SI' : 'NO',
  ]);

  const guideHeader = [
    'id',
    'codigo',
    'seccion',
    'componente',
    'tiempo_cuatrimotos',
    'tiempo_motonetas',
    'tiempo_motocicletas',
    'notas',
    'accesorios',
    'vigente',
  ];
  const guideRows = data.timeGuides.map((g) => [
    g.id,
    g.code,
    g.section,
    g.component,
    g.cuatrimotosTime,
    g.motonetasTime,
    g.motocicletasTime,
    g.notes,
    (g.accessories || []).join(' | '),
    g.isActive ? 'SI' : 'NO',
  ]);

  const rankHeader = [
    'posicion',
    'uid',
    'asesor',
    'sucursal_cesve',
    'puntos_quiz',
    'record_arcade',
    'total_puntos',
    'quizzes_completados',
    'aciertos',
    'mejor_racha',
  ];
  const rankRows = (leaderboard || []).map((a, idx) => [
    String(idx + 1),
    a.uid,
    a.displayName,
    a.branch || '',
    String(a.quizPoints ?? 0),
    String(a.gameHighScore ?? 0),
    String(a.totalPoints ?? 0),
    String(a.quizzesCompleted ?? 0),
    String(a.correctAnswers ?? 0),
    String(a.streakBest ?? 0),
  ]);

  return {
    rowsByTab: {
      motorcycles: [motoHeader, ...motoRows],
      specFields: [specHeader, ...specRows],
      quizQuestions: [quizHeader, ...quizRows],
      policies: [policyHeader, ...policyRows],
      timeGuides: [guideHeader, ...guideRows],
      leaderboard: [rankHeader, ...rankRows],
    },
    truncatedImageModels,
  };
}

export async function createMasterSpreadsheet(
  accessToken: string,
  title: string,
  data: AppSheetData,
  leaderboard: AdvisorProfile[]
): Promise<{
  info: LinkedSpreadsheetInfo;
  truncatedImageModels: string[];
}> {
  const created = await sheetsFetch<{
    spreadsheetId: string;
    spreadsheetUrl: string;
    properties?: { title?: string };
    sheets?: { properties?: { title?: string } }[];
  }>('https://sheets.googleapis.com/v4/spreadsheets', accessToken, {
    method: 'POST',
    body: JSON.stringify({
      properties: { title: title.trim() || 'Vento & Pistón Academy · Base Maestra' },
      sheets: [
        { properties: { title: TAB_NAMES.motorcycles, gridProperties: { frozenRowCount: 1 } } },
        { properties: { title: TAB_NAMES.specFields, gridProperties: { frozenRowCount: 1 } } },
        { properties: { title: TAB_NAMES.quizQuestions, gridProperties: { frozenRowCount: 1 } } },
        { properties: { title: TAB_NAMES.policies, gridProperties: { frozenRowCount: 1 } } },
        { properties: { title: TAB_NAMES.timeGuides, gridProperties: { frozenRowCount: 1 } } },
        { properties: { title: TAB_NAMES.leaderboard, gridProperties: { frozenRowCount: 1 } } },
      ],
    }),
  });

  const info: LinkedSpreadsheetInfo = {
    spreadsheetId: created.spreadsheetId,
    title: created.properties?.title || title,
    spreadsheetUrl:
      created.spreadsheetUrl ||
      `https://docs.google.com/spreadsheets/d/${created.spreadsheetId}/edit`,
    sheetTitles: (created.sheets || [])
      .map((s) => s.properties?.title)
      .filter((t): t is string => Boolean(t)),
  };

  const { rowsByTab, truncatedImageModels } = buildRowsFromData(data, leaderboard);

  await sheetsFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      info.spreadsheetId
    )}/values:batchUpdate`,
    accessToken,
    {
      method: 'POST',
      body: JSON.stringify({
        valueInputOption: 'USER_ENTERED',
        data: (Object.keys(TAB_NAMES) as SheetTabKey[]).map((key) => ({
          range: encodeTabRange(TAB_NAMES[key], 'A1'),
          values: rowsByTab[key],
        })),
      }),
    }
  );

  return { info, truncatedImageModels };
}

export async function writeAppToSpreadsheet(
  accessToken: string,
  spreadsheetId: string,
  data: AppSheetData,
  leaderboard: AdvisorProfile[],
  options?: { includeLeaderboard?: boolean }
): Promise<{
  info: LinkedSpreadsheetInfo;
  truncatedImageModels: string[];
}> {
  let info = await fetchSpreadsheetMetadata(accessToken, spreadsheetId);
  const targetKeys: SheetTabKey[] = options?.includeLeaderboard
    ? ['motorcycles', 'specFields', 'quizQuestions', 'policies', 'timeGuides', 'leaderboard']
    : ['motorcycles', 'specFields', 'quizQuestions', 'policies', 'timeGuides'];

  // Create any missing expected tabs automatically (respecting existing sheets)
  const existingLower = new Map(
    info.sheetTitles.map((t) => [t.trim().toLowerCase(), t])
  );
  const missingToCreate = targetKeys
    .map((k) => TAB_NAMES[k])
    .filter((name) => !existingLower.has(name.toLowerCase()));

  if (missingToCreate.length > 0) {
    await sheetsFetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
        spreadsheetId
      )}:batchUpdate`,
      accessToken,
      {
        method: 'POST',
        body: JSON.stringify({
          requests: missingToCreate.map((title) => ({
            addSheet: {
              properties: { title, gridProperties: { frozenRowCount: 1 } },
            },
          })),
        }),
      }
    );
    info = await fetchSpreadsheetMetadata(accessToken, spreadsheetId);
  }

  const refreshedMap = new Map(
    info.sheetTitles.map((t) => [t.trim().toLowerCase(), t])
  );
  const resolveTab = (k: SheetTabKey) =>
    refreshedMap.get(TAB_NAMES[k].toLowerCase()) || TAB_NAMES[k];

  const { rowsByTab, truncatedImageModels } = buildRowsFromData(data, leaderboard);

  // Clear existing ranges before writing fresh rows so deleted items don't linger
  await sheetsFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      spreadsheetId
    )}/values:batchClear`,
    accessToken,
    {
      method: 'POST',
      body: JSON.stringify({
        ranges: targetKeys.map((k) => encodeTabRange(resolveTab(k), 'A1:Z2000')),
      }),
    }
  );

  await sheetsFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      spreadsheetId
    )}/values:batchUpdate`,
    accessToken,
    {
      method: 'POST',
      body: JSON.stringify({
        valueInputOption: 'USER_ENTERED',
        data: targetKeys.map((k) => ({
          range: encodeTabRange(resolveTab(k), 'A1'),
          values: rowsByTab[k],
        })),
      }),
    }
  );

  return { info, truncatedImageModels };
}

export async function exportLeaderboardOnlyToSpreadsheet(
  accessToken: string,
  spreadsheetId: string,
  leaderboard: AdvisorProfile[],
  emptyAppData: AppSheetData
): Promise<LinkedSpreadsheetInfo> {
  let info = await fetchSpreadsheetMetadata(accessToken, spreadsheetId);
  const existingLower = new Map(
    info.sheetTitles.map((t) => [t.trim().toLowerCase(), t])
  );
  const rankTab =
    existingLower.get(TAB_NAMES.leaderboard.toLowerCase()) || TAB_NAMES.leaderboard;

  if (!existingLower.has(TAB_NAMES.leaderboard.toLowerCase())) {
    await sheetsFetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
        spreadsheetId
      )}:batchUpdate`,
      accessToken,
      {
        method: 'POST',
        body: JSON.stringify({
          requests: [
            {
              addSheet: {
                properties: {
                  title: TAB_NAMES.leaderboard,
                  gridProperties: { frozenRowCount: 1 },
                },
              },
            },
          ],
        }),
      }
    );
    info = await fetchSpreadsheetMetadata(accessToken, spreadsheetId);
  }

  const { rowsByTab } = buildRowsFromData(emptyAppData, leaderboard);

  await sheetsFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      spreadsheetId
    )}/values:batchClear`,
    accessToken,
    {
      method: 'POST',
      body: JSON.stringify({
        ranges: [encodeTabRange(rankTab, 'A1:Z2000')],
      }),
    }
  );

  await sheetsFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      spreadsheetId
    )}/values:batchUpdate`,
    accessToken,
    {
      method: 'POST',
      body: JSON.stringify({
        valueInputOption: 'USER_ENTERED',
        data: [
          {
            range: encodeTabRange(rankTab, 'A1'),
            values: rowsByTab.leaderboard,
          },
        ],
      }),
    }
  );

  return info;
}

function rowToRecord(headers: string[], row: string[]): Record<string, string> {
  const rec: Record<string, string> = {};
  headers.forEach((h, idx) => {
    const cleanKey = h.trim().toLowerCase();
    if (cleanKey) {
      rec[cleanKey] = (row[idx] ?? '').trim();
    }
  });
  return rec;
}

export async function readAppFromSpreadsheet(
  accessToken: string,
  spreadsheetId: string,
  existingMotorcycles: Motorcycle[] = []
): Promise<{ info: LinkedSpreadsheetInfo; result: SheetSyncResult }> {
  // Always fetch actual spreadsheet metadata first (never hardcode "Sheet1")
  const info = await fetchSpreadsheetMetadata(accessToken, spreadsheetId);
  const actualByLower = new Map(
    info.sheetTitles.map((t) => [t.trim().toLowerCase(), t])
  );

  const importKeys: SheetTabKey[] = [
    'motorcycles',
    'specFields',
    'quizQuestions',
    'policies',
    'timeGuides',
    'leaderboard',
  ];

  const foundTabs: { key: SheetTabKey; tabName: string }[] = [];
  const missingTabs: string[] = [];

  for (const key of importKeys) {
    const expected = TAB_NAMES[key];
    const matched = actualByLower.get(expected.toLowerCase());
    if (matched) {
      foundTabs.push({ key, tabName: matched });
    } else {
      missingTabs.push(expected);
    }
  }

  if (foundTabs.length === 0) {
    throw new Error(
      `No se encontraron pestañas compatibles (${Object.values(TAB_NAMES).join(
        ', '
      )}). Usa "Guardar datos actuales en Sheet" para inicializar las pestañas automáticamente.`
    );
  }

  const rangesQuery = foundTabs
    .map((f) => `ranges=${encodeURIComponent(encodeTabRange(f.tabName, 'A1:Z2000'))}`)
    .join('&');

  const batchRes = await sheetsFetch<{
    valueRanges?: { range?: string; values?: string[][] }[];
  }>(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      spreadsheetId
    )}/values:batchGet?${rangesQuery}`,
    accessToken
  );

  const valueRanges = batchRes.valueRanges || [];
  const existingImageMap = new Map(
    existingMotorcycles.map((m) => [m.id, m.imageUrl])
  );

  const data: Partial<AppSheetData> = {};
  const importedCounts: Partial<Record<SheetTabKey, number>> = {};
  const warnings: string[] = [];

  foundTabs.forEach((found, idx) => {
    const rawRows = valueRanges[idx]?.values || [];
    if (rawRows.length === 0) {
      warnings.push(`La pestaña "${found.tabName}" está vacía.`);
      return;
    }
    const headers = rawRows[0];
    const bodyRows = rawRows
      .slice(1)
      .filter((r) => r.some((cell) => cell && cell.trim() !== ''));
    if (bodyRows.length === 0) {
      warnings.push(`La pestaña "${found.tabName}" no contiene filas de datos.`);
    }

    if (found.key === 'motorcycles') {
      const motos: Motorcycle[] = [];
      bodyRows.forEach((row, rIdx) => {
        const rec = rowToRecord(headers, row);
        const model = rec.modelo || rec.model || '';
        if (!model) return;
        const id =
          rec.id ||
          `sheet-moto-${rIdx}-${model.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
        const rawImage = rec.imagen_url || rec.imageurl || '';
        const imageUrl =
          rawImage === LOCAL_IMAGE_MARKER
            ? existingImageMap.get(id) || STUDIO_PHOTO_PRESETS[0].url
            : rawImage || existingImageMap.get(id) || STUDIO_PHOTO_PRESETS[0].url;

        motos.push({
          id: id.slice(0, 120),
          brand: parseBrand(rec.marca || rec.brand),
          family: (rec.familia || rec.family || 'Urban Sport').slice(0, 60),
          model: model.slice(0, 80),
          displacementCc: Math.max(49, Number(rec.cilindrada_cc || rec.displacementcc) || 150),
          engineType: (rec.motor || rec.enginetype || 'Monocilíndrico 4T').slice(0, 120),
          powerHp: (rec.potencia || rec.powerhp || '15 HP').slice(0, 40),
          transmission: (rec.transmision || rec.transmission || 'Estándar').slice(0, 80),
          cooling: (rec.enfriamiento || rec.cooling || 'Aire').slice(0, 60),
          brakes: (rec.frenos || rec.brakes || 'Disco / Tambor').slice(0, 80),
          tankLiters: (rec.tanque || rec.tankliters || '12 L').slice(0, 30),
          topSpeedKmh: Math.max(10, Number(rec.vel_max_kmh || rec.topspeedkmh) || 95),
          breakInNotes: (
            rec.asentamiento ||
            rec.breakinnotes ||
            '0 - 3,000 km según tabla de familia.'
          ).slice(0, 300),
          imageUrl,
          isActive: parseBool(rec.vigente ?? rec.isactive, true),
          highlights: (rec.destacados || rec.highlights || '')
            .split(/\||;/)
            .map((s) => s.trim())
            .filter(Boolean)
            .slice(0, 8),
          hiddenFields: (rec.campos_ocultos || rec.hiddenfields || '')
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
            .slice(0, 40),
          customSpecs: parseCustomSpecs(
            rec.campos_personalizados || rec.customspecs
          ),
        });
      });
      data.motorcycles = motos;
      importedCounts.motorcycles = motos.length;
    }

    if (found.key === 'specFields') {
      const fields: SpecFieldConfig[] = [];
      bodyRows.forEach((row, rIdx) => {
        const rec = rowToRecord(headers, row);
        const key = (rec.clave || rec.key || '').trim();
        const label = (rec.etiqueta || rec.label || '').trim();
        if (!key || !label) return;
        const secRaw = (rec.seccion || rec.section || '').trim();
        const section = VALID_SPEC_SECTIONS.includes(secRaw as SpecSection)
          ? (secRaw as SpecSection)
          : 'Motor';
        fields.push({
          id: (rec.id || key).slice(0, 120),
          key: key.slice(0, 64),
          label: label.slice(0, 80),
          section,
          isCore: parseBool(rec.es_base ?? rec.iscore, false),
          isVisible: parseBool(rec.visible ?? rec.isvisible, true),
          order: Math.max(0, Math.min(500, Number(rec.orden || rec.order) || rIdx + 1)),
          placeholder: (rec.placeholder || '').slice(0, 120),
        });
      });
      data.specFields = fields.sort((a, b) => a.order - b.order);
      importedCounts.specFields = fields.length;
    }

    if (found.key === 'quizQuestions') {
      const items: AdminQuizItem[] = [];
      bodyRows.forEach((row, rIdx) => {
        const rec = rowToRecord(headers, row);
        const question = (rec.pregunta || rec.question || '').trim();
        if (question.length < 5) return;
        const kindRaw = (rec.tipo || rec.kind || '').trim().toLowerCase();
        const kind: QuestionKind =
          kindRaw === 'template' || kindRaw === 'plantilla' ? 'template' : 'fixed';
        const topicRaw = (rec.tema || rec.topic || '').trim();
        const topic = VALID_QUIZ_TOPICS.includes(
          topicRaw as Exclude<QuizTopic, 'Mixto'>
        )
          ? (topicRaw as Exclude<QuizTopic, 'Mixto'>)
          : 'Especificaciones';
        const scopeRaw = (rec.alcance || rec.targetscope || 'ALL').trim().toUpperCase();
        const targetScope: TemplateScope =
          scopeRaw === 'FAMILY' || scopeRaw === 'MODELS' ? scopeRaw : 'ALL';
        const options = [
          rec.opcion_1 || '',
          rec.opcion_2 || '',
          rec.opcion_3 || '',
          rec.opcion_4 || '',
        ]
          .map((o) => o.trim().slice(0, 200))
          .filter(Boolean);

        const rawIdx = Number(
          rec.indice_correcto_0_a_3 || rec.indice_correcto || rec.correctindex
        );
        const correctIndex = Number.isFinite(rawIdx)
          ? Math.max(0, Math.min(Math.max(0, options.length - 1), Math.trunc(rawIdx)))
          : 0;

        items.push({
          id: (rec.id || `sheet-q-${rIdx + 1}`).slice(0, 120),
          kind,
          topic,
          brand: parseQuizBrand(rec.marca || rec.brand),
          sourceSection: (rec.apartado_origen || rec.sourcesection || 'Ficha Técnica').slice(
            0,
            100
          ),
          sourceField: (rec.campo_origen || rec.sourcefield || 'manual').slice(0, 64),
          question: question.slice(0, 320),
          options,
          correctIndex,
          explanation: (rec.explicacion || rec.explanation || '').slice(0, 500),
          targetScope,
          targetFamily: (rec.familia_objetivo || rec.targetfamily || '').slice(0, 60),
          targetModelIds: (rec.modelos_objetivo || rec.targetmodelids || '')
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
            .slice(0, 80),
          isActive: parseBool(rec.activa ?? rec.isactive, true),
        });
      });
      data.adminQuizItems = items;
      importedCounts.quizQuestions = items.length;
    }

    if (found.key === 'policies') {
      const list: WarrantyPolicy[] = [];
      bodyRows.forEach((row, rIdx) => {
        const rec = rowToRecord(headers, row);
        const title = (rec.titulo || rec.title || '').trim();
        const summary = (rec.resumen || rec.summary || '').trim();
        if (!title || !summary) return;
        const catRaw = (rec.categoria || rec.category || '').trim();
        const category = VALID_POLICY_CATEGORIES.includes(catRaw as PolicyCategory)
          ? (catRaw as PolicyCategory)
          : 'Condiciones';
        list.push({
          id: (rec.id || `sheet-pol-${rIdx + 1}`).slice(0, 120),
          brand: parseBrand(rec.marca || rec.brand),
          category,
          title: title.slice(0, 140),
          summary: summary.slice(0, 500),
          keyRule: (rec.regla_clave || rec.keyrule || 'Vigente').slice(0, 120),
          details: (rec.detalles || rec.details || '')
            .split('|')
            .map((s) => s.trim())
            .filter(Boolean)
            .slice(0, 15),
          order: Number(rec.orden || rec.order) || rIdx + 1,
          isActive: parseBool(rec.vigente ?? rec.isactive, true),
        });
      });
      data.policies = list;
      importedCounts.policies = list.length;
    }

    if (found.key === 'timeGuides') {
      const guides: TimeGuideEntry[] = [];
      bodyRows.forEach((row, rIdx) => {
        const rec = rowToRecord(headers, row);
        const code = (rec.codigo || rec.code || '').trim();
        const component = (rec.componente || rec.component || '').trim();
        if (!code || !component) return;
        const sec = (rec.seccion || rec.section || 'VC').trim().toUpperCase();
        guides.push({
          id: (rec.id || code).slice(0, 120),
          code: code.slice(0, 20),
          section: sec === 'VM' ? 'VM' : 'VC',
          component: component.slice(0, 120),
          cuatrimotosTime: (rec.tiempo_cuatrimotos || rec.cuatrimotostime || '30 días').slice(
            0,
            60
          ),
          motonetasTime: (rec.tiempo_motonetas || rec.motonetastime || '30 días').slice(
            0,
            60
          ),
          motocicletasTime: (
            rec.tiempo_motocicletas ||
            rec.motocicletastime ||
            '30 días'
          ).slice(0, 60),
          notes: (rec.notas || rec.notes || '').slice(0, 300),
          accessories: (rec.accesorios || rec.accessories || '')
            .split(/\||;/)
            .map((s) => s.trim())
            .filter(Boolean)
            .slice(0, 15),
          isActive: parseBool(rec.vigente ?? rec.isactive, true),
        });
      });
      data.timeGuides = guides;
      importedCounts.timeGuides = guides.length;
    }

    if (found.key === 'leaderboard') {
      const profiles: AdvisorProfile[] = [];
      bodyRows.forEach((row, rIdx) => {
        const rec = rowToRecord(headers, row);
        const displayName = (rec.asesor || rec.displayname || '').trim();
        if (!displayName) return;
        const quizPoints = Math.max(0, Number(rec.puntos_quiz || rec.quizpoints) || 0);
        const gameHighScore = Math.max(
          0,
          Number(rec.record_arcade || rec.gamehighscore) || 0
        );
        const totalPoints = Math.max(
          quizPoints + gameHighScore,
          Number(rec.total_puntos || rec.totalpoints) || 0
        );
        profiles.push({
          uid: (rec.uid || `sheet-adv-${rIdx + 1}`).slice(0, 128),
          displayName: displayName.slice(0, 60),
          branch: (rec.sucursal_cesve || rec.branch || '').slice(0, 60),
          quizPoints,
          gameHighScore,
          totalPoints,
          quizzesCompleted: Math.max(
            0,
            Number(rec.quizzes_completados || rec.quizzescompleted) || 0
          ),
          correctAnswers: Math.max(
            0,
            Number(rec.aciertos || rec.correctanswers) || 0
          ),
          streakBest: Math.max(0, Number(rec.mejor_racha || rec.streakbest) || 0),
        });
      });
      data.leaderboard = profiles.sort((a, b) => b.totalPoints - a.totalPoints);
      importedCounts.leaderboard = profiles.length;
    }
  });

  return {
    info,
    result: {
      data,
      importedCounts,
      missingTabs,
      warnings,
    },
  };
}
