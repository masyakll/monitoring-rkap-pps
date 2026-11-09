import { randomBytes, randomUUID, createHash } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { readState, updateState, type UserRecord } from './db.js';

function boundedInteger(name: string, fallback: number, min: number, max: number) {
  const value = Number(process.env[name] || fallback);
  return Number.isFinite(value) ? Math.max(min, Math.min(max, Math.floor(value))) : fallback;
}
const sessionHours = boundedInteger('SESSION_TTL_HOURS', 8, 1, 72);
const maxAttempts = boundedInteger('LOGIN_MAX_ATTEMPTS', 5, 3, 20);
const windowMs = boundedInteger('LOGIN_WINDOW_MINUTES', 15, 1, 1440) * 60_000;
let fakeHashPromise: Promise<string> | null = null;
function fakeHash() {
  if (!fakeHashPromise) fakeHashPromise = bcrypt.hash(randomBytes(24).toString('base64url'), 12);
  return fakeHashPromise;
}
function attemptKey(ip: string, username: string) {
  return createHash('sha256').update(`${ip}\0${username.trim().toLowerCase()}`).digest('hex');
}

export async function login(usernameInput: unknown, passwordInput: unknown, ip: string) {
  if (typeof usernameInput !== 'string' || typeof passwordInput !== 'string' || usernameInput.length > 128 || passwordInput.length > 1024) {
    return { ok: false as const, status: 400, error: 'Username atau kata sandi tidak valid.' };
  }
  const username = usernameInput.trim().toLowerCase();
  if (!username || !passwordInput) return { ok: false as const, status: 401, error: 'Username atau kata sandi salah.' };
  const key = attemptKey(ip || 'unknown', username);
  const now = Date.now();
  const state = await readState();
  const attempt = state.loginAttempts[key];
  if (attempt?.blockedUntil && attempt.blockedUntil > now) {
    const retrySeconds = Math.max(1, Math.ceil((attempt.blockedUntil - now) / 1000));
    return { ok: false as const, status: 429, error: `Terlalu banyak percobaan. Coba lagi sekitar ${Math.ceil(retrySeconds / 60)} menit.` };
  }
  const user = state.users.find((u) => u.username === username);
  const hash = user?.passwordHash || await fakeHash();
  const passOk = await bcrypt.compare(passwordInput, hash);
  if (!user || !passOk) {
    await updateState((mutable) => {
      const old = mutable.loginAttempts[key];
      const failures = (old?.failures || []).filter((t) => now - t < windowMs);
      failures.push(now);
      mutable.loginAttempts[key] = {
        key,
        failures,
        blockedUntil: failures.length >= maxAttempts ? now + windowMs : 0
      };
    });
    return { ok: false as const, status: 401, error: 'Username atau kata sandi salah.' };
  }
  const sid = randomBytes(32).toString('base64url');
  const expiresAt = now + sessionHours * 60 * 60 * 1000;
  await updateState((mutable) => {
    delete mutable.loginAttempts[key];
    mutable.sessions[sid] = { userId: user.id, createdAt: now, expiresAt };
  });
  return { ok: true as const, sid, expiresAt, user: safeUser(user) };
}

export function safeUser(user: UserRecord) {
  return { id: user.id, username: user.username, displayName: user.displayName, role: user.role, picName: user.picName };
}

export async function userForSession(sid: string | undefined) {
  if (!sid || !/^[\w-]{40,50}$/.test(sid)) return null;
  const now = Date.now();
  const state = await readState();
  const session = state.sessions[sid];
  if (!session || session.expiresAt <= now) {
    if (session) await updateState((mutable) => { delete mutable.sessions[sid]; });
    return null;
  }
  const user = state.users.find((u) => u.id === session.userId);
  if (!user) return null;
  return safeUser(user);
}

export async function destroySession(sid: string | undefined) {
  if (!sid) return;
  await updateState((state) => { delete state.sessions[sid]; });
}

export function sessionCookieOptions(secure: boolean) {
  return {
    httpOnly: true,
    sameSite: 'strict' as const,
    secure,
    path: '/',
    maxAge: sessionHours * 60 * 60
  };
}

export async function cleanExpiredSessions() {
  const now = Date.now();
  await updateState((state) => {
    for (const [sid, session] of Object.entries(state.sessions)) if (session.expiresAt <= now) delete state.sessions[sid];
    for (const [key, attempt] of Object.entries(state.loginAttempts)) {
      attempt.failures = attempt.failures.filter((timestamp) => now - timestamp < windowMs);
      if (!attempt.failures.length && (!attempt.blockedUntil || attempt.blockedUntil <= now)) delete state.loginAttempts[key];
    }
  });
}
