# HọcLiệu - API Backend (REST API)

REST API cho nền tảng chia sẻ tài liệu học thuật HọcLiệu, được xây dựng bằng **Express 5**, **TypeScript 5.8**, **Prisma ORM (v6)** và cơ sở dữ liệu **PostgreSQL**.

## Yêu cầu hệ thống

Trước khi chạy dự án, hãy cài đặt các công cụ sau để đảm bảo đầy đủ tính năng:
1. **Node.js** (Phiên bản v18 trở lên, khuyên dùng v22)
2. **PostgreSQL** (Đang chạy local hoặc dịch vụ Cloud)
3. **Poppler (pdftoppm)**: Cần thiết để tự động trích xuất các trang đầu của tài liệu PDF thành hình ảnh làm ảnh xem trước (preview).
   - *Windows*: Tải bản Poppler cho Windows (ví dụ qua scoop hoặc từ thư viện zip trực tuyến), giải nén và thêm đường dẫn của thư mục `bin` vào biến môi trường `PATH` hệ thống hoặc thiết lập biến `PDFTOPPM_PATH` trong tệp `.env`.
   - *Ubuntu/Linux*: Chạy lệnh `sudo apt-get install -y poppler-utils`.
4. **LibreOffice (soffice)**: Cần thiết để tự động chuyển đổi các tài liệu văn bản Office (`.docx`, `.pptx`) sang định dạng `.pdf` trước khi sinh ảnh preview.
   - *Windows*: Cài đặt LibreOffice, sau đó cấu hình biến `SOFFICE_PATH` trỏ tới tệp `soffice.exe` trong thư mục cài đặt (mặc định thường là `C:\Program Files\LibreOffice\program\soffice.exe`).
   - *Ubuntu/Linux*: Chạy lệnh `sudo apt-get install -y libreoffice`.

---

## Các bước thiết lập ban đầu (Setup)

1. **Cài đặt thư viện (Dependencies):**
   ```bash
   npm install
   ```

2. **Tạo tệp cấu hình môi trường `.env`:**
   - Trên Windows PowerShell:
     ```powershell
     Copy-Item .env.example .env
     ```
   - Trên Linux/macOS hoặc Git Bash:
     ```bash
     cp .env.example .env
     ```

3. **Cập nhật các biến môi trường thiết yếu trong `.env`:**
   - `DATABASE_URL`: Đường dẫn kết nối CSDL PostgreSQL (ví dụ: `postgresql://postgres:postgres@localhost:5432/express_backend`).
   - `JWT_ACCESS_SECRET` và `JWT_REFRESH_SECRET`: Khóa ký token JWT (Yêu cầu độ dài tối thiểu 32 ký tự).
   - `FRONTEND_URL`: URL của frontend dùng cho điều hướng sau thanh toán và thiết lập CORS (Cần cập nhật thành `http://localhost:4000` để đồng bộ với cổng chạy mặc định của frontend).
   - `CLOUDINARY_URL`: (Tùy chọn) Để tải tệp tài liệu lên Cloudinary. Nếu không cấu hình, hệ thống sẽ lưu trữ tệp cục bộ (Local Storage).
   - Các biến SMTP (`SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`...) để gửi mã OTP xác minh qua Email (Khi chưa cấu hình, môi trường dev sẽ trả trực tiếp mã xác nhận trong phản hồi API qua trường `debugOtp`).

4. **Khởi tạo và đồng bộ Database:**
   ```bash
   # Đồng bộ cấu trúc bảng từ schema.prisma vào PostgreSQL
   npx prisma migrate dev
   ```

5. **Nạp dữ liệu mẫu (Database Seeding):**
   Chạy lệnh nạp dữ liệu danh mục và tài khoản thử nghiệm:
   ```bash
   npm run db:seed
   ```
   **Dữ liệu mẫu bao gồm các tài khoản sau (Mật khẩu chung là: `Password@123`):**
   - Tài khoản Quản trị (Admin): `admin@hoclieu.local`
   - Tài khoản Người dùng (User): `student@hoclieu.local`
   - Tài khoản Người dùng Premium: `premium@hoclieu.local`
   - Tài khoản Người dùng có Credit: `credituser@hoclieu.local`

---

## Khởi chạy dự án

