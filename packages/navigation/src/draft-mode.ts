import { cookies } from './accessors.ts';
import type { FoxenDraftModeState } from './types.ts';

const PREVIEW_BYPASS = '__prerender_bypass';
const PREVIEW_DATA = '__next_preview_data';

const PREVIEW_COOKIE_BASE = {
	httpOnly: true,
	secure: true,
	path: '/',
	sameSite: 'none' as const,
};

function randomToken(): string {
	return globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
}

export async function draftMode(): Promise<FoxenDraftModeState> {
	const jar = await cookies();

	const state: FoxenDraftModeState = {
		isEnabled: Boolean(jar.get(PREVIEW_BYPASS) && jar.get(PREVIEW_DATA)),
		async enable() {
			const bypass = randomToken();
			const payload = randomToken();
			jar.set(PREVIEW_BYPASS, bypass, PREVIEW_COOKIE_BASE);
			jar.set(PREVIEW_DATA, payload, {
				...PREVIEW_COOKIE_BASE,
				sameSite: 'lax',
			});
			state.isEnabled = true;
		},
		async disable() {
			jar.delete(PREVIEW_BYPASS);
			jar.delete(PREVIEW_DATA);
			state.isEnabled = false;
		},
	};

	return state;
}
