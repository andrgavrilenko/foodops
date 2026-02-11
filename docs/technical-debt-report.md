# Technical Debt Report — FoodOps

**Date:** 2026-02-10
**Auditor:** Product Manager (technical debt audit, revision 2)
**Scope:** Fastify v5 + Prisma + TypeScript monorepo, ~33 endpoints, ~94 tests, Phases 0-2 complete
**Codebase snapshot:** commit `89013d5` (main branch)
**Files reviewed:** 50+ files across `apps/api/src/`, `packages/db/`, `.github/`, root config

---

## Executive Summary

**Health Score: 7/10** — Solid foundation for an MVP. Code is consistent, well-structured, and reasonably tested. However, several security items and architectural patterns need attention before Phase 3 adds external data ingestion (S-Market catalog parser), which introduces new attack surface and performance demands.

**Top Risk:** JWT uses a single shared secret for both access and refresh tokens with no token revocation check on access tokens. Combined with the in-memory rate limiter (lost on restart/multi-instance), this creates a security gap that compounds as the user base grows.

**Sprint Allocation Recommendation:**

- Dedicate **20% of Phase 3 sprint capacity** (roughly 1 week) to Critical + High items
- Schedule Medium items as part of Phase 4 frontend work
- Low items can be tracked in backlog without dedicated allocation

---

## Critical (fix before Phase 3)

### TD-001 | Security

**Same JWT secret for access and refresh tokens**

- **Where:** `apps/api/src/plugins/auth.ts:32-42`
- **Description:** Both `accessSigner` and `refreshSigner` use the same `JWT_SECRET`. A single `verifier` instance (line 42) validates both token types. The only distinguishing factor is the `type` field inside the payload. If an attacker obtains any token, they can replay it against the other verification path (the `type` check is the sole guard).
- **Impact:** Token confusion attacks. A single key compromise exposes both token types. A leaked access token (shorter-lived but more exposed) reveals the key used to forge refresh tokens.
- **Fix:** Use separate secrets (`JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`) with separate signer/verifier instances. Update `config.ts` env schema accordingly.
- **Effort:** S (1-2h)

### TD-002 | Security

**No access token revocation mechanism**

- **Where:** `apps/api/src/plugins/auth.ts:83-90`, `apps/api/src/services/auth.service.ts:110-112`
- **Description:** The `authenticate` function only verifies the JWT signature. Once issued, an access token is valid until expiry (15 min default). On logout, only refresh tokens are deleted from DB (`auth.service.ts:111`). There is no token blacklist or revocation mechanism.
- **Impact:** After logout, the user's access token remains valid for up to 15 minutes. For a family app handling GDPR-protected dietary/medical data, this is a compliance risk.
- **Fix:** (a) Reduce access token TTL to 5 minutes (cheapest for MVP), or (b) add a lightweight in-memory blacklist on logout, or (c) add a Redis-based token blacklist checked in `authenticate`.
- **Effort:** S (1-2h) for option (a), M (3-8h) for option (c)

### TD-003 | Security

**OPENAI_API_KEY defaults to `'test-key'` in production config**

- **Where:** `apps/api/src/config.ts:18`
- **Description:** The `OPENAI_API_KEY` Zod schema has `.default('test-key')`. If the env var is not set, the server starts without error and AI generation silently fails with unhelpful OpenAI API errors instead of failing fast at boot.
- **Impact:** Production deployment without a real key goes undetected until a user tries to generate a menu. Violates fail-fast principle.
- **Fix:** Remove the `.default('test-key')`. For tests, set the env var explicitly in test setup (already done in `helpers/setup.ts:8`). Use a conditional: `NODE_ENV === 'test' ? z.string().default('test-key') : z.string().min(1)`.
- **Effort:** S (30min)

### TD-004 | Performance

**Menu generation creates 70-100+ sequential DB queries without batching or transaction**

