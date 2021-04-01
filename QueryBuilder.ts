import Relationship from "./Relationship.ts";
import type { ModelClass } from "./typings.ts";

type Mode = "SELECT" | "INSERT" | "UPDATE" | "DELETE";
type Where = Array<
  | {
      column: string;
      operator: Operator;
      value: string | number | string[] | number[];
    }
  | QueryBuilder
>;
type Order = Array<{ column: string; direction: "asc" | "desc" }>;
type QueryBuilderCallback = (instance: QueryBuilder) => void;
type Operator = "=" | "<>" | ">" | "<" | "LIKE" | "IN";
const where = ["abcd", "cdb"];

type WhereParams =
  | [QueryBuilderCallback]
  | [Record<string, string | number>]
  | [string, string | number]
  | [string, Operator, string | number];

type Limit = [number] | [number, number];

type WhereHas = { relationship: string; builder: QueryBuilder };

const esc = (s: string | number) => (typeof s === "number" ? s : `\`${s}\``);

export default class QueryBuilder {
  /** Whether it's a subquery, or part of a parent query */
  mode: Mode | undefined;
  context = {
    table: undefined as string | undefined,
    relationships: {} as Record<string, Relationship>,
  };
  parts = {
    columns: [] as string[],
    where: [] as Where,
    whereHas: [] as WhereHas[],
    orWhereHas: [] as WhereHas[],
    join: [] as Relationship[],
    or: [] as Where,
    order: [] as Order,
    insert: undefined as Record<string, string | number> | undefined,
    limit: undefined as Limit | undefined,
  };

  constructor(tableOrContext?: string | ModelClass) {
    if (typeof tableOrContext === "string") {
      this.context.table = tableOrContext;
    } else {
      this.context.table = tableOrContext?.table;
      this.context.relationships = tableOrContext?.relationships || {};
    }
  }

  private buildWhereFilter(filter: "where" | "or"): string {
    const separator = filter === "where" ? "AND" : "OR";
    return (
      this.parts[filter]
        .map((v) => {
          if (v instanceof QueryBuilder) {
            return `(${v.toString()})`;
          }
          const val = Array.isArray(v.value)
            ? `(${v.value.map(esc).join(", ")})`
            : esc(v.value);
          return `${esc(v.column)} ${v.operator} ${val}`;
        })
        .join(` ${separator} `) || ""
    );
  }

  private buildWhereHasFilter(filter: "whereHas" | "orWhereHas"): string {
    const separator = filter === "whereHas" ? "AND" : "OR";
    return (
      this.parts[filter]
        .map((v) => {
          if (v.relationship in (this.context.relationships || {})) {
            return `EXISTS (${v.builder.toString()})`;
          } else {
            throw new Error(`Unknown relationship '${v.relationship}'`);
          }
        })
        .join(` ${separator} `) || ""
    );
  }

  toString() {
    const {
      columns,
      or,
      where,
      whereHas,
      orWhereHas,
      order,
      limit,
      join,
      insert,
    } = this.parts;

    if (this.mode === "INSERT") {
      if (!insert) {
        throw new Error("No values found");
      }
      const columns = Object.keys(insert);
      const values = Object.values(insert);
      return `INSERT INTO ${this.context.table} (${columns
        .map(esc)
        .join(", ")}) VALUES (${values.map(esc).join(", ")})`;
    }

    const columnQuery = columns.join(", ") || "*";

    const whereQuery = (() => {
      // No mode = inline filter
      let built = this.mode ? " WHERE " : "";

      if (where.length > 0) {
        built += `${this.buildWhereFilter("where")}`;
      }

      if (whereHas.length > 0) {
        if (where.length > 0) {
          built += " AND ";
        }
        built += `${this.buildWhereHasFilter("whereHas")}`;
      }

      // Make sure we're filtering by "WHERE"
      if (where.length === 0 && whereHas.length === 0) {
        return "";
      }

      if (or.length > 0) {
        built += ` OR ${this.buildWhereFilter("or")}`;
      }

      if (orWhereHas.length > 0) {
        built += ` OR ${this.buildWhereHasFilter("orWhereHas")}`;
      }

      return built;
    })();

    const orderQuery =
      order.length > 0
        ? " ORDER BY " +
          order.map((o) => `${o.column} ${o.direction}`).join(", ")
        : "";

    const limitQuery = limit ? ` LIMIT ${limit.join(", ")}` : "";

    const joinQuery =
      join.length > 0
        ? join
            .map(
              (j) =>
                ` JOIN ${esc(j.foreignTable)} ON ${esc(j.localTable)}.${esc(
                  j.localKey
                )} = ${esc(j.foreignTable)}.${esc(j.foreignKey)}`
            )
            .join(", ")
        : "";

    if (this.mode === "SELECT") {
      return `${this.mode} ${columnQuery} FROM ${this.context.table}${joinQuery}${whereQuery}${orderQuery}${limitQuery}`;
    } else if (!this.mode) {
      return `${whereQuery}`;
    }
    throw new Error("Not implemented");
  }

