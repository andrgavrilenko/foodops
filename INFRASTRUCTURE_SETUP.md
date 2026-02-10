# FoodOps Infrastructure Setup

**Created:** 2026-02-10
**Phase:** 0.5 (between Phase 0 and Phase 1)
**Status:** Complete

## Overview

This document summarizes the local development infrastructure setup for the FoodOps project. All files have been created and configured for seamless local development with Docker.

## Files Created

### 1. `apps/api/Dockerfile` (Production)
Multi-stage Docker build for production deployment.

**Features:**
- Node.js 20 Alpine base (minimal image size ~150-200 MB)
- Two stages: builder (full toolchain) → production (runtime only)
- Non-root user (`nodejs:1001`) for security
- Built-in health check (checks `/health` endpoint every 30s)
- Includes Prisma client artifacts
- Production-ready with only runtime dependencies

**Usage:**
```bash
# Build from repo root
docker build -f apps/api/Dockerfile -t foodops-api:latest .

# Run
docker run -p 3000:3000 -e DATABASE_URL="..." foodops-api:latest
```

### 2. `docker-compose.yml` (Updated)
Local development infrastructure with PostgreSQL and Redis.

**Services:**
| Service  | Image             | Port | Container Name   | Purpose                     |
|----------|-------------------|------|------------------|-----------------------------|
| postgres | postgres:16-alpine| 5433 | foodops-postgres | PostgreSQL 16 database      |
| redis    | redis:7-alpine    | 6379 | foodops-redis    | Redis 7 (cache + queues)    |

**Key Changes:**
- Changed PostgreSQL port from `5432` → `5433` to avoid conflicts with local PostgreSQL
- Added Redis service for Phase 2+ (caching, job queues)
- Added persistent volumes: `pgdata`, `redisdata`
- Added `foodops-network` bridge network
- Added health checks for both services
- Added `restart: unless-stopped` for reliability

**Usage:**
```bash
# Start all services
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f

# Stop services
docker-compose down

# Remove everything including data
docker-compose down -v
```

### 3. `.env.example` (Updated)
Template for environment variables with documentation.

**Added Variables:**
- `REDIS_URL` - Redis connection string (will be used in Phase 2+)
- `JWT_SECRET` - JWT signing key (placeholder for Phase 1 auth)
- `OPENAI_API_KEY` - OpenAI API key (for Phase 2 AI menu generation)

**Important Notes:**
- PostgreSQL port changed to `5433` in `DATABASE_URL`
- Added security warnings for production secrets
- Included instructions for generating secure secrets

### 4. `.env` (Updated)
Active environment variables for local development.

**Changes:**
- Updated `DATABASE_URL` to use port `5433`
- Added `REDIS_URL` pointing to local Docker Redis
- Added `JWT_SECRET` with dev placeholder
- Added `OPENAI_API_KEY` placeholder (empty)

### 5. `apps/api/.dockerignore`
Excludes unnecessary files from Docker build context.

**Excludes:**
- node_modules, build outputs, logs
- Test files (*.test.ts, *.spec.ts)
- Environment files (.env*)
- IDE/OS files
- Git files
- Documentation (except README.md)

**Benefit:** Reduces build context size and speeds up builds.

### 6. `apps/api/DOCKER.md`
Comprehensive Docker documentation for the API.

**Sections:**
- Quick start guide
- Service descriptions
- Useful commands (logs, restart, CLI access)
- Production build instructions
- Multi-architecture builds
- Environment variables reference
- Troubleshooting guide

## Environment Variables Summary

| Variable          | Required | Default                | Phase | Description                    |
|-------------------|----------|------------------------|-------|--------------------------------|
| `DATABASE_URL`    | ✅       | -                      | 0.2   | PostgreSQL connection string   |
| `PORT`            | ❌       | 3000                   | 0.3   | API server port                |
| `HOST`            | ❌       | 0.0.0.0                | 0.3   | API server host                |
| `NODE_ENV`        | ❌       | development            | 0.3   | Environment mode               |
| `LOG_LEVEL`       | ❌       | debug (dev) / info (prod) | 0.3 | Logging verbosity            |
| `CORS_ORIGIN`     | ❌       | http://localhost:3001  | 0.3   | Frontend origin                |
| `REDIS_URL`       | ❌       | redis://localhost:6379 | 2.0   | Redis connection (Phase 2+)    |
| `JWT_SECRET`      | ⚠️       | (see .env.example)     | 1.0   | JWT signing key (Phase 1)      |
| `OPENAI_API_KEY`  | ⚠️       | (get from OpenAI)      | 2.0   | OpenAI API key (Phase 2)       |

