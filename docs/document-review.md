# FoodOps Documentation Review Report

**Reviewer:** Document Architect (AI)
**Date:** 2026-02-09
**Scope:** All project documentation, Prisma schema, Docker config, root package.json
**Documents reviewed:** 8 files

---

## 1. Executive Summary

**Overall Quality Score: 7/10**

The documentation set is impressively thorough for a pre-MVP project. The technical specification, market research, infrastructure spec, and project plan together form a comprehensive blueprint. However, there are significant inconsistencies between documents, gaps between the data model specification and the Prisma implementation, and several architectural contradictions that need resolution before proceeding.

**Top 3 Critical Issues:**

1. **Infrastructure specification contradicts CLAUDE.md on backend framework** -- infra spec mentions NestJS/FastAPI throughout, while CLAUDE.md and the actual implementation use Fastify. This creates confusion about the canonical tech stack.
2. **Infrastructure spec describes tables that do not exist in the Prisma schema** -- `user_settings`, `dietary_prefs`, `recipe_tags`, `recipe_nutrition`, `product_prices`, `product_categories`, `product_matches`, `purchase_history`, `store_catalogs` are referenced in the infra spec (section 4.1) but have no corresponding Prisma models.
3. **Tech spec data model describes a `type` field on MedicalRestriction (ER diagram, line 511)** but neither the detailed table description (section 6.2) nor the Prisma schema include a `type` field on `MedicalRestriction`. The ER diagram is inconsistent with its own specification text.

---

## 2. Critical Issues (Must Fix Before Proceeding)

### C-01: Backend Framework Contradiction Across Documents

**Files:**
- `C:\Users\andrg\coding-projects\foodops\CLAUDE.md` (line 51): `Backend | Node.js / Fastify / TypeScript`
- `C:\Users\andrg\coding-projects\foodops\docs\infrastructure-specification.md` (line 34): `Backend API | Node.js (NestJS) or Python (FastAPI)`
- `C:\Users\andrg\coding-projects\foodops\docs\infrastructure-specification.md` (line 72): `Backend API (NestJS/FastAPI)`
- `C:\Users\andrg\coding-projects\foodops\docs\infrastructure-specification.md` (line 302): `backend-api: # NestJS/FastAPI backend`
- `C:\Users\andrg\coding-projects\foodops\docs\project-plan.md` (line 52): `Backend | Node.js 20 LTS, NestJS/Fastify, TypeScript, Prisma ORM`
- `C:\Users\andrg\coding-projects\foodops\docs\project-plan.md` (line 111): `Scaffolding NestJS/Fastify with TypeScript`
- `C:\Users\andrg\coding-projects\foodops\docs\technical-specification.md` (line 1543): `Framework | Fastify or NestJS`

**Impact:** A developer starting work on Phase 0.3 (Fastify server) would see conflicting instructions across documents. The infrastructure spec even mentions Python FastAPI, which is not in CLAUDE.md at all.

**Recommendation:** Since CLAUDE.md is the source of truth and Phase 0.3 explicitly says "Fastify server", update all documents to consistently say "Fastify" and remove NestJS/FastAPI references.

---

### C-02: Infra Spec Database Schema Does Not Match Prisma Schema

**File:** `C:\Users\andrg\coding-projects\foodops\docs\infrastructure-specification.md` (lines 362-387)

The infrastructure specification section 4.1 describes a database schema tree with tables that have no corresponding Prisma models:

| Infra spec table | Prisma model exists? | Notes |
|---|---|---|
| `user_settings` | No | No settings model in schema |
| `dietary_prefs` | No | `Preference` model exists but is different |
| `recipe_tags` | No | Tags stored as JSON on Recipe model |
| `recipe_nutrition` | No | Nutrition fields are on Recipe model directly |
| `product_prices` | No | No price history tracking |
| `product_categories` | No | Category is a string field on Product |
| `product_matches` | No | `IngredientMapping` exists instead |
| `purchase_history` | No | No purchase tracking at all |
| `store_catalogs` | No | No catalog entity |
| `menu_meals` | No | Named `meals` in Prisma |

**Impact:** The infra spec gives a misleading picture of the data architecture. Anyone reading the infra spec would design a significantly different database than what is actually implemented.

