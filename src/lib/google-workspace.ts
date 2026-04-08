import { google } from 'googleapis';

// ---- Auth ----

function getAuth() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!email || !key) {
    throw new Error('Missing Google service account credentials');
  }

  return new google.auth.JWT({
    email,
    key,
    scopes: [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/gmail.compose',
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/drive',
    ],
    subject: process.env.GMAIL_USER_EMAIL, // Domain-wide delegation
  });
}

// ---- Sheets ----

export async function getSheetData(
  range: string,
  spreadsheetId?: string,
): Promise<string[][]> {
  const auth = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });
  const id = spreadsheetId || process.env.GOOGLE_SHEETS_ID;

  if (!id) throw new Error('Missing GOOGLE_SHEETS_ID');

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: id,
    range,
  });

  return (response.data.values as string[][]) || [];
}

export async function appendSheetRow(
  range: string,
  values: string[][],
  spreadsheetId?: string,
): Promise<void> {
  const auth = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });
  const id = spreadsheetId || process.env.GOOGLE_SHEETS_ID;

  if (!id) throw new Error('Missing GOOGLE_SHEETS_ID');

  await sheets.spreadsheets.values.append({
    spreadsheetId: id,
    range,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values },
  });
}

// ---- Gmail ----

export async function createGmailDraft(opts: {
  to: string;
  cc?: string;
  subject: string;
  body: string;
}): Promise<string> {
  const auth = getAuth();
  const gmail = google.gmail({ version: 'v1', auth });

  const headers = [
    `To: ${opts.to}`,
    opts.cc ? `Cc: ${opts.cc}` : '',
    `Subject: ${opts.subject}`,
    'Content-Type: text/plain; charset=utf-8',
    '',
    opts.body,
  ]
    .filter(Boolean)
    .join('\n');

  const encodedMessage = Buffer.from(headers)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const response = await gmail.users.drafts.create({
    userId: 'me',
    requestBody: {
      message: { raw: encodedMessage },
    },
  });

  return response.data.id || '';
}

export async function sendGmailDraft(draftId: string): Promise<string> {
  const auth = getAuth();
  const gmail = google.gmail({ version: 'v1', auth });

  const response = await gmail.users.drafts.send({
    userId: 'me',
    requestBody: { id: draftId },
  });

  return response.data.id || '';
}

// ---- Drive ----

export async function createDriveFolder(
  name: string,
  parentFolderId?: string,
): Promise<string> {
  const auth = getAuth();
  const drive = google.drive({ version: 'v3', auth });
  const parent = parentFolderId || process.env.GOOGLE_DRIVE_FOLDER_ID;

  const response = await drive.files.create({
    requestBody: {
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: parent ? [parent] : undefined,
    },
    fields: 'id',
  });

  return response.data.id || '';
}

export interface DriveFileResult {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
}

export async function searchDriveFiles(opts: {
  name_contains: string;
  modified_after?: string;
  modified_before?: string;
  mime_type?: string;
}): Promise<DriveFileResult[]> {
  const auth = getAuth();
  const drive = google.drive({ version: 'v3', auth });
  const parentId = process.env.GOOGLE_DRIVE_FOLDER_ID;

  const parts: string[] = [`name contains '${opts.name_contains.replace(/'/g, "\\'")}'`];
  if (opts.modified_after) parts.push(`modifiedTime > '${opts.modified_after}'`);
  if (opts.modified_before) parts.push(`modifiedTime < '${opts.modified_before}'`);
  if (opts.mime_type) parts.push(`mimeType = '${opts.mime_type}'`);
  if (parentId) parts.push(`'${parentId}' in parents`);
  parts.push('trashed = false');

  const response = await drive.files.list({
    q: parts.join(' and '),
    fields: 'files(id,name,mimeType,modifiedTime)',
    orderBy: 'modifiedTime desc',
    pageSize: 10,
  });

  return (response.data.files ?? []) as DriveFileResult[];
}

export async function downloadDriveFile(
  fileId: string,
): Promise<{ buffer: Buffer; mimeType: string }> {
  const auth = getAuth();
  const drive = google.drive({ version: 'v3', auth });

  const meta = await drive.files.get({ fileId, fields: 'mimeType' });
  const mimeType = meta.data.mimeType ?? 'application/octet-stream';

  const response = await drive.files.get(
    { fileId, alt: 'media' },
    { responseType: 'arraybuffer' },
  );

  return { buffer: Buffer.from(response.data as ArrayBuffer), mimeType };
}

export async function uploadFileToDrive(opts: {
  name: string;
  mimeType: string;
  body: Buffer;
  folderId: string;
}): Promise<string> {
  const auth = getAuth();
  const drive = google.drive({ version: 'v3', auth });

  const { Readable } = await import('stream');
  const stream = new Readable();
  stream.push(opts.body);
  stream.push(null);

  const response = await drive.files.create({
    requestBody: {
      name: opts.name,
      parents: [opts.folderId],
    },
    media: {
      mimeType: opts.mimeType,
      body: stream,
    },
    fields: 'id',
  });

  return response.data.id || '';
}
