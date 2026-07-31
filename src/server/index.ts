import { createToken, verifyToken, verifyPassword, getUserByEmail, getUserById, createUser, type UserPayload } from './auth';
import { getDb } from '../lib/db';
import { randomUUID } from 'crypto';
import { readFileSync, existsSync } from 'fs';
import { join, extname } from 'path';

const PORT = parseInt(process.env.API_PORT || '3001');
const STATIC_DIR = join(import.meta.dirname || '.', '../../dist');

// CORS headers for dev (Vite on 3000 calls API on 3001)
function corsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
  };
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
  });
}

function error(msg: string, status = 400): Response {
  return json({ error: msg }, status);
}

async function getTokenFromRequest(req: Request): Promise<string | null> {
  const auth = req.headers.get('Authorization');
  if (auth?.startsWith('Bearer ')) {
    return auth.slice(7);
  }
  return null;
}

async function requireAuth(req: Request): Promise<{ payload: UserPayload; error: Response }> {
  const token = await getTokenFromRequest(req);
  if (!token) return { payload: null as unknown as UserPayload, error: error('Unauthorized', 401) };
  const payload = await verifyToken(token);
  if (!payload) return { payload: null as unknown as UserPayload, error: error('Invalid or expired token', 401) };
  return { payload, error: null as unknown as Response };
}

// MIME types for static file serving
const mimeTypes: Record<string, string> = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.mjs': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

function serveStatic(pathname: string): Response | null {
  let filePath = join(STATIC_DIR, pathname === '/' ? 'index.html' : pathname);
  
  // SPA fallback: if not a file, serve index.html
  if (!existsSync(filePath)) {
    filePath = join(STATIC_DIR, 'index.html');
  }
  
  if (!existsSync(filePath)) return null;
  
  const ext = extname(filePath);
  const contentType = mimeTypes[ext] || 'application/octet-stream';
  const body = readFileSync(filePath);
  
  return new Response(body, {
    headers: { 'Content-Type': contentType, ...corsHeaders() },
  });
}

async function handleApiRequest(req: Request, url: URL): Promise<Response> {
  const path = url.pathname;
  const method = req.method;

  // CORS preflight
  if (method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  // POST /api/auth/signup
  if (path === '/api/auth/signup' && method === 'POST') {
    try {
      const body = await req.json() as { email?: string; password?: string; name?: string; team_name?: string };
      if (!body.email || !body.password || !body.name) {
        return error('Email, password, and name are required');
      }
      if (body.password.length < 6) {
        return error('Password must be at least 6 characters');
      }
      const existing = getUserByEmail(body.email.toLowerCase().trim());
      if (existing) {
        return error('An account with this email already exists', 409);
      }

      // Create team if team_name provided
      let teamId: string | null = null;
      if (body.team_name?.trim()) {
        const db = getDb();
        teamId = randomUUID();
        db.prepare('INSERT INTO teams (id, name) VALUES (?, ?)').run(teamId, body.team_name.trim());
      }

      const user = createUser(body.email.toLowerCase().trim(), body.password, body.name.trim(), teamId);
      const token = await createToken({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        team_id: user.team_id,
      });

      return json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role, team_id: user.team_id } });
    } catch (e) {
      return error('Internal server error', 500);
    }
  }

  // POST /api/auth/login
  if (path === '/api/auth/login' && method === 'POST') {
    try {
      const body = await req.json() as { email?: string; password?: string };
      if (!body.email || !body.password) {
        return error('Email and password are required');
      }
      const user = getUserByEmail(body.email.toLowerCase().trim());
      if (!user) {
        return error('Invalid email or password', 401);
      }
      const valid = await verifyPassword(body.password, user.password_hash);
      if (!valid) {
        return error('Invalid email or password', 401);
      }
      const token = await createToken({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        team_id: user.team_id,
      });
      return json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role, team_id: user.team_id } });
    } catch (e) {
      return error('Internal server error', 500);
    }
  }

  // GET /api/auth/me
  if (path === '/api/auth/me' && method === 'GET') {
    const { payload, error: err } = await requireAuth(req);
    if (err) return err;
    
    // Re-fetch user from DB to get fresh data
    const user = getUserById(payload.id);
    if (!user) return error('User not found', 404);
    
    return json({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      team_id: user.team_id,
    });
  }

  return error('Not found', 404);
}

Bun.serve({
  port: PORT,
  hostname: '0.0.0.0',
  async fetch(req: Request) {
    const url = new URL(req.url);
    const path = url.pathname;

    // API routes
    if (path.startsWith('/api/')) {
      return handleApiRequest(req, url);
    }

    // Static files for production
    return serveStatic(path) || new Response('Not found', { status: 404 });
  },
});

console.log(`KickIQ API server running on http://0.0.0.0:${PORT}`);
