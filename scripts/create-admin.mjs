import Database from 'better-sqlite3';
import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const envPath = path.join(__dirname, '..', '.env.local');
const envContent = readFileSync(envPath, 'utf8');
const secretMatch = envContent.match(/AUTH_SECRET="([^"]+)"/);
const AUTH_SECRET = secretMatch?.[1] ?? '';

const dbPath = path.join(__dirname, '..', 'data', 'ani.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

const [,, username = 'admin', password = 'changeme'] = process.argv;

const hash = createHash('sha256').update(password + AUTH_SECRET).digest('hex');

try {
  db.prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)').run(username, hash, 'admin');
  console.log(`✓ Admin izveidots: "${username}" / "${password}"`);
  console.log('  Nomainiet paroli pēc pirmās ielogošanās!');
} catch {
  console.log(`✗ Lietotājs "${username}" jau eksistē.`);
}
