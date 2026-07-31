import { getDb } from '../lib/db';
import { randomUUID } from 'crypto';

// JWT secret — in production this would come from an env var
const JWT_SECRET = process.env.JWT_SECRET || 'kickiqlucas-dev-secret-change-in-production';

export interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  name: string;
  role: 'admin' | 'coach' | 'kicker' | 'viewer';
  team_id: string | null;
  created_at: string;
}

export interface UserPayload {
  id: string;
  email: string;
  name: string;
  role: string;
  team_id: string | null;
}

// Simple base64url encode without padding
function base64UrlEncode(buf: Uint8Array): string {
  let str = '';
  for (const byte of buf) {
    str += String.fromCharCode(byte);
  }
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(str: string): Uint8Array {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  const binary = atob(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// HMAC-SHA256 based JWT
const encoder = new TextEncoder();

async function hmacSha256(key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, data);
  return new Uint8Array(sig);
}

export async function createToken(payload: UserPayload): Promise<string> {
  const header = base64UrlEncode(encoder.encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const body = base64UrlEncode(encoder.encode(JSON.stringify({
    ...payload,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7, // 7 days
  })));
  const key = encoder.encode(JWT_SECRET);
  const data = encoder.encode(`${header}.${body}`);
  const sig = base64UrlEncode(await hmacSha256(key, data));
  return `${header}.${body}.${sig}`;
}

export async function verifyToken(token: string): Promise<UserPayload | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [headerB64, bodyB64, sigB64] = parts;

    // Verify signature
    const key = encoder.encode(JWT_SECRET);
    const data = encoder.encode(`${headerB64}.${bodyB64}`);
    const expectedSig = base64UrlEncode(await hmacSha256(key, data));
    if (sigB64 !== expectedSig) return null;

    // Decode payload
    const bodyBytes = base64UrlDecode(bodyB64);
    const body = JSON.parse(new TextDecoder().decode(bodyBytes));

    // Check expiration
    if (body.exp && body.exp < Math.floor(Date.now() / 1000)) return null;

    return {
      id: body.id,
      email: body.email,
      name: body.name,
      role: body.role,
      team_id: body.team_id,
    };
  } catch {
    return null;
  }
}

export function hashPassword(password: string): Promise<string> {
  return Bun.password.hash(password, { algorithm: 'bcrypt', cost: 10 });
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return Bun.password.verify(password, hash);
}

export function getUserByEmail(email: string): UserRow | undefined {
  const db = getDb();
  return db.prepare('SELECT * FROM users WHERE email = ?').get(email) as UserRow | undefined;
}

export function getUserById(id: string): UserRow | undefined {
  const db = getDb();
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow | undefined;
}

export function createUser(email: string, password: string, name: string, teamId: string | null): UserRow {
  const db = getDb();
  const id = randomUUID();
  const passwordHash = Bun.password.hashSync(password, { algorithm: 'bcrypt', cost: 10 });
  db.prepare(
    'INSERT INTO users (id, email, password_hash, name, role, team_id) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(id, email, passwordHash, name, 'coach', teamId);
  return getUserById(id)!;
}
