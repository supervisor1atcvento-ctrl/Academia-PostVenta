import { clearGoogleAccessToken } from '../firebase';

export interface DriveWorkspaceFolders {
  rootFolderId: string;
  rootFolderName: string;
  rootFolderUrl: string;
  imagesFolderId: string;
  imagesFolderName: string;
  imagesFolderUrl: string;
}

export interface DriveImageFile {
  id: string;
  name: string;
  webViewLink: string;
  imageUrl: string;
  createdTime?: string;
}

async function driveFetch<T>(
  url: string,
  accessToken: string,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init?.headers || {}),
    },
  });

  if (!res.ok) {
    let detail = `Error ${res.status}`;
    try {
      const errJson = (await res.json()) as {
        error?: { message?: string };
      };
      if (errJson?.error?.message) detail = errJson.error.message;
    } catch {
      // ignore json parse failure
    }
    if (res.status === 401) {
      clearGoogleAccessToken();
      throw new Error(
        'Tu sesión de Google Drive/Sheets expiró. Haz clic en "Conectar Google" para autorizar nuevamente.'
      );
    }
    if (res.status === 403) {
      throw new Error(
        `Permiso insuficiente en Google Drive (${detail}). Autoriza nuevamente con Google Drive habilitado.`
      );
    }
    throw new Error(`Google Drive: ${detail}`);
  }

  if (res.status === 204) {
    return {} as T;
  }
  return (await res.json()) as T;
}

export function buildDriveImageUrl(fileId: string): string {
  return `https://drive.google.com/thumbnail?id=${encodeURIComponent(fileId)}&sz=w1200`;
}

async function findFolderByName(
  accessToken: string,
  folderName: string,
  parentId?: string
): Promise<{ id: string; name: string; webViewLink?: string } | null> {
  const escapedName = folderName.replace(/'/g, "\\'");
  const parentClause = parentId ? ` and '${parentId}' in parents` : '';
  const q = `name='${escapedName}' and mimeType='application/vnd.google-apps.folder' and trashed=false${parentClause}`;
  const res = await driveFetch<{
    files?: { id: string; name: string; webViewLink?: string }[];
  }>(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
      q
    )}&fields=files(id,name,webViewLink)&pageSize=10`,
    accessToken
  );
  return res.files?.[0] ?? null;
}

async function createFolder(
  accessToken: string,
  folderName: string,
  parentId?: string
): Promise<{ id: string; name: string; webViewLink?: string }> {
  const metadata: Record<string, unknown> = {
    name: folderName,
    mimeType: 'application/vnd.google-apps.folder',
  };
  if (parentId) {
    metadata.parents = [parentId];
  }
  return driveFetch<{ id: string; name: string; webViewLink?: string }>(
    'https://www.googleapis.com/drive/v3/files?fields=id,name,webViewLink',
    accessToken,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(metadata),
    }
  );
}

export async function ensureAcademiaWorkspaceFolders(
  accessToken: string
): Promise<DriveWorkspaceFolders> {
  let root = await findFolderByName(accessToken, 'academia');
  if (!root) {
    root = await createFolder(accessToken, 'academia');
  }

  let images = await findFolderByName(accessToken, 'imagenes', root.id);
  if (!images) {
    images = await createFolder(accessToken, 'imagenes', root.id);
  }

  return {
    rootFolderId: root.id,
    rootFolderName: root.name,
    rootFolderUrl:
      root.webViewLink || `https://drive.google.com/drive/folders/${root.id}`,
    imagesFolderId: images.id,
    imagesFolderName: images.name,
    imagesFolderUrl:
      images.webViewLink ||
      `https://drive.google.com/drive/folders/${images.id}`,
  };
}