- **Where:** `apps/api/src/services/menu.service.ts:394-446`
- **Description:** The `generate` method creates menu days and meals in nested loops: 7 days x 3 meals = up to 21 meals + 7 days = 28 individual INSERT statements. Each `upsertRecipeFromAi` call (lines 167-227) does additional lookups per ingredient. Total per generation: 70-100+ sequential DB round trips. No wrapping `$transaction()`, so a failure mid-way leaves partial data.
- **Impact:** With Neon serverless (cold starts, network latency), this can take 5-15 seconds. No atomicity — a failure mid-way leaves orphaned menu/day/meal records. Phase 3 catalog writes will follow similar patterns at larger scale.
- **Fix:** Wrap the entire menu creation in a `prisma.$transaction()`. Use `createMany()` for menu days and meals. Pre-batch recipe upserts.
- **Effort:** M (3-8h)

### TD-005 | Scalability

**In-memory rate limiter for AI generation lost on restart/multi-instance**

- **Where:** `apps/api/src/services/menu.service.ts:13-33`
- **Description:** `generationTimestamps` is an in-process `LRUCache`. On server restart or multi-instance deployment, all rate limit state is lost. Users could exceed 10 generations/hour by timing requests across restarts or instances.
- **Impact:** OpenAI API cost overrun. A single user could trigger hundreds of API calls costing $5-20+ per hour.
- **Fix:** Acceptable for single-instance MVP. Before multi-instance (Phase 5+), migrate to Redis-based rate limiting or a `menu_generation_log` DB table.
- **Effort:** M (3-8h)

---

## High Priority (fix within next 2 sprints)

### TD-006 | Architecture

**Duplicate family ownership verification creates N+1 DB calls**

- **Where:** `apps/api/src/lib/ownership.ts:14-27`, `apps/api/src/services/menu.service.ts:234-271`
- **Description:** `verifyMemberOwnership()` calls `verifyFamilyOwnership()` (1 query) then does `findFirst` (2nd query). Services calling this then do a 3rd query for the actual operation. The menu service has its own duplicate `getFamily` and `getFamilyId` methods (lines 234-271) that replicate ownership logic outside of shared `ownership.ts`. The family service `update` calls `verifyFamilyOwnership` then `prisma.family.update` with the same `where: { userId }` — the first query is redundant.
- **Impact:** Every authenticated request on restriction/member endpoints incurs 1-2 extra DB queries. Triples latency on Neon serverless.
- **Fix:** Use a single query with a join: `prisma.familyMember.findFirst({ where: { id: memberId, family: { userId } } })`. Or create a middleware/preHandler that resolves family once, decorates `request.family`.
- **Effort:** M (4-6h)

### TD-007 | Code Quality (DRY)

**Response mapper functions duplicated across 7 service files**

- **Where:** `family.service.ts:5-79`, `recipe.service.ts:4-42`, `menu.service.ts:61-155`, `family-member.service.ts:7-23`, `dietary-restriction.service.ts:5-19`, `medical-restriction.service.ts:5-17`, `preference.service.ts:5-12`
- **Description:** Each service has an inline `toXxxResponse()` function that manually maps Prisma camelCase fields to snake_case API responses. The `Decimal -> Number` conversion pattern is repeated in 3 places. The `menu.service.ts` alone has 3 separate response mappers totaling 95 lines.
- **Impact:** Adding a new field requires updating multiple mappers. Easy to miss one. Risk of inconsistency.
- **Fix:** Extract response mappers into `lib/response-mappers.ts` with reusable helpers (`decimalToNumber()`, `toISODate()`, etc.).
- **Effort:** M (3-4h)

### TD-008 | Testing

**No tests for AI menu generator — the most complex service**

