import path from "node:path";
import { Config } from "@remotion/cli/config";

const appDir = path.resolve(process.cwd(), "../app");
const modulesDir = path.resolve(process.cwd(), "node_modules");

Config.setVideoImageFormat("jpeg");
Config.setJpegQuality(90);
Config.setConcurrency(4);

// アプリ本体（../app）のコンポーネントを `~/...` で import できるようにする。
// ../app 側のファイルが import する react なども video/node_modules から解決させる。
Config.overrideWebpackConfig((config) => ({
  ...config,
  resolve: {
    ...config.resolve,
    alias: {
      ...(config.resolve?.alias as Record<string, string>),
      "~": appDir,
    },
    modules: [modulesDir, "node_modules"],
  },
}));
