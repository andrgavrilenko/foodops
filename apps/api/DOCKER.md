# FoodOps API - Docker Guide

## Local Development with Docker Compose

The project uses Docker Compose for local development infrastructure (PostgreSQL + Redis).

### Quick Start

```bash
# 1. Start infrastructure services (from repo root)
docker-compose up -d

# 2. Wait for services to be healthy
docker-compose ps

# 3. Run Prisma migrations
npm run db:push --workspace=@foodops/db

# 4. Start the API in dev mode
npm run dev --workspace=apps/api
```

### Services

| Service  | Port | Container Name   | Purpose                      |
| -------- | ---- | ---------------- | ---------------------------- |
| postgres | 5433 | foodops-postgres | PostgreSQL 16 database       |
| redis    | 6379 | foodops-redis    | Redis 7 (cache + job queues) |

**Note:** PostgreSQL is exposed on port **5433** (not 5432) to avoid conflicts with local PostgreSQL installations.

### Useful Commands

```bash
# View logs
docker-compose logs -f postgres
docker-compose logs -f redis

# Stop services
docker-compose stop

# Stop and remove containers (data persists in volumes)
docker-compose down

# Remove everything including volumes (⚠️ deletes all data)
docker-compose down -v

# Restart a service
docker-compose restart postgres

# Access PostgreSQL CLI
docker exec -it foodops-postgres psql -U foodops -d foodops

# Access Redis CLI
docker exec -it foodops-redis redis-cli
```

## Production Docker Build

Build the production Docker image for the API:

```bash
# Build from repo root
docker build -f apps/api/Dockerfile -t foodops-api:latest .

# Run the container
docker run -p 3000:3000 \
  -e DATABASE_URL="postgresql://user:pass@host:5432/db" \
  -e NODE_ENV=production \
  foodops-api:latest

# Test health endpoint
curl http://localhost:3000/health
```

### Multi-architecture Build (for deployment)

```bash
# Build for AMD64 and ARM64
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -f apps/api/Dockerfile \
  -t foodops-api:latest \
  .
```

## Dockerfile Overview

The production Dockerfile uses a **multi-stage build**:

1. **Builder stage**: Installs dependencies, generates Prisma client, builds TypeScript
2. **Production stage**: Minimal Alpine image with only runtime dependencies and built code

### Features

- Node.js 20 Alpine base (small image size)
- Non-root user (`nodejs:1001`) for security
- Health check built-in (checks `/health` endpoint every 30s)
- Production dependencies only in final image
- Includes Prisma client artifacts

### Image Size

Expected image size: **~150-200 MB** (compressed)

## Environment Variables

The Docker container requires these environment variables:

| Variable     | Required | Default               | Description                  |
| ------------ | -------- | --------------------- | ---------------------------- |
| DATABASE_URL | ✅       | -                     | PostgreSQL connection string |
| PORT         | ❌       | 3000                  | Server port                  |
| HOST         | ❌       | 0.0.0.0               | Server host                  |
| NODE_ENV     | ❌       | development           | Environment (prod/dev/test)  |
| LOG_LEVEL    | ❌       | info                  | Logging level                |
| CORS_ORIGIN  | ❌       | http://localhost:3001 | CORS allowed origin          |

## Troubleshooting

### Port 5433 already in use

```bash
# Check what's using the port
netstat -ano | findstr :5433

# Stop the container and change the port in docker-compose.yml
docker-compose down
# Edit docker-compose.yml: "5434:5432"
docker-compose up -d
# Update DATABASE_URL in .env to use the new port
```

### Container fails health check

```bash
# View container logs
docker-compose logs postgres

# Check container health
docker inspect foodops-postgres | grep Health -A 10

# Restart the container
docker-compose restart postgres
```

### Prisma client errors

```bash
# Regenerate Prisma client
npm run db:generate --workspace=@foodops/db

# Push schema to database
npm run db:push --workspace=@foodops/db
```

## Next Steps

- Phase 1: Add API service to docker-compose.yml for full-stack development
- Phase 2: Add Meilisearch service for search functionality
- Phase 3: Set up production orchestration (Kubernetes or ECS)