- **Where:** `apps/api/src/services/ai-menu-generator.ts` (168 lines, 0 dedicated tests)
- **Description:** The retry logic (3 attempts for weekly menu, 2 for alternatives), JSON parsing, Zod validation of AI output, backoff timing, and error propagation are all untested. The `menu.test.ts` mocks OpenAI at module level and only tests route-level error paths — never the successful generation flow.
- **Impact:** Regression risk in the core AI pipeline. Retry logic bugs could cause silent failures. This is the module most likely to break during refactoring.
- **Fix:** Add unit tests with mocked OpenAI client: successful generation, Zod validation failure + retry, max retries exceeded, JSON parse failure, backoff timing.
- **Effort:** L (6-8h)

### TD-009 | Testing

**No integration tests with real database**

- **Where:** All test files in `apps/api/src/__tests__/`
- **Description:** Every test uses `mockPrisma`. There are zero tests that verify actual SQL queries, constraint violations, cascade deletes, or Prisma migration correctness. The `full-flow.test.ts` is labeled "integration" but also uses mocks.
- **Impact:** Prisma query bugs (wrong `where` clauses, missing `include`, cascade behavior) are invisible. Schema drift between Prisma and actual DB goes undetected.
- **Fix:** Add a Docker-based integration test suite using `testcontainers` or a separate Vitest workspace with a test Postgres instance. Start with 5-10 critical path tests.
- **Effort:** L (1-2 days)

### TD-010 | Security

**Recipe list endpoint exposes all users' custom recipes**

- **Where:** `apps/api/src/routes/recipes.ts:29-33`, `apps/api/src/services/recipe.service.ts:94-118`
- **Description:** `GET /recipes` returns ALL recipes in the database regardless of creator. The only filter is `cuisine_type`. Any authenticated user sees every other user's custom recipes.
- **Impact:** Privacy violation. User A's custom family recipes visible to User B. For a GDPR-compliant app, this leaks personal data (recipe names, dietary patterns).
- **Fix:** Show only public recipes (`isCustom=false`) + the user's own recipes. Or add a `visibility` field to the Recipe model.
- **Effort:** S (1-2h)

### TD-011 | Security

**No input sanitization for string fields sent to AI prompts**

- **Where:** `apps/api/src/lib/prompt-builder.ts:68-113`
- **Description:** User-provided data (dietary restriction values, cuisine preferences, medical conditions) is serialized directly into AI prompts via `JSON.stringify`. A malicious user could inject prompt manipulation instructions through these fields.
- **Impact:** Prompt injection could cause the AI to return manipulated menu data, bypass dietary restrictions in the output, or leak system prompt.
- **Fix:** Sanitize user strings before embedding in prompts (strip control characters, limit to alphanumeric + common food chars). Add a prompt injection detection layer.
- **Effort:** M (3-4h)

### TD-012 | Performance / Reliability

**No request timeout on AI generation endpoints**

- **Where:** `apps/api/src/services/ai-menu-generator.ts:43-56`
- **Description:** The `callOpenAI()` function has no timeout. With `max_tokens: 8000` and retry logic (3 attempts), a single generation can take 30-90 seconds. Fastify default timeout is 0 (none).
- **Impact:** Slow AI responses block the thread. Multiple concurrent generations can exhaust connection pool and starve other endpoints.
- **Fix:** Add `signal: AbortSignal.timeout(30_000)` to the OpenAI call. Add Fastify route-level timeout for generation endpoints. Return 504 on timeout.
- **Effort:** S (1-2h)

### ~~TD-013 | Observability~~ ✅ RESOLVED (2026-02-11)

**No structured logging for business events**

- **Where:** Entire API — no business-level log events found
- **Description:** The app uses Pino (via Fastify) for request logging, but menu generation success/failure, user registration, family creation, AI retry attempts — none emit structured log events. No request ID propagation to service-layer logs.
- **Impact:** Cannot track usage patterns, debug production issues, or monitor AI success rates. Cannot measure how often AI validation retries occur.
- **Fix:** Added optional `log?: FastifyBaseLogger` param to all service methods. Routes pass `request.log`. 37 structured log events across 9 services. New file: `lib/logger.ts`.
- **Effort:** M (3-4h) — actual: ~2h

