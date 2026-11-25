/* =====================================================================
   TaskFlow - frontend (vanilla JS, hash-router, không cần build)
   ===================================================================== */
'use strict';

/* ---------- Helpers ---------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = (n) => String(n).padStart(2, '0');
const toDateStr = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseDate = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (s, n) => { const d = parseDate(s); d.setDate(d.getDate() + n); return toDateStr(d); };
const debounce = (fn, ms = 250) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

const WEEKDAYS = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];
const PRIORITY = { high: 'Cao', medium: 'Trung bình', low: 'Thấp' };
const STATUS = { todo: 'Cần làm', in_progress: 'Đang làm', done: 'Hoàn thành' };

function fmtLongDate(s) {
  const d = parseDate(s);
  return `${WEEKDAYS[d.getDay()]}, ${d.getDate()} tháng ${d.getMonth() + 1}, ${d.getFullYear()}`;
}
function fmtGroupDate(s, today) {
  if (s === today) return 'Hôm nay';
  if (s === addDays(today, 1)) return 'Ngày mai';
  if (s === addDays(today, -1)) return 'Hôm qua';
  const d = parseDate(s);
  return `${WEEKDAYS[d.getDay()]}, ${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}
function fmtMinutes(m) {
  if (!m) return '';
  const h = Math.floor(m / 60), r = m % 60;
  return h ? (r ? `${h}g ${r}p` : `${h} giờ`) : `${r} phút`;
}
function fmtAgo(ts) {
  const t = new Date(ts.replace(' ', 'T'));
  const mins = Math.round((Date.now() - t.getTime()) / 60000);
  if (mins < 1) return 'vừa xong';
  if (mins < 60) return `${mins} phút trước`;
  if (mins < 1440) return `${Math.floor(mins / 60)} giờ trước`;
  const days = Math.floor(mins / 1440);
  return days === 1 ? 'hôm qua' : `${days} ngày trước`;
}

async function api(path, opts = {}) {
  const res = await fetch('/api' + path, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) { const e = new Error(data.error || 'Có lỗi xảy ra'); e.fields = data.fields; throw e; }
  return data;
}

function toast(msg, type = 'ok') {
  const el = document.createElement('div');
  el.className = 'toast' + (type === 'error' ? ' error' : '');
  el.innerHTML = `<span>${type === 'error' ? '⚠️' : '✅'}</span>${esc(msg)}`;
  $('#toasts').append(el);
  setTimeout(() => el.remove(), 3200);
}

/* ---------- State ---------- */
const state = {
  categories: [],
  today: toDateStr(),
  filters: {
    today: { q: '', status: '', priority: '', category_id: '', sort: 'time' },
    all: { q: '', status: '', priority: '', category_id: '', sort: 'time', scope: 'all', date: '' },
  },
  statsDays: 14,
  charts: [],
};

/* ---------- Task card ---------- */
function taskCard(t) {
  const time = t.start_time ? `${t.start_time}${t.end_time ? ' – ' + t.end_time : ''}` : '';
  return `
  <article class="task ${t.status}" style="--cat:${esc(t.category_color || '#94a3b8')}" data-id="${t.id}">
    <button class="check" data-act="toggle" title="${t.status === 'done' ? 'Mở lại' : 'Đánh dấu hoàn thành'}">${t.status === 'in_progress' ? '▶' : '✓'}</button>
    <div>
      <div class="task-title">${esc(t.title)}</div>
      ${t.description ? `<div class="task-desc" title="${esc(t.description)}">${esc(t.description)}</div>` : ''}
      <div class="meta">
        ${t.is_overdue ? '<span class="tag overdue">⏰ Quá hạn</span>' : ''}
        ${time ? `<span class="tag">🕒 ${time}</span>` : ''}
        ${t.estimate_min ? `<span class="tag">⏳ ${fmtMinutes(t.estimate_min)}</span>` : ''}
        ${t.category_name ? `<span class="tag cat" style="--cat:${esc(t.category_color)}">${esc(t.category_icon)} ${esc(t.category_name)}</span>` : ''}
        <span class="tag p-${t.priority}">${t.priority === 'high' ? '🔺' : t.priority === 'medium' ? '🔸' : '🔹'} ${PRIORITY[t.priority]}</span>
        ${t.status === 'in_progress' ? '<span class="tag s-in_progress">Đang làm</span>' : ''}
      </div>
    </div>
    <div class="task-actions">
      ${t.status === 'todo' ? '<button class="icon-btn" data-act="start" title="Bắt đầu làm">▶️</button>' : ''}
      <button class="icon-btn" data-act="edit" title="Sửa">✏️</button>
      <button class="icon-btn danger" data-act="delete" title="Xóa">🗑️</button>
    </div>
  </article>`;
}

