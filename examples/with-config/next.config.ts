/**
 * next.config.ts - Next.js configuration with redirects, rewrites, and headers
 *
 * Foxen supports these next.config.ts features at runtime.
 */

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    /**
     * Redirects - redirect requests to a different URL
     *
     * Permanent redirects use 308 status code (cached by browsers)
     * Temporary redirects use 307 status code (not cached)
     */
    async redirects() {
        return [
            // Redirect old API paths to new ones (permanent)
            {
                source: "/old-api/:path*",
                destination: "/api/:path*",
                permanent: true,
            },
            // Redirect legacy versioned API (temporary)
            {
                source: "/v1/users/:id",
                destination: "/api/users/:id",
                permanent: false,
            },
            // Redirect with query string preservation
            {
                source: "/search",
                destination: "/api/users",
                permanent: false,
            },
        ];
    },

    /**
     * Rewrites - proxy requests to a different URL without changing the browser URL
     *
     * Unlike redirects, rewrites are transparent to the client.
     */
    async rewrites() {
        return [
            // Legacy path that silently serves from /api/hello
            {
                source: "/legacy/hello",
                destination: "/api/hello",
            },
            // Alias for users endpoint
            {
                source: "/people",
                destination: "/api/users",
            },
            // Alias with parameter
            {
                source: "/person/:id",
                destination: "/api/users/:id",
            },
        ];
    },

    /**
     * Headers - add custom HTTP headers to responses
     *
     * Useful for CORS, security headers, caching, etc.
     */
    async headers() {
        return [
            // Add custom headers to all API routes
            {
                source: "/api/:path*",
                headers: [
                    {
                        key: "X-Powered-By",
                        value: "Foxen",
                    },
                    {
                        key: "X-Custom-Header",
                        value: "Hello from next.config.ts",
                    },
                    {
                        key: "Cache-Control",
                        value: "no-cache, no-store, must-revalidate",
                    },
                ],
            },
            // Add CORS headers to API
            {
                source: "/api/:path*",
                headers: [
                    {
                        key: "Access-Control-Allow-Origin",
                        value: "*",
                    },
                    {
                        key: "Access-Control-Allow-Methods",
                        value: "GET, POST, PUT, DELETE, OPTIONS",
                    },
                    {
                        key: "Access-Control-Allow-Headers",
                        value: "Content-Type, Authorization",
                    },
                ],
            },
        ];
    },
};

export default nextConfig;
