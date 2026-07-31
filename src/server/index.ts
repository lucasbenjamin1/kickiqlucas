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

  // === SESSION ROUTES ===

  // GET /api/sessions — list recent sessions for user's team
  if (path === '/api/sessions' && method === 'GET') {
    const { payload, error: err } = await requireAuth(req);
    if (err) return err;
    if (!payload.team_id) return error('No team assigned', 400);

    const db = getDb();
    const sessions = db.prepare(`
      SELECT s.id, s.type, s.notes, s.started_at, s.ended_at, s.athlete_id,
        a.first_name, a.last_name, a.number,
        COUNT(k.id) as kick_count,
        SUM(CASE WHEN k.result = 'made' THEN 1 ELSE 0 END) as makes
      FROM sessions s
      JOIN athletes a ON a.id = s.athlete_id
      LEFT JOIN kicks k ON k.session_id = s.id
      WHERE s.team_id = ?
      GROUP BY s.id
      ORDER BY s.started_at DESC
      LIMIT 50
    `).all(payload.team_id) as Record<string, unknown>[];

    return json(sessions);
  }

  // POST /api/sessions — create session
  if (path === '/api/sessions' && method === 'POST') {
    const { payload, error: err } = await requireAuth(req);
    if (err) return err;
    if (!payload.team_id) return error('No team assigned', 400);

    const body = await req.json() as {
      athlete_id?: string;
      type?: string;
      notes?: string;
    };

    if (!body.athlete_id) return error('athlete_id is required');
    if (!body.type) return error('type is required');

    const validTypes = ['practice', 'game', 'pregame', 'scrimmage', 'tryout', 'camp', 'other'];
    if (!validTypes.includes(body.type)) {
      return error(`Invalid session type. Must be one of: ${validTypes.join(', ')}`);
    }

    const db = getDb();

    // Verify athlete belongs to user's team
    const athlete = db.prepare('SELECT id FROM athletes WHERE id = ? AND team_id = ?')
      .get(body.athlete_id, payload.team_id) as Record<string, unknown> | undefined;
    if (!athlete) return error('Athlete not found or not in your team', 404);

    const id = randomUUID();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO sessions (id, team_id, athlete_id, type, notes, started_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, payload.team_id, body.athlete_id, body.type, body.notes?.trim() || null, now);

    const session = db.prepare(`
      SELECT s.*, a.first_name, a.last_name, a.number
      FROM sessions s
      JOIN athletes a ON a.id = s.athlete_id
      WHERE s.id = ?
    `).get(id) as Record<string, unknown>;

    return json(session, 201);
  }

  // GET /api/sessions/:id — get session with kick count and kicks
  const sessionDetailMatch = path.match(/^\/api\/sessions\/([a-f0-9-]+)$/);
  if (sessionDetailMatch && method === 'GET') {
    const { payload, error: err } = await requireAuth(req);
    if (err) return err;

    const sessionId = sessionDetailMatch[1];
    const db = getDb();

    const session = db.prepare(`
      SELECT s.*, a.first_name, a.last_name, a.number
      FROM sessions s
      JOIN athletes a ON a.id = s.athlete_id
      WHERE s.id = ?
    `).get(sessionId) as Record<string, unknown> | undefined;

    if (!session) return error('Session not found', 404);
    if (payload.team_id !== session.team_id && payload.role !== 'admin') {
      return error('Forbidden', 403);
    }

    const kickCount = db.prepare('SELECT COUNT(*) as count FROM kicks WHERE session_id = ?')
      .get(sessionId) as { count: number };

    const kicks = db.prepare('SELECT * FROM kicks WHERE session_id = ? ORDER BY created_at ASC')
      .all(sessionId) as Record<string, unknown>[];

    return json({ ...session, kick_count: kickCount.count, kicks });
  }

  // PATCH /api/sessions/:id — end session (set ended_at)
  const sessionPatchMatch = path.match(/^\/api\/sessions\/([a-f0-9-]+)$/);
  if (sessionPatchMatch && method === 'PATCH') {
    const { payload, error: err } = await requireAuth(req);
    if (err) return err;

    const sessionId = sessionPatchMatch[1];
    const db = getDb();

    const session = db.prepare('SELECT * FROM sessions WHERE id = ?')
      .get(sessionId) as Record<string, unknown> | undefined;

    if (!session) return error('Session not found', 404);
    if (payload.team_id !== session.team_id && payload.role !== 'admin') {
      return error('Forbidden', 403);
    }

    const body = await req.json() as { ended_at?: string };
    const endedAt = body.ended_at || new Date().toISOString();

    db.prepare('UPDATE sessions SET ended_at = ? WHERE id = ?').run(endedAt, sessionId);

    const updated = db.prepare(`
      SELECT s.*, a.first_name, a.last_name, a.number
      FROM sessions s
      JOIN athletes a ON a.id = s.athlete_id
      WHERE s.id = ?
    `).get(sessionId) as Record<string, unknown>;

    return json(updated);
  }

  // === KICK ROUTES ===

  // POST /api/sessions/:id/kicks — add kick
  const kicksAddMatch = path.match(/^\/api\/sessions\/([a-f0-9-]+)\/kicks$/);
  if (kicksAddMatch && method === 'POST') {
    const { payload, error: err } = await requireAuth(req);
    if (err) return err;

    const sessionId = kicksAddMatch[1];
    const db = getDb();

    const session = db.prepare('SELECT * FROM sessions WHERE id = ?')
      .get(sessionId) as Record<string, unknown> | undefined;

    if (!session) return error('Session not found', 404);
    if (payload.team_id !== session.team_id && payload.role !== 'admin') {
      return error('Forbidden', 403);
    }

    const body = await req.json() as {
      distance?: number;
      hash?: string;
      result?: string;
      miss_type?: string | null;
      landing_zone?: string | null;
      operation_time_ms?: number | null;
      notes?: string | null;
    };

    if (!body.distance || !body.hash || !body.result) {
      return error('distance, hash, and result are required');
    }

    const validHashes = ['left_hash', 'left_middle', 'middle', 'right_middle', 'right_hash'];
    const validResults = ['made', 'missed', 'blocked'];
    const validMissTypes = ['short', 'wide_left', 'wide_right', 'crossbar', 'blocked', null];
    const validLandingZones = ['goalpost', 'left', 'right', 'short', null];

    if (!validHashes.includes(body.hash)) return error('Invalid hash');
    if (!validResults.includes(body.result)) return error('Invalid result');
    if (body.miss_type && !validMissTypes.includes(body.miss_type)) return error('Invalid miss_type');
    if (body.landing_zone && !validLandingZones.includes(body.landing_zone)) return error('Invalid landing_zone');

    const id = randomUUID();

    const athleteId = session.athlete_id as string;

    db.prepare(`
      INSERT INTO kicks (id, session_id, athlete_id, distance, hash, result, miss_type, landing_zone, operation_time_ms, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, sessionId, athleteId,
      body.distance, body.hash, body.result,
      body.miss_type || null,
      body.landing_zone || null,
      body.operation_time_ms || null,
      body.notes || null,
    );

    const kick = db.prepare('SELECT * FROM kicks WHERE id = ?').get(id) as Record<string, unknown>;
    return json(kick, 201);
  }

  // DELETE /api/sessions/:id/kicks/:kickId — undo kick
  const kickDeleteMatch = path.match(/^\/api\/sessions\/([a-f0-9-]+)\/kicks\/([a-f0-9-]+)$/);
  if (kickDeleteMatch && method === 'DELETE') {
    const { payload, error: err } = await requireAuth(req);
    if (err) return err;

    const sessionId = kickDeleteMatch[1];
    const kickId = kickDeleteMatch[2];
    const db = getDb();

    const session = db.prepare('SELECT * FROM sessions WHERE id = ?')
      .get(sessionId) as Record<string, unknown> | undefined;

    if (!session) return error('Session not found', 404);
    if (payload.team_id !== session.team_id && payload.role !== 'admin') {
      return error('Forbidden', 403);
    }

    const kick = db.prepare('SELECT * FROM kicks WHERE id = ? AND session_id = ?')
      .get(kickId, sessionId) as Record<string, unknown> | undefined;

    if (!kick) return error('Kick not found', 404);

    db.prepare('DELETE FROM kicks WHERE id = ?').run(kickId);

    return json({ deleted: kickId });
  }

  // === STATS ROUTES ===

  // GET /api/stats/dashboard — pre-computed dashboard stats
  if (path === '/api/stats/dashboard' && method === 'GET') {
    const { payload, error: err } = await requireAuth(req);
    if (err) return err;
    if (!payload.team_id) return error('No team assigned', 400);

    const athleteId = url.searchParams.get('athlete_id');
    const db = getDb();

    // Build WHERE clause for team or athlete filtering
    const kickWhere = athleteId
      ? 'k.athlete_id = ?'
      : 's.team_id = ?';
    const kickParam = athleteId || payload.team_id;

    // --- Season stats ---
    const seasonStats = db.prepare(`
      SELECT
        COUNT(*) as attempts,
        SUM(CASE WHEN k.result = 'made' THEN 1 ELSE 0 END) as makes
      FROM kicks k
      JOIN sessions s ON s.id = k.session_id
      WHERE ${kickWhere}
    `).get(kickParam) as { attempts: number; makes: number };

    const seasonFgPct = seasonStats.attempts > 0
      ? Math.round((seasonStats.makes / seasonStats.attempts) * 100)
      : 0;

    // --- Last 30 days ---
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const last30Stats = db.prepare(`
      SELECT
        COUNT(*) as attempts,
        SUM(CASE WHEN k.result = 'made' THEN 1 ELSE 0 END) as makes
      FROM kicks k
      JOIN sessions s ON s.id = k.session_id
      WHERE ${kickWhere} AND k.created_at >= ?
    `).get(kickParam, thirtyDaysAgo) as { attempts: number; makes: number };

    const last30FgPct = last30Stats.attempts > 0
      ? Math.round((last30Stats.makes / last30Stats.attempts) * 100)
      : 0;

    // --- Last session ---
    const lastSession = db.prepare(`
      SELECT s.id, s.type, s.started_at, s.ended_at,
        COUNT(k.id) as attempts,
        SUM(CASE WHEN k.result = 'made' THEN 1 ELSE 0 END) as makes
      FROM sessions s
      LEFT JOIN kicks k ON k.session_id = s.id
      WHERE s.team_id = ?
        ${athleteId ? 'AND s.athlete_id = ?' : ''}
        AND s.ended_at IS NOT NULL
      GROUP BY s.id
      ORDER BY s.ended_at DESC
      LIMIT 1
    `).get(payload.team_id, ...(athleteId ? [athleteId] : [])) as
      { id: string; type: string; started_at: string; ended_at: string; attempts: number; makes: number } | undefined;

    const lastSessionData = lastSession ? {
      id: lastSession.id,
      type: lastSession.type,
      date: lastSession.ended_at,
      attempts: lastSession.attempts,
      makes: lastSession.makes,
      fg_pct: lastSession.attempts > 0
        ? Math.round((lastSession.makes / lastSession.attempts) * 100)
        : 0,
    } : null;

    // --- Estimated range: longest distance with >=3 attempts and >=60% makes ---
    const estimatedRangeRow = db.prepare(`
      SELECT k.distance,
        COUNT(*) as attempts,
        SUM(CASE WHEN k.result = 'made' THEN 1 ELSE 0 END) as makes
      FROM kicks k
      JOIN sessions s ON s.id = k.session_id
      WHERE ${kickWhere}
      GROUP BY k.distance
      HAVING attempts >= 3 AND (SUM(CASE WHEN k.result = 'made' THEN 1 ELSE 0 END) * 100.0 / COUNT(*)) >= 60
      ORDER BY k.distance DESC
      LIMIT 1
    `).get(kickParam) as { distance: number; attempts: number; makes: number } | undefined;

    const estimatedRange = estimatedRangeRow ? {
      distance: estimatedRangeRow.distance,
      attempts: estimatedRangeRow.attempts,
      makes: estimatedRangeRow.makes,
      confidence: Math.round((estimatedRangeRow.makes / estimatedRangeRow.attempts) * 100),
    } : null;

    // --- Best hash ---
    const bestHashRow = db.prepare(`
      SELECT k.hash,
        COUNT(*) as attempts,
        SUM(CASE WHEN k.result = 'made' THEN 1 ELSE 0 END) as makes
      FROM kicks k
      JOIN sessions s ON s.id = k.session_id
      WHERE ${kickWhere}
      GROUP BY k.hash
      HAVING attempts > 0
      ORDER BY (SUM(CASE WHEN k.result = 'made' THEN 1 ELSE 0 END) * 100.0 / COUNT(*)) DESC
      LIMIT 1
    `).get(kickParam) as { hash: string; attempts: number; makes: number } | undefined;

    const bestHash = bestHashRow ? {
      hash: bestHashRow.hash,
      attempts: bestHashRow.attempts,
      makes: bestHashRow.makes,
      fg_pct: Math.round((bestHashRow.makes / bestHashRow.attempts) * 100),
    } : null;

    // --- Most common miss ---
    const mostCommonMissRow = db.prepare(`
      SELECT k.miss_type,
        COUNT(*) as count
      FROM kicks k
      JOIN sessions s ON s.id = k.session_id
      WHERE ${kickWhere} AND k.miss_type IS NOT NULL
      GROUP BY k.miss_type
      ORDER BY count DESC
      LIMIT 1
    `).get(kickParam) as { miss_type: string; count: number } | undefined;

    const totalMisses = db.prepare(`
      SELECT COUNT(*) as count FROM kicks k
      JOIN sessions s ON s.id = k.session_id
      WHERE ${kickWhere} AND k.result != 'made'
    `).get(kickParam) as { count: number };

    const mostCommonMiss = mostCommonMissRow ? {
      type: mostCommonMissRow.miss_type,
      count: mostCommonMissRow.count,
      pct: totalMisses.count > 0 ? Math.round((mostCommonMissRow.count / totalMisses.count) * 100) : 0,
    } : null;

    // --- Avg operation time ---
    const avgOpTime = db.prepare(`
      SELECT AVG(k.operation_time_ms) as avg_ms
      FROM kicks k
      JOIN sessions s ON s.id = k.session_id
      WHERE ${kickWhere} AND k.operation_time_ms IS NOT NULL
    `).get(kickParam) as { avg_ms: number | null };

    // --- Trend: compare last 30d vs previous 30d ---
    const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();

    const prev30Stats = db.prepare(`
      SELECT
        COUNT(*) as attempts,
        SUM(CASE WHEN k.result = 'made' THEN 1 ELSE 0 END) as makes
      FROM kicks k
      JOIN sessions s ON s.id = k.session_id
      WHERE ${kickWhere} AND k.created_at >= ? AND k.created_at < ?
    `).get(kickParam, sixtyDaysAgo, thirtyDaysAgo) as { attempts: number; makes: number };

    const prev30FgPct = prev30Stats.attempts > 0
      ? Math.round((prev30Stats.makes / prev30Stats.attempts) * 100)
      : 0;

    const deltaPct = last30FgPct - prev30FgPct;
    const trend = {
      direction: deltaPct > 0 ? 'up' as const : deltaPct < 0 ? 'down' as const : 'flat' as const,
      delta_pct: deltaPct,
    };

    return json({
      athlete_id: athleteId || null,
      season_fg_pct: seasonFgPct,
      season_attempts: seasonStats.attempts,
      season_makes: seasonStats.makes,
      last_30_days_fg_pct: last30FgPct,
      last_30_days_attempts: last30Stats.attempts,
      last_30_days_makes: last30Stats.makes,
      last_session: lastSessionData,
      estimated_range: estimatedRange,
      best_hash: bestHash,
      most_common_miss: mostCommonMiss,
      avg_operation_time_ms: avgOpTime.avg_ms ? Math.round(avgOpTime.avg_ms) : null,
      trend,
    });
  }

  // GET /api/stats/tendencies — detailed stats for tendencies page
  if (path === '/api/stats/tendencies' && method === 'GET') {
    const { payload, error: err } = await requireAuth(req);
    if (err) return err;
    if (!payload.team_id) return error('No team assigned', 400);

    const athleteId = url.searchParams.get('athlete_id');
    if (!athleteId) return error('athlete_id is required');

    const db = getDb();

    // Verify athlete belongs to team
    const athlete = db.prepare('SELECT a.first_name, a.last_name, t.name as team_name FROM athletes a JOIN teams t ON t.id = a.team_id WHERE a.id = ? AND a.team_id = ?')
      .get(athleteId, payload.team_id) as { first_name: string; last_name: string; team_name: string } | undefined;
    if (!athlete) return error('Athlete not found', 404);

    // Season stats
    const seasonStats = db.prepare(`
      SELECT COUNT(*) as attempts, SUM(CASE WHEN result = 'made' THEN 1 ELSE 0 END) as makes
      FROM kicks WHERE athlete_id = ?
    `).get(athleteId) as { attempts: number; makes: number };

    // By distance
    const byDistance = db.prepare(`
      SELECT distance, COUNT(*) as attempts, SUM(CASE WHEN result = 'made' THEN 1 ELSE 0 END) as makes
      FROM kicks WHERE athlete_id = ?
      GROUP BY distance ORDER BY distance ASC
    `).all(athleteId) as { distance: number; attempts: number; makes: number }[];

    // By hash
    const byHash = db.prepare(`
      SELECT hash, COUNT(*) as attempts, SUM(CASE WHEN result = 'made' THEN 1 ELSE 0 END) as makes
      FROM kicks WHERE athlete_id = ?
      GROUP BY hash ORDER BY hash
    `).all(athleteId) as { hash: string; attempts: number; makes: number }[];

    // Miss breakdown
    const missBreakdown = db.prepare(`
      SELECT miss_type, COUNT(*) as count
      FROM kicks WHERE athlete_id = ? AND miss_type IS NOT NULL
      GROUP BY miss_type ORDER BY count DESC
    `).all(athleteId) as { miss_type: string; count: number }[];

    const totalMisses = db.prepare(`
      SELECT COUNT(*) as count FROM kicks WHERE athlete_id = ? AND result != 'made'
    `).get(athleteId) as { count: number };

    // Avg operation time
    const avgOpTime = db.prepare(`
      SELECT AVG(operation_time_ms) as avg_ms FROM kicks WHERE athlete_id = ? AND operation_time_ms IS NOT NULL
    `).get(athleteId) as { avg_ms: number | null };

    // Session counts by type
    const sessionCounts = db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN type = 'game' THEN 1 ELSE 0 END) as game_sessions,
        SUM(CASE WHEN type = 'practice' THEN 1 ELSE 0 END) as practice_sessions
      FROM sessions WHERE athlete_id = ?
    `).get(athleteId) as { total: number; game_sessions: number; practice_sessions: number };

    // Practice vs game kicks
    const gameKicks = db.prepare(`
      SELECT COUNT(*) as attempts, SUM(CASE WHEN k.result = 'made' THEN 1 ELSE 0 END) as makes
      FROM kicks k JOIN sessions s ON s.id = k.session_id
      WHERE k.athlete_id = ? AND s.type = 'game'
    `).get(athleteId) as { attempts: number; makes: number };

    const practiceKicks = db.prepare(`
      SELECT COUNT(*) as attempts, SUM(CASE WHEN k.result = 'made' THEN 1 ELSE 0 END) as makes
      FROM kicks k JOIN sessions s ON s.id = k.session_id
      WHERE k.athlete_id = ? AND s.type = 'practice'
    `).get(athleteId) as { attempts: number; makes: number };

    return json({
      athlete_name: `${athlete.first_name} ${athlete.last_name}`,
      team_name: athlete.team_name,
      season_attempts: seasonStats.attempts,
      season_makes: seasonStats.makes,
      season_fg_pct: seasonStats.attempts > 0 ? Math.round((seasonStats.makes / seasonStats.attempts) * 100) : 0,
      by_distance: byDistance.map(d => ({
        distance: d.distance,
        attempts: d.attempts,
        makes: d.makes,
        pct: d.attempts > 0 ? Math.round((d.makes / d.attempts) * 100) : 0,
      })),
      by_hash: byHash.map(h => ({
        hash: h.hash,
        attempts: h.attempts,
        makes: h.makes,
        pct: h.attempts > 0 ? Math.round((h.makes / h.attempts) * 100) : 0,
      })),
      miss_breakdown: missBreakdown.map(m => ({
        type: m.miss_type,
        count: m.count,
        pct: totalMisses.count > 0 ? Math.round((m.count / totalMisses.count) * 100) : 0,
      })),
      avg_operation_time_ms: avgOpTime.avg_ms ? Math.round(avgOpTime.avg_ms) : null,
      total_sessions: sessionCounts.total,
      game_kicks: gameKicks.attempts,
      game_makes: gameKicks.makes,
      practice_kicks: practiceKicks.attempts,
      practice_makes: practiceKicks.makes,
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
