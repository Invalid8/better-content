import {
  BETTER_CONTENT,
  authModule,
  databaseDeps,
  dataModule,
  envExample,
  readme,
  schemaModule,
  schemaSql,
  styleKit,
} from "../shared.js";
import { npx } from "../run.js";

export const meta = {
  value: "next",
  label: "Next.js",
  hint: "React, App Router",
  tailwind: true,
};

// We pin the layout flags rather than detecting the output afterwards, so
// there is exactly one place our files can land.
export function scaffold(directory, { tailwind }) {
  return npx([
    "create-next-app@latest",
    directory,
    "--ts",
    "--app",
    "--src-dir",
    tailwind ? "--tailwind" : "--no-tailwind",
    "--eslint",
    "--import-alias",
    "@/*",
    "--use-npm",
    "--skip-install",
    "--no-turbopack",
    "--yes",
  ]);
}

export const globalCss = "src/app/globals.css";

export function dependencies({ database }) {
  const db = databaseDeps(database);
  return {
    deps: { "better-content": BETTER_CONTENT, ...db.deps },
    devDeps: db.devDeps,
  };
}

const layout = {
  dataPath: "src/lib/data.ts",
  authPath: "src/lib/auth.ts",
  schemaPath: "`src/lib/schema.ts`",
  routePath: "src/app/api/admin/[collection]/[id]/route.ts",
  pagePath: "src/app/page.tsx",
  componentPath: "src/components/Editable.tsx",
};

const bindingNote = `\`src/components/Editable.tsx\` is a client component using \`ContentEditSpan\`,
which reads edit mode from context and commits drafts on blur. The page stays
a server component: it loads the content and hands it down as a snapshot.`;

export function files(answers) {
  const { database, auth, name, tailwind } = answers;
  const { classes } = styleKit(tailwind);

  const out = {
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

    "src/lib/data.ts": dataModule(answers),
    "src/lib/auth.ts": authModule(answers),
    "src/lib/cms.ts": `import {
  createCmsEngine,
  restTransport,
  type CmsEngine,
  type ItemMap,
} from "better-content/core";

export function createEngine(initialItems: ItemMap): CmsEngine {
  return createCmsEngine({
    transport: restTransport({ apiBasePath: "/api/admin" }),
    initialItems,
  });
}
`,

    "src/app/page.tsx": `import { loadItemMap } from "better-content/server";
import Editable from "@/components/Editable";
import { data } from "@/lib/data";

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
    <main className="${classes.main}">
      <Editable initialItems={initialItems} />
${auth === "token" ? `      <a className="${classes.link}" href="/admin">admin sign in</a>\n` : ""}    </main>
  );
}
`,

    "src/app/api/admin/[collection]/[id]/route.ts": `import { createCmsHandlers } from "better-content/server";
import { auth } from "@/lib/auth";
import { data } from "@/lib/data";

// A Next route handler is (Request, { params }) with params as a promise,
// which is exactly what createCmsHandlers returns.
export const { GET, PUT, PATCH, DELETE } = createCmsHandlers({ data, auth });
`,

    "src/components/Editable.tsx": `"use client";

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
    <article className="${classes.page}">
      <ContentEditSpan
        as="h1"
        className="${classes.h1}"
        collection="sections"
        itemId="hero"
        fieldKey="heading"
      />
      <ContentEditSpan
        as="p"
        className="${classes.p}"
        collection="sections"
        itemId="hero"
        fieldKey="tagline"
      />

      <div className="${classes.bar}">
        <button
          className="${classes.button}"
          onClick={toggleEdit}
          aria-pressed={isEditing}
        >
          {isEditing ? "Done" : "Edit"}
        </button>
        <button
          className="${classes.button}"
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
    out["src/lib/schema.ts"] = schemaModule();
    out["schema.sql"] = schemaSql();
  }

  if (auth === "token") {
    out["src/app/api/login/route.ts"] = `import { cookies } from "next/headers";
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

    out["src/app/admin/page.tsx"] = `export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="${classes.main}">
      <form className="${classes.page}" method="POST" action="/api/login">
        <h1 className="${classes.h1}">Admin sign in</h1>
        <p className="${classes.p}">
          Enter the value of <code>ADMIN_TOKEN</code> to enable saving. Without
          it you can still toggle edit mode and type, but writes are rejected.
        </p>
        {error && <p className="${classes.error}">That token did not match.</p>}
        <input
          className="${classes.input}"
          type="password"
          name="token"
          placeholder="admin token"
          autoComplete="current-password"
          required
        />
        <div className="${classes.bar}">
          <button className="${classes.button}" type="submit">Sign in</button>
        </div>
      </form>
    </main>
  );
}
`;
  }

  return out;
}
