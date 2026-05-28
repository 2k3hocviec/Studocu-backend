# Academic Documents API

REST API cho nền tảng chia sẻ tài liệu học thuật, xây dựng bằng Express,
TypeScript, Prisma ORM và PostgreSQL.

## Setup

```powershell
npm install
Copy-Item .env.example .env
npm run db:migrate -- --name init
npm run dev
```

Cập nhật `DATABASE_URL`, `JWT_ACCESS_SECRET` và `JWT_REFRESH_SECRET` trong
`.env` trước khi chạy. Để upload file lên Cloudinary, thiết lập thêm
`CLOUDINARY_URL`; endpoint upload cũng chấp nhận `fileUrl` đã được tải lên sẵn.
Để tạo preview 30% cho DOCX/PPTX, cài LibreOffice và đảm bảo lệnh `soffice`
chạy được trong terminal; nếu không, thiết lập `SOFFICE_PATH` trỏ tới
`soffice.exe`. PDF preview không cần LibreOffice.
Thiết lập `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` và `SMTP_FROM` để gửi OTP qua
email; development vẫn trả `debugOtp` khi SMTP chưa cấu hình.

## Routes

Tất cả API nghiệp vụ được mount dưới `/api/v1`:

- `/auth`, `/users`
- `/schools`, `/subjects`, `/documents`
- `/downloads`, `/favorites`, `/reports`
- `/subscriptions`, `/payments`, `/credits`

API sử dụng response thống nhất:

```json
{ "success": true, "data": {} }
```

```json
{ "success": false, "message": "Error description" }
```

## Commands

```powershell
npm run typecheck
npm run build
npm run db:generate
npm run db:studio
```

## Docker

Backend Docker image đã cài LibreOffice để tạo preview DOCX/PPTX.

```powershell
Copy-Item .env.docker.example .env
docker compose up --build
```

Chạy migration cho database trong compose:

```powershell
docker compose exec api npx prisma migrate deploy
```

Container API dùng `SOFFICE_PATH=/usr/bin/soffice` và kết nối Postgres qua
`DATABASE_URL=postgresql://postgres:postgres@postgres:5432/express_backend`.
Khi deploy production, cấu hình các biến bí mật (`JWT_*`, `CLOUDINARY_URL`,
SMTP, VNPAY) trong dashboard của nền tảng deploy thay vì commit `.env`.

OTP được trả trong trường `debugOtp` khi `NODE_ENV` không phải `production` để
phục vụ phát triển local. Refresh token logout/rotation hiện được revoke trong
bộ nhớ tiến trình do schema được cung cấp không có bảng lưu refresh token.

VNPAY mock: tạo payment với `method=VNPAY`, API sẽ trả `checkoutUrl` trỏ về
`/api/v1/payments/vnpay/return` (giả lập), sau đó gọi URL đó (kèm auth) để confirm.
