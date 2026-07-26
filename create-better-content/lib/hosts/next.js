import {
  BETTER_CONTENT,
  authModule,
  databaseDeps,
  dataModule,
  envExample,
  gitignore,
  readme,
  schemaModule,
  schemaSql,
  sorted,
  styles,
} from "../shared.js";

export const meta = {
  value: "next",
  label: "Next.js",
  hint: "React, App Router",
  binding: "react",
};

const layout = {
  dataPath: "lib/data.ts",
  authPath: "lib/auth.ts",
  schemaPath: "`lib/schema.ts`",
  routePath: "app/api/admin/[collection]/[id]/route.ts",
  pagePath: "app/page.tsx",
  componentPath: "components/Editable.tsx",
};

const bindingNote = `\`components/Editable.tsx\` is a client component using \`ContentEditSpan\`,
which reads edit mode from context and commits drafts on blur.
\`EditableImage\` and \`useMarkdownEditor\` come from the same import when you
need them. The page itself stays a server component: it loads the content and
hands it down as a plain snapshot.`;

export function files(answers) {
  const { database, auth, name } = answers;

  const deps = {
    "better-content": BETTER_CONTENT,
    next: "^16.2.12",
    react: "^19.2.7",
    "react-dom": "^19.2.7",
  };
  const devDeps = {
    "@types/node": "^22.10.2",
    "@types/react": "^19.2.17",
    "@types/react-dom": "^19.2.3",
    typescript: "^5.9.3",
  };
  const db = databaseDeps(database);
  Object.assign(deps, db.deps);
  Object.assign(devDeps, db.devDeps);

  const out = {
    "package.json": `${JSON.stringify(
      {
        name,
        private: true,
        scripts: {
          dev: "next dev",
          build: "next build",
          start: "next start",
        },
        dependencies: sorted(deps),
        devDependencies: sorted(devDeps),
      },
      null,
      2,
    )}\n`,

    "next.config.mjs": `/** @type {import("next").NextConfig} */
export default {
  // The database drivers are server-only. Keeping them external stops the
  // bundler from trying to trace them into the client build.
  serverExternalPackages: ["pg", "firebase-admin"],
};
`,

    "tsconfig.json": `${JSON.stringify(
      {
        compilerOptions: {
          target: "ES2022",
          lib: ["dom", "dom.iterable", "esnext"],
          allowJs: true,
          skipLibCheck: true,
          strict: true,
          noEmit: true,
          esModuleInterop: true,
          module: "esnext",
          moduleResolution: "bundler",
          resolveJsonModule: true,
          isolatedModules: true,
          jsx: "preserve",
          incremental: true,
          plugins: [{ name: "next" }],
          paths: { "@/*": ["./*"] },
        },
        include: ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
        exclude: ["node_modules"],
      },
      null,
      2,
    )}\n`,

    ".gitignore": gitignore([".next/", "next-env.d.ts", "out/"]),
    ".env.example": envExample(answers),
    "README.md": readme({
      host: { label: "Next.js", bindingNote },
      database,
      auth,
      name,
      layout,
      deploy: `\`\`\`sh
npm run build
npm start
\`\`\`

Set the same environment variables in your host. Vercel, or anywhere that
runs a Node server, needs no further configuration.`,
    }),

    "lib/data.ts": dataModule(answers),
    "lib/auth.ts": authModule(answers),
    "lib/cms.ts": `import {
  createCmsEngine,
  restTransport,
  type CmsEngine,
  type ItemMap,
} from "better-content/core";

// The engine is framework-free: it holds the content, buffers edits, and
// talks to the route handlers under /api/admin.
export function createEngine(initialItems: ItemMap): CmsEngine {
  return createCmsEngine({
    transport: restTransport({ apiBasePath: "/api/admin" }),
    initialItems,
  });
}
`,

    "app/globals.css": styles(),

    "app/layout.tsx": `import type { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  title: "better-content starter",
  description: "Inline editing wired to your own database.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
`,

    "app/page.tsx": `import { loadItemMap } from "better-content/server";
import Editable from "@/components/Editable";
import { data } from "@/lib/data";

// Content is read on the server and handed to the client component as a
// snapshot, so the first paint already has real text in it. The defaults only
// apply when the row is missing, which makes a fresh database render sensibly.
export const dynamic = "force-dynamic";

export default async function Home() {
  const initialItems = await loadItemMap(data, {
    sections: {
      defaults: [
        {
          id: "hero",
          heading: "Edit this heading",
          tagline:
            "And this tagline. Both are columns on a row in your own database.",
        },
      ],
      merge: "byId",
    },
  });

  return (
    <main>
      <Editable initialItems={initialItems} />
${auth === "token" ? `      <a className="admin-link" href="/admin">admin sign in</a>\n` : ""}    </main>
  );
}
`,

    "app/api/admin/[collection]/[id]/route.ts": `import { createCmsHandlers } from "better-content/server";
import { auth } from "@/lib/auth";
import { data } from "@/lib/data";

// A Next route handler is (Request, { params }) with params as a promise,
// which is exactly what createCmsHandlers returns. Nothing to adapt.
export const { GET, PUT, PATCH, DELETE } = createCmsHandlers({ data, auth });
`,

    "components/Editable.tsx": `"use client";

import { useState } from "react";
import type { ItemMap } from "better-content/core";
import {
  AnonymousEditProvider,
  ContentEditSpan,
  PageProvider,
  useCmsAuth,
  usePageContext,
} from "better-content/react";
import { createEngine } from "@/lib/cms";

function Editor() {
  const { isEditing, toggleEdit } = useCmsAuth();
  const { hasUnsavedChanges, saving, saveAll } = usePageContext();

  return (
    <article className="page">
      <ContentEditSpan
        as="h1"
        collection="sections"
        itemId="hero"
        fieldKey="heading"
      />
      <ContentEditSpan
        as="p"
        collection="sections"
        itemId="hero"
        fieldKey="tagline"
      />

      <div className="bar">
        <button onClick={toggleEdit} aria-pressed={isEditing}>
          {isEditing ? "Done" : "Edit"}
        </button>
        <button
          onClick={() => void saveAll()}
          disabled={!hasUnsavedChanges || saving}
        >
          {saving ? "Saving" : "Save"}
        </button>
      </div>
    </article>
  );
}

export default function Editable({ initialItems }: { initialItems: ItemMap }) {
  const [engine] = useState(() => createEngine(initialItems));

  return (
    <AnonymousEditProvider>
      <PageProvider engine={engine}>
        <Editor />
      </PageProvider>
    </AnonymousEditProvider>
  );
}
`,
  };

  if (database === "postgres") {
    out["lib/schema.ts"] = schemaModule();
    out["schema.sql"] = schemaSql();
  }

  if (auth === "token") {
    out["app/api/login/route.ts"] = `import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyToken } from "@/lib/auth";

export async function POST(request: Request) {
  const form = await request.formData();
  const token = String(form.get("token") ?? "");

  if (!verifyToken(token)) {
    return NextResponse.redirect(new URL("/admin?error=1", request.url), 303);
  }

  const jar = await cookies();
  jar.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });

  return NextResponse.redirect(new URL("/", request.url), 303);
}
`;

    out["app/admin/page.tsx"] = `export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main>
      <form className="page" method="POST" action="/api/login">
        <h1>Admin sign in</h1>
        <p>
          Enter the value of <code>ADMIN_TOKEN</code> to enable saving. Without
          it you can still toggle edit mode and type, but writes are rejected.
        </p>
        {error && <p className="error">That token did not match.</p>}
        <input
          type="password"
          name="token"
          placeholder="admin token"
          autoComplete="current-password"
          required
        />
        <div className="bar">
          <button type="submit">Sign in</button>
        </div>
      </form>
    </main>
  );
}
`;
  }

  return out;
}
