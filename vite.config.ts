import { cloudflare } from "@cloudflare/vite-plugin";
import { reactRouter } from "@react-router/dev/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [cloudflare({ viteEnvironment: { name: "ssr" } }), reactRouter()],
  resolve: {
    tsconfigPaths: true,
  },
  server: {
    // コンテナ外（ホストのブラウザ）からアクセスできるようにする
    host: "0.0.0.0",
    port: 8787,
    strictPort: true,
    allowedHosts: ["erimo.tail3b13b1.ts.net"]
  },
});