---

## Medium Priority (schedule when capacity allows)

### TD-014 | Security / Code Quality

**Route params use unsafe type assertion instead of schema validation**

- **Where:** All route files, e.g., `family-members.ts:32`, `recipes.ts:37`, `menu.ts:45-47`
- **Description:** Every route handler casts params unsafely: `const { id } = request.params as { id: string }`. While `uuidSchema.parse(id)` catches invalid UUIDs afterward, Fastify's built-in params schema validation is not used. This means Swagger/OpenAPI docs don't document path parameters.
- **Impact:** Missing OpenAPI param documentation. The unsafe `as` cast bypasses TypeScript's type safety. If `uuidSchema.parse()` is accidentally removed, raw input flows through unchecked.
- **Fix:** Add `params: zodToFastify(z.object({ id: uuidSchema }))` to route schemas. Use Fastify type providers for type-safe params.
- **Effort:** M (3-4h)

### TD-015 | Code Quality

**Double validation: Fastify schema + manual Zod parse in every handler**

- **Where:** All route files, e.g., `auth.ts:13-14`, `family.ts:16-17`
- **Description:** Each route registers `schema: { body: zodToFastify(xxxSchema) }` for Fastify AJV validation, then immediately calls `xxxSchema.parse(request.body)` inside the handler. Every request body is validated twice. The Zod defaults (e.g., `.default(3)`) only apply in the Zod parse, not the Fastify validation.
- **Impact:** Wasted CPU. Two different error formats possible. Cognitive overhead for developers.
- **Fix:** Use Fastify's `setValidatorCompiler` with a Zod adapter like `fastify-type-provider-zod` to unify both. Or drop Fastify schema and use Zod-only validation in a preValidation hook.
- **Effort:** M (3-4h)

### TD-016 | Architecture

**`menu.service.ts` is 650 lines with mixed concerns**

- **Where:** `apps/api/src/services/menu.service.ts`
- **Description:** The largest file at 651 lines. Contains: rate limiting logic, date parsing, 3 response mappers, recipe upsert logic, family context building, and 8 service methods. Violates single responsibility.
- **Impact:** Hard to test individual pieces. The `upsertRecipeFromAi` function is not exported or reusable. Adding new menu features further bloats this file.
- **Fix:** Extract into modules: `lib/date-utils.ts`, `services/recipe-upsert.service.ts`, `lib/family-context-builder.ts`. Move rate limit to shared middleware.
- **Effort:** M (3-8h)

### TD-017 | Data Integrity

**Ingredient model has no unique constraint — concurrent requests create duplicates**

- **Where:** `packages/db/prisma/schema.prisma:242-254`, `apps/api/src/services/menu.service.ts:193-212`
- **Description:** The Ingredient model has no `@@unique` on `nameEn` or `[nameEn, nameFi]`. The `upsertRecipeFromAi` function does `findMany` + manual dedup, but concurrent requests could create duplicate ingredients.
- **Impact:** Duplicate ingredient rows accumulate, breaking shopping list aggregation in Phase 3.
- **Fix:** Add `@@unique([nameEn])` or `@@unique([nameEn, nameFi])`. Update `upsertRecipeFromAi` to use `upsert()` instead of find-then-create.
- **Effort:** S (1-2h)

### TD-018 | Performance

**Missing Ingredient index on `nameEn`**

- **Where:** `packages/db/prisma/schema.prisma:242-254`
- **Description:** No index on `nameEn`. The `upsertRecipeFromAi` does `findMany({ where: { nameEn: { in: ingredientNames } } })` which becomes a full table scan as ingredients grow.
- **Impact:** Phase 3 adds thousands of products/ingredients. Ingredient lookup degrades linearly.
- **Fix:** Add `@@index([nameEn])` to the Ingredient model.
- **Effort:** S (30min)

### TD-019 | DevEx / Testing

