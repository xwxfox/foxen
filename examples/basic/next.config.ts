/**
 * Next.js config example for Foxen
 *
 * This demonstrates how Foxen supports next.config.ts features:
 * - redirects
 * - rewrites
 * - headers
 */

/** @type {import('next').NextConfig} */
const nextConfig = {
    // Base path for API routes
    basePath: "",

    // Redirect configuration
    async redirects() {
        return [
            // Redirect /old-api to /api
            {
                source: "/old-api/:path*",
                destination: "/api/:path*",
                permanent: true,
            },
            // Redirect /v1/users to /api/users
            {
                source: "/v1/users/:id",
                destination: "/api/users/:id",
                permanent: false,
            },
        ];
    },

    // Rewrite configuration
    async rewrites() {
        return {
            // beforeFiles - runs before static/dynamic routes
            beforeFiles: [
                // Rewrite /legacy/hello to /api/hello
                {
                    source: "/legacy/hello",
                    destination: "/api/hello",
                },
            ],
            // afterFiles - runs after static files but before dynamic routes
            afterFiles: [],
            // fallback - only runs if no page/file matched
            fallback: [],
        };
    },

    // Headers configuration
    async headers() {
        return [
            // Add security headers to all API routes
            {
                source: "/api/:path*",
                headers: [
                    { key: "X-Powered-By", value: "Foxen" },
                    { key: "X-Request-Time", value: new Date().toISOString() },
                    { key: "Access-Control-Allow-Origin", value: "*" },
                    { key: "Access-Control-Allow-Methods", value: "GET, POST, PUT, DELETE, OPTIONS" },
                ],
            },
            // Add cache headers to the hello endpoint
            {
                source: "/api/hello",
                headers: [
                    { key: "Cache-Control", value: "public, max-age=60" },
                ],
            },
        ];
    },
};

export default nextConfig;
