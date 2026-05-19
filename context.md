# Plateforme de Financement Collaboratif — Project Context

> **Purpose of this file**: A comprehensive, up-to-date reference for any AI assistant (Windsurf, Copilot, Cursor, etc.) to understand the architecture, business rules, and current state of this project without requiring a full codebase scan.

---

## 1. Project Overview

**Type**: Final Year Project (PFE) — Collaborative Crowdfunding Platform  
**Stack**: Node.js / Express (backend) + React / Vite (frontend) + MongoDB  
**Language**: French (UI labels, comments, error messages) — code identifiers in English  
**Status**: Feature-complete for demo/PFE presentation. No production deployment yet.

The platform allows:
- **Investors** to browse, fund, and track crowdfunding campaigns.
- **Creators** to submit projects through an AI-moderated approval pipeline.
- **Experts** in finance to validate AI risk analysis and provide consultations to significant investors.
- **Admins** to oversee the platform, manage users, payouts, reports, and perform final project publication.

---

## 2. Repository Structure

```
Plateforme_de_Financement_Collaboratif/
├── backend/          # Node.js / Express API server
├── frontend/         # React + Vite SPA
├── conception/       # UML diagrams (EA project + exported images)
├── rapport/          # PFE technical report documents
├── scripts/          # Utility / seed scripts
├── Crons.json        # n8n workflow cron config reference
├── crowdfunding.json # n8n workflow export
└── context.md        # ← This file
```

---

## 3. Backend

### 3.1 Entry Points

| File | Role |
|------|------|
| `backend/index.js` | Bootstrap: connects MongoDB, starts Express, optionally starts internal cron scheduler |
| `backend/app.js` | Express app setup: CORS, cookie-parser, rate limiting, route mounting |

**Start commands:**
```bash
cd backend
npm run dev     # nodemon index.js (development)
npm run start   # node index.js (production)
npm run worker:email  # BullMQ email worker (separate process)
```

### 3.2 Environment Variables (`.env`)

