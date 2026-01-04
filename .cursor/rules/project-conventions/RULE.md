---
description: "General project conventions, monorepo structure, TypeScript, and development workflow"
alwaysApply: true
---

# Project Conventions

## Monorepo Structure

This is a Bun workspace monorepo with the following structure:

- `packages/backend/` - Elysia API server
- `packages/frontend/` - React frontend application
- `packages/shared/` - Shared types, constants, and utilities

## TypeScript Configuration

- Use strict TypeScript settings
- All files must have proper type annotations
- Avoid `any` type - use `unknown` or proper types
- Use shared types from `@planneer/shared` when possible
- Import types with `import type` when importing only types

## Runtime and Package Manager

- Use **Bun** as the runtime and package manager
- Run commands with `bun` instead of `npm` or `yarn`
- Use Bun's native test runner for backend tests
- Use Bun's built-in bundler for builds

## Port Configuration

- **Frontend**: Always run on port **3000** (http://localhost:3000)
- **Backend**: Always run on port **4000** (http://localhost:4000)
- Configure CORS to allow frontend origin

## Environment Variables

- Use `.env` files for local development
- Never commit `.env` files to git
- Use `packages/backend/src/lib/env.ts` for environment variable validation
- Document required environment variables in README

## Code Style

- Use 2 spaces for indentation
- Use single quotes for strings (or double quotes consistently)
- Use trailing commas in multi-line objects/arrays
- Use semicolons at end of statements
- Follow existing code style in the file you're editing

## Import Organization

- Group imports: external packages, then internal modules
- Use absolute imports with path aliases when configured
- Sort imports alphabetically within groups

Example:

```typescript
import { Elysia, t } from "elysia";
import { eq, desc } from "drizzle-orm";
import { db } from "../db";
import { schedules } from "../db/schema";
import { auth } from "../auth";
```

## File Naming

- Use kebab-case for file names: `user-service.ts`, `project-list.tsx`
- Use PascalCase for component files: `ProjectList.tsx`, `ChatMessage.tsx`
- Use camelCase for utility files: `api.ts`, `utils.ts`
- Use descriptive names that indicate purpose

## Git Workflow

- Create feature branches from `main`
- Write descriptive commit messages
- Keep commits focused and atomic
- Use conventional commit format when possible

## Development Scripts

- `bun run dev` - Start all services
- `bun run dev:backend` - Start only backend
- `bun run dev:frontend` - Start only frontend
- `bun run test` - Run all tests
- `bun run db:migrate` - Run database migrations
- `bun run db:studio` - Open Drizzle Studio

## Error Handling

- Use custom error classes from `packages/backend/src/lib/errors`
- Provide meaningful error messages
- Log errors appropriately (console.error in development)
- Never expose internal error details to clients

## Documentation

- Write clear JSDoc comments for public APIs
- Document complex business logic
- Keep README files updated
- Document API endpoints with Swagger (Elysia Swagger plugin)

## Dependencies

- Keep dependencies up to date
- Use exact versions for critical dependencies when needed
- Prefer workspace dependencies (`workspace:*`) for internal packages
- Review and audit dependencies regularly

## Performance

- Optimize database queries (use indexes, avoid N+1 queries)
- Use React Query caching effectively
- Implement pagination for large datasets
- Use lazy loading for routes and components when appropriate

## Security

- Always validate and sanitize user input
- Use parameterized queries (Drizzle handles this)
- Implement proper authentication and authorization
- Never expose sensitive data in API responses
- Use environment variables for secrets

