# 🤖 Prompt vibe code

Tài liệu ghi lại cách dùng AI (Claude Code) để làm ra dự án này: yêu cầu gốc và chuỗi prompt có thể dùng để tái tạo từng phần.

## 0. Yêu cầu gốc (đề bài)

> **Todo app: chương trình quản lý các task cá nhân**
> - Kết quả mong đợi: code đưa lên GitHub kèm README mô tả chức năng hệ thống.
> - Chức năng: (1) hiển thị các task trong ngày hôm nay, có thể search, filter; (2) thêm, sửa, xóa; (3) trang thống kê, có đưa dữ liệu mock vào.
> - Dùng Node.js, tự quyết định database.
> - GUI; prompt vibe code.
> - Database: trình bày kiến trúc đã tạo ra.
> - Chương trình phải chạy được, quan trọng là database.
> - Tạo mockup khoảng 2–3 trang.

## 1. Cách làm việc với AI

1. Giao AI đọc đề bài và hỏi lại những điểm chưa rõ **trước khi code** (chọn database, hướng frontend, các thuộc tính của task, dạng mockup).
2. Chốt quyết định: **SQLite + Express + HTML/CSS/JS thuần**; task có đủ tiêu đề, mô tả, hạn, giờ bắt đầu/kết thúc, ước tính, ưu tiên, trạng thái, danh mục; mockup là HTML tĩnh dùng chung style với app thật.
3. Làm theo thứ tự **database → API → giao diện → mockup → tài liệu**, kiểm thử bằng cách chạy thật sau mỗi bước.

## 2. Chuỗi prompt mẫu

### Prompt 1 – Thiết kế database (quan trọng nhất)
```
Thiết kế database SQLite cho Todo app cá nhân. Bảng: categories, tasks, task_activity.
Task có: tiêu đề, mô tả, ngày hạn, giờ bắt đầu/kết thúc (có thể null), thời gian ước tính (phút),
độ ưu tiên low/medium/high, trạng thái todo/in_progress/done, danh mục, completed_at.
Yêu cầu: ràng buộc CHECK chặt (ngày giờ hợp lệ, end_time > start_time), khóa ngoại ON DELETE SET NULL,
index cho các truy vấn hôm nay / quá hạn / theo danh mục, trigger tự cập nhật updated_at và completed_at,
trigger ghi nhật ký hoạt động, view phục vụ thống kê. Có cột search_text không dấu để tìm tiếng Việt.
Viết vào db/schema.sql, có chú thích tiếng Việt, chạy lại nhiều lần không lỗi.
```

### Prompt 2 – Mock data
```
Viết src/seed.js nạp ~150 task mock: 30 ngày lịch sử (phần lớn đã xong, vài task quá hạn),
8 task hôm nay đủ mọi trạng thái, 7 ngày tới. Ngày tính tương đối so với hôm nay, dùng RNG có seed cố định.
Sau khi nạp hãy dựng lại task_activity theo đúng mốc thời gian. Có lệnh npm run reset-db.
```

### Prompt 3 – Backend API
```
Viết REST API Express dùng node:sqlite: CRUD task, đổi trạng thái nhanh (PATCH), danh mục, và /api/stats.
GET /api/tasks hỗ trợ scope (today/overdue/upcoming/date/all), q (tìm không dấu), status, priority, category_id, sort.
Validate đầu vào, lỗi trả 400 kèm "fields" theo từng trường. Dùng prepared statement, không nối chuỗi SQL với dữ liệu người dùng.
```

### Prompt 4 – Giao diện
```
Làm giao diện HTML/CSS/JS thuần (không build), tiếng Việt, hash-router 3 trang:
Hôm nay (vòng tiến độ, cảnh báo quá hạn, search + filter + sort), Tất cả task (nhóm theo ngày, tab Quá hạn/Sắp tới/Chọn ngày),
Thống kê (KPI + Chart.js: xu hướng, danh mục, ưu tiên, thứ trong tuần, hoạt động gần đây).
Dialog thêm/sửa có validate và hiện lỗi dưới từng ô, dialog xác nhận xóa, toast. Thiết kế hiện đại, responsive,
dùng chung một file CSS design system.
```

### Prompt 5 – Mockup
```
Tạo 3 mockup HTML tĩnh (Hôm nay, Thêm/Sửa task có trạng thái lỗi, Thống kê) dùng chung app.css với app thật
để giao diện sau khi code giống đúng thiết kế.
```

### Prompt 6 – Tài liệu và kiểm thử
```
Viết README (chức năng, cách chạy, cấu trúc thư mục, API), docs/DATABASE.md (ERD mermaid, giải thích ràng buộc,
index, trigger, view, truy vấn mẫu) và test bằng node:test cho API + ràng buộc database.
```

## 3. Prompt chỉnh sửa tiếp theo (gợi ý)

- “Thêm chế độ tối (dark mode), lưu lựa chọn vào localStorage.”
- “Thêm task lặp lại hằng ngày/hằng tuần: cần thêm bảng `recurrence_rules` và job sinh task.”
- “Thêm xuất báo cáo tuần ra CSV.”
- “Chuyển SQLite sang PostgreSQL, giữ nguyên API.”
