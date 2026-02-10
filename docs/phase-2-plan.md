# Phase 2.0 Implementation Plan — AI Menu Generation

**Created:** 2026-02-10
**Owner:** Product Manager
**Status:** Ready for Implementation
**Duration Estimate:** 2.5 weeks (Sprint 3)
**Scope:** AI-powered weekly menu generation — OpenAI GPT-4o-mini integration, menu CRUD, meal replacement (FR-100..FR-104, FR-110..FR-113, US-010..US-016)
**Prerequisites:** Phase 1.0 (Auth, Family, Preferences) and Phase 1.1 (Recipe CRUD) must be complete

---

## 1. Objectives

Phase 2.0 delivers the core AI-powered menu generation feature:

- One-click weekly menu generation using OpenAI GPT-4o-mini
- Full respect for family profile: members, dietary/medical restrictions, preferences, budget, calorie target
- Meal replacement (regenerate a single meal with 3-5 alternatives)
- Lock/unlock individual meals (preserved during regeneration)
- Menu approval workflow (DRAFT -> APPROVED)
- Menu history with pagination
- AI-generated recipes stored in the Recipe table for reuse
- GDPR-compliant prompt construction (anonymized member data)

**Definition of Done:**

- All 7 endpoints working with 200/201/400/401/404/429/500 responses per tech spec section 7.4
- API contracts match technical-specification.md section 7.4 exactly
- Vitest tests for all endpoints (happy path + error cases + mocked OpenAI)
- OpenAI integration with structured JSON output and Zod validation
- Retry logic: up to 3 attempts on invalid AI response
- Rate limiting: 10 menu generations per hour per user (NFR-023)
- Menu scoped by familyId, accessible only by family owner
- snake_case JSON responses matching existing API conventions
- All error codes documented and implemented

---

## 2. Endpoints to Implement

### 2.1 Menu Generation (MENU-01, MENU-02, MENU-03, MENU-04, MENU-12)

| Method             | Endpoint       | Request Body                    | Response                                            | Priority | Story Points |
| ------------------ | -------------- | ------------------------------- | --------------------------------------------------- | -------- | ------------ |
| POST               | /menu/generate | `{ week_start, locked_meals? }` | 200: `{ menu }` (full menu with days/meals/recipes) | P0       | 8            |
| **Total GENERATE** |                |                                 |                                                     |          | **8 SP**     |

**Implementation Notes:**

- `week_start` -- ISO date string (YYYY-MM-DD), must be a Monday. If omitted, defaults to next Monday.
- `locked_meals` -- optional array of `{ day: number, meal_type: string, recipe_id: string }`. These meals are preserved from previous menu and excluded from AI generation.
- Flow: fetch family profile (members, restrictions, preferences, budget, calorie target) -> construct AI prompt -> call OpenAI -> validate response -> create/update recipes in DB -> create WeeklyMenu + MenuDay + Meal records -> return full menu.
- If family has an existing DRAFT menu for the same `week_start`, it is replaced (deleted and regenerated).
- `meals_per_day` from family profile determines whether breakfast/lunch/dinner or lunch/dinner are generated.
- `servings` on each Meal = count of family members (adults + children, excluding infants for calorie calculation).
- Rate limit: 10 requests/hour per user (separate from global rate limit). Return 429 if exceeded.
- Response time target: < 15 seconds (NFR-001).

**Error Codes:**

- `MENU_FAMILY_NOT_FOUND` -- user has no family profile
- `MENU_FAMILY_INCOMPLETE` -- family has no members (at least 1 required)
- `MENU_GENERATION_RATE_LIMIT` -- exceeded 10 generations/hour
- `MENU_AI_GENERATION_FAILED` -- OpenAI returned invalid data after 3 retries
- `MENU_INVALID_WEEK_START` -- date is not a Monday or is in the past

---

### 2.2 Menu Retrieval (MENU-08)

| Method              | Endpoint      | Request Body              | Response                            | Priority | Story Points |
| ------------------- | ------------- | ------------------------- | ----------------------------------- | -------- | ------------ |
| GET                 | /menu/current | (auth header)             | 200: `{ menu }` or 404              | P0       | 2            |
| GET                 | /menu/:id     | (auth header)             | 200: `{ menu }`                     | P0       | 2            |
| GET                 | /menu/history | Query: `?page=1&limit=10` | 200: `{ data: menu[], pagination }` | P1       | 2            |
| **Total RETRIEVAL** |               |                           |                                     |          | **6 SP**     |

**Implementation Notes:**