**CI pipeline lacks real database, Node.js version mismatch**

- **Where:** `.github/workflows/ci.yml`
- **Description:** CI uses `node-version: 20` while the project targets Node 22 LTS (`@types/node: ^22`). No PostgreSQL service container configured. Tests pass only because Prisma is fully mocked.
- **Impact:** Features available in Node 22 but not 20 could pass locally but fail in CI. DB-level issues invisible.
- **Fix:** Update CI to `node-version: 22`. Add `.nvmrc`. Add PostgreSQL service when integration tests are introduced (pairs with TD-009).
- **Effort:** S (1h) for Node version, M (3-8h) for DB service

### TD-020 | Security

**Error handler leaks internal messages in non-production**

- **Where:** `apps/api/src/plugins/error-handler.ts:72-84`
- **Description:** In non-production mode, the raw error message is returned to the client for unknown errors. This can leak stack traces, SQL errors, or internal paths.
- **Impact:** Development/staging error responses may expose database schema details, Prisma query structure, or file paths.
- **Fix:** Only return generic messages for 5xx errors regardless of environment. Log full errors server-side. Keep detailed messages for 4xx client errors.
- **Effort:** S (1-2h)

### TD-021 | Architecture

**CORS origin is a single string, not a list**

- **Where:** `apps/api/src/config.ts:14`, `apps/api/src/plugins/cors.ts:7`
- **Description:** `CORS_ORIGIN` is a single string. Chrome extension, web app, and possibly a mobile app need different origins.
- **Impact:** Cannot serve multiple frontends without code changes. Risk of using `*` as a quick fix.
- **Fix:** Accept comma-separated list in `CORS_ORIGIN`, split and pass as array.
- **Effort:** S (1h)

### TD-022 | Code Quality

**`getNextMonday()` uses local timezone, not UTC**

- **Where:** `apps/api/src/services/menu.service.ts:35-43`
- **Description:** Uses `new Date()` and `setDate/setHours` (local timezone) while `parseWeekStart()` at line 48 uses UTC. Inconsistency in date handling.
- **Impact:** Menu generated late Sunday night could pick wrong Monday depending on server timezone.
- **Fix:** Use UTC methods (`getUTCDay`, `setUTCDate`, `setUTCHours`) consistently.
- **Effort:** S (30min)

### TD-023 | Security

**Swagger UI available in production**

- **Where:** `apps/api/src/plugins/swagger.ts`
- **Description:** Swagger plugin registered unconditionally. In production, `/docs` exposes full API schema with all endpoints and validation rules.
- **Impact:** Information disclosure. Provides an attacker with a comprehensive API map.
- **Fix:** Conditionally register only when `NODE_ENV !== 'production'`.
- **Effort:** S (15min)

### TD-024 | Security

**Docker Compose uses hardcoded credentials, no production guard**

- **Where:** `docker-compose.yml:8-10`, `.env.example:3,19`
- **Description:** PostgreSQL credentials are `foodops:foodops` and JWT secret is a readable string. No mechanism prevents use in production.
- **Impact:** If docker-compose is used in non-dev environment, credentials are trivially guessable.
- **Fix:** Add a startup check in `config.ts` that rejects known-weak JWT secrets in production mode.
- **Effort:** S (1-2h)

### TD-025 | Code Quality

**Rate limit for AI generation shared between `generate` and `getAlternatives`**

- **Where:** `apps/api/src/services/menu.service.ts:18-33, 580`
- **Description:** Both menu generation and alternatives requests share the same `checkGenerationRateLimit` counter. Getting 5 alternatives counts the same as a full menu generation.
- **Impact:** User who gets alternatives frequently may be unable to generate new menus. Different token costs, same limit.
- **Fix:** Use separate counters, or weight alternatives as 0.2x of a full generation.
- **Effort:** S (1-2h)

---

## Low Priority (track but don't rush)

### TD-026 | Code Quality

**`menu-validator.ts` restriction check is English-only**

