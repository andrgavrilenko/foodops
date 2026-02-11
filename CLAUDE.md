# CLAUDE.md — FoodOps

---

## Quick Context

**One-liner:** FoodOps — AI-приложение для семей: планирование меню на неделю, автоформирование списка продуктов и автозаказ в S-Market (S-kaupat.fi) через Chrome Extension.

**Current focus:**

1. ~~Фаза 0 — Инициализация проекта~~ (✅ complete)
2. ~~Фаза 1 — Backend Core~~ (✅ Phase 1.0 + 1.1 complete)
3. ~~Фаза 2 — AI модуль генерации меню~~ (✅ Phase 2.0 complete)
4. **Фаза 3 — Парсер каталога S-Market + маппинг ингредиентов** ← next

**Repo map:**

```
FoodOps/
├── CLAUDE.md                  # <-- вы здесь
├── docs/
│   ├── technical-specification.md   # ТЗ для архитектора (FR-xxx, US-xxx)
│   ├── market-research.md           # Маркетинговое исследование (Финляндия)
│   ├── infrastructure-specification.md  # ТЗ по инфраструктуре
│   ├── project-plan.md             # План работ (WBS, Gantt, бюджет)
│   ├── feature-backlog.md          # Product backlog (15 epics, ~100 stories)
│   └── document-review.md          # Architect review (issues & recommendations)
├── apps/
│   ├── web/                   # Next.js frontend (skeleton created)
│   └── api/                   # Fastify backend (✅ Phase 2.0 complete)
├── packages/
│   ├── shared/                # Общие типы, утилиты (skeleton created)
│   └── db/                    # Prisma schema + клиент (✅ Phase 0.2 complete)
├── extensions/
│   └── chrome/                # Chrome Extension (skeleton created)
│       └── README.md          # Source of truth по extension
└── package.json               # Monorepo root (✅ Phase 0.1 complete)
```

**Non-negotiables:**

- TypeScript everywhere (strict mode)
- Monorepo (npm workspaces или turborepo)
- PostgreSQL на Neon (serverless)
- GDPR compliance (EU/Finland) — данные в eu-north-1
- Chrome Extension НЕ хранит credentials — только автоматизация UI
- AI через OpenAI API (не self-hosted)
- Все детали extension — только в `extensions/chrome/README.md`

**Tech stack:**
| Слой | Технология |
|------|-----------|
| Frontend | Next.js 14+ / React / TypeScript |
| Backend | Node.js / Fastify / TypeScript |
| AI | OpenAI GPT-4o-mini API (Plan B: DeepSeek V3) |
| DB | PostgreSQL (Neon serverless) |
| ORM | Prisma |
| Cache | Redis (Upstash) |
| Search | Meilisearch |
| Extension | Chrome Manifest V3 / TypeScript |
| Monorepo | Turborepo |
| Package manager | npm |
| Hosting (MVP) | Hetzner Cloud (Helsinki) |

**Local run:**

```bash
# Установка зависимостей
npm install

# Запуск dev-окружения
npm run dev

# Только backend
npm run dev --workspace=apps/api

# Только frontend
npm run dev --workspace=apps/web

# Сборка extension
npm run build --workspace=extensions/chrome
```

---

## Work — Now

- [x] **Фаза 0.1** — Инициализация monorepo (Turborepo, TypeScript, ESLint, Prettier)
- [x] **Фаза 0.2** — Настройка PostgreSQL, Prisma schema (модель данных из ТЗ)
- [x] **Фаза 0.3** — Базовый Fastify сервер с healthcheck
- [x] **Фаза 0.4** — CI pipeline (GitHub Actions: lint, typecheck, test)
- [x] **Фаза 1.0** — CRUD API для пользователей и семей (auth, family profile, preferences)
- [x] **Фаза 1.1** — CRUD API для рецептов (FR-100..FR-110)
- [x] **Фаза 2.0** — AI генерация меню (US-010..US-016)
- [x] **Tech Debt Sprint** — 30/38 items fixed (security, performance, DRY, testing, observability)
- [x] **TD-013** — Structured logging for business events (37 log statements, 9 services, 8 routes)
- [ ] **Фаза 3.0** — Парсер каталога S-Market + маппинг ингредиентов на товары

---

## Backlog