- `GET /menu/current` -- returns the most recent menu for the user's family (any status). Returns 404 if no menus exist.
- `GET /menu/:id` -- returns a specific menu with full nested data (days -> meals -> recipes with ingredients). Menu must belong to the user's family.
- `GET /menu/history` -- paginated list of past menus sorted by `week_start` DESC. Returns summary info only (no nested recipes). Uses page-based pagination matching existing patterns (`page`, `limit`, `total`, `total_pages`).
- All menu responses include `summary` object: `total_calories`, `avg_daily_calories_per_person`, `total_cost_estimate`, `macros { protein_pct, carbs_pct, fat_pct }`.

**Error Codes:**

- `MENU_NOT_FOUND` -- menu with given ID does not exist
- `MENU_ACCESS_DENIED` -- menu does not belong to user's family

---

### 2.3 Meal Modification (MENU-05, MENU-06)

| Method                 | Endpoint                         | Request Body    | Response                                   | Priority | Story Points |
| ---------------------- | -------------------------------- | --------------- | ------------------------------------------ | -------- | ------------ |
| PATCH                  | /menu/:menuId/meals/:mealId      | `{ recipe_id }` | 200: `{ meal }` (updated meal with recipe) | P0       | 5            |
| PATCH                  | /menu/:menuId/meals/:mealId/lock | `{ is_locked }` | 200: `{ meal }`                            | P1       | 2            |
| **Total MODIFICATION** |                                  |                 |                                            |          | **7 SP**     |

**Implementation Notes:**

- `PATCH /menu/:menuId/meals/:mealId` (replace meal, FR-112):
  - Replaces the recipe for a specific meal in the menu.
  - `recipe_id` must reference an existing recipe in the Recipe table.
  - Menu must be in DRAFT status. Replacing meals in APPROVED menus is not allowed.
  - After replacement, recalculate menu `total_cost_estimate` and `total_calories`.
  - To get alternatives for replacement, the frontend first calls `POST /menu/:menuId/meals/:mealId/alternatives` (see below).

- `PATCH /menu/:menuId/meals/:mealId/lock` (lock/unlock, FR-113):
  - Sets `is_locked` flag on the meal. Locked meals are excluded from regeneration.
  - Menu must be in DRAFT status.

**Additional endpoint for alternatives (supports MENU-05 / FR-112):**

| Method                 | Endpoint                                 | Request Body                         | Response                                        | Priority | Story Points |
| ---------------------- | ---------------------------------------- | ------------------------------------ | ----------------------------------------------- | -------- | ------------ |
| POST                   | /menu/:menuId/meals/:mealId/alternatives | `{}` (empty or optional preferences) | 200: `{ alternatives: recipe[] }` (3-5 recipes) | P0       | 5            |
| **Total ALTERNATIVES** |                                          |                                      |                                                 |          | **5 SP**     |

- Calls OpenAI to generate 3-5 alternative recipes for the given meal slot.
- Respects the same family restrictions/preferences as the original generation.
- The AI prompt includes context about the existing menu (to avoid duplicates).
- Alternatives are stored as Recipe records so the user can select one via PATCH.
- Rate-limited under the same 10 generations/hour cap.

**Error Codes:**

- `MENU_NOT_FOUND` -- menu does not exist
- `MENU_ACCESS_DENIED` -- menu does not belong to user's family
- `MENU_NOT_DRAFT` -- cannot modify an approved/archived menu
- `MEAL_NOT_FOUND` -- meal does not exist in this menu
- `RECIPE_NOT_FOUND` -- replacement recipe_id does not exist

---

### 2.4 Menu Approval (MENU-07)

| Method             | Endpoint          | Request Body              | Response                          | Priority | Story Points |
| ------------------ | ----------------- | ------------------------- | --------------------------------- | -------- | ------------ |
| POST               | /menu/:id/approve | (auth header, empty body) | 200: `{ menu }` (status=APPROVED) | P0       | 2            |
| **Total APPROVAL** |                   |                           |                                   |          | **2 SP**     |

**Implementation Notes:**

- Changes menu status from DRAFT to APPROVED.
- Only DRAFT menus can be approved. Returns error for already-approved or archived menus.
- Approving a menu is a prerequisite for shopping list generation (Phase 3).
- If the family already has another APPROVED menu, the previous one is automatically ARCHIVED.
- Response returns the full menu object with updated status.

**Error Codes:**

- `MENU_NOT_FOUND` -- menu does not exist
- `MENU_ACCESS_DENIED` -- menu does not belong to user's family
- `MENU_ALREADY_APPROVED` -- menu is already approved
- `MENU_ALREADY_ARCHIVED` -- cannot approve an archived menu

---

### Summary Table