- **Where:** `apps/api/src/lib/menu-validator.ts:27`
- **Description:** `validateRestrictionCompliance` only checks `ingredient.name_en`. Finnish restriction values won't match English ingredient names.
- **Impact:** Finnish-speaking users entering restrictions in Finnish get no safety validation.
- **Fix:** Check both `name_en` and `name_fi`. Consider normalizing restrictions to English at input time.
- **Effort:** S (1-2h)

### TD-027 | DevEx

**Version hardcoded in health endpoint and Swagger**

- **Where:** `apps/api/src/routes/health.ts:9`, `apps/api/src/plugins/swagger.ts:13`
- **Description:** `version: '0.0.1'` as hardcoded string in both files. Will drift from `package.json`.
- **Impact:** Health check and API docs show stale version numbers.
- **Fix:** Read version from `package.json` or inject via config.
- **Effort:** S (30min)

### TD-028 | Dependencies

**`bcrypt` native module adds build complexity**

- **Where:** `apps/api/package.json:23`
- **Description:** `bcrypt` requires native compilation (`node-gyp` + C compiler). Can cause build issues on Windows and Alpine Docker. `@types/bcrypt` v5 while `bcrypt` is v6 — potential type drift.
- **Impact:** CI builds may be slower. Windows onboarding may hit native build errors.
- **Fix:** Switch to `bcryptjs` (pure JS, same API) or `argon2` (OWASP recommended).
- **Effort:** S (1h)

### TD-029 | DevEx

**Swagger docs lack response schemas**

- **Where:** All route files
- **Description:** Routes only define `body` schemas. No `response` schemas, no descriptions, no tags, no path param schemas documented.
- **Impact:** Frontend developers have no auto-generated API contract. Poor DX for Phase 4 frontend and Phase 5 extension.
- **Fix:** Add response schemas using `zodToFastify()` for each endpoint's success/error responses.
- **Effort:** L (1-2 days)

### TD-030 | Code Quality

**`health.test.ts` has its own inline mock separate from shared setup**

- **Where:** `apps/api/src/__tests__/health.test.ts:5-16`
- **Description:** Defines its own Prisma mock and env setup while all other tests use `helpers/setup.ts`. Changes to the shared mock don't affect health tests.
- **Impact:** Minor maintenance burden. Mock interface changes require separate update.
- **Fix:** Refactor to use shared `helpers/setup.ts`.
- **Effort:** S (30min)

### TD-031 | Testing

**Test helper `userCounter` doesn't reset between test files**

- **Where:** `apps/api/src/__tests__/helpers/auth-helper.ts:4`
- **Description:** Module-level `userCounter` increments across test invocations. `vi.clearAllMocks()` doesn't reset module-level state. User IDs become unpredictable in later tests.
- **Impact:** Fragile under parallel execution or reordering.
- **Fix:** Use `crypto.randomUUID()` for unique emails instead of counter.
- **Effort:** S (30min)

### TD-032 | DevEx

**No `.env.test` file or test environment documentation**

- **Where:** `apps/api/src/__tests__/helpers/setup.ts:4-9`
- **Description:** Test env vars set inline in code. No `.env.test` file or documented instructions.
- **Impact:** New contributors must read test helper source to understand required env vars.
- **Fix:** Create `.env.test` with test-safe values. Add test setup instructions.
- **Effort:** S (1h)

### TD-033 | Reliability

**No graceful handling of OpenAI API rate limits (429)**

- **Where:** `apps/api/src/services/ai-menu-generator.ts:43-56`
- **Description:** `callOpenAI` does not handle OpenAI 429 responses. The retry loop retries on validation failures but not API errors. An OpenAI 429 causes immediate failure.
- **Impact:** During peak usage, OpenAI rate limits cause all menu generations to fail without retry.
- **Fix:** Use OpenAI SDK's built-in retry (`maxRetries` option). Add exponential backoff for 429/500/503.
- **Effort:** S (1-2h)

