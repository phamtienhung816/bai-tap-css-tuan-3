-- =====================================================================
--  TODO APP - SQLite schema
--  Quy ước: ngày = 'YYYY-MM-DD', giờ = 'HH:MM', timestamp = 'YYYY-MM-DD HH:MM:SS'
--  (giờ địa phương). Tất cả đều lưu dạng TEXT theo chuẩn ISO-8601 nên so sánh
--  chuỗi cũng chính là so sánh thời gian.
-- =====================================================================

PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------------------
-- 1. categories : danh mục / nhãn của task (Work, Study, Personal...)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS categories (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT    NOT NULL UNIQUE COLLATE NOCASE
                       CHECK (length(trim(name)) BETWEEN 1 AND 40),
    color      TEXT    NOT NULL DEFAULT '#6366f1'
                       CHECK (color GLOB '#[0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F]'),
    icon       TEXT    NOT NULL DEFAULT '📌',
    created_at TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
);

-- ---------------------------------------------------------------------
-- 2. tasks : bảng chính
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tasks (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    title         TEXT    NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 200),
    description   TEXT    NOT NULL DEFAULT '' CHECK (length(description) <= 2000),
    due_date      TEXT    NOT NULL CHECK (date(due_date) = due_date),
    start_time    TEXT    CHECK (start_time IS NULL OR strftime('%H:%M', start_time) = start_time),
    end_time      TEXT    CHECK (end_time   IS NULL OR strftime('%H:%M', end_time) = end_time),
    estimate_min  INTEGER CHECK (estimate_min IS NULL OR estimate_min BETWEEN 1 AND 1440),
    priority      TEXT    NOT NULL DEFAULT 'medium'
                          CHECK (priority IN ('low','medium','high')),
    status        TEXT    NOT NULL DEFAULT 'todo'
                          CHECK (status IN ('todo','in_progress','done')),
    category_id   INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    search_text   TEXT    NOT NULL DEFAULT '',   -- tiêu đề+mô tả đã bỏ dấu, viết thường (để search tiếng Việt)
    created_at    TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
    updated_at    TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
    completed_at  TEXT,                          -- do trigger tự điền khi status -> done
    CHECK (start_time IS NULL OR end_time IS NULL OR end_time > start_time)
);

CREATE INDEX IF NOT EXISTS idx_tasks_due_date      ON tasks (due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_status_due    ON tasks (status, due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_category      ON tasks (category_id);
CREATE INDEX IF NOT EXISTS idx_tasks_priority      ON tasks (priority);
CREATE INDEX IF NOT EXISTS idx_tasks_completed_at  ON tasks (completed_at);

-- ---------------------------------------------------------------------
-- 3. task_activity : nhật ký thay đổi (ghi tự động bằng trigger)
--    Không có FK tới tasks để vẫn giữ được lịch sử sau khi task bị xóa.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS task_activity (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id     INTEGER NOT NULL,
    task_title  TEXT    NOT NULL,
    action      TEXT    NOT NULL CHECK (action IN ('created','status_changed','deleted')),
    from_status TEXT,
    to_status   TEXT,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS idx_activity_created ON task_activity (created_at DESC);

-- ---------------------------------------------------------------------
-- TRIGGERS
-- ---------------------------------------------------------------------

-- Tự điền completed_at khi tạo task đã ở trạng thái done
CREATE TRIGGER IF NOT EXISTS trg_tasks_insert_completed
AFTER INSERT ON tasks
WHEN NEW.status = 'done' AND NEW.completed_at IS NULL
BEGIN
    UPDATE tasks SET completed_at = datetime('now','localtime') WHERE id = NEW.id;
END;

-- Cập nhật updated_at mỗi khi sửa
CREATE TRIGGER IF NOT EXISTS trg_tasks_touch
AFTER UPDATE ON tasks
WHEN NEW.updated_at = OLD.updated_at
BEGIN
    UPDATE tasks SET updated_at = datetime('now','localtime') WHERE id = NEW.id;
END;

-- Chuyển sang done -> ghi completed_at
CREATE TRIGGER IF NOT EXISTS trg_tasks_mark_done
AFTER UPDATE OF status ON tasks
WHEN NEW.status = 'done' AND OLD.status <> 'done'
BEGIN
    UPDATE tasks SET completed_at = datetime('now','localtime') WHERE id = NEW.id;
END;

-- Mở lại task -> xóa completed_at
CREATE TRIGGER IF NOT EXISTS trg_tasks_reopen
AFTER UPDATE OF status ON tasks
WHEN NEW.status <> 'done' AND OLD.status = 'done'
BEGIN
    UPDATE tasks SET completed_at = NULL WHERE id = NEW.id;
END;

-- Nhật ký
CREATE TRIGGER IF NOT EXISTS trg_activity_created
AFTER INSERT ON tasks
BEGIN
    INSERT INTO task_activity (task_id, task_title, action, to_status)
    VALUES (NEW.id, NEW.title, 'created', NEW.status);
END;

CREATE TRIGGER IF NOT EXISTS trg_activity_status
AFTER UPDATE OF status ON tasks
WHEN NEW.status <> OLD.status
BEGIN
    INSERT INTO task_activity (task_id, task_title, action, from_status, to_status)
    VALUES (NEW.id, NEW.title, 'status_changed', OLD.status, NEW.status);
END;

CREATE TRIGGER IF NOT EXISTS trg_activity_deleted
AFTER DELETE ON tasks
BEGIN
    INSERT INTO task_activity (task_id, task_title, action, from_status)
    VALUES (OLD.id, OLD.title, 'deleted', OLD.status);
END;

-- ---------------------------------------------------------------------
-- VIEWS
-- ---------------------------------------------------------------------

-- Task kèm thông tin danh mục + cờ quá hạn + thời lượng thực tế (phút)
CREATE VIEW IF NOT EXISTS v_tasks AS
SELECT  t.id, t.title, t.description, t.due_date, t.start_time, t.end_time,
        t.estimate_min, t.priority, t.status, t.category_id,
        c.name  AS category_name,
        c.color AS category_color,
        c.icon  AS category_icon,
        t.created_at, t.updated_at, t.completed_at, t.search_text,
        CASE WHEN t.status <> 'done' AND t.due_date < date('now','localtime')
             THEN 1 ELSE 0 END AS is_overdue,
        CASE t.priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END AS priority_rank
FROM tasks t
LEFT JOIN categories c ON c.id = t.category_id;

-- Tổng hợp theo ngày hạn: dùng cho biểu đồ thống kê
CREATE VIEW IF NOT EXISTS v_daily_summary AS
SELECT  due_date                                     AS day,
        COUNT(*)                                     AS total,
        SUM(status = 'done')                         AS done,
        SUM(status = 'in_progress')                  AS in_progress,
        SUM(status = 'todo')                         AS todo,
        COALESCE(SUM(estimate_min), 0)               AS estimate_min,
        COALESCE(SUM(CASE WHEN status = 'done' THEN estimate_min END), 0) AS done_estimate_min
FROM tasks
GROUP BY due_date;

-- Tổng hợp theo danh mục
CREATE VIEW IF NOT EXISTS v_category_summary AS
SELECT  c.id, c.name, c.color, c.icon,
        COUNT(t.id)                          AS total,
        COALESCE(SUM(t.status = 'done'), 0)  AS done
FROM categories c
LEFT JOIN tasks t ON t.category_id = c.id
GROUP BY c.id;
