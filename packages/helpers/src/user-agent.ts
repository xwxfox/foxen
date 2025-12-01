/**
 * Parsed user agent information
 */
export interface UserAgent {
	/** Whether the device is a bot */
	isBot: boolean;
	/** Browser information */
	browser: {
		name?: string;
		version?: string;
	};
	/** Device information */
	device: {
		model?: string;
		type?: string;
		vendor?: string;
	};
	/** Engine information */
	engine: {
		name?: string;
		version?: string;
	};
	/** OS information */
	os: {
		name?: string;
		version?: string;
	};
	/** CPU information */
	cpu: {
		architecture?: string;
	};
}

/**
 * Bot detection patterns
 */
const BOT_PATTERNS = [
	'Googlebot',
	'Bingbot',
	'Slurp',
	'DuckDuckBot',
	'Baiduspider',
	'YandexBot',
	'facebookexternalhit',
	'LinkedInBot',
	'Twitterbot',
	'Discordbot',
	'TelegramBot',
	'WhatsApp',
	'Applebot',
	'bot',
	'spider',
	'crawl',
	'slurp',
	'lighthouse',
	'headless',
	'puppeteer',
	'playwright',
	'selenium',
	'phantomjs',
];

/**
 * Browser detection patterns
 */
const BROWSER_PATTERNS: Array<{
	name: string;
	pattern: RegExp;
	versionPattern?: RegExp;
}> = [
	{
		name: 'Edge',
		pattern: /edg(e|a|ios)?/i,
		versionPattern: /edg(?:e|a|ios)?\/(\d+[\d.]*)/i,
	},
	{
		name: 'Chrome',
		pattern: /chrome|chromium|crios/i,
		versionPattern: /(?:chrome|chromium|crios)\/(\d+[\d.]*)/i,
	},
	{
		name: 'Firefox',
		pattern: /firefox|fxios/i,
		versionPattern: /(?:firefox|fxios)\/(\d+[\d.]*)/i,
	},
	{
		name: 'Safari',
		pattern: /safari/i,
		versionPattern: /version\/(\d+[\d.]*)/i,
	},
	{
		name: 'Opera',
		pattern: /opera|opr/i,
		versionPattern: /(?:opera|opr)\/(\d+[\d.]*)/i,
	},
	{
		name: 'IE',
		pattern: /msie|trident/i,
		versionPattern: /(?:msie |rv:)(\d+[\d.]*)/i,
	},
];

/**
 * OS detection patterns
 */
const OS_PATTERNS: Array<{
	name: string;
	pattern: RegExp;
	versionPattern?: RegExp;
}> = [
	{
		name: 'Windows',
		pattern: /windows/i,
		versionPattern: /windows nt (\d+[\d.]*)/i,
	},
	{
		name: 'iOS',
		pattern: /iphone|ipad|ipod/i,
		versionPattern: /os (\d+[._\d]*)/i,
	},
	{
		name: 'macOS',
		pattern: /mac os x|macos/i,
		versionPattern: /mac os x (\d+[._\d]*)/i,
	},
	{
		name: 'Android',
		pattern: /android/i,
		versionPattern: /android (\d+[\d.]*)/i,
	},
	{
		name: 'Linux',
		pattern: /linux/i,
	},
	{
		name: 'ChromeOS',
		pattern: /cros/i,
	},
];

/**
 * Device type detection patterns
 */
const DEVICE_PATTERNS: Array<{
	type: string;
	pattern: RegExp;
}> = [
	{ type: 'mobile', pattern: /mobile|iphone|ipod|android.*mobile/i },
	{ type: 'tablet', pattern: /tablet|ipad|android(?!.*mobile)/i },
	{ type: 'smarttv', pattern: /smart-tv|smarttv|googletv|appletv|hbbtv|pov_tv|netcast/i },
	{ type: 'console', pattern: /playstation|xbox|nintendo/i },
	{ type: 'wearable', pattern: /watch/i },
];

/**
 * Engine detection patterns
 */
const ENGINE_PATTERNS: Array<{
	name: string;
	pattern: RegExp;
	versionPattern?: RegExp;
}> = [
	{
		name: 'Blink',
		pattern: /chrome/i,
		versionPattern: /chrome\/(\d+[\d.]*)/i,
	},
	{
		name: 'WebKit',
		pattern: /webkit/i,
		versionPattern: /webkit\/(\d+[\d.]*)/i,
	},
	{
		name: 'Gecko',
		pattern: /gecko/i,
		versionPattern: /rv:(\d+[\d.]*)/i,
	},
	{
		name: 'Trident',
		pattern: /trident/i,
		versionPattern: /trident\/(\d+[\d.]*)/i,
	},
	{
		name: 'Presto',
		pattern: /presto/i,
		versionPattern: /presto\/(\d+[\d.]*)/i,
	},
];

/**
 * CPU architecture patterns
 */
const CPU_PATTERNS: Array<{
	architecture: string;
	pattern: RegExp;
}> = [
	{ architecture: 'arm64', pattern: /arm64|aarch64/i },
	{ architecture: 'arm', pattern: /arm/i },
	{ architecture: 'x64', pattern: /x64|x86_64|amd64|win64/i },
	{ architecture: 'x86', pattern: /x86|i[3-6]86/i },
];

