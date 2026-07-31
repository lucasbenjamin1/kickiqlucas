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

console.log('Migration complete.');
db.close();
