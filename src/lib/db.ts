import { Database } from 'bun:sqlite';
import fs from 'fs';
import path from 'path';

const DB_PATH = (() => {
  const base = typeof import.meta.dirname !== 'undefined'
    ? import.meta.dirname
    : process.cwd();
  return path.resolve(base, '../../data/kickiqlucas.db');
})();

let db: Database | null = null;

export function getDb(): Database {
  if (!db) {
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    db = new Database(DB_PATH);
    db.run('PRAGMA journal_mode = WAL');
    db.run('PRAGMA foreign_keys = ON');
  }
  return db;
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}