function emptyState(filtered) {
  return filtered
    ? `<div class="empty card"><div class="big">🔎</div><b>Không tìm thấy task phù hợp</b>Thử đổi từ khóa hoặc bỏ bớt bộ lọc.</div>`
    : `<div class="empty card"><div class="big">🎉</div><b>Chưa có task nào</b>Nhấn “Thêm task” để bắt đầu một ngày hiệu quả.</div>`;
}

/* ---------- Toolbar (search + filter) ---------- */
function toolbarHTML(f) {
  const chip = (v, label) => `<button class="chip ${f.status === v ? 'active' : ''}" data-status="${v}">${label}</button>`;
  const catOpts = state.categories.map((c) => `<option value="${c.id}" ${String(f.category_id) === String(c.id) ? 'selected' : ''}>${esc(c.icon)} ${esc(c.name)}</option>`).join('');
  return `
  <div class="toolbar">
    <div class="search"><input id="q" type="search" placeholder="Tìm theo tiêu đề, mô tả… (gõ không dấu cũng được)" value="${esc(f.q)}"></div>
    <select class="select" id="fPriority" aria-label="Lọc độ ưu tiên">
      <option value="">Mọi ưu tiên</option>
      ${['high', 'medium', 'low'].map((p) => `<option value="${p}" ${f.priority === p ? 'selected' : ''}>Ưu tiên ${PRIORITY[p].toLowerCase()}</option>`).join('')}
    </select>
    <select class="select" id="fCategory" aria-label="Lọc danh mục">
      <option value="">Mọi danh mục</option>${catOpts}
    </select>
    <select class="select" id="fSort" aria-label="Sắp xếp">
      <option value="time" ${f.sort === 'time' ? 'selected' : ''}>Sắp xếp: Giờ</option>
      <option value="priority" ${f.sort === 'priority' ? 'selected' : ''}>Sắp xếp: Ưu tiên</option>
      <option value="created" ${f.sort === 'created' ? 'selected' : ''}>Sắp xếp: Mới tạo</option>
    </select>
  </div>
  <div class="chips" style="margin-bottom:16px">
    ${chip('', 'Tất cả')}${chip('todo', 'Cần làm')}${chip('in_progress', 'Đang làm')}${chip('done', 'Hoàn thành')}
  </div>`;
}

function bindToolbar(key, reload) {
  const f = state.filters[key];
  $('#q').addEventListener('input', debounce((e) => { f.q = e.target.value; reload(); }));
  $('#fPriority').addEventListener('change', (e) => { f.priority = e.target.value; reload(); });
  $('#fCategory').addEventListener('change', (e) => { f.category_id = e.target.value; reload(); });
  $('#fSort').addEventListener('change', (e) => { f.sort = e.target.value; reload(); });
  $$('.chip[data-status]').forEach((b) => b.addEventListener('click', () => {
    f.status = b.dataset.status;
    $$('.chip[data-status]').forEach((x) => x.classList.toggle('active', x === b));
    reload();
  }));
}

function queryString(f, extra = {}) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...f, ...extra })) if (v) p.set(k, v);
  return p.toString();
}

const isFiltered = (f) => !!(f.q || f.status || f.priority || f.category_id);

