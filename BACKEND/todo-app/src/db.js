'use strict';
/**
 * Kết nối SQLite (module built-in `node:sqlite`, không cần cài thư viện native).
 * Schema nằm ở db/schema.sql và được áp dụng tự động mỗi lần khởi động
 * (mọi câu lệnh đều là IF NOT EXISTS nên chạy lại an toàn).
 */
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const ROOT = path.join(__dirname, '..');
const DB_PATH = process.env.DB_PATH || path.join(ROOT, 'data', 'todo.db');

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');
db.exec(fs.readFileSync(path.join(ROOT, 'db', 'schema.sql'), 'utf8'));

/** Chạy fn trong một transaction; lỗi thì rollback. */
function transaction(fn) {
  db.exec('BEGIN');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

module.exports = { db, transaction, DB_PATH };
