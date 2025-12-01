import type { DomainLocale, NextConfig } from './types.ts';

// Internal symbol for NextURL state
const Internal = Symbol.for('foxen.url');

interface NextURLOptions {
	base?: string | URL;
	headers?: Record<string, string | string[] | undefined>;
	forceLocale?: boolean;
	nextConfig?: NextConfig;
}

interface NextURLInternal {
	basePath: string;
	buildId?: string;
	flightSearchParameters?: Record<string, string>;
	defaultLocale?: string;
	domainLocale?: DomainLocale;
	locale?: string;
	locales?: string[];
	options: NextURLOptions;
	trailingSlash?: boolean;
	url: URL;
}

/**
 * NextURL extends URL with Next.js specific properties.
 *
 * This class provides:
 * - basePath support for path prefixing
 * - locale/i18n support for internationalized routing
 * - buildId support for Next.js internal routing
 * - domainLocale support for multi-domain i18n
 */
export class NextURL {
	private [Internal]: NextURLInternal;

	constructor(input: string | URL, base?: string | URL, opts?: NextURLOptions);
	constructor(input: string | URL, opts?: NextURLOptions);
	constructor(
		input: string | URL,
		baseOrOpts?: string | URL | NextURLOptions,
		opts?: NextURLOptions,
	) {
		let base: undefined | string | URL;
		let options: NextURLOptions;

		if (
			(typeof baseOrOpts === 'object' && 'pathname' in baseOrOpts) ||
			typeof baseOrOpts === 'string'
		) {
			base = baseOrOpts;
			options = opts || {};
		} else {
			options = opts || baseOrOpts || {};
		}

		this[Internal] = {
			url: new URL(String(input), base ?? options.base),
			options: options,
			basePath: '',
		};

		this.analyze();
	}

	private analyze() {
		const pathname = this[Internal].url.pathname;
		const nextConfig = this[Internal].options.nextConfig;

		let basePath = '';
		let locale: string | undefined;
		let processedPathname = pathname;

		// Extract basePath if configured
		if (nextConfig?.basePath && pathname.startsWith(nextConfig.basePath)) {
			basePath = nextConfig.basePath;
			processedPathname = pathname.slice(nextConfig.basePath.length) || '/';
		}

		// Extract locale if i18n is configured
		if (nextConfig?.i18n?.locales) {
			const pathParts = processedPathname.split('/').filter(Boolean);
			if (pathParts.length > 0 && pathParts[0]) {
				const potentialLocale = pathParts[0];
				if (nextConfig.i18n.locales.includes(potentialLocale)) {
					locale = potentialLocale;
					processedPathname = `/${pathParts.slice(1).join('/')}` || '/';
				}
			}
		}

		// Detect domain locale if i18n domains are configured
		const domains = nextConfig?.i18n?.domains;
		if (domains && domains.length > 0) {
			const hostname = this[Internal].url.hostname;
			this[Internal].domainLocale = domains.find((d) => d.domain === hostname);
		}

		const defaultLocale =
			this[Internal].domainLocale?.defaultLocale || nextConfig?.i18n?.defaultLocale;

		this[Internal].url.pathname = processedPathname;
		this[Internal].defaultLocale = defaultLocale;
		this[Internal].basePath = basePath;
		this[Internal].locale = locale ?? defaultLocale;
		this[Internal].trailingSlash = nextConfig?.trailingSlash;
	}

	private formatPathname(): string {
		const { basePath, buildId, locale, defaultLocale, trailingSlash } = this[Internal];
		let pathname = this[Internal].url.pathname;

		// Add locale if different from default (unless forceLocale is set)
		if (locale && locale !== defaultLocale && !this[Internal].options.forceLocale) {
			pathname = `/${locale}${pathname}`;
		} else if (locale && this[Internal].options.forceLocale) {
			pathname = `/${locale}${pathname}`;
		}

		// Add buildId if present (for Next.js internal routing)
		if (buildId) {
			pathname = `/_next/data/${buildId}${pathname}`;
		}

		// Add basePath
		if (basePath) {
			pathname = `${basePath}${pathname}`;
		}

		// Handle trailing slash
		if (trailingSlash && !pathname.endsWith('/') && !pathname.includes('.')) {
			pathname = `${pathname}/`;
		}

		return pathname;
	}

	private formatSearch(): string {
		return this[Internal].url.search;
	}

	public get buildId(): string | undefined {
		return this[Internal].buildId;
	}

	public set buildId(buildId: string | undefined) {
		this[Internal].buildId = buildId;
	}

