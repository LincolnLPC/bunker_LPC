import crypto from 'crypto'

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Permission Policy — явно разрешаем камеру и микрофон только для нашего origin
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Permissions-Policy',
            value: 'camera=(self), microphone=(self), geolocation=()',
          },
        ],
      },
    ]
  },

  // Оригинальный индикатор включён; скрываем при production_mode через DevIndicatorGate
  typescript: {
    ignoreBuildErrors: true,
  },
  
  // Оптимизация изображений
  images: {
    // Включить оптимизацию изображений Next.js (если используем Supabase Storage или внешние источники)
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },
  
  // Оптимизация bundle size (swcMinify удалён — в Next.js 16 по умолчанию)
  compress: true,
  
  // Оптимизация компиляции
  experimental: {
    optimizePackageImports: ['lucide-react', '@radix-ui/react-icons', 'date-fns', 'recharts'],
  },
  
  // Production оптимизации
  productionBrowserSourceMaps: false,
  
  // Оптимизация webpack
  webpack: (config, { isServer }) => {
    // Оптимизация для клиентской стороны
    if (!isServer) {
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          chunks: 'all',
          cacheGroups: {
            default: false,
            vendors: false,
            // Отдельный chunk для vendor библиотек
            framework: {
              name: 'framework',
              chunks: 'all',
              test: /(?<!node_modules.*)[\\/]node_modules[\\/](react|react-dom|scheduler|prop-types|use-subscription)[\\/]/,
              priority: 40,
              enforce: true,
            },
            // Отдельный chunk для UI библиотек
            lib: {
              test(module) {
                return module.size() > 160000 && /node_modules[/\\]/.test(module.identifier())
              },
              name(module) {
                const hash = crypto.createHash('sha1')
                hash.update(module.identifier())
                return hash.digest('hex').substring(0, 8)
              },
              priority: 30,
              minChunks: 1,
              reuseExistingChunk: true,
            },
            // Общий chunk для всех остальных node_modules
            commons: {
              name: 'commons',
              minChunks: 2,
              priority: 20,
            },
            // Отдельный chunk для shared модулей
            shared: {
              name: false,
              minChunks: 2,
              priority: 10,
              reuseExistingChunk: true,
            },
          },
        },
      }
    }
    
    return config
  },
}

export default nextConfig