/* ---------- View: Hôm nay ---------- */
async function renderToday() {
  const f = state.filters.today;
  const view = $('#view');
  view.innerHTML = `
    <div class="page-head">
      <div><h1>Hôm nay</h1><p>${fmtLongDate(state.today)}</p></div>
      <button class="btn btn-primary" data-new>＋ Thêm task</button>
    </div>
    <div id="heroSlot"></div>
    <div id="alertSlot"></div>
    ${toolbarHTML(f)}
    <div class="tasks" id="list"><div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div></div>`;
  bindToolbar('today', loadToday);
  $('[data-new]').onclick = () => openTaskDialog({ due_date: state.today });
  await loadToday();
}

async function loadToday() {
  const f = state.filters.today;
  const [list, overall, overdue] = await Promise.all([
    api('/tasks?' + queryString(f, { scope: 'today' })),
    api('/tasks?scope=today'),                       // không filter -> để tính tiến độ cả ngày
    api('/tasks?scope=overdue&sort=due'),
  ]);

  const all = overall.tasks;
  const done = all.filter((t) => t.status === 'done').length;
  const doing = all.filter((t) => t.status === 'in_progress').length;
  const pct = all.length ? Math.round((done / all.length) * 100) : 0;
  const minutes = all.reduce((s, t) => s + (t.estimate_min || 0), 0);
  const hour = new Date().getHours();
  const greet = hour < 11 ? 'Chào buổi sáng' : hour < 14 ? 'Chào buổi trưa' : hour < 18 ? 'Chào buổi chiều' : 'Chào buổi tối';
  $('#heroSlot').innerHTML = `
    <section class="card hero">
      <div class="ring" style="--p:${pct}"><span>${pct}%</span></div>
      <div style="position:relative;z-index:1">
        <h2>${greet}! 👋</h2>
        <p>${all.length === 0 ? 'Hôm nay chưa có task nào. Hãy lên kế hoạch cho ngày mới.' : pct === 100 ? 'Tuyệt vời, bạn đã hoàn thành mọi task hôm nay! 🎉' : `Bạn còn ${all.length - done} task cần hoàn thành hôm nay.`}</p>
        <div class="hero-stats">
          <div><b>${all.length}</b>Tổng task</div>
          <div><b>${done}</b>Hoàn thành</div>
          <div><b>${doing}</b>Đang làm</div>
          <div><b>${fmtMinutes(minutes) || '0 phút'}</b>Dự kiến</div>
        </div>
      </div>
    </section>`;

  $('#alertSlot').innerHTML = overdue.count
    ? `<div class="alert">⏰ <span>Bạn có <b>${overdue.count}</b> task quá hạn chưa hoàn thành.</span><button data-overdue>Xem ngay</button></div>` : '';
  const ob = $('[data-overdue]');
  if (ob) ob.onclick = () => { state.filters.all.scope = 'overdue'; location.hash = '#/all'; };

  updateSidebarProgress(done, all.length);
  $('#navTodayCount').textContent = all.length - done;

  $('#list').innerHTML = list.tasks.length
    ? list.tasks.map(taskCard).join('')
    : emptyState(isFiltered(f));
}

/* ---------- View: Tất cả task ---------- */
async function renderAll() {
  const f = state.filters.all;
  const tabs = [['all', 'Tất cả'], ['overdue', 'Quá hạn'], ['upcoming', 'Sắp tới'], ['date', 'Chọn ngày']];
  $('#view').innerHTML = `
    <div class="page-head">
      <div><h1>Tất cả task</h1><p>Tìm kiếm và quản lý toàn bộ công việc của bạn</p></div>
      <button class="btn btn-primary" data-new>＋ Thêm task</button>
    </div>
    <div style="display:flex;gap:12px;align-items:flex-start;flex-wrap:wrap">
      <div class="tabs" id="scopeTabs">${tabs.map(([v, l]) => `<button class="tab ${f.scope === v ? 'active' : ''}" data-scope="${v}">${l}</button>`).join('')}</div>
      <input type="date" class="select" id="datePick" value="${esc(f.date || state.today)}" style="${f.scope === 'date' ? '' : 'display:none'}">
    </div>
    ${toolbarHTML(f)}
    <div id="list"><div class="skeleton"></div></div>`;
  bindToolbar('all', loadAll);
  $('[data-new]').onclick = () => openTaskDialog({ due_date: state.today });
  $$('#scopeTabs .tab').forEach((b) => b.addEventListener('click', () => {
    f.scope = b.dataset.scope;
    if (f.scope === 'date') f.date = $('#datePick').value || state.today;
    $$('#scopeTabs .tab').forEach((x) => x.classList.toggle('active', x === b));
    $('#datePick').style.display = f.scope === 'date' ? '' : 'none';
    loadAll();
  }));
  $('#datePick').addEventListener('change', (e) => { f.date = e.target.value; loadAll(); });
  await loadAll();
}

