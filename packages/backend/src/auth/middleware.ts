import { Elysia } from "elysia";
import { auth } from "./index";
import { UnauthorizedError } from "../lib/errors";

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
}

export const requireAuth = new Elysia({ name: "requireAuth" }).derive(
  async ({ request }) => {
    try {
      const session = await auth.api.getSession({
        headers: request.headers,
      });

      console.log(
        "[Auth] Session check:",
        session?.user?.id ? "authenticated" : "no session"
      );

      if (!session?.user) {
        throw new UnauthorizedError("Authentication required");
      }

      return {
        user: {
          id: session.user.id,
          email: session.user.email,
          name: session.user.name,
          image: session.user.image,
        } as AuthUser,
      };
    } catch (error) {
      console.error("[Auth] Error:", error);
      throw new UnauthorizedError("Authentication required");
    }
  }
);

export const optionalAuth = new Elysia({ name: "optionalAuth" }).derive(
  async ({ request }) => {
    try {
      const session = await auth.api.getSession({
        headers: request.headers,
      });

      if (session?.user) {
        return {
          user: {
            id: session.user.id,
            email: session.user.email,
            name: session.user.name,
            image: session.user.image,
          } as AuthUser,
        };
      }
    } catch {
      // Ignore auth errors for optional auth
    }

    return { user: null as AuthUser | null };
  }
);