**Recommendation:** Update the infra spec section 4.1 to match the actual 17-model Prisma schema, or remove the schema outline entirely and reference the tech spec section 6.

---

### C-03: AI API Cost Estimate Contradiction

**Files:**
- `C:\Users\andrg\coding-projects\foodops\docs\technical-specification.md` (lines 1429-1435): Cost per request for GPT-4o = ~$0.03, monthly cost for 1000 users = **$360-540**
- `C:\Users\andrg\coding-projects\foodops\docs\infrastructure-specification.md` (lines 278-283): Monthly cost for 1000 users = **~$33**
- `C:\Users\andrg\coding-projects\foodops\docs\project-plan.md` (lines 430-435): Monthly cost for 1000 users = **~$33**

**Impact:** The tech spec estimates AI costs at 10-16x more than the infra spec and project plan. This is a significant discrepancy. The tech spec's $0.03/request with 2-3 requests/user/week = ~$360/month for 1000 users, which is realistic. The infra spec's $33/month is unrealistically low for GPT-4o.

**Root cause:** The infra spec likely used GPT-4o-mini pricing (~$0.003/request) while the tech spec used GPT-4o pricing (~$0.03/request). But the infra spec also says "GPT-4o-mini (main)" at line 270 while the tech spec says "GPT-4o" at line 1377.

**Recommendation:** Decide which model is the primary one (GPT-4o or GPT-4o-mini), update all documents consistently, and recalculate costs. This also affects the budget in project-plan.md section 8.

---

### C-04: Missing `calorie_target` / `calorie_target_per_person` in Data Model

**File:** `C:\Users\andrg\coding-projects\foodops\docs\technical-specification.md` (line 924)

The Family Preferences API contract (PUT /family/preferences) accepts `calorie_target_per_person: 2000`, but:
- There is no `calorie_target` field on any Prisma model
- The `Preference` model uses a type/value pattern, so it could be stored as a Preference with type="calorie_target", but this is not documented
- The AI prompt builder (section 8.2.2, line 1419) references calorie targets, which must come from somewhere in the data model

**Impact:** The Family API implementation will not know where to store the calorie target.

**Recommendation:** Either add a `calorieTargetPerPerson` field to the Family model, or explicitly document how calorie targets are stored in the Preference model (what PreferenceType value to use).

---

## 3. Major Issues (Should Fix Soon)

### M-01: Auth Module Architecture Undecided

**Files:**
- `C:\Users\andrg\coding-projects\foodops\docs\infrastructure-specification.md` (lines 1047-1069): Recommends Clerk or Auth.js
- `C:\Users\andrg\coding-projects\foodops\docs\technical-specification.md` (line 1547): Lists `Passport.js + JWT (jsonwebtoken)`
- `C:\Users\andrg\coding-projects\foodops\docs\project-plan.md` (lines 99, 114): References Clerk integration
- `C:\Users\andrg\coding-projects\foodops\CLAUDE.md`: No auth technology listed in tech stack table

**Impact:** Three different auth approaches are mentioned across documents. This must be resolved before Phase 1 (Auth module).

**Recommendation:** Pick one and update all documents. Per the Memory file, the user explicitly said to skip auth module for now, so this is not blocking yet, but it needs resolution before Phase 1.

---

### M-02: Missing Prisma Schema Features for Described Functionality

**File:** `C:\Users\andrg\coding-projects\foodops\packages\db\prisma\schema.prisma`

Several features described in the tech spec have no data model support:

| Feature | Spec Reference | Missing from Prisma |
|---|---|---|
| User role / RBAC | Infra spec section 8.1 (lines 1073-1079) | No `role` field on User model |
| Refresh token storage | NFR-020, API section 7.2 | No `RefreshToken` model |
| Shopping list `alternatives` | API response (line 1108) | No alternatives relation on ShoppingListItem |
| `line_total` on shopping items | API response (line 1107) | Not a stored field (computed?) -- undocumented |
| Consent/GDPR tracking | NFR-022, infra spec section 8.2 | No consent model |
| Recipe `servings` default count | FR-111 | No `servings` field on Recipe |
| API key for extension | Infra spec section 8.1 | No API key model |

