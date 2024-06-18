/** @type {import('next').NextConfig} */

const nextConfig = {
  distDir: "dist",
  output: "export",
  reactStrictMode: true,
  webpack: (config, { isServer, nextRuntime, dev }) => {
    // Fixes npm packages that depend on `fs` module
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback, // if you miss it, all the other options in fallback, specified
        // by next.js will be dropped. Doesn't make much sense, but how it is
        // fs: false, // the solution
        // module: false,
        perf_hooks: false,
      };
    }

    config.resolve.alias = {
      ...config.resolve.alias,
      sharp$: false,
      "onnxruntime-node$": false,
    };

    return config;
  },
};
export default nextConfig;