| Module              | Endpoints                                           | Total SP  |
| ------------------- | --------------------------------------------------- | --------- |
| Menu Generation     | POST /menu/generate                                 | 8         |
| Menu Retrieval      | GET /menu/current, GET /menu/:id, GET /menu/history | 6         |
| Meal Modification   | PATCH meals, PATCH lock, POST alternatives          | 12        |
| Menu Approval       | POST /menu/:id/approve                              | 2         |
| **TOTAL PHASE 2.0** | **8 endpoints**                                     | **28 SP** |

---

## 3. AI Integration Design

### 3.1 OpenAI SDK Setup

- **Package:** `openai` (official OpenAI Node.js SDK, latest version)
- **Model:** `gpt-4o-mini` (primary). Plan B: DeepSeek V3 via OpenAI-compatible API.
- **Configuration:** `OPENAI_API_KEY` and `OPENAI_MODEL` added to `config.ts` env schema.
- **Timeout:** 30 seconds per API call (15-second NFR target includes all 3 retry attempts).
- **Token budget:** max_tokens=4000 per request (sufficient for 7-day menu JSON).

### 3.2 Prompt Structure

**System Prompt (static, ~300 tokens):**

```
You are a professional family nutritionist and chef specializing in Finnish and international cuisine.
Your task is to generate a weekly meal plan for a family living in Finland.

Rules:
1. Generate exactly {meals_per_day} meals per day for 7 days (Monday through Sunday).
2. Each meal must have a unique recipe — no repeated main dishes within the same week.
3. All recipes must be safe for ALL family members considering their dietary and medical restrictions.
4. Ingredients must be commonly available in Finnish grocery stores (S-Market / S-kaupat.fi).
5. Recipes should be practical for home cooking with prep time under 60 minutes.
6. Provide both English and Finnish names for each recipe and ingredient.
7. If a weekly budget is specified, optimize total ingredient cost to stay within budget.
8. If a calorie target is specified, aim for ±20% of the target per person per day.
9. Respond ONLY with valid JSON matching the exact schema provided below.
```

**User Prompt (dynamic, ~200-500 tokens):**

```json
{
  "family": {
    "members": [
      { "role": "adult", "age": 35 },
      { "role": "adult", "age": 33 },
      { "role": "child", "age": 8 }
    ],
    "servings": 3,
    "meals_per_day": 3
  },
  "restrictions": {
    "dietary": [
      { "member": "Member 1 (adult, 35)", "type": "allergy", "value": "nuts", "severity": "strict" }
    ],
    "medical": [{ "member": "Member 1 (adult, 35)", "condition": "high_cholesterol" }]
  },
  "preferences": {
    "cuisines": ["finnish", "italian", "asian"],
    "excluded_ingredients": ["cilantro", "blue_cheese"]
  },
  "budget": {
    "weekly_budget_eur": 150,
    "calorie_target_per_person": 2000
  },
  "locked_meals": [],
  "previous_weeks_recipes": []
}
```

**GDPR Compliance (GDPR-06):**

- No real names are sent to OpenAI. Members are anonymized as "Member 1 (adult, 35)", "Member 2 (child, 8)", etc.
- No email addresses, user IDs, or family IDs are included in the prompt.
- Only restriction types, values, and ages are transmitted.

### 3.3 Expected AI Output Schema

The AI must return JSON matching this Zod schema (validated server-side):

```
{
  "days": [
    {
      "day_of_week": 1,       // 1=Monday, 7=Sunday
      "meals": [
        {
          "meal_type": "breakfast" | "lunch" | "dinner",
          "recipe": {
            "title_en": "Oatmeal with Berries",
            "title_fi": "Marjapuuro",
            "description_en": "Warm oatmeal topped with fresh seasonal berries and honey",
            "description_fi": "Lammin kaurapuuro tuoreiden marjojen ja hunajan kera",
            "cuisine_type": "finnish",
            "prep_time_min": 15,
            "calories_per_serving": 350,
            "protein_per_serving": 12.5,
            "carbs_per_serving": 55.0,
            "fat_per_serving": 8.0,
            "tags": ["vegetarian", "quick"],
            "ingredients": [
              {
                "name_en": "Rolled oats",
                "name_fi": "Kaurahiutale",
                "quantity": 80,
                "unit": "g",
                "category": "grains",
                "is_optional": false
              }
            ]
          }
        }
      ]
    }
  ],
  "total_estimated_cost_eur": 127.50
}
```

### 3.4 AI Response Validation (5-step pipeline)

After receiving the AI response, validate in order:

