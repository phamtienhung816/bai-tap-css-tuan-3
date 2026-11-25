'use strict';
/**
 * Dữ liệu mock cho trang thống kê.
 *  - Ngày được tính TƯƠNG ĐỐI so với hôm nay, nên "Hôm nay" luôn có task.
 *  - Dùng bộ sinh số ngẫu nhiên có seed cố định -> kết quả giống nhau mỗi lần.
 *
 *  Chạy:  npm run reset-db     (xóa sạch dữ liệu cũ và nạp lại)
 */
const { db, transaction } = require('./db');
const { toDateStr, addDays, normalize } = require('./utils');

const CATEGORIES = [
  { name: 'Công việc', color: '#6366f1', icon: '💼' },
  { name: 'Học tập', color: '#0ea5e9', icon: '📚' },
  { name: 'Cá nhân', color: '#10b981', icon: '🏡' },
  { name: 'Sức khỏe', color: '#f43f5e', icon: '🏃' },
  { name: 'Tài chính', color: '#f59e0b', icon: '💰' },
];

const POOL = {
  'Công việc': [
    'Họp stand-up với team', 'Viết báo cáo tuần', 'Review pull request', 'Chuẩn bị slide thuyết trình',
    'Trả lời email khách hàng', 'Lên kế hoạch sprint', 'Fix bug trang đăng nhập', 'Cập nhật tài liệu API',
    'Họp với đối tác', 'Dọn dẹp backlog',
  ],
  'Học tập': [
    'Học bài Node.js buổi 5', 'Làm bài tập SQL', 'Đọc chương 3 giáo trình', 'Ôn tập thi giữa kỳ',
    'Xem video khóa học React', 'Làm bài tập nhóm', 'Luyện nghe tiếng Anh 30 phút', 'Viết ghi chú bài giảng',
  ],
  'Cá nhân': [
    'Dọn phòng', 'Gọi điện cho gia đình', 'Đi siêu thị', 'Giặt đồ', 'Đọc sách 30 trang',
    'Sắp xếp ảnh du lịch', 'Nấu bữa tối', 'Sửa xe máy',
  ],
  'Sức khỏe': [
    'Chạy bộ 5km', 'Tập gym', 'Yoga buổi sáng', 'Uống đủ 2 lít nước', 'Khám sức khỏe định kỳ', 'Ngủ trước 23h',
  ],
  'Tài chính': [
    'Thanh toán tiền điện', 'Ghi chép chi tiêu tuần', 'Đóng tiền internet', 'Xem lại ngân sách tháng', 'Chuyển tiền tiết kiệm',
  ],
};

const DESCRIPTIONS = [
  '', '', '',
  'Chuẩn bị tài liệu trước và ghi lại các điểm cần trao đổi.',
  'Hoàn thành trước giờ nghỉ trưa nếu có thể.',
  'Nhớ gửi kết quả cho mọi người sau khi xong.',
  'Ưu tiên làm sớm để tránh dồn việc cuối ngày.',
];

