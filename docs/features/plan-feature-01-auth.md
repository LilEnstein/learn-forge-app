# Plan — Feature 01: Authentication

## Prerequisites
- Next.js 14 project initialized with App Router
- `prisma/schema.prisma` with User, Account, Session models
- Dependencies: `next-auth@5`, `bcryptjs`, `@prisma/client`, `zod`

---

## Implementation Steps

### Step 1 — Prisma schema & migration
- [ ] Add User, Account, Session models to `prisma/schema.prisma`
- [ ] Run `npx prisma migrate dev --name init-auth`
- [ ] Verify tables created in DB

### Step 2 — Auth.js configuration
- [ ] Create `lib/auth/config.ts`
  - Configure `CredentialsProvider` (email + password with bcrypt verify)
  - Configure `GitHubProvider` (env: GITHUB_CLIENT_ID/SECRET)
  - Configure `GoogleProvider` (env: GOOGLE_CLIENT_ID/SECRET)
  - Set `adapter: PrismaAdapter(prisma)`
  - Set `session: { strategy: "jwt" }` or database sessions
- [ ] Create `app/api/auth/[...nextauth]/route.ts` — export `{ GET, POST }` from Auth.js handler

### Step 3 — Registration endpoint
- [ ] Create `app/api/auth/register/route.ts`
  - Parse body with Zod: `{ email, password, name? }`
  - Check email uniqueness
  - Hash password with `bcryptjs` (rounds: 12)
  - `prisma.user.create(...)`
  - Return `201` with user id (no password)

### Step 4 — Password utilities
- [ ] Create `lib/auth/password.ts`
  - `hashPassword(plain: string): Promise<string>`
  - `verifyPassword(plain: string, hash: string): Promise<boolean>`

### Step 5 — Route protection middleware
- [ ] Create `middleware.ts` at project root
  - Use Auth.js `auth()` middleware
  - Match pattern: `/(app)/:path*`
  - Redirect unauthenticated → `/login`

### Step 6 — Auth pages UI
- [ ] `app/(auth)/layout.tsx` — centered card layout, no sidebar
- [ ] `app/(auth)/login/page.tsx`
  - Email + password form (React Hook Form + Zod)
  - "Sign in with GitHub" / "Sign in with Google" buttons
  - Link to `/register`
  - Call `signIn("credentials", ...)` or `signIn("github")` / `signIn("google")`
- [ ] `app/(auth)/register/page.tsx`
  - Name, email, password fields
  - POST to `/api/auth/register`, then `signIn`

### Step 7 — Onboarding flow
- [ ] `app/(app)/onboarding/page.tsx`
  - Step 1: Select first topic (cards with topic options)
  - Step 2: Daily goal selector (5 / 10 / 15 min)
  - Step 3: Avatar/mascot picker
  - On complete: store preferences, redirect to `/dashboard`
- [ ] After first login detect `user.createdAt` ≈ now → redirect to `/onboarding`

### Step 8 — Session access in app
- [ ] `lib/auth/session.ts` — `getSession()` server helper wrapping Auth.js `auth()`
- [ ] Expose user data in layout via `auth()` in `app/(app)/layout.tsx`

---

## Acceptance Criteria
- [ ] User can register with email/password → receives session → lands on onboarding
- [ ] User can log in with email/password → lands on dashboard
- [ ] OAuth flows (GitHub, Google) complete without error
- [ ] Navigating to any `/app/*` route without session → redirect to `/login`
- [ ] Passwords never appear in API responses or logs
- [ ] Duplicate email registration returns a clear error message

---

## Dependencies to Install
```bash
npm install next-auth@beta @auth/prisma-adapter bcryptjs
npm install -D @types/bcryptjs
```
