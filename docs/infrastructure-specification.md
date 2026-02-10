# Техническое задание: Инфраструктура проекта FoodOps

**Версия документа:** 1.1
**Дата:** 2026-02-10 (updated after Phase 0 completion)
**Статус:** Approved (Phase 0 complete, Phase 1 in progress)

---

## Содержание

1. [Обзор инфраструктурных требований](#1-обзор-инфраструктурных-требований)
2. [Хостинг и облачная платформа](#2-хостинг-и-облачная-платформа)
3. [Вычислительные ресурсы](#3-вычислительные-ресурсы)
4. [Базы данных](#4-базы-данных)
5. [Сетевая инфраструктура](#5-сетевая-инфраструктура)
6. [CI/CD и DevOps](#6-cicd-и-devops)
7. [Мониторинг и логирование](#7-мониторинг-и-логирование)
8. [Безопасность](#8-безопасность)
9. [Оценка стоимости](#9-оценка-стоимости)
10. [План масштабирования](#10-план-масштабирования)
11. [Рекомендации по фазам внедрения](#11-рекомендации-по-фазам-внедрения)

---

## 1. Обзор инфраструктурных требований

### 1.1. Компоненты системы

Проект FoodOps состоит из следующих компонентов:

| Компонент                         | Технология                            | Описание                                                                                    |
| --------------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------- |
| **Frontend (Web App)**            | React/Next.js                         | SPA/SSR приложение для планирования меню, управления списками продуктов, просмотра рецептов |
| **Backend API**                   | Node.js (Fastify)                     | REST API для бизнес-логики, управления пользователями, обработки заказов                    |
| **AI/ML модуль**                  | Node.js (Fastify) + OpenAI API        | Генерация меню, подбор продуктов, персонализация рекомендаций                               |
| **Chrome Extension**              | JavaScript/TypeScript                 | Автоматизация покупки на S-kaupat.fi (S-Market), парсинг каталога                           |
| **База данных**                   | PostgreSQL                            | Хранение пользователей, меню, рецептов, продуктов, истории заказов                          |
| **Кэш**                           | Redis                                 | Кэширование каталога продуктов, сессий, часто запрашиваемых данных                          |
| **Поисковый движок**              | Meilisearch / Typesense               | Полнотекстовый поиск по рецептам и продуктам                                                |
| **Очередь задач**                 | BullMQ (Redis)                        | Фоновые задачи: парсинг каталога, генерация меню, отправка уведомлений                      |
| **Файловое хранилище**            | S3-совместимое                        | Изображения рецептов, пользовательские загрузки                                             |
| **Обратный прокси / API Gateway** | Nginx / Traefik / Cloud Load Balancer | Маршрутизация запросов, SSL-терминация, rate limiting                                       |

### 1.2. Диаграмма взаимодействия компонентов

```
                                    +------------------+
                                    |   CDN (Static)   |
                                    | Cloudflare/Vercel|
                                    +--------+---------+
                                             |
                    +------------------------+------------------------+
                    |                                                 |
           +--------v---------+                             +---------v--------+
           |  Frontend (SSR)  |                             | Chrome Extension |
           |  Next.js/Vercel  |                             |  (клиент юзера) |
           +--------+---------+                             +---------+--------+
                    |                                                 |
                    |            HTTPS / WebSocket                    |
                    +------------------------+------------------------+
                                             |
                                    +--------v---------+
                                    |  Load Balancer   |
                                    |  / API Gateway   |
                                    +--------+---------+
                                             |
                         +-------------------+-------------------+
                         |                                       |
                +--------v---------+                   +---------v--------+
                |   Backend API    |                   |   AI/ML Module   |
                |    (Fastify)     |                   |   (Fastify +     |
                |  2+ instances    |                   |   OpenAI API)    |
                +--------+---------+                   +---------+--------+
                         |                                       |
            +------------+------------+                          |
            |            |            |                          |
   +--------v---+ +------v-----+ +---v--------+                 |
   | PostgreSQL | |   Redis    | | Meilisearch|                 |
   |   (Neon)   | | (Cache +   | | (Поиск)   |                 |
   |            | |  Queues)   | |            |                 |
   +------------+ +------------+ +------------+                 |
                                                                |
                                                    +-----------v-----------+
                                                    |   Внешние API         |
                                                    | - OpenAI API          |
                                                    | - S-kaupat.fi каталог   |
                                                    | - S-Market API        |
                                                    +-----------------------+
```

### 1.3. Потоки данных

**Основной пользовательский поток:**

1. Пользователь открывает веб-приложение (Frontend)
2. Frontend запрашивает данные через Backend API
3. Backend обращается к PostgreSQL за данными пользователя, рецептами, меню
4. Для поиска продуктов/рецептов Backend обращается к Meilisearch
5. Для генерации меню Backend вызывает AI/ML модуль
6. AI/ML модуль использует OpenAI API + данные из БД для генерации
7. Результаты кэшируются в Redis

**Поток покупки через Chrome Extension:**

1. Пользователь формирует список покупок в веб-приложении
2. Chrome Extension получает список через Backend API
3. Extension автоматизирует добавление товаров в корзину на S-kaupat.fi
4. Статус покупки обновляется через Backend API

**Фоновые процессы:**

1. Периодический парсинг каталога S-kaupat.fi (через очередь BullMQ)
2. Обновление поискового индекса Meilisearch
3. Генерация рекомендаций для пользователей
4. Отправка уведомлений (email, push)

### 1.4. Нефункциональные требования

| Параметр                    | Требование MVP | Требование Scale |
| --------------------------- | -------------- | ---------------- |
| Доступность (Uptime)        | 99.5%          | 99.9%            |
| Время ответа API (p95)      | < 500 мс       | < 200 мс         |
| Время генерации меню        | < 10 сек       | < 5 сек          |
| RPS (запросов в секунду)    | 10-50          | 500-2000         |
| Время восстановления (RTO)  | < 4 часа       | < 30 мин         |
| Потеря данных (RPO)         | < 24 часа      | < 1 час          |
| Одновременных пользователей | 50-100         | 5000-10000       |

---

## 2. Хостинг и облачная платформа

### 2.1. Анализ облачных провайдеров

#### Вариант A: Hetzner Cloud + Managed Services (рекомендуется для MVP)

**Обоснование:**

- Дата-центр в Хельсинки (helsinki1) -- минимальная задержка для целевого рынка Финляндии
- Стоимость в 3-5 раз ниже, чем у AWS/GCP при сопоставимой производительности
- Отличное соотношение цена/качество для стартапа
- GDPR-совместимая юрисдикция (Германия/Финляндия)
- Managed-сервисы можно добрать из экосистемы: Neon (PostgreSQL), Upstash (Redis), Vercel (Frontend)

**Ограничения:**

- Нет managed Kubernetes (нужен самостоятельный k3s или Docker Compose)
- Меньше managed-сервисов по сравнению с AWS/GCP
- Нет GPU-серверов (не критично при использовании OpenAI API)

#### Вариант B: AWS (рекомендуется для фазы Scale)

**Обоснование:**

- Регион eu-north-1 (Стокгольм) -- 200 км от Хельсинки, задержка ~5 мс
- Полный набор managed-сервисов (RDS, ElastiCache, ECS/EKS, Lambda, CloudFront)
- Mature auto-scaling, мониторинг, безопасность из коробки
- AWS Activate для стартапов (до $100k кредитов)

**Ограничения:**

- Высокая стоимость при малых объёмах
- Сложность конфигурации

#### Вариант C: GCP

**Обоснование:**

- Регион europe-north1 (Хамина, Финляндия) -- дата-центр непосредственно в Финляндии
- Отличная интеграция с AI/ML (Vertex AI, Cloud Run)
- Google Cloud for Startups (до $200k кредитов)

**Ограничения:**

- Менее предсказуемые цены
- Меньше специалистов на рынке

### 2.2. Рекомендация

**Гибридный подход по фазам:**

| Фаза                  | Платформа                               | Обоснование                                                  |
| --------------------- | --------------------------------------- | ------------------------------------------------------------ |
| MVP (Фаза 1)          | Hetzner Cloud (Helsinki) + SaaS-сервисы | Минимальная стоимость, максимальная близость к пользователям |
| Early Growth (Фаза 2) | Hetzner Cloud + больше managed SaaS     | Масштабирование за счёт SaaS-компонентов                     |
| Scale (Фаза 3)        | AWS eu-north-1 или GCP europe-north1    | Полноценный auto-scaling, managed-сервисы                    |

### 2.3. Выбор региона

| Провайдер   | Регион        | Расположение             | Задержка до Хельсинки |
| ----------- | ------------- | ------------------------ | --------------------- |
| **Hetzner** | **helsinki1** | **Хельсинки, Финляндия** | **< 1 мс**            |
| GCP         | europe-north1 | Хамина, Финляндия        | ~2 мс                 |
| AWS         | eu-north-1    | Стокгольм, Швеция        | ~5 мс                 |
| Azure       | North Europe  | Ирландия                 | ~30 мс                |

### 2.4. SaaS-компоненты (не зависят от выбора хостинга)

| Сервис           | Провайдер                           | Назначение                           |
| ---------------- | ----------------------------------- | ------------------------------------ |
| Frontend Hosting | Vercel                              | SSR, Edge Functions, CDN             |
| PostgreSQL       | Neon                                | Serverless PostgreSQL с branching    |
| Redis            | Upstash                             | Serverless Redis для кэша и очередей |
| Поиск            | Meilisearch Cloud / Typesense Cloud | Полнотекстовый поиск                 |
| AI API           | OpenAI API                          | Генерация меню, NLP                  |
| Email            | Resend / Postmark                   | Транзакционные письма                |
| Auth             | Clerk / Auth.js                     | Аутентификация                       |
| Мониторинг       | Betterstack / Sentry                | Логи, ошибки, uptime                 |
| DNS + CDN        | Cloudflare                          | DNS, DDoS-защита, CDN                |

---

## 3. Вычислительные ресурсы

### 3.1. Backend API сервер

#### MVP (100-1000 пользователей)

| Параметр        | Значение                                       |
| --------------- | ---------------------------------------------- |
| Сервер          | Hetzner CX22 или CAX11 (ARM)                   |
| CPU             | 2 vCPU                                         |
| RAM             | 4 GB                                           |
| Диск            | 40 GB SSD NVMe                                 |
| Количество      | 1 (с возможностью быстрого добавления второго) |
| ОС              | Ubuntu 24.04 LTS                               |
| Контейнеризация | Docker Compose                                 |

**Альтернатива (serverless):**

- Vercel Edge Functions для Frontend API routes
- Railway / Render для Backend API (managed container hosting)

#### Early Growth (1000-10000 пользователей)

| Параметр        | Значение                               |
| --------------- | -------------------------------------- |
| Сервер          | Hetzner CX32 или CAX21 (ARM)           |
| CPU             | 4 vCPU                                 |
| RAM             | 8 GB                                   |
| Диск            | 80 GB SSD NVMe                         |
| Количество      | 2 (за load balancer)                   |
| Контейнеризация | Docker Compose + Hetzner Load Balancer |

#### Scale (50000+ пользователей)

| Параметр        | Значение                                    |
| --------------- | ------------------------------------------- |
| Платформа       | AWS ECS Fargate или GCP Cloud Run           |
| CPU             | 2-4 vCPU на контейнер                       |
| RAM             | 4-8 GB на контейнер                         |
| Количество      | 4-10 (auto-scaling)                         |
| Контейнеризация | Kubernetes (EKS/GKE) или managed containers |

### 3.2. AI/ML модуль

#### Архитектурное решение: API-based подход

**Обоснование отказа от собственных GPU-серверов:**

- На этапе MVP и Early Growth использование OpenAI API значительно дешевле выделенных GPU
- Нет необходимости в обучении моделей -- используются pre-trained модели
- Задачи генерации меню и подбора продуктов хорошо решаются через prompt engineering
- GPU-серверы (Hetzner GEX44: ~$200/мес) оправданы только при > 100 000 API-вызовов/день

#### MVP конфигурация AI/ML

| Параметр    | Значение                                                |
| ----------- | ------------------------------------------------------- |
| Модель      | OpenAI GPT-4o-mini (основная) / GPT-4o (сложные задачи) |
| Сервер      | Тот же, что Backend API (отдельный контейнер)           |
| Rate limits | 10 000 RPM (tier 2 OpenAI)                              |
| Fallback    | DeepSeek V3 (Plan B) / шаблонные меню (Plan C)          |
| Кэширование | Redis -- кэширование результатов генерации меню         |

#### Оценка объёма AI-вызовов

| Сценарий                    | Вызовов/день (1000 юзеров) | Стоимость/мес |
| --------------------------- | -------------------------- | ------------- |
| Генерация недельного меню   | ~200                       | ~$15          |
| Подбор продуктов            | ~500                       | ~$10          |
| Персонализация рекомендаций | ~300                       | ~$8           |
| **Итого**                   | **~1000**                  | **~$33**      |

#### Scale конфигурация AI/ML

| Параметр          | Значение                                                  |
| ----------------- | --------------------------------------------------------- |
| Основная модель   | OpenAI GPT-4o-mini (batch API для снижения стоимости)     |
| Выделенный сервер | Отдельный контейнер/сервис, 2 vCPU / 4 GB RAM             |
| Кэширование       | Агрессивное кэширование сгенерированных меню (TTL 24h)    |
| Очередь           | BullMQ для асинхронной генерации                          |
| Рассмотреть       | Fine-tuned модели на Mistral/Llama для снижения стоимости |

### 3.3. Контейнеризация

#### MVP: Docker Compose

```yaml
# Структура docker-compose.yml
services:
  backend-api: # Fastify backend
  ai-service: # AI/ML модуль (Fastify + OpenAI)
  meilisearch: # Поисковый движок
  redis: # Кэш + очереди
  nginx: # Reverse proxy + SSL
  worker: # Background job processor
```

**Обоснование Docker Compose для MVP:**

- Простота развёртывания и отладки
- Один сервер обслуживает все компоненты
- Легко перейти на Kubernetes при росте
- Compose файл служит документацией инфраструктуры

#### Early Growth: Docker Compose + Load Balancer

- 2 сервера с идентичной конфигурацией Docker Compose
- Hetzner Load Balancer для распределения трафика
- Отдельный сервер для фоновых задач (worker)

#### Scale: Kubernetes (k8s)

- AWS EKS или GCP GKE
- Helm charts для управления деплоем
- Horizontal Pod Autoscaler (HPA) для auto-scaling
- Отдельные node pools для разных типов нагрузки

### 3.4. Serverless опции (альтернативный путь для MVP)

| Компонент       | Serverless вариант               | Стоимость (MVP) |
| --------------- | -------------------------------- | --------------- |
| Frontend        | Vercel (Next.js)                 | $0-20/мес       |
| Backend API     | Vercel Edge Functions / Railway  | $0-25/мес       |
| AI Service      | AWS Lambda / GCP Cloud Functions | $5-15/мес       |
| Background Jobs | Inngest / Trigger.dev            | $0-25/мес       |

**Суммарно serverless MVP: $5-85/мес** (но выше latency и vendor lock-in)

---

## 4. Базы данных

### 4.1. Основная БД: PostgreSQL

#### Рекомендация: Neon (Serverless PostgreSQL)

**Обоснование выбора Neon:**

- Serverless -- автоматическое масштабирование, оплата за использование
- Branching -- создание веток БД для тестирования миграций и фич
- Регион AWS eu-north-1 (через партнёрство с AWS) -- низкая задержка
- Встроенный connection pooling (PgBouncer)
- Scale-to-zero -- экономия при низкой нагрузке (актуально для MVP)
- Автоматические бэкапы с point-in-time recovery (PITR)
- Поддержка расширений: pgvector (для AI embeddings), PostGIS

#### Схема данных (основные таблицы)

```
users                  -- Пользователи и профили
├── families           -- Семьи/домохозяйства
├── dietary_prefs      -- Диетические предпочтения
└── user_settings      -- Настройки пользователя

recipes                -- Рецепты
├── recipe_ingredients -- Ингредиенты рецепта
├── recipe_tags        -- Теги рецепта
└── recipe_nutrition   -- Нутриенты

menus                  -- Сгенерированные меню
├── menu_days          -- Дни меню
└── menu_meals         -- Приёмы пищи

products               -- Каталог продуктов магазина
├── product_prices     -- История цен
├── product_categories -- Категории
└── product_matches    -- Сопоставление ингредиент <-> продукт

shopping_lists         -- Списки покупок
├── shopping_items     -- Элементы списка
└── purchase_history   -- История покупок

stores                 -- Магазины
└── store_catalogs     -- Каталоги магазинов
```

#### Конфигурация по фазам

| Фаза          | План Neon | Compute                | Storage | Стоимость |
| ------------- | --------- | ---------------------- | ------- | --------- |
| MVP           | Free Tier | 0.25 CU (shared)       | 0.5 GB  | $0/мес    |
| MVP (платный) | Launch    | 0.5-2 CU (autoscaling) | 10 GB   | $19/мес   |
| Early Growth  | Scale     | 1-4 CU (autoscaling)   | 50 GB   | $69/мес   |
| Scale         | Business  | 2-8 CU + read replicas | 200 GB  | $349+/мес |

**CU (Compute Unit) = 1 vCPU + 4 GB RAM**

#### Альтернативы PostgreSQL

| Провайдер          | Плюсы                                | Минусы                    | Стоимость (MVP) |
| ------------------ | ------------------------------------ | ------------------------- | --------------- |
| **Neon**           | Serverless, branching, scale-to-zero | Молодой продукт           | $0-19/мес       |
| Supabase           | PostgreSQL + Auth + Realtime         | Менее гибкая конфигурация | $0-25/мес       |
| AWS RDS            | Mature, надёжный                     | Дороже, нет scale-to-zero | $30-50/мес      |
| Hetzner Managed DB | Дешёвый, в Хельсинки                 | Минимум функций           | $12/мес         |

#### Расширения PostgreSQL

| Расширение  | Назначение                                                |
| ----------- | --------------------------------------------------------- |
| `pgvector`  | Векторный поиск для AI-рекомендаций (embeddings рецептов) |
| `pg_trgm`   | Нечёткий поиск по названиям продуктов (финский + русский) |
| `btree_gin` | Ускорение комбинированных индексов                        |
| `uuid-ossp` | Генерация UUID для внешних идентификаторов                |

### 4.2. Кэширование: Redis

#### Рекомендация: Upstash (Serverless Redis)

**Обоснование:**

- Serverless -- оплата per-request
- Глобальная сеть, включая EU
- Встроенная поддержка HTTP (REST API) -- работает из Edge Functions
- Поддержка BullMQ для очередей задач

#### Стратегия кэширования

| Данные               | TTL      | Стратегия     | Причина                                      |
| -------------------- | -------- | ------------- | -------------------------------------------- |
| Каталог продуктов    | 6 часов  | Cache-Aside   | Обновляется парсером несколько раз в день    |
| Цены продуктов       | 1 час    | Cache-Aside   | Цены могут меняться                          |
| Сгенерированные меню | 24 часа  | Write-Through | Тяжёлая операция, результат переиспользуется |
| Сессии пользователей | 7 дней   | Write-Through | Авторизация                                  |
| Результаты поиска    | 30 минут | Cache-Aside   | Частые повторные запросы                     |
| Rate limiter данные  | 1 минута | Write-Through | Защита API                                   |

#### Конфигурация по фазам

| Фаза         | План Upstash  | Запросов/день | Стоимость    |
| ------------ | ------------- | ------------- | ------------ |
| MVP          | Free          | 10 000        | $0/мес       |
| Early Growth | Pay-as-you-go | 100 000       | $10-30/мес   |
| Scale        | Pro           | 1 000 000+    | $100-280/мес |

**Альтернативы:**

- Dragonfly на Hetzner (самоуправляемый, дешевле на Scale)
- AWS ElastiCache (при переезде на AWS)

### 4.3. Поисковый движок

#### Рекомендация: Meilisearch

**Обоснование:**

- Быстрый поиск с поддержкой опечаток (typo-tolerance) -- критично для финских слов
- Легковесный, можно запустить в Docker на MVP
- Meilisearch Cloud для managed-варианта
- Встроенная фильтрация и фасетный поиск
- Поддержка мультиязычности (финский, шведский, английский, русский)

#### Индексы поиска

| Индекс        | Документов (MVP) | Документов (Scale) | Поля для поиска                      |
| ------------- | ---------------- | ------------------ | ------------------------------------ |
| `recipes`     | 500-2000         | 50 000+            | name, description, ingredients, tags |
| `products`    | 5000-20000       | 100 000+           | name, brand, category, ean           |
| `ingredients` | 1000-3000        | 10 000+            | name, aliases, category              |

#### Конфигурация по фазам

| Фаза         | Развёртывание                             | Стоимость                       |
| ------------ | ----------------------------------------- | ------------------------------- |
| MVP          | Docker-контейнер на основном сервере      | $0 (входит в стоимость сервера) |
| Early Growth | Meilisearch Cloud (Basic)                 | $30/мес                         |
| Scale        | Meilisearch Cloud (Pro) или Elasticsearch | $100-300/мес                    |

**Альтернативы:**

- Typesense (аналог, hosted вариант)
- Elasticsearch/OpenSearch (более мощный, но сложнее и дороже)
- PostgreSQL full-text search + pg_trgm (для MVP, если нужно ещё проще)

### 4.4. Хранение файлов

#### Рекомендация: Cloudflare R2 (S3-совместимое)

**Обоснование:**

- S3-совместимый API
- Нет egress-费用 (бесплатный исходящий трафик) -- значительная экономия
- Глобальная CDN Cloudflare из коробки
- Стоимость хранения: $0.015/GB/мес

#### Типы хранимых файлов

| Тип                   | Объём (MVP) | Объём (Scale) | Доступ          |
| --------------------- | ----------- | ------------- | --------------- |
| Изображения рецептов  | 1-5 GB      | 50-100 GB     | Публичный (CDN) |
| Аватары пользователей | 0.1 GB      | 5 GB          | Публичный (CDN) |
| Изображения продуктов | 2-10 GB     | 50 GB         | Публичный (CDN) |
| Бэкапы/экспорты       | 0.5 GB      | 10 GB         | Приватный       |

#### Конфигурация по фазам

| Фаза         | Хранилище                       | Стоимость |
| ------------ | ------------------------------- | --------- |
| MVP          | Cloudflare R2 Free Tier (10 GB) | $0/мес    |
| Early Growth | Cloudflare R2 (50 GB)           | $0.75/мес |
| Scale        | Cloudflare R2 (200 GB)          | $3/мес    |

**Альтернативы:**

- AWS S3 (дороже из-за egress)
- Hetzner Object Storage (дешевле, но менее зрелый)
- Supabase Storage (если используется Supabase)

---

## 5. Сетевая инфраструктура

### 5.1. CDN для статики

#### Рекомендация: Cloudflare (бесплатный план для MVP)

**Конфигурация:**

- Проксирование всего трафика через Cloudflare
- Кэширование статики: CSS, JS, изображения, шрифты
- Page Rules для оптимизации кэширования
- Polish (оптимизация изображений) -- на Pro-плане

| Фаза         | План Cloudflare | Возможности            | Стоимость |
| ------------ | --------------- | ---------------------- | --------- |
| MVP          | Free            | CDN, базовый DDoS, SSL | $0/мес    |
| Early Growth | Pro             | WAF, Polish, Analytics | $20/мес   |
| Scale        | Business        | Advanced WAF, SLA 100% | $200/мес  |

**Дополнительно для Frontend:**

- Vercel Edge Network (если Frontend на Vercel) -- встроенная CDN
- Кэширование SSR-страниц: ISR (Incremental Static Regeneration)

### 5.2. Load Balancing

#### MVP: Нет необходимости (один сервер)

- Nginx как reverse proxy внутри Docker Compose
- SSL-терминация на Cloudflare (Full Strict mode)

#### Early Growth: Hetzner Load Balancer

| Параметр        | Значение                             |
| --------------- | ------------------------------------ |
| Тип             | Hetzner Load Balancer LB11           |
| Алгоритм        | Round Robin с health checks          |
| Health Check    | HTTP GET /health каждые 10 сек       |
| Sticky Sessions | По cookie (для WebSocket соединений) |
| SSL             | Терминация на Cloudflare             |
| Стоимость       | ~$6/мес                              |

#### Scale: AWS ALB / GCP Cloud Load Balancer

| Параметр                 | Значение                       |
| ------------------------ | ------------------------------ |
| Тип                      | Application Load Balancer (L7) |
| Routing                  | Path-based (/api/_, /ai/_)     |
| Health Check             | HTTP GET /health каждые 5 сек  |
| Auto-scaling integration | Target Group с ECS/GKE         |
| SSL                      | ACM/Let's Encrypt              |
| WAF                      | AWS WAF / Cloud Armor          |

### 5.3. DNS и домены

#### Рекомендуемая структура доменов

| Домен               | Назначение                 | Где хостится                |
| ------------------- | -------------------------- | --------------------------- |
| `foodops.fi`        | Основной домен (Финляндия) | Cloudflare DNS              |
| `www.foodops.fi`    | Редирект на foodops.fi     | Cloudflare                  |
| `app.foodops.fi`    | Web-приложение (Frontend)  | Vercel                      |
| `api.foodops.fi`    | Backend API                | Hetzner / AWS               |
| `ai.foodops.fi`     | AI/ML API (внутренний)     | Hetzner / AWS               |
| `search.foodops.fi` | Meilisearch (внутренний)   | Hetzner / Meilisearch Cloud |
| `status.foodops.fi` | Status page                | Betterstack                 |

**Конфигурация DNS:**

- Регистратор: Namecheap или Cloudflare Registrar
- DNS-хостинг: Cloudflare (бесплатно)
- Домен .fi: ~$15-25/год (через Ficora/аккредитованного регистратора)

### 5.4. SSL/TLS сертификаты

| Компонент         | Тип сертификата    | Провайдер                  | Стоимость |
| ----------------- | ------------------ | -------------------------- | --------- |
| Публичные домены  | Wildcard SSL       | Cloudflare (Universal SSL) | $0        |
| Origin Server     | Origin Certificate | Cloudflare (15-летний)     | $0        |
| Internal services | Let's Encrypt      | Certbot / Traefik          | $0        |
| Vercel Frontend   | Автоматический     | Vercel                     | $0        |

**Режим SSL:**

- Cloudflare -> Origin: Full (Strict) mode
- Минимальная версия TLS: 1.2
- HSTS включён (max-age=31536000, includeSubDomains)
- OCSP Stapling включён

### 5.5. VPC / Сетевая изоляция

#### MVP: Hetzner Private Network

```
+--------------------------------------------------+
|  Hetzner Private Network (10.0.0.0/16)           |
|                                                    |
|  +-------------+  +----------+  +-------------+  |
|  | Backend API |  |  Redis   |  | Meilisearch |  |
|  | 10.0.1.10   |  | 10.0.1.20|  | 10.0.1.30   |  |
|  +-------------+  +----------+  +-------------+  |
|                                                    |
|  Firewall Rules:                                   |
|  - Inbound: только 80, 443 на Backend             |
|  - Internal: все порты между серверами             |
|  - Outbound: все (для API calls)                   |
+--------------------------------------------------+
         |
         | Публичный IP (Cloudflare Proxy)
         |
    +----+----+
    | Internet |
    +----------+
```

#### Scale: AWS VPC

```
+------------------------------------------------------------+
|  VPC (10.0.0.0/16)                                          |
|                                                              |
|  +-- Public Subnet (10.0.1.0/24) -------+                  |
|  |  ALB, NAT Gateway                     |                  |
|  +----------------------------------------+                  |
|                                                              |
|  +-- Private Subnet App (10.0.2.0/24) --+                  |
|  |  ECS Tasks (Backend, AI)              |                  |
|  +----------------------------------------+                  |
|                                                              |
|  +-- Private Subnet Data (10.0.3.0/24) -+                  |
|  |  RDS, ElastiCache                     |                  |
|  +----------------------------------------+                  |
+------------------------------------------------------------+
```

---

## 6. CI/CD и DevOps

### 6.1. Репозиторий и branching стратегия

#### Структура репозиториев

| Репозиторий         | Содержимое             | Платформа |
| ------------------- | ---------------------- | --------- |
| `foodops-web`       | Frontend (Next.js)     | GitHub    |
| `foodops-api`       | Backend API            | GitHub    |
| `foodops-ai`        | AI/ML модуль           | GitHub    |
| `foodops-extension` | Chrome Extension       | GitHub    |
| `foodops-infra`     | Infrastructure as Code | GitHub    |

**Или монорепо (рекомендуется для MVP):**

```
foodops/
├── apps/
│   ├── web/            # Next.js frontend
│   ├── api/            # Backend API
│   ├── ai/             # AI/ML service
│   └── extension/      # Chrome Extension
├── packages/
│   ├── shared/         # Shared types, utilities
│   ├── database/       # Prisma/Drizzle schema, migrations
│   └── config/         # Shared configs (ESLint, TS)
├── infra/              # Terraform/Docker configs
└── turbo.json          # Turborepo config
```

**Инструмент для монорепо:** Turborepo (или Nx)

#### Branching стратегия: GitHub Flow

```
main ──────────────────────────────────────────────
  │           │                  │
  ├─ feature/menu-generation ───┤ (PR + merge)
  │                              │
  ├─ feature/shopping-list ─────┤ (PR + merge)
  │                              │
  └─ fix/product-search ────────┘ (PR + merge)
```

- `main` -- всегда deployable, защищённая ветка
- `feature/*` -- фича-ветки, создаются из main
- `fix/*` -- исправления багов
- Merge через Pull Request с обязательным code review
- Автоматический деплой в staging при merge в main
- Ручное подтверждение для деплоя в production

### 6.2. CI/CD Pipeline

#### Платформа: GitHub Actions

**Pipeline для Backend API:**

```
Trigger: Push to main / PR

1. Lint & Type Check
   ├── ESLint / Ruff
   └── TypeScript / mypy

2. Unit Tests
   ├── Jest / pytest
   └── Coverage report (> 80%)

3. Integration Tests
   ├── Docker Compose up (test services)
   ├── API tests against test DB
   └── Neon branch (для DB-тестов)

4. Build
   ├── Docker image build
   ├── Tag: git SHA + latest
   └── Push to Container Registry

5. Deploy Staging (auto)
   ├── Pull image on staging server
   ├── Docker Compose pull + up
   ├── Run smoke tests
   └── Notify in Slack/Telegram

6. Deploy Production (manual approval)
   ├── Pull image on production
   ├── Rolling update (zero-downtime)
   ├── Health check
   ├── Smoke tests
   └── Rollback on failure
```

**Pipeline для Frontend:**

```
Trigger: Push to main / PR

1. Lint & Type Check
2. Unit Tests (Vitest)
3. Build (Next.js)
4. Deploy to Vercel (automatic)
   ├── Preview deploy (PR)
   └── Production deploy (main)
```

#### Container Registry

| Фаза  | Registry                            | Стоимость            |
| ----- | ----------------------------------- | -------------------- |
| MVP   | GitHub Container Registry (ghcr.io) | $0 (в рамках GitHub) |
| Scale | AWS ECR / GCP Artifact Registry     | $1-5/мес             |

### 6.3. Окружения

| Окружение      | Назначение   | Инфраструктура               | Деплой                         |
| -------------- | ------------ | ---------------------------- | ------------------------------ |
| **Local**      | Разработка   | Docker Compose + hot reload  | Ручной                         |
| **Preview**    | PR review    | Vercel Preview + Neon Branch | Автоматический на PR           |
| **Staging**    | Тестирование | Отдельный сервер / namespace | Автоматический на merge в main |
| **Production** | Продакшн     | Продакшн-серверы             | Ручное подтверждение           |

**Использование Neon Branching:**

- Каждый PR создаёт ветку Neon для изолированного тестирования БД
- Staging использует отдельную ветку Neon
- Production использует main-ветку Neon

### 6.4. Стратегия деплоя

#### MVP: Rolling Deploy

```
1. Pull new Docker image
2. Stop old container
3. Start new container
4. Health check (HTTP /health)
5. Если health check fail -> rollback к предыдущему image
```

**Downtime:** 5-15 секунд (допустимо для MVP)

#### Early Growth: Blue-Green Deploy

```
1. Текущая версия (Blue) обслуживает трафик
2. Деплой новой версии (Green) на второй набор контейнеров
3. Health check на Green
4. Переключение Load Balancer с Blue на Green
5. Мониторинг 5 минут
6. Если ОК -> удалить Blue
7. Если ошибки -> откат (переключить обратно на Blue)
```

**Downtime:** 0 секунд

#### Scale: Canary Deploy

```
1. Деплой новой версии на 10% трафика
2. Мониторинг ошибок, latency, бизнес-метрик
3. Если ОК через 10 минут -> 50%
4. Если ОК через 10 минут -> 100%
5. Автоматический rollback при росте error rate > 1%
```

### 6.5. Infrastructure as Code

#### MVP: Docker Compose + Shell Scripts

```
infra/
├── docker-compose.yml           # Основная конфигурация
├── docker-compose.staging.yml   # Оверрайды для staging
├── docker-compose.prod.yml      # Оверрайды для production
├── nginx/
│   └── nginx.conf               # Конфигурация Nginx
├── scripts/
│   ├── deploy.sh                # Скрипт деплоя
│   ├── backup.sh                # Скрипт бэкапа
│   └── rollback.sh              # Скрипт отката
└── .env.example                 # Шаблон переменных окружения
```

#### Scale: Terraform + Ansible

```
infra/
├── terraform/
│   ├── environments/
│   │   ├── staging/
│   │   │   └── main.tf
│   │   └── production/
│   │       └── main.tf
│   ├── modules/
│   │   ├── networking/          # VPC, subnets, security groups
│   │   ├── compute/             # ECS/EKS, auto-scaling
│   │   ├── database/            # RDS, ElastiCache
│   │   ├── cdn/                 # CloudFront
│   │   └── monitoring/          # CloudWatch, alarms
│   ├── variables.tf
│   └── providers.tf
├── ansible/
│   ├── playbooks/
│   │   ├── setup-server.yml
│   │   └── deploy-app.yml
│   └── inventory/
│       ├── staging
│       └── production
└── kubernetes/
    ├── base/
    │   ├── deployment.yaml
    │   ├── service.yaml
    │   └── ingress.yaml
    └── overlays/
        ├── staging/
        └── production/
```

**Рекомендуемые инструменты IaC:**

| Инструмент     | Назначение                          | Фаза                |
| -------------- | ----------------------------------- | ------------------- |
| Docker Compose | Локальная и MVP инфраструктура      | MVP                 |
| Terraform      | Облачная инфраструктура             | Early Growth+       |
| Ansible        | Конфигурация серверов (Hetzner)     | MVP - Early Growth  |
| Helm           | Kubernetes-деплой                   | Scale               |
| Pulumi         | Альтернатива Terraform (TypeScript) | Scale (опционально) |

---

## 7. Мониторинг и логирование

### 7.1. Стек мониторинга по фазам

#### MVP: Бюджетный стек

| Компонент         | Инструмент                        | Стоимость |
| ----------------- | --------------------------------- | --------- |
| Error Tracking    | Sentry (Free tier)                | $0/мес    |
| Uptime Monitoring | Betterstack (Free) / UptimeRobot  | $0/мес    |
| Application Logs  | Betterstack Logs (Free)           | $0/мес    |
| Server Metrics    | Netdata (self-hosted)             | $0/мес    |
| Analytics         | Plausible / PostHog (self-hosted) | $0/мес    |

**Суммарная стоимость MVP: $0/мес**

#### Early Growth: Расширенный стек

| Компонент         | Инструмент                        | Стоимость |
| ----------------- | --------------------------------- | --------- |
| Error Tracking    | Sentry Team                       | $26/мес   |
| APM               | Sentry Performance                | Включено  |
| Uptime Monitoring | Betterstack (Starter)             | $24/мес   |
| Logs              | Betterstack Logs                  | $24/мес   |
| Metrics           | Grafana Cloud (Free) + Prometheus | $0/мес    |
| Analytics         | PostHog Cloud                     | $0-45/мес |

**Суммарная стоимость Early Growth: $74-119/мес**

#### Scale: Enterprise стек

| Компонент          | Инструмент           | Стоимость    |
| ------------------ | -------------------- | ------------ |
| Full Observability | Datadog / New Relic  | $200-500/мес |
| Logs               | Datadog Logs / ELK   | Включено     |
| APM + Traces       | Datadog APM          | Включено     |
| Uptime             | Datadog Synthetics   | Включено     |
| Analytics          | Amplitude / Mixpanel | $0-100/мес   |

### 7.2. Application Performance Monitoring (APM)

#### Метрики для отслеживания

**Backend API:**

| Метрика            | Порог (warning) | Порог (critical) |
| ------------------ | --------------- | ---------------- |
| Response time p50  | > 200ms         | > 500ms          |
| Response time p99  | > 1s            | > 3s             |
| Error rate (5xx)   | > 1%            | > 5%             |
| Request rate (RPM) | +50% от нормы   | +200% от нормы   |
| CPU usage          | > 70%           | > 90%            |
| Memory usage       | > 75%           | > 90%            |
| Disk usage         | > 70%           | > 85%            |

**AI/ML Module:**

| Метрика                 | Порог (warning) | Порог (critical) |
| ----------------------- | --------------- | ---------------- |
| Menu generation time    | > 8s            | > 15s            |
| OpenAI API latency      | > 3s            | > 10s            |
| Token usage per request | > 5000          | > 10000          |
| AI error rate           | > 5%            | > 15%            |
| Queue depth (BullMQ)    | > 100           | > 500            |

**Database (PostgreSQL):**

| Метрика            | Порог (warning) | Порог (critical) |
| ------------------ | --------------- | ---------------- |
| Query time p95     | > 100ms         | > 500ms          |
| Active connections | > 70% max       | > 90% max        |
| Cache hit ratio    | < 95%           | < 90%            |
| Disk usage         | > 70%           | > 85%            |
| Replication lag    | > 1s            | > 10s            |

### 7.3. Логирование

#### Формат логов: Structured JSON

```json
{
  "timestamp": "2026-02-09T12:00:00.000Z",
  "level": "info",
  "service": "backend-api",
  "requestId": "req_abc123",
  "userId": "usr_xyz789",
  "method": "POST",
  "path": "/api/menus/generate",
  "statusCode": 200,
  "duration": 2345,
  "message": "Menu generated successfully"
}
```

#### Уровни логирования

| Уровень | Использование                     | Пример                    |
| ------- | --------------------------------- | ------------------------- |
| `error` | Критические ошибки                | Ошибка подключения к БД   |
| `warn`  | Потенциальные проблемы            | OpenAI API retry          |
| `info`  | Бизнес-события                    | Пользователь создал меню  |
| `debug` | Отладочная информация (не в prod) | SQL-запросы, request body |

#### Retention policy

| Окружение  | Retention                     | Объём (MVP)  | Объём (Scale) |
| ---------- | ----------------------------- | ------------ | ------------- |
| Production | 30 дней (hot), 90 дней (cold) | 1-5 GB/мес   | 50-100 GB/мес |
| Staging    | 7 дней                        | 0.5-1 GB/мес | 5-10 GB/мес   |

### 7.4. Алертинг

#### Каналы уведомлений

| Приоритет     | Канал                               | Время реакции |
| ------------- | ----------------------------------- | ------------- |
| P1 (Critical) | Telegram + Phone call (Betterstack) | 5 минут       |
| P2 (High)     | Telegram + Email                    | 30 минут      |
| P3 (Medium)   | Email + Slack                       | 4 часа        |
| P4 (Low)      | Email                               | 24 часа       |

#### Критические алерты (P1)

- Сайт/API недоступен (downtime)
- Error rate > 5%
- Ответ БД > 5 секунд
- Диск заполнен > 90%
- SSL-сертификат истекает через < 7 дней
- Подозрительная активность (rate limit exceeded массово)

#### Важные алерты (P2)

- Response time p95 > 1 секунда
- CPU > 85% более 5 минут
- Memory > 85% более 5 минут
- OpenAI API errors > 10%
- Очередь задач > 500 элементов
- Не удалось обновить каталог продуктов

### 7.5. Uptime мониторинг

| Endpoint                              | Интервал | Тип  | Ожидаемый результат  |
| ------------------------------------- | -------- | ---- | -------------------- |
| `https://foodops.fi`                  | 30 сек   | HTTP | 200 OK               |
| `https://api.foodops.fi/health`       | 30 сек   | HTTP | 200 + JSON           |
| `https://api.foodops.fi/health/db`    | 60 сек   | HTTP | 200 (БД доступна)    |
| `https://api.foodops.fi/health/redis` | 60 сек   | HTTP | 200 (Redis доступен) |

**Status Page:** Betterstack Status Page (`status.foodops.fi`) -- публичная страница статуса сервисов.

---

## 8. Безопасность

### 8.1. Аутентификация и авторизация

#### Рекомендация: Clerk или Auth.js (NextAuth)

**Вариант A: Clerk (рекомендуется для MVP)**

| Параметр           | Значение                                      |
| ------------------ | --------------------------------------------- |
| Тип                | Managed Auth Service                          |
| Методы входа       | Email + password, Google OAuth, Apple Sign-in |
| MFA                | TOTP, SMS (опционально)                       |
| Session management | JWT + refresh tokens                          |
| Стоимость (MVP)    | $0 (до 10 000 MAU)                            |
| Стоимость (Scale)  | $0.02/MAU сверх лимита                        |
| GDPR               | Соответствует, EU data residency              |

**Вариант B: Auth.js (self-hosted)**

| Параметр     | Значение                                |
| ------------ | --------------------------------------- |
| Тип          | Self-hosted library                     |
| Методы входа | Любые OAuth providers, email magic link |
| Session      | Database sessions (PostgreSQL)          |
| Стоимость    | $0                                      |
| Требует      | Самостоятельная реализация, больше кода |

#### Модель авторизации: RBAC (Role-Based Access Control)

| Роль            | Права                                         |
| --------------- | --------------------------------------------- |
| `user`          | Управление своими меню, списками, настройками |
| `family_admin`  | Управление семьёй, приглашение членов         |
| `family_member` | Просмотр и редактирование общих списков       |
| `admin`         | Полный доступ, модерация рецептов             |
| `superadmin`    | Управление системой, пользователями           |

#### API Security

| Мера             | Реализация                                                    |
| ---------------- | ------------------------------------------------------------- |
| Rate Limiting    | 100 req/min для аутентифицированных, 20 req/min для анонимных |
| API Keys         | Для Chrome Extension (per-user API key)                       |
| CORS             | Whitelist: `foodops.fi`, `*.foodops.fi`                       |
| Input Validation | Zod / Joi schemas на каждом endpoint                          |
| SQL Injection    | Parameterized queries (Prisma/Drizzle ORM)                    |
| XSS              | Content-Security-Policy headers, DOMPurify                    |

### 8.2. GDPR Compliance

**Финляндия входит в ЕС, поэтому GDPR является обязательным требованием.**

#### Обязательные меры

| Требование                          | Реализация                                                               | Приоритет    |
| ----------------------------------- | ------------------------------------------------------------------------ | ------------ |
| **Consent Management**              | Cookie banner с явным согласием (opt-in). Сохранение записи о согласии   | MVP          |
| **Privacy Policy**                  | Документ на финском и английском языках. Описание собираемых данных      | MVP          |
| **Data Processing Agreement (DPA)** | Подписание DPA со всеми поставщиками (Neon, OpenAI, Clerk и т.д.)        | MVP          |
| **Right to Access (Art. 15)**       | API endpoint: GET /api/users/me/data -- экспорт всех данных пользователя | MVP          |
| **Right to Erasure (Art. 17)**      | API endpoint: DELETE /api/users/me -- полное удаление аккаунта и данных  | MVP          |
| **Right to Portability (Art. 20)**  | Экспорт данных в JSON/CSV формате                                        | Early Growth |
| **Data Minimization**               | Сбор только необходимых данных, review каждые 6 месяцев                  | MVP          |
| **Breach Notification**             | Процедура уведомления (72 часа). Контакт DPO                             | MVP          |
| **Data Protection Officer**         | Назначение DPO при > 50 000 пользователей                                | Scale        |
| **Records of Processing**           | Документ, описывающий все процессы обработки данных                      | Early Growth |

#### Хранение данных и юрисдикция

| Данные                  | Где хранятся          | Юрисдикция  | Комментарий                                 |
| ----------------------- | --------------------- | ----------- | ------------------------------------------- |
| Пользовательские данные | Neon (AWS eu-north-1) | EU (Швеция) | GDPR-совместимо                             |
| Сессии                  | Upstash (EU region)   | EU          | GDPR-совместимо                             |
| Логи                    | Betterstack (EU)      | EU          | GDPR-совместимо                             |
| AI-запросы              | OpenAI API            | US          | Требуется DPA с OpenAI, анонимизация данных |
| Файлы                   | Cloudflare R2 (EU)    | EU          | GDPR-совместимо                             |
| Аналитика               | PostHog (EU Cloud)    | EU          | GDPR-совместимо                             |

**Важно:** При отправке данных в OpenAI API необходимо:

1. Анонимизировать пользовательские данные (не отправлять PII)
2. Использовать OpenAI API с отключённым data training (доступно для API)
3. Подписать DPA с OpenAI
4. Упомянуть использование AI в Privacy Policy

#### Retention Policy (сроки хранения данных)

| Тип данных           | Срок хранения        | После удаления аккаунта    |
| -------------------- | -------------------- | -------------------------- |
| Профиль пользователя | Пока аккаунт активен | Удаление в течение 30 дней |
| Меню и рецепты       | Пока аккаунт активен | Удаление или анонимизация  |
| История покупок      | 2 года               | Анонимизация               |
| Логи приложения      | 90 дней              | Автоматическое удаление    |
| Данные аналитики     | 2 года               | Анонимизация               |

### 8.3. Шифрование

#### Encryption at Rest

| Компонент             | Метод шифрования                           |
| --------------------- | ------------------------------------------ |
| PostgreSQL (Neon)     | AES-256 (автоматическое)                   |
| Redis (Upstash)       | AES-256 (автоматическое)                   |
| Файлы (Cloudflare R2) | AES-256 (автоматическое)                   |
| Бэкапы                | AES-256 + отдельный ключ шифрования        |
| Sensitive fields в БД | Application-level encryption (AES-256-GCM) |

**Поля, требующие application-level шифрования:**

- API-ключи пользователей (для Chrome Extension)
- Refresh tokens
- PII данные (при необходимости: адреса, телефоны)

#### Encryption in Transit

| Соединение            | Протокол                   | Минимальная версия |
| --------------------- | -------------------------- | ------------------ |
| Client -> CDN         | TLS 1.2+                   | TLS 1.2            |
| CDN -> Origin         | TLS 1.2+ (Full Strict)     | TLS 1.2            |
| Backend -> PostgreSQL | TLS 1.3 (Neon default)     | TLS 1.2            |
| Backend -> Redis      | TLS 1.2+ (Upstash default) | TLS 1.2            |
| Backend -> OpenAI     | TLS 1.2+                   | TLS 1.2            |
| Internal services     | mTLS (в Kubernetes)        | TLS 1.2            |

### 8.4. WAF и DDoS защита

#### MVP: Cloudflare Free

| Защита         | Уровень          | Описание                           |
| -------------- | ---------------- | ---------------------------------- |
| DDoS L3/L4     | Автоматическая   | Защита от volumetric-атак          |
| DDoS L7        | Базовая          | Защита от HTTP flood               |
| Bot Protection | Базовая          | Challenge для подозрительных ботов |
| Rate Limiting  | 1 правило (Free) | Ограничение по IP                  |

#### Early Growth: Cloudflare Pro + Application-level

| Защита         | Реализация                                   |
| -------------- | -------------------------------------------- |
| WAF Rules      | Cloudflare Managed Ruleset (OWASP)           |
| Rate Limiting  | По API endpoint, по user ID                  |
| Bot Management | JavaScript challenge для подозрительных      |
| IP Reputation  | Блокировка известных вредоносных IP          |
| Geo-blocking   | Разрешение только EU/Финляндия (опционально) |
| API Shield     | Schema validation на уровне Cloudflare       |

#### Application-level Security

```
Request -> Cloudflare WAF -> Rate Limiter (Redis) -> Auth Check -> Input Validation -> Handler
```

| Защита                  | Инструмент                           |
| ----------------------- | ------------------------------------ |
| Rate Limiting           | express-rate-limit + Redis (ioredis) |
| Input Validation        | Zod schemas                          |
| CSRF Protection         | csrf-csrf / SameSite cookies         |
| Helmet                  | HTTP security headers                |
| Content Security Policy | Strict CSP с nonce                   |

### 8.5. Backup и Disaster Recovery

#### Стратегия бэкапов

| Компонент         | Тип бэкапа             | Частота               | Retention                    | Где хранится                |
| ----------------- | ---------------------- | --------------------- | ---------------------------- | --------------------------- |
| PostgreSQL (Neon) | Continuous (PITR)      | Real-time (WAL)       | 7 дней (Free), 30 дней (Pro) | Neon (автоматически)        |
| PostgreSQL        | Logical dump (pg_dump) | Ежедневно в 03:00 UTC | 30 дней                      | Cloudflare R2 / S3          |
| Redis             | Не бэкапится (кэш)     | --                    | --                           | --                          |
| Файлы (R2)        | Versioning             | При каждом изменении  | 30 дней                      | Cloudflare R2               |
| Конфигурация      | Git                    | При каждом коммите    | Навсегда                     | GitHub                      |
| Secrets           | Encrypted backup       | Еженедельно           | 90 дней                      | Отдельный encrypted storage |

#### Disaster Recovery Plan

| Сценарий                   | RTO      | RPO           | Действия                                |
| -------------------------- | -------- | ------------- | --------------------------------------- |
| Падение сервера приложения | 15 мин   | 0 (stateless) | Автоматическое пересоздание контейнера  |
| Падение БД                 | 5 мин    | ~0 (PITR)     | Neon автоматическое восстановление      |
| Повреждение данных         | 30 мин   | < 1 час       | Восстановление из PITR на нужный момент |
| Полное падение дата-центра | 2-4 часа | < 1 час       | Деплой в другой регион из бэкапа        |
| Компрометация аккаунта     | 1 час    | 0             | Ротация ключей, rollback изменений      |
| DDoS-атака                 | 5 мин    | 0             | Cloudflare Under Attack mode            |

#### Процедура восстановления

```
1. Обнаружение инцидента (мониторинг/алерт)
2. Оценка масштаба (что затронуто)
3. Уведомление команды (Telegram/Phone)
4. Выполнение runbook по типу инцидента
5. Восстановление сервисов
6. Верификация данных
7. Post-mortem (в течение 48 часов)
```

### 8.6. Управление секретами

#### MVP: Environment Variables + GitHub Secrets

| Секрет             | Хранилище                 | Доступ          |
| ------------------ | ------------------------- | --------------- |
| DATABASE_URL       | GitHub Secrets -> env var | Backend, Worker |
| REDIS_URL          | GitHub Secrets -> env var | Backend, Worker |
| OPENAI_API_KEY     | GitHub Secrets -> env var | AI Service      |
| CLERK_SECRET_KEY   | GitHub Secrets -> env var | Backend         |
| MEILISEARCH_KEY    | GitHub Secrets -> env var | Backend         |
| CLOUDFLARE_R2_KEYS | GitHub Secrets -> env var | Backend         |

#### Scale: HashiCorp Vault или AWS Secrets Manager

| Инструмент              | Стоимость        | Когда использовать  |
| ----------------------- | ---------------- | ------------------- |
| Infisical (open-source) | $0 (self-hosted) | Early Growth        |
| AWS Secrets Manager     | $0.40/secret/мес | Scale (AWS)         |
| HashiCorp Vault         | $0 (self-hosted) | Scale (self-hosted) |

**Ротация секретов:**

- API ключи: каждые 90 дней
- DB пароли: каждые 90 дней
- JWT secret: каждые 180 дней
- Автоматическая ротация через CI/CD pipeline

---

## 9. Оценка стоимости

### 9.1. MVP фаза (100-1000 пользователей)

**Цель: минимальные затраты, проверка гипотезы**

| Компонент          | Сервис               | План                | Стоимость/мес     |
| ------------------ | -------------------- | ------------------- | ----------------- |
| **Frontend**       | Vercel               | Hobby (бесплатный)  | $0                |
| **Backend Server** | Hetzner CX22         | 2 vCPU, 4 GB RAM    | $4.50             |
| **PostgreSQL**     | Neon                 | Free / Launch       | $0-19             |
| **Redis**          | Upstash              | Free                | $0                |
| **Поиск**          | Meilisearch          | Docker (на сервере) | $0                |
| **Файлы**          | Cloudflare R2        | Free tier           | $0                |
| **CDN + DNS**      | Cloudflare           | Free                | $0                |
| **AI (OpenAI)**    | OpenAI API           | Pay-as-you-go       | $20-50            |
| **Auth**           | Clerk                | Free (до 10K MAU)   | $0                |
| **Мониторинг**     | Sentry + Betterstack | Free tiers          | $0                |
| **Домен**          | foodops.fi           | --                  | $2/мес (~$25/год) |
| **Email**          | Resend               | Free (100/день)     | $0                |
|                    |                      |                     |                   |
| **ИТОГО**          |                      |                     | **$27-76/мес**    |

### 9.2. Early Growth (1000-10000 пользователей)

**Цель: стабильность, начальное масштабирование**

| Компонент           | Сервис               | План                    | Стоимость/мес    |
| ------------------- | -------------------- | ----------------------- | ---------------- |
| **Frontend**        | Vercel               | Pro                     | $20              |
| **Backend Servers** | Hetzner CX32 x2      | 4 vCPU, 8 GB RAM каждый | $24              |
| **Load Balancer**   | Hetzner LB11         | --                      | $6               |
| **PostgreSQL**      | Neon                 | Scale                   | $69              |
| **Redis**           | Upstash              | Pro                     | $30              |
| **Поиск**           | Meilisearch Cloud    | Basic                   | $30              |
| **Файлы**           | Cloudflare R2        | 50 GB                   | $1               |
| **CDN + DNS**       | Cloudflare           | Pro                     | $20              |
| **AI (OpenAI)**     | OpenAI API           | Pay-as-you-go           | $100-300         |
| **Auth**            | Clerk                | Pro                     | $25              |
| **Мониторинг**      | Sentry + Betterstack | Paid tiers              | $74              |
| **Домен**           | foodops.fi           | --                      | $2               |
| **Email**           | Resend               | Starter                 | $20              |
| **Worker Server**   | Hetzner CX22         | 2 vCPU, 4 GB            | $4.50            |
|                     |                      |                         |                  |
| **ИТОГО**           |                      |                         | **$426-626/мес** |

### 9.3. Scale (50000+ пользователей)

**Цель: автоматическое масштабирование, высокая доступность**

| Компонент              | Сервис                                | План            | Стоимость/мес        |
| ---------------------- | ------------------------------------- | --------------- | -------------------- |
| **Frontend**           | Vercel                                | Enterprise      | $100-400             |
| **Compute (ECS/GKE)**  | AWS/GCP                               | 4-10 containers | $200-600             |
| **Load Balancer**      | AWS ALB / GCP LB                      | --              | $30-50               |
| **PostgreSQL**         | Neon Business / RDS                   | + Read Replicas | $349-600             |
| **Redis**              | Upstash Enterprise / ElastiCache      | --              | $100-280             |
| **Поиск**              | Meilisearch Cloud Pro / Elasticsearch | --              | $100-300             |
| **Файлы**              | Cloudflare R2                         | 500 GB          | $8                   |
| **CDN + WAF**          | Cloudflare                            | Business        | $200                 |
| **AI (OpenAI)**        | OpenAI API                            | Volume          | $500-2000            |
| **Auth**               | Clerk                                 | Enterprise      | $100-300             |
| **Мониторинг**         | Datadog / New Relic                   | --              | $200-500             |
| **Email**              | Resend / SES                          | --              | $50-100              |
| **Домен**              | foodops.fi                            | --              | $2                   |
| **Secrets Management** | AWS Secrets Manager                   | --              | $10-20               |
|                        |                                       |                 |                      |
| **ИТОГО**              |                                       |                 | **$1,949-5,152/мес** |

### 9.4. Сводная таблица стоимости

| Фаза             | Пользователей | Стоимость/мес | Стоимость/год  | На пользователя/мес |
| ---------------- | ------------- | ------------- | -------------- | ------------------- |
| **MVP**          | 100-1000      | $27-76        | $324-912       | $0.08-0.27          |
| **Early Growth** | 1000-10000    | $426-626      | $5,112-7,512   | $0.04-0.43          |
| **Scale**        | 50000+        | $1,949-5,152  | $23,388-61,824 | $0.04-0.10          |

### 9.5. Оптимизация затрат

| Мера                      | Экономия                               | Применимость     |
| ------------------------- | -------------------------------------- | ---------------- |
| Hetzner ARM серверы (CAX) | -30% от стоимости compute              | Все фазы         |
| Neon scale-to-zero        | -50% от стоимости БД в непиковое время | MVP              |
| OpenAI Batch API          | -50% от стоимости AI                   | Early Growth+    |
| Reserved instances (AWS)  | -30-40% от compute                     | Scale            |
| Cloudflare R2 (vs S3)     | -100% egress-трафик                    | Все фазы         |
| Стартап-программы         | До $200K кредитов                      | MVP/Early Growth |
| Кэширование AI-ответов    | -60-80% от стоимости AI                | Все фазы         |

**Стартап-программы (рекомендуется подать заявку):**

- AWS Activate: до $100K кредитов
- Google Cloud for Startups: до $200K кредитов
- Hetzner Startup Program: скидки на серверы
- Vercel Startup Program: бесплатный Pro-план
- OpenAI Startup Credits: до $10K

---

## 10. План масштабирования

### 10.1. Горизонтальное масштабирование

#### Backend API

| Триггер                     | Действие            | Фаза          |
| --------------------------- | ------------------- | ------------- |
| CPU > 70% на всех инстансах | Добавить +1 инстанс | Early Growth+ |
| RPS > 80% от capacity       | Добавить +1 инстанс | Early Growth+ |
| Response time p95 > 500ms   | Добавить +1 инстанс | Early Growth+ |

**Архитектура для горизонтального масштабирования:**

- Stateless backend (сессии в Redis, файлы в R2)
- Shared-nothing архитектура
- 12-factor app принципы
- Health check endpoints для load balancer

#### Worker (фоновые задачи)

| Триггер                        | Действие                        |
| ------------------------------ | ------------------------------- |
| Queue depth > 1000             | Добавить +1 worker              |
| Job processing time > 2x нормы | Добавить +1 worker              |
| Failed jobs > 5%               | Расследование + масштабирование |

### 10.2. Вертикальное масштабирование

| Компонент      | Начальный размер     | Следующий шаг | Максимум (перед horizontal) |
| -------------- | -------------------- | ------------- | --------------------------- |
| Backend server | CX22 (2 vCPU / 4 GB) | CX32 (4/8)    | CX42 (8/16)                 |
| Worker server  | CX22 (2 vCPU / 4 GB) | CX32 (4/8)    | CX42 (8/16)                 |
| Neon Compute   | 0.25 CU              | 1 CU          | 4 CU (затем read replicas)  |
| Redis          | Free tier            | Pro           | Enterprise                  |

### 10.3. Auto-scaling политики (Scale фаза)

#### ECS / Kubernetes HPA

```yaml
# Пример HPA для Kubernetes
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: backend-api-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: backend-api
  minReplicas: 2
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 80
  behavior:
    scaleUp:
      stabilizationWindowSeconds: 60
      policies:
        - type: Pods
          value: 2
          periodSeconds: 60
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
        - type: Pods
          value: 1
          periodSeconds: 120
```

**Политики:**

- Scale-up: быстрый (60 сек стабилизации, до 2 подов за раз)
- Scale-down: медленный (300 сек стабилизации, по 1 поду)
- Минимум: 2 инстанса (high availability)
- Максимум: 10 инстансов (бюджетный потолок)

### 10.4. Кэширование стратегии

#### Многоуровневое кэширование

```
Level 1: Browser Cache
  ├── Static assets (CSS, JS, images): max-age=31536000, immutable
  ├── API responses: Cache-Control: private, max-age=60
  └── Service Worker cache (PWA)

Level 2: CDN Cache (Cloudflare)
  ├── Static assets: cache everything
  ├── SSR pages: stale-while-revalidate=60
  └── API: no-cache (кроме публичных endpoint)

Level 3: Application Cache (Redis)
  ├── Product catalog: TTL 6h
  ├── Generated menus: TTL 24h
  ├── Search results: TTL 30min
  ├── User sessions: TTL 7d
  └── Rate limiter: TTL 1min

Level 4: Database Query Cache (PostgreSQL)
  ├── Prepared statements
  └── Connection pooling (PgBouncer/Neon)
```

#### Стратегия инвалидации кэша

| Событие                      | Действие                                              |
| ---------------------------- | ----------------------------------------------------- |
| Обновление каталога (парсер) | Инвалидация product:\* в Redis                        |
| Создание/изменение рецепта   | Инвалидация recipe:{id} + пересиндексация Meilisearch |
| Изменение меню пользователя  | Инвалидация menu:{userId}:\*                          |
| Деплой новой версии          | Purge CDN cache + новые asset hashes                  |

### 10.5. Database Scaling

#### Фаза 1: Оптимизация запросов (MVP - Early Growth)

| Мера               | Описание                                            |
| ------------------ | --------------------------------------------------- |
| Индексы            | Создание индексов на часто запрашиваемые поля       |
| Query optimization | EXPLAIN ANALYZE для медленных запросов              |
| Connection pooling | Neon built-in (PgBouncer)                           |
| Materialized views | Для агрегированных данных (топ-рецепты, статистика) |

#### Фаза 2: Read Replicas (Early Growth - Scale)

```
Write Operations (INSERT, UPDATE, DELETE)
         |
    +----v----+
    |  Primary |  (Neon Main)
    |  (Write) |
    +----+----+
         |
    Replication
         |
    +----v----+
    |  Replica |  (Neon Read Replica)
    |  (Read)  |
    +----------+
         ^
         |
Read Operations (SELECT)
```

**Routing:**

- Все записи -> Primary
- Тяжёлые SELECT (отчёты, поиск) -> Read Replica
- Реализация через connection string routing в ORM

#### Фаза 3: Партиционирование (Scale 50K+)

| Таблица            | Стратегия партиционирования | Ключ          |
| ------------------ | --------------------------- | ------------- |
| `purchase_history` | По дате (monthly)           | `created_at`  |
| `product_prices`   | По дате (monthly)           | `recorded_at` |
| `menu_meals`       | По дате (monthly)           | `date`        |
| `products`         | По категории (list)         | `store_id`    |

#### Фаза 4: Шардирование (100K+)

- **Рассмотреть только при необходимости** -- PostgreSQL на Neon способен обрабатывать сотни тысяч пользователей на одном инстансе
- Альтернатива шардированию: Citus (расширение PostgreSQL для горизонтального масштабирования)
- Ключ шардирования: `family_id` (данные семьи всегда вместе)

### 10.6. Bottleneck analysis и Capacity Planning

| Компонент   | Узкое место                  | Порог                       | Решение                            |
| ----------- | ---------------------------- | --------------------------- | ---------------------------------- |
| Backend API | CPU / concurrent connections | 500 RPS на инстанс          | Горизонтальное масштабирование     |
| PostgreSQL  | Connections / query time     | 500 connections / 100ms p95 | Read replicas + connection pooling |
| Redis       | Memory / connections         | 1 GB / 10K connections      | Вертикальное масштабирование       |
| Meilisearch | Index size / query time      | 1M docs / 50ms p95          | Выделенный сервер                  |
| OpenAI API  | Rate limits / latency        | 10K RPM / 3s p95            | Кэширование + fallback модели      |
| Файлы (R2)  | Bandwidth                    | 10 TB/мес                   | CDN кэширование                    |

---

## 11. Рекомендации по фазам внедрения

### 11.1. Фаза 1: MVP (Месяцы 1-3)

**Цель:** Запуск работающего продукта с минимальными затратами для валидации идеи.

**Пользователей:** 100-1000
**Бюджет:** $27-76/мес
**Команда:** 1-2 разработчика

#### Инфраструктура

```
[Vercel] -- Frontend (Next.js)
     |
     v
[Hetzner CX22] -- Docker Compose
  ├── Backend API (Fastify)
  ├── AI Service (Fastify + OpenAI)
  ├── Meilisearch
  ├── Redis (для кэша и очередей)
  ├── Worker (фоновые задачи)
  └── Nginx (reverse proxy)
     |
     v
[Neon Free/Launch] -- PostgreSQL
[Cloudflare] -- CDN + DNS + SSL
[Cloudflare R2] -- Файлы
[OpenAI API] -- AI
[Clerk Free] -- Auth
```

#### Чеклист задач Фазы 1

- [ ] Регистрация домена foodops.fi
- [ ] Настройка Cloudflare DNS
- [ ] Создание проекта на Neon (PostgreSQL)
- [ ] Создание аккаунта Upstash (Redis) -- или локальный Redis
- [ ] Аренда сервера Hetzner CX22 (Helsinki)
- [ ] Настройка Docker Compose (все сервисы)
- [ ] Настройка Nginx с SSL (Cloudflare Origin Certificate)
- [ ] Создание GitHub-репозитория (монорепо с Turborepo)
- [ ] Настройка CI/CD (GitHub Actions: lint, test, build, deploy)
- [ ] Деплой Frontend на Vercel
- [ ] Настройка Sentry (error tracking)
- [ ] Настройка Betterstack (uptime monitoring)
- [ ] Создание Cloudflare R2 bucket
- [ ] Настройка Clerk (аутентификация)
- [ ] Privacy Policy и Cookie consent
- [ ] Backup script (pg_dump -> R2)

#### Критерии перехода к Фазе 2

- Стабильная база пользователей > 500
- Response time p95 > 500ms при текущей нагрузке
- CPU utilization > 60% на постоянной основе
- Необходимость в SLA > 99.5%
- Привлечение инвестиций / рост команды

### 11.2. Фаза 2: Early Growth (Месяцы 4-9)

**Цель:** Обеспечить стабильность и подготовиться к росту.

**Пользователей:** 1000-10000
**Бюджет:** $426-626/мес
**Команда:** 3-5 разработчиков

#### Инфраструктура

```
[Vercel Pro] -- Frontend (Next.js)
     |
     v
[Hetzner LB11] -- Load Balancer
  ├── [Hetzner CX32 #1] -- Backend API + AI Service
  └── [Hetzner CX32 #2] -- Backend API + AI Service

[Hetzner CX22] -- Worker (фоновые задачи)

[Neon Scale] -- PostgreSQL
[Upstash Pro] -- Redis
[Meilisearch Cloud] -- Поиск
[Cloudflare Pro] -- CDN + WAF
[Cloudflare R2] -- Файлы
[OpenAI API] -- AI
[Clerk Pro] -- Auth
[Sentry + Betterstack] -- Мониторинг (платные планы)
```

#### Чеклист задач Фазы 2

- [ ] Добавление второго backend-сервера
- [ ] Настройка Hetzner Load Balancer
- [ ] Миграция Redis на Upstash Pro
- [ ] Миграция поиска на Meilisearch Cloud
- [ ] Обновление Cloudflare до Pro (WAF)
- [ ] Обновление Neon до Scale плана
- [ ] Настройка staging-окружения
- [ ] Blue-green deploy стратегия
- [ ] Внедрение structured logging (JSON)
- [ ] Настройка Grafana + Prometheus (метрики)
- [ ] Внедрение API rate limiting (Redis-based)
- [ ] GDPR: Data export endpoint
- [ ] GDPR: Account deletion endpoint
- [ ] GDPR: Records of Processing Activities
- [ ] Нагрузочное тестирование (k6 / Artillery)
- [ ] Runbook для основных инцидентов
- [ ] Настройка Terraform для Hetzner инфраструктуры
- [ ] Выделить Worker на отдельный сервер

#### Критерии перехода к Фазе 3

- Пользователей > 5000 или быстрый рост > 20% в месяц
- Необходимость в auto-scaling
- Hetzner не справляется с нагрузкой
- Необходимость в SLA > 99.9%
- Международная экспансия (за пределы Финляндии)

### 11.3. Фаза 3: Scale (Месяцы 10+)

**Цель:** Полноценная масштабируемая платформа.

**Пользователей:** 50000+
**Бюджет:** $2000-5000/мес
**Команда:** 5-10 разработчиков + DevOps

#### Инфраструктура

```
[Vercel Enterprise] -- Frontend (Next.js) + Edge Functions
     |
     v
[AWS ALB / GCP LB] -- Application Load Balancer
  ├── [ECS/GKE Auto-scaling Group]
  │   ├── Backend API (2-10 instances)
  │   ├── AI Service (2-4 instances)
  │   └── Worker (2-6 instances)
  └── [API Gateway] -- Rate limiting, auth

[Neon Business / RDS] -- PostgreSQL + Read Replicas
[Upstash Enterprise / ElastiCache] -- Redis Cluster
[Meilisearch Cloud Pro / Elasticsearch] -- Поиск
[Cloudflare Business] -- CDN + Advanced WAF
[Cloudflare R2] -- Файлы
[OpenAI API + Fine-tuned models] -- AI
[Clerk Enterprise] -- Auth
[Datadog / New Relic] -- Full observability
```

#### Чеклист задач Фазы 3

- [ ] Миграция на AWS (eu-north-1) или GCP (europe-north1)
- [ ] Настройка VPC с public/private subnets
- [ ] Настройка ECS Fargate / GKE (Kubernetes)
- [ ] Настройка Horizontal Pod Autoscaler
- [ ] Настройка Read Replicas для PostgreSQL
- [ ] Внедрение полноценного IaC (Terraform)
- [ ] Настройка CI/CD с canary deploys
- [ ] Миграция на Datadog / New Relic (APM)
- [ ] Настройка distributed tracing
- [ ] Внедрение мультирегиональной архитектуры (при необходимости)
- [ ] Database partitioning для больших таблиц
- [ ] Fine-tuning AI модели для снижения стоимости
- [ ] Нагрузочное тестирование > 5000 RPS
- [ ] Назначение DPO (GDPR)
- [ ] SOC 2 подготовка (при необходимости)
- [ ] Disaster Recovery тестирование
- [ ] Внедрение chaos engineering (Chaos Monkey / Litmus)

### 11.4. Общий таймлайн

```
Месяц 1-2: Настройка MVP инфраструктуры + разработка
         |
Месяц 3:  Запуск MVP, первые пользователи
         |
Месяц 4:  Мониторинг, фикс проблем, первая оптимизация
         |
Месяц 5-6: Рост пользователей, начало Фазы 2
         |
Месяц 7-9: Стабилизация, staging, CI/CD, мониторинг
         |
Месяц 10+: При достижении критериев -- начало Фазы 3
```

---

## Приложения

### A. Полезные ресурсы

| Ресурс                                                   | Описание                     |
| -------------------------------------------------------- | ---------------------------- |
| [Neon Documentation](https://neon.tech/docs)             | Документация Neon PostgreSQL |
| [Hetzner Cloud API](https://docs.hetzner.cloud)          | API документация Hetzner     |
| [Cloudflare Docs](https://developers.cloudflare.com)     | Документация Cloudflare      |
| [Vercel Docs](https://vercel.com/docs)                   | Документация Vercel          |
| [OpenAI API Docs](https://platform.openai.com/docs)      | Документация OpenAI API      |
| [GDPR Finland (tietosuoja.fi)](https://tietosuoja.fi/en) | GDPR в Финляндии             |

### B. Глоссарий

| Термин            | Описание                                                                         |
| ----------------- | -------------------------------------------------------------------------------- |
| CU (Compute Unit) | Единица вычислительных ресурсов Neon (1 vCPU + 4 GB RAM)                         |
| PITR              | Point-in-Time Recovery -- восстановление БД на любой момент времени              |
| RPS               | Requests Per Second -- запросов в секунду                                        |
| RPO               | Recovery Point Objective -- допустимая потеря данных                             |
| RTO               | Recovery Time Objective -- допустимое время восстановления                       |
| WAF               | Web Application Firewall -- файрвол веб-приложений                               |
| HPA               | Horizontal Pod Autoscaler -- автоматическое масштабирование в Kubernetes         |
| ISR               | Incremental Static Regeneration -- инкрементальная регенерация статики (Next.js) |
| MAU               | Monthly Active Users -- активных пользователей в месяц                           |

### C. Контакты для принятия решений

| Роль            | Ответственность                                    |
| --------------- | -------------------------------------------------- |
| Product Owner   | Приоритеты, бюджет, критерии перехода между фазами |
| Tech Lead       | Архитектурные решения, выбор технологий            |
| DevOps Engineer | Настройка инфраструктуры, CI/CD, мониторинг        |
| Security Lead   | GDPR, безопасность, аудит                          |

---

_Документ подлежит ревизии при значительных изменениях в требованиях проекта или при переходе между фазами._