**Legend:**
- ✅ Required now
- ⚠️ Required in future phase
- ❌ Optional (has default)

## Port Mapping

| Port | Service         | Notes                                    |
|------|-----------------|------------------------------------------|
| 3000 | API Server      | Fastify backend                          |
| 3001 | Next.js Frontend| (not created yet, reserved for Phase 1)  |
| 5433 | PostgreSQL      | Changed from 5432 to avoid conflicts     |
| 6379 | Redis           | Standard Redis port                      |

## Quick Start for New Developers

```bash
# 1. Clone the repo
git clone https://github.com/andrgavrilenko/foodops.git
cd foodops

# 2. Install dependencies
npm install

# 3. Copy environment file
cp .env.example .env

# 4. Start Docker services
docker-compose up -d

# 5. Wait for services to be healthy (10-15 seconds)
docker-compose ps

# 6. Run database migrations
npm run db:push --workspace=@foodops/db

# 7. Start the API in dev mode
npm run dev --workspace=apps/api

# 8. Test the API
curl http://localhost:3000/health
```

## Testing the Setup

### 1. Test Docker Services
```bash
# Check PostgreSQL
docker exec -it foodops-postgres psql -U foodops -d foodops -c "SELECT version();"

# Check Redis
docker exec -it foodops-redis redis-cli ping
# Expected output: PONG
```

### 2. Test API Health Endpoints
```bash
# Basic health
curl http://localhost:3000/health

# Database health
curl http://localhost:3000/health/db

# Readiness check
curl http://localhost:3000/health/ready
```

### 3. Test API with Database
```bash
# Run Prisma Studio to browse database
npm run db:studio --workspace=@foodops/db
# Opens http://localhost:5555
```

## Architecture Alignment

This setup aligns with the infrastructure specification (`docs/infrastructure-specification.md`):

### Section 3.3: Docker Compose Configuration ✅
- PostgreSQL 16 Alpine ✅
- Redis 7 Alpine ✅
- Persistent volumes ✅
- Health checks ✅
- Custom network ✅

### Section 3.1: MVP Backend Server ✅
- Docker Compose for containerization ✅
- Non-root user in Dockerfile ✅
- Multi-stage build for optimization ✅

### Section 4.1: PostgreSQL Configuration ✅
- PostgreSQL 16 ✅
- Hetzner Helsinki region (prod) / Local Docker (dev) ✅

## Next Steps (Phase 1.0)

1. **CRUD API Development**
   - Implement `/api/users` endpoints
   - Implement `/api/families` endpoints
   - Add JWT authentication middleware
   - Write integration tests

2. **Infrastructure Enhancements**
   - Consider adding API service to docker-compose.yml for containerized dev
   - Set up Redis connection utilities (Phase 2 prep)
   - Create database seed scripts

3. **CI/CD Improvements**
   - Add Docker build to GitHub Actions
   - Push images to GitHub Container Registry
   - Add integration tests against Docker Compose

## Notes

- **Windows Compatibility:** All paths use forward slashes, Docker Compose tested on Windows
- **No Breaking Changes:** All existing code continues to work
- **Database Port Change:** DATABASE_URL updated to port 5433 (from 5432)
- **Redis Ready:** Redis is running but not yet used by the API (Phase 2+)
- **Production Ready:** Dockerfile is production-ready, not just for local dev
- **.gitignore:** Already correctly configured (.env ignored, .env.example tracked)

## Troubleshooting

### Port Conflicts
If port 5433 or 6379 are in use:
```bash
# Option 1: Stop conflicting service
# Option 2: Change port in docker-compose.yml and update .env
```

### Permission Issues on Linux/Mac
```bash
# May need to adjust volume permissions
docker-compose down -v
docker-compose up -d
```

### Prisma Connection Issues
```bash
# Regenerate Prisma client
npm run db:generate --workspace=@foodops/db

# Push schema
npm run db:push --workspace=@foodops/db
```

## Reference Links

- **Infrastructure Spec:** `docs/infrastructure-specification.md` (Section 3)
- **API Docker Docs:** `apps/api/DOCKER.md`
- **GitHub Repo:** https://github.com/andrgavrilenko/foodops
- **CLAUDE.md:** Project instructions and context

---

**Document Owner:** Infrastructure Engineer (Claude)
**Last Updated:** 2026-02-10
**Next Review:** Phase 1.0 kickoff
