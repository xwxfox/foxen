import { assertRequestContext } from './context.ts';
import {
	ForbiddenInterrupt,
	NotFoundInterrupt,
	RedirectInterrupt,
	UnauthorizedInterrupt,
} from './errors.ts';

function resolveRedirectStatus(init?: number | ResponseInit): number {
	if (typeof init === 'number') return init;
	if (typeof init === 'object' && init?.status) return init.status;
	return 307;
}

function toLocation(input: string | URL): string {
	if (input instanceof URL) {
		return input.toString();
	}
	return String(input);
}

export function redirect(url: string | URL, init?: number | ResponseInit): never {
	const context = assertRequestContext('redirect');
	context.setDynamicFlag();
	const status = resolveRedirectStatus(init);
	const permanent = status === 308 || status === 301;
	throw new RedirectInterrupt(toLocation(url), { status, permanent });
}

export function permanentRedirect(url: string | URL): never {
	return redirect(url, 308);
}

export function temporaryRedirect(url: string | URL): never {
	return redirect(url, 307);
}

export function notFound(): never {
	const context = assertRequestContext('notFound');
	context.setDynamicFlag();
	throw new NotFoundInterrupt();
}

export function unauthorized(): never {
	const context = assertRequestContext('unauthorized');
	context.setDynamicFlag();
	throw new UnauthorizedInterrupt();
}

export function forbidden(): never {
	const context = assertRequestContext('forbidden');
	context.setDynamicFlag();
	throw new ForbiddenInterrupt();
}