| Variable | Purpose |
|----------|---------|
| `PORT` | Server port (default: 3000) |
| `DATABASE` | MongoDB connection string |
| `FRONTEND_URL` | CORS allowed origin (default: http://localhost:5173) |
| `JWT_ACCESS_SECRET` | **Required** — signs access tokens (httpOnly cookie) |
| `JWT_REFRESH_SECRET` | Optional — separate secret for refresh tokens (falls back to access secret) |
| `INTERNAL_API_SECRET` | Bearer token protecting `/internal/*` routes (used by n8n / cron) |
| `REDIS_URL` | Redis connection for BullMQ queues (stub mode if empty) |
| `GEMINI_API_KEY` | Google Gemini API key (risk analysis + chatbot) |
| `CHAT_RATE_LIMIT_PER_HOUR` | Anti-spam limit for chatbot endpoint |
| `INTERNAL_CRON_ENABLED` | `true` to enable built-in scheduler fallback |
| `INTERNAL_CRON_INTERVAL_MIN` | Interval (minutes) for internal cron (default: 10) |
| `ENABLE_DB_TRANSACTIONS` | `false` (standalone MongoDB dev) / `true` (replica set) |
| `SMTP_*` | Gmail SMTP credentials for sending emails |
| `MAIL_FROM` | Sender name/email |
| `BANK_DETAILS_ENC_KEY` | AES-256-GCM key for encrypting payout bank details |

### 3.3 Route Architecture

Routes are split into two groups:

```
/api/*       → rate-limited (400 req/15 min), public + authenticated
/internal/*  → no rate limit, protected by INTERNAL_API_SECRET bearer token (for n8n/cron)
```

**API Routes** (`backend/routes/api/`):

| File | Prefix | Description |
|------|--------|-------------|
| `authRoutes.js` | `/api/auth` | Register, login, logout, verify email (OTP + link), resend verification, forgot/reset password, refresh token rotation |
| `userRoutes.js` | `/api/users` | Get/update own profile, delete account |
| `projectRoutes.js` | `/api/projects` | CRUD for projects, submit for AI review, comments, AI analysis report |
| `investmentRoutes.js` | `/api/investments` | Create investment, cancel, view own investments |
| `notificationRoutes.js` | `/api/notifications` | List + mark-read notifications |
| `payoutRoutes.js` | `/api/payouts` | Creator: submit bank details, view payout status |
| `reportRoutes.js` | `/api/reports` | User: report a project or comment |
| `recommendationRoutes.js` | `/api/recommendations` | AI-based project recommendations for logged-in user |
| `chatbotRoutes.js` | `/api/chatbot` | Per-project Gemini chatbot (Q&A about project) |
| `webhookRoutes.js` | `/api/webhooks` | Mock payment webhook receiver (simulates Flouci/Konnect) |
| `adminRoutes.js` | `/api/admin` | All admin operations (see section 3.6) |
| `expertRoutes.js` | `/api/expert` | Expert specific operations: AI review validation, consultations |

**Internal Routes** (`backend/routes/internal/`):

| File | Prefix | Description |
|------|--------|-------------|
| `workflowRoutes.js` | `/internal/workflow` | n8n workflow callbacks: trigger AI analysis, update AI result, process payments, refunds, cancellations, payouts |
| `cronRoutes.js` | `/internal/cron` | Cron job endpoints: retry stuck AI analyses, close funded projects |

### 3.4 MongoDB Models

| Model | Collection | Key Fields |
|-------|-----------|------------|
| `User` | `users` | email, passwordHash, role (USER\|ADMIN\|EXPERT), isActive, verifyCodeHash, resetTokenHash, refreshTokens[], profile {firstName, lastName, phone, riskPreference, preferredCategories} |
| `Project` | `projects` | title, description, category, fundingGoal, currentFunding, status, aiStatus, aiJobId, aiAnalysis {riskScore, riskLevel, successProbability, report}, creatorId, startAt, deadline, images[], documents[] |
| `Investment` | `investments` | investorId, projectId, amount, status (INITIATED\|CANCELLING\|CANCELLED\|SUCCESS\|FAILED\|REFUNDED), cancelReason, cancellationGracePeriodMinutes |
| `Transaction` | `transactions` | investmentId, provider (FLOUCI\|KONNECT\|D17), providerPaymentId, amount, status, refundStatus, mockOtpHash (mock 3DS) |
| `Payout` | `payouts` | projectId, creatorId, amount, status (PENDING\|READY\|PROCESSING\|COMPLETED\|CANCELLED\|FAILED), bankDetails (AES encrypted), providerTransferId |
| `Notification` | `notifications` | userId, type, message, isRead, relatedProject, relatedInvestment |
| `Comment` | `comments` | projectId, authorId, content, isDeleted, deletedBy, deletedReason |
| `Report` | `reports` | reporterId, targetType (PROJECT\|COMMENT), targetId, reason, status (PENDING\|RESOLVED\|DISMISSED) |
| `AuditLog` | `auditlogs` | action, performedBy, targetType, targetId, details, createdAt |
| `FailedCancellationEvent` | — | Dead-letter store for failed investment cancellation workflow steps |
| `FailedPayoutEvent` | — | Dead-letter store for failed payout workflow steps |
| `FailedRefundEvent` | — | Dead-letter store for failed refund workflow steps |
| `FailedWorkflowEvent` | — | Generic dead-letter store for n8n workflow failures |
| `ExpertConsultation` | `expertconsultations` | projectId, investorId, expertId, subject, status (OPEN\|IN_PROGRESS\|CLOSED), messages[] |

### 3.5 Project Lifecycle (State Machine)

The project goes through a strictly enforced FSM defined in `backend/config/projectLifecycle.js`:

```
DRAFT ──submit──► AWAITING_AI ──ai-complete──► UNDER_REVIEW ──approve──► APPROVED ──activate──► ACTIVE
  ▲                    │                            │                         │                    │
  │               ai-reject                    reject/re-ai              reject                  │
  │                    ▼                            ▼                                             ▼
REJECTED ◄──────────────────────────────────────────────────────────────────────────────── FUNDED
  │                                                                                              │
  └─► DRAFT (creator can re-edit & resubmit)                                              SUSPENDED
                                                                                               │
                                                                                        CLOSED (terminal)
```

**Status meanings:**
- `DRAFT` — created by creator, not yet submitted
- `AWAITING_AI` — submitted, waiting for Gemini risk analysis (async, via BullMQ or n8n)
- `UNDER_REVIEW` — AI analysis complete, **Expert** must validate or cancel (reject) the analysis
- `APPROVED` — Expert approved the analysis, waiting for admin to publish (or creator live date)
- `ACTIVE` — campaign is live, accepting investments
- `FUNDED` — funding goal reached (set by cron/workflow)
- `CLOSED` — terminal state (deadline passed or manually closed by admin)
- `REJECTED` — rejected by AI or admin (creator can revise and resubmit)
- `SUSPENDED` — moderation action on live campaign

**Business rules:**
- Funding goal: 10,000 TND minimum, 10,000,000 TND maximum
- Campaign must start at least **7 days** from submission date
- Campaign duration must be at least **30 days** (startAt → deadline)
- Creator cannot delete a project with status ACTIVE, FUNDED, CLOSED, or SUSPENDED
- Creator cannot delete a project with any funding (`currentFunding > 0`)

### 3.6 Admin Routes (`/api/admin`)

All require `ADMIN` role. Key endpoints:
- `GET /api/admin/projects` — paginated project list with filters
- `PATCH /api/admin/projects/:id/approve` — approve a project
- `PATCH /api/admin/projects/:id/reject` — reject a project with reason
- `POST /api/admin/projects/:id/retry-ai` — re-trigger AI analysis
- `GET/PATCH /api/admin/users` — list users, activate/deactivate, change role
- `GET/PATCH /api/admin/payouts` — manage payout approvals
- `GET/PATCH /api/admin/reports` — resolve/dismiss user reports
- `GET /api/admin/comments` — moderate comments
- `DELETE /api/admin/comments/:id` — soft-delete a comment
- `GET /api/admin/email-failures` — view failed email delivery events
- `POST /api/admin/ops/trigger-close-funded` — manually trigger funded-project closing
- `POST /api/admin/ops/trigger-retry-ai` — manually retry stuck AI analyses

### 3.7 Services Layer (`backend/services/`)

| Service | Responsibility |
|---------|---------------|
| `authService.js` | Registration, login, OTP + link email verification, password reset, JWT access/refresh token management, logout, token rotation |
| `projectService.js` | Project CRUD, submit for review, AI analysis triggering, comments |
| `investmentService.js` | Investment creation, cancellation flow (grace period), payment webhook handling, refund logic |
| `payoutService.js` | Payout creation on project funding, bank details submission (AES encrypted), admin approval, mock transfer |
| `adminProjectService.js` | Admin-specific project operations: approve, reject, retry AI, suspend, list |
| `adminUserService.js` | Admin user management |
| `adminOpsService.js` | Admin operational triggers (batch jobs) |
| `cronService.js` | Scheduled tasks: retry stuck AI analyses, auto-close funded projects past deadline |
| `investmentCronService.js` | Investment-specific cron: process pending cancellations past grace period |
| `sessionCronService.js` | Cleanup expired refresh tokens |
| `geminiRiskService.js` | Calls Gemini API to generate project risk analysis report |
| `geminiChatService.js` | Calls Gemini API for project-specific chatbot responses |
| `riskHeuristicService.js` | Heuristic pre-checks on project data before/after AI analysis |
| `recommendationService.js` | Recommends projects based on user's `riskPreference` and `preferredCategories` |
| `notificationService.js` | Creates in-app notifications for users |
| `reportService.js` | Handles user-submitted project/comment reports |
| `accountService.js` | User profile management, account deletion (soft-delete with cascade) |
| `auditService.js` | Writes audit log entries for sensitive admin actions |
| `expertService.js` | Expert logic: list reviewable projects, approve/reject analysis, check consultation eligibility (25% threshold), manage consultations |
| `workflowInternalService.js` | Internal handler for n8n workflow step callbacks |
| `webSearchService.js` | Optional web search integration for enriched AI analysis (currently disabled) |

### 3.8 Integrations & Queues (`backend/integrations/`)

| File | Role |
|------|------|
| `emailQueue.js` | BullMQ queue for async email sending (falls back to stub if Redis is unavailable) |
| `riskAnalysisQueue.js` | BullMQ queue for triggering AI risk analysis jobs |
| `mockPaymentProvider.js` | Simulates Flouci/Konnect payment API (returns mock payment URL + OTP) |
| `mockPayoutProvider.js` | Simulates payout transfer API (returns mock transfer ID) |

**Email Worker** (`backend/workers/emailWorker.js`): Separate process consuming the email BullMQ queue. Run with `npm run worker:email`.

### 3.9 Middleware

| Middleware | Purpose |
|-----------|---------|
| `auth.js` | Verifies JWT access token from httpOnly cookie; sets `req.user` |
| `requireAdmin.js` | Guards routes to `ADMIN` role only |
| `requireExpert.js` | Guards routes to `EXPERT` and `ADMIN` roles |
| `requireNotAdmin.js` | Guards routes to non-admin users |
| `requireInternalBearer.js` | Validates `Authorization: Bearer <INTERNAL_API_SECRET>` for `/internal/*` |
| `asyncHandler.js` | Wraps async route handlers to forward errors to `errorHandler` |
| `errorHandler.js` | Global Express error handler; formats error responses consistently |
| `uploadfile.js` | Multer config for file uploads (project images/documents) |

### 3.10 Internal Cron / n8n Integration

The platform supports **two parallel scheduling strategies** (can be used together):

1. **n8n (preferred for production)**: External workflow automation calling `/internal/workflow/*` and `/internal/cron/*` endpoints. The `crowdfunding.json` file is the n8n workflow export.
2. **Internal cron (dev fallback)**: Built-in `setInterval` scheduler in `index.js`, enabled via `INTERNAL_CRON_ENABLED=true`. Retries stuck AI analyses and closes funded projects.

---

## 4. Frontend

### 4.1 Tech Stack

- **Framework**: React 19 + Vite 8
- **Routing**: React Router DOM v7
- **UI**: Bootstrap 5 + FontAwesome 7 (vanilla CSS custom styles in `App.css` / `index.css`)
- **HTTP**: Axios (with credential support for cookie auth)
- **State**: React Context (`AuthContext`) — no Redux/Zustand

**Start command:**
```bash
cd frontend
npm run dev     # Vite dev server on http://localhost:5173
```

### 4.2 Page Map

| Route | Page Component | Access |
|-------|---------------|--------|
| `/` | `Home.jsx` | Public |
| `/projects` | `BrowseProjects.jsx` | Public |
| `/projects/:id` | `ProjectDetail.jsx` | Public (active projects) |
| `/login` | `Login.jsx` | Guest only |
| `/register` | `Register.jsx` | Guest only |
| `/verify-email` | `VerifyEmail.jsx` | Public |
| `/forgot-password` | `ForgotPassword.jsx` | Public |
| `/reset-password` | `ResetPassword.jsx` | Public |
| `/resend-verification` | `ResendVerification.jsx` | Public |
| `/dashboard` | `Dashboard.jsx` | Authenticated |
| `/notifications` | `Notifications.jsx` | Authenticated |
| `/investments` | `MyInvestments.jsx` | Authenticated |
| `/payouts` | `MyPayouts.jsx` | Authenticated |
| `/payouts/:id` | `PayoutDetail.jsx` | Authenticated |
| `/reports` | `MyReports.jsx` | Authenticated |
| `/recommendations` | `Recommendations.jsx` | Authenticated |
| `/profile` | `Profile.jsx` | Authenticated |
| `/projects/new` | `ProjectNew.jsx` | Authenticated |
| `/projects/:id/edit` | `ProjectEdit.jsx` | Authenticated (creator only) |
| `/mock-checkout` | `MockPaymentProviderPage.jsx` | Authenticated |
| `/admin/projects` | `AdminProjects.jsx` | Admin only |
| `/admin/comments` | `AdminComments.jsx` | Admin only |
| `/admin/users` | `AdminUsers.jsx` | Admin only |
| `/admin/reports` | `AdminReports.jsx` | Admin only |
| `/admin/payouts` | `AdminPayouts.jsx` | Admin only |
| `/admin/ops` | `AdminOps.jsx` | Admin only |
| `/admin/email-failures` | `AdminEmailFailures.jsx` | Admin only |
| `/mock-payout-transfer` | `MockPayoutTransfer.jsx` | Admin only |
| `/expert/projects` | `ExpertProjects.jsx` | Expert only |
| `/expert/projects/:id/review` | `ExpertProjectReview.jsx` | Expert only |
| `/expert/consultations` | `ExpertConsultations.jsx` | Expert & Investor |
| `/expert/consultations/:id` | `ExpertConsultations.jsx` | Expert & Investor |

### 4.3 Route Guards

| Component | Behavior |
|-----------|---------|
| `ProtectedRoute.jsx` | Redirects to `/login` if not authenticated |
| `AdminRoute.jsx` | Redirects to `/dashboard` if not admin |
| `GuestRoute.jsx` | Redirects to `/dashboard` if already logged in |

### 4.4 API Layer (`frontend/src/api/`)

Each file corresponds to a backend domain:

| File | Calls |
|------|-------|
| `client.js` | Axios instance (baseURL: `/api`, withCredentials: true) |
| `paths.js` | Centralized API URL constants |
| `auth.js` | login, register, logout, verifyEmail, resendVerification, forgotPassword, resetPassword, refreshToken |
| `projects.js` | getProjects, getProject, createProject, updateProject, deleteProject, submitForReview, addComment |
| `investments.js` | createInvestment, cancelInvestment, getMyInvestments |
| `payouts.js` | getMyPayouts, getPayoutDetail, submitBankDetails |
| `reports.js` | createReport, getMyReports |
| `notifications.js` | getNotifications, markAsRead |
| `users.js` | getProfile, updateProfile, deleteAccount |
| `admin.js` | All admin API calls |
| `chatbot.js` | sendChatMessage |
| `recommendations.js` | getRecommendations |
| `expert.js` | AI review validation, consultation management |

### 4.5 Auth Flow

- Access token stored as **httpOnly cookie** (`access_token`)
- Refresh token stored as **httpOnly cookie** (`refresh_token`)
- `AuthContext` holds the current user object (fetched on app load via `/api/auth/me`)
- Token rotation: refresh tokens are rotated on each use; max 5 concurrent refresh tokens per user
- Email verification: dual mechanism — **6-digit OTP** (primary) + **magic link** (fallback)

### 4.6 Key UI Components

| Component | Role |
|-----------|------|
| `Layout.jsx` | App shell: navbar, sidebar, footer, notification badge |
| `ProjectCard.jsx` | Compact project card for browse/list views |
| `ProjectPreviewCard.jsx` | Lighter card for recommendations |
| `Alert.jsx` | Reusable alert/toast component |
| `Stepper.jsx` | Multi-step form progress indicator (used in ProjectNew) |
| `PageLoader.jsx` | Full-page loading spinner |
| `EmptyState.jsx` | Empty list placeholder |
| `PageHeader.jsx` | Consistent page title header |

---

## 5. Payment Flow (Simulated)

Since this is a PFE demo, payment providers (Flouci, Konnect, D17) are **mocked**:

1. Investor clicks "Invest" on a project → `POST /api/investments` creates an `Investment` (status: `INITIATED`) and a mock payment URL
2. Frontend redirects to `/mock-checkout` which simulates the payment page
3. User enters mock OTP (3DS simulation) → webhook fires to `/api/webhooks/payment`
4. Backend confirms payment → Investment status → `SUCCESS`, `project.currentFunding` incremented
5. If `currentFunding >= fundingGoal` → project transitions to `FUNDED`, a `Payout` record is created

**Cancellation grace period**: Investor has `cancellationGracePeriodMinutes` (default 5 min) to cancel after initiating. After that, investment status moves to `CANCELLING`, processed by cron.

---

## 6. Payout Flow

1. When project reaches `FUNDED` → a `Payout` record is created (status: `PENDING`)
2. Creator submits bank details → payout moves to `READY`
3. Admin reviews and triggers transfer → payout moves to `PROCESSING`
4. Mock transfer completes → payout moves to `COMPLETED`
5. Bank details are stored **AES-256-GCM encrypted** (`BANK_DETAILS_ENC_KEY`)

---

## 7. AI Risk Analysis

Powered by **Google Gemini** (`gemini-2.0-flash` or similar):

1. Creator submits project → `aiStatus: PENDING`, project moves to `AWAITING_AI`
2. BullMQ/n8n picks up the job and calls `/internal/workflow/start-ai-analysis`
3. `geminiRiskService.js` sends project data to Gemini → returns:
   - `riskScore` (0–100)
   - `riskLevel` (LOW / MEDIUM / HIGH)
   - `successProbability` (0–100)
   - `report.summary`, `report.advantages[]`, `report.disadvantages[]`, `report.improvements[]`, `report.removals[]`, `report.questionsToClarify[]`
4. `riskHeuristicService.js` applies rule-based pre/post checks
5. Result stored in `project.aiAnalysis`, `aiStatus → COMPLETED`, project → `UNDER_REVIEW`
6. If Gemini quota exhausted: `aiStatus → FAILED`, internal cron retries after cooldown

**Chatbot**: Each project detail page has a Gemini-powered chatbot. Users can ask questions about the project, capped at `CHAT_RATE_LIMIT_PER_HOUR` questions/hour.

**Recommendations**: `recommendationService.js` filters active projects matching user's `riskPreference` and `preferredCategories`.

---

## 8. Notification System

- In-app notifications stored in `Notification` collection
- Triggered on: investment success/failure/refund, project status changes, payout updates, admin decisions
- Email notifications sent via nodemailer through BullMQ email queue (SMTP: Gmail)
- `emailNotificationPolicy.js` controls which events trigger emails vs. in-app only

---

## 9. Conception & UML

The `conception/` folder contains the full design documentation:

```
conception/
├── plateforme_de_financement_collaboratif.eapx  ← Enterprise Architect project file
├── usecase_diagram/          ← Use case diagrams
├── calss_diagram/            ← Class diagrams
├── sequence_diagram/         ← Sequence diagrams
├── collaboration_diagram/    ← Collaboration/communication diagrams
├── class_per_usecase_diagram/← Per-use-case class diagrams
├── diagramme_paquetage/      ← Package/module diagrams
└── mongo_db/                 ← MongoDB schema design docs
```

---

## 10. Known Patterns & Conventions

1. **Error handling**: All routes use `asyncHandler` wrapper. Errors are instances of `HttpError` (custom class in `utils/HttpError.js`) with HTTP status codes.
2. **Validation**: Input validated using **Zod** schemas in `backend/validators/` before hitting service layer.
3. **No MongoDB transactions in dev**: `ENABLE_DB_TRANSACTIONS=false` by default (requires replica set). Use `true` only in production-like environments.
4. **French comments**: Code comments and error messages are in French; variable/function names in English.
5. **Dead-letter collections**: Failed workflow events (payment, refund, cancellation, payout) are stored in separate MongoDB collections for admin review/retry.
6. **Soft deletes**: Users are soft-deleted (`deletedAt`). Projects created by deleted users have `isCreatorDeleted: true`.
7. **AuditLog**: Admin actions (approve, reject, delete user, etc.) are logged in `AuditLog` collection.
8. **Rate limit**: `/api/*` is globally rate-limited. `/internal/*` is NOT rate-limited but requires bearer token auth.

---

## 11. Development Setup

### Backend
```bash
cd backend
# 1. Copy .env and fill in values (MongoDB, JWT secrets, Gemini API key)
# 2. Ensure MongoDB is running on localhost:27017
# 3. Optionally: Redis on localhost:6380 for BullMQ queues
npm install
npm run dev
# (optional) In a separate terminal:
npm run worker:email
```

### Frontend
```bash
cd frontend
npm install
npm run dev
# App runs at http://localhost:5173
# Vite proxies /api → http://localhost:3000 (configured in vite.config.js)
```

### Quick Ports Reference
| Service | Port |
|---------|------|
| Backend (Express) | 3000 |
| Frontend (Vite) | 5173 |
| MongoDB | 27017 |
| Redis | 6380 |

---

## 12. What's NOT Implemented / Out of Scope

- Real payment provider integration (Flouci, Konnect, D17 are mocked)
- Real payout/bank transfer (mocked with `MockPayoutTransfer.jsx`)
- Mobile app
- Real-time WebSocket notifications (polling-based currently)
- Full test suite (no unit/integration tests written)
- CI/CD pipeline
- Production deployment / Docker setup
- Web search for AI analysis is disabled (API keys commented out in `.env`)
