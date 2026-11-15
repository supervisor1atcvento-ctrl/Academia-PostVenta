import type {
  AdminQuizItem,
  AdvisorProfile,
  Motorcycle,
  QuizTopic,
  SpecFieldConfig,
  TimeGuideEntry,
  WarrantyPolicy,
} from '../types';

const API_URL = import.meta.env.VITE_SHEETS_API_URL as string;

export interface AllDatabasePayload {
  motorcycles: Motorcycle[];
  policies: WarrantyPolicy[];
  timeGuides: TimeGuideEntry[];
  specFields: SpecFieldConfig[];
  quizQuestions: AdminQuizItem[];
  advisors: AdvisorProfile[];
}

async function postToSheets<T = any>(body: Record<string, any>): Promise<T> {
  if (!API_URL) {
    throw new Error('Falta configurar VITE_SHEETS_API_URL en el archivo .env');
  }
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8',
    },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!json.ok) {
    throw new Error(json.error || 'Error en Google Sheets API');
  }
  return json;
}

export async function fetchAllData(): Promise<AllDatabasePayload> {
  if (!API_URL) {
    throw new Error('Falta configurar VITE_SHEETS_API_URL en el archivo .env');
  }
  const res = await fetch(`${API_URL}?action=getAll`);
  const json = await res.json();
  if (!json.ok) {
    throw new Error(json.error || 'Error al obtener datos de Sheets');
  }
  return json.data;
}

export async function upsertSheetItem(sheetName: string, item: Record<string, any>) {
  return postToSheets({ action: 'upsert', sheetName, item });
}

export async function deleteSheetItem(sheetName: string, id: string) {
  return postToSheets({ action: 'delete', sheetName, id });
}

export async function toggleSheetField(sheetName: string, id: string, field: string) {
  return postToSheets({ action: 'toggleField', sheetName, id, field });
}

export async function submitQuizCompletion(data: {
  advisorUid: string;
  advisorName: string;
  topic: QuizTopic;
  score: number;
  correctCount: number;
  totalQuestions: number;
  maxStreak: number;
}) {
  return postToSheets({ action: 'completeQuiz', data });
}

export async function submitGameHighScore(data: {
  advisorUid: string;
  advisorName: string;
  newScore: number;
}) {
  return postToSheets({ action: 'saveGameHighScore', data });
}

export async function syncSeedBatch(collections: Record<string, any[]>) {
  return postToSheets({ action: 'batchSeed', collections });
}