### TD-034 | Data Integrity

**Recipe deletion cascade removes meals from active menus**

- **Where:** `apps/api/src/services/recipe.service.ts:170-180`, `packages/db/prisma/schema.prisma:400`
- **Description:** Deleting a recipe with `onDelete: Cascade` on Meal->Recipe silently removes it from all menus. No check for active menu references.
- **Impact:** A user deleting a custom recipe could break another family's approved menu if the recipe was AI-generated and shared.
- **Fix:** Check `prisma.meal.count` for active menu references before deletion. Reject if > 0.
- **Effort:** S (1-2h)

### TD-035 | Dependencies

**Redis in docker-compose but unused in application**

- **Where:** `docker-compose.yml:34-49`, `.env.example:14`
- **Description:** Redis container configured and running, `REDIS_URL` in `.env.example`, but no application code references Redis. Not in config Zod schema.
- **Impact:** Resource waste. Confusing for new developers.
- **Fix:** Remove Redis from docker-compose until needed, or add explicit comment.
- **Effort:** S (15min)

### TD-036 | Code Quality

**`nul` file artifact in repo root**

- **Where:** Root directory (git status: `?? nul`)
- **Description:** Windows reserved device name artifact. Known Windows issue.
- **Impact:** Minor annoyance.
- **Fix:** Delete via `node -e "require('fs').unlinkSync('nul')"` and add to `.gitignore`.
- **Effort:** S (5min)

### TD-037 | Architecture

**AI generator instantiated per-route, not shared via plugin**

- **Where:** `apps/api/src/routes/menu.ts:14`
- **Description:** `createAiMenuGenerator(fastify.config)` called inside route plugin. Creates a new OpenAI client per registration. Not shareable by future consumers (e.g., shopping list optimization).
- **Impact:** Minor coupling. Becomes an issue if other routes need AI generation.
- **Fix:** Move AI generator to a Fastify plugin (`plugins/ai.ts`) and decorate the instance.
- **Effort:** S (1-2h)

### TD-038 | Security

**No CSRF protection with `credentials: true`**

- **Where:** `apps/api/src/plugins/cors.ts:8`
- **Description:** CORS sets `credentials: true`. While JWT Bearer auth (not cookies) mitigates CSRF, if the frontend ever stores JWT in a cookie (e.g., for Next.js SSR), CSRF becomes exploitable.
- **Impact:** Latent vulnerability if auth strategy changes.
- **Fix:** Remove `credentials: true` if not needed, or document that cookies must never store JWTs, or add `@fastify/csrf-protection`.
- **Effort:** S (1-2h)

---

## Metrics

| Metric                     | Value                          |
| -------------------------- | ------------------------------ |
| **Total items**            | 38                             |
| **Critical**               | 5                              |
| **High**                   | 8                              |
| **Medium**                 | 12                             |
| **Low**                    | 13                             |
| **Estimated total effort** | ~65-80 SP (assuming 1 SP = 2h) |

### Effort Breakdown

| Size     | Count    | Hours range | SP range |
| -------- | -------- | ----------- | -------- |
| S (1-2h) | 22 items | 22-44h      | 11-22 SP |
| M (3-8h) | 13 items | 39-104h     | 20-52 SP |
| L (1-3d) | 3 items  | 24-72h      | 12-36 SP |

### Priority Effort

| Priority                  | SP estimate | Timeline   |
| ------------------------- | ----------- | ---------- |
| Critical (before Phase 3) | 5-10 SP     | 1 week     |
| High (within 2 sprints)   | 15-20 SP    | 2 weeks    |
| Medium + Low              | 35-50 SP    | Phases 3-5 |

---

## Category Distribution

