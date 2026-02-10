# Phase 1.0 Implementation Plan — CRUD API for Users & Families

**Created:** 2026-02-10
**Owner:** Product Manager
**Status:** Ready for Implementation
**Duration Estimate:** 3 weeks (Sprint 1-2)
**Scope:** Backend Core — Auth, Family Profile, Preferences (FR-100..FR-122, US-001..US-007)

---

## 1. Objectives

Phase 1.0 delivers the foundational backend APIs required for:
- User registration and authentication (email + password)
- Family profile creation and management
- Family member management (adults/children/infants)
- Dietary restrictions (allergies, intolerances, lifestyle)
- Medical restrictions (diabetes, cholesterol, hypertension)
- Family preferences (cuisine types, excluded ingredients, budget)

**Definition of Done:**
- ✅ All endpoints working with 200/201/400/401/404/500 responses per tech spec section 7
- ✅ API contracts match technical-specification.md exactly
- ✅ Vitest tests for all endpoints (happy path + error cases)
- ✅ Prisma Client used for all DB operations
- ✅ Zod validation on all request bodies
- ✅ JWT auth middleware protecting family/preference endpoints
- ✅ OpenAPI/Swagger docs auto-generated

---

## 2. Endpoints to Implement

### 2.1 Auth Module (AUTH-01, AUTH-02, AUTH-03)

| Method | Endpoint         | Request Body                                       | Response                                      | Priority | Story Points |
| ------ | ---------------- | -------------------------------------------------- | --------------------------------------------- | -------- | ------------ |
| POST   | /auth/register   | `{ email, password }`                              | 201: `{ user, access_token, refresh_token }`  | P0       | 3            |
| POST   | /auth/login      | `{ email, password }`                              | 200: `{ user, access_token, refresh_token }`  | P0       | 2            |
| POST   | /auth/refresh    | `{ refresh_token }`                                | 200: `{ access_token, refresh_token }`        | P0       | 2            |
| POST   | /auth/logout     | Header: `Authorization: Bearer <token>`            | 204: No content                               | P1       | 1            |
| **Total AUTH**   |                  |                                                    |                                               |          | **8 SP**     |

**Implementation Notes:**
- Use bcrypt for password hashing (cost factor 10)
- JWT access token: 15 min expiry, includes `{ userId, email }`
- JWT refresh token: 7 days expiry, store hash in `RefreshToken` model (needs to be added to Prisma schema)
- Validation: email format (Zod), password min 8 chars, 1 uppercase, 1 number

**Error Codes (per tech spec section 7.5):**
- `AUTH_INVALID_CREDENTIALS` — login with wrong password
- `AUTH_EMAIL_EXISTS` — registration with existing email
- `AUTH_INVALID_TOKEN` — expired/malformed JWT
- `AUTH_REFRESH_TOKEN_INVALID` — expired/revoked refresh token

---

### 2.2 Family Module (FAM-01, FAM-02, FAM-08, FAM-09)

| Method | Endpoint              | Request Body                                                                     | Response                    | Priority | Story Points |
| ------ | --------------------- | -------------------------------------------------------------------------------- | --------------------------- | -------- | ------------ |
| POST   | /family               | `{ name, weekly_budget?, meals_per_day?, preferred_store_id? }`                  | 201: `{ family }`           | P0       | 3            |
| GET    | /family               | (auth header)                                                                    | 200: `{ family + members }` | P0       | 2            |
| PATCH  | /family               | `{ name?, weekly_budget?, meals_per_day?, preferred_store_id? }`                 | 200: `{ family }`           | P0       | 2            |
| POST   | /family/members       | `{ name, age, role }`                                                            | 201: `{ member }`           | P0       | 3            |
| PATCH  | /family/members/:id   | `{ name?, age?, role? }`                                                         | 200: `{ member }`           | P0       | 2            |
| DELETE | /family/members/:id   | (auth header)                                                                    | 204: No content             | P0       | 1            |
| **Total FAMILY** |                       |                                                                                  |                             |          | **13 SP**    |

**Implementation Notes:**
- `POST /family` — one family per user (check `userId` uniqueness via Prisma @unique constraint)
- `GET /family` — include `members[]`, `preferences[]`, `restrictions[]` (Prisma relations)
- `meals_per_day` — default 3, allowed values: 2 or 3 (Zod enum)
- `weekly_budget` — Decimal(8,2), optional
- `preferred_store_id` — FK to Store table (nullable)

**Error Codes:**
- `FAMILY_ALREADY_EXISTS` — user tries to create second family
- `FAMILY_NOT_FOUND` — GET/PATCH when user has no family
- `FAMILY_MEMBER_NOT_FOUND` — PATCH/DELETE non-existent member
- `FAMILY_MEMBER_LIMIT_EXCEEDED` — max 10 members (business rule)

---

### 2.3 Restrictions Module (FAM-03, FAM-04)

