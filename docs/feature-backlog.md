# FoodOps — Feature Backlog (Product Manager)

**Owner:** Product Manager
**Created:** 2026-02-09
**Status:** Living document — обновляется каждый спринт
**Sources:** technical-specification.md, market-research.md, project-plan.md, infrastructure-specification.md

---

## Оглавление

1. [Prioritization Framework](#1-prioritization-framework)
2. [Epic Map](#2-epic-map)
3. [Backlog по Epics](#3-backlog-по-epics)
4. [MVP Scope (Must-Have)](#4-mvp-scope-must-have)
5. [Post-MVP Features (v1.1+)](#5-post-mvp-features-v11)
6. [Technical Debt & Infra Stories](#6-technical-debt--infra-stories)
7. [Analytics & Metrics Stories](#7-analytics--metrics-stories)
8. [Risks & Dependencies](#8-risks--dependencies)
9. [Appendix: Traceability Matrix](#9-appendix-traceability-matrix)

---

## 1. Prioritization Framework

**MoSCoW для MVP:**

| Label | Meaning | Правило |
|-------|---------|---------|
| **P0 — Must** | Без этого MVP не работает | Блокирует core user flow |
| **P1 — Should** | Сильно улучшает UX, но можно обойтись | Запуск возможен без этого |
| **P2 — Could** | Nice-to-have для MVP | Первый post-MVP спринт |
| **P3 — Won't (now)** | Отложено до v1.1+ | Backlog, не планируем |

**Sizing (Story Points):**

| SP | Meaning |
|----|---------|
| 1 | Тривиальная задача (< 0.5 дня) |
| 2 | Простая задача (0.5-1 день) |
| 3 | Средняя задача (1-2 дня) |
| 5 | Крупная задача (2-3 дня) |
| 8 | Большая задача (3-5 дней) |
| 13 | Эпическая задача — нужно декомпозировать |

---

## 2. Epic Map

```
EPIC-01: Auth & User Management
EPIC-02: Family Profile & Preferences
EPIC-03: AI Menu Generation
EPIC-04: Recipe Management
EPIC-05: Shopping List & Consolidation
EPIC-06: Product Catalog & S-Market Integration
EPIC-07: Chrome Extension
EPIC-08: Frontend — Onboarding & Dashboard
EPIC-09: Frontend — Menu Planner
EPIC-10: Frontend — Shopping List
EPIC-11: Localization (i18n)
EPIC-12: GDPR & Privacy
EPIC-13: Monitoring, Observability & DevOps
EPIC-14: Performance & Optimization
EPIC-15: Analytics & Growth
```

**MVP Flow (Epics на критическом пути):**

```
EPIC-01 → EPIC-02 → EPIC-03 → EPIC-05 → EPIC-07
                      ↓                    ↑
                   EPIC-04             EPIC-06
```

---

## 3. Backlog по Epics

### EPIC-01: Auth & User Management

| ID | Story | Priority | SP | Acceptance Criteria | Refs |
|----|-------|----------|----|---------------------|------|
| AUTH-01 | Как новый пользователь, я хочу зарегистрироваться по email + password | P0 | 3 | Email уникален, пароль bcrypt, JWT выдан (access 15 мин, refresh 7 дней) | US-001, FR-300, NFR-020 |
| AUTH-02 | Как пользователь, я хочу войти в систему по email + password | P0 | 2 | JWT access+refresh, ошибка при неверных credentials | US-001 |
| AUTH-03 | Как пользователь, я хочу обновить access token через refresh token | P0 | 2 | Новый access+refresh при валидном refresh, 401 при истёкшем | NFR-020 |
| AUTH-04 | Как пользователь, я хочу войти через Google OAuth | P2 | 3 | Google OAuth2 flow, автосоздание аккаунта | US-001 (v1.1) |
| AUTH-05 | Как пользователь, я хочу войти через Apple Sign-In | P3 | 3 | Apple OAuth, автосоздание | US-001 (v1.1) |
| AUTH-06 | Как система, я хочу ограничивать запросы (rate limiting) | P0 | 3 | 100 req/min auth, 20 req/min anon, 10 req/hour меню генерация | NFR-023 |
| AUTH-07 | Как пользователь, я хочу выйти из системы (logout) | P1 | 1 | Refresh token инвалидирован | — |

---

### EPIC-02: Family Profile & Preferences

| ID | Story | Priority | SP | Acceptance Criteria | Refs |
|----|-------|----------|----|---------------------|------|
| FAM-01 | Как пользователь, я хочу создать профиль семьи (название, бюджет, приёмы пищи) | P0 | 3 | POST /family, name обязательно, budget optional, meals_per_day=2|3 | US-002, FR-101 |
| FAM-02 | Как пользователь, я хочу добавить члена семьи (имя, возраст, роль) | P0 | 3 | POST /family/members, роль: adult/child/infant, max 10 членов | US-002 |
| FAM-03 | Как пользователь, я хочу указать диетические ограничения для каждого члена | P0 | 3 | Тип: allergy/intolerance/lifestyle, значение: gluten/lactose/nuts/vegan... severity: strict/moderate/mild | US-003 |
| FAM-04 | Как пользователь, я хочу указать медицинские ограничения | P0 | 2 | condition: diabetes_type2/high_cholesterol/hypertension + notes | US-004 |
| FAM-05 | Как пользователь, я хочу задать предпочтения по кухне | P1 | 2 | Тип cuisine: finnish/italian/asian/mediterranean... multiple | US-005, FR-102 |
| FAM-06 | Как пользователь, я хочу задать недельный бюджет на продукты | P1 | 1 | budget в EUR, decimal(8,2), используется в AI-генерации | US-006 |
| FAM-07 | Как пользователь, я хочу указать исключённые продукты | P1 | 2 | Тип excluded_ingredient, value=конкретный продукт/ингредиент | US-007, FR-102 |
| FAM-08 | Как пользователь, я хочу редактировать/удалять членов семьи и ограничения | P0 | 2 | PUT/DELETE для members, restrictions, preferences | US-002 |
| FAM-09 | Как пользователь, я хочу видеть полный профиль семьи одним запросом | P0 | 2 | GET /family возвращает members + restrictions + preferences + settings | — |
| FAM-10 | Как система, я хочу создать профиль семьи с дефолтами при "Skip settings" | P0 | 2 | POST /family/quick-setup: создаёт семью (2 adults, meals_per_day=3, no restrictions, no budget). Флаг is_onboarding_complete=false. Меню генерируется с дефолтными параметрами | UX: skip onboarding |

---

### EPIC-03: AI Menu Generation

| ID | Story | Priority | SP | Acceptance Criteria | Refs |
|----|-------|----------|----|---------------------|------|
| MENU-01 | Как пользователь, я хочу сгенерировать меню на неделю одной кнопкой | P0 | 8 | POST /menu/generate → 7 дней × 2-3 приёма пищи, < 15 сек | US-010, FR-100, NFR-001 |
| MENU-02 | Как система, я хочу учитывать профиль семьи при генерации | P0 | 5 | Состав, возраст, ограничения, предпочтения, бюджет, исключения — всё в prompt | FR-101, FR-102 |
| MENU-03 | Как система, я хочу валидировать AI-ответ | P0 | 5 | Структура JSON (7 дней), нет запрещённых ингредиентов, калорийность ±20%, нет повторов, полнота | Section 5.5 |
| MENU-04 | Как система, я хочу повторить запрос к AI при невалидном ответе (до 3 раз) | P0 | 2 | Retry с указанием ошибок, после 3 неудач — fallback | Section 5.5 |
| MENU-05 | Как пользователь, я хочу заменить конкретное блюдо в меню | P0 | 5 | POST /menu/{id}/regenerate-meal → 3-5 альтернатив, те же ограничения | US-012, FR-112 |
| MENU-06 | Как пользователь, я хочу закрепить (lock) понравившееся блюдо | P1 | 2 | PUT /menu/{id}/meals/{mealId}/lock, locked meals не меняются при перегенерации | US-013, FR-113 |
| MENU-07 | Как пользователь, я хочу утвердить меню | P0 | 2 | PUT /menu/{id}/approve → status=approved, триггер формирования shopping list | — |
| MENU-08 | Как пользователь, я хочу видеть историю своих меню | P1 | 2 | GET /menu/history → список меню с датами, статусами, стоимостью | US-014 |
| MENU-09 | Как система, я хочу использовать fallback-меню при недоступности OpenAI | P1 | 5 | 10-15 шаблонных меню JSON, выбор по параметрам семьи | NFR-032, WBS 2.7 |
| MENU-10 | Как система, я хочу кэшировать AI-результаты | P1 | 3 | Redis TTL 24h, ключ=hash(profile+week+locked), экономия 60-80% API-вызовов | WBS 2.8 |
| MENU-11 | Как система, я хочу обеспечить разнообразие: нет повторов в неделе, <20% повторов за 4 недели | P1 | 3 | Валидация в prompt + post-validation | FR-103 |
| MENU-12 | Как пользователь, я хочу указать количество приёмов пищи (2 или 3) | P0 | 1 | meals_per_day из профиля семьи, передаётся в prompt | US-016, FR-100 |

---

### EPIC-04: Recipe Management

| ID | Story | Priority | SP | Acceptance Criteria | Refs |
|----|-------|----------|----|---------------------|------|
| REC-01 | Как система, я хочу хранить рецепты с полной карточкой (название en/fi, описание, ингредиенты, калории, теги) | P0 | 3 | Модель Recipe + RecipeIngredient, все поля из ТЗ | FR-110 |
| REC-02 | Как пользователь, я хочу видеть детали блюда: ингредиенты, калории, стоимость, время приготовления | P0 | 2 | GET /recipes/{id} возвращает полную карточку | US-011, FR-110 |
| REC-03 | Как пользователь, я хочу искать рецепты по названию/тегам | P1 | 3 | GET /recipes/search → Meilisearch full-text, финский+английский | WBS 1.6 |
| REC-04 | Как система, я хочу масштабировать порции по числу членов семьи | P0 | 3 | Количество ингредиентов × (число порций / базовое число порций) | FR-111 |
| REC-05 | Как пользователь, я хочу добавить собственный рецепт | P3 | 5 | POST /recipes, is_custom=true, user_id заполнен, включается в пул AI-генерации | US-017, FR-114 |
| REC-06 | Как система, я хочу хранить seed-данные: 200 базовых ингредиентов, категории | P0 | 3 | prisma seed: ингредиенты en/fi, категории | WBS 1.3 |

---

### EPIC-05: Shopping List & Consolidation

| ID | Story | Priority | SP | Acceptance Criteria | Refs |
|----|-------|----------|----|---------------------|------|
| SHOP-01 | Как система, я хочу автоматически консолидировать ингредиенты из всех рецептов меню | P0 | 5 | POST /shopping-list/generate: одинаковые ингредиенты суммируются (200г+150г+100г=450г) | US-020, FR-200 |
| SHOP-02 | Как система, я хочу нормализовать единицы измерения | P0 | 3 | г→кг (>1000г), мл→л (>1000мл), стандартные единицы | FR-201 |
| SHOP-03 | Как система, я хочу группировать список по категориям | P0 | 2 | Категории: молочные, мясо, овощи, фрукты, бакалея, заморозка, напитки, прочее | FR-202 |
| SHOP-04 | Как пользователь, я хочу видеть маппинг каждого ингредиента на товар S-Market с ценой | P0 | 3 | Каждый item имеет product_id, product.price | US-021, FR-210 |
| SHOP-05 | Как система, я хочу рассчитать количество упаковок к покупке | P0 | 3 | 450г лука → сетка 1кг → 1 упаковка. Округление вверх | FR-211 |
| SHOP-06 | Как пользователь, я хочу видеть итоговую стоимость корзины | P0 | 1 | SUM(quantity_to_buy × product.price) | US-022, FR-212 |
| SHOP-07 | Как пользователь, я хочу удалить позицию из списка | P0 | 1 | DELETE /shopping-list/{id}/items/{itemId} | FR-220, US-023 |
| SHOP-08 | Как пользователь, я хочу изменить количество позиции | P0 | 1 | PUT /shopping-list/{id}/items/{itemId}, пересчёт количества упаковок | FR-221, US-023 |
| SHOP-09 | Как пользователь, я хочу добавить произвольный продукт через поиск | P0 | 3 | POST /shopping-list/{id}/items, поиск по каталогу магазина | FR-222, US-023 |
| SHOP-10 | Как пользователь, я хочу пометить продукт как "есть дома" | P1 | 1 | PUT has_at_home=true → исключается из корзины, но остаётся в списке | US-024, FR-223 |
| SHOP-11 | Как пользователь, я хочу выбрать альтернативный товар для позиции | P1 | 3 | Показать 2-3 альтернативы из каталога, переключить product_id | FR-224, US-025 |
| SHOP-12 | Как пользователь, я хочу видеть товары по акции и замены на более выгодные | P2 | 3 | Подсветка promo_price, предложение замены если аналог дешевле | US-026, FR-213 |
| SHOP-13 | Как система, я хочу предлагать замены при отсутствии товара | P2 | 3 | in_stock=false → 1-3 альтернативы с пояснением различий | FR-214, US-025 |
| SHOP-14 | Как пользователь, я хочу отметить список как "готов к покупке" | P0 | 1 | PUT /shopping-list/{id}/ready → status=ready, доступен Extension | — |

---

### EPIC-06: Product Catalog & S-Market Integration

| ID | Story | Priority | SP | Acceptance Criteria | Refs |
|----|-------|----------|----|---------------------|------|
| CAT-01 | Как система, я хочу хранить каталог товаров S-Market | P0 | 3 | Таблица Product: EAN, name_fi, brand, price, promo_price, unit_size, unit_type, category, image_url, in_stock | WBS 3.1 |
| CAT-02 | Как система, я хочу иметь top-500 курированных товаров S-Market (Helsinki) | P0 | 8 | Молочные, мясо, овощи, фрукты, бакалея, заморозка — проверенные данные | WBS 3.3 |
| CAT-03 | Как система, я хочу маппинг ~200 базовых ингредиентов на товары | P0 | 5 | IngredientMap: ingredient_id → product_id, confidence, is_default. >85% точность | WBS 3.4 |
| CAT-04 | Как система, я хочу парсить каталог S-kaupat.fi/S-kaupat.fi | P0 | 8 | Скрипт: EAN, название, бренд, цена, фасовка, категория, наличие. Соблюдение robots.txt | WBS 3.2 |
| CAT-05 | Как пользователь, я хочу искать товары по каталогу | P0 | 3 | GET /products/search — Meilisearch, финский+английский, fuzzy matching | WBS 3.5 |
| CAT-06 | Как система, я хочу fuzzy matching по pg_trgm для финских названий | P0 | 3 | pg_trgm extension, threshold 0.3 для финского языка | WBS 3.4 |
| CAT-07 | Как система, я хочу ежедневно обновлять цены и наличие | P1 | 3 | BullMQ job: ночное обновление цен, еженедельное обновление каталога. Redis invalidation | WBS 3.7 |
| CAT-08 | Как система, я хочу индексировать товары в Meilisearch | P0 | 2 | Индекс products: name_fi, brand, category, EAN. Автообновление при изменении БД | WBS 3.5 |
| CAT-09 | Как пользователь, я хочу видеть акционные товары | P2 | 2 | GET /products/promotions — товары с promo_price, сортировка по скидке | FR-213 |
| CAT-10 | Как система, я хочу расширить каталог до 5000+ SKU | P3 | 8 | Автоматизация парсинга полного каталога, масштабирование Meilisearch | WBS 8.3 |

---

### EPIC-07: Chrome Extension

| ID | Story | Priority | SP | Acceptance Criteria | Refs |
|----|-------|----------|----|---------------------|------|
| EXT-01 | Как пользователь, я хочу авторизоваться в Extension через аккаунт FoodOps | P0 | 5 | OAuth2 popup → токен в chrome.storage.local | US-030, FR-300 |
| EXT-02 | Как пользователь, я хочу видеть текущий список покупок в popup Extension | P0 | 3 | Получение из Extension API, отображение товаров+количество+стоимость | FR-301, FR-302 |
| EXT-03 | Как пользователь, я хочу нажать "Добавить в корзину" и автоматически добавить все товары на S-kaupat.fi | P0 | 8 | Последовательный поиск + добавление, задержки 2-5 сек, таймаут 30 сек/товар | US-031, FR-312 |
| EXT-04 | Как система, Content Script должен взаимодействовать с DOM S-kaupat.fi | P0 | 8 | Поиск товара (search_query_fi), парсинг результатов, клик "Добавить в корзину", установка количества. Селекторы в конфиге | FR-313, FR-314, FR-315, WBS 5.5 |
| EXT-05 | Как система, я хочу приоритизировать совпадения: EAN > название+бренд > название+фасовка > best match | P0 | 3 | Алгоритм scoring, порог минимального совпадения | FR-314 |
| EXT-06 | Как пользователь, я хочу видеть прогресс "Добавлено X из Y товаров" | P0 | 2 | Прогресс-бар в popup, обновление в реальном времени | US-032, FR-316 |
| EXT-07 | Как пользователь, я хочу видеть итоговый отчёт: успешно / заменено / не найдено | P0 | 3 | Отчёт в popup + POST /extension/shopping-list/{id}/report в backend | US-033, FR-320 |
| EXT-08 | Как система, я хочу проверять авторизацию пользователя на S-kaupat.fi | P0 | 2 | Если не авторизован — уведомление "Войдите в S-Market аккаунт" | FR-311 |
| EXT-09 | Как система, я хочу fallback-поиск при неудаче основного | P1 | 3 | Упрощённые запросы из fallback_search_queries, повторная попытка | FR-321, WBS 5.8 |
| EXT-10 | Как пользователь, я хочу перейти на S-kaupat.fi для ручного добавления не найденных товаров | P1 | 1 | Кнопка "Добавить вручную" → открытие S-kaupat.fi с поисковым запросом | FR-322 |
| EXT-11 | Как система, Extension не должен мешать обычной работе в браузере | P0 | 2 | Минимальные permissions, content script только на S-kaupat.fi, graceful failure | US-035, NFR-024 |
| EXT-12 | Как PM, я хочу получать Extension API формат списка, оптимизированный для расширения | P0 | 2 | GET /extension/shopping-list: search_query_fi, EAN, fallback queries, quantity | WBS 1.9 |

---

### EPIC-08: Frontend — Onboarding & Dashboard

| ID | Story | Priority | SP | Acceptance Criteria | Refs |
|----|-------|----------|----|---------------------|------|
| FE-01 | Как пользователь, я хочу зарегистрироваться/войти через UI | P0 | 2 | Clerk SignIn/SignUp components, email+password, redirect после входа | WBS 4.3 |
| FE-02 | Как новый пользователь, я хочу пройти пошаговый onboarding | P0 | 8 | 6 шагов: семья → члены → диета → медицина → кухня → бюджет. Валидация на каждом шаге | WBS 4.4, US-002-007 |
| FE-02a | Как новый пользователь, я хочу пропустить детальные настройки и сразу перейти к генерации меню ("Skip settings") | P0 | 3 | Кнопка "Skip — generate menu now" на каждом шаге после шага 1 (семья). При skip: семья создаётся с дефолтами (2 adults, budget=null, meals_per_day=3, без ограничений). Пользователь сразу попадает на Menu Planner → генерация. Баннер "Complete your profile for better results" на Dashboard. Настройки можно дополнить позже из Settings. | UX improvement |
| FE-03 | Как пользователь, я хочу видеть Dashboard после входа | P0 | 5 | Текущее меню (если есть), быстрые действия, история заказов | WBS 4.5 |
| FE-04 | Как пользователь, я хочу страницу настроек | P1 | 3 | Редактирование профиля, ограничений, предпочтений. Переключение языка. Удаление аккаунта | WBS 4.12 |

---

### EPIC-09: Frontend — Menu Planner

| ID | Story | Priority | SP | Acceptance Criteria | Refs |
|----|-------|----------|----|---------------------|------|
| FE-05 | Как пользователь, я хочу нажать кнопку и увидеть меню на неделю | P0 | 8 | Кнопка "Сгенерировать", loading (skeleton + SSE streaming), календарная сетка 7×3 | WBS 4.6, US-010 |
| FE-06 | Как пользователь, я хочу видеть карточку блюда с полной информацией | P0 | 5 | Название en/fi, описание, ингредиенты, калории, стоимость, время. Боковая панель | WBS 4.7, US-011, FR-110 |
| FE-07 | Как пользователь, я хочу заменить блюдо через модальное окно с альтернативами | P0 | 5 | Кнопка "Заменить" → модалка с 3-5 альтернативами, выбор и подтверждение | WBS 4.8, US-012 |
| FE-08 | Как пользователь, я хочу закрепить блюдо и утвердить меню | P0 | 3 | Кнопка "Закрепить" (pin icon), кнопка "Утвердить меню" → переход к списку покупок | WBS 4.8, US-013 |
| FE-09 | Как пользователь, я хочу видеть сводку: калории, стоимость за неделю | P1 | 3 | Summary bar: total calories (на семью/на человека), total estimated cost | US-015, FR-120, FR-121 |
| FE-10 | Как пользователь, я хочу видеть нутриентный баланс (БЖУ) | P2 | 3 | Белки/жиры/углеводы по дням и за неделю | FR-122 |

---

### EPIC-10: Frontend — Shopping List

| ID | Story | Priority | SP | Acceptance Criteria | Refs |
|----|-------|----------|----|---------------------|------|
| FE-11 | Как пользователь, я хочу видеть список продуктов сгруппированный по категориям | P0 | 5 | Группировка: молочные, мясо, овощи... Каждая позиция: товар S-Market, цена, количество | WBS 4.9, US-020-022 |
| FE-12 | Как пользователь, я хочу редактировать список: удалить, изменить количество, добавить | P0 | 5 | Inline-edit количества, кнопка удаления, поиск по каталогу для добавления | WBS 4.10, US-023 |
| FE-13 | Как пользователь, я хочу отметить "есть дома" и выбрать альтернативный товар | P1 | 3 | Checkbox "есть дома" → визуальное отличие + исключение из итога. Выбор альтернативы из выпадающего списка | US-024, FR-223, FR-224 |
| FE-14 | Как пользователь, я хочу видеть итоговую стоимость и нажать "Готово к покупке" | P0 | 2 | Total cost внизу, кнопка "Отправить в Chrome Extension" → подсказка по установке/использованию | WBS 4.11, US-022 |

---

### EPIC-11: Localization (i18n)

| ID | Story | Priority | SP | Acceptance Criteria | Refs |
|----|-------|----------|----|---------------------|------|
| I18N-01 | Как пользователь, я хочу интерфейс на английском (по умолчанию) | P0 | 2 | next-intl / аналог, все строки через translation keys | NFR-040 |
| I18N-02 | Как пользователь, я хочу переключить интерфейс на финский | P1 | 5 | Полный перевод UI на Suomi, переключатель в настройках | NFR-040 |
| I18N-03 | Как система, рецепты хранятся на двух языках, товары — на финском | P0 | 1 | title_en + title_fi для рецептов, name_fi для товаров | NFR-041 |
| I18N-04 | Как система, все цены в евро формата X,XX EUR | P0 | 1 | Форматирование через Intl.NumberFormat('fi-FI') | NFR-042 |

---

### EPIC-12: GDPR & Privacy

| ID | Story | Priority | SP | Acceptance Criteria | Refs |
|----|-------|----------|----|---------------------|------|
| GDPR-01 | Как пользователь, я хочу экспортировать все свои данные | P0 | 3 | GET /user/export → JSON со всеми персональными данными | NFR-022 |
| GDPR-02 | Как пользователь, я хочу удалить свой аккаунт и все данные | P0 | 3 | DELETE /user → каскадное удаление всех данных, 30-day grace period optional | NFR-022 |
| GDPR-03 | Как пользователь, я хочу видеть Privacy Policy (en/fi) | P0 | 2 | Страница Privacy Policy, доступная без авторизации | NFR-022, WBS 4.16 |
| GDPR-04 | Как пользователь, я хочу дать согласие на обработку данных (cookie consent) | P0 | 2 | Cookie consent banner, opt-in, запись согласия | NFR-022, WBS 4.16 |
| GDPR-05 | Как система, все данные хранятся в EU-юрисдикции | P0 | 1 | Neon eu-north-1, Upstash EU, OpenAI DPA | NFR-022, R7 |
| GDPR-06 | Как система, медицинские данные анонимизируются при отправке в OpenAI | P0 | 2 | В AI-prompt нет имён, только "Member 1 (adult, 35)" + ограничения | R7 |

---

### EPIC-13: Monitoring, Observability & DevOps

| ID | Story | Priority | SP | Acceptance Criteria | Refs |
|----|-------|----------|----|---------------------|------|
| OPS-01 | Как система, я хочу health endpoints | P0 | 1 | GET /health, /health/db, /health/redis → 200 если OK | WBS 1.12 |
| OPS-02 | Как DevOps, я хочу error tracking (Sentry) | P1 | 2 | Sentry подключен к frontend + backend, source maps | WBS 0.11 |
| OPS-03 | Как DevOps, я хочу uptime monitoring (Betterstack) | P1 | 1 | Мониторинг /health, алерт при downtime >5 мин | WBS 0.11, NFR-030 |
| OPS-04 | Как DevOps, я хочу CI pipeline: lint + typecheck + test + build | P0 | 5 | GitHub Actions, кэширование node_modules, fail fast | WBS 0.4 |
| OPS-05 | Как DevOps, я хочу staging environment | P1 | 3 | Neon branch для staging, Docker Compose на Hetzner | WBS 0.5-0.6 |
| OPS-06 | Как DevOps, я хочу автоматические бэкапы БД | P1 | 1 | Neon PITR, 30 дней хранения | NFR-031 |

---

### EPIC-14: Performance & Optimization

| ID | Story | Priority | SP | Acceptance Criteria | Refs |
|----|-------|----------|----|---------------------|------|
| PERF-01 | Как пользователь, я хочу видеть загрузку страницы < 2 сек (FCP) | P1 | 3 | FCP < 2s, TTI < 4s. Lazy loading, code splitting | NFR-004, WBS 6.7 |
| PERF-02 | Как система, API p95 latency < 500ms | P0 | 2 | Все endpoints кроме /menu/generate. Prometheus/logging | NFR-005 |
| PERF-03 | Как пользователь, я хочу видеть streaming-результат генерации меню | P1 | 3 | SSE from backend, показ частичных результатов + skeleton | R8 |
| PERF-04 | Как система, responsive layout работает от 375px | P1 | 3 | Тестирование: iPhone SE, iPhone 14, Samsung Galaxy S21 | NFR-052, WBS 4.14 |
| PERF-05 | Как система, Lighthouse score > 80 | P1 | 2 | Performance, Accessibility, Best Practices, SEO | WBS 6.7 |

---

### EPIC-15: Analytics & Growth

| ID | Story | Priority | SP | Acceptance Criteria | Refs |
|----|-------|----------|----|---------------------|------|
| GRW-01 | Как PM, я хочу отслеживать funnel: регистрация → onboarding → генерация → список → extension | P1 | 3 | PostHog или аналог, events на каждом шаге | Section 9.2 |
| GRW-02 | Как PM, я хочу видеть WAU/MAU и retention | P1 | 2 | Weekly/Monthly Active Users, cohort retention | Section 9.2 |
| GRW-03 | Как PM, я хочу собирать NPS от пользователей | P2 | 2 | NPS-опрос после 2 недель использования, target > 40 | Section 1.5 |
| GRW-04 | Как PM, я хочу знать среднее количество замен блюд на пользователя | P2 | 1 | Метрика: если < 3 замен, меню считается качественным | Section 9.1 |
| GRW-05 | Как PM, я хочу email-напоминание "Пора планировать меню" | P2 | 3 | Weekly email (Resend), opt-out, персонализированное время | R9 |

---

## 4. MVP Scope (Must-Have)

### Критический путь пользователя (Happy Path):

```
Регистрация → Onboarding (профиль семьи) → Генерация меню → Просмотр/замена блюд →
Утверждение меню → Формирование списка → Редактирование → "Готово к покупке" →
Chrome Extension → Авторизация → Добавление в корзину → Отчёт
```

### MVP Stories (P0 only):

| Epic | Story IDs | Total SP |
|------|-----------|----------|
| EPIC-01 | AUTH-01, AUTH-02, AUTH-03, AUTH-06 | 10 |
| EPIC-02 | FAM-01..04, FAM-08, FAM-09 | 15 |
| EPIC-03 | MENU-01..05, MENU-07, MENU-12 | 28 |
| EPIC-04 | REC-01, REC-02, REC-04, REC-06 | 11 |
| EPIC-05 | SHOP-01..09, SHOP-14 | 23 |
| EPIC-06 | CAT-01..06, CAT-08 | 27 |
| EPIC-07 | EXT-01..08, EXT-11, EXT-12 | 40 |
| EPIC-08 | FE-01..03 | 15 |
| EPIC-09 | FE-05..08 | 21 |
| EPIC-10 | FE-11, FE-12, FE-14 | 12 |
| EPIC-11 | I18N-01, I18N-03, I18N-04 | 4 |
| EPIC-12 | GDPR-01..06 | 13 |
| EPIC-13 | OPS-01, OPS-04 | 6 |
| EPIC-14 | PERF-02 | 2 |
| **TOTAL MVP** | | **~227 SP** |

**При velocity ~40 SP/sprint (2 недели) → ~6 спринтов → 12 недель.** Это согласуется с project-plan.md (14-16 недель с QA+Beta).

---

## 5. Post-MVP Features (v1.1+)

### v1.1 (Sprint после Beta, +2-3 недели)

| ID | Feature | SP | Business Value |
|----|---------|----|----|
| AUTH-04 | Google OAuth | 3 | Снижение барьера регистрации, +20-30% конверсия |
| SHOP-12 | Акции и выгодные замены | 3 | Ключевое УТП — экономия денег |
| SHOP-13 | Замены при отсутствии товара | 3 | Уменьшение frustration, >90% добавление в корзину |
| REC-05 | Пользовательские рецепты | 5 | Engagement, retention |
| MENU-09 | Fallback-меню при недоступности AI | 5 | Reliability |
| GRW-01 | Analytics funnel | 3 | Понимание где теряем пользователей |

### v1.2 (Month 5-6)

| ID | Feature | SP | Business Value |
|----|---------|----|----|
| FE-10 | Нутриентный баланс (БЖУ) | 3 | Health-conscious аудитория Финляндии |
| CAT-10 | Каталог 5000+ SKU | 8 | Полное покрытие ингредиентов |
| GRW-05 | Email-напоминания | 3 | Retention +15-20% |
| GRW-03 | NPS опрос | 2 | Product-market fit measurement |
| I18N-02 | Полный финский перевод | 5 | TAM increase (финскоязычные семьи) |

### v2.0 (Month 7-9)

| Feature | Description | Business Value |
|---------|-------------|----------------|
| Второй магазин (K-Market/Prisma) | Кросс-сетевая оптимизация цен | Ключевое конкурентное преимущество vs K-Ruoka |
| Бюджет-оптимизация AI | AI подбирает дешёвые ингредиенты + акции | Core value prop — экономия 10-15% |
| Сезонность (FR-104) | Финские сезонные продукты в генерации | Качество рецептов, снижение стоимости |
| S-bonus / K-Plussa интеграция | Учёт бонусных программ | Partership opportunity, user lock-in |
| Расширение на Тампере, Турку | Каталоги магазинов других городов | SAM growth 150K → 450K семей |
| Meal prep / batch cooking | Рецепты для заготовок на неделю | Trending feature, time-saving |

---

## 6. Technical Debt & Infra Stories

| ID | Story | Priority | When |
|----|-------|----------|------|
| TECH-01 | Миграция с Docker Compose на k3s при >5000 users | P3 | Scale phase |
| TECH-02 | Миграция с Hetzner на AWS/GCP при >10000 users | P3 | Scale phase |
| TECH-03 | Автоматические smoke-тесты DOM S-kaupat.fi (еженедельно) | P1 | Post-MVP |
| TECH-04 | Fast release pipeline для Extension updates (<24h) | P1 | Post-MVP |
| TECH-05 | Fine-tuned модель на Mistral/Llama для снижения AI costs | P3 | >100K calls/day |
| TECH-06 | pgvector для AI-рекомендаций (embeddings рецептов) | P3 | v2.0 |
| TECH-07 | Neon branch-based testing в CI | P1 | Phase 0.4 |

---

## 7. Analytics & Metrics Stories

### Product KPIs to Track (from Day 1)

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Registration → Onboarding completion | >80% | Funnel event |
| Menu generation success rate | >80% first try | API logs |
| Average meal replacements per menu | <3 | Backend counter |
| Ingredient → Product mapping accuracy | >85% | Automated test suite |
| Extension cart addition success rate | >90% | Extension report |
| Weekly active users (beta) | 50-100 families | Auth + activity |
| Monthly retention (month 2+) | >60% | Cohort analysis |
| NPS | >40 | Survey |
| Average time: menu planning | <10 min | Frontend timing |
| Average time: shopping (extension) | <5 min | Extension timing |

---

## 8. Risks & Dependencies

### Blockers for MVP

| Risk | Impact | Mitigation | Owner |
|------|--------|------------|-------|
| S-kaupat.fi DOM changes | Extension breaks | Selectors in config + weekly smoke tests + fast release pipeline | Frontend Dev |
| S-kaupat.fi blocks automation | Extension useless | Realistic delays, user's own session, explore partnership | Tech Lead |
| Low AI quality | Users leave | Multi-level validation, retry, fallback menus, 20+ test profiles | AI Engineer |
| Incomplete catalog (500 SKU) | Missing items in list | Constrain AI prompt to available categories, manual add UI, iterate | PM + Backend |
| Legal risk of scraping | Cease & desist | Explore official API first, respect robots.txt, legal consultation | PM |
| GDPR violation | Fine up to 4% revenue | EU-only data storage, DPA with OpenAI, anonymization | Tech Lead |

### External Dependencies

| Dependency | Risk Level | Notes |
|------------|-----------|-------|
| OpenAI API availability | Medium | Fallback menus + Redis cache mitigate |
| S-kaupat.fi / S-kaupat.fi stability | High | DOM may change, site may block bots |
| Neon PostgreSQL | Low | Managed service, 99.95% SLA |
| Clerk Auth | Low | Managed, can self-host later |
| Chrome Web Store review | Medium | 1-3 days review, plan ahead |

---

## 9. Appendix: Traceability Matrix

| ТЗ Requirement | Backlog Story | Epic | Phase |
|---------------|---------------|------|-------|
| US-001 | AUTH-01, AUTH-02, FE-01 | 01, 08 | 1, 4 |
| US-002 | FAM-01, FAM-02, FE-02 | 02, 08 | 1, 4 |
| US-003 | FAM-03, FE-02 | 02, 08 | 1, 4 |
| US-004 | FAM-04, FE-02 | 02, 08 | 1, 4 |
| US-005 | FAM-05, FE-02 | 02, 08 | 1, 4 |
| US-006 | FAM-06, FE-02 | 02, 08 | 1, 4 |
| US-007 | FAM-07, FE-02 | 02, 08 | 1, 4 |
| US-010 | MENU-01, FE-05 | 03, 09 | 2, 4 |
| US-011 | REC-02, FE-06 | 04, 09 | 1, 4 |
| US-012 | MENU-05, FE-07 | 03, 09 | 2, 4 |
| US-013 | MENU-06, FE-08 | 03, 09 | 2, 4 |
| US-014 | MENU-08 | 03 | 2 |
| US-015 | FE-09 | 09 | 4 |
| US-016 | MENU-12 | 03 | 2 |
| US-017 | REC-05 | 04 | Post-MVP |
| US-020 | SHOP-01, FE-11 | 05, 10 | 1, 4 |
| US-021 | SHOP-04, FE-11 | 05, 10 | 1, 4 |
| US-022 | SHOP-06, FE-14 | 05, 10 | 1, 4 |
| US-023 | SHOP-07..09, FE-12 | 05, 10 | 1, 4 |
| US-024 | SHOP-10, FE-13 | 05, 10 | 1, 4 |
| US-025 | SHOP-11, SHOP-13 | 05 | 1, Post-MVP |
| US-026 | SHOP-12 | 05 | Post-MVP |
| US-030 | EXT-01, EXT-02 | 07 | 5 |
| US-031 | EXT-03 | 07 | 5 |
| US-032 | EXT-06 | 07 | 5 |
| US-033 | EXT-07 | 07 | 5 |
| US-034 | EXT-09 | 07 | 5 |
| US-035 | EXT-11 | 07 | 5 |
| FR-100..103 | MENU-01..04, MENU-11, MENU-12 | 03 | 2 |
| FR-110..114 | REC-01..05 | 04 | 1, Post-MVP |
| FR-120..122 | FE-09, FE-10 | 09 | 4 |
| FR-200..202 | SHOP-01..03 | 05 | 1 |
| FR-210..214 | SHOP-04..06, SHOP-12, SHOP-13, CAT-03 | 05, 06 | 1, 3, Post-MVP |
| FR-220..224 | SHOP-07..11 | 05 | 1 |
| FR-300..302 | EXT-01, EXT-02, EXT-12 | 07 | 5 |
| FR-310..316 | EXT-03..06, EXT-08 | 07 | 5 |
| FR-320..323 | EXT-07, EXT-09, EXT-10 | 07 | 5 |
| NFR-001..005 | PERF-01..03, MENU-01, SHOP-01 | 14 | 6 |
| NFR-020..024 | AUTH-01, AUTH-06, EXT-11, GDPR-05 | 01, 07, 12 | 1, 5 |
| NFR-022 | GDPR-01..06 | 12 | 1, 4 |
| NFR-030..032 | OPS-03, OPS-06, MENU-09 | 13, 03 | 0, 2 |
| NFR-040..042 | I18N-01..04 | 11 | 4 |
| NFR-050..052 | PERF-04 | 14 | 6 |

---

_Backlog review: ежемесячно или при изменении scope. Приоритизация пересматривается после каждого спринта на основании данных и обратной связи._
