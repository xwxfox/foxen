import type { NextRequest } from '@foxen/core';
import type { Auth } from 'better-auth';

type BetterAuthSessionPayload<User> = {
  user: User;
  session: {
    id: string;
    createdAt: Date;
    updatedAt: Date;
    userId: string;
    expiresAt: Date;
    token: string;
    ipAddress?: string | null;
    userAgent?: string | null;
    [key: string]: unknown;
  };
} & Record<string, unknown>;

type NormalizedBetterAuthSession<User> = BetterAuthSessionPayload<User> & {
  userId: string;
};

/**
 * Create a session getter from a better-auth instance
 * Users import their own auth instance
 */
export function createBetterAuthSessionGetter<User = Record<string, unknown>>(
  auth: Auth
): (req: NextRequest) => Promise<NormalizedBetterAuthSession<User> | null> {
  return async (req: NextRequest) => {
    try {
      const session = await auth.api.getSession({
        headers: req.headers,
      });

      if (!session?.user) {
        return null;
      }

      const normalizedSession: NormalizedBetterAuthSession<User> = {
        ...session,
        user: session.user as User,
        userId: session.user.id,
        session: {
          ...session.session,
          userId: session.session?.userId ?? session.user.id,
        },
      };

      return normalizedSession;
    } catch (error) {
      console.error('[Foxen Auth] Session error:', error);
      return null;
    }
  };
}

/**
 * Type helper for extending Session with better-auth user type
 */
export type BetterAuthSession<User> = NormalizedBetterAuthSession<User>;