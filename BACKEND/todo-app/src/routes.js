'use strict';
const express = require('express');
const { db } = require('./db');
const { toDateStr, addDays, normalize } = require('./utils');

const router = express.Router();

const PRIORITIES = ['low', 'medium', 'high'];
const STATUSES = ['todo', 'in_progress', 'done'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

class HttpError extends Error {
  constructor(status, message, fields) { super(message); this.status = status; this.fields = fields; }
}
const wrap = (fn) => (req, res, next) => { try { fn(req, res); } catch (e) { next(e); } };

function isValidDate(s) {
  if (!DATE_RE.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

/** Validate + chuẩn hóa dữ liệu task (dùng chung cho POST / PUT). */
function parseTask(body, { partial = false } = {}) {
  const errors = {};
  const out = {};
  const has = (k) => body[k] !== undefined;

  if (!partial || has('title')) {
    const title = String(body.title ?? '').trim();
    if (!title) errors.title = 'Tiêu đề không được để trống';
    else if (title.length > 200) errors.title = 'Tiêu đề tối đa 200 ký tự';
    out.title = title;
  }
  if (!partial || has('description')) {
    const d = String(body.description ?? '').trim();
    if (d.length > 2000) errors.description = 'Mô tả tối đa 2000 ký tự';
    out.description = d;
  }
  if (!partial || has('due_date')) {
    if (!isValidDate(String(body.due_date ?? ''))) errors.due_date = 'Ngày không hợp lệ (YYYY-MM-DD)';
    out.due_date = body.due_date;
  }
  for (const k of ['start_time', 'end_time']) {
    if (!partial || has(k)) {
      const v = body[k] === '' ? null : body[k] ?? null;
      if (v !== null && !TIME_RE.test(v)) errors[k] = 'Giờ không hợp lệ (HH:MM)';
      out[k] = v;
    }
  }
  if (out.start_time && out.end_time && out.end_time <= out.start_time) {
    errors.end_time = 'Giờ kết thúc phải sau giờ bắt đầu';
  }
  if (!partial || has('estimate_min')) {
    const raw = body.estimate_min;
    if (raw === undefined || raw === null || raw === '') out.estimate_min = null;
    else {
      const n = Number(raw);
      if (!Number.isInteger(n) || n < 1 || n > 1440) errors.estimate_min = 'Thời gian ước tính từ 1 đến 1440 phút';
      out.estimate_min = n;
    }
  }
  if (!partial || has('priority')) {
    out.priority = body.priority ?? 'medium';
    if (!PRIORITIES.includes(out.priority)) errors.priority = 'Độ ưu tiên không hợp lệ';
  }
  if (!partial || has('status')) {
    out.status = body.status ?? 'todo';
    if (!STATUSES.includes(out.status)) errors.status = 'Trạng thái không hợp lệ';
  }
  if (!partial || has('category_id')) {
    const raw = body.category_id;
    if (raw === undefined || raw === null || raw === '') out.category_id = null;
    else {
      const id = Number(raw);
      if (!Number.isInteger(id) || !db.prepare('SELECT 1 FROM categories WHERE id = ?').get(id)) {
        errors.category_id = 'Danh mục không tồn tại';
      }
      out.category_id = id;
    }
  }

  if (Object.keys(errors).length) throw new HttpError(400, 'Dữ liệu không hợp lệ', errors);
  return out;
}

const getTask = (id) => db.prepare('SELECT * FROM v_tasks WHERE id = ?').get(id);
const stripInternal = ({ search_text, priority_rank, ...rest }) => rest;

/* ======================================================================
 *  TASKS
 * ==================================================================== */

/**
 * GET /api/tasks
 *   scope    : today | overdue | upcoming | all | date (cùng ?date=YYYY-MM-DD)
 *   q        : tìm theo tiêu đề / mô tả (không phân biệt dấu)
 *   status, priority, category_id : lọc
 *   sort     : time (mặc định) | priority | created | due
 */
router.get('/tasks', wrap((req, res) => {
  const { scope = 'all', q, status, priority, category_id, sort = 'time', date } = req.query;
  const today = toDateStr();
  const where = [];
  const params = [];

  switch (scope) {
    case 'today': where.push('due_date = ?'); params.push(today); break;
    case 'date':
      if (!isValidDate(String(date))) throw new HttpError(400, 'Ngày không hợp lệ');
      where.push('due_date = ?'); params.push(date); break;
    case 'overdue': where.push("status <> 'done' AND due_date < ?"); params.push(today); break;
    case 'upcoming': where.push('due_date > ?'); params.push(today); break;
    case 'all': break;
    default: throw new HttpError(400, 'scope không hợp lệ');
  }
  if (q && String(q).trim()) { where.push('search_text LIKE ?'); params.push(`%${normalize(q)}%`); }
  if (status) {
    if (!STATUSES.includes(status)) throw new HttpError(400, 'status không hợp lệ');
    where.push('status = ?'); params.push(status);
  }
  if (priority) {
    if (!PRIORITIES.includes(priority)) throw new HttpError(400, 'priority không hợp lệ');
    where.push('priority = ?'); params.push(priority);
  }
  if (category_id === 'none') where.push('category_id IS NULL');
  else if (category_id) { where.push('category_id = ?'); params.push(Number(category_id)); }

  const orderBy = {
    time: "(status = 'done'), due_date, (start_time IS NULL), start_time, priority_rank, id",
    priority: "(status = 'done'), priority_rank, due_date, start_time, id",
    created: 'created_at DESC, id DESC',
    due: "due_date DESC, (status = 'done'), start_time, id",
  }[sort] || 'due_date, id';

  const sql = `SELECT * FROM v_tasks ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY ${orderBy} LIMIT 500`;
  const rows = db.prepare(sql).all(...params).map(stripInternal);
  res.json({ today, count: rows.length, tasks: rows });
}));

router.get('/tasks/:id', wrap((req, res) => {
  const t = getTask(Number(req.params.id));
  if (!t) throw new HttpError(404, 'Không tìm thấy task');
  res.json(stripInternal(t));
}));

router.post('/tasks', wrap((req, res) => {
  const t = parseTask(req.body || {});
  const info = db.prepare(`
    INSERT INTO tasks (title, description, due_date, start_time, end_time, estimate_min,
                       priority, status, category_id, search_text)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    t.title, t.description, t.due_date, t.start_time, t.end_time, t.estimate_min,
    t.priority, t.status, t.category_id, normalize(`${t.title} ${t.description}`),
  );
  res.status(201).json(stripInternal(getTask(Number(info.lastInsertRowid))));
}));

router.put('/tasks/:id', wrap((req, res) => {
  const id = Number(req.params.id);
  const cur = getTask(id);
  if (!cur) throw new HttpError(404, 'Không tìm thấy task');
  const t = parseTask({ ...cur, ...(req.body || {}) });
  db.prepare(`
    UPDATE tasks SET title = ?, description = ?, due_date = ?, start_time = ?, end_time = ?,
                     estimate_min = ?, priority = ?, status = ?, category_id = ?, search_text = ?,
                     completed_at = CASE WHEN ? = 'done' THEN COALESCE(completed_at, datetime('now','localtime')) ELSE NULL END
    WHERE id = ?`).run(
    t.title, t.description, t.due_date, t.start_time, t.end_time, t.estimate_min,
    t.priority, t.status, t.category_id, normalize(`${t.title} ${t.description}`), t.status, id,
  );
  res.json(stripInternal(getTask(id)));
}));

/** Đổi nhanh trạng thái (tick checkbox). */
router.patch('/tasks/:id/status', wrap((req, res) => {
  const id = Number(req.params.id);
  const status = req.body?.status;
  if (!STATUSES.includes(status)) throw new HttpError(400, 'Trạng thái không hợp lệ');
  if (!getTask(id)) throw new HttpError(404, 'Không tìm thấy task');
  // completed_at được set/clear bởi trigger trg_tasks_mark_done / trg_tasks_reopen
  db.prepare('UPDATE tasks SET status = ? WHERE id = ?').run(status, id);
  res.json(stripInternal(getTask(id)));
}));

router.delete('/tasks/:id', wrap((req, res) => {
  const info = db.prepare('DELETE FROM tasks WHERE id = ?').run(Number(req.params.id));
  if (!info.changes) throw new HttpError(404, 'Không tìm thấy task');
  res.status(204).end();
}));

/* ======================================================================
 *  CATEGORIES
 * ==================================================================== */
router.get('/categories', wrap((req, res) => {
  res.json(db.prepare('SELECT * FROM v_category_summary ORDER BY id').all());
}));

router.post('/categories', wrap((req, res) => {
  const name = String(req.body?.name ?? '').trim();
  const color = req.body?.color || '#6366f1';
  const icon = req.body?.icon || '📌';
  const errors = {};
  if (!name || name.length > 40) errors.name = 'Tên danh mục 1–40 ký tự';
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) errors.color = 'Màu phải dạng #RRGGBB';
  if (Object.keys(errors).length) throw new HttpError(400, 'Dữ liệu không hợp lệ', errors);
  try {
    const info = db.prepare('INSERT INTO categories (name, color, icon) VALUES (?, ?, ?)').run(name, color, icon);
    res.status(201).json(db.prepare('SELECT * FROM categories WHERE id = ?').get(Number(info.lastInsertRowid)));
  } catch (e) {
    if (/UNIQUE/i.test(e.message)) throw new HttpError(409, 'Danh mục đã tồn tại', { name: 'Tên đã được dùng' });
    throw e;
  }
}));

/* ======================================================================
 *  STATS
 * ==================================================================== */
router.get('/stats', wrap((req, res) => {
  const days = Math.min(Math.max(Number(req.query.days) || 14, 7), 90);
  const today = toDateStr();
  const from = addDays(today, -(days - 1));

  const overview = db.prepare(`
    SELECT COUNT(*)                                       AS total,
           COALESCE(SUM(status = 'done'), 0)              AS done,
           COALESCE(SUM(status = 'in_progress'), 0)       AS in_progress,
           COALESCE(SUM(status = 'todo'), 0)              AS todo,
           COALESCE(SUM(status <> 'done' AND due_date < ?), 0) AS overdue,
           COALESCE(SUM(due_date = ?), 0)                 AS today_total,
           COALESCE(SUM(due_date = ? AND status = 'done'), 0) AS today_done,
           COALESCE(SUM(CASE WHEN status = 'done' THEN estimate_min END), 0) AS done_minutes
    FROM tasks`).get(today, today, today);
  overview.completion_rate = overview.total ? Math.round((overview.done / overview.total) * 100) : 0;

  // Xu hướng: số task tạo ra hạn trong ngày vs số task hoàn thành trong ngày
  const dueMap = new Map(db.prepare(
    'SELECT day, total, done FROM v_daily_summary WHERE day BETWEEN ? AND ?').all(from, today).map((r) => [r.day, r]));
  const doneMap = new Map(db.prepare(`
    SELECT date(completed_at) AS day, COUNT(*) AS n FROM tasks
    WHERE completed_at IS NOT NULL AND date(completed_at) BETWEEN ? AND ? GROUP BY day`).all(from, today).map((r) => [r.day, r.n]));
  const daily = [];
  for (let i = 0; i < days; i++) {
    const day = addDays(from, i);
    daily.push({ day, due: dueMap.get(day)?.total ?? 0, completed: doneMap.get(day) ?? 0 });
  }

  const by_category = db.prepare('SELECT name, color, icon, total, done FROM v_category_summary WHERE total > 0 ORDER BY total DESC').all();
  const noCat = db.prepare("SELECT COUNT(*) AS total, COALESCE(SUM(status='done'),0) AS done FROM tasks WHERE category_id IS NULL").get();
  if (noCat.total) by_category.push({ name: 'Không danh mục', color: '#94a3b8', icon: '📁', ...noCat });

  const by_priority = db.prepare(`
    SELECT priority, COUNT(*) AS total, SUM(status = 'done') AS done FROM tasks
    GROUP BY priority ORDER BY CASE priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END`).all();

  // Năng suất theo thứ trong tuần (dựa trên ngày hoàn thành)
  const dowRows = db.prepare(`
    SELECT CAST(strftime('%w', completed_at) AS INTEGER) AS dow, COUNT(*) AS n
    FROM tasks WHERE completed_at IS NOT NULL GROUP BY dow`).all();
  const by_weekday = [1, 2, 3, 4, 5, 6, 0].map((d) => ({ dow: d, n: dowRows.find((r) => r.dow === d)?.n ?? 0 }));

  // Streak: số ngày liên tiếp (tính đến hôm nay hoặc hôm qua) có ít nhất 1 task hoàn thành
  const doneDays = new Set(db.prepare(
    'SELECT DISTINCT date(completed_at) AS d FROM tasks WHERE completed_at IS NOT NULL').all().map((r) => r.d));
  let streak = 0;
  let cursor = doneDays.has(today) ? today : addDays(today, -1);
  while (doneDays.has(cursor)) { streak++; cursor = addDays(cursor, -1); }

  const recent_activity = db.prepare(
    'SELECT * FROM task_activity ORDER BY created_at DESC, id DESC LIMIT 8').all();

  res.json({ today, days, overview, daily, by_category, by_priority, by_weekday, streak, recent_activity });
}));

/* ======================================================================
 *  Lỗi
 * ==================================================================== */
router.use((req, res) => res.status(404).json({ error: 'Không tìm thấy API' }));
// eslint-disable-next-line no-unused-vars
router.use((err, req, res, next) => {
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message, fields: err.fields });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON không hợp lệ' });
  console.error(err);
  res.status(500).json({ error: 'Lỗi máy chủ' });
});

module.exports = router;