async function loadAll() {
  const f = state.filters.all;
  const { scope, date, ...rest } = f;
  const sort = rest.sort === 'time' && scope === 'overdue' ? 'due' : rest.sort;
  const data = await api('/tasks?' + queryString({ ...rest, sort }, { scope, date: scope === 'date' ? date : '' }));
  if (!data.tasks.length) { $('#list').innerHTML = emptyState(isFiltered(f) || scope !== 'all'); return; }

  // nhóm theo ngày
  const groups = new Map();
  for (const t of data.tasks) {
    if (!groups.has(t.due_date)) groups.set(t.due_date, []);
    groups.get(t.due_date).push(t);
  }
  const keys = [...groups.keys()];
  if (scope === 'all' && f.sort !== 'created') keys.sort((a, b) => (b > a ? 1 : -1)); // gần nhất trước
  if (scope === 'upcoming') keys.sort();
  if (f.sort === 'created') { $('#list').innerHTML = `<div class="tasks">${data.tasks.map(taskCard).join('')}</div>`; return; }

  $('#list').innerHTML = keys.map((d) => `
    <div class="group-title ${d < state.today && groups.get(d).some((t) => t.is_overdue) ? 'overdue' : ''}">${fmtGroupDate(d, state.today)} <small>${groups.get(d).length}</small></div>
    <div class="tasks">${groups.get(d).map(taskCard).join('')}</div>`).join('');
}

/* ---------- View: Thống kê ---------- */
function destroyCharts() { state.charts.forEach((c) => c.destroy()); state.charts = []; }

