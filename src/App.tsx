import { useCallback, useEffect, useMemo, useState } from 'react';
import type { User } from 'firebase/auth';
import { onAuthStateChanged } from 'firebase/auth';
import {
  AlertCircle,
  CheckCircle2,
  FileSpreadsheet,
  FolderSearch,
  RefreshCw,
  Trophy,
  Upload,
  X,
} from 'lucide-react';
import AdminPanelView from './components/AdminPanelView';
import AdvisorModal from './components/AdvisorModal';
import CatalogView from './components/CatalogView';
import MotoRunnerGame from './components/MotoRunnerGame';
import Navbar from './components/Navbar';
import TrainingQuizView from './components/TrainingQuizView';
import WarrantyGuideView from './components/WarrantyGuideView';
import {
  auth,
  BOOTSTRAPPED_ADMIN_EMAIL,
  clearGoogleAccessToken,
  connectGoogleSheetsPopup,
  getGoogleAccessToken,
  signInWithGooglePopup,
  signOutUser,
} from './firebase';
import type {
  AdminQuizItem,
  AdvisorProfile,
  AppTab,
  Motorcycle,
  QuizTopic,
  SpecFieldConfig,
  TimeGuideEntry,
  WarrantyPolicy,
} from './types';
import {
  discoverAcademiaWorkspace,
  type DriveWorkspaceFolders,
} from './utils/googleDriveSync';
import {
  exportLeaderboardOnlyToSpreadsheet,
  extractSpreadsheetId,
  readAppFromSpreadsheet,
  TAB_NAMES,
  writeAppToSpreadsheet,
  type AppSheetData,
  type LinkedSpreadsheetInfo,
} from './utils/googleSheetsSync';

const LINKED_SHEET_STORAGE_KEY = 'vento_linked_google_sheet_v1';
const DRIVE_FOLDERS_STORAGE_KEY = 'vento_drive_folders_v1';

