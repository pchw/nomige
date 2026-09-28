import type { RouteConfig } from "@react-router/dev/routes";
import { flatRoutes } from "@react-router/fs-routes";

// app/routes 以下のファイル構造がそのまま URL になる（flat routes）
export default flatRoutes() satisfies RouteConfig;
