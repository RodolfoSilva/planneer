---
description: "Backend API patterns for Elysia routes, error handling, authentication, and service layer architecture"
globs:
  - "packages/backend/src/routes/**/*.ts"
  - "packages/backend/src/services/**/*.ts"
alwaysApply: false
---

# Backend API Patterns

## Elysia Route Structure

When creating new API routes in `packages/backend/src/routes/`:

- Use Elysia with TypeBox for request validation
- Follow RESTful conventions for endpoint naming
- Use the `/api/{resource}` prefix pattern
- Export routes as `new Elysia({ prefix: "/api/{resource}" })`

Example structure:

```typescript
import { Elysia, t } from "elysia";
import { db } from "../db";
import { auth } from "../auth";
import { UnauthorizedError, NotFoundError } from "../lib/errors";

// Helper to get authenticated user
async function getAuthUser(request: Request) {
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session?.user) {
    throw new UnauthorizedError("Authentication required");
  }

  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
  };
}

export const resourceRoutes = new Elysia({ prefix: "/api/resource" })
  .get(
    "/",
    async ({ query, request }) => {
      const user = await getAuthUser(request);
      // Implementation
    },
    {
      query: t.Object({
        organizationId: t.Optional(t.String()),
      }),
    }
  )
  .post(
    "/",
    async ({ body, request }) => {
      const user = await getAuthUser(request);
      // Implementation
    },
    {
      body: t.Object({
        name: t.String(),
        description: t.Optional(t.String()),
      }),
    }
  );
```

## Error Handling

- Always use custom error classes from `../lib/errors`:
  - `UnauthorizedError` - for authentication failures
  - `ForbiddenError` - for authorization failures
  - `NotFoundError` - for missing resources
  - `ValidationError` - for invalid input
- Return errors in consistent format: `{ success: false, error: { message: string, code?: string } }`
- Return success responses as: `{ success: true, data: T }`

## Authentication & Authorization

- Always check authentication using `getAuthUser(request)` helper
- Verify organization membership for multi-tenant resources
- Use `getUserOrganizations` service to check user access
- Throw `ForbiddenError` when user lacks required permissions

## Service Layer

- Keep business logic in `packages/backend/src/services/`
- Services should be pure functions or classes with clear responsibilities
- Services should not directly handle HTTP concerns (request/response)
- Use dependency injection pattern when possible

## Database Queries

- Use Drizzle ORM query builder for all database operations
- Prefer relational queries with `db.query` for complex joins
- Use `eq`, `desc`, `asc` from `drizzle-orm` for filtering and sorting
- Always include proper error handling for database operations

## Response Format

All API responses should follow this structure:

```typescript
// Success response
{
  success: true,
  data: T
}

// Error response
{
  success: false,
  error: {
    message: string,
    code?: string
  }
}
```

## File Uploads

- Use FormData for file uploads
- Store files in S3-compatible storage using `storage.ts` service
- Return signed URLs for file access
- Validate file types and sizes before processing

