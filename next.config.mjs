/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: false,
    webpack: (config, { isServer, dev }) => {
        config.experiments = {
            ...config.experiments,
            asyncWebAssembly: true, // Enable WebAssembly in Webpack
            topLevelAwait: true,
        };

        // Aggressive memory optimization for production builds
        if (!dev) {
            config.optimization = {
                ...config.optimization,
                splitChunks: {
                    chunks: 'all',
                    maxSize: 150000, // Aggressively reduce chunk size to ~150KB
                    minSize: 20000,   // Minimum chunk size
                    cacheGroups: {
                        vendor: {
                            test: /[\\/]node_modules[\\/]/,
                            name: 'vendors',
                            chunks: 'all',
                            maxSize: 150000, // Limit chunk size to ~150KB
                            priority: 10,
                        },
                        common: {
                            minChunks: 2,
                            chunks: 'all',
                            name: 'common',
                            maxSize: 100000, // ~100KB for common chunks
                            priority: 5,
                        },
                        default: {
                            minChunks: 2,
                            chunks: 'all',
                            maxSize: 100000,
                            priority: 1,
                        },
                    },
                },
                // Enable module concatenation for smaller bundles
                concatenateModules: true,
                // Enable tree shaking
                usedExports: true,
                // Minimize memory usage during build
                minimize: true,
            };
            
            // Reduce memory pressure during compilation
            config.resolve.symlinks = false;
            config.resolve.cacheWithContext = false;
        }

        // For Web Workers, ensure proper file handling
        if (!isServer) {
            config.module.rules.push({
                test: /\.wasm$/,
                type: "asset/resource", // Adds WebAssembly files to the static assets
            });
        }
        return config;
    }
};

export default nextConfig;