| Category       | Count | Critical | High | Medium | Low |
| -------------- | ----- | -------- | ---- | ------ | --- |
| Security       | 10    | 2        | 3    | 3      | 2   |
| Performance    | 3     | 1        | 1    | 1      | 0   |
| Code Quality   | 7     | 0        | 1    | 3      | 3   |
| Testing        | 4     | 0        | 2    | 0      | 2   |
| Architecture   | 4     | 0        | 1    | 1      | 2   |
| Observability  | 1     | 0        | 1    | 0      | 0   |
| DevEx          | 4     | 0        | 0    | 1      | 3   |
| Data Integrity | 2     | 0        | 0    | 1      | 1   |
| Dependencies   | 2     | 0        | 0    | 0      | 2   |
| Scalability    | 1     | 1        | 0    | 0      | 0   |
| Reliability    | 1     | 0        | 0    | 0      | 1   |

**Note:** Some items span multiple categories. The primary category is listed.

---

## Sprint Results (2026-02-10)

**30 of 38 items resolved** (29 in sprint session + TD-013 in session 13).

### Implemented (30 items)

- ✅ TD-001: Separate JWT secrets (JWT_ACCESS_SECRET + JWT_REFRESH_SECRET)
- ✅ TD-002: Access token TTL reduced to 5 minutes (300s)
- ✅ TD-003: OPENAI_API_KEY default removed (fail-fast)
- ✅ TD-004: Menu generation wrapped in $transaction
- ✅ TD-005: In-memory rate limit documented
- ✅ TD-010: Recipe list privacy filter (public + own recipes only)
- ✅ TD-011: Prompt injection sanitization
- ✅ TD-012: OpenAI 30s timeout via AbortSignal
- ✅ TD-017: Ingredient @@unique([nameEn]) constraint
- ✅ TD-018: Covered by TD-017 (@@unique creates index)
- ✅ TD-019: CI updated to Node 22, .nvmrc added
- ✅ TD-020: Error handler no longer leaks 5xx details
- ✅ TD-021: CORS multi-origin support (comma-separated)
- ✅ TD-022: getNextMonday uses UTC methods
- ✅ TD-023: Swagger disabled in production
- ✅ TD-024: Weak JWT secret rejected in production
- ✅ TD-025: Separate rate limits (generate: 10/h, alternatives: 30/h)
- ✅ TD-026: Validator checks both English and Finnish ingredient names
- ✅ TD-027: Version read from package.json (health + swagger)
- ✅ TD-028: bcrypt → bcryptjs (pure JS, no native compile)
- ✅ TD-030: health.test.ts uses shared mock
- ✅ TD-031: userCounter → crypto.randomUUID()
- ✅ TD-032: .env.test file created
- ✅ TD-033: OpenAI SDK maxRetries: 2 for 429/500/503
- ✅ TD-034: Recipe deletion checks for active menu references
- ✅ TD-035: Redis removed from docker-compose (unused)
- ✅ TD-036: nul file deleted, added to .gitignore
- ✅ TD-037: AI generator extracted to Fastify plugin (plugins/ai.ts)
- ✅ TD-038: credentials:true removed from CORS
- ✅ TD-013: Structured logging (37 events, 9 services, optional logger pattern)

### Deferred (8 items — schedule for Phase 3-4)

- TD-006: Ownership consolidation (touches many services, high coupling risk)
- TD-007: Response mapper extraction (7 service files, large DRY refactor)
- TD-008: AI generator unit tests (6-8h, dedicated test sprint)
- TD-009: Integration tests with real DB (1-2 days, needs testcontainers)
- TD-014: Route params schema (needs fastify-type-provider-zod migration)
- TD-015: Double validation (needs fastify-type-provider-zod migration)
- TD-016: Decompose menu.service.ts (risky, defer to Phase 3)
- TD-029: Swagger response schemas (1-2 days, all routes)

### Remaining Recommendations for Phase 3

- **TD-016** (menu.service.ts decomposition) — Before adding more service complexity
- **TD-009** (real DB integration tests) — To validate bulk insert correctness
- **TD-014 + TD-015** (type-provider migration) — Clean up validation architecture