async function renderStats() {
  destroyCharts();
  $('#view').innerHTML = `
    <div class="page-head">
      <div><h1>Thống kê</h1><p>Tổng quan năng suất và tiến độ công việc</p></div>
      <select class="select" id="range">
        ${[7, 14, 30].map((n) => `<option value="${n}" ${state.statsDays === n ? 'selected' : ''}>${n} ngày gần nhất</option>`).join('')}
      </select>
    </div>
    <div id="statsBody"><div class="skeleton" style="height:120px"></div></div>`;
  $('#range').onchange = (e) => { state.statsDays = Number(e.target.value); renderStats(); };

  const s = await api('/stats?days=' + state.statsDays);
  const o = s.overview;
  const kpi = (label, val, hint, icon, bg) => `
    <div class="card kpi"><span class="badge" style="background:${bg}">${icon}</span>
      <span class="lbl">${label}</span><span class="val">${val}</span><span class="hint">${hint}</span></div>`;

  $('#statsBody').innerHTML = `
    <div class="kpis">
      ${kpi('Tổng số task', o.total, `${o.todo + o.in_progress} đang chờ xử lý`, '🗂️', '#eef0ff')}
      ${kpi('Tỷ lệ hoàn thành', o.completion_rate + '%', `${o.done}/${o.total} task đã xong`, '✅', '#e7f8f1')}
      ${kpi('Quá hạn', o.overdue, o.overdue ? 'Cần xử lý sớm' : 'Không có task trễ hạn', '⏰', '#ffe8ed')}
      ${kpi('Chuỗi liên tiếp', s.streak + ' ngày', `${fmtMinutes(o.done_minutes) || '0 phút'} đã hoàn thành`, '🔥', '#fff5df')}
    </div>
    <div class="charts">
      <div class="card card-pad span-8">
        <h3>Xu hướng ${s.days} ngày</h3><p class="sub">Task đến hạn so với task đã hoàn thành mỗi ngày</p>
        <div class="chart-box"><canvas id="cTrend"></canvas></div>
      </div>
      <div class="card card-pad span-4">
        <h3>Theo danh mục</h3><p class="sub">Phân bổ toàn bộ task</p>
        <div class="chart-box"><canvas id="cCat"></canvas></div>
      </div>
      <div class="card card-pad span-4">
        <h3>Theo độ ưu tiên</h3><p class="sub">Đã xong / tổng số</p>
        <div class="chart-box sm"><canvas id="cPri"></canvas></div>
      </div>
      <div class="card card-pad span-4">
        <h3>Năng suất theo thứ</h3><p class="sub">Số task hoàn thành theo ngày trong tuần</p>
        <div class="chart-box sm"><canvas id="cDow"></canvas></div>
      </div>
      <div class="card card-pad span-4">
        <h3>Tiến độ danh mục</h3><p class="sub">Tỷ lệ hoàn thành từng nhóm</p>
        ${s.by_category.map((c) => {
          const pct = c.total ? Math.round((c.done / c.total) * 100) : 0;
          return `<div class="cat-row"><span>${esc(c.icon)} ${esc(c.name)}</span><b>${pct}%</b>
            <div class="bar"><i style="width:${pct}%;background:${esc(c.color)}"></i></div></div>`;
        }).join('')}
      </div>
      <div class="card card-pad span-12">
        <h3>Hoạt động gần đây</h3><p class="sub">Nhật ký tự động ghi bởi trigger của database</p>
        <ul class="activity">
          ${s.recent_activity.map((a) => {
            const text = a.action === 'created' ? 'Đã tạo' : a.action === 'deleted' ? 'Đã xóa'
              : a.to_status === 'done' ? 'Đã hoàn thành' : `Chuyển sang “${STATUS[a.to_status]}”`;
            const ic = a.action === 'created' ? '🆕' : a.action === 'deleted' ? '🗑️' : a.to_status === 'done' ? '✅' : '🔄';
            return `<li><span class="ic">${ic}</span><span><b>${text}</b> · ${esc(a.task_title)}</span><time>${fmtAgo(a.created_at)}</time></li>`;
          }).join('') || '<li>Chưa có hoạt động nào.</li>'}
        </ul>
      </div>
    </div>`;

  drawCharts(s);
}

