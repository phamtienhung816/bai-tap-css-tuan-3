# ✅ TaskFlow – Todo app quản lý task cá nhân

Ứng dụng quản lý công việc cá nhân xây dựng bằng **Node.js + Express + SQLite**, giao diện HTML/CSS/JS thuần (không cần build).
Trọng tâm của đồ án là **thiết kế database** (ràng buộc, index, trigger, view) – xem [docs/DATABASE.md](docs/DATABASE.md).

![stack](https://img.shields.io/badge/Node.js-%E2%89%A522.5-339933) ![db](https://img.shields.io/badge/SQLite-node:sqlite-003B57) ![express](https://img.shields.io/badge/Express-4-black)

## ✨ Chức năng

| Nhóm | Mô tả |
|---|---|
| **Task hôm nay** | Trang chủ hiển thị task đến hạn trong ngày, vòng tiến độ %, cảnh báo task quá hạn |
| **Tìm kiếm** | Tìm theo tiêu đề + mô tả, **không phân biệt dấu** (gõ `hop nhom` vẫn ra “Họp nhóm”) |
| **Lọc & sắp xếp** | Theo trạng thái, độ ưu tiên, danh mục; sắp xếp theo giờ / ưu tiên / mới tạo |
| **Thêm – Sửa – Xóa** | Form đầy đủ, validate cả client lẫn server, xác nhận trước khi xóa |
| **Đổi trạng thái nhanh** | Tick để hoàn thành, ▶ để bắt đầu làm; mở lại task thì tự xóa thời điểm hoàn thành |
| **Tất cả task** | Xem toàn bộ task, nhóm theo ngày, tab *Quá hạn / Sắp tới / Chọn ngày* |
| **Thống kê** | KPI, biểu đồ xu hướng 7/14/30 ngày, theo danh mục, ưu tiên, thứ trong tuần, chuỗi ngày hiệu quả, nhật ký hoạt động |
| **Mock data** | Tự nạp ~150 task mẫu (30 ngày lịch sử + hôm nay + 7 ngày tới) ở lần chạy đầu tiên |

Mỗi task có: tiêu đề, mô tả, ngày hạn, giờ bắt đầu/kết thúc, thời gian ước tính, độ ưu tiên (thấp/trung bình/cao), trạng thái (cần làm/đang làm/hoàn thành), danh mục.

## 🚀 Chạy chương trình

Yêu cầu: **Node.js ≥ 22.5** (dự án dùng module SQLite có sẵn của Node, không cần cài thư viện native).

```bash
cd todo-app
npm install
npm start
```

Mở http://localhost:3000 – lần chạy đầu tiên app tự tạo database `data/todo.db` và nạp dữ liệu mẫu.

| Lệnh | Tác dụng |
|---|---|
| `npm start` | Chạy server (port 3000, đổi bằng biến `PORT`) |
| `npm run dev` | Chạy và tự restart khi sửa code |
| `npm run reset-db` | Xóa sạch dữ liệu và nạp lại mock data |
| `npm test` | Chạy bộ test API + database |

> **Windows PowerShell báo “running scripts is disabled”?** Chạy `npm.cmd start` thay cho `npm start`, hoặc mở bằng Command Prompt / Git Bash.
> Biểu đồ dùng Chart.js từ CDN và font từ Google Fonts nên cần Internet để hiển thị đẹp nhất.

## 🗂️ Cấu trúc thư mục

```
todo-app/
├── server.js              # Khởi động Express, phục vụ API + giao diện
├── db/schema.sql          # ⭐ Thiết kế database (bảng, ràng buộc, index, trigger, view)
├── src/
│   ├── db.js              # Kết nối SQLite, áp schema, helper transaction
│   ├── routes.js          # REST API + validate
│   ├── seed.js            # Mock data (số ngẫu nhiên có seed cố định)
│   └── utils.js           # Ngày giờ, bỏ dấu tiếng Việt
├── public/                # Giao diện thật (HTML/CSS/JS thuần)
│   ├── index.html
│   ├── css/app.css        # Design system dùng chung với mockup
│   └── js/app.js          # Router, render, gọi API
├── mockups/               # 3 trang mockup tĩnh (Hôm nay · Thêm/Sửa · Thống kê)
├── docs/
│   ├── DATABASE.md        # ERD + giải thích kiến trúc database
│   └── PROMPTS.md         # Prompt vibe code đã dùng
└── test/api.test.js
```

## 🗄️ Database (tóm tắt)

SQLite, 3 bảng + 3 view + 6 trigger. Chi tiết và sơ đồ ERD ở [docs/DATABASE.md](docs/DATABASE.md).

```
categories 1 ───< tasks            task_activity (nhật ký, ghi tự động bằng trigger)
```

- **Ràng buộc ở tầng DB**: `CHECK` cho độ ưu tiên/trạng thái/ngày/giờ, giờ kết thúc phải sau giờ bắt đầu, tên danh mục duy nhất, `FOREIGN KEY ... ON DELETE SET NULL`.
- **Index** cho các truy vấn chính: theo ngày hạn, (trạng thái, ngày hạn), danh mục, ưu tiên, thời điểm hoàn thành.
- **Trigger** tự quản lý `updated_at`, `completed_at` và ghi `task_activity`.
- **View** `v_tasks`, `v_daily_summary`, `v_category_summary` phục vụ danh sách và thống kê.

## 🔌 API

| Method | Endpoint | Mô tả |
|---|---|---|
| GET | `/api/tasks?scope=today\|overdue\|upcoming\|date\|all&q=&status=&priority=&category_id=&sort=` | Danh sách + tìm kiếm + lọc |
| GET | `/api/tasks/:id` | Chi tiết |
| POST | `/api/tasks` | Tạo task |
| PUT | `/api/tasks/:id` | Sửa task |
| PATCH | `/api/tasks/:id/status` | Đổi trạng thái nhanh `{ "status": "done" }` |
| DELETE | `/api/tasks/:id` | Xóa task |
| GET | `/api/categories` | Danh mục kèm số task |
| POST | `/api/categories` | Tạo danh mục |
| GET | `/api/stats?days=14` | Dữ liệu trang thống kê |

Lỗi validate trả `400` dạng `{ "error": "...", "fields": { "end_time": "..." } }`.

## 🎨 Mockup

Chạy server rồi mở http://localhost:3000/mockups/ (hoặc mở trực tiếp các file trong `mockups/`).

1. `01-hom-nay.html` – danh sách task trong ngày
2. `02-them-sua-task.html` – form thêm/sửa kèm trạng thái lỗi
3. `03-thong-ke.html` – trang thống kê

## 🤖 Prompt vibe code

Xem [docs/PROMPTS.md](docs/PROMPTS.md).
