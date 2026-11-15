import { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  FileSpreadsheet,
  FolderOpen,
  FolderPlus,
  ImagePlus,
  Link2,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  Trophy,
  Upload,
  X,
} from 'lucide-react';
import {
  INITIAL_ADMIN_QUIZ_ITEMS,
  INITIAL_MOTORCYCLES,
  INITIAL_POLICIES,
  INITIAL_SPEC_FIELDS,
  INITIAL_TIME_GUIDES,
} from '../data/seedData';
import type { AdvisorProfile } from '../types';
import {
  deleteDriveFile,
  discoverAcademiaWorkspace,
  ensureAcademiaWorkspaceFolders,
  listDriveImagesInFolder,
  moveFileToDriveFolder,
  uploadImageToDriveFolder,
  type DriveImageFile,
  type DriveWorkspaceFolders,
} from '../utils/googleDriveSync';
import {
  createMasterSpreadsheet,
  exportLeaderboardOnlyToSpreadsheet,
  extractSpreadsheetId,
  fetchSpreadsheetMetadata,
  readAppFromSpreadsheet,
  TAB_NAMES,
  writeAppToSpreadsheet,
  type AppSheetData,
  type LinkedSpreadsheetInfo,
  type SheetSyncResult,
} from '../utils/googleSheetsSync';

interface GoogleSheetsPanelProps {
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
  onApplySheetData: (data: Partial<AppSheetData>, options?: { markSaved?: boolean }) => void;
  onClearPendingChanges: () => void;
  currentData: AppSheetData;
  leaderboard: AdvisorProfile[];
  onNotify: (msg: string) => void;
  onError: (msg: string) => void;
}

type PendingConfirmAction =
  | { kind: 'setupAcademiaAndSheet'; sheetTitle: string }
  | { kind: 'createFoldersOnly' }
  | { kind: 'moveSheetToAcademia' }
  | { kind: 'uploadImage'; file: File }
  | { kind: 'deleteImage'; file: DriveImageFile }
  | { kind: 'create'; title: string }
  | { kind: 'pull' }
  | { kind: 'push' }
  | { kind: 'exportRanking' };