/**
 * Parse user agent string
 */
export function userAgent(input: Request | { headers: Headers } | string): UserAgent {
	let uaString: string;

	if (typeof input === 'string') {
		uaString = input;
	} else if (input instanceof Request) {
		uaString = input.headers.get('user-agent') ?? '';
	} else {
		uaString = input.headers.get('user-agent') ?? '';
	}

	return parseUserAgent(uaString);
}

/**
 * Parse a user agent string into structured data
 */
export function parseUserAgent(uaString: string): UserAgent {
	const ua = uaString.toLowerCase();

	return {
		isBot: detectBot(ua),
		browser: detectBrowser(uaString),
		device: detectDevice(uaString),
		engine: detectEngine(uaString),
		os: detectOS(uaString),
		cpu: detectCPU(uaString),
	};
}

/**
 * Detect if user agent is a bot
 */
function detectBot(ua: string): boolean {
	return BOT_PATTERNS.some((pattern) => ua.includes(pattern.toLowerCase()));
}

/**
 * Detect browser from user agent
 */
function detectBrowser(ua: string): UserAgent['browser'] {
	for (const { name, pattern, versionPattern } of BROWSER_PATTERNS) {
		if (pattern.test(ua)) {
			let version: string | undefined;
			if (versionPattern) {
				const match = ua.match(versionPattern);
				version = match?.[1];
			}
			return { name, version };
		}
	}
	return {};
}

/**
 * Detect OS from user agent
 */
function detectOS(ua: string): UserAgent['os'] {
	for (const { name, pattern, versionPattern } of OS_PATTERNS) {
		if (pattern.test(ua)) {
			let version: string | undefined;
			if (versionPattern) {
				const match = ua.match(versionPattern);
				version = match?.[1]?.replace(/_/g, '.');
			}
			return { name, version };
		}
	}
	return {};
}

/**
 * Detect device from user agent
 */
function detectDevice(ua: string): UserAgent['device'] {
	const result: UserAgent['device'] = {};

	// Detect device type
	for (const { type, pattern } of DEVICE_PATTERNS) {
		if (pattern.test(ua)) {
			result.type = type;
			break;
		}
	}

	// Default to desktop if no type detected
	if (!result.type) {
		result.type = 'desktop';
	}

	// Detect vendor
	if (/iphone|ipad|ipod|mac/i.test(ua)) {
		result.vendor = 'Apple';
	} else if (/samsung/i.test(ua)) {
		result.vendor = 'Samsung';
	} else if (/huawei/i.test(ua)) {
		result.vendor = 'Huawei';
	} else if (/xiaomi/i.test(ua)) {
		result.vendor = 'Xiaomi';
	} else if (/oppo/i.test(ua)) {
		result.vendor = 'OPPO';
	} else if (/vivo/i.test(ua)) {
		result.vendor = 'Vivo';
	} else if (/oneplus/i.test(ua)) {
		result.vendor = 'OnePlus';
	} else if (/google|pixel/i.test(ua)) {
		result.vendor = 'Google';
	}

	// Detect model (simplified)
	const iphoneMatch = ua.match(/iphone\s*(\d+)?/i);
	if (iphoneMatch) {
		result.model = `iPhone${iphoneMatch[1] ? ` ${iphoneMatch[1]}` : ''}`;
	}

	const ipadMatch = ua.match(/ipad/i);
	if (ipadMatch) {
		result.model = 'iPad';
	}

	return result;
}

/**
 * Detect engine from user agent
 */
function detectEngine(ua: string): UserAgent['engine'] {
	for (const { name, pattern, versionPattern } of ENGINE_PATTERNS) {
		if (pattern.test(ua)) {
			let version: string | undefined;
			if (versionPattern) {
				const match = ua.match(versionPattern);
				version = match?.[1];
			}
			return { name, version };
		}
	}
	return {};
}

/**
 * Detect CPU architecture from user agent
 */
function detectCPU(ua: string): UserAgent['cpu'] {
	for (const { architecture, pattern } of CPU_PATTERNS) {
		if (pattern.test(ua)) {
			return { architecture };
		}
	}
	return {};
}

/**
 * Check if user agent is a mobile device
 */
export function isMobile(input: Request | { headers: Headers } | string): boolean {
	const ua = userAgent(input);
	return ua.device.type === 'mobile';
}

/**
 * Check if user agent is a tablet
 */
export function isTablet(input: Request | { headers: Headers } | string): boolean {
	const ua = userAgent(input);
	return ua.device.type === 'tablet';
}

/**
 * Check if user agent is a desktop
 */
export function isDesktop(input: Request | { headers: Headers } | string): boolean {
	const ua = userAgent(input);
	return ua.device.type === 'desktop';
}

/**
 * Check if user agent is a bot
 */
export function isBot(input: Request | { headers: Headers } | string): boolean {
	const ua = userAgent(input);
	return ua.isBot;
}
