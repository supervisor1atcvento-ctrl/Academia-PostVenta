import { useMemo, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  Eye,
  EyeOff,
  FileSpreadsheet,
  FolderPlus,
  ImagePlus,
  Layers,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  SlidersHorizontal,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {
  generateDynamicQuestions,
  STUDIO_PHOTO_PRESETS,
} from '../data/seedData';
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
import {
  ensureAcademiaWorkspaceFolders,
  listDriveImagesInFolder,
  uploadImageToDriveFolder,
  type DriveImageFile,
  type DriveWorkspaceFolders,
} from '../utils/googleDriveSync';
import type {
  AppSheetData,
  LinkedSpreadsheetInfo,
} from '../utils/googleSheetsSync';
import GoogleSheetsPanel from './GoogleSheetsPanel';

interface AdminPanelViewProps {
  user: User | null;
  isAdmin: boolean;
  onSignIn: () => Promise<void>;
  motorcycles: Motorcycle[];
  policies: WarrantyPolicy[];
  timeGuides: TimeGuideEntry[];
  specFields: SpecFieldConfig[];
  adminQuizItems: AdminQuizItem[];
  onSaveMotorcycle: (
    moto: Omit<Motorcycle, 'createdAt' | 'updatedAt'>
  ) => Promise<void>;
  onToggleMotorcycleActive: (moto: Motorcycle) => Promise<void>;
  onDeleteMotorcycle: (id: string) => Promise<void>;
  onSavePolicy: (
    policy: Omit<WarrantyPolicy, 'createdAt' | 'updatedAt'>
  ) => Promise<void>;
  onTogglePolicyActive: (policy: WarrantyPolicy) => Promise<void>;
  onDeletePolicy: (id: string) => Promise<void>;
  onSaveTimeGuide: (
    guide: Omit<TimeGuideEntry, 'createdAt' | 'updatedAt'>
  ) => Promise<void>;
  onToggleTimeGuideActive: (guide: TimeGuideEntry) => Promise<void>;
  onDeleteTimeGuide: (id: string) => Promise<void>;
  onSaveSpecField: (
    field: Omit<SpecFieldConfig, 'createdAt' | 'updatedAt'>
  ) => Promise<void>;
  onToggleSpecFieldVisible: (field: SpecFieldConfig) => Promise<void>;
  onDeleteSpecField: (id: string) => Promise<void>;
  onSaveQuizQuestion: (
    question: Omit<AdminQuizItem, 'createdAt' | 'updatedAt'>
  ) => Promise<void>;
  onToggleQuizQuestionActive: (question: AdminQuizItem) => Promise<void>;
  onDeleteQuizQuestion: (id: string) => Promise<void>;
  hasSheetsToken: boolean;
  onConnectGoogleSheets: () => Promise<string>;
  onForceReconnectGoogle: () => Promise<string>;
  driveFolders: DriveWorkspaceFolders | null;
  onSetDriveFolders: (folders: DriveWorkspaceFolders | null) => void;
  linkedSheet: LinkedSpreadsheetInfo | null;
  onSetLinkedSheet: (info: LinkedSpreadsheetInfo | null) => void;
  sheetLoaded: boolean;
  sheetLoadedAt: string | null;
  pendingDataChanges: number;
  onApplySheetData: (
    data: Partial<AppSheetData>,
    options?: { markSaved?: boolean }
  ) => void;
  onClearPendingChanges: () => void;
  onReloadFromSheet: () => Promise<void>;
  onRequestSaveChangesToSheet: () => void;
  leaderboard: AdvisorProfile[];
}

type AdminSection =
  | 'units'
  | 'specfields'
  | 'questions'
  | 'policies'
  | 'timeguides'
  | 'sheets';

const FAMILIES = [
  'Motonetas',
  'Ciudad',
  'Rebeldes',
  'Urban Sport',
  'Trabajo',
  'Doble Propósito',
  'Adventure',
  'Cuatrimotos',
  'Deportiva',
];

const SPEC_SECTIONS: SpecSection[] = [
  'Motor',
  'Transmisión',
  'Frenos y Suspensión',
  'Dimensiones y Capacidades',
  'Equipamiento y Tecnología',
  'Asentamiento y Garantía',
];

const POLICY_CATEGORIES: PolicyCategory[] = [
  'Condiciones',
  'Asentamiento',
  'Exclusiones',
  'Servicios',
  'Canales',
  'Seguridad',
];

const SOURCE_SECTION_PRESETS = [
  'Ficha Técnica · Motor',
  'Ficha Técnica · Transmisión',
  'Ficha Técnica · Frenos y Suspensión',
  'Ficha Técnica · Dimensiones y Capacidades',
  'Ficha Técnica · Equipamiento y Tecnología',
  'Familias y Asentamiento VENTO',
  'Póliza VENTO 2025',
  'Póliza American Pistón',
  'Guía de Tiempos VC / VM 2025',
];

function slugifyId(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 56);
}

function slugifyFieldKey(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48);
}

function formatAdminError(err: unknown, fallback: string): string {
  const raw = err instanceof Error ? err.message : String(err || fallback);
  return raw || fallback;
}

const MAX_DATA_URL_LENGTH = 450000;

async function compressImageToDataUrl(file: File): Promise<string> {
  if (file.type && !file.type.startsWith('image/')) {
    throw new Error('Selecciona un archivo de imagen válido (JPG, PNG o WebP).');
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('No se pudo inicializar el procesador de imagen.'));
          return;
        }

        let maxDim = 880;
        const qualities = [0.78, 0.62, 0.48, 0.36];

        for (let pass = 0; pass < 4; pass++) {
          const longest = Math.max(img.width, img.height) || 1;
          const scale = longest > maxDim ? maxDim / longest : 1;
          canvas.width = Math.max(1, Math.round(img.width * scale));
          canvas.height = Math.max(1, Math.round(img.height * scale));
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

          for (const q of qualities) {
            const dataUrl = canvas.toDataURL('image/jpeg', q);
            if (dataUrl.length <= MAX_DATA_URL_LENGTH) {
              resolve(dataUrl);
              return;
            }
          }
          maxDim = Math.round(maxDim * 0.72);
        }

        reject(
          new Error(
            'La imagen sigue siendo demasiado pesada para guardarse localmente. Súbela a Google Drive o elige una foto más ligera.'
          )
        );
      };
      img.onerror = () =>
        reject(
          new Error(
            'Formato de imagen no compatible en este navegador (usa JPG, PNG o WebP, o súbela a Google Drive).'
          )
        );
      img.src = String(reader.result);
    };
    reader.onerror = () => reject(new Error('Error leyendo el archivo de imagen.'));
    reader.readAsDataURL(file);
  });
}