---

### M-03: Infra Spec Monorepo Structure Differs from Actual

**File:** `C:\Users\andrg\coding-projects\foodops\docs\infrastructure-specification.md` (lines 677-688)

The infra spec describes this monorepo structure:
```
apps/
  web/
  api/
  ai/           <-- NOT in actual repo
  extension/    <-- In repo as extensions/chrome/
packages/
  shared/
  database/     <-- In repo as packages/db/
  config/       <-- NOT in actual repo
infra/          <-- NOT in actual repo
```

Actual structure (from CLAUDE.md and package.json workspaces):
```
apps/
  web/
  api/
packages/
  shared/
  db/
extensions/
  chrome/
```

**Impact:** The `ai/` app, `config/` package, and `infra/` directory from the infra spec are not in the actual structure. The extension is in `extensions/chrome/` not `apps/extension/`.

---

### M-04: Tech Spec Section 5 Mentions "Anthropic API" as Alternative, But CLAUDE.md Says "AI through OpenAI API (not self-hosted)"

**Files:**
- `C:\Users\andrg\coding-projects\foodops\docs\technical-specification.md` (line 452): `OpenAI GPT-4o / Anthropic Claude`
- `C:\Users\andrg\coding-projects\foodops\docs\technical-specification.md` (line 345): Architecture diagram mentions `Anthropic API`
- `C:\Users\andrg\coding-projects\foodops\docs\infrastructure-specification.md` (line 273): `Fallback | Claude 3.5 Haiku (Anthropic API)`
- `C:\Users\andrg\coding-projects\foodops\CLAUDE.md` (line 52): `AI | OpenAI GPT-4o-mini API`

**Impact:** Minor -- having a fallback is fine, but CLAUDE.md says "OpenAI GPT-4o-mini" while the tech spec says "GPT-4o" as primary. The model choice affects cost estimates significantly.

---

### M-05: `foodie.fi` vs `S-kaupat.fi` Platform Confusion — RESOLVED

**Status:** RESOLVED (2026-02-09). Confirmed: foodie.fi redirects to S-kaupat.fi. All references across all project documents have been updated to S-kaupat.fi. Market-research.md retains historical mentions for context.

---

### M-06: Missing `updatedAt` on Multiple Models

**File:** `C:\Users\andrg\coding-projects\foodops\packages\db\prisma\schema.prisma`

Only 3 models have `updatedAt`: User (line 79), Recipe (line 201), Product (line 270).

Missing `updatedAt` on models that will be frequently updated:
- `Family` -- users change budget, preferences, store
- `FamilyMember` -- age changes yearly, restrictions change
- `DietaryRestriction` -- may be updated
- `Preference` -- users change preferences
- `WeeklyMenu` -- status transitions (draft -> approved -> archived)
- `ShoppingList` -- status transitions, total_cost updates
- `ShoppingListItem` -- status changes, quantity changes

**Impact:** No audit trail for when records were last modified. Important for debugging, caching invalidation, and sync logic.

---

### M-07: Missing Indexes for Common Query Patterns

**File:** `C:\Users\andrg\coding-projects\foodops\packages\db\prisma\schema.prisma`

Based on the API contracts and expected query patterns:

| Missing Index | Query Pattern | Reference |
|---|---|---|
| `WeeklyMenu(familyId, weekStart)` composite | GET menu by family + week | Menu API, history |
| `WeeklyMenu(familyId, status)` composite | Filter menus by status | Menu history page |
| `Product(nameFi)` text search | Product search by Finnish name | FR-210, Catalog API |
| `Product(category)` | Category-based product filtering | FR-202 |
| `Ingredient(nameEn)` / `Ingredient(nameFi)` | Ingredient search | Mapping logic |
| `ShoppingList(familyId, status)` composite | Active shopping list lookup | Extension API |
| `Meal(menuDayId, mealType)` unique | Prevent duplicate meals per slot | Data integrity |
| `MenuDay(menuId, dayOfWeek)` unique | Prevent duplicate days per menu | Data integrity |

---

### M-08: Shopping List API Response Contains Fields Not in Data Model