- [feat] Фаза 1: CRUD API для пользователей и семей — DoD: POST/GET/PATCH/DELETE /api/users, /api/families работают с тестами
- [feat] Фаза 1: CRUD API для рецептов — DoD: endpoints по FR-100..FR-110
- [feat] Фаза 2: AI генерация меню — DoD: POST /api/menu/generate возвращает меню на неделю (US-010..US-016)
- [feat] Фаза 3: Парсер каталога S-Market (S-kaupat.fi) — DoD: скрипт загружает товары в БД
- [feat] Фаза 3: Маппинг ингредиентов на товары — DoD: FR-200..FR-210
- [feat] Фаза 4: Frontend — регистрация и профиль семьи — DoD: US-001, US-002
- [feat] Фаза 4: Frontend — экран меню на неделю — DoD: US-003..US-008
- [feat] Фаза 4: Frontend — список продуктов — DoD: US-020..US-026
- [feat] Фаза 5: Chrome Extension — автодобавление товаров в корзину S-kaupat.fi — DoD: FR-300..FR-323
- [infra] Настройка staging окружения на Hetzner
- [docs] README.md для open source / onboarding

---

## Progress Log

> Формат: 1 запись = 1 сессия, max 10 строк. Только milestones и contract changes.
> Храним последние 20 записей. Старее — удаляем.

### 2026-02-11 (сессия 13)

- **Done:** TD-013 — Structured logging for business events. 37 log statements across 9 services + 8 route files. Optional `log?: FastifyBaseLogger` param pattern — zero test changes. PM review: 8.5/10, fixed recipe.update() gap found during review.
- **Changed:** New file: `lib/logger.ts` (FastifyBaseLogger re-export + noopLogger). All service methods with business ops now accept optional logger. All routes pass `request.log`. Events: user_registered, user_login_success/failed, token_reuse_detected, family/member/recipe CRUD, menu generation with durationMs, AI call timing + validation step tracking.
- **Notes:** 115 tests pass (unchanged). Tech debt: 30/38 fixed, 8 deferred (TD-006,007,008,009,014,015,016,029). Следующий шаг — Фаза 3.0 (каталог S-Market).

### 2026-02-10 (сессия 12)

- **Done:** Tech Debt Sprint — 29/38 items fixed. 3 parallel agents (security, backend, infra). Critical: separate JWT secrets, 5min access TTL, OPENAI_API_KEY fail-fast, menu $transaction, in-memory rate limit documented. High: recipe privacy, prompt sanitization, OpenAI 30s timeout. Medium+Low: CORS multi-origin, Swagger prod guard, UTC dates, bcryptjs, CI Node 22, .env.test, AI plugin extraction, etc. Code review #2 (9 items) also completed: LRU cache, N+1 fix, DRY, word-boundary regex.
- **Changed:** bcrypt→bcryptjs. JWT_SECRET→JWT_ACCESS_SECRET+JWT_REFRESH_SECRET. OPENAI_API_KEY no default. Redis removed from docker-compose. AI generator→Fastify plugin. Ingredient @@unique([nameEn]). New files: plugins/ai.ts, .nvmrc, .env.test.
- **Notes:** 94 tests pass. 9 items deferred: TD-006,007,008,009,013,014,015,016,029 (ownership, mappers, AI tests, integration tests, logging, type-provider, decompose). Следующий шаг — Фаза 3.0 (каталог S-Market).

### 2026-02-10 (сессия 11)

- **Done:** Phase 2.0 завершена — AI генерация меню с GPT-4o-mini. 8 endpoints: generate, current, history, getById, replaceMeal, lockMeal, alternatives, approve. OpenAI интеграция с 3-retry validation pipeline (Zod → meal count → restriction compliance → uniqueness → completeness). GDPR-compliant prompt builder (анонимизация членов семьи). 36 новых тестов (92 всего).
- **Changed:** Добавлена зависимость: openai ^4.0. Новые файлы: lib/prompt-builder.ts, lib/menu-validator.ts, schemas/ai-output.schemas.ts, schemas/menu.schemas.ts, services/ai-menu-generator.ts, services/menu.service.ts, routes/menu.ts. 11 новых error codes для menu module. 2 индекса на WeeklyMenu (familyId+status, familyId+weekStart).
- **Notes:** Все проверки проходят (typecheck, lint, test, format). Следующий шаг — Фаза 3.0 (каталог S-Market).

### 2026-02-10 (сессия 10)

