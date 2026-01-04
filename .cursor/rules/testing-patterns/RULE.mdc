---
description: "Testing patterns for backend and frontend using Bun test and Vitest"
globs:
  - "packages/backend/src/tests/**/*.ts"
  - "packages/frontend/src/tests/**/*.ts"
  - "packages/backend/src/tests/**/*.test.ts"
  - "packages/frontend/src/tests/**/*.test.ts"
alwaysApply: false
---

# Testing Patterns

## Backend Tests (Bun Test)

When writing tests in `packages/backend/src/tests/`:

- Use Bun's built-in test runner
- Name test files with `.test.ts` suffix
- Use descriptive test names with `describe` and `it` blocks
- Test both success and error cases

Example structure:

```typescript
import { describe, it, expect, beforeEach } from "bun:test";
import { db } from "../db";
import { schedules } from "../db/schema";

describe("Schedule Service", () => {
  beforeEach(async () => {
    // Setup test data or clean database
  });

  it("should create a schedule", async () => {
    const schedule = await createSchedule({
      projectId: "test-project-id",
      name: "Test Schedule",
    });

    expect(schedule).toBeDefined();
    expect(schedule.name).toBe("Test Schedule");
  });

  it("should throw error when project not found", async () => {
    await expect(
      createSchedule({
        projectId: "non-existent-id",
        name: "Test Schedule",
      })
    ).rejects.toThrow(NotFoundError);
  });
});
```

## Frontend Tests (Vitest)

When writing tests in `packages/frontend/src/tests/`:

- Use Vitest with React Testing Library
- Test user interactions, not implementation details
- Use `@testing-library/react` for component testing
- Mock API calls using React Query's test utilities

Example structure:

```typescript
import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ProjectList } from "@/components/ProjectList";
import * as api from "@/lib/api";

describe("ProjectList", () => {
  it("should render projects", async () => {
    vi.spyOn(api.projects, "list").mockResolvedValue({
      success: true,
      data: {
        items: [{ id: "1", name: "Test Project" }],
        total: 1,
      },
    });

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <ProjectList organizationId="org-1" />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("Test Project")).toBeInTheDocument();
    });
  });
});
```

## Test Organization

- Group related tests with `describe` blocks
- Use `beforeEach` and `afterEach` for setup/teardown
- Keep tests isolated and independent
- Use meaningful test descriptions that explain what is being tested

## Mocking

- Mock external dependencies (API calls, database, file system)
- Use `vi.fn()` or `vi.spyOn()` in Vitest
- Use `mock` or `spyOn` in Bun test
- Reset mocks between tests

## Integration Tests

- Test complete workflows end-to-end when possible
- Use test database for integration tests
- Clean up test data after each test
- Test error handling and edge cases

## Test Coverage

- Aim for high coverage of business logic
- Focus on testing critical paths
- Don't test implementation details
- Test user-facing behavior

## Running Tests

- Backend: `bun test` or `bun test:watch`
- Frontend: `bun test` (runs Vitest) or `bun test:ui` (Vitest UI)
- All tests: `bun test` from root (runs all package tests)