function drawCharts(s) {
  if (typeof Chart === 'undefined') {
    $$('.chart-box').forEach((b) => { b.innerHTML = '<div class="empty">Không tải được thư viện biểu đồ (cần Internet để tải Chart.js).</div>'; });
    return;
  }
  Chart.defaults.font.family = "'Be Vietnam Pro', system-ui, sans-serif";
  Chart.defaults.color = '#6b7090';
  const grid = { color: '#eceef8' };
  const mk = (id, cfg) => state.charts.push(new Chart($(id), cfg));
  const short = (d) => { const x = parseDate(d); return `${x.getDate()}/${x.getMonth() + 1}`; };

  mk('#cTrend', {
    type: 'line',
    data: {
      labels: s.daily.map((d) => short(d.day)),
      datasets: [
        { label: 'Đến hạn', data: s.daily.map((d) => d.due), borderColor: '#a5b4fc', backgroundColor: 'rgba(165,180,252,.18)', fill: true, tension: .35, pointRadius: 3 },
        { label: 'Hoàn thành', data: s.daily.map((d) => d.completed), borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,.15)', fill: true, tension: .35, pointRadius: 3 },
      ],
    },
    options: { maintainAspectRatio: false, interaction: { mode: 'index', intersect: false }, plugins: { legend: { position: 'bottom' } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 }, grid }, x: { grid: { display: false } } } },
  });

  mk('#cCat', {
    type: 'doughnut',
    data: { labels: s.by_category.map((c) => c.name), datasets: [{ data: s.by_category.map((c) => c.total), backgroundColor: s.by_category.map((c) => c.color), borderWidth: 3, borderColor: '#fff' }] },
    options: { maintainAspectRatio: false, cutout: '64%', plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, usePointStyle: true } } } },
  });

  mk('#cPri', {
    type: 'bar',
    data: {
      labels: s.by_priority.map((p) => PRIORITY[p.priority]),
      datasets: [
        { label: 'Tổng', data: s.by_priority.map((p) => p.total), backgroundColor: '#e0e3f7', borderRadius: 8 },
        { label: 'Đã xong', data: s.by_priority.map((p) => p.done), backgroundColor: '#6366f1', borderRadius: 8 },
      ],
    },
    options: { maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 }, grid }, x: { grid: { display: false } } } },
  });

  const dowName = { 1: 'T2', 2: 'T3', 3: 'T4', 4: 'T5', 5: 'T6', 6: 'T7', 0: 'CN' };
  const max = Math.max(...s.by_weekday.map((d) => d.n));
  mk('#cDow', {
    type: 'bar',
    data: { labels: s.by_weekday.map((d) => dowName[d.dow]), datasets: [{ data: s.by_weekday.map((d) => d.n), backgroundColor: s.by_weekday.map((d) => (d.n === max ? '#8b5cf6' : '#c4b5fd')), borderRadius: 8 }] },
    options: { maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 }, grid }, x: { grid: { display: false } } } },
  });
}

/* ---------- Sidebar ---------- */
function updateSidebarProgress(done, total) {
  $('#footDone').textContent = `${done}/${total}`;
  $('#footBar').style.width = total ? `${(done / total) * 100}%` : '0';
}

async function refreshCategories() {
  const [cats, today] = await Promise.all([api('/categories'), api('/tasks?scope=today')]);
  state.categories = cats;
  const doneToday = today.tasks.filter((t) => t.status === 'done').length;
  updateSidebarProgress(doneToday, today.count);
  $('#navTodayCount').textContent = today.count - doneToday;
  $('#catNav').innerHTML = `<div class="nav-title">Danh mục</div>` + state.categories.map((c) =>
    `<a href="#/all" data-cat="${c.id}"><span class="dot" style="background:${esc(c.color)}"></span>${esc(c.icon)} ${esc(c.name)}<span class="count">${c.total}</span></a>`).join('');
  $$('#catNav a').forEach((a) => a.addEventListener('click', () => {
    Object.assign(state.filters.all, { category_id: a.dataset.cat, scope: 'all', status: '', q: '', priority: '' });
  }));
}

/* ---------- Dialog: thêm / sửa ---------- */
const dlg = $('#taskDialog');
const form = $('#taskForm');
let editingId = null;

function fillCategorySelect(selected) {
  $('#f_category_id').innerHTML = '<option value="">— Không danh mục —</option>' +
    state.categories.map((c) => `<option value="${c.id}" ${String(selected) === String(c.id) ? 'selected' : ''}>${esc(c.icon)} ${esc(c.name)}</option>`).join('');
}
function clearErrors() { $$('.field', form).forEach((f) => { f.classList.remove('invalid'); const e = $('.err', f); if (e) e.textContent = ''; }); }
function showErrors(fields = {}) {
  for (const [k, msg] of Object.entries(fields)) {
    const f = $(`.field[data-f="${k}"]`, form);
    if (f) { f.classList.add('invalid'); $('.err', f).textContent = msg; }
  }
}

