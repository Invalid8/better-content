import { defineConfig } from "vitepress";

export default defineConfig({
  title: "better-content",
  description:
    "Own-your-data, adapter-driven, framework-agnostic inline-edit CMS engine.",
  head: [["link", { rel: "icon", href: "/logo.svg", type: "image/svg+xml" }]],
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
