export type Brand = 'VENTO' | 'AMERICAN PISTON';

export type MotorcycleFamily =
  | 'Motonetas'
  | 'Ciudad'
  | 'Rebeldes'
  | 'Urban Sport'
  | 'Trabajo'
  | 'Doble Propósito'
  | 'Adventure'
  | 'Cuatrimotos'
  | 'Deportiva';

export type SpecSection =
  | 'Motor'
  | 'Transmisión'
  | 'Frenos y Suspensión'
  | 'Dimensiones y Capacidades'
  | 'Equipamiento y Tecnología'
  | 'Asentamiento y Garantía';

export interface SpecFieldConfig {
  id: string;
  key: string;
  label: string;
  section: SpecSection;
  isCore: boolean;
  isVisible: boolean;
  order: number;
  placeholder: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Motorcycle {
  id: string;
  brand: Brand;
  family: string;
  model: string;
  displacementCc: number;
  engineType: string;
  powerHp: string;
  transmission: string;
  cooling: string;
  brakes: string;
  tankLiters: string;
  topSpeedKmh: number;
  breakInNotes: string;
  imageUrl: string;
  isActive: boolean;
  highlights: string[];
  customSpecs?: Record<string, string>;
  hiddenFields?: string[];
  createdAt?: unknown;
  updatedAt?: unknown;
}

export type PolicyCategory =
  | 'Condiciones'
  | 'Asentamiento'
  | 'Exclusiones'
  | 'Servicios'
  | 'Canales'
  | 'Seguridad';

export interface WarrantyPolicy {
  id: string;
  brand: Brand;
  category: PolicyCategory;
  title: string;
  summary: string;
  keyRule: string;
  details: string[];
  order: number;
  isActive: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface TimeGuideEntry {
  id: string;
  code: string;
  section: 'VC' | 'VM';
  component: string;
  cuatrimotosTime: string;
  motonetasTime: string;
  motocicletasTime: string;
  notes: string;
  accessories: string[];
  isActive: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface AdvisorProfile {
  uid: string;
  displayName: string;
  branch: string;
  quizPoints: number;
  gameHighScore: number;
  totalPoints: number;
  quizzesCompleted: number;
  correctAnswers: number;
  streakBest: number;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export type QuizTopic =
  | 'Especificaciones'
  | 'Familias'
  | 'Garantías'
  | 'Guía de Tiempos'
  | 'Mixto';

export interface QuizSession {
  id: string;
  advisorUid: string;
  advisorName: string;
  topic: QuizTopic;
  score: number;
  correctCount: number;
  totalQuestions: number;
  createdAt?: unknown;
}

export type QuestionKind = 'fixed' | 'template';
export type TemplateScope = 'ALL' | 'FAMILY' | 'MODELS';

export interface AdminQuizItem {
  id: string;
  kind: QuestionKind;
  topic: Exclude<QuizTopic, 'Mixto'>;
  brand: Brand | 'AMBAS';
  sourceSection: string;
  sourceField: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  targetScope: TemplateScope;
  targetFamily: string;
  targetModelIds: string[];
  isActive: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface QuizQuestion {
  id: string;
  topic: Exclude<QuizTopic, 'Mixto'>;
  brand: Brand | 'AMBAS';
  sourceSection?: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export type AppTab = 'catalog' | 'warranty' | 'training' | 'runner' | 'admin';
