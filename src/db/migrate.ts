import { Database } from 'bun:sqlite';
import fs from 'fs';
import path from 'path';

const DB_PATH = path.resolve(import.meta.dirname || '.', '../../data/kickiqlucas.db');

const dir = path.dirname(DB_PATH);
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

const db = new Database(DB_PATH);
db.run('PRAGMA journal_mode = WAL');
db.run('PRAGMA foreign_keys = ON');

const schema = fs.readFileSync(path.resolve(import.meta.dirname || '.', 'schema.sql'), 'utf-8');
db.exec(schema);

// Add columns that may have been added to the schema after initial creation
const migrations = [
  // Add notes column to kicks if it doesn't exist
  `ALTER TABLE kicks ADD COLUMN notes TEXT`,
  // Expand hash values from 3 to 5
  `CREATE TABLE IF NOT EXISTS kicks_new (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    athlete_id TEXT NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
    distance INTEGER NOT NULL,
    hash TEXT NOT NULL CHECK(hash IN ('left_hash', 'left_middle', 'middle', 'right_middle', 'right_hash')),
    result TEXT NOT NULL CHECK(result IN ('made', 'missed', 'blocked')),
    miss_type TEXT CHECK(miss_type IN ('short', 'wide_left', 'wide_right', 'crossbar', 'blocked', NULL)),
    landing_zone TEXT CHECK(landing_zone IN ('goalpost', 'left', 'right', 'short', NULL)),
    operation_time_ms INTEGER,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
];

for (const migration of migrations) {
  try {
    db.exec(migration);
  } catch {
    // Column likely already exists — ignore
  }
}

// Migrate hash values from old 3-value system to new 5-value system
const kicksNewExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='kicks_new'").get() as { name: string } | undefined;
if (kicksNewExists) {
  const oldHashCount = db.prepare("SELECT COUNT(*) as c FROM kicks WHERE hash IN ('left', 'center', 'right')").get() as { c: number };
  if (oldHashCount.c > 0) {
    // Copy data from kicks to kicks_new, remapping hash values
    db.exec(`
      INSERT INTO kicks_new (id, session_id, athlete_id, distance, hash, result, miss_type, landing_zone, operation_time_ms, notes, created_at)
      SELECT id, session_id, athlete_id, distance,
        CASE hash
          WHEN 'left' THEN 'left_hash'
          WHEN 'center' THEN 'middle'
          WHEN 'right' THEN 'right_hash'
          ELSE hash
        END,
        result, miss_type, landing_zone, operation_time_ms, notes, created_at
      FROM kicks
    `);
    db.exec('DROP TABLE kicks');
    db.exec('ALTER TABLE kicks_new RENAME TO kicks');
    // Recreate indexes
    db.exec('CREATE INDEX IF NOT EXISTS idx_kicks_session ON kicks(session_id)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_kicks_athlete ON kicks(athlete_id)');
    console.log('Migrated hash values: left→left_hash, center→middle, right→right_hash');
  } else {
    // kicks_new table exists but no data to migrate — drop it, schema.sql already created the correct table
    db.exec('DROP TABLE kicks_new');
  }
}

console.log('Migration complete.');
db.close();