Khởi động máy chủ API ở chế độ phát triển (Development):
```bash
npm run dev
```
Mặc định máy chủ sẽ lắng nghe tại địa chỉ:
```text
http://localhost:3000
```

---

## Các API Routes chính

Tất cả các Endpoint nghiệp vụ được mount dưới tiền tố đường dẫn `/api/v1`:

- **Hệ thống & Thống kê:** `/dashboard` (Admin dashboard stats)
- **Tài khoản & Phân quyền:** `/auth`, `/users`
- **Danh mục tài nguyên:** `/schools` (Trường học), `/subjects` (Môn học), `/documents` (Tài liệu học thuật)
- **Hoạt động tương tác:** `/downloads` (Lịch sử tải về), `/favorites` (Yêu thích), `/reports` (Báo cáo vi phạm tài liệu)
- **Giao dịch & Nâng cấp:** `/subscriptions` (Gói Premium đang active), `/payments` (Hóa đơn thanh toán), `/credits` (Lịch sử giao dịch điểm credit)

### Quy chuẩn phản hồi API (Response Format)

- **Khi thành công (Success HTTP 200/201):**
  ```json
  { "success": true, "data": { ... } }
  ```
- **Khi thất bại (Error HTTP 400/401/403/404/500):**
  ```json
  { "success": false, "message": "Mô tả chi tiết lỗi phát sinh" }
  ```

---

## Tích hợp Thanh toán (VNPAY)

1. **Thanh toán thật/Sandbox:** Yêu cầu cấu hình biến `VNPAY_TMN_CODE`, `VNPAY_HASH_SECRET`, `VNPAY_PAYMENT_URL` và `VNPAY_RETURN_URL` trong `.env`. API sẽ tạo link thanh toán trực tiếp đưa sang cổng Sandbox VNPAY. Sau khi thanh toán, người dùng sẽ được redirect về frontend thông qua route callback để đồng bộ nâng cấp tài khoản.
2. **Xác nhận thanh toán giả lập (Mock):** Dùng cho phát triển nhanh (local) khi không cấu hình cổng VNPAY. Khi tạo hóa đơn với phương thức `MOCK`, trạng thái hóa đơn sẽ ở dạng `PENDING`. Bạn có thể gửi một yêu cầu POST có đính kèm token xác thực đến endpoint sau để xác nhận thanh toán thành công và tự động kích hoạt gói Premium:
   ```http
   POST /api/v1/payments/mock-confirm/{paymentId}
   ```
   *(Tính năng giả lập này bị tắt hoàn toàn khi chạy môi trường `production`)*

---

## Danh sách lệnh CLI khả dụng

- `npm run dev`: Chạy hot-reload ở môi trường phát triển (`nodemon` + `ts-node`).
- `npm run build`: Biên dịch mã nguồn TypeScript thành JavaScript chuẩn trong thư mục `dist`.
- `npm run start`: Chạy dự án sau khi đã compile (`node dist/app.js`).
- `npm run typecheck`: Thực hiện kiểm tra kiểu tĩnh (Static Typecheck) bằng TypeScript Compiler.
- `npm run db:generate`: Tạo lại Prisma Client tương thích với Schema hiện tại.
- `npm run db:migrate`: Chạy migration đồng bộ schema.
- `npm run db:seed`: Ghi đè dữ liệu mẫu ban đầu vào database.
- `npm run db:studio`: Mở giao diện quản trị cơ sở dữ liệu Prisma Studio trên trình duyệt.

---

## Triển khai với Docker

Dự án được cấu hình sẵn môi trường container hóa chứa đầy đủ Node.js, LibreOffice và Poppler-utils.

1. **Sao chép tệp môi trường:**
   ```bash
   cp .env.example .env
   ```
2. **Khởi chạy docker compose:**
   ```bash
   docker compose up --build -d
   ```
3. **Thực hiện di cư dữ liệu trên container:**
   ```bash
   docker compose exec api npx prisma migrate deploy
   ```
Container API sẽ lắng nghe tại cổng `3000`, tự động kết nối sang container PostgreSQL thông qua địa chỉ CSDL:
`postgresql://postgres:postgres@postgres:5432/express_backend`
và cấu hình sẵn `SOFFICE_PATH=/usr/bin/soffice`, `PDFTOPPM_PATH=/usr/bin/pdftoppm`.

