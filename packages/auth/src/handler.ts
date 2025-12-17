import { NextResponse, type NextRequest } from '@foxen/core';
import type { Session, AuthContext, FailureContext, AuthCheck } from './context';
import { UnauthenticatedError, UnauthorizedError, AuthError } from './errors';

type AuthSuccessHandler<TSession extends Session> = (
  context: AuthContext<TSession>
) => void | Promise<void>;

type AuthFailureHandler = (
  context: FailureContext
) => Response | Promise<Response>;

/**
 * Fluent auth handler builder
 */
export class AuthHandlerBuilder<TSession extends Session = Session> {
  private successHandler?: AuthSuccessHandler<TSession>;
  private failureHandler?: AuthFailureHandler;
  private checks: AuthCheck<TSession>[] = [];

  constructor(
    private readonly req: NextRequest,
    private readonly sessionGetter: (req: NextRequest) => Promise<TSession | null>
  ) {}

  /**
   * Register a success callback that runs after auth passes
   */
  authSuccess(handler: AuthSuccessHandler<TSession>): this {
    this.successHandler = handler;
    return this;
  }

  /**
   * Register a failure callback that runs when auth fails
   * Must return a Response object
   */
  authFailure(handler: AuthFailureHandler): this {
    this.failureHandler = handler;
    return this;
  }

  /**
   * Add a custom check that runs after initial auth
   */
  addCheck(check: AuthCheck<TSession>): this {
    this.checks.push(check);
    return this;
  }

  /**
   * Add multiple checks at once
   */
  addChecks(...checks: AuthCheck<TSession>[]): this {
    this.checks.push(...checks);
    return this;
  }

  /**
   * Execute the auth flow
   */
  async execute(): Promise<AuthContext<TSession>> {
    try {
      // Step 1: Get session
      const session = await this.sessionGetter(this.req);

      if (!session) {
        throw new UnauthenticatedError();
      }

      const context: AuthContext<TSession> = {
        req: this.req,
        session,
      };

      // Step 2: Run custom checks
      for (const check of this.checks) {
        const passed = await check.check(context);

        if (!passed) {
          const error = check.checkError || new UnauthorizedError('Authorization check failed');

          // Run custom failure handler if provided
          if (check.checkFailure) {
            await check.checkFailure({ ...context, error });
          }

          // If required, throw to trigger main failure handler
          if (check.isRequired !== false) {
            throw error;
          }
        }
      }

      // Step 3: Run success handler
      if (this.successHandler) {
        await this.successHandler(context);
      }

      return context;
    } catch (error) {
      // Convert to AuthError if needed
      const authError =
        error instanceof AuthError
          ? error
          : new AuthError(
              error instanceof Error ? error.message : 'Unknown auth error',
              'UNKNOWN_ERROR',
              500
            );

      // Run custom failure handler or use default
      if (this.failureHandler) {
        const response = await this.failureHandler({
          req: this.req,
          error: authError,
        });
        throw response; // Throw response to be caught by route handler
      }

      // Default failure behavior
      throw NextResponse.json(
        {
          error: authError.message,
          code: authError.code,
          metadata: authError.metadata,
        },
        {
          status: authError.statusCode,
        }
      );
    }
  }
}

/**
 * Initialize auth check with fluent API
 */
export function requireAuth<TSession extends Session = Session>(
  req: NextRequest,
  sessionGetter: (req: NextRequest) => Promise<TSession | null>
): AuthHandlerBuilder<TSession> {
  return new AuthHandlerBuilder<TSession>(req, sessionGetter);
}

/**
 * Simple auth check that throws on failure
 */
export async function requireAuthSimple<TSession extends Session = Session>(
  req: NextRequest,
  sessionGetter: (req: NextRequest) => Promise<TSession | null>
): Promise<AuthContext<TSession>> {
  return requireAuth<TSession>(req, sessionGetter).execute();
}