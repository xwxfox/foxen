export type FoxenInterruptCode =
	| 'FOXEN_REDIRECT'
	| 'FOXEN_NOT_FOUND'
	| 'FOXEN_UNAUTHORIZED'
	| 'FOXEN_FORBIDDEN';

export abstract class FoxenInterruptError extends Error {
	override name = 'FoxenInterruptError';
	abstract readonly code: FoxenInterruptCode;
}

export interface RedirectInterruptOptions {
	permanent?: boolean;
	status?: number;
}

export class RedirectInterrupt extends FoxenInterruptError {
	readonly code = 'FOXEN_REDIRECT' as const;
	readonly location: string;
	readonly permanent: boolean;
	readonly status?: number;

	constructor(location: string, options: RedirectInterruptOptions = {}) {
		super(`Redirect requested to ${location}`);
		this.location = location;
		this.permanent = Boolean(options.permanent);
		this.status = options.status;
	}
}

export class NotFoundInterrupt extends FoxenInterruptError {
	readonly code = 'FOXEN_NOT_FOUND' as const;

	constructor(message = 'Resource not found') {
		super(message);
	}
}

export class UnauthorizedInterrupt extends FoxenInterruptError {
	readonly code = 'FOXEN_UNAUTHORIZED' as const;

	constructor(message = 'Unauthorized') {
		super(message);
	}
}

export class ForbiddenInterrupt extends FoxenInterruptError {
	readonly code = 'FOXEN_FORBIDDEN' as const;

	constructor(message = 'Forbidden') {
		super(message);
	}
}

export type FoxenInterrupt =
	| RedirectInterrupt
	| NotFoundInterrupt
	| UnauthorizedInterrupt
	| ForbiddenInterrupt;

export function isInterruptError(error: unknown): error is FoxenInterrupt {
	return error instanceof RedirectInterrupt ||
		error instanceof NotFoundInterrupt ||
		error instanceof UnauthorizedInterrupt ||
		error instanceof ForbiddenInterrupt;
}
