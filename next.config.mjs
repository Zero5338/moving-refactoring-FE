/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/auth/:path*",
        destination: "http://localhost:8080/api/auth/:path*", // 백엔드 주소로 변경
      },
    ];
  },
  // reactStrictMode: false, // Strict Mode 비활성화
  images : {
    domains: ['moving-app.site', 'd15bip1fg1s64o.cloudfront.net'],
    remotePatterns : [
        {
            protocol : 'https',
            hostname : 'd15bip1fg1s64o.cloudfront.net',
            port : '',
            pathname : '/**',
        }
    ]
  },
  env:{
    JWT_SECRET: process.env.JWT_SECRET,
    COOKIE_DOMAIN: process.env.COOKIE_DOMAIN,
  }
};

export default nextConfig;
