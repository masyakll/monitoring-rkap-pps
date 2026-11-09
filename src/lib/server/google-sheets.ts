import { createSign } from 'node:crypto';
import { readFile } from 'node:fs/promises';

export type SheetCell = string | number | boolean | null;
export type SheetRows = SheetCell[][];

type ServiceAccount = {
  client_email?: string;
  private_key?: string;
  token_uri?: string;
};

type CachedValues = { at: number; rows: SheetRows };

const VALUE_CACHE_MS = 45_000;
const valuesCache = new Map<string, CachedValues>();
let tokenCache: { value: string; expiresAt: number } | null = null;

function envValue(name: string): string {
  return (process.env[name] || '').trim();
}

function cleanRange(value: string): string {
  const trimmed = value.trim();
  // Keep single quotes around Google Sheets tab names (for example 'Penyerapan RKAP'!A1:Z).
  if (trimmed.length >= 2 && trimmed.startsWith('"') && trimmed.endsWith('"')) return trimmed.slice(1, -1).trim();
  return trimmed;
}

function encodeBase64Url(value: string | Buffer): string {
  return Buffer.from(value).toString('base64url');
}

async function getServiceAccount(): Promise<ServiceAccount> {
  let raw = '';
  const keyFile = envValue('GOOGLE_SERVICE_ACCOUNT_KEY_FILE');
  const keyBase64 = envValue('GOOGLE_SERVICE_ACCOUNT_JSON_BASE64');

  if (keyFile) {
    try {
      raw = await readFile(keyFile, 'utf8');
    } catch {
      throw new Error('File key service account Google tidak dapat dibaca. Periksa GOOGLE_SERVICE_ACCOUNT_KEY_FILE.');
    }
  } else if (keyBase64) {
    try {
      raw = Buffer.from(keyBase64, 'base64').toString('utf8');
    } catch {
      throw new Error('Format GOOGLE_SERVICE_ACCOUNT_JSON_BASE64 tidak valid.');
    }
  } else {
    throw new Error('Kredensial Google Sheets belum dikonfigurasi. Isi GOOGLE_SERVICE_ACCOUNT_KEY_FILE atau GOOGLE_SERVICE_ACCOUNT_JSON_BASE64 di .env.');
  }

  let account: ServiceAccount;
  try {
    account = JSON.parse(raw) as ServiceAccount;
  } catch {
    throw new Error('File kredensial Google bukan JSON yang valid.');
  }
  if (!account.client_email || !account.private_key) {
    throw new Error('Kredensial Google harus berisi client_email dan private_key.');
  }
  return account;
}

async function getAccessToken(): Promise<string> {
  if (tokenCache && tokenCache.expiresAt > Date.now() + 60_000) return tokenCache.value;

  const account = await getServiceAccount();
  const now = Math.floor(Date.now() / 1000);
  const header = encodeBase64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = encodeBase64Url(JSON.stringify({
    iss: account.client_email,
    scope: 'https://www.googleapis.com/auth/spreadsheets.readonly',
    aud: account.token_uri || 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600
  }));
  const unsigned = `${header}.${claims}`;
  const signer = createSign('RSA-SHA256');
  signer.update(unsigned);
  signer.end();
  const assertion = `${unsigned}.${signer.sign(account.private_key!, 'base64url')}`;
  const body = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion
  });

  let response: Response;
  try {
    response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      signal: AbortSignal.timeout(15_000)
    });
  } catch {
    throw new Error('Tidak dapat menghubungi layanan autentikasi Google. Periksa koneksi jaringan server.');
  }
  if (!response.ok) {
    tokenCache = null;
    throw new Error(`Autentikasi Google Sheets gagal (HTTP ${response.status}). Periksa kredensial service account.`);
  }
  const result = await response.json() as { access_token?: string; expires_in?: number };
  if (!result.access_token) throw new Error('Google tidak mengembalikan access token.');
  tokenCache = {
    value: result.access_token,
    expiresAt: Date.now() + Math.max(60, Number(result.expires_in || 3600)) * 1000
  };
  return tokenCache.value;
}

export function getMonitoringSpreadsheetId(): string {
  const id = envValue('GOOGLE_SHEETS_SPREADSHEET_ID');
  if (!id || !/^[a-zA-Z0-9_-]+$/.test(id)) {
    throw new Error('GOOGLE_SHEETS_SPREADSHEET_ID belum diisi atau format ID tidak valid. Gunakan ID spreadsheet, bukan URL lengkap.');
  }
  return id;
}

export function getMonitoringRange(): string {
  return cleanRange(envValue('MONITORING_SHEET_RANGE') || "'Monitor Investasi2026'!A7:DF5000");
}

export function getAbsorptionSpreadsheetId(): string {
  const separateId = envValue('ABSORPTION_SPREADSHEET_ID');
  if (separateId && !/^[a-zA-Z0-9_-]+$/.test(separateId)) {
    throw new Error('ABSORPTION_SPREADSHEET_ID tidak valid. Gunakan ID spreadsheet, bukan URL lengkap.');
  }
  return separateId || getMonitoringSpreadsheetId();
}

export function getAbsorptionRange(): string {
  return cleanRange(envValue('ABSORPTION_SHEET_RANGE') || "'Penyerapan RKAP'!A1:Z5000");
}

export async function readSheetValues(
  spreadsheetId: string,
  range: string,
  options: { force?: boolean } = {}
): Promise<SheetRows> {
  const cleanId = spreadsheetId.trim();
  const clean = cleanRange(range);
  if (!/^[a-zA-Z0-9_-]+$/.test(cleanId)) throw new Error('ID spreadsheet tidak valid.');
  if (!clean || clean.length > 300) throw new Error('Range Google Sheets belum diisi atau terlalu panjang.');

  const key = `${cleanId}::${clean}`;
  const cached = valuesCache.get(key);
  if (!options.force && cached && Date.now() - cached.at < VALUE_CACHE_MS) return cached.rows;

  const token = await getAccessToken();
  const url = new URL(`https://sheets.googleapis.com/v4/spreadsheets/${cleanId}/values/${encodeURIComponent(clean)}`);
  url.searchParams.set('valueRenderOption', 'FORMATTED_VALUE');
  url.searchParams.set('majorDimension', 'ROWS');

  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(20_000),
      cache: 'no-store'
    });
  } catch {
    throw new Error('Tidak dapat membaca Google Sheets. Periksa koneksi jaringan server.');
  }
  if (!response.ok) {
    const hint = response.status === 403 || response.status === 404
      ? 'Periksa apakah spreadsheet sudah dibagikan ke email service account dan range benar.'
      : 'Periksa konfigurasi sumber data.';
    throw new Error(`Pembacaan Google Sheets gagal (HTTP ${response.status}). ${hint}`);
  }

  const data = await response.json() as { values?: SheetRows };
  const rows = Array.isArray(data.values) ? data.values : [];
  valuesCache.set(key, { at: Date.now(), rows });
  return rows;
}

export function clearGoogleSheetCache() {
  valuesCache.clear();
}

export function configuredGoogleEmailHint(): string {
  // Service account email is intentionally not read back to browser/API responses.
  return envValue('GOOGLE_SHEETS_SPREADSHEET_ID') ? 'configured' : 'not-configured';
}