- **Done:** Code review fixes (7 items): DRY extraction (verifyMemberOwnership → lib/ownership.ts, isPrismaUniqueError → lib/errors.ts, toAuthResponse), merge duplicate JWT verifiers, login rate limit 5/min, expired token cleanup on refresh, removed wasted re-fetch in family.create(). Phase 2.0 plan created by PM agent (docs/phase-2-plan.md): 8 endpoints, 28 SP, 2.5 weeks, GPT-4o-mini integration.
- **Changed:** New file: lib/ownership.ts (shared ownership verification). Auth routes: login-specific rate limit (5 req/min). Auth service: expired token cleanup during refresh rotation.
- **Notes:** 56 tests pass. All checks clean (typecheck/lint/format). Phase 2.0 plan ready for implementation.

### 2026-02-10 (сессия 9)

- **Done:** PM-ревью Phase 1.0 (8/10). Фикс P0-issues: expires_in в auth ответах, preferred_store_id в family schemas, Zod→Fastify schemas для Swagger (/docs), добавлены тесты login/refresh/E2E flow. Phase 1.1 завершена — Recipe CRUD API (5 endpoints, 15 тестов). Всего 56 тестов проходят.
- **Changed:** Добавлены зависимости: zod-to-json-schema. Новые error codes: RECIPE_NOT_FOUND, RECIPE_NOT_OWNER. Recipe routes зарегистрированы на /recipes.
- **Notes:** Все проверки проходят (typecheck, lint, test, format). Следующий шаг — Фаза 2.0 (AI генерация меню).

### 2026-02-10 (сессия 8)

- **Done:** Фаза 1.0 завершена — CRUD API для пользователей и семей. 20 endpoints: auth (register/login/refresh/logout), family (CRUD), family members (create/update/delete), dietary/medical restrictions (create/delete), preferences (create/list/delete). Prisma schema обновлена (RefreshToken, calorieTargetPerPerson, updatedAt, unique constraints). 38 тестов проходят.
- **Changed:** Добавлены зависимости: bcrypt, fast-jwt, @fastify/rate-limit, @fastify/swagger, @fastify/swagger-ui. JWT auth plugin (fast-jwt). Rate limiting (100 req/min). Swagger UI at /docs. Service factory pattern (no classes).
- **Notes:** Все проверки проходят (typecheck, lint, test, format). Следующий шаг — Фаза 1.1 (CRUD API для рецептов).

### 2026-02-10 (сессия 7)

- **Done:** PM-ревью Phase 0: 15+ несоответствий в документации найдено и исправлено. Создан `docs/phase-1-plan.md` (20 endpoints, 32 SP, 3 недели). Решены 3 открытых вопроса. Docker-инфраструктура: Dockerfile для API (multi-stage), docker-compose обновлён (PostgreSQL 16 + Redis 7 + Adminer), .env.example. MVP scope сокращён с 227 SP до 166 SP.
- **Changed:** **DECISIONS:** AI модель = GPT-4o-mini (Plan B: DeepSeek V3). Calorie target = поле `calorieTargetPerPerson Int?` на Family. Rate limiting = `@fastify/rate-limit` (in-memory). MVP = core flow only + FAM-10.
- **Notes:** Все документы обновлены с новыми решениями. Следующий шаг — Фаза 1.0 (CRUD API).

### 2026-02-10 (сессия 6)

- **Done:** Фаза 0.4 завершена — CI pipeline на GitHub Actions. Workflow `.github/workflows/ci.yml`: lint, typecheck, build, test, format:check. Vitest добавлен в apps/api — 6 тестов health endpoints (inject + mocked Prisma). Prettier fix для 8 файлов. Команда агентов: Architect → Dev-CI + Dev-Backend (параллельно) → QA.
- **Changed:** apps/api test script: `echo` → `vitest run`. Добавлен vitest ^3.2.1 в apps/api devDependencies.
- **Notes:** Фаза 0 полностью завершена. Следующий шаг — Фаза 1.0 (CRUD API для пользователей и семей).

### 2026-02-10 (сессия 5)

- **Done:** Фаза 0.3 завершена — Fastify 5 сервер с healthcheck. Endpoints: GET /health, /health/db, /health/ready. Prisma plugin, CORS, Zod config validation, standard error format из ТЗ. Document Architect review создан (docs/document-review.md). Product Manager roadmap для фаз 0.3–1.0.
- **Changed:** Добавлен "type": "module" в packages/db, packages/shared, apps/api. fastify-plugin (не @fastify/plugin). PORT по умолчанию 3000.
- **Notes:** Следующий шаг — Фаза 0.4 (CI pipeline GitHub Actions).