| Step | Check                                                                                                         | On Failure                                           |
| ---- | ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| 1    | **JSON parse** -- response is valid JSON                                                                      | Retry with "respond with valid JSON only" appended   |
| 2    | **Zod schema** -- structure matches expected schema (7 days, correct meal count)                              | Retry with specific structural errors                |
| 3    | **Restriction compliance** -- no recipe contains any ingredient matching family's STRICT dietary restrictions | Retry with "these ingredients are forbidden: [list]" |
| 4    | **Uniqueness** -- no duplicate recipe titles within the same week                                             | Retry with "remove duplicates: [list]"               |
| 5    | **Completeness** -- every recipe has title_en, title_fi, at least 2 ingredients, calories > 0                 | Retry with "incomplete recipes: [list]"              |

Maximum 3 retry attempts total. If all 3 fail, return `MENU_AI_GENERATION_FAILED` error.

### 3.5 Retry Strategy

```
Attempt 1: Standard prompt (system + user)
Attempt 2: Standard prompt + validation errors from attempt 1
Attempt 3: Standard prompt + validation errors from attempt 2 + stricter instructions
After 3 failures: Return 500 with MENU_AI_GENERATION_FAILED
```

Each retry appends the specific validation failure message to the user prompt so the AI can self-correct.

### 3.6 Cost Estimation

- GPT-4o-mini pricing (as of 2026): ~$0.15 / 1M input tokens, ~$0.60 / 1M output tokens.
- System prompt: ~300 tokens. User prompt: ~300-500 tokens. Output: ~2000-3000 tokens.
- **Estimated cost per generation: $0.002-$0.005** (well under $0.05 budget).
- With 3 retries worst case: $0.015 per menu.
- Alternative generation (3-5 recipes): ~$0.001-$0.002 per call.

### 3.7 Fallback Strategy (MVP)

- **MVP:** No fallback menus. If OpenAI is unavailable or returns garbage after 3 retries, return an error. The user can try again later.
- **Post-MVP (MENU-09, P1):** Pre-generated template menus stored as JSON, selected based on family profile parameters. Estimated 5 SP, planned for v1.1.

---

## 4. Service Architecture

Following the existing service factory pattern established in Phase 1 (`createRecipeService`, `createFamilyService`).

### 4.1 Service Factory: `createMenuService(prisma, config)`

Handles all menu CRUD operations and orchestrates the generation flow.

**Methods:**

| Method                                          | Description                                 | Dependencies                   |
| ----------------------------------------------- | ------------------------------------------- | ------------------------------ |
| `generate(userId, data)`                        | Orchestrates full menu generation flow      | aiMenuGenerator, familyService |
| `getCurrent(userId)`                            | Returns most recent menu for user's family  | --                             |
| `getById(userId, menuId)`                       | Returns specific menu with full nested data | --                             |
| `getHistory(userId, query)`                     | Paginated menu history                      | --                             |
| `replaceMeal(userId, menuId, mealId, recipeId)` | Replaces a meal's recipe                    | --                             |
| `lockMeal(userId, menuId, mealId, isLocked)`    | Toggles meal lock status                    | --                             |
| `getAlternatives(userId, menuId, mealId)`       | Generates alternative recipes for a meal    | aiMenuGenerator                |
| `approve(userId, menuId)`                       | Approves a draft menu                       | --                             |

**Ownership check pattern:** Every method first resolves the user's familyId (via `prisma.family.findUnique({ where: { userId } })`), then verifies the menu belongs to that family. Reuses `verifyFamilyOwnership` from `lib/ownership.ts`.

### 4.2 Service Factory: `createAiMenuGenerator(config)`

Encapsulates all OpenAI API interaction. Pure AI module -- no database access.

**Methods:**

| Method                                                   | Description                             | Input                                      | Output                     |
| -------------------------------------------------------- | --------------------------------------- | ------------------------------------------ | -------------------------- |
| `generateWeeklyMenu(context)`                            | Generates a full 7-day menu             | FamilyContext object                       | Validated AI menu response |
| `generateAlternatives(context, existingMeals, mealSlot)` | Generates 3-5 alternatives for one meal | FamilyContext + current menu + target slot | Array of recipe objects    |

**FamilyContext type:**

```
{
  members: { role, age }[]
  servings: number
  meals_per_day: number
  dietary_restrictions: { member_label, type, value, severity }[]
  medical_restrictions: { member_label, condition }[]
  cuisines: string[]
  excluded_ingredients: string[]
  weekly_budget_eur: number | null
  calorie_target_per_person: number | null
  locked_meals: { day, meal_type, recipe }[]
  previous_weeks_recipes: string[]  // titles for diversity check
}
```

**Design principles:**

