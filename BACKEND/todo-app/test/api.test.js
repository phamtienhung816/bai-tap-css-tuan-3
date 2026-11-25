'use strict';
// Chạy với database tạm để không đụng dữ liệu thật.
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'todo-test-'));
process.env.DB_PATH = path.join(tmp, 'test.db');

const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { db } = require('../src/db');
const { seed } = require('../src/seed');
const routes = require('../src/routes');
const { toDateStr } = require('../src/utils');

let server, base;
test.before(async () => {
  seed({ reset: true });
  const app = express();
  app.use(express.json());
  app.use('/api', routes);
  await new Promise((r) => { server = app.listen(0, r); });
  base = `http://localhost:${server.address().port}/api`;
});
test.after(() => { server.close(); db.close(); fs.rmSync(tmp, { recursive: true, force: true }); });

const call = async (p, opts = {}) => {
  const res = await fetch(base + p, { headers: { 'Content-Type': 'application/json' }, ...opts, body: opts.body ? JSON.stringify(opts.body) : undefined });
  return { status: res.status, body: res.status === 204 ? null : await res.json() };
};

test('seed tạo dữ liệu mock và task cho hôm nay', async () => {
  const { body } = await call('/tasks?scope=today');
  assert.ok(body.count >= 5);
  assert.ok(body.tasks.every((t) => t.due_date === toDateStr()));
});

test('tìm kiếm không phân biệt dấu', async () => {
  const withAccent = await call('/tasks?q=' + encodeURIComponent('Họp'));
  const noAccent = await call('/tasks?q=hop');
  assert.ok(noAccent.body.count > 0);
  assert.equal(withAccent.body.count, noAccent.body.count);
});

test('CRUD + trigger completed_at', async () => {
  const created = await call('/tasks', { method: 'POST', body: { title: 'Task thử', due_date: toDateStr(), priority: 'high' } });
  assert.equal(created.status, 201);
  const id = created.body.id;
  assert.equal(created.body.completed_at, null);

  const done = await call(`/tasks/${id}/status`, { method: 'PATCH', body: { status: 'done' } });
  assert.ok(done.body.completed_at, 'trigger phải điền completed_at');

  const reopened = await call(`/tasks/${id}/status`, { method: 'PATCH', body: { status: 'todo' } });
  assert.equal(reopened.body.completed_at, null, 'mở lại phải xóa completed_at');

  const upd = await call(`/tasks/${id}`, { method: 'PUT', body: { title: 'Đã sửa' } });
  assert.equal(upd.body.title, 'Đã sửa');

  assert.equal((await call(`/tasks/${id}`, { method: 'DELETE' })).status, 204);
  assert.equal((await call(`/tasks/${id}`)).status, 404);

  const log = db.prepare('SELECT action FROM task_activity WHERE task_id = ? ORDER BY id').all(id).map((r) => r.action);
  assert.deepEqual(log, ['created', 'status_changed', 'status_changed', 'deleted']);
});

test('validate: giờ kết thúc trước giờ bắt đầu, tiêu đề rỗng, ngày sai', async () => {
  const r = await call('/tasks', { method: 'POST', body: { title: ' ', due_date: '2026-02-31', start_time: '10:00', end_time: '09:00' } });
  assert.equal(r.status, 400);
  assert.ok(r.body.fields.title && r.body.fields.due_date && r.body.fields.end_time);
});

test('database tự chặn dữ liệu sai dù ghi trực tiếp', () => {
  assert.throws(() => db.prepare("INSERT INTO tasks (title, due_date, priority) VALUES ('x', '2026-01-01', 'urgent')").run(), /CHECK/);
  assert.throws(() => db.prepare("INSERT INTO tasks (title, due_date, category_id) VALUES ('x', '2026-01-01', 9999)").run(), /FOREIGN KEY/);
});

test('xóa danh mục thì task giữ lại và category_id về NULL', () => {
  const cid = Number(db.prepare("INSERT INTO categories (name) VALUES ('Tạm')").run().lastInsertRowid);
  const tid = Number(db.prepare('INSERT INTO tasks (title, due_date, category_id) VALUES (?, ?, ?)').run('t', toDateStr(), cid).lastInsertRowid);
  db.prepare('DELETE FROM categories WHERE id = ?').run(cid);
  assert.equal(db.prepare('SELECT category_id FROM tasks WHERE id = ?').get(tid).category_id, null);
});

test('thống kê trả đủ dữ liệu', async () => {
  const { body } = await call('/stats?days=14');
  assert.equal(body.daily.length, 14);
  assert.ok(body.overview.total > 100);
  assert.ok(body.by_category.length >= 5);
  assert.equal(body.by_weekday.length, 7);
});