### 2026-02-09 (сессия 4)

- **Done:** Создан полный feature backlog (`docs/feature-backlog.md`) — 15 epics, ~100 user stories, traceability matrix к ТЗ. PM-ревью backlog с критикой: MVP слишком большой (227 SP), FE-02a (skip onboarding) конфликтует с value prop, каталог 500 SKU нереалистичен по оценке.
- **Changed:** **CONTRACT CHANGE** — целевая платформа `foodie.fi` → `S-kaupat.fi` (foodie.fi редиректит). 82 ссылки обновлены в 7 файлах. Extension host_permissions теперь `https://www.s-kaupat.fi/*`.
- **Notes:** Добавлена story FE-02a (skip settings) + FAM-10 (quick-setup с дефолтами). Следующий шаг — Фаза 0.3 (Fastify сервер). Рекомендация PM: spike по DOM S-kaupat.fi до начала Extension разработки.

### 2026-02-09 (сессия 3)

- **Done:** Фаза 0.2 завершена — Prisma schema + local Docker PostgreSQL. 17 моделей, 8 enum-ов из ТЗ. Prisma Client сгенерирован. Schema pushed в локальную БД. QA: typecheck/lint/build — PASS.
- **Changed:** Локальная разработка через Docker PostgreSQL 16 вместо Neon (Neon — для staging/prod позже).
- **Notes:** Следующий шаг — Фаза 0.3 (базовый Fastify сервер с healthcheck).

### 2026-02-09 (сессия 2)

- **Done:** Фаза 0.1 завершена — monorepo инициализирован. Turborepo + npm workspaces, 5 workspace скелетов (@foodops/api, @foodops/web, @foodops/shared, @foodops/db, @foodops/chrome-extension). TypeScript strict, ESLint 9 flat config, Prettier. QA: typecheck/lint/build — всё PASS. Запушено на GitHub.
- **Changed:** @eslint/js понижен до ^9.0.0 (peer dep конфликт с ESLint 9). Next.js 15 (не 16).
- **Notes:** Следующий шаг — Фаза 0.2 (Neon PostgreSQL + Prisma schema).

---

## References

- **GitHub:** https://github.com/andrgavrilenko/foodops
- **Extension source of truth:** `extensions/chrome/README.md`
- **ТЗ (требования):** `docs/technical-specification.md` — FR-xxx, US-xxx, NFR-xxx
- **Рынок:** `docs/market-research.md` — TAM/SAM/SOM, конкуренты, S-Group
- **Инфраструктура:** `docs/infrastructure-specification.md` — Hetzner/Neon/Upstash
- **План работ:** `docs/project-plan.md` — WBS, Gantt, бюджет, milestones
- **Phase 1 план:** `docs/phase-1-plan.md` — 20 endpoints, 4 модуля, 32 SP
- **Phase 2 план:** `docs/phase-2-plan.md` — 8 endpoints, AI меню, 28 SP
- **Feature backlog:** `docs/feature-backlog.md` — 15 epics, MVP=166 SP
- **S-kaupat.fi:** https://www.S-kaupat.fi — целевой магазин (S-Market Helsinki)
- **Neon Console:** https://console.neon.tech — база данных
- **OpenAI API:** https://platform.openai.com — AI для генерации меню

---

## Workflow Rules (для Claude)

### В начале сессии (3 мин):

1. Прочитать Quick Context (one-liner, current focus, repo map, non-negotiables)
2. Открыть Work — Now, выбрать задачу ближе к Current focus с понятным DoD
3. Если задача про extension — открыть `extensions/chrome/README.md` (source of truth)
4. Sanity-check: запустить проект локально
5. Сформулировать план на 3-6 пунктов (файлы, критерий готовности, риски)

### Во время сессии:

- **Правило A:** Документы НЕ обновляем каждые 10 минут — только в конце сессии
- **Правило B:** Изменения контракта (API payload/endpoint/error codes) фиксируем сразу
- **Правило C:** Extension детали (regex, selectors, SPA wait, troubleshooting) — только в extension doc

### В конце сессии:

1. Work — Now: отметить выполненное, скорректировать следующий шаг
2. Progress Log: добавить 1 запись (Done / Changed / Notes)
3. Backlog: добавить новые задачи если появились
4. Extension doc: обновить если менялись patterns/error codes
5. API контракт: обновить если менялись endpoints/payloads
