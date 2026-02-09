# CLAUDE.md — FoodOps

---

## Quick Context

**One-liner:** FoodOps — AI-приложение для семей: планирование меню на неделю, автоформирование списка продуктов и автозаказ в S-Market (S-kaupat.fi) через Chrome Extension.

**Current focus:**

1. Фаза 0 — Инициализация проекта (repo, структура, tooling, CI)
2. Фаза 1 — Backend Core (модель данных, Prisma, базовый API)
3. Фаза 2 — AI модуль генерации меню

**Repo map:**

```
FoodOps/
├── CLAUDE.md                  # <-- вы здесь
├── docs/
│   ├── technical-specification.md   # ТЗ для архитектора (FR-xxx, US-xxx)
│   ├── market-research.md           # Маркетинговое исследование (Финляндия)
│   ├── infrastructure-specification.md  # ТЗ по инфраструктуре
│   └── project-plan.md             # План работ (WBS, Gantt, бюджет)
├── apps/
│   ├── web/                   # Next.js frontend (будет создан)
│   └── api/                   # Node.js + Fastify backend (будет создан)
├── packages/
│   ├── shared/                # Общие типы, утилиты (будет создан)
│   └── db/                    # Prisma schema + клиент (будет создан)
├── extensions/
│   └── chrome/                # Chrome Extension (будет создан)
│       └── README.md          # Source of truth по extension
└── package.json               # Monorepo root (будет создан)
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
| AI | OpenAI GPT-4o-mini API |
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
- [x] **Фаза 0.2** — Настройка Neon PostgreSQL, Prisma schema (модель данных из ТЗ)
- [x] **Фаза 0.3** — Базовый Fastify сервер с healthcheck
- [ ] **Фаза 0.4** — CI pipeline (GitHub Actions: lint, typecheck, test)

---

## Backlog

- [feat] Фаза 1: CRUD API для пользователей и семей — DoD: POST/GET/PATCH/DELETE /api/users, /api/families работают с тестами
- [feat] Фаза 1: CRUD API для рецептов — DoD: endpoints по FR-100..FR-110
- [feat] Фаза 2: AI генерация меню — DoD: POST /api/menu/generate возвращает меню на неделю (US-001..US-005)
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

### 2026-02-09 (сессия 1)

- **Done:** Создана документация проекта (ТЗ архитектора, маркетинговое исследование, ТЗ инфраструктуры, план работ). Создан CLAUDE.md.
- **Changed:** —
- **Notes:** Проект на стадии pre-code. Следующий шаг — Фаза 0 (инициализация repo).

---

## References

- **GitHub:** https://github.com/andrgavrilenko/foodops
- **Extension source of truth:** `extensions/chrome/README.md`
- **ТЗ (требования):** `docs/technical-specification.md` — FR-xxx, US-xxx, NFR-xxx
- **Рынок:** `docs/market-research.md` — TAM/SAM/SOM, конкуренты, S-Group
- **Инфраструктура:** `docs/infrastructure-specification.md` — Hetzner/Neon/Upstash
- **План работ:** `docs/project-plan.md` — WBS, Gantt, бюджет, milestones
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
