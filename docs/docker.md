# Docker Guide - NexLeads CRM

We have split the Docker Compose configurations to separate core infrastructure from development applications.

## 1. Core Services Stack (`docker-compose.yml`)
Contains infrastructure databases and object stores:
- **PostgreSQL**: DB on port `5432`
- **Redis**: Cache/Queue on port `6379`
- **MinIO**: Object Storage on ports `9000` (API) & `9001` (Console)

### Commands
Start infrastructure services:
```bash
docker compose up -d
```
Stop infrastructure services:
```bash
docker compose down
```

---

## 2. Dev Applications Stack (`docker-compose.dev.yml`)
Contains all infrastructure services + Next.js frontend + Express backend running in Docker development watch mode.

### Commands
Start all services in development mode:
```bash
docker compose -f docker-compose.dev.yml up -d --build
```
Stop all dev services:
```bash
docker compose -f docker-compose.dev.yml down
```
