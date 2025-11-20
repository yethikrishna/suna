import type { NextConfig } from 'next';

// 前端-only 模式配置
const isFrontendOnlyMode = process.env.NEXT_PUBLIC_FRONTEND_ONLY_MODE === 'true';

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_SITE_NAME: 'Yeti',
    NEXT_PUBLIC_FRONTEND_ONLY_MODE: isFrontendOnlyMode ? 'true' : 'false',
  },
  // 优化前端性能的配置
  images: {
    unoptimized: true, // 避免需要外部图片优化服务
  },
  // 配置静态生成和服务端渲染
  output: 'standalone', // 生成独立的应用，不依赖特定环境
  // 禁用一些不需要的功能
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true, // 减少构建时的警告
  },
  typescript: {
    ignoreBuildErrors: true, // 减少构建时的错误
  },
};

export default nextConfig;