**File:** `C:\Users\andrg\coding-projects\foodops\docs\technical-specification.md` (lines 1076-1123)

The POST /shopping-list/generate response includes:
- `categories` grouping (line 1080) -- no category field on ShoppingListItem
- `line_total` per item (line 1107) -- not in Prisma model
- `alternatives` array per item (line 1108) -- no relation in Prisma
- `items_count` (line 1121) -- computed, but undocumented

These are likely computed at query time, but the API contract does not document which fields are stored vs. computed. This ambiguity will cause implementation confusion.

---

## 4. Minor Issues (Nice to Fix)

### N-01: CLAUDE.md Backlog References Wrong US IDs

**File:** `C:\Users\andrg\coding-projects\foodops\CLAUDE.md` (line 96)

> `[feat] Phase 2: AI menu generation -- DoD: POST /api/menu/generate returns weekly menu (US-001..US-005)`

US-001 to US-005 are registration and family profile user stories, not menu generation. Menu generation is US-010 to US-016.

---

### N-02: Docker-compose.yml Is Minimal -- Missing Services Listed in Infra Spec

**File:** `C:\Users\andrg\coding-projects\foodops\docker-compose.yml`

The actual docker-compose.yml only contains PostgreSQL. The infrastructure spec (section 3.3, line 299-308) describes these services: backend-api, ai-service, meilisearch, redis, nginx, worker.

This is expected for the current phase (0.2 -- just DB setup), but the comment "docker-compose.yml -- local dev environment" in the review request implies it should be more complete.

---

### N-03: Tech Spec Section 5 Says "React SPA" but Stack Is Next.js (SSR/SSG)

**File:** `C:\Users\andrg\coding-projects\foodops\docs\technical-specification.md` (line 352)

> `Web Application | (React SPA)`

But the tech stack says Next.js 14+ with App Router (line 1521), which is SSR/SSG, not a pure SPA. This is a labeling inconsistency.

---

### N-04: API URL Prefix Inconsistency

**Files:**
- Tech spec API contracts (line 727): Base URL is `https://api.foodops.app/v1`
- CLAUDE.md backlog (line 94): References `/api/users`, `/api/families`
- Infra spec (line 585): Domain is `api.foodops.fi`

Three different API URL patterns: `api.foodops.app/v1`, `/api/...`, and `api.foodops.fi`. The domain decision (`.app` vs `.fi`) needs to be settled, and whether the API uses `/v1` prefix or not.

---

### N-05: MedicalRestriction ER Diagram Shows `type` Field That Does Not Exist

**File:** `C:\Users\andrg\coding-projects\foodops\docs\technical-specification.md` (line 511)

The ER diagram shows `MedicalRestriction` with a `type` field, but:
- The detailed table description (line 625-630) does not include `type`
- The Prisma schema does not include `type`
- The model has `condition` instead

The ER diagram is internally inconsistent with section 6.2.

---

### N-06: `caloriesPerServing` Uses SmallInt in Prisma -- May Overflow

**File:** `C:\Users\andrg\coding-projects\foodops\packages\db\prisma\schema.prisma` (line 192)

`caloriesPerServing Int? @map("calories_per_serving") @db.SmallInt`

SmallInt max value is 32,767. While individual per-serving calories are unlikely to exceed this, the `totalCalories` field on WeeklyMenu (line 331) is a regular `Int`, which is correct. But if someone enters a high-calorie recipe (e.g., a large dessert at 2000+ cal/serving), SmallInt is fine. The concern is more about `age` on FamilyMember (line 119) using SmallInt -- while technically fine, there is no validation constraint ensuring age is positive and reasonable (0-150).

---

### N-07: No Soft Delete Support

**File:** `C:\Users\andrg\coding-projects\foodops\packages\db\prisma\schema.prisma`

No model has a `deletedAt` field. While hard deletes are simpler, GDPR requires the ability to delete data. Consider whether GDPR "right to erasure" (Art. 17) requires actual deletion or if anonymization is sufficient. The infra spec (line 1131-1137) mentions both "deletion within 30 days" and "anonymization", but the schema supports neither pattern explicitly.

---

