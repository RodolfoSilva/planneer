import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { auth } from "@/lib/api";
import { useNavigate } from "@tanstack/react-router";

interface User {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
}

interface SessionData {
  session: {
    id: string;
    userId: string;
    expiresAt: Date | string;
  };
  user: User;
}

export function useAuth() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const sessionQuery = useQuery<SessionData | null>({
    queryKey: ["session"],
    queryFn: async () => {
      try {
        const response = await auth.getSession();
        console.log("[Auth] Session response:", response);
        // Better-Auth returns { session, user } directly
        if (response && "user" in response) {
          return response as unknown as SessionData;
        }
        return null;
      } catch (error) {
        console.error("[Auth] Session error:", error);
        return null;
      }
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: false,
  });

  const loginMutation = useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      auth.login(email, password),
    onSuccess: async () => {
      // Wait for session to be refetched before navigating
      await queryClient.refetchQueries({ queryKey: ["session"] });
      navigate({ to: "/" });
    },
  });

  const registerMutation = useMutation({
    mutationFn: ({
      email,
      password,
      name,
    }: {
      email: string;
      password: string;
      name: string;
    }) => auth.register(email, password, name),
    onSuccess: async () => {
      // Wait for session to be refetched before navigating
      await queryClient.refetchQueries({ queryKey: ["session"] });
      navigate({ to: "/" });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: () => auth.logout(),
    onSuccess: () => {
      queryClient.clear();
      navigate({ to: "/login" });
    },
  });

  return {
    user: sessionQuery.data?.user ?? null,
    isLoading: sessionQuery.isLoading,
    isAuthenticated: !!sessionQuery.data?.user,
    login: loginMutation.mutate,
    loginError: loginMutation.error,
    isLoggingIn: loginMutation.isPending,
    register: registerMutation.mutate,
    registerError: registerMutation.error,
    isRegistering: registerMutation.isPending,
    logout: logoutMutation.mutate,
  };
}