function mulberry32(seed) {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pad = (n) => String(n).padStart(2, '0');
const hhmm = (mins) => `${pad(Math.floor(mins / 60))}:${pad(mins % 60)}`;

function seed({ reset = false } = {}) {
  const rnd = mulberry32(20260101);
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  const today = toDateStr();

  transaction(() => {
    if (reset) {
      db.exec('DELETE FROM task_activity; DELETE FROM tasks; DELETE FROM categories;');
      db.exec("DELETE FROM sqlite_sequence WHERE name IN ('tasks','categories','task_activity');");
    }

    const insCat = db.prepare('INSERT INTO categories (name, color, icon) VALUES (?, ?, ?)');
    const catId = {};
    for (const c of CATEGORIES) catId[c.name] = Number(insCat.run(c.name, c.color, c.icon).lastInsertRowid);

    const insTask = db.prepare(`
      INSERT INTO tasks (title, description, due_date, start_time, end_time, estimate_min,
                         priority, status, category_id, search_text, created_at, updated_at, completed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

    const add = (t) => {
      let createdDay = addDays(t.due, -Math.floor(rnd() * 3) - 1);
      let createdMin = 7 * 60 + Math.floor(rnd() * 600);
      if (createdDay >= today) { createdDay = today; createdMin = 7 * 60 + Math.floor(rnd() * 60); } // không tạo ở tương lai
      const created = `${createdDay} ${hhmm(createdMin)}:00`;
      let completed = null;
      if (t.status === 'done') {
        const endMin = t.end ? Number(t.end.slice(0, 2)) * 60 + Number(t.end.slice(3)) : 9 * 60 + Math.floor(rnd() * 600);
        completed = `${t.due} ${hhmm(Math.min(endMin + Math.floor(rnd() * 20), 23 * 60 + 30))}:00`;
      }
      insTask.run(
        t.title, t.desc || '', t.due, t.start || null, t.end || null, t.est || null,
        t.priority, t.status, catId[t.cat], normalize(`${t.title} ${t.desc || ''}`),
        created, completed || created, completed,
      );
    };

    // ---- 1) Lịch sử 30 ngày trước (phần lớn đã hoàn thành) ------------------
    for (let back = 30; back >= 1; back--) {
      const due = addDays(today, -back);
      const dow = new Date(`${due}T00:00:00`).getDay();       // 0 = CN
      const n = dow === 0 || dow === 6 ? 2 + Math.floor(rnd() * 2) : 4 + Math.floor(rnd() * 3);
      for (let i = 0; i < n; i++) {
        const cat = pick(Object.keys(POOL));
        const startMin = (7 + Math.floor(rnd() * 11)) * 60 + pick([0, 15, 30, 45]);
        const est = pick([15, 30, 30, 45, 60, 60, 90, 120]);
        const hasTime = rnd() < 0.7;
        const r = rnd();
        add({
          title: pick(POOL[cat]), desc: pick(DESCRIPTIONS), due, cat, est,
          start: hasTime ? hhmm(startMin) : null,
          end: hasTime ? hhmm(Math.min(startMin + est, 23 * 60 + 45)) : null,
          priority: r < 0.25 ? 'high' : r < 0.7 ? 'medium' : 'low',
          // ~95% xong, số còn lại bị bỏ quên -> "quá hạn"
          status: rnd() < (back <= 3 ? 0.85 : 0.96) ? 'done' : 'todo',
        });
      }
    }

    // ---- 2) Hôm nay: bộ task thủ công cho demo đẹp ---------------------------
    const todayTasks = [
      { title: 'Họp stand-up với team', cat: 'Công việc', start: '08:30', end: '09:00', est: 30, priority: 'medium', status: 'done', desc: 'Cập nhật tiến độ và các vướng mắc.' },
      { title: 'Hoàn thiện báo cáo Todo app', cat: 'Học tập', start: '09:30', end: '11:30', est: 120, priority: 'high', status: 'in_progress', desc: 'Viết README, vẽ sơ đồ database và chụp ảnh giao diện.' },
      { title: 'Chạy bộ 5km', cat: 'Sức khỏe', start: '06:00', end: '06:45', est: 45, priority: 'medium', status: 'done', desc: '' },
      { title: 'Review pull request của Minh', cat: 'Công việc', start: '13:30', end: '14:30', est: 60, priority: 'high', status: 'todo', desc: 'Chú ý phần validate dữ liệu đầu vào.' },
      { title: 'Làm bài tập SQL', cat: 'Học tập', start: '15:00', end: '16:30', est: 90, priority: 'medium', status: 'todo', desc: 'JOIN, GROUP BY và subquery.' },
      { title: 'Thanh toán tiền điện', cat: 'Tài chính', est: 10, priority: 'low', status: 'todo', desc: 'Hạn cuối là cuối tuần này.' },
      { title: 'Đi siêu thị', cat: 'Cá nhân', start: '18:00', end: '19:00', est: 60, priority: 'low', status: 'todo', desc: 'Mua rau, trứng, sữa.' },
      { title: 'Đọc sách 30 trang', cat: 'Cá nhân', start: '21:00', end: '21:45', est: 45, priority: 'low', status: 'todo', desc: '' },
    ];
    for (const t of todayTasks) add({ ...t, due: today });

    // ---- 3) Quá hạn gần đây (để demo cảnh báo) -------------------------------
    add({ title: 'Nộp bài tập nhóm', cat: 'Học tập', due: addDays(today, -1), est: 60, priority: 'high', status: 'todo', desc: 'Chưa gửi file cuối cùng cho nhóm trưởng.' });

    // ---- 4) 7 ngày tới ------------------------------------------------------
    for (let fwd = 1; fwd <= 7; fwd++) {
      const n = 1 + Math.floor(rnd() * 3);
      for (let i = 0; i < n; i++) {
        const cat = pick(Object.keys(POOL));
        const r = rnd();
        add({
          title: pick(POOL[cat]), desc: pick(DESCRIPTIONS), due: addDays(today, fwd), cat,
          est: pick([30, 45, 60, 90]),
          priority: r < 0.3 ? 'high' : r < 0.7 ? 'medium' : 'low',
          status: 'todo',
        });
      }
    }

    // ---- 5) Dựng lại nhật ký hoạt động từ dữ liệu mock -----------------------
    // (trigger đã ghi toàn bộ vào "bây giờ" nên xóa đi và ghi lại theo đúng mốc thời gian)
    db.exec('DELETE FROM task_activity;');
    db.exec(`
      INSERT INTO task_activity (task_id, task_title, action, to_status, created_at)
        SELECT id, title, 'created', 'todo', created_at FROM tasks;
      INSERT INTO task_activity (task_id, task_title, action, from_status, to_status, created_at)
        SELECT id, title, 'status_changed', 'in_progress', 'done', completed_at FROM tasks WHERE completed_at IS NOT NULL;
    `);
  });

  const n = db.prepare('SELECT COUNT(*) AS n FROM tasks').get().n;
  return n;
}

/** Nạp mock nếu DB đang trống (lần chạy đầu tiên). */
function seedIfEmpty() {
  const { n } = db.prepare('SELECT COUNT(*) AS n FROM tasks').get();
  const { c } = db.prepare('SELECT COUNT(*) AS c FROM categories').get();
  if (n === 0 && c === 0) return seed();
  return 0;
}

module.exports = { seed, seedIfEmpty };

if (require.main === module) {
  const total = seed({ reset: true });
  console.log(`✅ Đã nạp ${total} task mock vào database.`);
}