### N-08: Tech Spec Auth Mentions Apple OAuth, but Apple is Not in the Extension Permissions

**File:** `C:\Users\andrg\coding-projects\foodops\docs\technical-specification.md` (line 584)

Auth provider options include "apple", but Apple Sign-In is deferred to v1.1 (line 1485). This is documented correctly in the MVP scope but inconsistently -- the auth_provider field allows "apple" from day one.

---

### N-09: Preference Model `calorie_target_per_person` Has No PreferenceType Enum Value

**File:** `C:\Users\andrg\coding-projects\foodops\packages\db\prisma\schema.prisma` (lines 35-39)

The `PreferenceType` enum only has: `CUISINE`, `EXCLUDED_INGREDIENT`, `FAVORITE_RECIPE`.

The API (PUT /family/preferences) accepts `calorie_target_per_person`, but there is no enum value to store this. Either a new enum value is needed, or the calorie target should be a field on Family.

---

## 5. Inconsistencies (Cross-Document Conflicts)

### I-01: Phase Numbering Mismatch

| Document | Phase 0 | Phase 1 | Phase 2 |
|---|---|---|---|
| CLAUDE.md Work-Now | 0.1-0.4: Monorepo, DB, Fastify, CI | Phase 1: CRUD APIs | Phase 2: AI |
| Project Plan | Phase 0: Prep + infra (14 tasks) | Phase 1: Backend Core (13 tasks) | Phase 2: AI/ML (10 tasks) |

These roughly align, but CLAUDE.md's "Phase 0.2 = Neon + Prisma schema" corresponds to project plan task 1.2 (which is in Phase 1, not Phase 0). The Phase 0 in project-plan.md includes domain registration, Hetzner setup, Cloudflare, etc. -- which CLAUDE.md does not mention at all in its Phase 0.

**Impact:** Ambiguity about what "Phase 0.3" means -- is it the CLAUDE.md definition (Fastify server) or the project plan definition (task 0.3 = GitHub repo creation)?

---

### I-02: Budget Numbers Do Not Match Between Documents

**Infrastructure spec section 9.1 (line 1291):** MVP total = **$27-76/month**
**Project plan section 8.1 (line 392):** MVP total = **$27-76/month** (matches)
**Project plan section 8.5 (line 462):** 4-month infrastructure cost = **100-280 EUR**

But $27-76/month x 4 months = $108-304. Using EUR/USD parity this is approximately right, but the document mixes currencies (USD in the infra spec, EUR in the project plan budget summary) without explicit conversion.

---

### I-03: NFR-001 Says Menu Generation < 15 Seconds, Infra Spec Says < 10 Seconds

**Files:**
- `C:\Users\andrg\coding-projects\foodops\docs\technical-specification.md` (line 221): NFR-001: `< 15 seconds`
- `C:\Users\andrg\coding-projects\foodops\docs\infrastructure-specification.md` (line 123): `< 10 sec` (MVP), `< 5 sec` (Scale)

The infra spec is stricter than the tech spec. Which one is authoritative?

---

### I-04: Tech Spec and Infra Spec Disagree on Search Engine

- **CLAUDE.md (line 56):** `Search | Meilisearch`
- **Tech spec (line 1556):** `PostgreSQL FTS (MVP) / Elasticsearch (v2.0)` -- no Meilisearch mention
- **Infra spec (line 39, 456):** `Meilisearch / Typesense`
- **Project plan (line 55):** `Meilisearch`

The tech spec section 10 suggests PostgreSQL full-text search for MVP and Elasticsearch for scale, while all other documents say Meilisearch.

---

### I-05: Backend Hosting Contradiction

- **CLAUDE.md (line 60):** `Hosting (MVP) | Hetzner Cloud (Helsinki)`
- **Tech spec (line 1571):** `Vercel (frontend) + Railway / Render / Fly.io (backend)` -- no mention of Hetzner
- **Infra spec (line 135):** `Hetzner Cloud + Managed Services (recommended for MVP)`
- **Project plan (line 56):** `Hetzner Cloud (Helsinki), Vercel, Cloudflare, GitHub Actions`

The tech spec suggests Railway/Render/Fly.io for backend hosting, while everything else says Hetzner.