| Method | Endpoint                                        | Request Body                                    | Response                      | Priority | Story Points |
| ------ | ----------------------------------------------- | ----------------------------------------------- | ----------------------------- | -------- | ------------ |
| POST   | /family/members/:memberId/dietary-restrictions  | `{ type, value, severity }`                     | 201: `{ restriction }`        | P0       | 3            |
| DELETE | /family/members/:memberId/dietary-restrictions/:id | (auth header)                                   | 204: No content               | P0       | 1            |
| POST   | /family/members/:memberId/medical-restrictions  | `{ condition, notes? }`                         | 201: `{ restriction }`        | P0       | 2            |
| DELETE | /family/members/:memberId/medical-restrictions/:id | (auth header)                                   | 204: No content               | P0       | 1            |
| **Total RESTRICTIONS** |                                                 |                                                 |                               |          | **7 SP**     |

**Implementation Notes:**
- `type` — enum: ALLERGY, INTOLERANCE, LIFESTYLE (Zod validation)
- `value` — predefined list: gluten, lactose, nuts, seafood, eggs, soy, vegan, vegetarian, pescatarian, etc.
- `severity` — enum: STRICT, MODERATE, MILD
- `condition` — predefined list: diabetes_type2, high_cholesterol, hypertension, celiac, etc.
- Cascade delete when member is deleted (Prisma onDelete: Cascade)

**Error Codes:**
- `RESTRICTION_MEMBER_NOT_FOUND` — POST/DELETE for non-existent member
- `RESTRICTION_DUPLICATE` — same type+value already exists for member

---

### 2.4 Preferences Module (FAM-05, FAM-06, FAM-07)

| Method | Endpoint                    | Request Body                          | Response                  | Priority | Story Points |
| ------ | --------------------------- | ------------------------------------- | ------------------------- | -------- | ------------ |
| POST   | /family/preferences         | `{ type, value }`                     | 201: `{ preference }`     | P1       | 2            |
| GET    | /family/preferences         | (auth header)                         | 200: `{ preferences[] }`  | P1       | 1            |
| DELETE | /family/preferences/:id     | (auth header)                         | 204: No content           | P1       | 1            |
| **Total PREFERENCES** |                             |                                       |                           |          | **4 SP**     |

**Implementation Notes:**
- `type` — enum: CUISINE, EXCLUDED_INGREDIENT, FAVORITE_RECIPE
- `value` — free text (max 255 chars)
- Multiple preferences of same type allowed (e.g., multiple cuisines)
- RESOLVED: `calorieTargetPerPerson Int?` добавлено как поле на Family модель (не enum)

**Error Codes:**
- `PREFERENCE_FAMILY_NOT_FOUND` — user has no family
- `PREFERENCE_NOT_FOUND` — DELETE non-existent preference

---

## 3. Prisma Schema Changes Required

### 3.1 Add RefreshToken Model
```prisma
model RefreshToken {
  id        String   @id @default(uuid())
  userId    String   @map("user_id")
  tokenHash String   @map("token_hash") @db.VarChar(255)
  expiresAt DateTime @map("expires_at")
  createdAt DateTime @default(now()) @map("created_at")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([tokenHash])
  @@map("refresh_tokens")
}
```

Add to User model:
```prisma
model User {
  // ... existing fields
  refreshTokens RefreshToken[]
}
```

### 3.2 Add Missing Indexes (per M-02)
```prisma
model Family {
  // ... existing fields
  @@index([userId])
}

model FamilyMember {
  // ... existing fields
  @@index([familyId])
}

model DietaryRestriction {
  // ... existing fields
  @@index([memberId])
  @@unique([memberId, type, value]) // prevent duplicates
}

model MedicalRestriction {
  // ... existing fields
  @@index([memberId])
}

model Preference {
  // ... existing fields
  @@index([familyId, type])
}
```

### 3.3 Add updatedAt Fields (per M-03)
```prisma
model Family {
  // ... existing fields
  updatedAt DateTime @updatedAt @map("updated_at")
}

model FamilyMember {
  // ... existing fields
  updatedAt DateTime @updatedAt @map("updated_at")
}

model DietaryRestriction {
  // ... existing fields
  createdAt DateTime @default(now()) @map("created_at")
}

model MedicalRestriction {
  // ... existing fields
  createdAt DateTime @default(now()) @map("created_at")
}

model Preference {
  // ... existing fields
  createdAt DateTime @default(now()) @map("created_at")
}
```

---

## 4. Implementation Order

**Week 1 — Auth + Family Core (Sprint 1)**
1. Day 1: Prisma schema updates (RefreshToken model, indexes, updatedAt)
2. Day 1-2: Auth endpoints (register, login, refresh) + tests
3. Day 3: JWT middleware + error handling
4. Day 3-4: Family CRUD (POST, GET, PATCH) + tests
5. Day 5: Family members CRUD + tests

**Week 2 — Restrictions + Preferences (Sprint 1)**
6. Day 1-2: Dietary restrictions endpoints + tests
7. Day 2-3: Medical restrictions endpoints + tests
8. Day 3-4: Preferences endpoints + tests
9. Day 5: Integration tests (full user flow: register → create family → add members → add restrictions)

