---
description: "Frontend React patterns for components, hooks, API calls, and state management using React Query"
globs:
  - "packages/frontend/src/**/*.tsx"
  - "packages/frontend/src/**/*.ts"
alwaysApply: false
---

# Frontend React Patterns

## Component Structure

When creating React components in `packages/frontend/src/components/` or `packages/frontend/src/pages/`:

- Use functional components with TypeScript
- Define props interfaces at the top of the file
- Use named exports for components
- Keep components focused and single-purpose

Example structure:

```typescript
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { projects } from '@/lib/api';

interface ProjectListProps {
  organizationId: string;
  onSelect?: (projectId: string) => void;
}

export function ProjectList({ organizationId, onSelect }: ProjectListProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['projects', organizationId],
    queryFn: () => projects.list(organizationId),
  });

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      {/* Component content */}
    </div>
  );
}
```

## Styling with Tailwind CSS

- Always use Tailwind CSS utility classes for styling
- Use `clsx` and `tailwind-merge` for conditional classes
- Follow the existing design system patterns
- Use responsive utilities (`sm:`, `md:`, `lg:`) for mobile-first design

Example:

```typescript
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function Button({ variant = 'primary', className, ...props }) {
  return (
    <button
      className={twMerge(
        clsx(
          'px-4 py-2 rounded-md font-medium',
          variant === 'primary' && 'bg-blue-600 text-white',
          variant === 'secondary' && 'bg-gray-200 text-gray-900'
        ),
        className
      )}
      {...props}
    />
  );
}
```

## API Calls with React Query

- Use `@tanstack/react-query` for all data fetching
- Define query keys as arrays: `['resource', id, ...filters]`
- Use the API functions from `@/lib/api` instead of direct fetch calls
- Handle loading and error states consistently

Example:

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projects } from '@/lib/api';

// Query
const { data, isLoading, error } = useQuery({
  queryKey: ['projects', organizationId],
  queryFn: () => projects.list(organizationId),
});

// Mutation
const queryClient = useQueryClient();
const mutation = useMutation({
  mutationFn: (data) => projects.create(data),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['projects'] });
  },
});
```

## Custom Hooks

- Create custom hooks in `packages/frontend/src/hooks/`
- Prefix hook names with `use`
- Extract reusable logic from components into hooks
- Return objects with clear property names

Example:

```typescript
// hooks/useProjects.ts
export function useProjects(organizationId?: string) {
  return useQuery({
    queryKey: ['projects', organizationId],
    queryFn: () => projects.list(organizationId),
    enabled: !!organizationId,
  });
}
```

## Routing

- Use TanStack Router for navigation
- Define routes in `packages/frontend/src/routes/index.tsx`
- Use typed route parameters and search params
- Implement protected routes using authentication checks

## State Management

- Use React Query for server state
- Use React Context for global UI state (e.g., OrganizationContext)
- Use local state (`useState`) for component-specific state
- Consider Zustand for complex client-side state if needed

## Error Handling

- Display user-friendly error messages
- Use consistent error UI components
- Log errors to console in development
- Provide actionable error messages when possible

## Forms

- Use controlled components with `useState` or form libraries
- Validate inputs on both client and server
- Show validation errors inline
- Disable submit buttons during submission