export async function discoverAcademiaWorkspace(accessToken: string): Promise<{
  folders: DriveWorkspaceFolders | null;
  spreadsheetId: string | null;
}> {
  const root = await findFolderByName(accessToken, 'academia');
  let folders: DriveWorkspaceFolders | null = null;

  if (root) {
    const images = await findFolderByName(accessToken, 'imagenes', root.id);
    if (images) {
      folders = {
        rootFolderId: root.id,
        rootFolderName: root.name,
        rootFolderUrl:
          root.webViewLink || `https://drive.google.com/drive/folders/${root.id}`,
        imagesFolderId: images.id,
        imagesFolderName: images.name,
        imagesFolderUrl:
          images.webViewLink ||
          `https://drive.google.com/drive/folders/${images.id}`,
      };
    }

    const inRootQuery = `'${root.id}' in parents and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`;
    const inRootRes = await driveFetch<{
      files?: { id: string; name: string }[];
    }>(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
        inRootQuery
      )}&orderBy=modifiedTime desc&fields=files(id,name)&pageSize=5`,
      accessToken
    );
    if (inRootRes.files?.[0]?.id) {
      return { folders, spreadsheetId: inRootRes.files[0].id };
    }
  }

  const anySheetQuery = `mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`;
  const anyRes = await driveFetch<{
    files?: { id: string; name: string }[];
  }>(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
      anySheetQuery
    )}&orderBy=modifiedTime desc&fields=files(id,name)&pageSize=10`,
    accessToken
  );

  const preferred =
    anyRes.files?.find((f) =>
      f.name.toLowerCase().includes('vento') ||
      f.name.toLowerCase().includes('academia')
    ) || anyRes.files?.[0];

  return { folders, spreadsheetId: preferred?.id ?? null };
}

export async function moveFileToDriveFolder(
  accessToken: string,
  fileId: string,
  targetFolderId: string
): Promise<void> {
  const current = await driveFetch<{ parents?: string[] }>(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(
      fileId
    )}?fields=parents`,
    accessToken
  );
  const prevParents = (current.parents || []).join(',');
  const query = new URLSearchParams({
    addParents: targetFolderId,
    fields: 'id,parents',
  });
  if (prevParents) {
    query.set('removeParents', prevParents);
  }

  await driveFetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(
      fileId
    )}?${query.toString()}`,
    accessToken,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    }
  );
}

export async function listDriveImagesInFolder(
  accessToken: string,
  imagesFolderId: string
): Promise<DriveImageFile[]> {
  const q = `'${imagesFolderId}' in parents and trashed=false and mimeType contains 'image/'`;
  const res = await driveFetch<{
    files?: {
      id: string;
      name: string;
      webViewLink?: string;
      createdTime?: string;
    }[];
  }>(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
      q
    )}&orderBy=createdTime desc&fields=files(id,name,webViewLink,createdTime)&pageSize=100`,
    accessToken
  );

  return (res.files || []).map((f) => ({
    id: f.id,
    name: f.name,
    webViewLink:
      f.webViewLink || `https://drive.google.com/file/d/${f.id}/view`,
    imageUrl: buildDriveImageUrl(f.id),
    createdTime: f.createdTime,
  }));
}

export async function uploadImageToDriveFolder(
  accessToken: string,
  file: File,
  imagesFolderId: string,
  customFileName?: string
): Promise<DriveImageFile> {
  const metadata = {
    name: (customFileName || file.name || `moto-${Date.now()}.jpg`).trim(),
    parents: [imagesFolderId],
  };

  const form = new FormData();
  form.append(
    'metadata',
    new Blob([JSON.stringify(metadata)], { type: 'application/json' })
  );
  form.append('file', file);

  const uploaded = await driveFetch<{
    id: string;
    name: string;
    webViewLink?: string;
    createdTime?: string;
  }>(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,createdTime',
    accessToken,
    {
      method: 'POST',
      body: form,
    }
  );

  // Make image readable by anyone with the link so advisors can view catalog thumbnails
  try {
    await driveFetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(
        uploaded.id
      )}/permissions`,
      accessToken,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'reader', type: 'anyone' }),
      }
    );
  } catch {
    // Non-fatal if organization restricts public link sharing; owner still views it
  }

  return {
    id: uploaded.id,
    name: uploaded.name,
    webViewLink:
      uploaded.webViewLink ||
      `https://drive.google.com/file/d/${uploaded.id}/view`,
    imageUrl: buildDriveImageUrl(uploaded.id),
    createdTime: uploaded.createdTime,
  };
}

export async function deleteDriveFile(
  accessToken: string,
  fileId: string
): Promise<void> {
  await driveFetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`,
    accessToken,
    { method: 'DELETE' }
  );
}