- The AI generator is stateless and has no Prisma dependency. It receives a context object and returns structured data.
- Validation happens inside the generator (Zod schemas). Only validated data is returned.
- The menu service handles mapping AI output to database records (creating Recipe, Ingredient, RecipeIngredient, WeeklyMenu, MenuDay, Meal).

### 4.3 Data Flow: Menu Generation

```
1. Route handler receives POST /menu/generate
2. menuService.generate(userId, { week_start, locked_meals })
   a. Fetch family with members, restrictions, preferences
   b. Fetch locked meal recipes (if any)
   c. Fetch recent menu recipe titles (last 4 weeks) for diversity
   d. Build FamilyContext object
   e. Call aiMenuGenerator.generateWeeklyMenu(context)
      - Construct system + user prompts
      - Call OpenAI API (with retry logic)
      - Validate response with Zod
      - Validate restrictions compliance
      - Return validated menu data
   f. Delete existing DRAFT menu for same week_start (if any)
   g. Transaction: create WeeklyMenu + 7 MenuDays + N Meals
      - For each recipe from AI: upsert into Recipe table (match by title_en + title_fi)
      - For each ingredient: upsert into Ingredient table (match by name_en)
      - Create RecipeIngredient links
   h. Calculate and set total_calories, total_cost_estimate on WeeklyMenu
   i. Return full menu with nested relations
3. Route handler returns 200 with menu JSON
```

### 4.4 File Structure

```
apps/api/src/
  config.ts                              # Add OPENAI_API_KEY, OPENAI_MODEL
  routes/
    menu.ts                              # NEW: all menu endpoints
  services/
    menu.service.ts                      # NEW: menu CRUD + orchestration
    ai-menu-generator.ts                 # NEW: OpenAI integration
  schemas/
    menu.schemas.ts                      # NEW: Zod schemas for request/response
    ai-output.schemas.ts                 # NEW: Zod schemas for AI response validation
  lib/
    prompt-builder.ts                    # NEW: builds system + user prompts
    menu-validator.ts                    # NEW: restriction compliance, uniqueness checks
```

---

## 5. Prisma Schema Changes

### 5.1 No Structural Changes Required

The existing Prisma schema already contains all necessary models for Phase 2.0:

- `WeeklyMenu` -- menu with familyId, weekStart, status, totals
- `MenuDay` -- 7 days per menu, with dayOfWeek and date
- `Meal` -- per-day meals with mealType, recipeId, isLocked, servings
- `Recipe` -- full recipe card with bilingual fields, nutrition, tags
- `RecipeIngredient` -- recipe-to-ingredient links
- `Ingredient` -- ingredient master data

All relationships and indexes are already defined.

### 5.2 Recommended Index Addition

Add a composite index on WeeklyMenu to optimize "get current menu for family" and "check existing DRAFT" queries:

```prisma
model WeeklyMenu {
  // ... existing fields
  @@index([familyId, status])
  @@index([familyId, weekStart])
}
```

### 5.3 Ingredient Seed Data Dependency

Phase 2.0 depends on the `REC-06` story (seed data: 200 base ingredients) which is part of Phase 1.1. The AI generator will create new ingredients on the fly if they don't exist in the seed data, but having seed data improves ingredient deduplication and mapping quality.

**If Phase 1.1 is not complete before Phase 2.0 starts:** The AI module should still work -- it will create all ingredients fresh. Deduplication logic (matching by `name_en`) handles this gracefully.

---

## 6. Error Codes

New error codes to add to `apps/api/src/lib/errors.ts`:

| Error Code                   | HTTP Status | Description                                                             |
| ---------------------------- | ----------- | ----------------------------------------------------------------------- |
| `MENU_FAMILY_NOT_FOUND`      | 404         | User has no family profile (must complete onboarding first)             |
| `MENU_FAMILY_INCOMPLETE`     | 400         | Family has no members -- at least 1 member required for menu generation |
| `MENU_NOT_FOUND`             | 404         | Menu with given ID does not exist                                       |
| `MENU_ACCESS_DENIED`         | 403         | Menu does not belong to the user's family                               |
| `MENU_NOT_DRAFT`             | 400         | Cannot modify a menu that is not in DRAFT status                        |
| `MENU_ALREADY_APPROVED`      | 400         | Menu is already in APPROVED status                                      |
| `MENU_ALREADY_ARCHIVED`      | 400         | Cannot approve an ARCHIVED menu                                         |
| `MENU_INVALID_WEEK_START`    | 400         | week_start is not a Monday or is in the past                            |
| `MENU_GENERATION_RATE_LIMIT` | 429         | Exceeded 10 menu generations per hour                                   |
| `MENU_AI_GENERATION_FAILED`  | 500         | OpenAI returned invalid data after 3 retry attempts                     |
| `MEAL_NOT_FOUND`             | 404         | Meal with given ID does not exist in this menu                          |

