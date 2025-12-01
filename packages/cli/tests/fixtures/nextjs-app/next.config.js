/** @type {import('next').NextConfig} */
const nextConfig = {
    async redirects() {
        return [
            {
                source: '/old-page',
                destination: '/new-page',
                permanent: true,
            },
        ];
    },
    async rewrites() {
        return [
            {
                source: '/api/proxy/:path*',
                destination: 'https://external.api.com/:path*',
            },
        ];
    },
    async headers() {
        return [
            {
                source: '/api/:path*',
                headers: [
                    { key: 'X-Custom-Header', value: 'custom-value' },
                ],
            },
        ];
    },
};

module.exports = nextConfig;