**Week 3 — Polish + Docs (Sprint 2)**
10. Day 1: OpenAPI/Swagger docs generation (@fastify/swagger)
11. Day 2: Error handling audit (ensure all error codes from tech spec are implemented)
12. Day 3: Performance testing (100 concurrent requests to /family endpoint)
13. Day 4: Security audit (SQL injection, XSS, CSRF checks)
14. Day 5: Code review + bug fixes

---

## 5. Testing Requirements

### 5.1 Unit Tests (Vitest)
- All service functions (bcrypt hashing, JWT generation/validation, Prisma queries)
- Input validation (Zod schemas)
- Error cases (invalid email, duplicate family, etc.)

### 5.2 Integration Tests
- Full API endpoints with Fastify inject
- Database state verification (Prisma queries)
- Cascade deletes (delete member → restrictions also deleted)

### 5.3 E2E Tests
- Happy path: register → login → create family → add 2 members → add restrictions → add preferences → GET family (verify all data)
- Error path: register with existing email → 400
- Error path: create family twice → 400

**Test Coverage Target:** > 80% (per NFR-060 from tech spec)

---

## 6. API Documentation

Use `@fastify/swagger` + `@fastify/swagger-ui`:
- Auto-generate OpenAPI 3.0 spec from Zod schemas
- Swagger UI available at `/docs`
- Export OpenAPI JSON for frontend code generation

---

## 7. Risks & Mitigation

| Risk                                      | Impact | Mitigation                                                     |
| ----------------------------------------- | ------ | -------------------------------------------------------------- |
| **Auth module complexity**                | High   | Use existing library (Passport.js or similar) OR keep simple (bcrypt + JWT) |
| **Calorie target storage decision**       | Medium | PM decision required before Preferences implementation (Day 8)  |
| **Missing Store model seed data**         | Low    | Hardcode 1-2 S-Market stores for MVP, full catalog in Phase 3   |
| **Prisma migration issues**               | Medium | Test migrations on staging Neon branch before production        |
| **JWT secret management**                 | High   | Store in env var, rotate every 90 days, never commit to repo    |

---

## 8. Open Questions for PM Decision

### Q1: Calorie Target Storage
**Context:** Tech spec API accepts `calorie_target_per_person`, but Prisma schema has no field for it.

**Options:**
1. Add `CALORIE_TARGET` to PreferenceType enum → store as Preference with value="2000"
2. Add `calorieTargetPerPerson Int?` field to Family model → simpler, type-safe

**Recommendation:** Option 2 (field on Family model) — simpler to query, no parsing needed.

**Decision:** Option 2 — поле `calorieTargetPerPerson Int?` на модели Family. Проще, type-safe, легко запрашивать.

---

### Q2: Rate Limiting Strategy
**Context:** NFR-023 requires rate limiting (100 req/min auth, 20 req/min anon).

**Options:**
1. Use `@fastify/rate-limit` plugin (simple, in-memory)
2. Use Redis-based rate limiting (scalable, distributed)

**Recommendation:** Option 1 for MVP (simpler), migrate to Option 2 for Early Growth.

**Decision:** Option 1 — `@fastify/rate-limit` (in-memory) для MVP.

---

### Q3: MVP Scope Reduction
**Context:** Feature backlog has 227 SP for MVP → 12 weeks, but project plan says 14-16 weeks total.

**Recommendation:** Move these to P1 (post-MVP):
- FAM-10 (skip onboarding quick-setup) — conflicts with value prop per PM review
- MENU-06 (lock meals) — nice-to-have
- SHOP-12, SHOP-13 (promotions, replacements) — can add after MVP validation
- EXT-09, EXT-10 (fallback search, manual add) — can add after MVP validation

**Revised MVP:** Core flow only (регистрация → меню → список → заказ) + FAM-10 (skip onboarding). Scope significantly reduced — see updated feature-backlog.md.

**Decision:** Сокращение до core flow + FAM-10. Все не-core stories → P1/P2.

---

## 9. Success Metrics

| Metric                      | Target         | How to Measure                    |
| --------------------------- | -------------- | --------------------------------- |
| API endpoints implemented   | 100% (20/20)   | Manual checklist                  |
| Test coverage               | > 80%          | Vitest coverage report            |
| API response time p95       | < 500ms        | Load testing (Artillery/k6)       |
| Error rate                  | < 1%           | Logging (Pino) + Sentry           |
| OpenAPI spec completeness   | 100%           | All endpoints documented in Swagger|

---

## 10. Next Steps (After Phase 1.0)

**Phase 1.1 — Recipe CRUD (1 week)**
- POST/GET/PATCH/DELETE /recipes
- Recipe ingredients relation
- Recipe search (PostgreSQL FTS)

**Phase 2.0 — AI Menu Generation (2.5 weeks)**
- OpenAI integration
- Prompt engineering
- Menu validation
- Fallback menus

**Phase 3.0 — Product Catalog & Shopping List (2 weeks)**
- Product catalog import
- Ingredient → Product mapping
- Shopping list consolidation API

---

**END OF PHASE 1.0 PLAN**

_This plan should be reviewed with the team before Sprint 1 starts._
_Estimated completion: 3 weeks from Phase 1.0 kickoff._