---

## 7. Implementation Order

### Week 1 -- Foundation + AI Integration (Days 1-5)

**Day 1: Configuration + AI Module Scaffold**

- Add `OPENAI_API_KEY`, `OPENAI_MODEL` to `config.ts` env schema
- Install `openai` npm package
- Create `ai-menu-generator.ts` service factory skeleton
- Create `prompt-builder.ts` with system and user prompt construction
- Create `ai-output.schemas.ts` Zod schemas for AI response validation
- Add new error codes to `errors.ts`

**Day 2: AI Generator Implementation**

- Implement `generateWeeklyMenu` in `ai-menu-generator.ts`
- Implement OpenAI API call with retry logic (up to 3 attempts)
- Implement `menu-validator.ts` (restriction compliance, uniqueness, completeness)
- Write unit tests with mocked OpenAI responses (3-5 test cases: valid response, invalid JSON, restriction violation, incomplete recipes)

**Day 3: Menu Service + POST /menu/generate**

- Create `menu.service.ts` with `generate` method
- Implement family context building (fetch family, members, restrictions, preferences)
- Implement recipe upsert logic (match by title, create if new)
- Implement ingredient upsert logic (match by name_en, create if new)
- Implement WeeklyMenu + MenuDay + Meal creation in a Prisma transaction
- Implement total_calories and total_cost_estimate calculation
- Create `menu.schemas.ts` (request body + response Zod schemas)

**Day 4: Menu Route + Generation Endpoint Tests**

- Create `routes/menu.ts` with POST /menu/generate
- Register menu routes in app.ts (prefix: `/menu`)
- Implement menu-specific rate limiting (10/hour per user)
- Write integration tests with mocked AI generator (happy path, rate limit, family not found, invalid week_start)

**Day 5: Menu Retrieval Endpoints**

- Implement `getCurrent`, `getById`, `getHistory` in menu.service.ts
- Implement response transformation (toMenuResponse, toMenuSummaryResponse)
- Add GET /menu/current, GET /menu/:id, GET /menu/history routes
- Write tests for all retrieval endpoints (menu found, not found, access denied, pagination)

### Week 2 -- Meal Modification + Approval (Days 6-10)

**Day 6: Meal Replacement**

- Implement `replaceMeal` in menu.service.ts
- Add PATCH /menu/:menuId/meals/:mealId route
- Implement recalculation of menu totals after replacement
- Write tests (replace meal, menu not draft, meal not found, recipe not found)

**Day 7: Alternatives Generation**

- Implement `generateAlternatives` in ai-menu-generator.ts (prompt for 3-5 alternatives)
- Implement `getAlternatives` in menu.service.ts
- Add POST /menu/:menuId/meals/:mealId/alternatives route
- Write tests with mocked AI (valid alternatives, rate limit)

**Day 8: Lock/Unlock + Approval**

- Implement `lockMeal` in menu.service.ts
- Add PATCH /menu/:menuId/meals/:mealId/lock route
- Implement `approve` in menu.service.ts (DRAFT -> APPROVED, archive previous)
- Add POST /menu/:id/approve route
- Write tests (lock/unlock, approve, already approved, already archived)

**Day 9: Integration Tests + Edge Cases**

- Full flow integration test: generate -> view -> replace meal -> lock -> approve
- Edge case tests: empty family, 2 meals/day, no budget, no calorie target
- Test locked meals preservation during regeneration
- Test diversity: verify AI prompt includes previous weeks' recipes
- Test DRAFT replacement: generating new menu replaces existing DRAFT for same week

**Day 10: Prompt Optimization + AI Quality**

- Test with 5-10 different family profiles (varying restrictions, cuisines, budgets)
- Tune system prompt based on quality of AI responses
- Verify Finnish translations quality in AI output
- Verify calorie accuracy (within +-20% of target)
- Document any prompt adjustments in code comments

### Week 3 (Partial) -- Polish + Documentation (Days 11-12)

**Day 11: OpenAPI Documentation + Error Handling Audit**

- Ensure all menu endpoints appear in Swagger docs (@fastify/swagger)
- Verify all error codes are properly returned (manually test each error path)
- Add response examples to OpenAPI spec
- Review error messages for clarity

**Day 12: Performance Testing + Final Review**

- Measure generation time end-to-end (target < 15 seconds)
- Measure retrieval endpoint latency (target < 500ms)
- Review OpenAI token usage and cost per generation
- Code review + bug fixes
- Update CLAUDE.md with Phase 2.0 completion status

---

## 8. Testing Strategy