function openTaskDialog(task = {}) {
  editingId = task.id || null;
  clearErrors();
  $('#dlgTitle').textContent = editingId ? 'Sửa task' : 'Thêm task mới';
  $('#saveBtn').textContent = editingId ? 'Lưu thay đổi' : 'Thêm task';
  fillCategorySelect(task.category_id);
  form.title.value = task.title || '';
  form.description.value = task.description || '';
  form.due_date.value = task.due_date || state.today;
  form.start_time.value = task.start_time || '';
  form.end_time.value = task.end_time || '';
  form.estimate_min.value = task.estimate_min || '';
  form.priority.value = task.priority || 'medium';
  form.status.value = task.status || 'todo';
  dlg.showModal();
  setTimeout(() => form.title.focus(), 50);
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearErrors();
  const body = {
    title: form.title.value, description: form.description.value, due_date: form.due_date.value,
    start_time: form.start_time.value || null, end_time: form.end_time.value || null,
    estimate_min: form.estimate_min.value || null, category_id: form.category_id.value || null,
    priority: form.priority.value, status: form.status.value,
  };
  const btn = $('#saveBtn');
  btn.disabled = true;
  try {
    await api(editingId ? `/tasks/${editingId}` : '/tasks', { method: editingId ? 'PUT' : 'POST', body });
    dlg.close();
    toast(editingId ? 'Đã cập nhật task' : 'Đã thêm task mới');
    await refreshAll();
  } catch (err) {
    showErrors(err.fields);
    if (!err.fields) toast(err.message, 'error');
  } finally { btn.disabled = false; }
});

/* ---------- Dialog: xác nhận xóa ---------- */
const confirmDlg = $('#confirmDialog');
let deleteId = null;
function askDelete(task) {
  deleteId = task.id;
  $('#confirmText').textContent = `Bạn có chắc muốn xóa “${task.title}”? Hành động này không thể hoàn tác.`;
  confirmDlg.showModal();
}
$('#confirmOk').addEventListener('click', async () => {
  try {
    await api(`/tasks/${deleteId}`, { method: 'DELETE' });
    confirmDlg.close();
    toast('Đã xóa task');
    await refreshAll();
  } catch (err) { toast(err.message, 'error'); }
});
$$('[data-close]').forEach((b) => b.addEventListener('click', () => b.closest('dialog').close()));
$$('dialog').forEach((d) => d.addEventListener('click', (e) => { if (e.target === d) d.close(); }));

/* ---------- Hành động trên task (event delegation) ---------- */
document.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-act]');
  if (!btn) return;
  const card = btn.closest('.task');
  const id = Number(card.dataset.id);
  try {
    if (btn.dataset.act === 'toggle') {
      const next = card.classList.contains('done') ? 'todo' : 'done';
      await api(`/tasks/${id}/status`, { method: 'PATCH', body: { status: next } });
      if (next === 'done') toast('Tuyệt vời! Đã hoàn thành task 🎉');
      await refreshAll();
    } else if (btn.dataset.act === 'start') {
      await api(`/tasks/${id}/status`, { method: 'PATCH', body: { status: 'in_progress' } });
      await refreshAll();
    } else if (btn.dataset.act === 'edit') {
      openTaskDialog(await api(`/tasks/${id}`));
    } else if (btn.dataset.act === 'delete') {
      askDelete(await api(`/tasks/${id}`));
    }
  } catch (err) { toast(err.message, 'error'); }
});

/* ---------- Router ---------- */
const routes = { today: renderToday, all: renderAll, stats: renderStats };
async function render() {
  const name = (location.hash.replace('#/', '') || 'today');
  const route = routes[name] ? name : 'today';
  destroyCharts();
  $$('#nav a').forEach((a) => a.classList.toggle('active', a.dataset.route === route));
  state.today = toDateStr();
  try { await routes[route](); }
  catch (err) { $('#view').innerHTML = `<div class="empty card"><div class="big">😵</div><b>Không tải được dữ liệu</b>${esc(err.message)}</div>`; }
}
async function refreshAll() { await refreshCategories(); await render(); }

window.addEventListener('hashchange', render);
(async function init() {
  if (!location.hash) location.hash = '#/today';
  try { await refreshCategories(); } catch (e) { toast('Không kết nối được máy chủ', 'error'); }
  await render();
})();
