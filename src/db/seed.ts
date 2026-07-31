import { Database } from 'bun:sqlite';
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

const DB_PATH = path.resolve(import.meta.dirname || '.', '../../data/kickiqlucas.db');

const dir = path.dirname(DB_PATH);
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

const db = new Database(DB_PATH);
db.run('PRAGMA journal_mode = WAL');
db.run('PRAGMA foreign_keys = ON');

// Create schema if not exists
const schema = fs.readFileSync(path.resolve(import.meta.dirname || '.', 'schema.sql'), 'utf-8');
db.exec(schema);

// Seed demo data
const teamId = randomUUID();
const athleteId = randomUUID();
const sessionId = randomUUID();

db.exec('DELETE FROM kicks');
db.exec('DELETE FROM sessions');
db.exec('DELETE FROM athletes');
db.exec('DELETE FROM users');
db.exec('DELETE FROM teams');

const insertTeam = db.prepare('INSERT INTO teams (id, name) VALUES (?, ?)');
const insertAthlete = db.prepare('INSERT INTO athletes (id, team_id, first_name, last_name, number) VALUES (?, ?, ?, ?, ?)');
const insertSession = db.prepare('INSERT INTO sessions (id, team_id, athlete_id, type, notes, started_at, ended_at) VALUES (?, ?, ?, ?, ?, ?, ?)');
const insertKick = db.prepare('INSERT INTO kicks (id, session_id, athlete_id, distance, hash, result, miss_type, landing_zone, operation_time_ms) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');

insertTeam.run(teamId, 'Demo University');

insertAthlete.run(athleteId, teamId, 'Demo', 'Kicker', '99');

insertSession.run(sessionId, teamId, athleteId, 'practice', 'Demo practice session', '2026-07-30T14:00:00Z', '2026-07-30T14:45:00Z');

// Generate 100+ practice kicks
const hashes = ['left', 'center', 'right'] as const;
const distances = [20, 25, 30, 35, 40, 45, 50, 55];

for (let i = 0; i < 110; i++) {
  const distance = distances[Math.floor(Math.random() * distances.length)];
  const hash = hashes[Math.floor(Math.random() * hashes.length)];

  // Higher distance = lower make probability
  const makeProb = Math.max(0.3, 1 - (distance - 20) / 50);
  const made = Math.random() < makeProb;

  const result = made ? 'made' : 'missed';
  const missType = made ? null : (['short', 'wide_left', 'wide_right'] as const)[Math.floor(Math.random() * 3)];
  const landingZone = made ? 'goalpost' : (['left', 'right', 'short'] as const)[Math.floor(Math.random() * 3)];
  const operationTime = 1100 + Math.floor(Math.random() * 400);

  insertKick.run(randomUUID(), sessionId, athleteId, distance, hash, result, missType, landingZone, operationTime);
}

// Add game kicks
const gameSessionId = randomUUID();
insertSession.run(gameSessionId, teamId, athleteId, 'game', 'Demo game vs Rival State', '2026-07-24T18:00:00Z', '2026-07-24T21:00:00Z');

const gameKicks = [
  { dist: 25, hash: 'center', result: 'made', miss: null, lz: 'goalpost', ot: 1150 },
  { dist: 35, hash: 'right', result: 'made', miss: null, lz: 'goalpost', ot: 1220 },
  { dist: 42, hash: 'left', result: 'made', miss: null, lz: 'goalpost', ot: 1280 },
  { dist: 47, hash: 'center', result: 'missed', miss: 'wide_right', lz: 'right', ot: 1310 },
  { dist: 38, hash: 'right', result: 'made', miss: null, lz: 'goalpost', ot: 1190 },
  { dist: 30, hash: 'left', result: 'made', miss: null, lz: 'goalpost', ot: 1120 },
  { dist: 52, hash: 'center', result: 'missed', miss: 'short', lz: 'short', ot: 1350 },
  { dist: 22, hash: 'center', result: 'made', miss: null, lz: 'goalpost', ot: 1080 },
  { dist: 44, hash: 'left', result: 'made', miss: null, lz: 'goalpost', ot: 1260 },
  { dist: 33, hash: 'right', result: 'made', miss: null, lz: 'goalpost', ot: 1170 },
  { dist: 49, hash: 'center', result: 'made', miss: null, lz: 'goalpost', ot: 1320 },
  { dist: 28, hash: 'left', result: 'made', miss: null, lz: 'goalpost', ot: 1100 },
  { dist: 55, hash: 'right', result: 'missed', miss: 'wide_left', lz: 'left', ot: 1380 },
  { dist: 40, hash: 'center', result: 'made', miss: null, lz: 'goalpost', ot: 1240 },
  { dist: 36, hash: 'left', result: 'made', miss: null, lz: 'goalpost', ot: 1160 },
];

for (const k of gameKicks) {
  insertKick.run(randomUUID(), gameSessionId, athleteId, k.dist, k.hash, k.result, k.miss, k.lz, k.ot);
}

console.log(`Seed complete: ${110 + gameKicks.length} kicks for "${teamId}"`);

// Seed demo user: coach@kickiq.com / password123
const demoPasswordHash = Bun.password.hashSync('password123', { algorithm: 'bcrypt', cost: 10 });
db.prepare('INSERT INTO users (id, email, password_hash, name, role, team_id) VALUES (?, ?, ?, ?, ?, ?)')
  .run(randomUUID(), 'coach@kickiq.com', demoPasswordHash, 'Demo Coach', 'coach', teamId);
console.log('Demo user seeded: coach@kickiq.com / password123');

db.close();
