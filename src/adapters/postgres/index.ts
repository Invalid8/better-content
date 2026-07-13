import {
  and,
  asc,
  desc,
  eq,
  gt,
  gte,
  ilike,
  inArray,
  lt,
  lte,
  ne,
  notInArray,
  or,
  type Column,
  type SQL,
} from "drizzle-orm";
import type { IndexColumn, PgDatabase, PgTable } from "drizzle-orm/pg-core";
import {
  isFilterGroup,
  type DataAdapter,
  type Query,
  type QueryCondition,
  type QueryFilter,
} from "better-content/core";
import type { Pool } from "pg";

type DrizzleDb = PgDatabase<never, never>;

export interface PostgresAdapterConfig {
  db?: DrizzleDb;
  pool?: Pool;
  connectionString?: string;
  schema: Record<string, PgTable>;
}

export class PostgresDataAdapter implements DataAdapter {
  private db: DrizzleDb | undefined;
  private readonly pool: Pool | undefined;
  private readonly connectionString: string | undefined;
  private readonly schema: Record<string, PgTable>;

  constructor(config: PostgresAdapterConfig) {
    if (!config?.schema) {
      throw new Error(
        "PostgresDataAdapter requires a `schema` (your Drizzle tables keyed by collection name).",
      );
    }
    if (!config.db && !config.pool && !config.connectionString) {
      throw new Error(
        "PostgresDataAdapter requires one of `db`, `pool`, or `connectionString`.",
      );
    }
    this.schema = config.schema;
    this.db = config.db;
    this.pool = config.pool;
    this.connectionString = config.connectionString;
  }

  private async getDb(): Promise<DrizzleDb> {
    if (this.db) return this.db;
    const { drizzle } = await import("drizzle-orm/node-postgres");
    const pool =
      this.pool ??
      new (await import("pg")).default.Pool({
        connectionString: this.connectionString,
      });
    this.db = drizzle(pool, { schema: this.schema }) as unknown as DrizzleDb;
    return this.db;
  }

  private table(collection: string): PgTable {
    const t = this.schema[collection];
    if (!t) {
      throw new Error(
        `Collection "${collection}" is not registered. Add its table to the adapter's \`schema\`.`,
      );
    }
    return t;
  }

  private col(table: PgTable, field: string): Column {
    const column = (table as unknown as Record<string, Column>)[field];
    if (!column) {
      throw new Error(
        `Unknown field "${field}" — declare it as a column on the collection's table.`,
      );
    }
    return column;
  }

  private toRow(
    table: PgTable,
    data: Record<string, unknown>,
    id?: string,
  ): Record<string, unknown> {
    const row: Record<string, unknown> = {};
    if (id !== undefined) row.id = id;
    for (const [key, value] of Object.entries(data)) {
      if (key === "id" || key === "collection") continue;
      this.col(table, key);
      row[key] = value;
    }
    return row;
  }

  private fromRow(
    collection: string,
    row: Record<string, unknown>,
  ): Record<string, unknown> {
    const { createdAt, updatedAt, ...rest } = row;
    void createdAt;
    void updatedAt;
    return { collection, ...rest };
  }

  private renderFilter(table: PgTable, f: QueryFilter): SQL | undefined {
    const column = this.col(table, f.field);
    switch (f.op) {
      case "eq":
        return eq(column, f.value);
      case "ne":
        return ne(column, f.value);
      case "lt":
        return lt(column, f.value);
      case "lte":
        return lte(column, f.value);
      case "gt":
        return gt(column, f.value);
      case "gte":
        return gte(column, f.value);
      case "in":
        return inArray(column, f.value as unknown[]);
      case "nin":
        return notInArray(column, f.value as unknown[]);
      case "contains":
        return ilike(column, `%${String(f.value)}%`);
      default:
        throw new Error(`Unsupported query op: ${String(f.op)}`);
    }
  }

  private renderCondition(table: PgTable, c: QueryCondition): SQL | undefined {
    if (isFilterGroup(c)) {
      return c.or.length
        ? or(...c.or.map((f) => this.renderFilter(table, f)))
        : undefined;
    }
    return this.renderFilter(table, c);
  }

  private buildWhere(table: PgTable, q?: Query): SQL | undefined {
    const conds = (q?.filters ?? []).map((c) => this.renderCondition(table, c));
    return conds.length ? and(...conds) : undefined;
  }

  private buildOrder(table: PgTable, q?: Query): SQL[] {
    const explicit = (q?.orderBy ?? []).map((o) =>
      o.direction === "asc"
        ? asc(this.col(table, o.field))
        : desc(this.col(table, o.field)),
    );
    if (explicit.length) return explicit;
    const createdAt = (table as unknown as Record<string, Column>).createdAt;
    return createdAt ? [desc(createdAt)] : [];
  }

  async fetchById<T = Record<string, unknown>>(
    collection: string,
    id: string,
  ): Promise<(T & { id: string }) | null> {
    const table = this.table(collection);
    const db = await this.getDb();
    const rows = await db
      .select()
      .from(table)
      .where(eq(this.col(table, "id"), id))
      .limit(1);
    return rows[0]
      ? (this.fromRow(collection, rows[0]) as unknown as T & { id: string })
      : null;
  }

  async fetchCollection<T = Record<string, unknown>>(
    collection: string,
    q?: Query,
  ): Promise<(T & { id: string })[]> {
    const table = this.table(collection);
    const db = await this.getDb();
    let query = db.select().from(table).$dynamic();

    const where = this.buildWhere(table, q);
    if (where) query = query.where(where);

    const order = this.buildOrder(table, q);
    if (order.length) query = query.orderBy(...order);

    if (q?.limit != null) query = query.limit(q.limit);
    if (q?.offset != null) query = query.offset(q.offset);

    const rows = await query;
    return rows.map(
      (r) => this.fromRow(collection, r) as unknown as T & { id: string },
    );
  }

  async create<T = Record<string, unknown>>(
    collection: string,
    data: T,
  ): Promise<T & { id: string }> {
    const id =
      globalThis.crypto?.randomUUID?.() ?? `${collection}-${Date.now()}`;
    return this.createWithId(collection, id, data);
  }

  async createWithId<T = Record<string, unknown>>(
    collection: string,
    id: string,
    data: T,
  ): Promise<T & { id: string }> {
    const table = this.table(collection);
    const row = this.toRow(table, data as Record<string, unknown>, id);
    const db = await this.getDb();
    await db.insert(table).values(row);
    return { id, ...(data as T) };
  }

  async update<T = Record<string, unknown>>(
    collection: string,
    id: string,
    data: Partial<T>,
  ): Promise<void> {
    const table = this.table(collection);
    const row = this.toRow(table, data as Record<string, unknown>);
    row.updatedAt = new Date();
    const db = await this.getDb();
    await db.update(table).set(row).where(eq(this.col(table, "id"), id));
  }

  async upsert<T = Record<string, unknown>>(
    collection: string,
    id: string,
    data: Partial<T>,
  ): Promise<void> {
    const table = this.table(collection);
    const insertRow = this.toRow(table, data as Record<string, unknown>, id);
    const updateRow = this.toRow(table, data as Record<string, unknown>);
    updateRow.updatedAt = new Date();
    const db = await this.getDb();
    await db
      .insert(table)
      .values(insertRow)
      .onConflictDoUpdate({
        target: this.col(table, "id") as unknown as IndexColumn,
        set: updateRow,
      });
  }

  async delete(collection: string, id: string): Promise<void> {
    const table = this.table(collection);
    const db = await this.getDb();
    await db.delete(table).where(eq(this.col(table, "id"), id));
  }
}
