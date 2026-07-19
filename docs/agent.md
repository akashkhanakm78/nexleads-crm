- read all docs file before process 
- note importent memory in memory.md 

# Agent Instructions & Guidelines

This document outlines the workflow, rules, and best practices for AI agents working on the B2B Market Tracker project.

## 1. Onboarding & Execution Flow
- **Read Documentation First**: Always read all files in the [docs/](file:///c:/Users/Mehebub_Alam/Desktop/Projects/sales-tracker/docs) directory before proposing changes.
- **Update Project Memory**: Keep [memory.md](file:///c:/Users/Mehebub_Alam/Desktop/Projects/sales-tracker/docs/memory.md) updated with important structural changes, architectural decisions, and key feature implementations.
- **Planning Mode**: For complex tasks, construct a clear plan in an implementation plan artifact, get user approval, and track tasks via `task.md`.

## 2. Tech Stack & Environment Rules
- **Docker First**: All external services (PostgreSQL, Redis, MinIO) must be run using Docker. Check or create `docker-compose.yml` if setup is required.
- **Next.js & React**: Use Next.js 15, React 19, TypeScript, and TailwindCSS v4. Follow Next.js App Router conventions (server components by default, client components only when interactivity is needed).
- **Backend Architecture**: Node.js Express server with Prisma ORM.
- **Type Safety**: Strictly define TypeScript types and schemas (e.g., Zod) for all API payloads and database models. No use of `any`.

## 3. Design & UI Aesthetics
- **Follow Design Specifications**: Follow the guidelines in [designe.md](file:///c:/Users/Mehebub_Alam/Desktop/Projects/sales-tracker/docs/designe.md). Use clean, minimal, glassmorphic styles with harmony palettes (e.g. primary `#2563EB`).
- **Visual Quality**: Avoid generic colors or browser defaults. Focus on high-quality typography, smooth transitions, and premium looks.
- **Component Reusability**: Do not duplicate UI logic. Build modular components utilizing shadcn/ui and Framer Motion for micro-animations.

## 4. Testing & Validation
- Run Vitest for unit/integration tests and Playwright for end-to-end tests before concluding a major change.
- Verify that both the frontend build (`npm run build`) and backend build succeed without compilation or linting errors.
