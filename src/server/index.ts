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

  // === TEAM ROUTES ===

  // GET /api/teams/:id
  const teamMatch = path.match(/^\/api\/teams\/([a-f0-9-]+)$/);
  if (teamMatch && method === 'GET') {
    const { payload, error: err } = await requireAuth(req);
    if (err) return err;
    const teamId = teamMatch[1];
    
    const db = getDb();
    const team = db.prepare('SELECT id, name, created_at FROM teams WHERE id = ?').get(teamId) as Record<string, unknown> | undefined;
    if (!team) return error('Team not found', 404);
    
    // Only allow users on this team (or admins)
    if (payload.team_id !== teamId && payload.role !== 'admin') {
      return error('Forbidden', 403);
    }
    
    // Get athlete count
    const athleteCount = db.prepare('SELECT COUNT(*) as count FROM athletes WHERE team_id = ?').get(teamId) as { count: number };
    
    return json({ ...team, athlete_count: athleteCount.count });
  }

  // === ATHLETE ROUTES ===

  // GET /api/athletes
  if (path === '/api/athletes' && method === 'GET') {
    const { payload, error: err } = await requireAuth(req);
    if (err) return err;
    if (!payload.team_id) return error('No team assigned', 400);
    
    const db = getDb();
    const athletes = db.prepare(`
      SELECT 
        a.id, a.first_name, a.last_name, a.number, a.class_year, a.dominant_foot,
        a.height, a.weight, a.photo_url, a.created_at, a.updated_at,
        COUNT(k.id) as total_kicks,
        SUM(CASE WHEN k.result = 'made' THEN 1 ELSE 0 END) as total_makes
      FROM athletes a
      LEFT JOIN kicks k ON k.athlete_id = a.id
      WHERE a.team_id = ?
      GROUP BY a.id
      ORDER BY a.last_name, a.first_name
    `).all(payload.team_id) as Record<string, unknown>[];
    
    return json(athletes);
  }

  // GET /api/athletes/:id
  const athleteMatch = path.match(/^\/api\/athletes\/([a-f0-9-]+)$/);
  if (athleteMatch && method === 'GET') {
    const { payload, error: err } = await requireAuth(req);
    if (err) return err;
    
    const athleteId = athleteMatch[1];
    const db = getDb();
    
    const athlete = db.prepare(`
      SELECT a.*, t.name as team_name
      FROM athletes a
      JOIN teams t ON t.id = a.team_id
      WHERE a.id = ?
    `).get(athleteId) as Record<string, unknown> | undefined;
    
    if (!athlete) return error('Athlete not found', 404);
    if (payload.team_id !== athlete.team_id && payload.role !== 'admin') {
      return error('Forbidden', 403);
    }
    
    // Stats
    const totalKicks = db.prepare('SELECT COUNT(*) as count FROM kicks WHERE athlete_id = ?').get(athleteId) as { count: number };
    const totalMakes = db.prepare("SELECT COUNT(*) as count FROM kicks WHERE athlete_id = ? AND result = 'made'").get(athleteId) as { count: number };
    const longestMake = db.prepare("SELECT MAX(distance) as dist FROM kicks WHERE athlete_id = ? AND result = 'made'").get(athleteId) as { dist: number | null };
    
    const practiceKicks = db.prepare(`
      SELECT COUNT(*) as count FROM kicks k
      JOIN sessions s ON s.id = k.session_id
      WHERE k.athlete_id = ? AND s.type = 'practice'
    `).get(athleteId) as { count: number };
    
    const gameKicks = db.prepare(`
      SELECT COUNT(*) as count FROM kicks k
      JOIN sessions s ON s.id = k.session_id
      WHERE k.athlete_id = ? AND s.type = 'game'
    `).get(athleteId) as { count: number };
    
    const practiceMakes = db.prepare(`
      SELECT COUNT(*) as count FROM kicks k
      JOIN sessions s ON s.id = k.session_id
      WHERE k.athlete_id = ? AND s.type = 'practice' AND k.result = 'made'
    `).get(athleteId) as { count: number };
    
    const gameMakes = db.prepare(`
      SELECT COUNT(*) as count FROM kicks k
      JOIN sessions s ON s.id = k.session_id
      WHERE k.athlete_id = ? AND s.type = 'game' AND k.result = 'made'
    `).get(athleteId) as { count: number };
    
    // Get recent sessions
    const recentSessions = db.prepare(`
      SELECT s.id, s.type, s.notes, s.started_at, s.ended_at,
        COUNT(k.id) as kick_count,
        SUM(CASE WHEN k.result = 'made' THEN 1 ELSE 0 END) as makes
      FROM sessions s
      LEFT JOIN kicks k ON k.session_id = s.id
      WHERE s.athlete_id = ?
      GROUP BY s.id
      ORDER BY s.started_at DESC
      LIMIT 10
    `).all(athleteId) as Record<string, unknown>[];
    
    return json({
      ...athlete,
      stats: {
        total_kicks: totalKicks.count,
        total_makes: totalMakes.count,
        fg_percentage: totalKicks.count > 0 ? Math.round((totalMakes.count / totalKicks.count) * 100) : 0,
        longest_make: longestMake.dist,
        practice_kicks: practiceKicks.count,
        practice_makes: practiceMakes.count,
        game_kicks: gameKicks.count,
        game_makes: gameMakes.count,
      },
      recent_sessions: recentSessions,
    });
  }

  // POST /api/athletes
  if (path === '/api/athletes' && method === 'POST') {
    const { payload, error: err } = await requireAuth(req);
    if (err) return err;
    if (!payload.team_id) return error('No team assigned', 400);
    
    const body = await req.json() as {
      first_name?: string;
      last_name?: string;
      number?: string;
      class_year?: string;
      dominant_foot?: string;
      height?: string;
      weight?: string;
      photo_url?: string;
    };
    
    if (!body.first_name?.trim() || !body.last_name?.trim()) {
      return error('First name and last name are required');
    }
    
    const id = randomUUID();
    const db = getDb();
    
    db.prepare(`
      INSERT INTO athletes (id, team_id, first_name, last_name, number, class_year, dominant_foot, height, weight, photo_url)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      payload.team_id,
      body.first_name.trim(),
      body.last_name.trim(),
      body.number?.trim() || null,
      body.class_year?.trim() || null,
      body.dominant_foot?.trim() || null,
      body.height?.trim() || null,
      body.weight?.trim() || null,
      body.photo_url?.trim() || null,
    );
    
    const athlete = db.prepare('SELECT * FROM athletes WHERE id = ?').get(id) as Record<string, unknown>;
    return json(athlete, 201);
  }

  // PATCH /api/athletes/:id
  const athletePatchMatch = path.match(/^\/api\/athletes\/([a-f0-9-]+)$/);
  if (athletePatchMatch && method === 'PATCH') {
    const { payload, error: err } = await requireAuth(req);
    if (err) return err;
    
    const athleteId = athletePatchMatch[1];
    const db = getDb();
    
    const existing = db.prepare('SELECT * FROM athletes WHERE id = ?').get(athleteId) as Record<string, unknown> | undefined;
    if (!existing) return error('Athlete not found', 404);
    if (payload.team_id !== existing.team_id && payload.role !== 'admin') {
      return error('Forbidden', 403);
    }
    
    const body = await req.json() as Record<string, string | undefined>;
    
    // Build dynamic UPDATE
    const allowedFields = ['first_name', 'last_name', 'number', 'class_year', 'dominant_foot', 'height', 'weight', 'photo_url'];
    const updates: string[] = [];
    const values: (string | null)[] = [];
    
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates.push(`${field} = ?`);
        values.push(body[field]?.trim() ?? null);
      }
    }
    
    if (updates.length === 0) return error('No fields to update');
    
    updates.push("updated_at = datetime('now')");
    values.push(athleteId);
    
    db.prepare(`UPDATE athletes SET ${updates.join(', ')} WHERE id = ?`).run(...values as [string | null, ...(string | null)[]]);
    
    const athlete = db.prepare('SELECT * FROM athletes WHERE id = ?').get(athleteId) as Record<string, unknown>;
    return json(athlete);
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
