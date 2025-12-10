import { assertRequestContext } from './context.ts';
import type { FoxenCookieStore } from './types.ts';

export async function cookies(): Promise<FoxenCookieStore> {
	const context = assertRequestContext('cookies');
	context.setDynamicFlag();
	return context.cookies;
}
