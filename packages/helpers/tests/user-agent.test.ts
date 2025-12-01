import { describe, expect, it } from 'bun:test';
import { isBot, isDesktop, isMobile, parseUserAgent, userAgent } from '../src/user-agent.js';

describe('userAgent', () => {
	describe('browser detection', () => {
		it('should detect Chrome', () => {
			const ua = parseUserAgent(
				'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
			);
			expect(ua.browser.name).toBe('Chrome');
			expect(ua.browser.version).toBe('120.0.0.0');
		});

		it('should detect Firefox', () => {
			const ua = parseUserAgent(
				'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
			);
			expect(ua.browser.name).toBe('Firefox');
			expect(ua.browser.version).toBe('121.0');
		});

		it('should detect Safari', () => {
			const ua = parseUserAgent(
				'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
			);
			expect(ua.browser.name).toBe('Safari');
		});

		it('should detect Edge', () => {
			const ua = parseUserAgent(
				'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
			);
			expect(ua.browser.name).toBe('Edge');
		});
	});

	describe('OS detection', () => {
		it('should detect Windows', () => {
			const ua = parseUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
			expect(ua.os.name).toBe('Windows');
			expect(ua.os.version).toBe('10.0');
		});

		it('should detect macOS', () => {
			const ua = parseUserAgent(
				'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
			);
			expect(ua.os.name).toBe('macOS');
			expect(ua.os.version).toBe('10.15.7');
		});

		it('should detect iOS', () => {
			const ua = parseUserAgent(
				'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15',
			);
			expect(ua.os.name).toBe('iOS');
		});

		it('should detect Android', () => {
			const ua = parseUserAgent('Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36');
			expect(ua.os.name).toBe('Android');
			expect(ua.os.version).toBe('14');
		});
	});

	describe('device detection', () => {
		it('should detect mobile device', () => {
			const ua = parseUserAgent(
				'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 Mobile',
			);
			expect(ua.device.type).toBe('mobile');
			expect(ua.device.vendor).toBe('Apple');
		});

		it('should detect tablet', () => {
			const ua = parseUserAgent(
				'Mozilla/5.0 (iPad; CPU OS 17_2 like Mac OS X) AppleWebKit/605.1.15',
			);
			expect(ua.device.type).toBe('tablet');
		});

		it('should detect desktop by default', () => {
			const ua = parseUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
			expect(ua.device.type).toBe('desktop');
		});
	});

	describe('bot detection', () => {
		it('should detect Googlebot', () => {
			const ua = parseUserAgent(
				'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
			);
			expect(ua.isBot).toBe(true);
		});

		it('should detect Bingbot', () => {
			const ua = parseUserAgent(
				'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)',
			);
			expect(ua.isBot).toBe(true);
		});

		it('should detect generic bot patterns', () => {
			const ua = parseUserAgent('MyCustomBot/1.0 crawler');
			expect(ua.isBot).toBe(true);
		});

		it('should not flag regular browser as bot', () => {
			const ua = parseUserAgent(
				'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0',
			);
			expect(ua.isBot).toBe(false);
		});
	});

	describe('helper functions', () => {
		it('isMobile should work', () => {
			const mobileUA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) Mobile';
			const desktopUA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)';
			expect(isMobile(mobileUA)).toBe(true);
			expect(isMobile(desktopUA)).toBe(false);
		});

		it('isDesktop should work', () => {
			const desktopUA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)';
			expect(isDesktop(desktopUA)).toBe(true);
		});

		it('isBot should work', () => {
			expect(isBot('Googlebot/2.1')).toBe(true);
			expect(isBot('Mozilla/5.0 Chrome/120.0.0.0')).toBe(false);
		});
	});

	describe('userAgent with Request', () => {
		it('should parse from Request object', () => {
			const req = new Request('https://example.com', {
				headers: {
					'User-Agent':
						'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0',
				},
			});
			const ua = userAgent(req);
			expect(ua.browser.name).toBe('Chrome');
			expect(ua.os.name).toBe('Windows');
		});
	});
});