	public get locale(): string {
		return this[Internal].locale ?? '';
	}

	public set locale(locale: string) {
		this[Internal].locale = locale;
	}

	get defaultLocale(): string | undefined {
		return this[Internal].defaultLocale;
	}

	get domainLocale(): DomainLocale | undefined {
		return this[Internal].domainLocale;
	}

	get locales(): string[] | undefined {
		return this[Internal].locales;
	}

	set locales(locales: string[] | undefined) {
		this[Internal].locales = locales ? [...locales] : undefined;
	}

	/**
	 * Set the basePath for the URL.
	 */
	setBasePath(basePath: string): void {
		this[Internal].basePath = basePath.startsWith('/') ? basePath : `/${basePath}`;
	}

	/**
	 * Analyze the URL for locale information.
	 */
	analyzeLocale(locales: string[], defaultLocale: string): void {
		this[Internal].locales = [...locales];
		this[Internal].defaultLocale = defaultLocale;

		const pathname = this[Internal].url.pathname;
		const pathParts = pathname.split('/').filter(Boolean);

		if (pathParts.length > 0 && pathParts[0]) {
			const potentialLocale = pathParts[0];
			if (locales.includes(potentialLocale)) {
				this[Internal].locale = potentialLocale;
				this[Internal].url.pathname = `/${pathParts.slice(1).join('/')}` || '/';
			} else {
				this[Internal].locale = defaultLocale;
			}
		} else {
			this[Internal].locale = defaultLocale;
		}
	}

	get searchParams(): URLSearchParams {
		return this[Internal].url.searchParams;
	}

	get host(): string {
		return this[Internal].url.host;
	}

	set host(value: string) {
		this[Internal].url.host = value;
	}

	get hostname(): string {
		return this[Internal].url.hostname;
	}

	set hostname(value: string) {
		this[Internal].url.hostname = value;
	}

	get port(): string {
		return this[Internal].url.port;
	}

	set port(value: string) {
		this[Internal].url.port = value;
	}

	get protocol(): string {
		return this[Internal].url.protocol;
	}

	set protocol(value: string) {
		this[Internal].url.protocol = value;
	}

	get href(): string {
		const pathname = this.formatPathname();
		const search = this.formatSearch();
		return `${this.protocol}//${this.host}${pathname}${search}${this.hash}`;
	}

	set href(url: string) {
		this[Internal].url = new URL(url);
		this.analyze();
	}

	get origin(): string {
		return this[Internal].url.origin;
	}

	get pathname(): string {
		return this[Internal].url.pathname;
	}

	set pathname(value: string) {
		this[Internal].url.pathname = value;
	}

	get hash(): string {
		return this[Internal].url.hash;
	}

	set hash(value: string) {
		this[Internal].url.hash = value;
	}

	get search(): string {
		return this[Internal].url.search;
	}

	set search(value: string) {
		this[Internal].url.search = value;
	}

	get password(): string {
		return this[Internal].url.password;
	}

	set password(value: string) {
		this[Internal].url.password = value;
	}

	get username(): string {
		return this[Internal].url.username;
	}

	set username(value: string) {
		this[Internal].url.username = value;
	}

	get basePath(): string {
		return this[Internal].basePath;
	}

	set basePath(value: string) {
		this[Internal].basePath = value.startsWith('/') ? value : `/${value}`;
	}

	toString(): string {
		return this.href;
	}

	toJSON(): string {
		return this.href;
	}

	[Symbol.for('edge-runtime.inspect.custom')]() {
		return {
			href: this.href,
			origin: this.origin,
			protocol: this.protocol,
			username: this.username,
			password: this.password,
			host: this.host,
			hostname: this.hostname,
			port: this.port,
			pathname: this.pathname,
			search: this.search,
			searchParams: this.searchParams,
			hash: this.hash,
			basePath: this.basePath,
			locale: this.locale,
			defaultLocale: this.defaultLocale,
		};
	}

	clone(): NextURL {
		const cloned = new NextURL(this[Internal].url.href, this[Internal].options);
		cloned[Internal].basePath = this[Internal].basePath;
		cloned[Internal].locale = this[Internal].locale;
		cloned[Internal].defaultLocale = this[Internal].defaultLocale;
		cloned[Internal].locales = this[Internal].locales ? [...this[Internal].locales] : undefined;
		cloned[Internal].domainLocale = this[Internal].domainLocale;
		cloned[Internal].buildId = this[Internal].buildId;
		cloned[Internal].trailingSlash = this[Internal].trailingSlash;
		return cloned;
	}
}