function getStarterTemplateData(): AppSheetData {
  return {
    motorcycles: INITIAL_MOTORCYCLES,
    specFields: INITIAL_SPEC_FIELDS,
    adminQuizItems: INITIAL_ADMIN_QUIZ_ITEMS,
    policies: INITIAL_POLICIES,
    timeGuides: INITIAL_TIME_GUIDES,
  };
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

export default function GoogleSheetsPanel({
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
  currentData,
  leaderboard,
  onNotify,
  onError,
}: GoogleSheetsPanelProps) {
  const [newSheetTitle, setNewSheetTitle] = useState(
    'Vento & Pistón Academy · Base Maestra'
  );
  const [sheetUrlInput, setSheetUrlInput] = useState(
    linkedSheet?.spreadsheetId || ''
  );
  const [busy, setBusy] = useState(false);
  const [driveImages, setDriveImages] = useState<DriveImageFile[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedShareLink, setCopiedShareLink] = useState(false);
  const [lastSyncSummary, setLastSyncSummary] = useState<SheetSyncResult | null>(
    null
  );
  const [confirmAction, setConfirmAction] =
    useState<PendingConfirmAction | null>(null);

  useEffect(() => {
    if (linkedSheet?.spreadsheetId) {
      setSheetUrlInput(linkedSheet.spreadsheetId);
    }
  }, [linkedSheet?.spreadsheetId]);

  const ensureToken = async (): Promise<string> => {
    return onConnectGoogleSheets();
  };

  // Data payload used when initializing a brand-new spreadsheet
  const dataForNewSheet: AppSheetData =
    currentData.motorcycles.length > 0 ||
    currentData.policies.length > 0 ||
    currentData.timeGuides.length > 0
      ? currentData
      : getStarterTemplateData();

  const handleLinkExisting = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = extractSpreadsheetId(sheetUrlInput);
    if (!id) {
      onError(
        'Ingresa un enlace válido de Google Sheets (https://docs.google.com/spreadsheets/d/...) o su ID.'
      );
      return;
    }
    setBusy(true);
    onError('');
    try {
      const token = await ensureToken();
      const { info, result } = await readAppFromSpreadsheet(
        token,
        id,
        currentData.motorcycles
      );
      onSetLinkedSheet(info);
      setSheetUrlInput(info.spreadsheetId);
      setLastSyncSummary(result);
      onApplySheetData(result.data, { markSaved: true });
      onNotify(
        `Google Sheet "${info.title}" vinculado y cargado (${info.sheetTitles.length} pestañas).`
      );
    } catch (err) {
      onError(
        err instanceof Error ? err.message : 'No se pudo leer la hoja.'
      );
    } finally {
      setBusy(false);
    }
  };

  const handleDiscoverInDrive = async () => {
    setBusy(true);
    onError('');
    try {
      const token = await ensureToken();
      const found = await discoverAcademiaWorkspace(token);
      if (found.folders) {
        onSetDriveFolders(found.folders);
        const imgs = await listDriveImagesInFolder(
          token,
          found.folders.imagesFolderId
        );
        setDriveImages(imgs);
      }
      if (found.spreadsheetId) {
        const { info, result } = await readAppFromSpreadsheet(
          token,
          found.spreadsheetId,
          currentData.motorcycles
        );
        onSetLinkedSheet(info);
        setSheetUrlInput(info.spreadsheetId);
        setLastSyncSummary(result);
        onApplySheetData(result.data, { markSaved: true });
        onNotify(
          `Carpeta "academia" y Google Sheet "${info.title}" encontrados y cargados.`
        );
      } else if (found.folders) {
        onNotify(
          'Se encontró tu carpeta "academia" en Drive, pero aún no hay un Google Sheet dentro. Créalo en el paso 1 o pega su URL.'
        );
      } else {
        onError(
          'No se encontró una carpeta "academia" ni un Google Sheet previo creado por esta app. Usa "Crear Carpeta academia, imagenes y Sheet" o pega la URL de tu hoja.'
        );
      }
    } catch (err) {
      onError(
        err instanceof Error
          ? err.message
          : 'No se pudo buscar en tu Google Drive.'
      );
    } finally {
      setBusy(false);
    }
  };

  const handleRefreshMetadata = async () => {
    if (!linkedSheet) return;
    setBusy(true);
    onError('');
    try {
      const token = await ensureToken();
      const info = await fetchSpreadsheetMetadata(
        token,
        linkedSheet.spreadsheetId
      );
      onSetLinkedSheet(info);
      onNotify(`Metadatos actualizados: ${info.sheetTitles.join(', ')}`);
    } catch (err) {
      onError(
        err instanceof Error ? err.message : 'Error consultando metadatos.'
      );
    } finally {
      setBusy(false);
    }
  };

  const handleRefreshDriveImages = async (targetFolderId?: string) => {
    const folderId = targetFolderId || driveFolders?.imagesFolderId;
    if (!folderId) return;
    setBusy(true);
    onError('');
    try {
      const token = await ensureToken();
      const files = await listDriveImagesInFolder(token, folderId);
      setDriveImages(files);
      onNotify(
        `Carpeta "academia/imagenes" consultada (${files.length} imagen(es)).`
      );
    } catch (err) {
      onError(
        err instanceof Error
          ? err.message
          : 'Error leyendo imágenes de Google Drive.'
      );
    } finally {
      setBusy(false);
    }
  };

  const handleImageFilePicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setConfirmAction({ kind: 'uploadImage', file });
  };

  const handleLoadStarterTemplate = () => {
    onApplySheetData(getStarterTemplateData(), { markSaved: false });
    onNotify(
      'Plantilla base Vento & Pistón cargada en esta sesión. Crea o sobrescribe tu Google Sheet para guardarla.'
    );
  };

  const handleCopyShareLink = () => {
    if (!linkedSheet) return;
    const url = new URL(window.location.href);
    url.searchParams.set('sheet', linkedSheet.spreadsheetId);
    navigator.clipboard?.writeText(url.toString()).catch(() => {});
    setCopiedShareLink(true);
    window.setTimeout(() => setCopiedShareLink(false), 2200);
  };

  const executeConfirmedAction = async () => {
    if (!confirmAction) return;
    const action = confirmAction;
    setConfirmAction(null);
    setBusy(true);
    onError('');

    try {
      const token = await ensureToken();

      if (action.kind === 'createFoldersOnly') {
        const folders = await ensureAcademiaWorkspaceFolders(token);
        onSetDriveFolders(folders);
        const imgs = await listDriveImagesInFolder(token, folders.imagesFolderId);
        setDriveImages(imgs);
        onNotify(
          'Carpetas "academia" y "academia/imagenes" listas en tu Google Drive.'
        );
      } else if (action.kind === 'setupAcademiaAndSheet') {
        const folders = await ensureAcademiaWorkspaceFolders(token);
        onSetDriveFolders(folders);

        const seedPayload = dataForNewSheet;
        const { info, truncatedImageModels } = await createMasterSpreadsheet(
          token,
          action.sheetTitle,
          seedPayload,
          leaderboard
        );
        await moveFileToDriveFolder(
          token,
          info.spreadsheetId,
          folders.rootFolderId
        );
        onSetLinkedSheet(info);
        setSheetUrlInput(info.spreadsheetId);
        onApplySheetData(seedPayload, { markSaved: true });
        const imgs = await listDriveImagesInFolder(token, folders.imagesFolderId);
        setDriveImages(imgs);
        const warnText =
          truncatedImageModels.length > 0
            ? ` Nota: ${truncatedImageModels.length} unidad(es) con foto local pesada conservaron [IMAGEN_LOCAL_APP] (puedes subir sus fotos a "academia/imagenes").`
            : '';
        onNotify(
          `Espacio creado en Drive: carpeta "academia", subcarpeta "imagenes" y Google Sheet "${info.title}" dentro de "academia".${warnText}`
        );
      } else if (action.kind === 'moveSheetToAcademia' && linkedSheet) {
        const folders =
          driveFolders || (await ensureAcademiaWorkspaceFolders(token));
        onSetDriveFolders(folders);
        await moveFileToDriveFolder(
          token,
          linkedSheet.spreadsheetId,
          folders.rootFolderId
        );
        onNotify(
          `Google Sheet "${linkedSheet.title}" movido dentro de la carpeta "academia" en Drive.`
        );
      } else if (action.kind === 'uploadImage') {
        const folders =
          driveFolders || (await ensureAcademiaWorkspaceFolders(token));
        onSetDriveFolders(folders);
        const uploaded = await uploadImageToDriveFolder(
          token,
          action.file,
          folders.imagesFolderId
        );
        setDriveImages((prev) => [uploaded, ...prev]);
        onNotify(
          `Imagen "${uploaded.name}" subida a "academia/imagenes" en Google Drive.`
        );
      } else if (action.kind === 'deleteImage') {
        await deleteDriveFile(token, action.file.id);
        setDriveImages((prev) => prev.filter((f) => f.id !== action.file.id));
        onNotify(`Imagen "${action.file.name}" eliminada de Google Drive.`);
      } else if (action.kind === 'create') {
        const seedPayload = dataForNewSheet;
        const { info, truncatedImageModels } = await createMasterSpreadsheet(
          token,
          action.title,
          seedPayload,
          leaderboard
        );
        if (driveFolders?.rootFolderId) {
          await moveFileToDriveFolder(
            token,
            info.spreadsheetId,
            driveFolders.rootFolderId
          );
        }
        onSetLinkedSheet(info);
        setSheetUrlInput(info.spreadsheetId);
        onApplySheetData(seedPayload, { markSaved: true });
        const warnText =
          truncatedImageModels.length > 0
            ? ` Nota: ${truncatedImageModels.length} unidad(es) con foto local pesada conservaron marcador [IMAGEN_LOCAL_APP].`
            : '';
        onNotify(
          `Google Sheet Maestro "${info.title}" creado con 6 pestañas y cargado como origen activo.${warnText}`
        );
      } else if (action.kind === 'pull' && linkedSheet) {
        const { info, result } = await readAppFromSpreadsheet(
          token,
          linkedSheet.spreadsheetId,
          currentData.motorcycles
        );
        onSetLinkedSheet(info);
        setLastSyncSummary(result);
        onApplySheetData(result.data, { markSaved: true });
        const totalImported = Object.values(result.importedCounts).reduce(
          (acc, n) => acc + (n || 0),
          0
        );
        onNotify(
          `Datos actualizados desde Google Sheets: ${totalImported} registros cargados de "${info.title}".`
        );
      } else if (action.kind === 'push' && linkedSheet) {
        const { info, truncatedImageModels } = await writeAppToSpreadsheet(
          token,
          linkedSheet.spreadsheetId,
          currentData,
          leaderboard,
          { includeLeaderboard: true }
        );
        onSetLinkedSheet(info);
        onClearPendingChanges();
        const warnText =
          truncatedImageModels.length > 0
            ? ` (${truncatedImageModels.length} imagen(es) local(es) marcada(s) como [IMAGEN_LOCAL_APP]).`
            : '';
        onNotify(
          `Información guardada en Google Sheet "${info.title}" (${currentData.motorcycles.length} motos, ${currentData.specFields.length} campos, ${currentData.adminQuizItems.length} preguntas).${warnText}`
        );
      } else if (action.kind === 'exportRanking' && linkedSheet) {
        const info = await exportLeaderboardOnlyToSpreadsheet(
          token,
          linkedSheet.spreadsheetId,
          leaderboard,
          currentData
        );
        onSetLinkedSheet(info);
        onClearPendingChanges();
        onNotify(
          `Ranking de ${leaderboard.length} asesores guardado en la pestaña "${TAB_NAMES.leaderboard}".`
        );
      }
    } catch (err) {
      onError(
        err instanceof Error
          ? err.message
          : 'Error ejecutando operación en Google Workspace.'
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Connection & Authorization Card */}
      <section className="rounded-xl border border-zinc-200 bg-white p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-emerald-700" />
              <h2 className="font-display text-2xl font-bold text-zinc-950">
                Google Drive (academia) &amp; Google Sheets (Base Única)
              </h2>
            </div>
            <p className="text-xs text-zinc-600 max-w-2xl">
              Sin base de datos externa: toda la información (unidades, campos de ficha técnica, preguntas, pólizas, guía de tiempos y ranking) nace y se actualiza directamente desde tu hoja de Google Sheets y carpeta{' '}
              <strong className="font-mono">academia/imagenes</strong>.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {hasSheetsToken ? (
              <>
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">
                  <CheckCircle2 className="h-4 w-4" />
                  Drive y Sheets Conectados
                </span>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    onForceReconnectGoogle()
                      .then(() =>
                        onNotify('Permisos de Google Drive y Sheets renovados.')
                      )
                      .catch((e) =>
                        onError(
                          e instanceof Error
                            ? e.message
                            : 'No se pudo reconectar.'
                        )
                      );
                  }}
                  className="rounded-lg border border-zinc-200 px-3 py-2 text-xs font-medium text-zinc-600 hover:bg-zinc-50 cursor-pointer"
                >
                  Renovar permisos
                </button>
              </>
            ) : (
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  onForceReconnectGoogle()
                    .then(() =>
                      onNotify(
                        'Permisos de Google Drive y Google Sheets autorizados en esta sesión.'
                      )
                    )
                    .catch((e) =>
                      onError(
                        e instanceof Error ? e.message : 'No se pudo conectar.'
                      )
                    );
                }}
                className="inline-flex items-center gap-2.5 rounded-lg border border-zinc-300 bg-white px-4 py-2 text-xs font-semibold text-zinc-800 shadow-xs hover:bg-zinc-50 disabled:opacity-60 cursor-pointer"
              >
                <GoogleGIcon />
                <span>Sign in with Google · Conectar Drive y Sheets</span>
              </button>
            )}
          </div>
        </div>

        {/* Active Data Source Status Strip */}
        <div className="mt-5 flex flex-col gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-xs">
            <span className="font-semibold text-zinc-900">
              Estado de datos:{' '}
            </span>
            {sheetLoaded && linkedSheet ? (
              <span className="font-semibold text-emerald-700">
                Sincronizado con Google Sheets ({linkedSheet.title})
                {sheetLoadedAt ? ` · Leído ${sheetLoadedAt}` : ''}
                {pendingDataChanges > 0
                  ? ` · ${pendingDataChanges} cambio(s) pendiente(s) por guardar`
                  : ''}
              </span>
            ) : linkedSheet ? (
              <span className="font-semibold text-amber-700">
                Hoja vinculada ({linkedSheet.title}) pendiente de lectura en esta sesión
              </span>
            ) : (
              <span className="font-semibold text-zinc-700">
                Sin hoja vinculada aún — busca tu Sheet existente en Drive, pega su URL o crea uno nuevo abajo.
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={handleDiscoverInDrive}
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-800 hover:bg-zinc-100 disabled:opacity-60 cursor-pointer"
            >
              <Search className="h-3.5 w-3.5 text-[#EA580C]" />
              Buscar carpeta &quot;academia&quot; y Sheet
            </button>
            {currentData.motorcycles.length === 0 && (
              <button
                type="button"
                disabled={busy}
                onClick={handleLoadStarterTemplate}
                className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-100 cursor-pointer"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Precargar Plantilla Vento en Sesión
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Google Drive Folder Setup: academia -> imagenes + Sheet */}
      <section className="rounded-xl border border-zinc-200 bg-white p-6 space-y-5">
        <div className="flex flex-col gap-4 border-b border-zinc-100 pb-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <FolderOpen className="h-5 w-5 text-[#EA580C]" />
              <h3 className="font-display text-xl font-bold text-zinc-950">
                Estructura en Google Drive: Carpeta &quot;academia&quot;
              </h3>
            </div>
            <p className="mt-1 text-xs text-zinc-600">
              Organiza en tu Google Drive la carpeta <span className="font-mono font-semibold">academia</span>, dentro la subcarpeta <span className="font-mono font-semibold">imagenes</span> para las fotos de motos, y guarda ahí mismo el Google Sheet con toda la información.
            </p>
          </div>

          {!driveFolders ? (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  setConfirmAction({
                    kind: 'setupAcademiaAndSheet',
                    sheetTitle:
                      newSheetTitle.trim() ||
                      'Vento & Pistón Academy · Base Maestra',
                  })
                }
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#EA580C] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#C2410C] disabled:opacity-60 cursor-pointer"
              >
                <FolderPlus className="h-4 w-4" />
                Crear Carpeta &quot;academia&quot;, &quot;imagenes&quot; y Sheet
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => setConfirmAction({ kind: 'createFoldersOnly' })}
                className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3.5 py-2.5 text-xs font-semibold text-zinc-800 hover:bg-zinc-50 disabled:opacity-60 cursor-pointer"
              >
                Solo crear carpetas
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <a
                href={driveFolders.rootFolderUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs font-semibold text-zinc-800 hover:bg-zinc-50"
              >
                <ExternalLink className="h-3.5 w-3.5 text-[#EA580C]" />
                Abrir carpeta &quot;academia&quot;
              </a>
              <a
                href={driveFolders.imagesFolderUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs font-semibold text-zinc-800 hover:bg-zinc-50"
              >
                <ExternalLink className="h-3.5 w-3.5 text-emerald-700" />
                Abrir &quot;academia/imagenes&quot;
              </a>
              {linkedSheet && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    setConfirmAction({ kind: 'moveSheetToAcademia' })
                  }
                  className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-950 px-3 py-2 text-xs font-semibold text-white hover:bg-zinc-800 disabled:opacity-60 cursor-pointer"
                >
                  Mover Sheet dentro de &quot;academia&quot;
                </button>
              )}
            </div>
          )}
        </div>

        {/* Images Gallery inside academia/imagenes */}
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h4 className="font-semibold text-sm text-zinc-950">
                Imágenes de Unidades en Drive (academia/imagenes)
              </h4>
              <p className="text-[11px] text-zinc-500">
                Las fotos que subas aquí se almacenan en tu carpeta <span className="font-mono">academia/imagenes</span> y generan una URL ligera compatible con el catálogo y Google Sheets.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {driveFolders && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => handleRefreshDriveImages()}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 cursor-pointer"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Actualizar Lista ({driveImages.length})
                </button>
              )}
              <label className="inline-flex items-center gap-1.5 rounded-lg bg-[#EA580C] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#C2410C] cursor-pointer">
                <ImagePlus className="h-4 w-4" />
                Subir Imagen a &quot;imagenes&quot;
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageFilePicked}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {driveImages.length === 0 ? (
            <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-6 text-center text-xs text-zinc-500">
              {driveFolders
                ? 'Haz clic en "Actualizar Lista" para ver las imágenes existentes o usa "Subir Imagen a imagenes" para cargar una foto nueva.'
                : 'Crea o conecta primero la carpeta "academia" o sube directamente una imagen para inicializar la carpeta en tu Drive.'}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {driveImages.map((img) => (
                <div
                  key={img.id}
                  className="overflow-hidden rounded-lg border border-zinc-200 bg-white"
                >
                  <div className="aspect-[4/3] bg-zinc-900">
                    <img
                      src={img.imageUrl}
                      alt={img.name}
                      referrerPolicy="no-referrer"
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="p-3 space-y-2">
                    <div
                      className="truncate text-xs font-semibold text-zinc-950"
                      title={img.name}
                    >
                      {img.name}
                    </div>
                    <div className="flex items-center justify-between gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard?.writeText(img.imageUrl).catch(() => {});
                          setCopiedId(img.id);
                          window.setTimeout(() => setCopiedId(null), 1800);
                        }}
                        className="inline-flex flex-1 items-center justify-center gap-1 rounded border border-zinc-200 px-2 py-1 text-[11px] font-semibold text-zinc-700 hover:bg-zinc-50 cursor-pointer"
                      >
                        <Copy className="h-3 w-3" />
                        {copiedId === img.id ? 'Copiada' : 'Copiar URL'}
                      </button>
                      <a
                        href={img.webViewLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Ver en Google Drive"
                        className="rounded border border-zinc-200 p-1 text-zinc-600 hover:bg-zinc-50"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                      <button
                        type="button"
                        onClick={() =>
                          setConfirmAction({ kind: 'deleteImage', file: img })
                        }
                        title="Eliminar de Drive"
                        className="rounded border border-red-200 p-1 text-red-600 hover:bg-red-50 cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Link or Create Master Sheet */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Option A: Create New Sheet */}
        <section className="rounded-xl border border-zinc-200 bg-white p-6 space-y-4">
          <div>
            <h3 className="font-display text-lg font-bold text-zinc-950">
              1. Crear Google Sheet Maestro {driveFolders ? '(en carpeta academia)' : ''}
            </h3>
            <p className="mt-1 text-xs text-zinc-600">
              Genera una hoja nueva con las 6 pestañas estructuradas ({dataForNewSheet.motorcycles.length} motos, {dataForNewSheet.specFields.length} campos, {dataForNewSheet.adminQuizItems.length} preguntas, pólizas, guía de tiempos y ranking).
            </p>
          </div>

          <div className="space-y-3">
            <div>
              <label
                htmlFor="new-sheet-title"
                className="block text-xs font-semibold text-zinc-700"
              >
                Nombre del nuevo Google Sheet
              </label>
              <input
                id="new-sheet-title"
                type="text"
                value={newSheetTitle}
                onChange={(e) => setNewSheetTitle(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-xs text-zinc-900"
              />
            </div>
            <button
              type="button"
              disabled={busy || !newSheetTitle.trim()}
              onClick={() =>
                setConfirmAction({ kind: 'create', title: newSheetTitle.trim() })
              }
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#EA580C] px-4 py-2 text-xs font-semibold text-white hover:bg-[#C2410C] disabled:opacity-60 cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              Crear Google Sheet Maestro
            </button>
          </div>
        </section>

        {/* Option B: Connect Existing Sheet */}
        <section className="rounded-xl border border-zinc-200 bg-white p-6 space-y-4">
          <div>
            <h3 className="font-display text-lg font-bold text-zinc-950">
              2. Conectar un Google Sheet Existente
            </h3>
            <p className="mt-1 text-xs text-zinc-600">
              Pega el enlace completo o el ID de una hoja existente en tu Google Drive para leer todas las pestañas directamente en la app.
            </p>
          </div>

          <form onSubmit={handleLinkExisting} className="space-y-3">
            <div>
              <label
                htmlFor="existing-sheet-url"
                className="block text-xs font-semibold text-zinc-700"
              >
                URL o ID del Google Sheet
              </label>
              <input
                id="existing-sheet-url"
                type="text"
                value={sheetUrlInput}
                onChange={(e) => setSheetUrlInput(e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/d/1A2B3C.../edit"
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 font-mono text-xs text-zinc-900"
              />
            </div>
            <button
              type="submit"
              disabled={busy || !sheetUrlInput.trim()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-950 px-4 py-2 text-xs font-semibold text-white hover:bg-zinc-800 disabled:opacity-60 cursor-pointer"
            >
              <Link2 className="h-4 w-4" />
              Vincular y Cargar Google Sheet
            </button>
          </form>
        </section>
      </div>

      {/* Linked Sheet Controls */}
      {linkedSheet && (
        <section className="rounded-xl border border-zinc-200 bg-white p-6 space-y-5">
          <div className="flex flex-col gap-3 border-b border-zinc-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wide">
                Hoja Maestra Vinculada
              </div>
              <h3 className="font-display text-2xl font-bold text-zinc-950">
                {linkedSheet.title}
              </h3>
              <p className="mt-0.5 font-mono text-[11px] text-zinc-500">
                ID: {linkedSheet.spreadsheetId} · Pestañas:{' '}
                {linkedSheet.sheetTitles.join(', ') || 'Sin pestañas'}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleCopyShareLink}
                className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 px-3 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 cursor-pointer"
              >
                <Copy className="h-3.5 w-3.5" />
                {copiedShareLink ? 'Enlace copiado' : 'Copiar enlace con Sheet'}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={handleRefreshMetadata}
                className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 px-3 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 cursor-pointer"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Verificar Pestañas
              </button>
              <a
                href={linkedSheet.spreadsheetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-800"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Abrir en Google Sheets
              </a>
            </div>
          </div>

          {/* 3 Action Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="flex flex-col justify-between rounded-lg border border-zinc-200 bg-zinc-50/70 p-4 space-y-3">
              <div>
                <div className="font-semibold text-xs text-zinc-950">
                  Recargar desde Google Sheets
                </div>
                <p className="mt-1 text-[11px] text-zinc-600">
                  Lee las 6 pestañas del Sheet y actualiza Catálogo, Fichas, Preguntas, Pólizas, Tiempos y Ranking en la app.
                </p>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => setConfirmAction({ kind: 'pull' })}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-zinc-950 px-3 py-2 text-xs font-semibold text-white hover:bg-zinc-800 disabled:opacity-60 cursor-pointer"
              >
                <Download className="h-3.5 w-3.5" />
                Importar del Sheet
              </button>
            </div>

            <div className="flex flex-col justify-between rounded-lg border border-zinc-200 bg-zinc-50/70 p-4 space-y-3">
              <div>
                <div className="font-semibold text-xs text-zinc-950">
                  Guardar Cambios en Google Sheets
                </div>
                <p className="mt-1 text-[11px] text-zinc-600">
                  Envía todas las modificaciones hechas en el Panel Admin hacia las 6 pestañas de tu Google Sheet.
                </p>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => setConfirmAction({ kind: 'push' })}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#EA580C] px-3 py-2 text-xs font-semibold text-white hover:bg-[#C2410C] disabled:opacity-60 cursor-pointer"
              >
                <Upload className="h-3.5 w-3.5" />
                Sobrescribir Sheet
                {pendingDataChanges > 0 ? ` (${pendingDataChanges})` : ''}
              </button>
            </div>

            <div className="flex flex-col justify-between rounded-lg border border-zinc-200 bg-zinc-50/70 p-4 space-y-3">
              <div>
                <div className="font-semibold text-xs text-zinc-950">
                  Sincronizar RankingAsesores
                </div>
                <p className="mt-1 text-[11px] text-zinc-600">
                  Actualiza únicamente la pestaña <span className="font-mono">{TAB_NAMES.leaderboard}</span> con los puntajes actuales ({leaderboard.length}).
                </p>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => setConfirmAction({ kind: 'exportRanking' })}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs font-semibold text-zinc-900 hover:bg-zinc-100 disabled:opacity-60 cursor-pointer"
              >
                <Trophy className="h-3.5 w-3.5 text-[#EA580C]" />
                Guardar Ranking en Sheet
              </button>
            </div>
          </div>

          {lastSyncSummary && (
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-xs space-y-1.5">
              <div className="font-semibold text-zinc-900">
                Resumen de última lectura desde Google Sheets:
              </div>
              <div className="flex flex-wrap gap-4 font-mono text-zinc-700 tabular-nums">
                <span>Motos: {lastSyncSummary.importedCounts.motorcycles ?? 0}</span>
                <span>Campos: {lastSyncSummary.importedCounts.specFields ?? 0}</span>
                <span>Preguntas: {lastSyncSummary.importedCounts.quizQuestions ?? 0}</span>
                <span>Pólizas: {lastSyncSummary.importedCounts.policies ?? 0}</span>
                <span>Guía Tiempos: {lastSyncSummary.importedCounts.timeGuides ?? 0}</span>
                <span>Asesores: {lastSyncSummary.importedCounts.leaderboard ?? 0}</span>
              </div>
              {lastSyncSummary.missingTabs.length > 0 && (
                <p className="text-amber-800">
                  Pestañas no encontradas:{' '}
                  {lastSyncSummary.missingTabs.join(', ')}
                </p>
              )}
              {lastSyncSummary.warnings.map((w, i) => (
                <p key={i} className="text-amber-800">
                  {w}
                </p>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Explicit Confirmation Modal for Workspace Mutations */}
      {confirmAction && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/65 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-zinc-100 pb-3">
              <h3 className="font-display text-xl font-bold text-zinc-950">
                Confirmar Operación
              </h3>
              <button
                type="button"
                onClick={() => setConfirmAction(null)}
                className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-2 text-xs text-zinc-700 leading-relaxed">
              {confirmAction.kind === 'setupAcademiaAndSheet' && (
                <p>
                  Se creará en tu Google Drive la carpeta{' '}
                  <strong className="font-mono">academia</strong>, dentro la subcarpeta{' '}
                  <strong className="font-mono">imagenes</strong> y la hoja de cálculo{' '}
                  <strong>&quot;{confirmAction.sheetTitle}&quot;</strong> con 6 pestañas precargadas ({dataForNewSheet.motorcycles.length} motos, {dataForNewSheet.specFields.length} campos, {dataForNewSheet.adminQuizItems.length} preguntas).
                </p>
              )}

              {confirmAction.kind === 'createFoldersOnly' && (
                <p>
                  Se crearán en tu Google Drive la carpeta principal{' '}
                  <strong className="font-mono">academia</strong> y la subcarpeta{' '}
                  <strong className="font-mono">imagenes</strong>.
                </p>
              )}

              {confirmAction.kind === 'moveSheetToAcademia' && linkedSheet && (
                <p>
                  Se moverá tu Google Sheet{' '}
                  <strong>&quot;{linkedSheet.title}&quot;</strong> dentro de la carpeta{' '}
                  <strong className="font-mono">academia</strong> en Google Drive.
                </p>
              )}

              {confirmAction.kind === 'uploadImage' && (
                <p>
                  Se subirá el archivo{' '}
                  <strong>&quot;{confirmAction.file.name}&quot;</strong> a la carpeta{' '}
                  <strong className="font-mono">academia/imagenes</strong> de tu Google Drive con acceso de lectura para el catálogo.
                </p>
              )}

              {confirmAction.kind === 'deleteImage' && (
                <p>
                  <strong>Atención:</strong> se eliminará permanentemente la imagen{' '}
                  <strong>&quot;{confirmAction.file.name}&quot;</strong> de tu Google Drive.
                </p>
              )}

              {confirmAction.kind === 'create' && (
                <>
                  <p>
                    Se creará una nueva hoja de cálculo en tu Google Drive llamada{' '}
                    <strong>&quot;{confirmAction.title}&quot;</strong>
                    {driveFolders ? ' dentro de la carpeta academia' : ''} con 6 pestañas:
                  </p>
                  <p className="font-mono text-[11px] text-zinc-600">
                    Motos ({dataForNewSheet.motorcycles.length}), CamposFicha (
                    {dataForNewSheet.specFields.length}), PreguntasJuegos (
                    {dataForNewSheet.adminQuizItems.length}), Polizas (
                    {dataForNewSheet.policies.length}), GuiaTiempos (
                    {dataForNewSheet.timeGuides.length}), RankingAsesores (
                    {leaderboard.length}).
                  </p>
                </>
              )}

              {confirmAction.kind === 'pull' && linkedSheet && (
                <p>
                  Se leerán las 6 pestañas compatibles de{' '}
                  <strong>&quot;{linkedSheet.title}&quot;</strong> y reemplazarán los datos mostrados en esta sesión.
                </p>
              )}

              {confirmAction.kind === 'push' && linkedSheet && (
                <>
                  <p>
                    <strong>Atención:</strong> se limpiarán y sobrescribirán las 6 pestañas de tu Google Sheet{' '}
                    <strong>&quot;{linkedSheet.title}&quot;</strong> con los datos actuales de la app.
                  </p>
                  <p className="font-mono text-[11px] text-zinc-600">
                    Motos ({currentData.motorcycles.length}), CamposFicha (
                    {currentData.specFields.length}), PreguntasJuegos (
                    {currentData.adminQuizItems.length}), Polizas (
                    {currentData.policies.length}), GuiaTiempos (
                    {currentData.timeGuides.length}), RankingAsesores (
                    {leaderboard.length}).
                  </p>
                </>
              )}

              {confirmAction.kind === 'exportRanking' && linkedSheet && (
                <p>
                  Se actualizará la pestaña{' '}
                  <strong className="font-mono">{TAB_NAMES.leaderboard}</strong> en{' '}
                  <strong>&quot;{linkedSheet.title}&quot;</strong> con{' '}
                  <strong>{leaderboard.length} asesores</strong> registrados.
                </p>
              )}
            </div>

            <div className="mt-6 flex justify-end gap-3 border-t border-zinc-100 pt-4">
              <button
                type="button"
                onClick={() => setConfirmAction(null)}
                className="rounded-lg border border-zinc-300 px-4 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={executeConfirmedAction}
                className="rounded-lg bg-[#EA580C] px-4 py-2 text-xs font-semibold text-white hover:bg-[#C2410C] cursor-pointer"
              >
                Confirmar y Ejecutar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
