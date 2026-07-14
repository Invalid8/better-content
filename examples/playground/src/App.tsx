import { useEffect, useMemo, useState } from "react";
import {
  adapterTransport,
  inMemoryTransport,
  type ClientStorageAdapter,
  type DataAdapter,
  type ItemMap,
  type Transport,
} from "better-content/core";
import { loadItemMap } from "better-content/server";
import {
  AnonymousEditProvider,
  PageProvider,
  useCmsAuth,
  usePageContext,
} from "better-content/react";
import { DEMO_ITEMS, readCachedItems, writeCachedItems } from "./demoContent";
import { Toolbar } from "./Toolbar";
import { Hero } from "./Hero";
import { Notes } from "./Notes";
import { DataInspector } from "./DataInspector";
import { Footer } from "./Footer";

type DbRuntime = {
  adapter: DataAdapter;
  resetDemo: () => Promise<void>;
};

const dataUrlStorage: ClientStorageAdapter = {
  upload: (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve({ url: reader.result as string });
      reader.onerror = () => reject(new Error("Could not read file"));
      reader.readAsDataURL(file);
    }),
};

function CacheCommittedItems({ enabled }: { enabled: boolean }) {
  const { hasUnsavedChanges, items, saving } = usePageContext();

  useEffect(() => {
    if (enabled && !saving && !hasUnsavedChanges) {
      writeCachedItems(items);
    }
  }, [enabled, hasUnsavedChanges, items, saving]);

  return null;
}

function Page({
  initialItems,
  transport,
  dbRuntime,
  databaseStatus,
}: {
  initialItems: ItemMap;
  transport: Transport;
  dbRuntime: DbRuntime | null;
  databaseStatus: string;
}) {
  const [status, setStatus] = useState("");
  const { isEditing } = useCmsAuth();
  const dbReady = Boolean(dbRuntime);

  return (
    <PageProvider
      key={dbReady ? "database" : "preview"}
      transport={transport}
      storage={dataUrlStorage}
      initialItems={initialItems}
      notify={{ success: setStatus, error: setStatus }}
    >
      <div className={isEditing ? "page editing-on" : "page"}>
        <CacheCommittedItems enabled={dbReady} />
        <Toolbar status={status || databaseStatus} disabled={!dbReady} />
        <main>
          <Hero databaseReady={dbReady} />
          <Notes />
        </main>
        <Footer resetDemo={dbRuntime?.resetDemo} />
        {dbRuntime && <DataInspector adapter={dbRuntime.adapter} />}
      </div>
    </PageProvider>
  );
}

export default function App() {
  const [initialItems, setInitialItems] = useState<ItemMap>(
    () => readCachedItems() ?? DEMO_ITEMS,
  );
  const [dbRuntime, setDbRuntime] = useState<DbRuntime | null>(null);
  const [databaseStatus, setDatabaseStatus] = useState("Loading database...");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error("database took too long to start")),
        20000,
      ),
    );
    Promise.race([
      import("./db").then(async (db) => {
        await db.initDb();
        const items = await loadItemMap(db.adapter, {
          sections: {},
          cards: {
            query: { orderBy: [{ field: "order", direction: "asc" }] },
          },
        });
        return { adapter: db.adapter, resetDemo: db.resetDemo, items };
      }),
      timeout,
    ])
      .then(({ adapter, resetDemo, items }) => {
        if (cancelled) return;
        writeCachedItems(items);
        setInitialItems(items);
        setDbRuntime({ adapter, resetDemo });
        setDatabaseStatus("Database ready");
      })
      .catch((e: Error) => {
        if (!cancelled) {
          setError(e.message);
          setDatabaseStatus("Database unavailable");
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const transport = useMemo(
    () =>
      dbRuntime
        ? adapterTransport(dbRuntime.adapter)
        : inMemoryTransport(initialItems),
    [dbRuntime, initialItems],
  );

  return (
    <AnonymousEditProvider>
      <Page
        initialItems={initialItems}
        transport={transport}
        dbRuntime={dbRuntime}
        databaseStatus={error || databaseStatus}
      />
    </AnonymousEditProvider>
  );
}