export default function AdminPanelView({
  user,
  isAdmin,
  onSignIn,
  motorcycles,
  policies,
  timeGuides,
  specFields,
  adminQuizItems,
  onSaveMotorcycle,
  onToggleMotorcycleActive,
  onDeleteMotorcycle,
  onSavePolicy,
  onTogglePolicyActive,
  onDeletePolicy,
  onSaveTimeGuide,
  onToggleTimeGuideActive,
  onDeleteTimeGuide,
  onSaveSpecField,
  onToggleSpecFieldVisible,
  onDeleteSpecField,
  onSaveQuizQuestion,
  onToggleQuizQuestionActive,
  onDeleteQuizQuestion,
  hasSheetsToken,
  onConnectGoogleSheets,
  onForceReconnectGoogle,
  driveFolders,
  onSetDriveFolders,
  linkedSheet,
  onSetLinkedSheet,
  sheetLoaded,
  sheetLoadedAt,
  pendingDataChanges,
  onApplySheetData,
  onClearPendingChanges,
  onReloadFromSheet,
  onRequestSaveChangesToSheet,
  leaderboard,
}: AdminPanelViewProps) {
  const [section, setSection] = useState<AdminSection>(
    !sheetLoaded && motorcycles.length === 0 ? 'sheets' : 'units'
  );
  const [syncing, setSyncing] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [savingForm, setSavingForm] = useState(false);
  const [pendingDriveMotoFile, setPendingDriveMotoFile] = useState<File | null>(
    null
  );
  const [uploadingDrivePhoto, setUploadingDrivePhoto] = useState(false);
  const [motoDriveImages, setMotoDriveImages] = useState<DriveImageFile[]>([]);

  // Filters for Questions tab
  const [qKindFilter, setQKindFilter] = useState<'ALL' | QuestionKind>('ALL');
  const [qTopicFilter, setQTopicFilter] = useState<'ALL' | Exclude<QuizTopic, 'Mixto'>>('ALL');
  const [qSearch, setQSearch] = useState('');

  // Modal states
  const [editingMoto, setEditingMoto] = useState<Motorcycle | null>(null);
  const [motoModalOpen, setMotoModalOpen] = useState(false);

  const [editingSpecField, setEditingSpecField] =
    useState<SpecFieldConfig | null>(null);
  const [specFieldModalOpen, setSpecFieldModalOpen] = useState(false);

  const [editingQuestion, setEditingQuestion] = useState<AdminQuizItem | null>(
    null
  );
  const [questionModalOpen, setQuestionModalOpen] = useState(false);

  const [editingPolicy, setEditingPolicy] = useState<WarrantyPolicy | null>(
    null
  );
  const [policyModalOpen, setPolicyModalOpen] = useState(false);

  const [editingGuide, setEditingGuide] = useState<TimeGuideEntry | null>(
    null
  );
  const [guideModalOpen, setGuideModalOpen] = useState(false);

  // Moto Form
  const [mBrand, setMBrand] = useState<Brand>('VENTO');
  const [mFamily, setMFamily] = useState('Urban Sport');
  const [mModel, setMModel] = useState('');
  const [mCc, setMCc] = useState('250');
  const [mEngine, setMEngine] = useState('Monocilíndrico 4 Tiempos');
  const [mPower, setMPower] = useState('18 HP');
  const [mTrans, setMTrans] = useState('Estándar 5 velocidades');
  const [mCool, setMCool] = useState('Enfriado por aire');
  const [mBrakes, setMBrakes] = useState('Disco delantero y trasero');
  const [mTank, setMTank] = useState('13 L');
  const [mSpeed, setMSpeed] = useState('120');
  const [mBreakIn, setMBreakIn] = useState(
    '0 - 3,000 km sin exceder 5,000 RPM ni 40 - 50 km/h.'
  );
  const [mImage, setMImage] = useState(STUDIO_PHOTO_PRESETS[0].url);
  const [mHighlights, setMHighlights] = useState(
    'Tablero digital, Iluminación LED'
  );
  const [mCustomSpecs, setMCustomSpecs] = useState<Record<string, string>>({});
  const [mHiddenFields, setMHiddenFields] = useState<string[]>([]);

  // SpecField Form
  const [sfLabel, setSfLabel] = useState('');
  const [sfSection, setSfSection] = useState<SpecSection>('Motor');
  const [sfOrder, setSfOrder] = useState('14');
  const [sfPlaceholder, setSfPlaceholder] = useState('');
  const [sfVisible, setSfVisible] = useState(true);

  // Question / Template Form
  const [qKind, setQKind] = useState<QuestionKind>('fixed');
  const [qTopic, setQTopic] = useState<Exclude<QuizTopic, 'Mixto'>>(
    'Especificaciones'
  );
  const [qBrand, setQBrand] = useState<Brand | 'AMBAS'>('VENTO');
  const [qSourceField, setQSourceField] = useState('manual');
  const [qSourceSection, setQSourceSection] = useState(
    'Ficha Técnica · Motor'
  );
  const [qText, setQText] = useState('');
  const [qOpt0, setQOpt0] = useState('');
  const [qOpt1, setQOpt1] = useState('');
  const [qOpt2, setQOpt2] = useState('');
  const [qOpt3, setQOpt3] = useState('');
  const [qCorrectIdx, setQCorrectIdx] = useState(0);
  const [qExplanation, setQExplanation] = useState('');
  const [qTargetScope, setQTargetScope] = useState<TemplateScope>('ALL');
  const [qTargetFamily, setQTargetFamily] = useState('Urban Sport');
  const [qTargetModelIds, setQTargetModelIds] = useState<string[]>([]);

  // Policy Form
  const [pBrand, setPBrand] = useState<Brand>('VENTO');
  const [pCategory, setPCategory] = useState<PolicyCategory>('Condiciones');
  const [pTitle, setPTitle] = useState('');
  const [pSummary, setPSummary] = useState('');
  const [pKeyRule, setPKeyRule] = useState('');
  const [pDetails, setPDetails] = useState('');
  const [pOrder, setPOrder] = useState('10');

  // TimeGuide Form
  const [gCode, setGCode] = useState('');
  const [gSection, setGSection] = useState<'VC' | 'VM'>('VC');
  const [gComponent, setGComponent] = useState('');
  const [gCuatri, setGCuatri] = useState('30 días');
  const [gMotoNet, setGMotoNet] = useState('30 días');
  const [gMoto, setGMoto] = useState('30 días');
  const [gNotes, setGNotes] = useState('');
  const [gAccessories, setGAccessories] = useState('');

  const customSpecFields = useMemo(
    () => specFields.filter((f) => !f.isCore),
    [specFields]
  );

  const generatedTotalCount = useMemo(
    () =>
      generateDynamicQuestions(motorcycles, timeGuides, adminQuizItems).length,
    [motorcycles, timeGuides, adminQuizItems]
  );

  const filteredQuestions = useMemo(() => {
    const q = qSearch.trim().toLowerCase();
    return adminQuizItems.filter((item) => {
      if (qKindFilter !== 'ALL' && item.kind !== qKindFilter) return false;
      if (qTopicFilter !== 'ALL' && item.topic !== qTopicFilter) return false;
      if (!q) return true;
      return (
        item.question.toLowerCase().includes(q) ||
        item.sourceSection.toLowerCase().includes(q) ||
        item.sourceField.toLowerCase().includes(q) ||
        item.topic.toLowerCase().includes(q)
      );
    });
  }, [adminQuizItems, qKindFilter, qTopicFilter, qSearch]);

  if (!user || !isAdmin) {
    return (
      <section className="mx-auto max-w-xl rounded-xl border border-zinc-200 bg-white p-8 text-center">
        <ShieldAlert className="mx-auto h-10 w-10 text-[#EA580C]" />
        <h1 className="mt-3 font-display text-3xl font-bold text-zinc-950">
          Panel de Administrador
        </h1>
        <p className="mt-2 text-sm text-zinc-600">
          {!user
            ? 'Inicia sesión con la cuenta autorizada de supervisión para administrar unidades, campos de fichas técnicas, preguntas de juegos, pólizas y guía de tiempos.'
            : `Sesión iniciada como ${user.email}. Esta cuenta no tiene permisos de administrador asignados.`}
        </p>
        {!user && (
          <button
            type="button"
            onClick={() => onSignIn().catch(() => {})}
            className="mt-5 rounded-lg bg-[#EA580C] px-5 py-2.5 text-xs font-semibold text-white hover:bg-[#C2410C] cursor-pointer"
          >
            Iniciar sesión como Administrador
          </button>
        )}
      </section>
    );
  }

  // --- Units Handlers ---
  const openNewMoto = () => {
    setEditingMoto(null);
    setMBrand('VENTO');
    setMFamily('Urban Sport');
    setMModel('');
    setMCc('250');
    setMEngine('Monocilíndrico 4 Tiempos');
    setMPower('18 HP');
    setMTrans('Estándar 5 velocidades');
    setMCool('Enfriado por aire');
    setMBrakes('Disco hidráulico delantero y trasero');
    setMTank('13 L');
    setMSpeed('125');
    setMBreakIn('0 - 3,000 km sin superar 5,000 RPM ni 40 - 50 km/h.');
    setMImage(STUDIO_PHOTO_PRESETS[0].url);
    setMHighlights('Tablero digital, Iluminación LED');
    setMCustomSpecs({});
    setMHiddenFields([]);
    setErrorMessage('');
    setMotoModalOpen(true);
  };

  const openEditMoto = (m: Motorcycle) => {
    setEditingMoto(m);
    setMBrand(m.brand);
    setMFamily(m.family);
    setMModel(m.model);
    setMCc(String(m.displacementCc));
    setMEngine(m.engineType);
    setMPower(m.powerHp);
    setMTrans(m.transmission);
    setMCool(m.cooling);
    setMBrakes(m.brakes);
    setMTank(m.tankLiters);
    setMSpeed(String(m.topSpeedKmh));
    setMBreakIn(m.breakInNotes);
    setMImage(m.imageUrl);
    setMHighlights(m.highlights.join(', '));
    setMCustomSpecs({ ...(m.customSpecs || {}) });
    setMHiddenFields([...(m.hiddenFields || [])]);
    setErrorMessage('');
    setMotoModalOpen(true);
  };

  const toggleMotoHiddenField = (fieldKey: string) => {
    setMHiddenFields((prev) =>
      prev.includes(fieldKey)
        ? prev.filter((k) => k !== fieldKey)
        : [...prev, fieldKey]
    );
  };

  const handleMotoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanModel = mModel.trim().slice(0, 80);
    const cleanEngine = mEngine.trim().slice(0, 120);
    const cleanPower = mPower.trim().slice(0, 40);
    const cleanTrans = mTrans.trim().slice(0, 80);
    const cleanCool = mCool.trim().slice(0, 60);
    const cleanBrakes = mBrakes.trim().slice(0, 80);
    const cleanTank = mTank.trim().slice(0, 30);
    const cleanBreakIn = mBreakIn.trim().slice(0, 300);
    const cleanImage = mImage.trim() || STUDIO_PHOTO_PRESETS[0].url;

    if (cleanModel.length < 2) {
      setErrorMessage('El nombre del modelo debe tener al menos 2 caracteres.');
      return;
    }
    if (
      cleanEngine.length < 2 ||
      cleanPower.length < 1 ||
      cleanTrans.length < 2 ||
      cleanCool.length < 2 ||
      cleanBrakes.length < 2 ||
      cleanTank.length < 1 ||
      cleanBreakIn.length < 2
    ) {
      setErrorMessage(
        'Completa todos los campos técnicos obligatorios (mínimo 2 caracteres por campo).'
      );
      return;
    }
    if (cleanImage.length > 600000) {
      setErrorMessage(
        'La fotografía excede el tamaño recomendado. Súbela a Google Drive (academia/imagenes) o elige una foto más ligera.'
      );
      return;
    }

    setSavingForm(true);
    setErrorMessage('');
    try {
      const id =
        editingMoto?.id ||
        `${mBrand === 'VENTO' ? 'vento' : 'piston'}-${slugifyId(cleanModel) || Date.now()}`;

      const cleanCustomSpecs: Record<string, string> = {};
      for (const [k, v] of Object.entries(mCustomSpecs).slice(0, 40)) {
        const trimmed = v.trim().slice(0, 120);
        if (trimmed) cleanCustomSpecs[k] = trimmed;
      }

      await onSaveMotorcycle({
        id,
        brand: mBrand,
        family: mFamily.trim().slice(0, 48) || 'Urban Sport',
        model: cleanModel,
        displacementCc: Math.min(2500, Math.max(49, Math.round(Number(mCc) || 150))),
        engineType: cleanEngine,
        powerHp: cleanPower,
        transmission: cleanTrans,
        cooling: cleanCool,
        brakes: cleanBrakes,
        tankLiters: cleanTank,
        topSpeedKmh: Math.min(350, Math.max(10, Math.round(Number(mSpeed) || 90))),
        breakInNotes: cleanBreakIn,
        imageUrl: cleanImage,
        isActive: editingMoto ? editingMoto.isActive : true,
        highlights: mHighlights
          .split(',')
          .map((s) => s.trim().slice(0, 120))
          .filter(Boolean)
          .slice(0, 8),
        customSpecs: cleanCustomSpecs,
        hiddenFields: mHiddenFields.slice(0, 40),
      });
      setMotoModalOpen(false);
      setStatusMessage(`Unidad "${cleanModel}" guardada correctamente.`);
    } catch (err) {
      setErrorMessage(formatAdminError(err, 'Error al guardar unidad.'));
    } finally {
      setSavingForm(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setErrorMessage('');
    try {
      const compressed = await compressImageToDataUrl(file);
      setMImage(compressed);
    } catch (err) {
      setErrorMessage(formatAdminError(err, 'Error procesando foto.'));
    }
  };

  const handleMotoDriveFilePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setErrorMessage('');
    setPendingDriveMotoFile(file);
  };

  const handleConfirmMotoDriveUpload = async () => {
    if (!pendingDriveMotoFile) return;
    const fileToUpload = pendingDriveMotoFile;
    setUploadingDrivePhoto(true);
    setErrorMessage('');
    try {
      const token = await onConnectGoogleSheets();
      const folders =
        driveFolders || (await ensureAcademiaWorkspaceFolders(token));
      onSetDriveFolders(folders);
      const cleanName = mModel.trim()
        ? `${slugifyId(mModel) || 'moto'}-${fileToUpload.name}`
        : fileToUpload.name;
      const uploaded = await uploadImageToDriveFolder(
        token,
        fileToUpload,
        folders.imagesFolderId,
        cleanName
      );
      setMImage(uploaded.imageUrl);
      setMotoDriveImages((prev) => [uploaded, ...prev]);
      setPendingDriveMotoFile(null);
      setStatusMessage(
        `Foto "${uploaded.name}" subida a "academia/imagenes" en Google Drive.`
      );
    } catch (err) {
      setErrorMessage(
        formatAdminError(err, 'Error al subir imagen a Google Drive.')
      );
    } finally {
      setUploadingDrivePhoto(false);
    }
  };

  const handleLoadMotoDriveImages = async () => {
    setUploadingDrivePhoto(true);
    setErrorMessage('');
    try {
      const token = await onConnectGoogleSheets();
      const folders =
        driveFolders || (await ensureAcademiaWorkspaceFolders(token));
      onSetDriveFolders(folders);
      const list = await listDriveImagesInFolder(token, folders.imagesFolderId);
      setMotoDriveImages(list);
    } catch (err) {
      setErrorMessage(
        formatAdminError(err, 'No se pudo listar la carpeta academia/imagenes.')
      );
    } finally {
      setUploadingDrivePhoto(false);
    }
  };

  // --- Spec Fields Handlers ---
  const openNewSpecField = () => {
    setEditingSpecField(null);
    setSfLabel('');
    setSfSection('Equipamiento y Tecnología');
    setSfOrder(String(specFields.length + 1));
    setSfPlaceholder('');
    setSfVisible(true);
    setErrorMessage('');
    setSpecFieldModalOpen(true);
  };

  const openEditSpecField = (field: SpecFieldConfig) => {
    setEditingSpecField(field);
    setSfLabel(field.label);
    setSfSection(field.section);
    setSfOrder(String(field.order));
    setSfPlaceholder(field.placeholder || '');
    setSfVisible(field.isVisible);
    setErrorMessage('');
    setSpecFieldModalOpen(true);
  };

  const handleSpecFieldSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanLabel = sfLabel.trim().slice(0, 80);
    if (!cleanLabel) return;
    setSavingForm(true);
    setErrorMessage('');
    try {
      const generatedKey = `custom_${slugifyFieldKey(cleanLabel) || Date.now()}`;
      const id = editingSpecField?.id || generatedKey;
      const key = editingSpecField?.key || generatedKey;
      await onSaveSpecField({
        id,
        key,
        label: cleanLabel,
        section: sfSection,
        isCore: editingSpecField ? editingSpecField.isCore : false,
        isVisible: sfVisible,
        order: Math.max(0, Math.min(500, Number(sfOrder) || 1)),
        placeholder: sfPlaceholder.trim().slice(0, 120),
      });
      setSpecFieldModalOpen(false);
      setStatusMessage(`Campo "${cleanLabel}" actualizado en fichas técnicas.`);
    } catch (err) {
      setErrorMessage(formatAdminError(err, 'Error al guardar campo.'));
    } finally {
      setSavingForm(false);
    }
  };

  // --- Quiz Questions & Templates Handlers ---
  const openNewQuestion = (initialKind: QuestionKind = 'fixed') => {
    setEditingQuestion(null);
    setQKind(initialKind);
    setQTopic('Especificaciones');
    setQBrand('AMBAS');
    if (initialKind === 'template') {
      setQSourceField('brakes');
      setQSourceSection('Ficha Técnica · Frenos y Suspensión');
      setQText('¿Qué sistema de frenos equipa la unidad {modelo} ({marca})?');
      setQExplanation(
        'La ficha técnica de {modelo} indica: {valor} en su apartado de Frenos y Suspensión.'
      );
      setQOpt0('Disco delantero y trasero');
      setQOpt1('Tambor delantero y trasero');
      setQOpt2('Disco delantero / Tambor trasero');
      setQOpt3('Doble disco ventilado ABS');
    } else {
      setQSourceField('manual');
      setQSourceSection('Póliza VENTO 2025');
      setQText('');
      setQExplanation('');
      setQOpt0('');
      setQOpt1('');
      setQOpt2('');
      setQOpt3('');
    }
    setQCorrectIdx(0);
    setQTargetScope('ALL');
    setQTargetFamily('Urban Sport');
    setQTargetModelIds([]);
    setErrorMessage('');
    setQuestionModalOpen(true);
  };

  const openEditQuestion = (item: AdminQuizItem) => {
    setEditingQuestion(item);
    setQKind(item.kind);
    setQTopic(item.topic);
    setQBrand(item.brand);
    setQSourceField(item.sourceField || 'manual');
    setQSourceSection(item.sourceSection || 'Ficha Técnica · Motor');
    setQText(item.question);
    setQOpt0(item.options[0] || '');
    setQOpt1(item.options[1] || '');
    setQOpt2(item.options[2] || '');
    setQOpt3(item.options[3] || '');
    setQCorrectIdx(item.correctIndex || 0);
    setQExplanation(item.explanation || '');
    setQTargetScope(item.targetScope || 'ALL');
    setQTargetFamily(item.targetFamily || 'Urban Sport');
    setQTargetModelIds([...(item.targetModelIds || [])]);
    setErrorMessage('');
    setQuestionModalOpen(true);
  };

  const handleTemplateSourceFieldChange = (fieldKey: string) => {
    setQSourceField(fieldKey);
    const found = specFields.find((f) => f.key === fieldKey);
    if (found) {
      setQSourceSection(`Ficha Técnica · ${found.section}`);
    }
  };

  const toggleTargetModelId = (motoId: string) => {
    setQTargetModelIds((prev) =>
      prev.includes(motoId)
        ? prev.filter((id) => id !== motoId)
        : [...prev, motoId]
    );
  };

  const handleQuestionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanQ = qText.trim().slice(0, 320);
    if (cleanQ.length < 5) {
      setErrorMessage('Escribe una pregunta de al menos 5 caracteres.');
      return;
    }

    const opts = [qOpt0, qOpt1, qOpt2, qOpt3]
      .map((s) => s.trim().slice(0, 200))
      .filter(Boolean);

    if (qKind === 'fixed' && opts.length < 2) {
      setErrorMessage(
        'Ingresa al menos 2 opciones de respuesta para una pregunta fija.'
      );
      return;
    }

    if (
      qKind === 'template' &&
      qTargetScope === 'MODELS' &&
      qTargetModelIds.length === 0
    ) {
      setErrorMessage(
        'Selecciona al menos 1 modelo o cambia el alcance a Todos / Familia.'
      );
      return;
    }

    setSavingForm(true);
    setErrorMessage('');
    try {
      const id =
        editingQuestion?.id ||
        `${qKind === 'template' ? 'tpl' : 'q'}-${slugifyId(cleanQ).slice(0, 30) || 'item'}-${Date.now().toString().slice(-5)}`;

      await onSaveQuizQuestion({
        id,
        kind: qKind,
        topic: qTopic,
        brand: qBrand,
        sourceSection: (qSourceSection.trim() || 'Ficha Técnica').slice(0, 100),
        sourceField: (qSourceField.trim() || 'manual').slice(0, 64),
        question: cleanQ,
        options: opts.slice(0, 4),
        correctIndex:
          qKind === 'fixed'
            ? Math.min(qCorrectIdx, Math.max(0, opts.length - 1))
            : 0,
        explanation: qExplanation.trim().slice(0, 500),
        targetScope: qKind === 'template' ? qTargetScope : 'ALL',
        targetFamily:
          qKind === 'template' && qTargetScope === 'FAMILY'
            ? qTargetFamily
            : '',
        targetModelIds:
          qKind === 'template' && qTargetScope === 'MODELS'
            ? qTargetModelIds.slice(0, 80)
            : [],
        isActive: editingQuestion ? editingQuestion.isActive : true,
      });

      setQuestionModalOpen(false);
      setStatusMessage(
        qKind === 'template'
          ? 'Plantilla multi-modelo actualizada en la sesión (recuerda guardar en Google Sheets).'
          : 'Pregunta de juego actualizada en la sesión (recuerda guardar en Google Sheets).'
      );
    } catch (err) {
      setErrorMessage(formatAdminError(err, 'Error al guardar la pregunta.'));
    } finally {
      setSavingForm(false);
    }
  };

  // --- Policies Handlers ---
  const openNewPolicy = () => {
    setEditingPolicy(null);
    setPBrand('VENTO');
    setPCategory('Condiciones');
    setPTitle('');
    setPSummary('');
    setPKeyRule('');
    setPDetails('');
    setPOrder(String(policies.length + 1));
    setErrorMessage('');
    setPolicyModalOpen(true);
  };

  const openEditPolicy = (p: WarrantyPolicy) => {
    setEditingPolicy(p);
    setPBrand(p.brand);
    setPCategory(p.category);
    setPTitle(p.title);
    setPSummary(p.summary);
    setPKeyRule(p.keyRule);
    setPDetails(p.details.join('\n'));
    setPOrder(String(p.order));
    setErrorMessage('');
    setPolicyModalOpen(true);
  };

  const handlePolicySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pTitle.trim() || !pSummary.trim()) return;
    setSavingForm(true);
    setErrorMessage('');
    try {
      const id =
        editingPolicy?.id ||
        `${pBrand === 'VENTO' ? 'vento' : 'piston'}-${slugifyId(pTitle) || Date.now()}`;
      await onSavePolicy({
        id,
        brand: pBrand,
        category: pCategory,
        title: pTitle.trim(),
        summary: pSummary.trim(),
        keyRule: pKeyRule.trim() || 'Vigente',
        details: pDetails
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean)
          .slice(0, 15),
        order: Number(pOrder) || 1,
        isActive: editingPolicy ? editingPolicy.isActive : true,
      });
      setPolicyModalOpen(false);
      setStatusMessage(`Tema de póliza "${pTitle.trim()}" guardado.`);
    } catch (err) {
      setErrorMessage(formatAdminError(err, 'Error al guardar póliza.'));
    } finally {
      setSavingForm(false);
    }
  };

  // --- TimeGuide Handlers ---
  const openNewGuide = () => {
    setEditingGuide(null);
    setGCode('VC20');
    setGSection('VC');
    setGComponent('');
    setGCuatri('30 días');
    setGMotoNet('30 días');
    setGMoto('30 días');
    setGNotes('Sometido a valoración por Soporte Técnico.');
    setGAccessories('');
    setErrorMessage('');
    setGuideModalOpen(true);
  };

  const openEditGuide = (g: TimeGuideEntry) => {
    setEditingGuide(g);
    setGCode(g.code);
    setGSection(g.section);
    setGComponent(g.component);
    setGCuatri(g.cuatrimotosTime);
    setGMotoNet(g.motonetasTime);
    setGMoto(g.motocicletasTime);
    setGNotes(g.notes);
    setGAccessories(g.accessories.join(', '));
    setErrorMessage('');
    setGuideModalOpen(true);
  };

  const handleGuideSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gCode.trim() || !gComponent.trim()) return;
    setSavingForm(true);
    setErrorMessage('');
    try {
      const id =
        editingGuide?.id ||
        gCode.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
      await onSaveTimeGuide({
        id,
        code: gCode.trim().toUpperCase(),
        section: gSection,
        component: gComponent.trim(),
        cuatrimotosTime: gCuatri.trim(),
        motonetasTime: gMotoNet.trim(),
        motocicletasTime: gMoto.trim(),
        notes: gNotes.trim(),
        accessories: gAccessories
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
          .slice(0, 15),
        isActive: editingGuide ? editingGuide.isActive : true,
      });
      setGuideModalOpen(false);
      setStatusMessage(
        `Componente "${gCode.trim().toUpperCase()}" actualizado.`
      );
    } catch (err) {
      setErrorMessage(
        formatAdminError(err, 'Error al guardar guía de tiempos.')
      );
    } finally {
      setSavingForm(false);
    }
  };

  const handleReloadSheet = async () => {
    setSyncing(true);
    setErrorMessage('');
    setStatusMessage('');
    try {
      await onReloadFromSheet();
      setStatusMessage(
        'Datos recargados directamente desde tu Google Sheet.'
      );
    } catch (err) {
      setErrorMessage(
        formatAdminError(err, 'Error recargando datos desde Google Sheets.')
      );
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Admin Header */}
      <section className="rounded-xl border border-zinc-200 bg-white p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold text-[#EA580C]">
              Consola de Supervisión · {user.email}
            </p>
            <h1 className="mt-1 font-display text-3xl font-bold text-zinc-950">
              Administración de Unidades, Fichas Técnicas y Preguntas
            </h1>
            <p className="mt-1 text-xs text-zinc-600">
              Toda la información nace de Google Sheets. Administra modelos vigentes, ajusta qué campos aparecen en las fichas técnicas, crea preguntas o plantillas multi-modelo y guarda los cambios en tu hoja.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {linkedSheet && (
              <button
                type="button"
                onClick={handleReloadSheet}
                disabled={syncing}
                className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3.5 py-2 text-xs font-semibold text-zinc-800 hover:bg-zinc-50 disabled:opacity-60 cursor-pointer"
              >
                <RefreshCw className={`h-3.5 w-3.5 text-emerald-700 ${syncing ? 'animate-spin' : ''}`} />
                {syncing ? 'Recargando...' : 'Recargar de Sheets'}
              </button>
            )}
            {pendingDataChanges > 0 && linkedSheet && (
              <button
                type="button"
                onClick={onRequestSaveChangesToSheet}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#EA580C] px-4 py-2 text-xs font-semibold text-white hover:bg-[#C2410C] cursor-pointer"
              >
                <Upload className="h-3.5 w-3.5" />
                Guardar Cambios en Sheets ({pendingDataChanges})
              </button>
            )}
          </div>
        </div>

        {!sheetLoaded && (
          <div className="mt-4 flex flex-col gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-950 sm:flex-row sm:items-center sm:justify-between">
            <span>
              <strong>Origen 100% Google Sheets:</strong> aún no hay una hoja de cálculo cargada en esta sesión. Conecta o busca tu carpeta <span className="font-mono font-semibold">academia</span> en la pestaña <strong>Drive y Sheets</strong> para cargar o crear la información.
            </span>
            {section !== 'sheets' && (
              <button
                type="button"
                onClick={() => setSection('sheets')}
                className="shrink-0 rounded-lg bg-zinc-950 px-3 py-1.5 text-xs font-semibold text-white hover:bg-zinc-800 cursor-pointer"
              >
                Ir a Drive y Sheets
              </button>
            )}
          </div>
        )}

        {sheetLoaded && pendingDataChanges > 0 && (
          <div className="mt-4 flex flex-col gap-3 rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 text-xs text-orange-950 sm:flex-row sm:items-center sm:justify-between">
            <span>
              Tienes <strong>{pendingDataChanges} cambio(s) pendiente(s)</strong> en esta sesión que aún no se han guardado en tu Google Sheet.
            </span>
            <button
              type="button"
              onClick={onRequestSaveChangesToSheet}
              className="shrink-0 rounded-lg bg-[#EA580C] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#C2410C] cursor-pointer"
            >
              Guardar en Google Sheets
            </button>
          </div>
        )}

        {statusMessage && (
          <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs text-emerald-800">
            {statusMessage}
          </div>
        )}

        {errorMessage && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-xs text-red-700">
            {errorMessage}
          </div>
        )}

        {/* Section Tabs */}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-4 border-t border-zinc-100 pt-5">
          <div className="flex flex-wrap rounded-lg border border-zinc-200 bg-zinc-50 p-1 gap-1">
            {(
              [
                { id: 'units', label: `Unidades (${motorcycles.length})` },
                {
                  id: 'specfields',
                  label: `Campos Ficha Técnica (${specFields.length})`,
                },
                {
                  id: 'questions',
                  label: `Preguntas de Juegos (${adminQuizItems.length})`,
                },
                { id: 'policies', label: `Pólizas (${policies.length})` },
                {
                  id: 'timeguides',
                  label: `Guía de Tiempos (${timeGuides.length})`,
                },
                {
                  id: 'sheets',
                  label: sheetLoaded
                    ? 'Drive y Sheets (Conectado)'
                    : 'Drive y Sheets',
                },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSection(tab.id)}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold whitespace-nowrap cursor-pointer ${
                  section === tab.id
                    ? tab.id === 'sheets'
                      ? 'bg-emerald-700 text-white'
                      : 'bg-zinc-950 text-white'
                    : 'text-zinc-600 hover:text-zinc-950'
                }`}
              >
                {tab.id === 'sheets' && (
                  <FileSpreadsheet className="h-3.5 w-3.5" />
                )}
                {tab.label}
              </button>
            ))}
          </div>

          {section === 'units' && (
            <button
              type="button"
              onClick={openNewMoto}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#EA580C] px-4 py-2 text-xs font-semibold text-white hover:bg-[#C2410C] cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              Subir Nueva Unidad
            </button>
          )}

          {section === 'specfields' && (
            <button
              type="button"
              onClick={openNewSpecField}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#EA580C] px-4 py-2 text-xs font-semibold text-white hover:bg-[#C2410C] cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              Agregar Campo a Ficha Técnica
            </button>
          )}

          {section === 'questions' && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => openNewQuestion('template')}
                className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-950 bg-zinc-950 px-3.5 py-2 text-xs font-semibold text-white hover:bg-zinc-800 cursor-pointer"
              >
                <Layers className="h-3.5 w-3.5" />
                Nueva Plantilla Multi-Modelo
              </button>
              <button
                type="button"
                onClick={() => openNewQuestion('fixed')}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#EA580C] px-4 py-2 text-xs font-semibold text-white hover:bg-[#C2410C] cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                Agregar Pregunta Fija
              </button>
            </div>
          )}

          {section === 'policies' && (
            <button
              type="button"
              onClick={openNewPolicy}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#EA580C] px-4 py-2 text-xs font-semibold text-white hover:bg-[#C2410C] cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              Agregar Tema de Póliza
            </button>
          )}

          {section === 'timeguides' && (
            <button
              type="button"
              onClick={openNewGuide}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#EA580C] px-4 py-2 text-xs font-semibold text-white hover:bg-[#C2410C] cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              Agregar Componente / Accesorio
            </button>
          )}
        </div>
      </section>

      {/* UNITS TABLE */}
      {section === 'units' && (
        <section className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50 text-zinc-500">
                  <th className="py-3 pl-6 pr-3 font-semibold">Unidad</th>
                  <th className="py-3 px-3 font-semibold">Marca · Familia</th>
                  <th className="py-3 px-3 font-semibold">Cilindrada</th>
                  <th className="py-3 px-3 font-semibold">Estado</th>
                  <th className="py-3 pl-3 pr-6 font-semibold text-right">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {motorcycles.map((m) => (
                  <tr
                    key={m.id}
                    className={
                      m.isActive
                        ? 'hover:bg-zinc-50'
                        : 'bg-zinc-50/70 text-zinc-400'
                    }
                  >
                    <td className="py-3 pl-6 pr-3">
                      <div className="flex items-center gap-3">
                        <img
                          src={m.imageUrl}
                          alt={m.model}
                          referrerPolicy="no-referrer"
                          className="h-10 w-14 rounded object-cover bg-zinc-900 shrink-0"
                        />
                        <span className="font-semibold text-zinc-950">
                          {m.model}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      {m.brand} · {m.family}
                    </td>
                    <td className="py-3 px-3 font-mono tabular-nums">
                      {m.displacementCc} cc
                    </td>
                    <td className="py-3 px-3 font-semibold">
                      {m.isActive ? (
                        <span className="text-emerald-700">Vigente</span>
                      ) : (
                        <span className="text-zinc-500">Dado de baja</span>
                      )}
                    </td>
                    <td className="py-3 pl-3 pr-6 text-right">
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openEditMoto(m)}
                          title="Editar unidad y campos"
                          className="rounded border border-zinc-200 p-1.5 text-zinc-600 hover:bg-zinc-100 cursor-pointer"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onToggleMotorcycleActive(m)}
                          title={m.isActive ? 'Dar de baja' : 'Reactivar'}
                          className="inline-flex items-center gap-1 rounded border border-zinc-200 px-2.5 py-1.5 text-[11px] font-semibold text-zinc-700 hover:bg-zinc-100 cursor-pointer"
                        >
                          {m.isActive ? (
                            <>
                              <EyeOff className="h-3.5 w-3.5" />
                              Dar de baja
                            </>
                          ) : (
                            <>
                              <Eye className="h-3.5 w-3.5" />
                              Reactivar
                            </>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteMotorcycle(m.id)}
                          title="Eliminar definitivamente"
                          className="rounded border border-red-200 p-1.5 text-red-600 hover:bg-red-50 cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* SPEC FIELDS MANAGER */}
      {section === 'specfields' && (
        <section className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
          <div className="flex flex-col gap-2 border-b border-zinc-200 bg-zinc-50/70 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-display text-xl font-bold text-zinc-950">
                Estructura y Visibilidad de la Ficha Técnica (Estilo VENTO)
              </h2>
              <p className="text-xs text-zinc-600">
                Activa o oculta cualquier campo en las fichas públicas del catálogo, cambia su sección o agrega nuevos campos personalizados (se capturan en cada unidad y pueden usarse en preguntas).
              </p>
            </div>
            <SlidersHorizontal className="h-5 w-5 text-[#EA580C] shrink-0" />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50 text-zinc-500">
                  <th className="py-3 pl-6 pr-3 font-semibold">Orden</th>
                  <th className="py-3 px-3 font-semibold">Campo / Etiqueta</th>
                  <th className="py-3 px-3 font-semibold">Sección Ficha VENTO</th>
                  <th className="py-3 px-3 font-semibold">Origen</th>
                  <th className="py-3 px-3 font-semibold">Visibilidad</th>
                  <th className="py-3 pl-3 pr-6 font-semibold text-right">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {specFields.map((f) => (
                  <tr
                    key={f.id}
                    className={
                      f.isVisible
                        ? 'hover:bg-zinc-50'
                        : 'bg-zinc-50/70 text-zinc-400'
                    }
                  >
                    <td className="py-3 pl-6 pr-3 font-mono font-semibold tabular-nums">
                      {f.order}
                    </td>
                    <td className="py-3 px-3">
                      <div className="font-semibold text-zinc-950">
                        {f.label}
                      </div>
                      <div className="font-mono text-[11px] text-zinc-400">
                        clave: {f.key}
                      </div>
                    </td>
                    <td className="py-3 px-3 font-medium text-zinc-700">
                      {f.section}
                    </td>
                    <td className="py-3 px-3 text-zinc-600">
                      {f.isCore ? 'Campo base' : 'Personalizado'}
                    </td>
                    <td className="py-3 px-3 font-semibold">
                      {f.isVisible ? (
                        <span className="text-emerald-700">
                          Visible en ficha
                        </span>
                      ) : (
                        <span className="text-zinc-500">Oculto</span>
                      )}
                    </td>
                    <td className="py-3 pl-3 pr-6 text-right">
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openEditSpecField(f)}
                          title="Editar etiqueta o sección"
                          className="rounded border border-zinc-200 p-1.5 text-zinc-600 hover:bg-zinc-100 cursor-pointer"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onToggleSpecFieldVisible(f)}
                          className="inline-flex items-center gap-1 rounded border border-zinc-200 px-2.5 py-1.5 text-[11px] font-semibold text-zinc-700 hover:bg-zinc-100 cursor-pointer"
                        >
                          {f.isVisible ? (
                            <>
                              <EyeOff className="h-3.5 w-3.5" />
                              Ocultar
                            </>
                          ) : (
                            <>
                              <Eye className="h-3.5 w-3.5" />
                              Mostrar
                            </>
                          )}
                        </button>
                        {!f.isCore && (
                          <button
                            type="button"
                            onClick={() => onDeleteSpecField(f.id)}
                            title="Eliminar campo personalizado"
                            className="rounded border border-red-200 p-1.5 text-red-600 hover:bg-red-50 cursor-pointer"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* QUESTIONS & MULTI-MODEL TEMPLATES MANAGER */}
      {section === 'questions' && (
        <section className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
          <div className="flex flex-col gap-4 border-b border-zinc-200 bg-zinc-50/70 p-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="font-display text-xl font-bold text-zinc-950">
                Banco de Preguntas y Plantillas Multi-Modelo
              </h2>
              <p className="mt-0.5 text-xs text-zinc-600">
                Total de reactivos activos en juegos (Entrenamiento + Checkpoints Ruta VENTO):{' '}
                <strong className="font-mono text-[#EA580C]">
                  {generatedTotalCount} preguntas en vivo
                </strong>
                . Las plantillas generan automáticamente la misma pregunta adaptada a cada modelo seleccionado.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex rounded-lg border border-zinc-200 bg-white p-1">
                {(
                  [
                    { id: 'ALL', label: 'Todas' },
                    { id: 'fixed', label: 'Fijas' },
                    { id: 'template', label: 'Multi-Modelo' },
                  ] as const
                ).map((k) => (
                  <button
                    key={k.id}
                    type="button"
                    onClick={() => setQKindFilter(k.id)}
                    className={`rounded-md px-2.5 py-1 text-xs font-semibold whitespace-nowrap cursor-pointer ${
                      qKindFilter === k.id
                        ? 'bg-zinc-950 text-white'
                        : 'text-zinc-600 hover:text-zinc-950'
                    }`}
                  >
                    {k.label}
                  </button>
                ))}
              </div>

              <select
                value={qTopicFilter}
                onChange={(e) =>
                  setQTopicFilter(
                    e.target.value as 'ALL' | Exclude<QuizTopic, 'Mixto'>
                  )
                }
                className="rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-zinc-800"
              >
                <option value="ALL">Todos los temas</option>
                <option value="Especificaciones">Especificaciones</option>
                <option value="Familias">Familias</option>
                <option value="Garantías">Garantías</option>
                <option value="Guía de Tiempos">Guía de Tiempos</option>
              </select>

              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
                <input
                  type="text"
                  value={qSearch}
                  onChange={(e) => setQSearch(e.target.value)}
                  placeholder="Buscar pregunta o apartado..."
                  className="rounded-lg border border-zinc-300 bg-white py-1.5 pl-8 pr-3 text-xs text-zinc-900"
                />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50 text-zinc-500">
                  <th className="py-3 pl-6 pr-3 font-semibold">Tipo / Alcance</th>
                  <th className="py-3 px-3 font-semibold">Pregunta / Plantilla</th>
                  <th className="py-3 px-3 font-semibold">Apartado / Campo Fuente</th>
                  <th className="py-3 px-3 font-semibold">Tema · Marca</th>
                  <th className="py-3 px-3 font-semibold">Estado</th>
                  <th className="py-3 pl-3 pr-6 font-semibold text-right">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {filteredQuestions.map((item) => {
                  const scopeSummary =
                    item.kind === 'fixed'
                      ? 'Pregunta fija'
                      : item.targetScope === 'ALL'
                        ? 'Plantilla · Todos los modelos'
                        : item.targetScope === 'FAMILY'
                          ? `Plantilla · Familia ${item.targetFamily}`
                          : `Plantilla · ${item.targetModelIds.length} modelos`;
                  return (
                    <tr
                      key={item.id}
                      className={
                        item.isActive
                          ? 'hover:bg-zinc-50'
                          : 'bg-zinc-50/70 text-zinc-400'
                      }
                    >
                      <td className="py-3 pl-6 pr-3 whitespace-nowrap">
                        <span
                          className={`font-semibold ${
                            item.kind === 'template'
                              ? 'text-[#EA580C]'
                              : 'text-zinc-900'
                          }`}
                        >
                          {scopeSummary}
                        </span>
                      </td>
                      <td className="py-3 px-3 max-w-md">
                        <div className="font-semibold text-zinc-950 line-clamp-2">
                          {item.question}
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-medium text-zinc-800">
                          {item.sourceSection}
                        </div>
                        <div className="font-mono text-[11px] text-zinc-400">
                          campo: {item.sourceField}
                        </div>
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        {item.topic} · {item.brand}
                      </td>
                      <td className="py-3 px-3 font-semibold whitespace-nowrap">
                        {item.isActive ? (
                          <span className="text-emerald-700">Activa</span>
                        ) : (
                          <span className="text-zinc-500">Desactivada</span>
                        )}
                      </td>
                      <td className="py-3 pl-3 pr-6 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => openEditQuestion(item)}
                            title="Editar pregunta o plantilla"
                            className="rounded border border-zinc-200 p-1.5 text-zinc-600 hover:bg-zinc-100 cursor-pointer"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onToggleQuizQuestionActive(item)}
                            className="inline-flex items-center gap-1 rounded border border-zinc-200 px-2.5 py-1.5 text-[11px] font-semibold text-zinc-700 hover:bg-zinc-100 cursor-pointer"
                          >
                            {item.isActive ? 'Desactivar' : 'Activar'}
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteQuizQuestion(item.id)}
                            title="Eliminar pregunta"
                            className="rounded border border-red-200 p-1.5 text-red-600 hover:bg-red-50 cursor-pointer"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* POLICIES TABLE */}
      {section === 'policies' && (
        <section className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50 text-zinc-500">
                  <th className="py-3 pl-6 pr-3 font-semibold">Título</th>
                  <th className="py-3 px-3 font-semibold">Marca · Categoría</th>
                  <th className="py-3 px-3 font-semibold">Estado</th>
                  <th className="py-3 pl-3 pr-6 font-semibold text-right">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {policies.map((p) => (
                  <tr
                    key={p.id}
                    className={
                      p.isActive
                        ? 'hover:bg-zinc-50'
                        : 'bg-zinc-50/70 text-zinc-400'
                    }
                  >
                    <td className="py-3 pl-6 pr-3 font-semibold text-zinc-950">
                      {p.title}
                    </td>
                    <td className="py-3 px-3">
                      {p.brand} · {p.category}
                    </td>
                    <td className="py-3 px-3 font-semibold">
                      {p.isActive ? (
                        <span className="text-emerald-700">Vigente</span>
                      ) : (
                        <span className="text-zinc-500">Dado de baja</span>
                      )}
                    </td>
                    <td className="py-3 pl-3 pr-6 text-right">
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openEditPolicy(p)}
                          className="rounded border border-zinc-200 p-1.5 text-zinc-600 hover:bg-zinc-100 cursor-pointer"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onTogglePolicyActive(p)}
                          className="inline-flex items-center gap-1 rounded border border-zinc-200 px-2.5 py-1.5 text-[11px] font-semibold text-zinc-700 hover:bg-zinc-100 cursor-pointer"
                        >
                          {p.isActive ? 'Dar de baja' : 'Reactivar'}
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeletePolicy(p.id)}
                          className="rounded border border-red-200 p-1.5 text-red-600 hover:bg-red-50 cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* TIME GUIDES TABLE */}
      {section === 'timeguides' && (
        <section className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50 text-zinc-500">
                  <th className="py-3 pl-6 pr-3 font-semibold">Código</th>
                  <th className="py-3 px-3 font-semibold">Componente</th>
                  <th className="py-3 px-3 font-semibold">Accesorios</th>
                  <th className="py-3 px-3 font-semibold">Estado</th>
                  <th className="py-3 pl-3 pr-6 font-semibold text-right">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {timeGuides.map((g) => (
                  <tr
                    key={g.id}
                    className={
                      g.isActive
                        ? 'hover:bg-zinc-50'
                        : 'bg-zinc-50/70 text-zinc-400'
                    }
                  >
                    <td className="py-3 pl-6 pr-3 font-mono font-semibold text-[#EA580C]">
                      {g.code}
                    </td>
                    <td className="py-3 px-3 font-semibold text-zinc-950">
                      {g.component}
                    </td>
                    <td className="py-3 px-3 font-mono tabular-nums text-zinc-600">
                      {g.accessories.length} piezas
                    </td>
                    <td className="py-3 px-3 font-semibold">
                      {g.isActive ? (
                        <span className="text-emerald-700">Vigente</span>
                      ) : (
                        <span className="text-zinc-500">Dado de baja</span>
                      )}
                    </td>
                    <td className="py-3 pl-3 pr-6 text-right">
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openEditGuide(g)}
                          className="rounded border border-zinc-200 p-1.5 text-zinc-600 hover:bg-zinc-100 cursor-pointer"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onToggleTimeGuideActive(g)}
                          className="inline-flex items-center gap-1 rounded border border-zinc-200 px-2.5 py-1.5 text-[11px] font-semibold text-zinc-700 hover:bg-zinc-100 cursor-pointer"
                        >
                          {g.isActive ? 'Dar de baja' : 'Reactivar'}
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteTimeGuide(g.id)}
                          className="rounded border border-red-200 p-1.5 text-red-600 hover:bg-red-50 cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* GOOGLE SHEETS & DRIVE CONTROL CENTER */}
      {section === 'sheets' && (
        <GoogleSheetsPanel
          hasSheetsToken={hasSheetsToken}
          onConnectGoogleSheets={onConnectGoogleSheets}
          onForceReconnectGoogle={onForceReconnectGoogle}
          driveFolders={driveFolders}
          onSetDriveFolders={onSetDriveFolders}
          linkedSheet={linkedSheet}
          onSetLinkedSheet={onSetLinkedSheet}
          sheetLoaded={sheetLoaded}
          sheetLoadedAt={sheetLoadedAt}
          pendingDataChanges={pendingDataChanges}
          onApplySheetData={onApplySheetData}
          onClearPendingChanges={onClearPendingChanges}
          currentData={{
            motorcycles,
            specFields,
            adminQuizItems,
            policies,
            timeGuides,
          }}
          leaderboard={leaderboard}
          onNotify={(msg) => {
            setErrorMessage('');
            setStatusMessage(msg);
          }}
          onError={(err) => {
            if (err) setStatusMessage('');
            setErrorMessage(err);
          }}
        />
      )}

      {/* MOTORCYCLE MODAL (with Custom Spec Fields + Per-Unit Visibility) */}
      {motoModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/60 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-zinc-200 bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-4">
              <h2 className="font-display text-2xl font-bold text-zinc-950">
                {editingMoto
                  ? `Editar ${editingMoto.model}`
                  : 'Subir Nueva Unidad'}
              </h2>
              <button
                type="button"
                onClick={() => setMotoModalOpen(false)}
                className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleMotoSubmit} className="mt-5 space-y-4 text-xs">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label className="block font-semibold text-zinc-700">
                    Marca
                  </label>
                  <select
                    value={mBrand}
                    onChange={(e) => setMBrand(e.target.value as Brand)}
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2"
                  >
                    <option value="VENTO">VENTO</option>
                    <option value="AMERICAN PISTON">AMERICAN PISTON</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-zinc-700">
                    Familia
                  </label>
                  <select
                    value={mFamily}
                    onChange={(e) => setMFamily(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2"
                  >
                    {FAMILIES.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-zinc-700">
                    Cilindrada (cc)
                  </label>
                  <input
                    type="number"
                    required
                    min={49}
                    max={2500}
                    value={mCc}
                    onChange={(e) => setMCc(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block font-semibold text-zinc-700">
                    Nombre del Modelo
                  </label>
                  <input
                    type="text"
                    required
                    minLength={2}
                    maxLength={80}
                    value={mModel}
                    onChange={(e) => setMModel(e.target.value)}
                    placeholder="Ej. Screamer Sportivo 300"
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-zinc-700">
                    Motor
                  </label>
                  <input
                    type="text"
                    required
                    minLength={2}
                    maxLength={120}
                    value={mEngine}
                    onChange={(e) => setMEngine(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div>
                  <label className="block font-semibold text-zinc-700">
                    Potencia
                  </label>
                  <input
                    type="text"
                    required
                    minLength={1}
                    maxLength={40}
                    value={mPower}
                    onChange={(e) => setMPower(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-zinc-700">
                    Vel. Máx (km/h)
                  </label>
                  <input
                    type="number"
                    required
                    min={10}
                    max={350}
                    value={mSpeed}
                    onChange={(e) => setMSpeed(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-zinc-700">
                    Tanque
                  </label>
                  <input
                    type="text"
                    required
                    minLength={1}
                    maxLength={30}
                    value={mTank}
                    onChange={(e) => setMTank(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-zinc-700">
                    Enfriamiento
                  </label>
                  <input
                    type="text"
                    required
                    minLength={2}
                    maxLength={60}
                    value={mCool}
                    onChange={(e) => setMCool(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block font-semibold text-zinc-700">
                    Transmisión
                  </label>
                  <input
                    type="text"
                    required
                    minLength={2}
                    maxLength={80}
                    value={mTrans}
                    onChange={(e) => setMTrans(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-zinc-700">
                    Frenos
                  </label>
                  <input
                    type="text"
                    required
                    minLength={2}
                    maxLength={80}
                    value={mBrakes}
                    onChange={(e) => setMBrakes(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2"
                  />
                </div>
              </div>

              {/* Dynamic Custom Spec Fields configured by Admin */}
              {customSpecFields.length > 0 && (
                <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 space-y-3">
                  <div className="font-semibold text-zinc-900">
                    Campos Personalizados de Ficha Técnica
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {customSpecFields.map((field) => (
                      <div key={field.key}>
                        <label className="block font-medium text-zinc-700">
                          {field.label}{' '}
                          <span className="text-zinc-400">
                            ({field.section})
                          </span>
                        </label>
                        <input
                          type="text"
                          maxLength={120}
                          value={mCustomSpecs[field.key] || ''}
                          onChange={(e) =>
                            setMCustomSpecs((prev) => ({
                              ...prev,
                              [field.key]: e.target.value,
                            }))
                          }
                          placeholder={field.placeholder || 'Valor en ficha...'}
                          className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Per-Unit Hidden Fields Toggle */}
              <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
                <div className="font-semibold text-zinc-900">
                  Ocultar campos específicos en esta unidad (opcional)
                </div>
                <p className="mt-0.5 text-[11px] text-zinc-500">
                  Marca los campos que NO deseas mostrar en la ficha técnica pública de este modelo.
                </p>
                <div className="mt-2.5 flex flex-wrap gap-2">
                  {specFields.map((field) => {
                    const isHidden = mHiddenFields.includes(field.key);
                    return (
                      <button
                        key={field.key}
                        type="button"
                        onClick={() => toggleMotoHiddenField(field.key)}
                        className={`rounded-md border px-2.5 py-1 text-[11px] font-medium cursor-pointer transition-colors ${
                          isHidden
                            ? 'border-red-300 bg-red-50 text-red-700 line-through'
                            : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300'
                        }`}
                      >
                        {field.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block font-semibold text-zinc-700">
                  Fotografía de la Unidad (Google Drive, archivo local o estudio)
                </label>
                <div className="mt-1.5 flex flex-wrap items-center gap-2.5">
                  <label className="inline-flex items-center gap-1.5 rounded-lg bg-[#EA580C] px-3 py-2 font-semibold text-white hover:bg-[#C2410C] cursor-pointer">
                    <ImagePlus className="h-3.5 w-3.5" />
                    Subir a Drive (academia/imagenes)
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleMotoDriveFilePick}
                      className="hidden"
                    />
                  </label>
                  <button
                    type="button"
                    disabled={uploadingDrivePhoto}
                    onClick={handleLoadMotoDriveImages}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 py-2 font-semibold text-zinc-800 hover:bg-zinc-50 cursor-pointer"
                  >
                    <FolderPlus className="h-3.5 w-3.5 text-emerald-700" />
                    Elegir de Drive
                  </button>
                  <label className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2 font-semibold text-zinc-800 hover:bg-zinc-100 cursor-pointer">
                    <Upload className="h-3.5 w-3.5" />
                    Foto Local
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                  </label>
                  <select
                    value={
                      STUDIO_PHOTO_PRESETS.some((p) => p.url === mImage)
                        ? mImage
                        : ''
                    }
                    onChange={(e) => {
                      if (e.target.value) setMImage(e.target.value);
                    }}
                    className="rounded-lg border border-zinc-300 px-3 py-2"
                  >
                    <option value="">Elegir foto de estudio base...</option>
                    {STUDIO_PHOTO_PRESETS.map((preset) => (
                      <option key={preset.label} value={preset.url}>
                        {preset.label}
                      </option>
                    ))}
                  </select>
                </div>

                {pendingDriveMotoFile && (
                  <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950">
                    <span>
                      ¿Confirmas subir <strong>&quot;{pendingDriveMotoFile.name}&quot;</strong> a la carpeta{' '}
                      <strong className="font-mono">academia/imagenes</strong> de tu Google Drive?
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={uploadingDrivePhoto}
                        onClick={() => setPendingDriveMotoFile(null)}
                        className="rounded border border-amber-300 bg-white px-2.5 py-1 font-semibold text-zinc-700 cursor-pointer"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        disabled={uploadingDrivePhoto}
                        onClick={handleConfirmMotoDriveUpload}
                        className="rounded bg-[#EA580C] px-3 py-1 font-semibold text-white hover:bg-[#C2410C] disabled:opacity-60 cursor-pointer"
                      >
                        {uploadingDrivePhoto ? 'Subiendo...' : 'Confirmar y Subir'}
                      </button>
                    </div>
                  </div>
                )}

                {motoDriveImages.length > 0 && (
                  <div className="mt-2.5 rounded-lg border border-zinc-200 bg-zinc-50 p-2.5">
                    <div className="mb-2 text-[11px] font-semibold text-zinc-700">
                      Fotos en Google Drive (academia/imagenes):
                    </div>
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {motoDriveImages.map((img) => (
                        <button
                          key={img.id}
                          type="button"
                          onClick={() => setMImage(img.imageUrl)}
                          className={`shrink-0 overflow-hidden rounded border text-left cursor-pointer ${
                            mImage === img.imageUrl
                              ? 'border-[#EA580C] ring-2 ring-[#EA580C]/30'
                              : 'border-zinc-200'
                          }`}
                        >
                          <img
                            src={img.imageUrl}
                            alt={img.name}
                            referrerPolicy="no-referrer"
                            className="h-14 w-20 object-cover bg-zinc-900"
                          />
                          <div className="w-20 truncate bg-white px-1 py-0.5 text-[10px] text-zinc-700">
                            {img.name}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {mImage && (
                  <img
                    src={mImage}
                    alt="Vista previa"
                    referrerPolicy="no-referrer"
                    className="mt-2 h-28 w-40 rounded-lg border border-zinc-200 object-cover bg-zinc-900"
                  />
                )}
              </div>

              <div>
                <label className="block font-semibold text-zinc-700">
                  Notas de Asentamiento y Garantía
                </label>
                <textarea
                  rows={2}
                  required
                  minLength={2}
                  maxLength={300}
                  value={mBreakIn}
                  onChange={(e) => setMBreakIn(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2"
                />
              </div>

              <div>
                <label className="block font-semibold text-zinc-700">
                  Puntos Clave (separados por coma)
                </label>
                <input
                  type="text"
                  value={mHighlights}
                  onChange={(e) => setMHighlights(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2"
                />
              </div>

              {errorMessage && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  {errorMessage}
                </div>
              )}

              <div className="flex justify-end gap-3 border-t border-zinc-100 pt-4">
                <button
                  type="button"
                  onClick={() => setMotoModalOpen(false)}
                  className="rounded-lg border border-zinc-300 px-4 py-2 font-semibold text-zinc-700 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingForm}
                  className="rounded-lg bg-[#EA580C] px-5 py-2 font-semibold text-white hover:bg-[#C2410C] disabled:opacity-60 cursor-pointer"
                >
                  {savingForm ? 'Guardando...' : 'Guardar Unidad'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SPEC FIELD MODAL */}
      {specFieldModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/60 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-lg rounded-xl border border-zinc-200 bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-4">
              <h2 className="font-display text-2xl font-bold text-zinc-950">
                {editingSpecField
                  ? `Editar Campo: ${editingSpecField.label}`
                  : 'Agregar Campo a Ficha Técnica'}
              </h2>
              <button
                type="button"
                onClick={() => setSpecFieldModalOpen(false)}
                className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form
              onSubmit={handleSpecFieldSubmit}
              className="mt-5 space-y-4 text-xs"
            >
              <div>
                <label className="block font-semibold text-zinc-700">
                  Nombre / Etiqueta del Campo
                </label>
                <input
                  type="text"
                  required
                  maxLength={80}
                  value={sfLabel}
                  onChange={(e) => setSfLabel(e.target.value)}
                  placeholder="Ej. Altura del asiento, Llanta delantera, Peso en seco"
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-zinc-700">
                    Sección en Ficha VENTO
                  </label>
                  <select
                    value={sfSection}
                    onChange={(e) =>
                      setSfSection(e.target.value as SpecSection)
                    }
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2"
                  >
                    {SPEC_SECTIONS.map((sec) => (
                      <option key={sec} value={sec}>
                        {sec}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-zinc-700">
                    Orden de aparición
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={500}
                    value={sfOrder}
                    onChange={(e) => setSfOrder(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-zinc-700">
                  Ejemplo / Placeholder para captura (opcional)
                </label>
                <input
                  type="text"
                  maxLength={120}
                  value={sfPlaceholder}
                  onChange={(e) => setSfPlaceholder(e.target.value)}
                  placeholder="Ej. 780 mm / 110/70-17"
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2"
                />
              </div>

              <label className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={sfVisible}
                  onChange={(e) => setSfVisible(e.target.checked)}
                />
                <span className="font-semibold text-zinc-800">
                  Visible en fichas técnicas públicas del catálogo
                </span>
              </label>

              {errorMessage && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  {errorMessage}
                </div>
              )}

              <div className="flex justify-end gap-3 border-t border-zinc-100 pt-4">
                <button
                  type="button"
                  onClick={() => setSpecFieldModalOpen(false)}
                  className="rounded-lg border border-zinc-300 px-4 py-2 font-semibold text-zinc-700 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingForm}
                  className="rounded-lg bg-[#EA580C] px-5 py-2 font-semibold text-white hover:bg-[#C2410C] disabled:opacity-60 cursor-pointer"
                >
                  {savingForm ? 'Guardando...' : 'Guardar Campo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QUESTION / MULTI-MODEL TEMPLATE MODAL */}
      {questionModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/60 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-zinc-200 bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-4">
              <h2 className="font-display text-2xl font-bold text-zinc-950">
                {editingQuestion
                  ? 'Editar Pregunta / Plantilla'
                  : qKind === 'template'
                    ? 'Nueva Plantilla Multi-Modelo'
                    : 'Nueva Pregunta de Juego'}
              </h2>
              <button
                type="button"
                onClick={() => setQuestionModalOpen(false)}
                className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form
              onSubmit={handleQuestionSubmit}
              className="mt-5 space-y-4 text-xs"
            >
              {/* Kind switcher */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setQKind('fixed')}
                  className={`rounded-lg border p-3 text-left cursor-pointer ${
                    qKind === 'fixed'
                      ? 'border-zinc-950 bg-zinc-950 text-white'
                      : 'border-zinc-200 bg-zinc-50 text-zinc-700'
                  }`}
                >
                  <div className="font-bold">Pregunta Fija</div>
                  <div className="mt-0.5 text-[11px] opacity-80">
                    Pregunta específica con 4 opciones manuales.
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setQKind('template')}
                  className={`rounded-lg border p-3 text-left cursor-pointer ${
                    qKind === 'template'
                      ? 'border-[#EA580C] bg-[#EA580C]/10 text-zinc-950'
                      : 'border-zinc-200 bg-zinc-50 text-zinc-700'
                  }`}
                >
                  <div className="font-bold">Plantilla Multi-Modelo</div>
                  <div className="mt-0.5 text-[11px] text-zinc-600">
                    Misma pregunta aplicada a varios modelos leyendo un campo de la ficha.
                  </div>
                </button>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block font-semibold text-zinc-700">
                    Tema en Juegos
                  </label>
                  <select
                    value={qTopic}
                    onChange={(e) =>
                      setQTopic(
                        e.target.value as Exclude<QuizTopic, 'Mixto'>
                      )
                    }
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2"
                  >
                    <option value="Especificaciones">Especificaciones</option>
                    <option value="Familias">Familias</option>
                    <option value="Garantías">Garantías</option>
                    <option value="Guía de Tiempos">Guía de Tiempos</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-zinc-700">
                    Marca
                  </label>
                  <select
                    value={qBrand}
                    onChange={(e) =>
                      setQBrand(e.target.value as Brand | 'AMBAS')
                    }
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2"
                  >
                    <option value="AMBAS">AMBAS (VENTO y Pistón)</option>
                    <option value="VENTO">VENTO</option>
                    <option value="AMERICAN PISTON">AMERICAN PISTON</option>
                  </select>
                </div>
              </div>

              {/* Apartado / Campo fuente */}
              <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 space-y-3">
                <div className="font-semibold text-zinc-900">
                  ¿De qué apartado / característica se obtiene la información?
                </div>

                {qKind === 'template' ? (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="block font-medium text-zinc-700">
                        Campo de la Ficha Técnica (respuesta correcta)
                      </label>
                      <select
                        value={qSourceField}
                        onChange={(e) =>
                          handleTemplateSourceFieldChange(e.target.value)
                        }
                        className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2"
                      >
                        <option value="family">Familia</option>
                        {specFields.map((f) => (
                          <option key={f.key} value={f.key}>
                            {f.label} ({f.section})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block font-medium text-zinc-700">
                        Etiqueta del Apartado Fuente
                      </label>
                      <input
                        type="text"
                        required
                        maxLength={100}
                        value={qSourceSection}
                        onChange={(e) => setQSourceSection(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="block font-medium text-zinc-700">
                        Apartado de Origen
                      </label>
                      <select
                        value={
                          SOURCE_SECTION_PRESETS.includes(qSourceSection)
                            ? qSourceSection
                            : '__custom__'
                        }
                        onChange={(e) => {
                          if (e.target.value !== '__custom__') {
                            setQSourceSection(e.target.value);
                          }
                        }}
                        className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2"
                      >
                        {SOURCE_SECTION_PRESETS.map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                        <option value="__custom__">Otro apartado...</option>
                      </select>
                    </div>
                    <div>
                      <label className="block font-medium text-zinc-700">
                        Nombre exacto del Apartado (editable)
                      </label>
                      <input
                        type="text"
                        required
                        maxLength={100}
                        value={qSourceSection}
                        onChange={(e) => setQSourceSection(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Multi-model target scope */}
              {qKind === 'template' && (
                <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 space-y-3">
                  <div className="font-semibold text-zinc-900">
                    Modelos a los que aplica esta plantilla
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(
                      [
                        { id: 'ALL', label: 'Todos los modelos vigentes' },
                        { id: 'FAMILY', label: 'Por Familia específica' },
                        { id: 'MODELS', label: 'Seleccionar modelos exactos' },
                      ] as const
                    ).map((sc) => (
                      <button
                        key={sc.id}
                        type="button"
                        onClick={() => setQTargetScope(sc.id)}
                        className={`rounded-md border px-3 py-1.5 text-xs font-semibold cursor-pointer ${
                          qTargetScope === sc.id
                            ? 'border-zinc-950 bg-zinc-950 text-white'
                            : 'border-zinc-200 bg-white text-zinc-700'
                        }`}
                      >
                        {sc.label}
                      </button>
                    ))}
                  </div>

                  {qTargetScope === 'FAMILY' && (
                    <select
                      value={qTargetFamily}
                      onChange={(e) => setQTargetFamily(e.target.value)}
                      className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2"
                    >
                      {FAMILIES.map((fam) => (
                        <option key={fam} value={fam}>
                          {fam}
                        </option>
                      ))}
                    </select>
                  )}

                  {qTargetScope === 'MODELS' && (
                    <div className="max-h-40 overflow-y-auto rounded-lg border border-zinc-200 bg-white p-2.5 grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                      {motorcycles.map((m) => {
                        const checked = qTargetModelIds.includes(m.id);
                        return (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => toggleTargetModelId(m.id)}
                            className={`rounded border px-2 py-1 text-left text-[11px] truncate cursor-pointer ${
                              checked
                                ? 'border-[#EA580C] bg-[#EA580C]/10 font-semibold text-zinc-950'
                                : 'border-zinc-200 text-zinc-600'
                            }`}
                          >
                            {m.model}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              <div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="font-semibold text-zinc-700">
                    Texto de la Pregunta {qKind === 'template' && '(usa {modelo}, {marca}, {familia})'}
                  </label>
                  {qKind === 'template' && (
                    <div className="flex flex-wrap gap-1">
                      {['{modelo}', '{marca}', '{familia}', '{displacementCc}'].map(
                        (tok) => (
                          <button
                            key={tok}
                            type="button"
                            onClick={() =>
                              setQText((prev) =>
                                prev ? `${prev} ${tok}` : tok
                              )
                            }
                            className="rounded border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 font-mono text-[10px] text-zinc-700 hover:bg-zinc-100 cursor-pointer"
                          >
                            +{tok}
                          </button>
                        )
                      )}
                    </div>
                  )}
                </div>
                <textarea
                  rows={2}
                  required
                  maxLength={320}
                  value={qText}
                  onChange={(e) => setQText(e.target.value)}
                  placeholder={
                    qKind === 'template'
                      ? 'Ej. ¿Qué sistema de enfriamiento utiliza la unidad {modelo} ({marca})?'
                      : 'Escribe la pregunta exacta para tus asesores...'
                  }
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2"
                />
              </div>

              {qKind === 'fixed' ? (
                <div className="space-y-2">
                  <label className="block font-semibold text-zinc-700">
                    Opciones de Respuesta (marca la correcta)
                  </label>
                  {[0, 1, 2, 3].map((idx) => {
                    const val =
                      idx === 0
                        ? qOpt0
                        : idx === 1
                          ? qOpt1
                          : idx === 2
                            ? qOpt2
                            : qOpt3;
                    const setter =
                      idx === 0
                        ? setQOpt0
                        : idx === 1
                          ? setQOpt1
                          : idx === 2
                            ? setQOpt2
                            : setQOpt3;
                    return (
                      <div key={idx} className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="correctOpt"
                          checked={qCorrectIdx === idx}
                          onChange={() => setQCorrectIdx(idx)}
                          aria-label={`Opción ${String.fromCharCode(65 + idx)} correcta`}
                        />
                        <span className="font-mono font-bold text-zinc-500 w-4">
                          {String.fromCharCode(65 + idx)}.
                        </span>
                        <input
                          type="text"
                          required={idx < 2}
                          maxLength={200}
                          value={val}
                          onChange={(e) => setter(e.target.value)}
                          placeholder={`Opción ${String.fromCharCode(65 + idx)}`}
                          className="flex-1 rounded-lg border border-zinc-300 px-3 py-1.5"
                        />
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="space-y-2">
                  <label className="block font-semibold text-zinc-700">
                    Distractores de respaldo (opcionales; se completan automáticamente desde el catálogo)
                  </label>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <input
                      type="text"
                      maxLength={200}
                      value={qOpt0}
                      onChange={(e) => setQOpt0(e.target.value)}
                      placeholder="Distractor 1 (opcional)"
                      className="rounded-lg border border-zinc-300 px-3 py-1.5"
                    />
                    <input
                      type="text"
                      maxLength={200}
                      value={qOpt1}
                      onChange={(e) => setQOpt1(e.target.value)}
                      placeholder="Distractor 2 (opcional)"
                      className="rounded-lg border border-zinc-300 px-3 py-1.5"
                    />
                    <input
                      type="text"
                      maxLength={200}
                      value={qOpt2}
                      onChange={(e) => setQOpt2(e.target.value)}
                      placeholder="Distractor 3 (opcional)"
                      className="rounded-lg border border-zinc-300 px-3 py-1.5"
                    />
                    <input
                      type="text"
                      maxLength={200}
                      value={qOpt3}
                      onChange={(e) => setQOpt3(e.target.value)}
                      placeholder="Distractor 4 (opcional)"
                      className="rounded-lg border border-zinc-300 px-3 py-1.5"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block font-semibold text-zinc-700">
                  Explicación Técnica (usa {'{modelo}'} y {'{valor}'} en plantillas)
                </label>
                <textarea
                  rows={2}
                  maxLength={500}
                  value={qExplanation}
                  onChange={(e) => setQExplanation(e.target.value)}
                  placeholder="Ej. {modelo} equipa {valor} según la ficha oficial."
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2"
                />
              </div>

              {errorMessage && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  {errorMessage}
                </div>
              )}

              <div className="flex justify-end gap-3 border-t border-zinc-100 pt-4">
                <button
                  type="button"
                  onClick={() => setQuestionModalOpen(false)}
                  className="rounded-lg border border-zinc-300 px-4 py-2 font-semibold text-zinc-700 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingForm}
                  className="rounded-lg bg-[#EA580C] px-5 py-2 font-semibold text-white hover:bg-[#C2410C] disabled:opacity-60 cursor-pointer"
                >
                  {savingForm ? 'Guardando...' : 'Guardar en Banco de Preguntas'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* POLICY MODAL */}
      {policyModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/60 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-xl border border-zinc-200 bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-4">
              <h2 className="font-display text-2xl font-bold text-zinc-950">
                {editingPolicy
                  ? 'Editar Tema de Póliza'
                  : 'Nuevo Tema de Póliza'}
              </h2>
              <button
                type="button"
                onClick={() => setPolicyModalOpen(false)}
                className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form
              onSubmit={handlePolicySubmit}
              className="mt-5 space-y-4 text-xs"
            >
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-zinc-700">
                    Marca
                  </label>
                  <select
                    value={pBrand}
                    onChange={(e) => setPBrand(e.target.value as Brand)}
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2"
                  >
                    <option value="VENTO">VENTO</option>
                    <option value="AMERICAN PISTON">AMERICAN PISTON</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-zinc-700">
                    Categoría
                  </label>
                  <select
                    value={pCategory}
                    onChange={(e) =>
                      setPCategory(e.target.value as PolicyCategory)
                    }
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2"
                  >
                    {POLICY_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-zinc-700">
                    Orden
                  </label>
                  <input
                    type="number"
                    value={pOrder}
                    onChange={(e) => setPOrder(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-zinc-700">
                  Título
                </label>
                <input
                  type="text"
                  required
                  value={pTitle}
                  onChange={(e) => setPTitle(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2"
                />
              </div>

              <div>
                <label className="block font-semibold text-zinc-700">
                  Regla Clave Destacada
                </label>
                <input
                  type="text"
                  required
                  value={pKeyRule}
                  onChange={(e) => setPKeyRule(e.target.value)}
                  placeholder="Ej. 36 meses o 33,000 km · Solo reparación"
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-zinc-700">
                  Resumen
                </label>
                <textarea
                  rows={2}
                  required
                  value={pSummary}
                  onChange={(e) => setPSummary(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2"
                />
              </div>

              <div>
                <label className="block font-semibold text-zinc-700">
                  Puntos de Detalle (uno por línea)
                </label>
                <textarea
                  rows={4}
                  value={pDetails}
                  onChange={(e) => setPDetails(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2"
                />
              </div>

              {errorMessage && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  {errorMessage}
                </div>
              )}

              <div className="flex justify-end gap-3 border-t border-zinc-100 pt-4">
                <button
                  type="button"
                  onClick={() => setPolicyModalOpen(false)}
                  className="rounded-lg border border-zinc-300 px-4 py-2 font-semibold text-zinc-700 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingForm}
                  className="rounded-lg bg-[#EA580C] px-5 py-2 font-semibold text-white hover:bg-[#C2410C] disabled:opacity-60 cursor-pointer"
                >
                  {savingForm ? 'Guardando...' : 'Guardar Póliza'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TIME GUIDE MODAL */}
      {guideModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/60 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-xl border border-zinc-200 bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-4">
              <h2 className="font-display text-2xl font-bold text-zinc-950">
                {editingGuide
                  ? `Editar ${editingGuide.code}: ${editingGuide.component}`
                  : 'Nuevo Componente de Guía de Tiempos'}
              </h2>
              <button
                type="button"
                onClick={() => setGuideModalOpen(false)}
                className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form
              onSubmit={handleGuideSubmit}
              className="mt-5 space-y-4 text-xs"
            >
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-zinc-700">
                    Código
                  </label>
                  <input
                    type="text"
                    required
                    value={gCode}
                    onChange={(e) => setGCode(e.target.value)}
                    placeholder="VC20"
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-zinc-700">
                    Sección
                  </label>
                  <select
                    value={gSection}
                    onChange={(e) =>
                      setGSection(e.target.value as 'VC' | 'VM')
                    }
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2"
                  >
                    <option value="VC">VC (Carrocería)</option>
                    <option value="VM">VM (Motor)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-zinc-700">
                    Componente
                  </label>
                  <input
                    type="text"
                    required
                    value={gComponent}
                    onChange={(e) => setGComponent(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label className="block font-semibold text-zinc-700">
                    Cuatrimotos
                  </label>
                  <input
                    type="text"
                    required
                    value={gCuatri}
                    onChange={(e) => setGCuatri(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-zinc-700">
                    Motonetas
                  </label>
                  <input
                    type="text"
                    required
                    value={gMotoNet}
                    onChange={(e) => setGMotoNet(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-zinc-700">
                    Motocicletas
                  </label>
                  <input
                    type="text"
                    required
                    value={gMoto}
                    onChange={(e) => setGMoto(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-zinc-700">
                  Accesorios y Despiece (separados por coma)
                </label>
                <textarea
                  rows={2}
                  value={gAccessories}
                  onChange={(e) => setGAccessories(e.target.value)}
                  placeholder="Ej. Winch eléctrico, Guía de rodillos, Control remoto"
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2"
                />
              </div>

              <div>
                <label className="block font-semibold text-zinc-700">
                  Notas / Regla 48h
                </label>
                <textarea
                  rows={2}
                  value={gNotes}
                  onChange={(e) => setGNotes(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2"
                />
              </div>

              {errorMessage && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  {errorMessage}
                </div>
              )}

              <div className="flex justify-end gap-3 border-t border-zinc-100 pt-4">
                <button
                  type="button"
                  onClick={() => setGuideModalOpen(false)}
                  className="rounded-lg border border-zinc-300 px-4 py-2 font-semibold text-zinc-700 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingForm}
                  className="rounded-lg bg-[#EA580C] px-5 py-2 font-semibold text-white hover:bg-[#C2410C] disabled:opacity-60 cursor-pointer"
                >
                  {savingForm ? 'Guardando...' : 'Guardar Componente'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
