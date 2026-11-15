export type AppTab = 'catalog' | 'warranty' | 'training' | 'runner' | 'admin';
export type BrandType = 'VENTO' | 'AMERICAN PISTON';
export type QuizTopic = 'catalog' | 'warranty' | 'times' | 'mixed';

export interface Motorcycle {
  id: string;
  brand: BrandType;
  family: string;
  model: string;
  displacementCc: number;
  engineType: string;
  powerHp: string;
  transmission: string;
  cooling: string;
  brakes: string;
  tankLiters: number;
  topSpeedKmh: number;
  breakInNotes: string;
  imageUrl: string;
  isActive: boolean;
  highlights: string[];
  customSpecs?: Record<string, string>;
  hiddenFields?: string[];
}

export interface WarrantyPolicy {
  id: string;
  brand: BrandType;
  category: string;
  title: string;
  summary: string;
  keyRule: string;
  details: string[];
  order: number;
  isActive: boolean;
}

export interface TimeGuideEntry {
  id: string;
  code: string;
  section: string;
  component: string;
  cuatrimotosTime: string;
  motonetasTime: string;
  motocicletasTime: string;
  notes: string;
  accessories: string;
  isActive: boolean;
}

export interface SpecFieldConfig {
  id: string;
  key: string;
  label: string;
  section: string;
  isCore: boolean;
  isVisible: boolean;
  order: number;
  placeholder: string;
}

export interface AdminQuizItem {
  id: string;
  kind: 'manual' | 'auto';
  topic: QuizTopic;
  brand: BrandType;
  sourceSection: string;
  sourceField: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  targetScope: 'all' | 'family' | 'models';
  targetFamily?: string;
  targetModelIds?: string[];
  isActive: boolean;
}

export interface AdvisorProfile {
  uid: string;
  email: string;
  displayName: string;
  branch: string;
  role: 'admin' | 'advisor';
  quizPoints: number;
  gameHighScore: number;
  totalPoints: number;
  quizzesCompleted: number;
  correctAnswers: number;
  streakBest: number;
  updatedAt?: string;
}

export interface LocalUser {
  uid: string;
  email: string;
  displayName: string;
}
