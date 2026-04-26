# Feature 01 — Authentication

## Overview
Email/password + OAuth authentication with session management via Auth.js v5. Protects all `/app/*` routes and includes a first-time onboarding flow.

---

## User Stories
- As a new user, I can register with email + password
- As a returning user, I can log in with email/password or GitHub/Google OAuth
- As a new user after first login, I go through an onboarding flow (topic selection, daily goal, avatar)
- As an unauthenticated user, I am redirected to `/login` when accessing protected routes

---

## Flow
```
/login → credentials / OAuth → session → redirect /dashboard
/register → email + password → auto-login → onboarding flow
```

---

## Onboarding (first-time only)
1. Choose first topic to learn (welcome screen)
2. Set daily learning goal (5 / 10 / 15 minutes)
3. Choose avatar/mascot

---

## Database Models

```prisma
model User {
  id            String    @id @default(cuid())
  email         String    @unique
  name          String?
  image         String?
  passwordHash  String?
  emailVerified DateTime?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  accounts      Account[]
  sessions      Session[]
  courses       Course[]
  progress      LessonProgress[]
  streakRecord  StreakRecord?
  gamification  UserGamification?
  questProgress DailyQuestProgress[]
  leagueEntry   LeagueEntry[]
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String?
  access_token      String?
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String?
  user              User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@unique([provider, providerAccountId])
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

---

## API Routes
```
POST /api/auth/register       # Email/password registration
POST /api/auth/[...nextauth]  # Auth.js handler (login, OAuth callbacks, signout)
```

---

## Key Files
```
app/(auth)/
  login/page.tsx
  register/page.tsx
  layout.tsx
app/middleware.ts              # Protect /app/* routes
lib/auth/
  config.ts                   # Auth.js config (providers, callbacks)
  password.ts                 # bcrypt hash/verify helpers
```

---

## Environment Variables
```bash
NEXTAUTH_SECRET=""            # openssl rand -base64 32
NEXTAUTH_URL="http://localhost:3000"

# OAuth (optional)
GITHUB_CLIENT_ID=""
GITHUB_CLIENT_SECRET=""
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
```

---

## Validation Rules
- Email: valid email format, unique in DB
- Password: min 8 characters, bcrypt hash stored (never plaintext)
- OAuth: provider tokens stored in Account model

---

## Security Constraints
- Passwords hashed with bcrypt (cost factor ≥ 12)
- Session tokens stored server-side (Auth.js session strategy)
- Middleware blocks all `/app/*` routes for unauthenticated users
- No password in API responses