function loadLinkedSheetRef(): LinkedSpreadsheetInfo | null {
  try {
    const params = new URLSearchParams(window.location.search);
    const paramSheet = params.get('sheet');
    if (paramSheet) {
      const extracted = extractSpreadsheetId(paramSheet);
      if (extracted) {
        return {
          spreadsheetId: extracted,
          title: 'Google Sheet Compartido',
          spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${extracted}/edit`,
          sheetTitles: [],
        };
      }
    }
    const raw = window.localStorage.getItem(LINKED_SHEET_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LinkedSpreadsheetInfo;
    if (parsed?.spreadsheetId) return parsed;
  } catch {
    // ignore storage/URL errors
  }
  return null;
}

function loadDriveFoldersRef(): DriveWorkspaceFolders | null {
  try {
    const raw = window.localStorage.getItem(DRIVE_FOLDERS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DriveWorkspaceFolders;
    if (parsed?.rootFolderId && parsed?.imagesFolderId) return parsed;
  } catch {
    // ignore storage errors
  }
  return null;
}

function sortLeaderboard(list: AdvisorProfile[]): AdvisorProfile[] {
  return [...list].sort((a, b) => (b.totalPoints ?? 0) - (a.totalPoints ?? 0));
}

function GoogleGIcon() {
  return (
    <svg
      className="h-4 w-4 shrink-0"
      viewBox="0 0 48 48"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

type AppConfirmModal =
  | { kind: 'saveAllToSheet' }
  | { kind: 'saveRankingToSheet' };

export default function App() {
  const [activeTab, setActiveTab] = useState<AppTab>('catalog');
  const [user, setUser] = useState<User | null>(null);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [hasSheetsToken, setHasSheetsToken] = useState(false);

  const [driveFolders, setDriveFoldersState] =
    useState<DriveWorkspaceFolders | null>(() => loadDriveFoldersRef());
  const [linkedSheet, setLinkedSheetState] =
    useState<LinkedSpreadsheetInfo | null>(() => loadLinkedSheetRef());

  // 100% Google Sheets source-of-truth state (starts empty, no database)
  const [motorcycles, setMotorcycles] = useState<Motorcycle[]>([]);
  const [policies, setPolicies] = useState<WarrantyPolicy[]>([]);
  const [timeGuides, setTimeGuides] = useState<TimeGuideEntry[]>([]);
  const [specFields, setSpecFields] = useState<SpecFieldConfig[]>([]);
  const [adminQuizItems, setAdminQuizItems] = useState<AdminQuizItem[]>([]);
  const [leaderboard, setLeaderboard] = useState<AdvisorProfile[]>([]);

  const [sheetLoaded, setSheetLoaded] = useState(false);
  const [sheetLoadedAt, setSheetLoadedAt] = useState<string | null>(null);
  const [sheetBusy, setSheetBusy] = useState(false);
  const [sheetError, setSheetError] = useState('');
  const [sheetNotice, setSheetNotice] = useState('');

  const [pendingDataChanges, setPendingDataChanges] = useState(0);
  const [pendingRankingChanges, setPendingRankingChanges] = useState(0);
  const [confirmModal, setConfirmModal] = useState<AppConfirmModal | null>(null);

  const isAdmin = Boolean(
    user?.emailVerified && user.email === BOOTSTRAPPED_ADMIN_EMAIL
  );

  const setLinkedSheet = useCallback((info: LinkedSpreadsheetInfo | null) => {
    setLinkedSheetState(info);
    try {
      if (info) {
        window.localStorage.setItem(
          LINKED_SHEET_STORAGE_KEY,
          JSON.stringify(info)
        );
      } else {
        window.localStorage.removeItem(LINKED_SHEET_STORAGE_KEY);
      }
    } catch {
      // ignore storage errors
    }
  }, []);

  const setDriveFolders = useCallback(
    (folders: DriveWorkspaceFolders | null) => {
      setDriveFoldersState(folders);
      try {
        if (folders) {
          window.localStorage.setItem(
            DRIVE_FOLDERS_STORAGE_KEY,
            JSON.stringify(folders)
          );
        } else {
          window.localStorage.removeItem(DRIVE_FOLDERS_STORAGE_KEY);
        }
      } catch {
        // ignore storage errors
      }
    },
    []
  );

  const orderedSpecFields = useMemo(
    () => [...specFields].sort((a, b) => (a.order ?? 99) - (b.order ?? 99)),
    [specFields]
  );

  const advisorProfile = useMemo(() => {
    if (!user) return null;
    return leaderboard.find((a) => a.uid === user.uid) ?? null;
  }, [leaderboard, user]);

  // Auth listener (strictly Google Sign-In + in-memory token status; no database)
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      const token = getGoogleAccessToken();
      setHasSheetsToken(Boolean(nextUser && token));
      if (!nextUser) {
        clearGoogleAccessToken();
        setHasSheetsToken(false);
      }
    });
    return () => unsub();
  }, []);

  const applySheetData = useCallback(
    (data: Partial<AppSheetData>, options?: { markSaved?: boolean }) => {
      if (data.motorcycles !== undefined) setMotorcycles(data.motorcycles);
      if (data.specFields !== undefined) setSpecFields(data.specFields);
      if (data.adminQuizItems !== undefined)
        setAdminQuizItems(data.adminQuizItems);
      if (data.policies !== undefined) setPolicies(data.policies);
      if (data.timeGuides !== undefined) setTimeGuides(data.timeGuides);
      if (data.leaderboard !== undefined)
        setLeaderboard(sortLeaderboard(data.leaderboard));

      if (options?.markSaved) {
        setSheetLoaded(true);
        setSheetLoadedAt(
          new Date().toLocaleTimeString('es-MX', {
            hour: '2-digit',
            minute: '2-digit',
          })
        );
        setPendingDataChanges(0);
        setPendingRankingChanges(0);
      }
    },
    []
  );

  const loadSheetForSession = useCallback(
    async (accessToken: string, explicitSheetId?: string) => {
      setSheetBusy(true);
      setSheetError('');
      setSheetNotice('');
      try {
        let targetId = explicitSheetId || linkedSheet?.spreadsheetId || '';

        if (!targetId) {
          const found = await discoverAcademiaWorkspace(accessToken);
          if (found.folders) {
            setDriveFolders(found.folders);
          }
          if (found.spreadsheetId) {
            targetId = found.spreadsheetId;
          }
        }

        if (!targetId) {
          setSheetNotice(
            isAdmin
              ? 'No se detectó un Google Sheet previo en tu Drive. Crea o vincula tu hoja en Admin → Drive y Sheets.'
              : 'Pide a tu supervisor el enlace con el parámetro ?sheet= o vincula el Google Sheet de capacitación.'
          );
          return false;
        }

        const { info, result } = await readAppFromSpreadsheet(
          accessToken,
          targetId,
          motorcycles
        );
        setLinkedSheet(info);
        applySheetData(result.data, { markSaved: true });
        setSheetNotice(
          `Datos cargados desde Google Sheet "${info.title}".`
        );
        return true;
      } catch (err) {
        setSheetError(
          err instanceof Error
            ? err.message
            : 'No se pudo cargar la información desde Google Sheets.'
        );
        return false;
      } finally {
        setSheetBusy(false);
      }
    },
    [
      applySheetData,
      isAdmin,
      linkedSheet?.spreadsheetId,
      motorcycles,
      setDriveFolders,
      setLinkedSheet,
    ]
  );

  const handleSignIn = async () => {
    const { accessToken } = await signInWithGooglePopup();
    setHasSheetsToken(Boolean(accessToken));
    if (accessToken && !sheetLoaded) {
      await loadSheetForSession(accessToken);
    }
  };

  const handleConnectGoogleSheets = async (): Promise<string> => {
    const existing = getGoogleAccessToken();
    if (existing) {
      setHasSheetsToken(true);
      return existing;
    }
    const { accessToken } = await connectGoogleSheetsPopup();
    setHasSheetsToken(true);
    return accessToken;
  };

  const handleForceReconnectGoogle = async (): Promise<string> => {
    const { accessToken } = await connectGoogleSheetsPopup();
    setHasSheetsToken(true);
    return accessToken;
  };

  const handleConnectAndLoadSheet = async () => {
    setSheetError('');
    try {
      const token = await handleConnectGoogleSheets();
      await loadSheetForSession(token);
    } catch (err) {
      setSheetError(
        err instanceof Error
          ? err.message
          : 'No se pudo conectar con Google Sheets.'
      );
    }
  };

  const handleReloadFromSheet = async () => {
    const token = await handleConnectGoogleSheets();
    const ok = await loadSheetForSession(token);
    if (!ok && !linkedSheet) {
      throw new Error(
        'No hay ningún Google Sheet vinculado todavía. Créalo o vincula uno en "Drive y Sheets".'
      );
    }
  };

  const handleSignOut = async () => {
    await signOutUser();
    setHasSheetsToken(false);
    setProfileModalOpen(false);
  };

  // --- Confirmed Workspace Save Operations ---
  const executeSaveAllToSheet = async () => {
    setConfirmModal(null);
    if (!linkedSheet) {
      setSheetError(
        'Primero vincula o crea un Google Sheet en Admin → Drive y Sheets.'
      );
      return;
    }
    setSheetBusy(true);
    setSheetError('');
    try {
      const token = await handleConnectGoogleSheets();
      const { info, truncatedImageModels } = await writeAppToSpreadsheet(
        token,
        linkedSheet.spreadsheetId,
        {
          motorcycles,
          specFields,
          adminQuizItems,
          policies,
          timeGuides,
        },
        leaderboard,
        { includeLeaderboard: true }
      );
      setLinkedSheet(info);
      setPendingDataChanges(0);
      setPendingRankingChanges(0);
      setSheetLoaded(true);
      setSheetLoadedAt(
        new Date().toLocaleTimeString('es-MX', {
          hour: '2-digit',
          minute: '2-digit',
        })
      );
      const warnText =
        truncatedImageModels.length > 0
          ? ` (${truncatedImageModels.length} foto(s) local(es) conservaron marcador [IMAGEN_LOCAL_APP]).`
          : '';
      setSheetNotice(
        `Todos los cambios guardados en Google Sheet "${info.title}".${warnText}`
      );
    } catch (err) {
      setSheetError(
        err instanceof Error
          ? err.message
          : 'Error al guardar cambios en Google Sheets.'
      );
    } finally {
      setSheetBusy(false);
    }
  };

  const executeSaveRankingToSheet = async () => {
    setConfirmModal(null);
    if (!linkedSheet) {
      setSheetError(
        'No hay un Google Sheet vinculado para guardar el ranking.'
      );
      return;
    }
    setSheetBusy(true);
    setSheetError('');
    try {
      const token = await handleConnectGoogleSheets();
      const info = await exportLeaderboardOnlyToSpreadsheet(
        token,
        linkedSheet.spreadsheetId,
        leaderboard,
        {
          motorcycles,
          specFields,
          adminQuizItems,
          policies,
          timeGuides,
        }
      );
      setLinkedSheet(info);
      setPendingRankingChanges(0);
      setSheetNotice(
        `Ranking de ${leaderboard.length} asesor(es) actualizado en "${TAB_NAMES.leaderboard}".`
      );
    } catch (err) {
      setSheetError(
        err instanceof Error
          ? err.message
          : 'Error al guardar el ranking en Google Sheets.'
      );
    } finally {
      setSheetBusy(false);
    }
  };

  // --- Advisor Profile & Game Score Handlers (in-session + synced to RankingAsesores tab) ---
  const upsertAdvisorInSession = useCallback(
    (
      currentUser: User,
      updater: (prev: AdvisorProfile) => AdvisorProfile
    ) => {
      setLeaderboard((prev) => {
        const existing = prev.find((a) => a.uid === currentUser.uid);
        const base: AdvisorProfile = existing ?? {
          uid: currentUser.uid,
          displayName:
            currentUser.displayName ||
            currentUser.email?.split('@')[0] ||
            'Asesor Vento',
          branch: '',
          quizPoints: 0,
          gameHighScore: 0,
          totalPoints: 0,
          quizzesCompleted: 0,
          correctAnswers: 0,
          streakBest: 0,
        };
        const updated = updater(base);
        const nextList = existing
          ? prev.map((a) => (a.uid === currentUser.uid ? updated : a))
          : [...prev, updated];
        return sortLeaderboard(nextList);
      });
      setPendingRankingChanges((c) => c + 1);
    },
    []
  );

  const handleSaveAdvisorProfile = async (
    displayName: string,
    branch: string
  ) => {
    if (!user) return;
    upsertAdvisorInSession(user, (prev) => ({
      ...prev,
      displayName,
      branch,
    }));
  };

  const handleCompleteQuiz = async (result: {
    topic: QuizTopic;
    score: number;
    correctCount: number;
    totalQuestions: number;
    maxStreak: number;
  }) => {
    if (!user) return;
    upsertAdvisorInSession(user, (prev) => {
      const nextQuizPoints = (prev.quizPoints ?? 0) + result.score;
      const gameHighScore = prev.gameHighScore ?? 0;
      return {
        ...prev,
        quizPoints: nextQuizPoints,
        totalPoints: nextQuizPoints + gameHighScore,
        quizzesCompleted: (prev.quizzesCompleted ?? 0) + 1,
        correctAnswers: (prev.correctAnswers ?? 0) + result.correctCount,
        streakBest: Math.max(prev.streakBest ?? 0, result.maxStreak),
      };
    });
  };

  const handleSaveGameHighScore = async (newScore: number) => {
    if (!user) return;
    upsertAdvisorInSession(user, (prev) => {
      const currentHigh = prev.gameHighScore ?? 0;
      if (newScore <= currentHigh) return prev;
      const quizPoints = prev.quizPoints ?? 0;
      return {
        ...prev,
        gameHighScore: newScore,
        totalPoints: quizPoints + newScore,
      };
    });
  };

  // --- Admin CRUD Handlers (purely Google Sheets session state, no database) ---
  const handleSaveMotorcycle = async (
    moto: Omit<Motorcycle, 'createdAt' | 'updatedAt'>
  ) => {
    setMotorcycles((prev) => {
      const exists = prev.some((m) => m.id === moto.id);
      return exists
        ? prev.map((m) => (m.id === moto.id ? moto : m))
        : [...prev, moto];
    });
    setPendingDataChanges((c) => c + 1);
  };

  const handleToggleMotorcycleActive = async (moto: Motorcycle) => {
    setMotorcycles((prev) =>
      prev.map((m) =>
        m.id === moto.id ? { ...m, isActive: !m.isActive } : m
      )
    );
    setPendingDataChanges((c) => c + 1);
  };

  const handleDeleteMotorcycle = async (id: string) => {
    setMotorcycles((prev) => prev.filter((m) => m.id !== id));
    setPendingDataChanges((c) => c + 1);
  };

  const handleSavePolicy = async (
    policy: Omit<WarrantyPolicy, 'createdAt' | 'updatedAt'>
  ) => {
    setPolicies((prev) => {
      const exists = prev.some((p) => p.id === policy.id);
      return exists
        ? prev.map((p) => (p.id === policy.id ? policy : p))
        : [...prev, policy];
    });
    setPendingDataChanges((c) => c + 1);
  };

  const handleTogglePolicyActive = async (policy: WarrantyPolicy) => {
    setPolicies((prev) =>
      prev.map((p) =>
        p.id === policy.id ? { ...p, isActive: !p.isActive } : p
      )
    );
    setPendingDataChanges((c) => c + 1);
  };

  const handleDeletePolicy = async (id: string) => {
    setPolicies((prev) => prev.filter((p) => p.id !== id));
    setPendingDataChanges((c) => c + 1);
  };

  const handleSaveTimeGuide = async (
    guide: Omit<TimeGuideEntry, 'createdAt' | 'updatedAt'>
  ) => {
    setTimeGuides((prev) => {
      const exists = prev.some((g) => g.id === guide.id);
      return exists
        ? prev.map((g) => (g.id === guide.id ? guide : g))
        : [...prev, guide];
    });
    setPendingDataChanges((c) => c + 1);
  };

  const handleToggleTimeGuideActive = async (guide: TimeGuideEntry) => {
    setTimeGuides((prev) =>
      prev.map((g) =>
        g.id === guide.id ? { ...g, isActive: !g.isActive } : g
      )
    );
    setPendingDataChanges((c) => c + 1);
  };

  const handleDeleteTimeGuide = async (id: string) => {
    setTimeGuides((prev) => prev.filter((g) => g.id !== id));
    setPendingDataChanges((c) => c + 1);
  };

  const handleSaveSpecField = async (
    field: Omit<SpecFieldConfig, 'createdAt' | 'updatedAt'>
  ) => {
    setSpecFields((prev) => {
      const exists = prev.some((s) => s.id === field.id);
      return exists
        ? prev.map((s) => (s.id === field.id ? field : s))
        : [...prev, field];
    });
    setPendingDataChanges((c) => c + 1);
  };

  const handleToggleSpecFieldVisible = async (field: SpecFieldConfig) => {
    setSpecFields((prev) =>
      prev.map((s) =>
        s.id === field.id ? { ...s, isVisible: !s.isVisible } : s
      )
    );
    setPendingDataChanges((c) => c + 1);
  };

  const handleDeleteSpecField = async (id: string) => {
    setSpecFields((prev) => prev.filter((s) => s.id !== id));
    setPendingDataChanges((c) => c + 1);
  };

  const handleSaveQuizQuestion = async (
    q: Omit<AdminQuizItem, 'createdAt' | 'updatedAt'>
  ) => {
    setAdminQuizItems((prev) => {
      const exists = prev.some((item) => item.id === q.id);
      return exists
        ? prev.map((item) => (item.id === q.id ? q : item))
        : [...prev, q];
    });
    setPendingDataChanges((c) => c + 1);
  };

  const handleToggleQuizQuestionActive = async (q: AdminQuizItem) => {
    setAdminQuizItems((prev) =>
      prev.map((item) =>
        item.id === q.id ? { ...item, isActive: !item.isActive } : item
      )
    );
    setPendingDataChanges((c) => c + 1);
  };

  const handleDeleteQuizQuestion = async (id: string) => {
    setAdminQuizItems((prev) => prev.filter((item) => item.id !== id));
    setPendingDataChanges((c) => c + 1);
  };

  const hasAnySessionData =
    motorcycles.length > 0 ||
    policies.length > 0 ||
    timeGuides.length > 0 ||
    specFields.length > 0 ||
    adminQuizItems.length > 0;

  return (
    <div className="min-h-screen flex flex-col bg-[#F4F5F7] text-[#111318]">
      <Navbar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        user={user}
        advisorProfile={advisorProfile}
        onOpenProfileModal={() => setProfileModalOpen(true)}
      />

      {/* Google Sheets Status & Sync Bar */}
      <div
        className={`border-b px-4 py-2 text-xs ${
          pendingDataChanges > 0 || pendingRankingChanges > 0
            ? 'border-orange-200 bg-orange-50 text-orange-950'
            : sheetLoaded
              ? 'border-emerald-200 bg-emerald-50 text-emerald-950'
              : 'border-zinc-200 bg-white text-zinc-700'
        }`}
      >
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            {sheetLoaded ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-700" />
            ) : (
              <FileSpreadsheet className="h-4 w-4 shrink-0 text-[#EA580C]" />
            )}
            <span>
              {sheetLoaded && linkedSheet ? (
                <>
                  <strong>Origen Google Sheets:</strong>{' '}
                  <span>{linkedSheet.title}</span>
                  {sheetLoadedAt ? ` · Leído ${sheetLoadedAt}` : ''}
                </>
              ) : linkedSheet ? (
                <>
                  <strong>Sheet vinculado:</strong> {linkedSheet.title} (pendiente de lectura en esta sesión)
                </>
              ) : (
                <>
                  <strong>Modo 100% Google Sheets:</strong> conecta tu cuenta Google para leer o crear tu hoja maestra.
                </>
              )}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {pendingDataChanges > 0 && linkedSheet && (
              <button
                type="button"
                disabled={sheetBusy}
                onClick={() => setConfirmModal({ kind: 'saveAllToSheet' })}
                className="inline-flex items-center gap-1.5 rounded-md bg-[#EA580C] px-3 py-1 text-[11px] font-semibold text-white hover:bg-[#C2410C] disabled:opacity-60 cursor-pointer"
              >
                <Upload className="h-3.5 w-3.5" />
                Guardar cambios en Sheets ({pendingDataChanges})
              </button>
            )}

            {pendingRankingChanges > 0 && linkedSheet && (
              <button
                type="button"
                disabled={sheetBusy}
                onClick={() => setConfirmModal({ kind: 'saveRankingToSheet' })}
                className="inline-flex items-center gap-1.5 rounded-md bg-zinc-950 px-3 py-1 text-[11px] font-semibold text-white hover:bg-zinc-800 disabled:opacity-60 cursor-pointer"
              >
                <Trophy className="h-3.5 w-3.5 text-[#EA580C]" />
                Guardar Ranking en Sheets
              </button>
            )}

            {!sheetLoaded ? (
              <button
                type="button"
                disabled={sheetBusy}
                onClick={handleConnectAndLoadSheet}
                className="inline-flex items-center gap-2 rounded-md border border-zinc-300 bg-white px-3 py-1 text-[11px] font-semibold text-zinc-900 hover:bg-zinc-50 disabled:opacity-60 cursor-pointer"
              >
                <GoogleGIcon />
                <span>
                  {sheetBusy
                    ? 'Cargando Sheets...'
                    : linkedSheet
                      ? 'Cargar desde Google Sheets'
                      : 'Sign in with Google · Buscar Sheets'}
                </span>
              </button>
            ) : (
              <button
                type="button"
                disabled={sheetBusy}
                onClick={() =>
                  handleReloadFromSheet().catch((err) =>
                    setSheetError(
                      err instanceof Error ? err.message : 'Error al recargar.'
                    )
                  )
                }
                className="inline-flex items-center gap-1.5 rounded-md border border-emerald-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-emerald-900 hover:bg-emerald-100 disabled:opacity-60 cursor-pointer"
              >
                <RefreshCw
                  className={`h-3 w-3 ${sheetBusy ? 'animate-spin' : ''}`}
                />
                Actualizar de Sheets
              </button>
            )}
          </div>
        </div>
      </div>

      {(sheetError || sheetNotice) && (
        <div className="mx-auto mt-4 w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          {sheetError && (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-xs text-red-800">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{sheetError}</span>
              </div>
              <button
                type="button"
                onClick={() => setSheetError('')}
                className="rounded p-0.5 hover:bg-red-100 cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
          {sheetNotice && !sheetError && (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs text-emerald-800">
              <span>{sheetNotice}</span>
              <button
                type="button"
                onClick={() => setSheetNotice('')}
                className="rounded p-0.5 hover:bg-emerald-100 cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      )}

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        {!hasAnySessionData && activeTab !== 'admin' ? (
          <section className="mx-auto max-w-2xl rounded-xl border border-zinc-200 bg-white p-8 text-center shadow-xs">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
              <FileSpreadsheet className="h-6 w-6" />
            </div>
            <h1 className="mt-4 font-display text-3xl font-bold text-zinc-950">
              Conecta tu Google Sheet de Academia
            </h1>
            <p className="mt-2 text-sm text-zinc-600 leading-relaxed">
              Esta aplicación no utiliza ninguna base de datos externa: todo el catálogo de unidades, fichas técnicas, pólizas, guía de tiempos, preguntas y ranking nace directamente desde tu hoja de cálculo en Google Sheets y carpeta{' '}
              <span className="font-mono font-semibold">academia</span> en Drive.
            </p>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                disabled={sheetBusy}
                onClick={handleConnectAndLoadSheet}
                className="inline-flex items-center gap-2.5 rounded-lg border border-zinc-300 bg-white px-5 py-2.5 text-xs font-semibold text-zinc-900 shadow-xs hover:bg-zinc-50 disabled:opacity-60 cursor-pointer"
              >
                <GoogleGIcon />
                <span>
                  {sheetBusy
                    ? 'Conectando y leyendo...'
                    : linkedSheet
                      ? `Cargar "${linkedSheet.title}"`
                      : 'Sign in with Google · Cargar desde Drive / Sheets'}
                </span>
              </button>

              {isAdmin && (
                <button
                  type="button"
                  onClick={() => setActiveTab('admin')}
                  className="inline-flex items-center gap-2 rounded-lg bg-[#EA580C] px-5 py-2.5 text-xs font-semibold text-white hover:bg-[#C2410C] cursor-pointer"
                >
                  <FolderSearch className="h-4 w-4" />
                  Configurar carpeta &quot;academia&quot; y Sheet
                </button>
              )}
            </div>
          </section>
        ) : (
          <>
            {activeTab === 'catalog' && (
              <CatalogView
                motorcycles={motorcycles}
                specFields={orderedSpecFields}
                onStartTrainingForTopic={() => setActiveTab('training')}
              />
            )}

            {activeTab === 'warranty' && (
              <WarrantyGuideView policies={policies} timeGuides={timeGuides} />
            )}

            {activeTab === 'training' && (
              <TrainingQuizView
                motorcycles={motorcycles}
                timeGuides={timeGuides}
                adminQuizItems={adminQuizItems}
                user={user}
                advisorProfile={advisorProfile}
                leaderboard={leaderboard}
                onOpenProfileModal={() => setProfileModalOpen(true)}
                onCompleteQuiz={handleCompleteQuiz}
              />
            )}

            {activeTab === 'runner' && (
              <MotoRunnerGame
                motorcycles={motorcycles}
                timeGuides={timeGuides}
                adminQuizItems={adminQuizItems}
                user={user}
                advisorProfile={advisorProfile}
                leaderboard={leaderboard}
                onOpenProfileModal={() => setProfileModalOpen(true)}
                onSaveGameHighScore={handleSaveGameHighScore}
              />
            )}
          </>
        )}

        {activeTab === 'admin' && (
          <AdminPanelView
            user={user}
            isAdmin={isAdmin}
            onSignIn={handleSignIn}
            motorcycles={motorcycles}
            policies={policies}
            timeGuides={timeGuides}
            specFields={orderedSpecFields}
            adminQuizItems={adminQuizItems}
            onSaveMotorcycle={handleSaveMotorcycle}
            onToggleMotorcycleActive={handleToggleMotorcycleActive}
            onDeleteMotorcycle={handleDeleteMotorcycle}
            onSavePolicy={handleSavePolicy}
            onTogglePolicyActive={handleTogglePolicyActive}
            onDeletePolicy={handleDeletePolicy}
            onSaveTimeGuide={handleSaveTimeGuide}
            onToggleTimeGuideActive={handleToggleTimeGuideActive}
            onDeleteTimeGuide={handleDeleteTimeGuide}
            onSaveSpecField={handleSaveSpecField}
            onToggleSpecFieldVisible={handleToggleSpecFieldVisible}
            onDeleteSpecField={handleDeleteSpecField}
            onSaveQuizQuestion={handleSaveQuizQuestion}
            onToggleQuizQuestionActive={handleToggleQuizQuestionActive}
            onDeleteQuizQuestion={handleDeleteQuizQuestion}
            hasSheetsToken={hasSheetsToken}
            onConnectGoogleSheets={handleConnectGoogleSheets}
            onForceReconnectGoogle={handleForceReconnectGoogle}
            driveFolders={driveFolders}
            onSetDriveFolders={setDriveFolders}
            linkedSheet={linkedSheet}
            onSetLinkedSheet={setLinkedSheet}
            sheetLoaded={sheetLoaded}
            sheetLoadedAt={sheetLoadedAt}
            pendingDataChanges={pendingDataChanges}
            onApplySheetData={applySheetData}
            onClearPendingChanges={() => {
              setPendingDataChanges(0);
              setPendingRankingChanges(0);
            }}
            onReloadFromSheet={handleReloadFromSheet}
            onRequestSaveChangesToSheet={() =>
              setConfirmModal({ kind: 'saveAllToSheet' })
            }
            leaderboard={leaderboard}
          />
        )}
      </main>

      <footer className="border-t border-zinc-200 bg-white py-5 text-xs text-zinc-500">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <span>
            Vento &amp; Pistón Academy · Información sincronizada 100% con Google Sheets &amp; Drive
          </span>
          <span>
            Atención VENTO WA 56 1414 1172 · ayuda.vento.com · Pistón 55 5029 6960
          </span>
        </div>
      </footer>

      <AdvisorModal
        isOpen={profileModalOpen}
        onClose={() => setProfileModalOpen(false)}
        user={user}
        advisorProfile={advisorProfile}
        isAdmin={isAdmin}
        onSignIn={handleSignIn}
        onSignOut={handleSignOut}
        onSaveProfile={handleSaveAdvisorProfile}
      />

      {/* Explicit Confirmation Modal for Google Sheets Mutations */}
      {confirmModal && linkedSheet && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/65 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-zinc-100 pb-3">
              <h3 className="font-display text-xl font-bold text-zinc-950">
                Confirmar Guardado en Google Sheets
              </h3>
              <button
                type="button"
                onClick={() => setConfirmModal(null)}
                className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-2 text-xs text-zinc-700 leading-relaxed">
              {confirmModal.kind === 'saveAllToSheet' ? (
                <p>
                  Se sobrescribirán las 6 pestañas de tu Google Sheet{' '}
                  <strong>&quot;{linkedSheet.title}&quot;</strong> con los{' '}
                  <strong>{pendingDataChanges}</strong> cambio(s) actualizados en esta sesión ({motorcycles.length} motos, {orderedSpecFields.length} campos, {adminQuizItems.length} preguntas, {policies.length} pólizas, {timeGuides.length} guías y {leaderboard.length} asesores).
                </p>
              ) : (
                <p>
                  Se actualizará la pestaña{' '}
                  <strong className="font-mono">{TAB_NAMES.leaderboard}</strong>{' '}
                  en tu Google Sheet{' '}
                  <strong>&quot;{linkedSheet.title}&quot;</strong> con el puntaje actual de{' '}
                  <strong>{leaderboard.length}</strong> asesor(es).
                </p>
              )}
            </div>

            <div className="mt-5 flex justify-end gap-2 border-t border-zinc-100 pt-4">
              <button
                type="button"
                onClick={() => setConfirmModal(null)}
                className="rounded-lg border border-zinc-200 px-3.5 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() =>
                  confirmModal.kind === 'saveAllToSheet'
                    ? executeSaveAllToSheet()
                    : executeSaveRankingToSheet()
                }
                className="rounded-lg bg-[#EA580C] px-4 py-2 text-xs font-semibold text-white hover:bg-[#C2410C] cursor-pointer"
              >
                Confirmar y Guardar en Sheets
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