### 8.1 Mocking OpenAI

The `openai` SDK is mocked at the service boundary. The AI generator accepts an OpenAI client instance (dependency injection), and tests provide a mock client that returns predefined responses.

**Mock response fixtures:**

| Fixture                      | Purpose                                                             |
| ---------------------------- | ------------------------------------------------------------------- |
| `valid-menu-3meals.json`     | Full valid 7-day menu with 3 meals/day                              |
| `valid-menu-2meals.json`     | Full valid 7-day menu with 2 meals/day                              |
| `invalid-json.txt`           | Non-JSON string (tests retry on parse failure)                      |
| `missing-fields.json`        | Valid JSON but missing required fields (tests Zod validation retry) |
| `restricted-ingredient.json` | Menu containing a forbidden allergen (tests restriction validation) |
| `duplicate-recipes.json`     | Menu with repeated recipes (tests uniqueness validation)            |
| `valid-alternatives.json`    | 5 alternative recipes for meal replacement                          |

### 8.2 Unit Tests (Vitest)

| Test Area            | Test Cases                                                                                                                   | Coverage  |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------- | --------- |
| Prompt builder       | Builds correct system prompt; includes all restrictions; anonymizes members; handles locked meals; handles empty preferences | 5+ tests  |
| AI output validation | Valid schema passes; missing fields fail; wrong meal count fails; restriction violation detected; duplicate detection        | 5+ tests  |
| Menu validator       | Restriction compliance check; uniqueness check; completeness check; calorie range check                                      | 4+ tests  |
| Menu service         | Generate flow (mocked AI); getCurrent; getById; getHistory pagination; replaceMeal; lockMeal; approve; rate limiting         | 10+ tests |

### 8.3 Integration Tests (Fastify inject)

| Test Flow                    | Steps                                                                                                   |
| ---------------------------- | ------------------------------------------------------------------------------------------------------- |
| Happy path generation        | Auth -> create family + members + restrictions -> POST /menu/generate -> verify 200 + correct structure |
| Generation with locked meals | Generate menu -> lock 2 meals -> regenerate -> verify locked meals unchanged                            |
| Meal replacement flow        | Generate -> POST alternatives -> PATCH meal with alternative recipe_id -> verify update                 |
| Approval flow                | Generate -> approve -> verify status=APPROVED -> verify previous APPROVED is archived                   |
| Error paths                  | No family (404), no members (400), not draft (400), rate limit (429), AI failure (500)                  |

### 8.4 Test Coverage Target

> 80% line coverage (per NFR-060). AI integration code has lower branch coverage due to mocking but all error paths are covered.

---

## 9. Story Points Summary

| Backlog Story | Endpoint(s)                      | SP        | Notes                                           |
| ------------- | -------------------------------- | --------- | ----------------------------------------------- |
| MENU-01       | POST /menu/generate              | 8         | Core generation with AI                         |
| MENU-02       | (included in MENU-01)            | --        | Family profile in prompt (part of generation)   |
| MENU-03       | (included in MENU-01)            | --        | AI response validation (part of generation)     |
| MENU-04       | (included in MENU-01)            | --        | Retry logic (part of generation)                |
| MENU-05       | POST alternatives + PATCH meal   | 5         | Meal replacement with AI alternatives           |
| MENU-06       | PATCH lock                       | 2         | Lock/unlock meal                                |
| MENU-07       | POST approve                     | 2         | Menu approval workflow                          |
| MENU-08       | GET history                      | 2         | Paginated menu history                          |
| MENU-12       | (included in MENU-01)            | --        | meals_per_day from profile (part of generation) |
| --            | GET /menu/current, GET /menu/:id | 4         | Menu retrieval endpoints                        |
| --            | AI module + prompt engineering   | 5         | ai-menu-generator, prompt-builder, validation   |
| **TOTAL**     |                                  | **28 SP** | Matches backlog estimate                        |

---

## 10. Risks & Mitigations

