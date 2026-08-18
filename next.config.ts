import type { NextConfig } from "next";
import path from "path";

const isProd = process.env.NODE_ENV === "production";

const nextConfig: NextConfig = {
  output: "export",
  basePath: isProd ? "/Mightycgm-Utility" : "",
  trailingSlash: true,
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  webpack: (config) => {
    // Required for pdfjs-dist and onnxruntime-web
    config.resolve.alias = {
      ...config.resolve.alias,
      canvas: false,
      encoding: false,
      'onnxruntime-web/webgpu': path.resolve(__dirname, 'node_modules/onnxruntime-web/dist/ort.webgpu.min.js'),
      'onnxruntime-web': path.resolve(__dirname, 'node_modules/onnxruntime-web/dist/ort.min.js'),
    };
    // Handle WASM files
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      layers: true,
    };
    return config;
  },
};

export default nextConfig;
