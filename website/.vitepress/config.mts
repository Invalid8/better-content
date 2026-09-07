import { defineConfig } from "vitepress";

const site = "https://better-content-docs.vercel.app";
const ogImage = `${site}/og.png`;
const description_ =
  "Own-your-data, adapter-driven, framework-agnostic inline-edit CMS engine.";

export default defineConfig({
  title: "better-content",
  cleanUrls: true,
  description: description_,
  head: [
    ["link", { rel: "icon", href: "/logo.svg", type: "image/svg+xml" }],
    ["meta", { property: "og:type", content: "website" }],
    ["meta", { property: "og:site_name", content: "better-content" }],
    ["meta", { property: "og:image", content: ogImage }],
    ["meta", { property: "og:image:width", content: "1200" }],
    ["meta", { property: "og:image:height", content: "630" }],
    [
      "meta",
      {
        property: "og:image:alt",
        content:
          "better-content: edit this page, watch your database change.",
      },
    ],
    ["meta", { name: "twitter:card", content: "summary_large_image" }],
    ["meta", { name: "twitter:image", content: ogImage }],
  ],

  transformPageData(pageData) {
    const pageTitle = pageData.frontmatter.title || pageData.title;
    const title = pageTitle
      ? `${pageTitle} | better-content`
      : "better-content";
    const description =
      pageData.frontmatter.description ||
      pageData.description ||
      description_;
    const url = `${site}/${pageData.relativePath.replace(/(index)?\.md$/, "")}`;

    pageData.frontmatter.head ??= [];
    pageData.frontmatter.head.push(
      ["meta", { property: "og:title", content: title }],
      ["meta", { property: "og:description", content: description }],
      ["meta", { property: "og:url", content: url }],
      ["meta", { name: "twitter:title", content: title }],
      ["meta", { name: "twitter:description", content: description }],
    );
  },
  themeConfig: {
    logo: "/logo.svg",
    nav: [
      { text: "Guide", link: "/guide/getting-started" },
      { text: "API", link: "/api/core" },
      {
        text: "Live demo",
        link: "https://better-content-playground.vercel.app",
      },
    ],
    sidebar: {
      "/guide/": [
        {
          text: "Guide",
          items: [
            { text: "Getting started", link: "/guide/getting-started" },
            { text: "How the engine works", link: "/guide/how-it-works" },
            { text: "The editing model", link: "/guide/editing-model" },
            { text: "React binding", link: "/guide/react-binding" },
            { text: "Svelte binding", link: "/guide/svelte-binding" },
            { text: "Vue binding", link: "/guide/vue-binding" },
            { text: "Transports", link: "/guide/transports" },
            { text: "Database adapters", link: "/guide/adapters" },
            { text: "Auth and the admin gate", link: "/guide/auth" },
            { text: "Image storage", link: "/guide/storage" },
            { text: "Devtools", link: "/guide/devtools" },
          ],
        },
      ],
      "/api/": [
        {
          text: "API reference",
          items: [
            { text: "better-content/core", link: "/api/core" },
            { text: "better-content/react", link: "/api/react" },
            { text: "better-content/svelte", link: "/api/svelte" },
            { text: "better-content/vue", link: "/api/vue" },
            { text: "better-content/server", link: "/api/server" },
            { text: "Adapters", link: "/api/adapters" },
            { text: "Storage", link: "/api/storage" },
            { text: "Auth", link: "/api/auth" },
            { text: "Devtools", link: "/api/devtools" },
          ],
        },
      ],
    },
    socialLinks: [
      { icon: "github", link: "https://github.com/Invalid8/better-content" },
      { icon: "npm", link: "https://www.npmjs.com/package/better-content" },
    ],
    search: { provider: "local" },
    footer: {
      message: "MIT. Independent project, not affiliated with the better-* family.",
    },
  },
});
