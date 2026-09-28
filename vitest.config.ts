import { defineConfig } from "vitest/config";

// ゲームロジック・ルームロジックは純粋関数なので、Cloudflare プラグインなしの Node 環境でテストする
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    include: ["app/**/*.test.ts"],
    environment: "node",
  },
});