| Risk                                                                                                                            | Impact | Likelihood | Mitigation                                                                                                                                                                                      |
| ------------------------------------------------------------------------------------------------------------------------------- | ------ | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **AI response quality** -- GPT-4o-mini may generate poor Finnish translations or unrealistic recipes                            | High   | Medium     | Post-validation pipeline catches structural issues. Finnish naming quality tested manually with native speakers post-MVP. Prompt includes explicit Finnish translation instructions.            |
| **AI response time > 15 seconds** -- OpenAI latency spikes                                                                      | Medium | Medium     | Set 30-second timeout. Log latency per request. If consistently slow, reduce output tokens or simplify prompt. Consider streaming for future phases (PERF-03).                                  |
| **Rate limiting accuracy** -- in-memory rate limiter resets on server restart                                                   | Low    | Low        | Acceptable for MVP (single server). Migrate to Redis-based rate limiting in Phase 6 (scaling).                                                                                                  |
| **Ingredient deduplication** -- AI generates slightly different names for the same ingredient (e.g., "Onion" vs "Yellow onion") | Medium | High       | Fuzzy matching on ingredient name_en with normalized form. Accept imperfect deduplication for MVP; improve with ingredient alias table in v1.1.                                                 |
| **OpenAI API unavailability** -- service outage or key revocation                                                               | High   | Low        | Return clear error message. No fallback menus in MVP. Post-MVP (MENU-09): add template menus. Monitor OpenAI status page.                                                                       |
| **Budget estimation inaccuracy** -- AI cannot know real S-Market prices                                                         | Medium | High       | AI provides rough estimates only. Real cost calculation happens in Phase 3 (shopping list) with actual product prices. Menu `total_cost_estimate` is labeled as "estimate" in the API response. |
| **GDPR prompt leak** -- accidental PII in OpenAI prompts                                                                        | High   | Low        | Prompt builder strictly anonymizes all member data. Code review required for any prompt changes. Unit tests verify no real names/emails appear in constructed prompts.                          |
| **Token budget overflow** -- large families or complex restrictions exceed 4000 output tokens                                   | Low    | Low        | Monitor token usage. If output truncated, increase max_tokens to 6000. Families > 6 members are rare in target audience.                                                                        |

---

## 11. Configuration Changes

### 11.1 Environment Variables (add to `.env.example`)

```
# OpenAI Configuration (Phase 2.0)
OPENAI_API_KEY=sk-...your-key-here
OPENAI_MODEL=gpt-4o-mini
```

### 11.2 Config Schema Update (`apps/api/src/config.ts`)

Add to the Zod env schema:

```
OPENAI_API_KEY: z.string().min(1, 'OPENAI_API_KEY is required'),
OPENAI_MODEL: z.string().default('gpt-4o-mini'),
```

### 11.3 New npm Dependency

```
npm install openai --workspace=apps/api
```

---

## 12. Dependencies on Prior Phases

| Dependency                                                       | Phase     | Status      | Blocking?                                                                                |
| ---------------------------------------------------------------- | --------- | ----------- | ---------------------------------------------------------------------------------------- |
| Auth endpoints (JWT middleware, `request.user`)                  | Phase 1.0 | Required    | Yes -- all menu endpoints are authenticated                                              |
| Family CRUD (get family with members, restrictions, preferences) | Phase 1.0 | Required    | Yes -- menu generation reads family profile                                              |
| Recipe CRUD (create/read recipes)                                | Phase 1.1 | Required    | Partially -- AI generates recipes inline, but recipe read is needed for meal replacement |
| Ingredient seed data (REC-06)                                    | Phase 1.1 | Recommended | No -- works without seed data, but deduplication is better with it                       |

---

## 13. Success Metrics

| Metric                             | Target              | How to Measure                                          |
| ---------------------------------- | ------------------- | ------------------------------------------------------- |
| Menu generation success rate       | > 80% first attempt | API logs: 200 vs error responses on POST /menu/generate |
| AI response validation pass rate   | > 90% first attempt | Internal logs: validation step results before retry     |
| Average generation latency         | < 15 seconds        | API response time logging (Pino)                        |
| Average meal replacements per menu | < 3                 | Count of PATCH /menu/:id/meals/:id calls per menu       |
| Cost per generation                | < $0.01             | OpenAI usage dashboard                                  |
| Retrieval endpoint p95 latency     | < 500ms             | API response time logging                               |
| Test coverage                      | > 80%               | Vitest coverage report                                  |

---

## 14. Next Steps (After Phase 2.0)

**Phase 3.0 -- Product Catalog & Shopping List (2 weeks)**

- Product catalog import from S-kaupat.fi (CAT-01, CAT-03, CAT-04)
- Ingredient-to-product mapping
- Shopping list generation from approved menu (SHOP-01..SHOP-06)
- Shopping list CRUD

**Phase 2.1 -- AI Enhancements (post-MVP, v1.1)**

- MENU-09: Fallback menus when OpenAI is unavailable (5 SP)
- MENU-10: Redis caching of AI results (3 SP)
- MENU-11: Diversity validation across 4 weeks (3 SP)

---

**END OF PHASE 2.0 PLAN**

_This plan should be reviewed with the team before Sprint 3 starts._
_Estimated completion: 2.5 weeks from Phase 2.0 kickoff._
_Total story points: 28 SP (matching EPIC-03 backlog estimate)._
