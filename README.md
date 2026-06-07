# LearnForge

> Nền tảng học tập tự host, mã nguồn mở — upload tài liệu bất kỳ, AI tự động tạo khóa học theo phong cách Duolingo.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-14-black)](https://nextjs.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-pgvector-blue)](https://github.com/pgvector/pgvector)

---

## Tính năng

- **Upload bất kỳ tài liệu nào** — PDF, DOCX, TXT, URL, video YouTube → AI tự động phân tích
- **Khóa học tự động** — AI sinh ra chương trình, bài học, bài tập từ tài liệu của bạn
- **6 loại bài tập** — trắc nghiệm, điền vào chỗ trống, ghép đôi, sắp xếp thứ tự, điền code, đúng/sai
- **Gamification kiểu Duolingo** — streak, hearts, XP, gems, daily quests, bảng xếp hạng
- **AI Companion** — chatbot RAG-grounded chỉ trả lời từ tài liệu của bạn
- **Mang API key riêng (BYOK)** — hỗ trợ Gemini, OpenAI, Groq, Cerebras, Ollama, và OpenAI-compatible
- **Failover tự động** — khi key hết quota, tự chuyển sang key dự phòng
- **Tự deploy** — chạy local với Docker hoặc deploy lên Vercel trong 1 lệnh

---

## Tech Stack

| Layer | Công nghệ |
|---|---|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS + shadcn/ui |
| Database | PostgreSQL + pgvector |
| ORM | Prisma |
| Auth | Auth.js v5 |
| AI / RAG | Vercel AI SDK + pgvector |
| Background jobs | pg-boss |
| File storage | Local (dev) / Vercel Blob (prod) |
| Deploy | Vercel + Neon |

---

## Quick Start

```bash
git clone https://github.com/your-username/learnforge.git
cd learnforge
npm install
cp .env.example .env.local
# Điền các biến trong .env.local (xem GETTING-API-KEYS.md)
docker compose up -d
npx prisma migrate dev
npm run dev
```

Mở trình duyệt vào `http://localhost:3000`

Chi tiết hơn: [docs/setup/QUICKSTART.md](docs/setup/QUICKSTART.md)

---

## Tài liệu

### Cho Developer

| File | Nội dung |
|---|---|
| [QUICKSTART.md](docs/setup/QUICKSTART.md) | Chạy local trong 15 phút |
| [WINDOWS-POWERSHELL-SETUP.md](docs/setup/WINDOWS-POWERSHELL-SETUP.md) | Hướng dẫn chi tiết cho Windows + PowerShell + Gemini |
| [GETTING-API-KEYS.md](docs/setup/GETTING-API-KEYS.md) | Lấy từng API key |
| [DEPLOY-VERCEL.md](docs/setup/DEPLOY-VERCEL.md) | Deploy lên production |
| [TROUBLESHOOTING.md](docs/setup/TROUBLESHOOTING.md) | Lỗi thường gặp + cách fix |

### Cho Admin

| File | Nội dung |
|---|---|
| [FIRST-RUN-SETUP.md](docs/admin/FIRST-RUN-SETUP.md) | Trở thành Super Admin lần đầu |
| [ADMIN-GUIDE.md](docs/admin/ADMIN-GUIDE.md) | Toàn bộ quyền hạn admin |
| [MANAGE-USERS.md](docs/admin/MANAGE-USERS.md) | Thêm/sửa/xóa/thăng cấp user |
| [MANAGE-KEYS.md](docs/admin/MANAGE-KEYS.md) | Quản lý API key pool |

### Cho End User

| File | Nội dung |
|---|---|
| [USER-GUIDE.md](docs/user/USER-GUIDE.md) | Hướng dẫn dùng app |
| [BYOK-GUIDE.md](docs/user/BYOK-GUIDE.md) | Thêm API key cá nhân |

---

## Tính năng theo lộ trình

| Chunk | Tính năng | Trạng thái |
|---|---|---|
| 1 | Authentication (email/password + OAuth) | Hoàn thành |
| 2 | Upload tài liệu + RAG pipeline | Hoàn thành |
| 3 | Curriculum + Exercise Engine (MVP) | Hoàn thành |
| 4 | Gamification đầy đủ (hearts, gems, shop, league) | Đang làm |
| 5 | Learning Map UI | Đang làm |
| 7 | AI Companion | Đang làm |
| 8 | Profile & Statistics | Đang làm |
| 10 | Multi-Key Manager + BYOK failover | Hoàn thành |

---

## Contributing

Mọi đóng góp đều được chào đón. Vui lòng mở issue trước khi submit PR lớn.

## License

MIT © LearnForge Contributors
