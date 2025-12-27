import { createRootRoute, createRoute, Outlet } from '@tanstack/react-router';
import { Layout } from '@/components/Layout';
import { Dashboard } from '@/pages/Dashboard';
import { Chat } from '@/pages/Chat';
import { Projects } from '@/pages/Projects';
import { ProjectDetail } from '@/pages/ProjectDetail';
import { Schedules } from '@/pages/Schedules';
import { ScheduleDetail } from '@/pages/ScheduleDetail';
import { Templates } from '@/pages/Templates';
import { Organizations } from '@/pages/Organizations';
import { Login } from '@/pages/Login';
import { Onboarding } from '@/pages/Onboarding';

const rootRoute = createRootRoute({
  component: () => (
    <Layout>
      <Outlet />
    </Layout>
  ),
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: Dashboard,
});

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  component: Login,
});

const onboardingRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/onboarding',
  component: Onboarding,
});

const chatRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/chat',
  component: Chat,
});

const chatSessionRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/chat/$sessionId',
  component: Chat,
});

const projectsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/projects',
  component: Projects,
});

const projectDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/projects/$projectId',
  component: ProjectDetail,
});

const schedulesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/schedules',
  component: Schedules,
});

const scheduleDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/schedules/$scheduleId',
  component: ScheduleDetail,
});

const templatesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/templates',
  component: Templates,
});

const organizationsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/organizations',
  component: Organizations,
});

export const routeTree = rootRoute.addChildren([
  indexRoute,
  loginRoute,
  onboardingRoute,
  chatRoute,
  chatSessionRoute,
  projectsRoute,
  projectDetailRoute,
  schedulesRoute,
  scheduleDetailRoute,
  templatesRoute,
  organizationsRoute,
]);

