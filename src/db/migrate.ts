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
];

for (const migration of migrations) {
  try {
    db.exec(migration);
  } catch {
    // Column likely already exists — ignore
  }
}

console.log('Migration complete.');
db.close();