  select(...columns: string[]) {
    this.parts.columns.push(...columns);
    return this;
  }

  static select(...columns: string[]) {
    const builder = new QueryBuilder(this as ModelClass);
    builder.mode = "SELECT";
    builder.parts.columns = columns;
    return builder;
  }

  static create(values: Record<string, string | number>) {
    const builder = new QueryBuilder(this as ModelClass);
    builder.mode = "INSERT";
    builder.parts.insert = values;
    return builder;
  }

  private createBuilder() {
    return new QueryBuilder(this.context);
  }

  _applyFilter(operation: "where" | "or", ...paramsOrCallback: WhereParams) {
    if (typeof paramsOrCallback[0] === "function") {
      const builder = this.createBuilder();
      paramsOrCallback[0](builder);
      this.parts[operation].push(builder);
    } else if (typeof paramsOrCallback[0] === "object") {
      // { column: value }
      const values = paramsOrCallback[0];
      for (const key in values) {
        this.parts.where.push({
          column: key,
          operator: "=",
          value: values[key],
        });
      }
    } else {
      const [column, operator, value] = ((): [
        string,
        Operator,
        string | number
      ] => {
        if (paramsOrCallback.length === 3) {
          return paramsOrCallback;
        }
        return [
          paramsOrCallback[0],
          "=",
          paramsOrCallback[1] as string | number,
        ];
      })();
      this.parts[operation].push({ column, operator, value });
    }
    return this;
  }

  where(...paramsOrCallback: WhereParams) {
    return this._applyFilter("where", ...paramsOrCallback);
  }

  orWhere(...paramsOrCallback: WhereParams) {
    return this._applyFilter("or", ...paramsOrCallback);
  }

  whereHas(relationship: string, callback: QueryBuilderCallback) {
    const builder = this.createBuilder();
    builder.mode = "SELECT";

    if (relationship in this.context.relationships) {
      const v = this.context.relationships[relationship];
      builder.parts.columns.push(`${v.foreignTable}.*`);
      builder.parts.join.push(v);
    }
    callback(builder);
    this.parts.whereHas.push({ relationship, builder });
    return this;
  }

  orWhereHas(relationship: string, callback: QueryBuilderCallback) {
    const builder = this.createBuilder();
    builder.mode = "SELECT";
    if (relationship in this.context.relationships) {
      const v = this.context.relationships[relationship];
      builder.parts.columns.push(`${v.foreignTable}.*`);
      builder.parts.join.push(v);
    }
    callback(builder);
    this.parts.orWhereHas.push({ relationship, builder });
    return this;
  }

  _applyFilterIn(
    operation: "where" | "or",
    column: string,
    value: string[] | number[]
  ) {
    this.parts[operation].push({ column, operator: "IN", value });
    return this;
  }

  whereIn(column: string, value: string[] | number[]) {
    return this._applyFilterIn("where", column, value);
  }

  orWhereIn(column: string, value: string[] | number[]) {
    return this._applyFilterIn("or", column, value);
  }

  orderBy(...order: Order | [string] | [string, "asc" | "desc"]) {
    if (typeof order[0] === "string") {
      const [column, direction = "asc"] = order as
        | [string]
        | [string, "asc" | "desc"];
      this.parts.order.push({ column, direction });
    } else {
      this.parts.order.push(...(order as Order));
    }
    return this;
  }

  when(condition: boolean, cb: QueryBuilderCallback) {
    if (condition) {
      const builder = this.createBuilder();
      cb(builder);
      this.parts.columns.push(...builder.parts.columns);
      for (const k of ["where", "or"]) {
        if (builder.parts[k as "where" | "or"].length > 0) {
          this.parts[k as "where" | "or"].push(builder);
        }
      }
      this.parts.order.push(...builder.parts.order);
      if (builder.parts.limit) {
        this.parts.limit = builder.parts.limit;
      }
    }
    return this;
  }

  limit(...n: Limit) {
    this.parts.limit = n;
    return this;
  }
}