---

### I-06: GPT Model Version Inconsistency

| Document | Primary Model |
|---|---|
| CLAUDE.md | GPT-4o-mini |
| Tech spec section 8.2.1 | GPT-4o |
| Tech spec section 10 | GPT-4o |
| Infra spec section 3.2 | GPT-4o-mini (primary), GPT-4o (complex tasks) |
| Project plan section 1.4 | GPT-4o (Structured Outputs) |

---

## 6. Recommendations

### R-01: Establish Document Hierarchy and Single Source of Truth

**Priority: High**

Currently, there is no clear hierarchy for which document wins on contradictions. Suggested hierarchy:
1. **CLAUDE.md** -- canonical tech stack decisions and current phase definitions
2. **Tech spec** -- canonical for requirements (FR/US/NFR) and API contracts
3. **Infra spec** -- canonical for infrastructure and deployment decisions
4. **Project plan** -- canonical for timeline and budget

When conflicts arise, the higher-priority document should be updated first, then lower-priority documents should be aligned.

### R-02: Reconcile Infrastructure Spec with Reality

**Priority: High**

The infrastructure specification appears to have been written independently of the tech spec and before key decisions (Fastify vs NestJS, monorepo structure, AI model choice) were made. It needs a pass to align with CLAUDE.md decisions.

### R-03: Add Missing Unique Constraints to Prisma Schema

**Priority: Medium**

- `MenuDay(menuId, dayOfWeek)` -- prevent duplicate days in a menu
- `Meal(menuDayId, mealType)` -- prevent duplicate meal types per day (unless multiple recipes per meal type is intended)
- `WeeklyMenu(familyId, weekStart)` -- prevent duplicate menus for the same week
- `ShoppingList(menuId)` -- one shopping list per menu (or is multiple intentional?)

### R-04: Validate foodie.fi vs S-kaupat.fi Before Extension Development — RESOLVED

**Priority: High** — **RESOLVED (2026-02-09)**

Confirmed: foodie.fi redirects to S-kaupat.fi. All project references updated. Extension must target `https://www.s-kaupat.fi/*`.

### R-05: Add GDPR Data Model Support

**Priority: Medium (before Phase 1)**

Add models or fields for:
- Consent tracking (what the user consented to and when)
- Data export endpoint support
- Account deletion cascade verification

### R-06: Standardize API Path Convention

**Priority: Low**

Decide whether endpoints use:
- `/v1/family` (versioned, tech spec style)
- `/api/families` (CLAUDE.md backlog style)
- Singular vs plural nouns (`/family` vs `/families`)

Currently the tech spec uses singular (`/family`, `/menu`, `/shopping-list`) while CLAUDE.md uses plural (`/users`, `/families`).

### R-07: Add `createdAt` / `updatedAt` to All Models

**Priority: Medium**

Standard practice for any model that can be updated. Currently missing on: DietaryRestriction, MedicalRestriction, Preference, Ingredient, RecipeIngredient, IngredientMapping, MenuDay, Meal, ShoppingListItem.

### R-08: Document Computed vs Stored Fields in API Contracts

**Priority: Low**

The API response for shopping list includes `line_total`, `alternatives`, `items_count`, and `categories` grouping, none of which are stored in the database. Document which response fields are computed at query time to prevent confusion during implementation.

---

## Appendix: What Is Good

To be fair, several things are done well:

- **Market research** is thorough and well-sourced with specific data for Finland
- **Tech spec user stories and functional requirements** are comprehensive and well-organized with clear IDs
- **Prisma schema** correctly implements all 17 models from the tech spec section 6 with proper relations, cascade rules, and column mappings
- **Prisma schema naming convention** is consistent: camelCase in code, snake_case in DB via `@map()`, which is best practice
- **Project plan WBS** has excellent traceability -- Appendix A maps every requirement to a task
- **Risk analysis** in both tech spec and project plan is realistic and actionable
- **CLAUDE.md workflow rules** are practical and well-structured for AI-assisted development
- **Docker-compose.yml** is appropriately minimal for the current phase with proper healthcheck configuration

---

_End of review. This report should be revisited after the identified issues are resolved and before starting Phase 1._
