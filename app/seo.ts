import type { MetaDescriptor } from "react-router";

export const SITE_NAME = "NOMIGE";
export const SITE_DESCRIPTION = "3〜10人で遊べる飲みゲー。スマホでもタブレット1台でも。";

/** root の loader が返すサイトの origin を取り出す（OGP の URL は絶対パスでないと読まれない） */
export function siteOrigin(
  matches: ReadonlyArray<{ id: string; loaderData: unknown } | undefined>,
) {
  const data = matches.find((m) => m?.id === "root")?.loaderData as { origin?: string } | undefined;
  return data?.origin ?? "";
}

/** X（Twitter）や Discord などでリンクを貼ったときのプレビュー用 meta */
export function pageMeta({
  origin,
  path,
  title,
  description = SITE_DESCRIPTION,
}: {
  origin: string;
  path: string;
  title: string;
  description?: string;
}): MetaDescriptor[] {
  const url = `${origin}${path}`;
  const image = `${origin}/og.png`;
  return [
    { title },
    { name: "description", content: description },
    { property: "og:type", content: "website" },
    { property: "og:site_name", content: SITE_NAME },
    { property: "og:locale", content: "ja_JP" },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:url", content: url },
    { property: "og:image", content: image },
    { property: "og:image:width", content: "1200" },
    { property: "og:image:height", content: "630" },
    { property: "og:image:alt", content: "NOMIGE — 3〜10人で遊べる飲みゲー" },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: description },
    { name: "twitter:image", content: image },
  ];
}
