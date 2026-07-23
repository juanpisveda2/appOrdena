"use strict";
var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m, _n, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _A, _B, _C, _D, _E, _F, _G, _H, _I, _J, _K, _L, _M, _N, _O, _P, _Q, _R, _S, _T, _U, _V, _W, _X, _Y, _Z, __, _$, _aa, _ba, _ca, _da, _ea, _fa, _ga, _ha, _ia, _ja, _ka, _la, _ma, _na, _oa, _pa, _qa, _ra, _sa, _ta, _ua, _va, _wa, _xa, _ya, _za, _Aa, _Ba, _Ca, _Da, _Ea, _Fa, _Ga, _Ha, _Ia, _Ja, _Ka, _La, _Ma, _Na, _Oa, _Pa, _Qa, _Ra, _Sa, _Ta, _Ua, _Va, _Wa, _Xa, _Ya, _Za, __a, _$a, _ab, _bb, _cb, _db, _eb, _fb, _gb, _hb, _ib, _jb, _kb, _lb, _mb, _nb, _ob, _pb, _qb, _rb, _sb, _tb, _ub, _vb, _wb, _xb, _yb, _zb, _Ab, _Bb, _Cb, _Db, _Eb, _Fb, _Gb, _Hb, _Ib, _Jb, _Kb, _Lb, _Mb, _Nb, _Ob, _Pb, _Qb, _Rb, _Sb, _Tb, _Ub, _Vb, _Wb, _Xb, _Yb, _Zb, __b, _$b, _ac, _bc, _cc, _dc, _ec, _fc, _gc, _hc, _ic, _jc;
const electron = require("electron");
const zod = require("zod");
const drizzleOrm = require("drizzle-orm");
const node_fs = require("node:fs");
const node_path = require("node:path");
const exceljs = require("exceljs");
const Client = require("better-sqlite3");
const APP_HEALTH_CHANNEL = "app:health";
const CATALOG_LIST_CHANNEL = "catalog:list";
const CATALOG_PRODUCT_DETAIL_CHANNEL = "catalog:product-detail";
const CATALOG_SEARCH_CHANNEL = "catalog:search";
const CATALOG_UPDATE_PRODUCT_CHANNEL = "catalog:update-product";
const CATALOG_DELETE_PRODUCT_CHANNEL = "catalog:delete-product";
const STOCK_SAVE_INTAKE_CHANNEL = "stock:save-intake";
const SALES_HISTORY_LIST_CHANNEL = "sales:list-history";
const SALES_DETAIL_CHANNEL = "sales:get-detail";
const SALES_CONFIRM_DRAFT_CHANNEL = "sales:confirm-draft";
const SALES_REGISTER_PAYMENT_CHANNEL = "sales:register-payment";
const SALES_CANCEL_PAYMENT_CHANNEL = "sales:cancel-payment";
const SALES_ASSIGN_CUSTOMER_FOR_PAYMENT_RECOVERY_CHANNEL = "sales:assign-customer-for-payment-recovery";
const SALES_CANCEL_CHANNEL = "sales:cancel";
const CONSIGNMENTS_PENDING_LIST_CHANNEL = "consignments:list-pending";
const CONSIGNMENTS_CONFIRM_BATCH_CHANNEL = "consignments:confirm-batch";
const CONSIGNMENTS_HISTORY_LIST_CHANNEL = "consignments:list-history";
const CONSIGNMENTS_DETAIL_CHANNEL = "consignments:get-detail";
const CONSIGNMENTS_EXPORT_EXCEL_CHANNEL = "consignments:export-excel";
const appHealthRequestSchema = zod.z.object({
  ping: zod.z.literal("foundation")
}).strict();
zod.z.object({
  ok: zod.z.literal(true),
  appVersion: zod.z.string().min(1),
  runtime: zod.z.literal("desktop-foundation"),
  dbReady: zod.z.boolean(),
  schemaVersion: zod.z.number().int().nonnegative()
}).strict();
function createAppHealthChannel({
  getAppVersion,
  bootstrapState
}) {
  return {
    channel: APP_HEALTH_CHANNEL,
    requestSchema: appHealthRequestSchema,
    handle: () => ({
      ok: true,
      appVersion: getAppVersion(),
      runtime: "desktop-foundation",
      dbReady: bootstrapState.dbReady,
      schemaVersion: bootstrapState.schemaVersion
    })
  };
}
const REUSABLE_PRODUCT_CATEGORIES = ["jewelry", "mate", "clothing"];
const CATALOG_CATEGORY_FILTERS = ["all", ...REUSABLE_PRODUCT_CATEGORIES];
const trimmedString$2 = zod.z.string().trim();
const reusableProductCategorySchema = zod.z.enum(REUSABLE_PRODUCT_CATEGORIES);
const newReusableProductSchema = zod.z.object({
  category: reusableProductCategorySchema,
  name: trimmedString$2.min(1),
  description: trimmedString$2.min(1).nullable().optional(),
  material: trimmedString$2,
  variant: trimmedString$2.optional().default("")
}).strict().superRefine((value, context) => {
  if (value.category !== "clothing" && value.material.length === 0) {
    context.addIssue({
      code: zod.z.ZodIssueCode.custom,
      message: "Completá el material del producto.",
      path: ["material"]
    });
  }
});
const catalogSearchRequestSchema = zod.z.object({
  query: trimmedString$2.min(1),
  limit: zod.z.number().int().positive().max(50).optional()
}).strict();
const catalogListRequestSchema = zod.z.object({
  query: trimmedString$2.optional().default(""),
  category: zod.z.enum(CATALOG_CATEGORY_FILTERS).optional().default("all"),
  limit: zod.z.number().int().positive().max(200).optional(),
  recentLimit: zod.z.number().int().positive().max(20).optional()
}).strict();
const catalogProductDetailRequestSchema = zod.z.object({
  reusableProductId: zod.z.number().int().positive(),
  recentIntakesLimit: zod.z.number().int().positive().max(20).optional()
}).strict();
const updateReusableProductRequestSchema = zod.z.object({
  reusableProductId: zod.z.number().int().positive(),
  product: newReusableProductSchema
}).strict();
const deleteReusableProductRequestSchema = zod.z.object({
  reusableProductId: zod.z.number().int().positive()
}).strict();
const stockIntakeBaseSchema = zod.z.object({
  enteredQuantity: zod.z.number().int().positive(),
  availableQuantity: zod.z.number().int().nonnegative(),
  supplierUnitCostCents: zod.z.number().int().nonnegative(),
  cashPriceCents: zod.z.number().int().nonnegative(),
  listPriceCents: zod.z.number().int().nonnegative(),
  profitPercentageBasisPoints: zod.z.number().int().nonnegative(),
  intakeDate: trimmedString$2.min(1),
  notes: trimmedString$2.nullable().optional(),
  allowDuplicate: zod.z.boolean().optional().default(false)
}).strict();
function validateStockIntakeBase(value, context) {
  if (value.availableQuantity > value.enteredQuantity) {
    context.addIssue({
      code: zod.z.ZodIssueCode.custom,
      message: "La cantidad disponible no puede ser mayor que la cantidad ingresada.",
      path: ["availableQuantity"]
    });
  }
}
const saveStockIntakeRequestSchema = zod.z.union([
  stockIntakeBaseSchema.extend({
    reusableProductId: zod.z.number().int().positive(),
    newReusableProduct: zod.z.undefined().optional()
  }),
  stockIntakeBaseSchema.extend({
    reusableProductId: zod.z.undefined().optional(),
    newReusableProduct: newReusableProductSchema
  })
]).superRefine(validateStockIntakeBase);
const entityKind = Symbol.for("drizzle:entityKind");
function is(value, type) {
  if (!value || typeof value !== "object") {
    return false;
  }
  if (value instanceof type) {
    return true;
  }
  if (!Object.prototype.hasOwnProperty.call(type, entityKind)) {
    throw new Error(
      `Class "${type.name ?? "<unknown>"}" doesn't look like a Drizzle entity. If this is incorrect and the class is provided by Drizzle, please report this as a bug.`
    );
  }
  let cls = Object.getPrototypeOf(value).constructor;
  if (cls) {
    while (cls) {
      if (entityKind in cls && cls[entityKind] === type[entityKind]) {
        return true;
      }
      cls = Object.getPrototypeOf(cls);
    }
  }
  return false;
}
_a = entityKind;
class Column {
  constructor(table, config) {
    __publicField(this, "name");
    __publicField(this, "keyAsName");
    __publicField(this, "primary");
    __publicField(this, "notNull");
    __publicField(this, "default");
    __publicField(this, "defaultFn");
    __publicField(this, "onUpdateFn");
    __publicField(this, "hasDefault");
    __publicField(this, "isUnique");
    __publicField(this, "uniqueName");
    __publicField(this, "uniqueType");
    __publicField(this, "dataType");
    __publicField(this, "columnType");
    __publicField(this, "enumValues");
    __publicField(this, "generated");
    __publicField(this, "generatedIdentity");
    __publicField(this, "config");
    this.table = table;
    this.config = config;
    this.name = config.name;
    this.keyAsName = config.keyAsName;
    this.notNull = config.notNull;
    this.default = config.default;
    this.defaultFn = config.defaultFn;
    this.onUpdateFn = config.onUpdateFn;
    this.hasDefault = config.hasDefault;
    this.primary = config.primaryKey;
    this.isUnique = config.isUnique;
    this.uniqueName = config.uniqueName;
    this.uniqueType = config.uniqueType;
    this.dataType = config.dataType;
    this.columnType = config.columnType;
    this.generated = config.generated;
    this.generatedIdentity = config.generatedIdentity;
  }
  mapFromDriverValue(value) {
    return value;
  }
  mapToDriverValue(value) {
    return value;
  }
  // ** @internal */
  shouldDisableInsert() {
    return this.config.generated !== void 0 && this.config.generated.type !== "byDefault";
  }
}
__publicField(Column, _a, "Column");
_b = entityKind;
class ColumnBuilder {
  constructor(name, dataType, columnType) {
    __publicField(this, "config");
    /**
     * Alias for {@link $defaultFn}.
     */
    __publicField(this, "$default", this.$defaultFn);
    /**
     * Alias for {@link $onUpdateFn}.
     */
    __publicField(this, "$onUpdate", this.$onUpdateFn);
    this.config = {
      name,
      keyAsName: name === "",
      notNull: false,
      default: void 0,
      hasDefault: false,
      primaryKey: false,
      isUnique: false,
      uniqueName: void 0,
      uniqueType: void 0,
      dataType,
      columnType,
      generated: void 0
    };
  }
  /**
   * Changes the data type of the column. Commonly used with `json` columns. Also, useful for branded types.
   *
   * @example
   * ```ts
   * const users = pgTable('users', {
   * 	id: integer('id').$type<UserId>().primaryKey(),
   * 	details: json('details').$type<UserDetails>().notNull(),
   * });
   * ```
   */
  $type() {
    return this;
  }
  /**
   * Adds a `not null` clause to the column definition.
   *
   * Affects the `select` model of the table - columns *without* `not null` will be nullable on select.
   */
  notNull() {
    this.config.notNull = true;
    return this;
  }
  /**
   * Adds a `default <value>` clause to the column definition.
   *
   * Affects the `insert` model of the table - columns *with* `default` are optional on insert.
   *
   * If you need to set a dynamic default value, use {@link $defaultFn} instead.
   */
  default(value) {
    this.config.default = value;
    this.config.hasDefault = true;
    return this;
  }
  /**
   * Adds a dynamic default value to the column.
   * The function will be called when the row is inserted, and the returned value will be used as the column value.
   *
   * **Note:** This value does not affect the `drizzle-kit` behavior, it is only used at runtime in `drizzle-orm`.
   */
  $defaultFn(fn) {
    this.config.defaultFn = fn;
    this.config.hasDefault = true;
    return this;
  }
  /**
   * Adds a dynamic update value to the column.
   * The function will be called when the row is updated, and the returned value will be used as the column value if none is provided.
   * If no `default` (or `$defaultFn`) value is provided, the function will be called when the row is inserted as well, and the returned value will be used as the column value.
   *
   * **Note:** This value does not affect the `drizzle-kit` behavior, it is only used at runtime in `drizzle-orm`.
   */
  $onUpdateFn(fn) {
    this.config.onUpdateFn = fn;
    this.config.hasDefault = true;
    return this;
  }
  /**
   * Adds a `primary key` clause to the column definition. This implicitly makes the column `not null`.
   *
   * In SQLite, `integer primary key` implicitly makes the column auto-incrementing.
   */
  primaryKey() {
    this.config.primaryKey = true;
    this.config.notNull = true;
    return this;
  }
  /** @internal Sets the name of the column to the key within the table definition if a name was not given. */
  setName(name) {
    if (this.config.name !== "") return;
    this.config.name = name;
  }
}
__publicField(ColumnBuilder, _b, "ColumnBuilder");
const TableName = Symbol.for("drizzle:Name");
const isPgEnumSym = Symbol.for("drizzle:isPgEnum");
function isPgEnum(obj) {
  return !!obj && typeof obj === "function" && isPgEnumSym in obj && obj[isPgEnumSym] === true;
}
_c = entityKind;
class Subquery {
  constructor(sql2, fields, alias, isWith = false, usedTables = []) {
    this._ = {
      brand: "Subquery",
      sql: sql2,
      selectedFields: fields,
      alias,
      isWith,
      usedTables
    };
  }
  // getSQL(): SQL<unknown> {
  // 	return new SQL([this]);
  // }
}
__publicField(Subquery, _c, "Subquery");
class WithSubquery extends (_e = Subquery, _d = entityKind, _e) {
}
__publicField(WithSubquery, _d, "WithSubquery");
const tracer = {
  startActiveSpan(name, fn) {
    {
      return fn();
    }
  }
};
const ViewBaseConfig = Symbol.for("drizzle:ViewBaseConfig");
const Schema = Symbol.for("drizzle:Schema");
const Columns = Symbol.for("drizzle:Columns");
const ExtraConfigColumns = Symbol.for("drizzle:ExtraConfigColumns");
const OriginalName = Symbol.for("drizzle:OriginalName");
const BaseName = Symbol.for("drizzle:BaseName");
const IsAlias = Symbol.for("drizzle:IsAlias");
const ExtraConfigBuilder = Symbol.for("drizzle:ExtraConfigBuilder");
const IsDrizzleTable = Symbol.for("drizzle:IsDrizzleTable");
_o = entityKind, _n = TableName, _m = OriginalName, _l = Schema, _k = Columns, _j = ExtraConfigColumns, _i = BaseName, _h = IsAlias, _g = IsDrizzleTable, _f = ExtraConfigBuilder;
class Table {
  constructor(name, schema, baseName) {
    /**
     * @internal
     * Can be changed if the table is aliased.
     */
    __publicField(this, _n);
    /**
     * @internal
     * Used to store the original name of the table, before any aliasing.
     */
    __publicField(this, _m);
    /** @internal */
    __publicField(this, _l);
    /** @internal */
    __publicField(this, _k);
    /** @internal */
    __publicField(this, _j);
    /**
     *  @internal
     * Used to store the table name before the transformation via the `tableCreator` functions.
     */
    __publicField(this, _i);
    /** @internal */
    __publicField(this, _h, false);
    /** @internal */
    __publicField(this, _g, true);
    /** @internal */
    __publicField(this, _f);
    this[TableName] = this[OriginalName] = name;
    this[Schema] = schema;
    this[BaseName] = baseName;
  }
}
__publicField(Table, _o, "Table");
/** @internal */
__publicField(Table, "Symbol", {
  Name: TableName,
  Schema,
  OriginalName,
  Columns,
  ExtraConfigColumns,
  BaseName,
  IsAlias,
  ExtraConfigBuilder
});
function getTableName(table) {
  return table[TableName];
}
function getTableUniqueName(table) {
  return `${table[Schema] ?? "public"}.${table[TableName]}`;
}
function isSQLWrapper(value) {
  return value !== null && value !== void 0 && typeof value.getSQL === "function";
}
function mergeQueries(queries) {
  var _a2;
  const result = { sql: "", params: [] };
  for (const query of queries) {
    result.sql += query.sql;
    result.params.push(...query.params);
    if ((_a2 = query.typings) == null ? void 0 : _a2.length) {
      if (!result.typings) {
        result.typings = [];
      }
      result.typings.push(...query.typings);
    }
  }
  return result;
}
_p = entityKind;
class StringChunk {
  constructor(value) {
    __publicField(this, "value");
    this.value = Array.isArray(value) ? value : [value];
  }
  getSQL() {
    return new SQL([this]);
  }
}
__publicField(StringChunk, _p, "StringChunk");
_q = entityKind;
const _SQL = class _SQL {
  constructor(queryChunks) {
    /** @internal */
    __publicField(this, "decoder", noopDecoder);
    __publicField(this, "shouldInlineParams", false);
    /** @internal */
    __publicField(this, "usedTables", []);
    this.queryChunks = queryChunks;
    for (const chunk of queryChunks) {
      if (is(chunk, Table)) {
        const schemaName = chunk[Table.Symbol.Schema];
        this.usedTables.push(
          schemaName === void 0 ? chunk[Table.Symbol.Name] : schemaName + "." + chunk[Table.Symbol.Name]
        );
      }
    }
  }
  append(query) {
    this.queryChunks.push(...query.queryChunks);
    return this;
  }
  toQuery(config) {
    return tracer.startActiveSpan("drizzle.buildSQL", (span) => {
      const query = this.buildQueryFromSourceParams(this.queryChunks, config);
      span == null ? void 0 : span.setAttributes({
        "drizzle.query.text": query.sql,
        "drizzle.query.params": JSON.stringify(query.params)
      });
      return query;
    });
  }
  buildQueryFromSourceParams(chunks, _config) {
    const config = Object.assign({}, _config, {
      inlineParams: _config.inlineParams || this.shouldInlineParams,
      paramStartIndex: _config.paramStartIndex || { value: 0 }
    });
    const {
      casing,
      escapeName,
      escapeParam,
      prepareTyping,
      inlineParams,
      paramStartIndex
    } = config;
    return mergeQueries(chunks.map((chunk) => {
      var _a2;
      if (is(chunk, StringChunk)) {
        return { sql: chunk.value.join(""), params: [] };
      }
      if (is(chunk, Name)) {
        return { sql: escapeName(chunk.value), params: [] };
      }
      if (chunk === void 0) {
        return { sql: "", params: [] };
      }
      if (Array.isArray(chunk)) {
        const result = [new StringChunk("(")];
        for (const [i, p] of chunk.entries()) {
          result.push(p);
          if (i < chunk.length - 1) {
            result.push(new StringChunk(", "));
          }
        }
        result.push(new StringChunk(")"));
        return this.buildQueryFromSourceParams(result, config);
      }
      if (is(chunk, _SQL)) {
        return this.buildQueryFromSourceParams(chunk.queryChunks, {
          ...config,
          inlineParams: inlineParams || chunk.shouldInlineParams
        });
      }
      if (is(chunk, Table)) {
        const schemaName = chunk[Table.Symbol.Schema];
        const tableName = chunk[Table.Symbol.Name];
        return {
          sql: schemaName === void 0 || chunk[IsAlias] ? escapeName(tableName) : escapeName(schemaName) + "." + escapeName(tableName),
          params: []
        };
      }
      if (is(chunk, Column)) {
        const columnName = casing.getColumnCasing(chunk);
        if (_config.invokeSource === "indexes") {
          return { sql: escapeName(columnName), params: [] };
        }
        const schemaName = chunk.table[Table.Symbol.Schema];
        return {
          sql: chunk.table[IsAlias] || schemaName === void 0 ? escapeName(chunk.table[Table.Symbol.Name]) + "." + escapeName(columnName) : escapeName(schemaName) + "." + escapeName(chunk.table[Table.Symbol.Name]) + "." + escapeName(columnName),
          params: []
        };
      }
      if (is(chunk, View)) {
        const schemaName = chunk[ViewBaseConfig].schema;
        const viewName = chunk[ViewBaseConfig].name;
        return {
          sql: schemaName === void 0 || chunk[ViewBaseConfig].isAlias ? escapeName(viewName) : escapeName(schemaName) + "." + escapeName(viewName),
          params: []
        };
      }
      if (is(chunk, Param)) {
        if (is(chunk.value, Placeholder)) {
          return { sql: escapeParam(paramStartIndex.value++, chunk), params: [chunk], typings: ["none"] };
        }
        const mappedValue = chunk.value === null ? null : chunk.encoder.mapToDriverValue(chunk.value);
        if (is(mappedValue, _SQL)) {
          return this.buildQueryFromSourceParams([mappedValue], config);
        }
        if (inlineParams) {
          return { sql: this.mapInlineParam(mappedValue, config), params: [] };
        }
        let typings = ["none"];
        if (prepareTyping) {
          typings = [prepareTyping(chunk.encoder)];
        }
        return { sql: escapeParam(paramStartIndex.value++, mappedValue), params: [mappedValue], typings };
      }
      if (is(chunk, Placeholder)) {
        return { sql: escapeParam(paramStartIndex.value++, chunk), params: [chunk], typings: ["none"] };
      }
      if (is(chunk, _SQL.Aliased) && chunk.fieldAlias !== void 0) {
        return { sql: escapeName(chunk.fieldAlias), params: [] };
      }
      if (is(chunk, Subquery)) {
        if (chunk._.isWith) {
          return { sql: escapeName(chunk._.alias), params: [] };
        }
        return this.buildQueryFromSourceParams([
          new StringChunk("("),
          chunk._.sql,
          new StringChunk(") "),
          new Name(chunk._.alias)
        ], config);
      }
      if (isPgEnum(chunk)) {
        if (chunk.schema) {
          return { sql: escapeName(chunk.schema) + "." + escapeName(chunk.enumName), params: [] };
        }
        return { sql: escapeName(chunk.enumName), params: [] };
      }
      if (isSQLWrapper(chunk)) {
        if ((_a2 = chunk.shouldOmitSQLParens) == null ? void 0 : _a2.call(chunk)) {
          return this.buildQueryFromSourceParams([chunk.getSQL()], config);
        }
        return this.buildQueryFromSourceParams([
          new StringChunk("("),
          chunk.getSQL(),
          new StringChunk(")")
        ], config);
      }
      if (inlineParams) {
        return { sql: this.mapInlineParam(chunk, config), params: [] };
      }
      return { sql: escapeParam(paramStartIndex.value++, chunk), params: [chunk], typings: ["none"] };
    }));
  }
  mapInlineParam(chunk, { escapeString }) {
    if (chunk === null) {
      return "null";
    }
    if (typeof chunk === "number" || typeof chunk === "boolean") {
      return chunk.toString();
    }
    if (typeof chunk === "string") {
      return escapeString(chunk);
    }
    if (typeof chunk === "object") {
      const mappedValueAsString = chunk.toString();
      if (mappedValueAsString === "[object Object]") {
        return escapeString(JSON.stringify(chunk));
      }
      return escapeString(mappedValueAsString);
    }
    throw new Error("Unexpected param value: " + chunk);
  }
  getSQL() {
    return this;
  }
  as(alias) {
    if (alias === void 0) {
      return this;
    }
    return new _SQL.Aliased(this, alias);
  }
  mapWith(decoder) {
    this.decoder = typeof decoder === "function" ? { mapFromDriverValue: decoder } : decoder;
    return this;
  }
  inlineParams() {
    this.shouldInlineParams = true;
    return this;
  }
  /**
   * This method is used to conditionally include a part of the query.
   *
   * @param condition - Condition to check
   * @returns itself if the condition is `true`, otherwise `undefined`
   */
  if(condition) {
    return condition ? this : void 0;
  }
};
__publicField(_SQL, _q, "SQL");
let SQL = _SQL;
_r = entityKind;
class Name {
  constructor(value) {
    __publicField(this, "brand");
    this.value = value;
  }
  getSQL() {
    return new SQL([this]);
  }
}
__publicField(Name, _r, "Name");
function isDriverValueEncoder(value) {
  return typeof value === "object" && value !== null && "mapToDriverValue" in value && typeof value.mapToDriverValue === "function";
}
const noopDecoder = {
  mapFromDriverValue: (value) => value
};
const noopEncoder = {
  mapToDriverValue: (value) => value
};
({
  ...noopDecoder,
  ...noopEncoder
});
_s = entityKind;
class Param {
  /**
   * @param value - Parameter value
   * @param encoder - Encoder to convert the value to a driver parameter
   */
  constructor(value, encoder = noopEncoder) {
    __publicField(this, "brand");
    this.value = value;
    this.encoder = encoder;
  }
  getSQL() {
    return new SQL([this]);
  }
}
__publicField(Param, _s, "Param");
function sql(strings, ...params) {
  const queryChunks = [];
  if (params.length > 0 || strings.length > 0 && strings[0] !== "") {
    queryChunks.push(new StringChunk(strings[0]));
  }
  for (const [paramIndex, param2] of params.entries()) {
    queryChunks.push(param2, new StringChunk(strings[paramIndex + 1]));
  }
  return new SQL(queryChunks);
}
((sql2) => {
  function empty() {
    return new SQL([]);
  }
  sql2.empty = empty;
  function fromList(list) {
    return new SQL(list);
  }
  sql2.fromList = fromList;
  function raw(str) {
    return new SQL([new StringChunk(str)]);
  }
  sql2.raw = raw;
  function join(chunks, separator) {
    const result = [];
    for (const [i, chunk] of chunks.entries()) {
      if (i > 0 && separator !== void 0) {
        result.push(separator);
      }
      result.push(chunk);
    }
    return new SQL(result);
  }
  sql2.join = join;
  function identifier(value) {
    return new Name(value);
  }
  sql2.identifier = identifier;
  function placeholder2(name2) {
    return new Placeholder(name2);
  }
  sql2.placeholder = placeholder2;
  function param2(value, encoder) {
    return new Param(value, encoder);
  }
  sql2.param = param2;
})(sql || (sql = {}));
((SQL2) => {
  var _a2;
  _a2 = entityKind;
  const _Aliased = class _Aliased {
    constructor(sql2, fieldAlias) {
      /** @internal */
      __publicField(this, "isSelectionField", false);
      this.sql = sql2;
      this.fieldAlias = fieldAlias;
    }
    getSQL() {
      return this.sql;
    }
    /** @internal */
    clone() {
      return new _Aliased(this.sql, this.fieldAlias);
    }
  };
  __publicField(_Aliased, _a2, "SQL.Aliased");
  let Aliased = _Aliased;
  SQL2.Aliased = Aliased;
})(SQL || (SQL = {}));
_t = entityKind;
class Placeholder {
  constructor(name2) {
    this.name = name2;
  }
  getSQL() {
    return new SQL([this]);
  }
}
__publicField(Placeholder, _t, "Placeholder");
function fillPlaceholders(params, values) {
  return params.map((p) => {
    if (is(p, Placeholder)) {
      if (!(p.name in values)) {
        throw new Error(`No value for placeholder "${p.name}" was provided`);
      }
      return values[p.name];
    }
    if (is(p, Param) && is(p.value, Placeholder)) {
      if (!(p.value.name in values)) {
        throw new Error(`No value for placeholder "${p.value.name}" was provided`);
      }
      return p.encoder.mapToDriverValue(values[p.value.name]);
    }
    return p;
  });
}
const IsDrizzleView = Symbol.for("drizzle:IsDrizzleView");
_w = entityKind, _v = ViewBaseConfig, _u = IsDrizzleView;
class View {
  constructor({ name: name2, schema, selectedFields, query }) {
    /** @internal */
    __publicField(this, _v);
    /** @internal */
    __publicField(this, _u, true);
    this[ViewBaseConfig] = {
      name: name2,
      originalName: name2,
      schema,
      selectedFields,
      query,
      isExisting: !query,
      isAlias: false
    };
  }
  getSQL() {
    return new SQL([this]);
  }
}
__publicField(View, _w, "View");
Column.prototype.getSQL = function() {
  return new SQL([this]);
};
Table.prototype.getSQL = function() {
  return new SQL([this]);
};
Subquery.prototype.getSQL = function() {
  return new SQL([this]);
};
_x = entityKind;
class ColumnAliasProxyHandler {
  constructor(table) {
    this.table = table;
  }
  get(columnObj, prop) {
    if (prop === "table") {
      return this.table;
    }
    return columnObj[prop];
  }
}
__publicField(ColumnAliasProxyHandler, _x, "ColumnAliasProxyHandler");
_y = entityKind;
class TableAliasProxyHandler {
  constructor(alias, replaceOriginalName) {
    this.alias = alias;
    this.replaceOriginalName = replaceOriginalName;
  }
  get(target, prop) {
    if (prop === Table.Symbol.IsAlias) {
      return true;
    }
    if (prop === Table.Symbol.Name) {
      return this.alias;
    }
    if (this.replaceOriginalName && prop === Table.Symbol.OriginalName) {
      return this.alias;
    }
    if (prop === ViewBaseConfig) {
      return {
        ...target[ViewBaseConfig],
        name: this.alias,
        isAlias: true
      };
    }
    if (prop === Table.Symbol.Columns) {
      const columns = target[Table.Symbol.Columns];
      if (!columns) {
        return columns;
      }
      const proxiedColumns = {};
      Object.keys(columns).map((key) => {
        proxiedColumns[key] = new Proxy(
          columns[key],
          new ColumnAliasProxyHandler(new Proxy(target, this))
        );
      });
      return proxiedColumns;
    }
    const value = target[prop];
    if (is(value, Column)) {
      return new Proxy(value, new ColumnAliasProxyHandler(new Proxy(target, this)));
    }
    return value;
  }
}
__publicField(TableAliasProxyHandler, _y, "TableAliasProxyHandler");
function aliasedTable(table, tableAlias) {
  return new Proxy(table, new TableAliasProxyHandler(tableAlias, false));
}
function aliasedTableColumn(column, tableAlias) {
  return new Proxy(
    column,
    new ColumnAliasProxyHandler(new Proxy(column.table, new TableAliasProxyHandler(tableAlias, false)))
  );
}
function mapColumnsInAliasedSQLToAlias(query, alias) {
  return new SQL.Aliased(mapColumnsInSQLToAlias(query.sql, alias), query.fieldAlias);
}
function mapColumnsInSQLToAlias(query, alias) {
  return sql.join(query.queryChunks.map((c) => {
    if (is(c, Column)) {
      return aliasedTableColumn(c, alias);
    }
    if (is(c, SQL)) {
      return mapColumnsInSQLToAlias(c, alias);
    }
    if (is(c, SQL.Aliased)) {
      return mapColumnsInAliasedSQLToAlias(c, alias);
    }
    return c;
  }));
}
function mapResultRow(columns, row, joinsNotNullableMap) {
  const nullifyMap = {};
  const result = columns.reduce(
    (result2, { path, field }, columnIndex) => {
      let decoder;
      if (is(field, Column)) {
        decoder = field;
      } else if (is(field, SQL)) {
        decoder = field.decoder;
      } else if (is(field, Subquery)) {
        decoder = field._.sql.decoder;
      } else {
        decoder = field.sql.decoder;
      }
      let node = result2;
      for (const [pathChunkIndex, pathChunk] of path.entries()) {
        if (pathChunkIndex < path.length - 1) {
          if (!(pathChunk in node)) {
            node[pathChunk] = {};
          }
          node = node[pathChunk];
        } else {
          const rawValue = row[columnIndex];
          const value = node[pathChunk] = rawValue === null ? null : decoder.mapFromDriverValue(rawValue);
          if (joinsNotNullableMap && is(field, Column) && path.length === 2) {
            const objectName = path[0];
            if (!(objectName in nullifyMap)) {
              nullifyMap[objectName] = value === null ? getTableName(field.table) : false;
            } else if (typeof nullifyMap[objectName] === "string" && nullifyMap[objectName] !== getTableName(field.table)) {
              nullifyMap[objectName] = false;
            }
          }
        }
      }
      return result2;
    },
    {}
  );
  if (joinsNotNullableMap && Object.keys(nullifyMap).length > 0) {
    for (const [objectName, tableName] of Object.entries(nullifyMap)) {
      if (typeof tableName === "string" && !joinsNotNullableMap[tableName]) {
        result[objectName] = null;
      }
    }
  }
  return result;
}
function orderSelectedFields(fields, pathPrefix) {
  return Object.entries(fields).reduce((result, [name, field]) => {
    if (typeof name !== "string") {
      return result;
    }
    const newPath = pathPrefix ? [...pathPrefix, name] : [name];
    if (is(field, Column) || is(field, SQL) || is(field, SQL.Aliased) || is(field, Subquery)) {
      result.push({ path: newPath, field });
    } else if (is(field, Table)) {
      result.push(...orderSelectedFields(field[Table.Symbol.Columns], newPath));
    } else {
      result.push(...orderSelectedFields(field, newPath));
    }
    return result;
  }, []);
}
function haveSameKeys(left, right) {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) {
    return false;
  }
  for (const [index2, key] of leftKeys.entries()) {
    if (key !== rightKeys[index2]) {
      return false;
    }
  }
  return true;
}
function mapUpdateSet(table, values) {
  const entries = Object.entries(values).filter(([, value]) => value !== void 0).map(([key, value]) => {
    if (is(value, SQL) || is(value, Column)) {
      return [key, value];
    } else {
      return [key, new Param(value, table[Table.Symbol.Columns][key])];
    }
  });
  if (entries.length === 0) {
    throw new Error("No values to set");
  }
  return Object.fromEntries(entries);
}
function applyMixins(baseClass, extendedClasses) {
  for (const extendedClass of extendedClasses) {
    for (const name of Object.getOwnPropertyNames(extendedClass.prototype)) {
      if (name === "constructor") continue;
      Object.defineProperty(
        baseClass.prototype,
        name,
        Object.getOwnPropertyDescriptor(extendedClass.prototype, name) || /* @__PURE__ */ Object.create(null)
      );
    }
  }
}
function getTableColumns(table) {
  return table[Table.Symbol.Columns];
}
function getTableLikeName(table) {
  return is(table, Subquery) ? table._.alias : is(table, View) ? table[ViewBaseConfig].name : is(table, SQL) ? void 0 : table[Table.Symbol.IsAlias] ? table[Table.Symbol.Name] : table[Table.Symbol.BaseName];
}
function getColumnNameAndConfig(a, b) {
  return {
    name: typeof a === "string" && a.length > 0 ? a : "",
    config: typeof a === "object" ? a : b
  };
}
function isConfig(data) {
  if (typeof data !== "object" || data === null) return false;
  if (data.constructor.name !== "Object") return false;
  if ("logger" in data) {
    const type = typeof data["logger"];
    if (type !== "boolean" && (type !== "object" || typeof data["logger"]["logQuery"] !== "function") && type !== "undefined") return false;
    return true;
  }
  if ("schema" in data) {
    const type = typeof data["schema"];
    if (type !== "object" && type !== "undefined") return false;
    return true;
  }
  if ("casing" in data) {
    const type = typeof data["casing"];
    if (type !== "string" && type !== "undefined") return false;
    return true;
  }
  if ("mode" in data) {
    if (data["mode"] !== "default" || data["mode"] !== "planetscale" || data["mode"] !== void 0) return false;
    return true;
  }
  if ("connection" in data) {
    const type = typeof data["connection"];
    if (type !== "string" && type !== "object" && type !== "undefined") return false;
    return true;
  }
  if ("client" in data) {
    const type = typeof data["client"];
    if (type !== "object" && type !== "function" && type !== "undefined") return false;
    return true;
  }
  if (Object.keys(data).length === 0) return true;
  return false;
}
const textDecoder = typeof TextDecoder === "undefined" ? null : new TextDecoder();
_z = entityKind;
class ForeignKeyBuilder {
  constructor(config, actions) {
    /** @internal */
    __publicField(this, "reference");
    /** @internal */
    __publicField(this, "_onUpdate");
    /** @internal */
    __publicField(this, "_onDelete");
    this.reference = () => {
      const { name, columns, foreignColumns } = config();
      return { name, columns, foreignTable: foreignColumns[0].table, foreignColumns };
    };
    if (actions) {
      this._onUpdate = actions.onUpdate;
      this._onDelete = actions.onDelete;
    }
  }
  onUpdate(action) {
    this._onUpdate = action;
    return this;
  }
  onDelete(action) {
    this._onDelete = action;
    return this;
  }
  /** @internal */
  build(table) {
    return new ForeignKey(table, this);
  }
}
__publicField(ForeignKeyBuilder, _z, "SQLiteForeignKeyBuilder");
_A = entityKind;
class ForeignKey {
  constructor(table, builder) {
    __publicField(this, "reference");
    __publicField(this, "onUpdate");
    __publicField(this, "onDelete");
    this.table = table;
    this.reference = builder.reference;
    this.onUpdate = builder._onUpdate;
    this.onDelete = builder._onDelete;
  }
  getName() {
    const { name, columns, foreignColumns } = this.reference();
    const columnNames = columns.map((column) => column.name);
    const foreignColumnNames = foreignColumns.map((column) => column.name);
    const chunks = [
      this.table[TableName],
      ...columnNames,
      foreignColumns[0].table[TableName],
      ...foreignColumnNames
    ];
    return name ?? `${chunks.join("_")}_fk`;
  }
}
__publicField(ForeignKey, _A, "SQLiteForeignKey");
function uniqueKeyName(table, columns) {
  return `${table[TableName]}_${columns.join("_")}_unique`;
}
class SQLiteColumnBuilder extends (_C = ColumnBuilder, _B = entityKind, _C) {
  constructor() {
    super(...arguments);
    __publicField(this, "foreignKeyConfigs", []);
  }
  references(ref, actions = {}) {
    this.foreignKeyConfigs.push({ ref, actions });
    return this;
  }
  unique(name) {
    this.config.isUnique = true;
    this.config.uniqueName = name;
    return this;
  }
  generatedAlwaysAs(as, config) {
    this.config.generated = {
      as,
      type: "always",
      mode: (config == null ? void 0 : config.mode) ?? "virtual"
    };
    return this;
  }
  /** @internal */
  buildForeignKeys(column, table) {
    return this.foreignKeyConfigs.map(({ ref, actions }) => {
      return ((ref2, actions2) => {
        const builder = new ForeignKeyBuilder(() => {
          const foreignColumn = ref2();
          return { columns: [column], foreignColumns: [foreignColumn] };
        });
        if (actions2.onUpdate) {
          builder.onUpdate(actions2.onUpdate);
        }
        if (actions2.onDelete) {
          builder.onDelete(actions2.onDelete);
        }
        return builder.build(table);
      })(ref, actions);
    });
  }
}
__publicField(SQLiteColumnBuilder, _B, "SQLiteColumnBuilder");
class SQLiteColumn extends (_E = Column, _D = entityKind, _E) {
  constructor(table, config) {
    if (!config.uniqueName) {
      config.uniqueName = uniqueKeyName(table, [config.name]);
    }
    super(table, config);
    this.table = table;
  }
}
__publicField(SQLiteColumn, _D, "SQLiteColumn");
class SQLiteBigIntBuilder extends (_G = SQLiteColumnBuilder, _F = entityKind, _G) {
  constructor(name) {
    super(name, "bigint", "SQLiteBigInt");
  }
  /** @internal */
  build(table) {
    return new SQLiteBigInt(table, this.config);
  }
}
__publicField(SQLiteBigIntBuilder, _F, "SQLiteBigIntBuilder");
class SQLiteBigInt extends (_I = SQLiteColumn, _H = entityKind, _I) {
  getSQLType() {
    return "blob";
  }
  mapFromDriverValue(value) {
    if (typeof Buffer !== "undefined" && Buffer.from) {
      const buf = Buffer.isBuffer(value) ? value : value instanceof ArrayBuffer ? Buffer.from(value) : value.buffer ? Buffer.from(value.buffer, value.byteOffset, value.byteLength) : Buffer.from(value);
      return BigInt(buf.toString("utf8"));
    }
    return BigInt(textDecoder.decode(value));
  }
  mapToDriverValue(value) {
    return Buffer.from(value.toString());
  }
}
__publicField(SQLiteBigInt, _H, "SQLiteBigInt");
class SQLiteBlobJsonBuilder extends (_K = SQLiteColumnBuilder, _J = entityKind, _K) {
  constructor(name) {
    super(name, "json", "SQLiteBlobJson");
  }
  /** @internal */
  build(table) {
    return new SQLiteBlobJson(
      table,
      this.config
    );
  }
}
__publicField(SQLiteBlobJsonBuilder, _J, "SQLiteBlobJsonBuilder");
class SQLiteBlobJson extends (_M = SQLiteColumn, _L = entityKind, _M) {
  getSQLType() {
    return "blob";
  }
  mapFromDriverValue(value) {
    if (typeof Buffer !== "undefined" && Buffer.from) {
      const buf = Buffer.isBuffer(value) ? value : value instanceof ArrayBuffer ? Buffer.from(value) : value.buffer ? Buffer.from(value.buffer, value.byteOffset, value.byteLength) : Buffer.from(value);
      return JSON.parse(buf.toString("utf8"));
    }
    return JSON.parse(textDecoder.decode(value));
  }
  mapToDriverValue(value) {
    return Buffer.from(JSON.stringify(value));
  }
}
__publicField(SQLiteBlobJson, _L, "SQLiteBlobJson");
class SQLiteBlobBufferBuilder extends (_O = SQLiteColumnBuilder, _N = entityKind, _O) {
  constructor(name) {
    super(name, "buffer", "SQLiteBlobBuffer");
  }
  /** @internal */
  build(table) {
    return new SQLiteBlobBuffer(table, this.config);
  }
}
__publicField(SQLiteBlobBufferBuilder, _N, "SQLiteBlobBufferBuilder");
class SQLiteBlobBuffer extends (_Q = SQLiteColumn, _P = entityKind, _Q) {
  mapFromDriverValue(value) {
    if (Buffer.isBuffer(value)) {
      return value;
    }
    return Buffer.from(value);
  }
  getSQLType() {
    return "blob";
  }
}
__publicField(SQLiteBlobBuffer, _P, "SQLiteBlobBuffer");
function blob(a, b) {
  const { name, config } = getColumnNameAndConfig(a, b);
  if ((config == null ? void 0 : config.mode) === "json") {
    return new SQLiteBlobJsonBuilder(name);
  }
  if ((config == null ? void 0 : config.mode) === "bigint") {
    return new SQLiteBigIntBuilder(name);
  }
  return new SQLiteBlobBufferBuilder(name);
}
class SQLiteCustomColumnBuilder extends (_S = SQLiteColumnBuilder, _R = entityKind, _S) {
  constructor(name, fieldConfig, customTypeParams) {
    super(name, "custom", "SQLiteCustomColumn");
    this.config.fieldConfig = fieldConfig;
    this.config.customTypeParams = customTypeParams;
  }
  /** @internal */
  build(table) {
    return new SQLiteCustomColumn(
      table,
      this.config
    );
  }
}
__publicField(SQLiteCustomColumnBuilder, _R, "SQLiteCustomColumnBuilder");
class SQLiteCustomColumn extends (_U = SQLiteColumn, _T = entityKind, _U) {
  constructor(table, config) {
    super(table, config);
    __publicField(this, "sqlName");
    __publicField(this, "mapTo");
    __publicField(this, "mapFrom");
    this.sqlName = config.customTypeParams.dataType(config.fieldConfig);
    this.mapTo = config.customTypeParams.toDriver;
    this.mapFrom = config.customTypeParams.fromDriver;
  }
  getSQLType() {
    return this.sqlName;
  }
  mapFromDriverValue(value) {
    return typeof this.mapFrom === "function" ? this.mapFrom(value) : value;
  }
  mapToDriverValue(value) {
    return typeof this.mapTo === "function" ? this.mapTo(value) : value;
  }
}
__publicField(SQLiteCustomColumn, _T, "SQLiteCustomColumn");
function customType(customTypeParams) {
  return (a, b) => {
    const { name, config } = getColumnNameAndConfig(a, b);
    return new SQLiteCustomColumnBuilder(
      name,
      config,
      customTypeParams
    );
  };
}
class SQLiteBaseIntegerBuilder extends (_W = SQLiteColumnBuilder, _V = entityKind, _W) {
  constructor(name, dataType, columnType) {
    super(name, dataType, columnType);
    this.config.autoIncrement = false;
  }
  primaryKey(config) {
    if (config == null ? void 0 : config.autoIncrement) {
      this.config.autoIncrement = true;
    }
    this.config.hasDefault = true;
    return super.primaryKey();
  }
}
__publicField(SQLiteBaseIntegerBuilder, _V, "SQLiteBaseIntegerBuilder");
class SQLiteBaseInteger extends (_Y = SQLiteColumn, _X = entityKind, _Y) {
  constructor() {
    super(...arguments);
    __publicField(this, "autoIncrement", this.config.autoIncrement);
  }
  getSQLType() {
    return "integer";
  }
}
__publicField(SQLiteBaseInteger, _X, "SQLiteBaseInteger");
class SQLiteIntegerBuilder extends (__ = SQLiteBaseIntegerBuilder, _Z = entityKind, __) {
  constructor(name) {
    super(name, "number", "SQLiteInteger");
  }
  build(table) {
    return new SQLiteInteger(
      table,
      this.config
    );
  }
}
__publicField(SQLiteIntegerBuilder, _Z, "SQLiteIntegerBuilder");
class SQLiteInteger extends (_aa = SQLiteBaseInteger, _$ = entityKind, _aa) {
}
__publicField(SQLiteInteger, _$, "SQLiteInteger");
class SQLiteTimestampBuilder extends (_ca = SQLiteBaseIntegerBuilder, _ba = entityKind, _ca) {
  constructor(name, mode) {
    super(name, "date", "SQLiteTimestamp");
    this.config.mode = mode;
  }
  /**
   * @deprecated Use `default()` with your own expression instead.
   *
   * Adds `DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer))` to the column, which is the current epoch timestamp in milliseconds.
   */
  defaultNow() {
    return this.default(sql`(cast((julianday('now') - 2440587.5)*86400000 as integer))`);
  }
  build(table) {
    return new SQLiteTimestamp(
      table,
      this.config
    );
  }
}
__publicField(SQLiteTimestampBuilder, _ba, "SQLiteTimestampBuilder");
class SQLiteTimestamp extends (_ea = SQLiteBaseInteger, _da = entityKind, _ea) {
  constructor() {
    super(...arguments);
    __publicField(this, "mode", this.config.mode);
  }
  mapFromDriverValue(value) {
    if (this.config.mode === "timestamp") {
      return new Date(value * 1e3);
    }
    return new Date(value);
  }
  mapToDriverValue(value) {
    const unix = value.getTime();
    if (this.config.mode === "timestamp") {
      return Math.floor(unix / 1e3);
    }
    return unix;
  }
}
__publicField(SQLiteTimestamp, _da, "SQLiteTimestamp");
class SQLiteBooleanBuilder extends (_ga = SQLiteBaseIntegerBuilder, _fa = entityKind, _ga) {
  constructor(name, mode) {
    super(name, "boolean", "SQLiteBoolean");
    this.config.mode = mode;
  }
  build(table) {
    return new SQLiteBoolean(
      table,
      this.config
    );
  }
}
__publicField(SQLiteBooleanBuilder, _fa, "SQLiteBooleanBuilder");
class SQLiteBoolean extends (_ia = SQLiteBaseInteger, _ha = entityKind, _ia) {
  constructor() {
    super(...arguments);
    __publicField(this, "mode", this.config.mode);
  }
  mapFromDriverValue(value) {
    return Number(value) === 1;
  }
  mapToDriverValue(value) {
    return value ? 1 : 0;
  }
}
__publicField(SQLiteBoolean, _ha, "SQLiteBoolean");
function integer(a, b) {
  const { name, config } = getColumnNameAndConfig(a, b);
  if ((config == null ? void 0 : config.mode) === "timestamp" || (config == null ? void 0 : config.mode) === "timestamp_ms") {
    return new SQLiteTimestampBuilder(name, config.mode);
  }
  if ((config == null ? void 0 : config.mode) === "boolean") {
    return new SQLiteBooleanBuilder(name, config.mode);
  }
  return new SQLiteIntegerBuilder(name);
}
class SQLiteNumericBuilder extends (_ka = SQLiteColumnBuilder, _ja = entityKind, _ka) {
  constructor(name) {
    super(name, "string", "SQLiteNumeric");
  }
  /** @internal */
  build(table) {
    return new SQLiteNumeric(
      table,
      this.config
    );
  }
}
__publicField(SQLiteNumericBuilder, _ja, "SQLiteNumericBuilder");
class SQLiteNumeric extends (_ma = SQLiteColumn, _la = entityKind, _ma) {
  mapFromDriverValue(value) {
    if (typeof value === "string") return value;
    return String(value);
  }
  getSQLType() {
    return "numeric";
  }
}
__publicField(SQLiteNumeric, _la, "SQLiteNumeric");
class SQLiteNumericNumberBuilder extends (_oa = SQLiteColumnBuilder, _na = entityKind, _oa) {
  constructor(name) {
    super(name, "number", "SQLiteNumericNumber");
  }
  /** @internal */
  build(table) {
    return new SQLiteNumericNumber(
      table,
      this.config
    );
  }
}
__publicField(SQLiteNumericNumberBuilder, _na, "SQLiteNumericNumberBuilder");
class SQLiteNumericNumber extends (_qa = SQLiteColumn, _pa = entityKind, _qa) {
  constructor() {
    super(...arguments);
    __publicField(this, "mapToDriverValue", String);
  }
  mapFromDriverValue(value) {
    if (typeof value === "number") return value;
    return Number(value);
  }
  getSQLType() {
    return "numeric";
  }
}
__publicField(SQLiteNumericNumber, _pa, "SQLiteNumericNumber");
class SQLiteNumericBigIntBuilder extends (_sa = SQLiteColumnBuilder, _ra = entityKind, _sa) {
  constructor(name) {
    super(name, "bigint", "SQLiteNumericBigInt");
  }
  /** @internal */
  build(table) {
    return new SQLiteNumericBigInt(
      table,
      this.config
    );
  }
}
__publicField(SQLiteNumericBigIntBuilder, _ra, "SQLiteNumericBigIntBuilder");
class SQLiteNumericBigInt extends (_ua = SQLiteColumn, _ta = entityKind, _ua) {
  constructor() {
    super(...arguments);
    __publicField(this, "mapFromDriverValue", BigInt);
    __publicField(this, "mapToDriverValue", String);
  }
  getSQLType() {
    return "numeric";
  }
}
__publicField(SQLiteNumericBigInt, _ta, "SQLiteNumericBigInt");
function numeric(a, b) {
  const { name, config } = getColumnNameAndConfig(a, b);
  const mode = config == null ? void 0 : config.mode;
  return mode === "number" ? new SQLiteNumericNumberBuilder(name) : mode === "bigint" ? new SQLiteNumericBigIntBuilder(name) : new SQLiteNumericBuilder(name);
}
class SQLiteRealBuilder extends (_wa = SQLiteColumnBuilder, _va = entityKind, _wa) {
  constructor(name) {
    super(name, "number", "SQLiteReal");
  }
  /** @internal */
  build(table) {
    return new SQLiteReal(table, this.config);
  }
}
__publicField(SQLiteRealBuilder, _va, "SQLiteRealBuilder");
class SQLiteReal extends (_ya = SQLiteColumn, _xa = entityKind, _ya) {
  getSQLType() {
    return "real";
  }
}
__publicField(SQLiteReal, _xa, "SQLiteReal");
function real(name) {
  return new SQLiteRealBuilder(name ?? "");
}
class SQLiteTextBuilder extends (_Aa = SQLiteColumnBuilder, _za = entityKind, _Aa) {
  constructor(name, config) {
    super(name, "string", "SQLiteText");
    this.config.enumValues = config.enum;
    this.config.length = config.length;
  }
  /** @internal */
  build(table) {
    return new SQLiteText(
      table,
      this.config
    );
  }
}
__publicField(SQLiteTextBuilder, _za, "SQLiteTextBuilder");
class SQLiteText extends (_Ca = SQLiteColumn, _Ba = entityKind, _Ca) {
  constructor(table, config) {
    super(table, config);
    __publicField(this, "enumValues", this.config.enumValues);
    __publicField(this, "length", this.config.length);
  }
  getSQLType() {
    return `text${this.config.length ? `(${this.config.length})` : ""}`;
  }
}
__publicField(SQLiteText, _Ba, "SQLiteText");
class SQLiteTextJsonBuilder extends (_Ea = SQLiteColumnBuilder, _Da = entityKind, _Ea) {
  constructor(name) {
    super(name, "json", "SQLiteTextJson");
  }
  /** @internal */
  build(table) {
    return new SQLiteTextJson(
      table,
      this.config
    );
  }
}
__publicField(SQLiteTextJsonBuilder, _Da, "SQLiteTextJsonBuilder");
class SQLiteTextJson extends (_Ga = SQLiteColumn, _Fa = entityKind, _Ga) {
  getSQLType() {
    return "text";
  }
  mapFromDriverValue(value) {
    return JSON.parse(value);
  }
  mapToDriverValue(value) {
    return JSON.stringify(value);
  }
}
__publicField(SQLiteTextJson, _Fa, "SQLiteTextJson");
function text(a, b = {}) {
  const { name, config } = getColumnNameAndConfig(a, b);
  if (config.mode === "json") {
    return new SQLiteTextJsonBuilder(name);
  }
  return new SQLiteTextBuilder(name, config);
}
_Ha = entityKind;
const _SelectionProxyHandler = class _SelectionProxyHandler {
  constructor(config) {
    __publicField(this, "config");
    this.config = { ...config };
  }
  get(subquery, prop) {
    if (prop === "_") {
      return {
        ...subquery["_"],
        selectedFields: new Proxy(
          subquery._.selectedFields,
          this
        )
      };
    }
    if (prop === ViewBaseConfig) {
      return {
        ...subquery[ViewBaseConfig],
        selectedFields: new Proxy(
          subquery[ViewBaseConfig].selectedFields,
          this
        )
      };
    }
    if (typeof prop === "symbol") {
      return subquery[prop];
    }
    const columns = is(subquery, Subquery) ? subquery._.selectedFields : is(subquery, View) ? subquery[ViewBaseConfig].selectedFields : subquery;
    const value = columns[prop];
    if (is(value, SQL.Aliased)) {
      if (this.config.sqlAliasedBehavior === "sql" && !value.isSelectionField) {
        return value.sql;
      }
      const newValue = value.clone();
      newValue.isSelectionField = true;
      return newValue;
    }
    if (is(value, SQL)) {
      if (this.config.sqlBehavior === "sql") {
        return value;
      }
      throw new Error(
        `You tried to reference "${prop}" field from a subquery, which is a raw SQL field, but it doesn't have an alias declared. Please add an alias to the field using ".as('alias')" method.`
      );
    }
    if (is(value, Column)) {
      if (this.config.alias) {
        return new Proxy(
          value,
          new ColumnAliasProxyHandler(
            new Proxy(
              value.table,
              new TableAliasProxyHandler(this.config.alias, this.config.replaceOriginalName ?? false)
            )
          )
        );
      }
      return value;
    }
    if (typeof value !== "object" || value === null) {
      return value;
    }
    return new Proxy(value, new _SelectionProxyHandler(this.config));
  }
};
__publicField(_SelectionProxyHandler, _Ha, "SelectionProxyHandler");
let SelectionProxyHandler = _SelectionProxyHandler;
_Ja = entityKind, _Ia = Symbol.toStringTag;
class QueryPromise {
  constructor() {
    __publicField(this, _Ia, "QueryPromise");
  }
  catch(onRejected) {
    return this.then(void 0, onRejected);
  }
  finally(onFinally) {
    return this.then(
      (value) => {
        onFinally == null ? void 0 : onFinally();
        return value;
      },
      (reason) => {
        onFinally == null ? void 0 : onFinally();
        throw reason;
      }
    );
  }
  then(onFulfilled, onRejected) {
    return this.execute().then(onFulfilled, onRejected);
  }
}
__publicField(QueryPromise, _Ja, "QueryPromise");
function getSQLiteColumnBuilders() {
  return {
    blob,
    customType,
    integer,
    numeric,
    real,
    text
  };
}
const InlineForeignKeys$1 = Symbol.for("drizzle:SQLiteInlineForeignKeys");
class SQLiteTable extends (_Oa = Table, _Na = entityKind, _Ma = Table.Symbol.Columns, _La = InlineForeignKeys$1, _Ka = Table.Symbol.ExtraConfigBuilder, _Oa) {
  constructor() {
    super(...arguments);
    /** @internal */
    __publicField(this, _Ma);
    /** @internal */
    __publicField(this, _La, []);
    /** @internal */
    __publicField(this, _Ka);
  }
}
__publicField(SQLiteTable, _Na, "SQLiteTable");
/** @internal */
__publicField(SQLiteTable, "Symbol", Object.assign({}, Table.Symbol, {
  InlineForeignKeys: InlineForeignKeys$1
}));
function sqliteTableBase(name, columns, extraConfig, schema, baseName = name) {
  const rawTable = new SQLiteTable(name, schema, baseName);
  const parsedColumns = typeof columns === "function" ? columns(getSQLiteColumnBuilders()) : columns;
  const builtColumns = Object.fromEntries(
    Object.entries(parsedColumns).map(([name2, colBuilderBase]) => {
      const colBuilder = colBuilderBase;
      colBuilder.setName(name2);
      const column = colBuilder.build(rawTable);
      rawTable[InlineForeignKeys$1].push(...colBuilder.buildForeignKeys(column, rawTable));
      return [name2, column];
    })
  );
  const table = Object.assign(rawTable, builtColumns);
  table[Table.Symbol.Columns] = builtColumns;
  table[Table.Symbol.ExtraConfigColumns] = builtColumns;
  if (extraConfig) {
    table[SQLiteTable.Symbol.ExtraConfigBuilder] = extraConfig;
  }
  return table;
}
const sqliteTable = (name, columns, extraConfig) => {
  return sqliteTableBase(name, columns, extraConfig);
};
_Pa = entityKind;
class IndexBuilderOn {
  constructor(name, unique) {
    this.name = name;
    this.unique = unique;
  }
  on(...columns) {
    return new IndexBuilder(this.name, columns, this.unique);
  }
}
__publicField(IndexBuilderOn, _Pa, "SQLiteIndexBuilderOn");
_Qa = entityKind;
class IndexBuilder {
  constructor(name, columns, unique) {
    /** @internal */
    __publicField(this, "config");
    this.config = {
      name,
      columns,
      unique,
      where: void 0
    };
  }
  /**
   * Condition for partial index.
   */
  where(condition) {
    this.config.where = condition;
    return this;
  }
  /** @internal */
  build(table) {
    return new Index(this.config, table);
  }
}
__publicField(IndexBuilder, _Qa, "SQLiteIndexBuilder");
_Ra = entityKind;
class Index {
  constructor(config, table) {
    __publicField(this, "config");
    this.config = { ...config, table };
  }
}
__publicField(Index, _Ra, "SQLiteIndex");
function index(name) {
  return new IndexBuilderOn(name, false);
}
function primaryKey(...config) {
  if (config[0].columns) {
    return new PrimaryKeyBuilder$1(config[0].columns, config[0].name);
  }
  return new PrimaryKeyBuilder$1(config);
}
let PrimaryKeyBuilder$1 = (_Sa = entityKind, _Ta = class {
  constructor(columns, name) {
    /** @internal */
    __publicField(this, "columns");
    /** @internal */
    __publicField(this, "name");
    this.columns = columns;
    this.name = name;
  }
  /** @internal */
  build(table) {
    return new PrimaryKey$1(table, this.columns, this.name);
  }
}, __publicField(_Ta, _Sa, "SQLitePrimaryKeyBuilder"), _Ta);
let PrimaryKey$1 = (_Ua = entityKind, _Va = class {
  constructor(table, columns, name) {
    __publicField(this, "columns");
    __publicField(this, "name");
    this.table = table;
    this.columns = columns;
    this.name = name;
  }
  getName() {
    return this.name ?? `${this.table[SQLiteTable.Symbol.Name]}_${this.columns.map((column) => column.name).join("_")}_pk`;
  }
}, __publicField(_Va, _Ua, "SQLitePrimaryKey"), _Va);
function extractUsedTable(table) {
  if (is(table, SQLiteTable)) {
    return [`${table[Table.Symbol.BaseName]}`];
  }
  if (is(table, Subquery)) {
    return table._.usedTables ?? [];
  }
  if (is(table, SQL)) {
    return table.usedTables ?? [];
  }
  return [];
}
class SQLiteDeleteBase extends (_Xa = QueryPromise, _Wa = entityKind, _Xa) {
  constructor(table, session, dialect, withList) {
    super();
    /** @internal */
    __publicField(this, "config");
    __publicField(this, "run", (placeholderValues) => {
      return this._prepare().run(placeholderValues);
    });
    __publicField(this, "all", (placeholderValues) => {
      return this._prepare().all(placeholderValues);
    });
    __publicField(this, "get", (placeholderValues) => {
      return this._prepare().get(placeholderValues);
    });
    __publicField(this, "values", (placeholderValues) => {
      return this._prepare().values(placeholderValues);
    });
    this.table = table;
    this.session = session;
    this.dialect = dialect;
    this.config = { table, withList };
  }
  /**
   * Adds a `where` clause to the query.
   *
   * Calling this method will delete only those rows that fulfill a specified condition.
   *
   * See docs: {@link https://orm.drizzle.team/docs/delete}
   *
   * @param where the `where` clause.
   *
   * @example
   * You can use conditional operators and `sql function` to filter the rows to be deleted.
   *
   * ```ts
   * // Delete all cars with green color
   * db.delete(cars).where(eq(cars.color, 'green'));
   * // or
   * db.delete(cars).where(sql`${cars.color} = 'green'`)
   * ```
   *
   * You can logically combine conditional operators with `and()` and `or()` operators:
   *
   * ```ts
   * // Delete all BMW cars with a green color
   * db.delete(cars).where(and(eq(cars.color, 'green'), eq(cars.brand, 'BMW')));
   *
   * // Delete all cars with the green or blue color
   * db.delete(cars).where(or(eq(cars.color, 'green'), eq(cars.color, 'blue')));
   * ```
   */
  where(where) {
    this.config.where = where;
    return this;
  }
  orderBy(...columns) {
    if (typeof columns[0] === "function") {
      const orderBy = columns[0](
        new Proxy(
          this.config.table[Table.Symbol.Columns],
          new SelectionProxyHandler({ sqlAliasedBehavior: "alias", sqlBehavior: "sql" })
        )
      );
      const orderByArray = Array.isArray(orderBy) ? orderBy : [orderBy];
      this.config.orderBy = orderByArray;
    } else {
      const orderByArray = columns;
      this.config.orderBy = orderByArray;
    }
    return this;
  }
  limit(limit) {
    this.config.limit = limit;
    return this;
  }
  returning(fields = this.table[SQLiteTable.Symbol.Columns]) {
    this.config.returning = orderSelectedFields(fields);
    return this;
  }
  /** @internal */
  getSQL() {
    return this.dialect.buildDeleteQuery(this.config);
  }
  toSQL() {
    const { typings: _typings, ...rest } = this.dialect.sqlToQuery(this.getSQL());
    return rest;
  }
  /** @internal */
  _prepare(isOneTimeQuery = true) {
    return this.session[isOneTimeQuery ? "prepareOneTimeQuery" : "prepareQuery"](
      this.dialect.sqlToQuery(this.getSQL()),
      this.config.returning,
      this.config.returning ? "all" : "run",
      true,
      void 0,
      {
        type: "delete",
        tables: extractUsedTable(this.config.table)
      }
    );
  }
  prepare() {
    return this._prepare(false);
  }
  async execute(placeholderValues) {
    return this._prepare().execute(placeholderValues);
  }
  $dynamic() {
    return this;
  }
}
__publicField(SQLiteDeleteBase, _Wa, "SQLiteDelete");
function toSnakeCase(input) {
  const words = input.replace(/['\u2019]/g, "").match(/[\da-z]+|[A-Z]+(?![a-z])|[A-Z][\da-z]+/g) ?? [];
  return words.map((word) => word.toLowerCase()).join("_");
}
function toCamelCase(input) {
  const words = input.replace(/['\u2019]/g, "").match(/[\da-z]+|[A-Z]+(?![a-z])|[A-Z][\da-z]+/g) ?? [];
  return words.reduce((acc, word, i) => {
    const formattedWord = i === 0 ? word.toLowerCase() : `${word[0].toUpperCase()}${word.slice(1)}`;
    return acc + formattedWord;
  }, "");
}
function noopCase(input) {
  return input;
}
_Ya = entityKind;
class CasingCache {
  constructor(casing) {
    /** @internal */
    __publicField(this, "cache", {});
    __publicField(this, "cachedTables", {});
    __publicField(this, "convert");
    this.convert = casing === "snake_case" ? toSnakeCase : casing === "camelCase" ? toCamelCase : noopCase;
  }
  getColumnCasing(column) {
    if (!column.keyAsName) return column.name;
    const schema = column.table[Table.Symbol.Schema] ?? "public";
    const tableName = column.table[Table.Symbol.OriginalName];
    const key = `${schema}.${tableName}.${column.name}`;
    if (!this.cache[key]) {
      this.cacheTable(column.table);
    }
    return this.cache[key];
  }
  cacheTable(table) {
    const schema = table[Table.Symbol.Schema] ?? "public";
    const tableName = table[Table.Symbol.OriginalName];
    const tableKey = `${schema}.${tableName}`;
    if (!this.cachedTables[tableKey]) {
      for (const column of Object.values(table[Table.Symbol.Columns])) {
        const columnKey = `${tableKey}.${column.name}`;
        this.cache[columnKey] = this.convert(column.name);
      }
      this.cachedTables[tableKey] = true;
    }
  }
  clearCache() {
    this.cache = {};
    this.cachedTables = {};
  }
}
__publicField(CasingCache, _Ya, "CasingCache");
class DrizzleError extends (__a = Error, _Za = entityKind, __a) {
  constructor({ message, cause }) {
    super(message);
    this.name = "DrizzleError";
    this.cause = cause;
  }
}
__publicField(DrizzleError, _Za, "DrizzleError");
class DrizzleQueryError extends Error {
  constructor(query, params, cause) {
    super(`Failed query: ${query}
params: ${params}`);
    this.query = query;
    this.params = params;
    this.cause = cause;
    Error.captureStackTrace(this, DrizzleQueryError);
    if (cause) this.cause = cause;
  }
}
class TransactionRollbackError extends (_ab = DrizzleError, _$a = entityKind, _ab) {
  constructor() {
    super({ message: "Rollback" });
  }
}
__publicField(TransactionRollbackError, _$a, "TransactionRollbackError");
const InlineForeignKeys = Symbol.for("drizzle:PgInlineForeignKeys");
const EnableRLS = Symbol.for("drizzle:EnableRLS");
class PgTable extends (_gb = Table, _fb = entityKind, _eb = InlineForeignKeys, _db = EnableRLS, _cb = Table.Symbol.ExtraConfigBuilder, _bb = Table.Symbol.ExtraConfigColumns, _gb) {
  constructor() {
    super(...arguments);
    /**@internal */
    __publicField(this, _eb, []);
    /** @internal */
    __publicField(this, _db, false);
    /** @internal */
    __publicField(this, _cb);
    /** @internal */
    __publicField(this, _bb, {});
  }
}
__publicField(PgTable, _fb, "PgTable");
/** @internal */
__publicField(PgTable, "Symbol", Object.assign({}, Table.Symbol, {
  InlineForeignKeys,
  EnableRLS
}));
_hb = entityKind;
class PrimaryKeyBuilder {
  constructor(columns, name) {
    /** @internal */
    __publicField(this, "columns");
    /** @internal */
    __publicField(this, "name");
    this.columns = columns;
    this.name = name;
  }
  /** @internal */
  build(table) {
    return new PrimaryKey(table, this.columns, this.name);
  }
}
__publicField(PrimaryKeyBuilder, _hb, "PgPrimaryKeyBuilder");
_ib = entityKind;
class PrimaryKey {
  constructor(table, columns, name) {
    __publicField(this, "columns");
    __publicField(this, "name");
    this.table = table;
    this.columns = columns;
    this.name = name;
  }
  getName() {
    return this.name ?? `${this.table[PgTable.Symbol.Name]}_${this.columns.map((column) => column.name).join("_")}_pk`;
  }
}
__publicField(PrimaryKey, _ib, "PgPrimaryKey");
function bindIfParam(value, column) {
  if (isDriverValueEncoder(column) && !isSQLWrapper(value) && !is(value, Param) && !is(value, Placeholder) && !is(value, Column) && !is(value, Table) && !is(value, View)) {
    return new Param(value, column);
  }
  return value;
}
const eq = (left, right) => {
  return sql`${left} = ${bindIfParam(right, left)}`;
};
const ne = (left, right) => {
  return sql`${left} <> ${bindIfParam(right, left)}`;
};
function and(...unfilteredConditions) {
  const conditions = unfilteredConditions.filter(
    (c) => c !== void 0
  );
  if (conditions.length === 0) {
    return void 0;
  }
  if (conditions.length === 1) {
    return new SQL(conditions);
  }
  return new SQL([
    new StringChunk("("),
    sql.join(conditions, new StringChunk(" and ")),
    new StringChunk(")")
  ]);
}
function or(...unfilteredConditions) {
  const conditions = unfilteredConditions.filter(
    (c) => c !== void 0
  );
  if (conditions.length === 0) {
    return void 0;
  }
  if (conditions.length === 1) {
    return new SQL(conditions);
  }
  return new SQL([
    new StringChunk("("),
    sql.join(conditions, new StringChunk(" or ")),
    new StringChunk(")")
  ]);
}
function not(condition) {
  return sql`not ${condition}`;
}
const gt = (left, right) => {
  return sql`${left} > ${bindIfParam(right, left)}`;
};
const gte = (left, right) => {
  return sql`${left} >= ${bindIfParam(right, left)}`;
};
const lt = (left, right) => {
  return sql`${left} < ${bindIfParam(right, left)}`;
};
const lte = (left, right) => {
  return sql`${left} <= ${bindIfParam(right, left)}`;
};
function inArray(column, values) {
  if (Array.isArray(values)) {
    if (values.length === 0) {
      return sql`false`;
    }
    return sql`${column} in ${values.map((v) => bindIfParam(v, column))}`;
  }
  return sql`${column} in ${bindIfParam(values, column)}`;
}
function notInArray(column, values) {
  if (Array.isArray(values)) {
    if (values.length === 0) {
      return sql`true`;
    }
    return sql`${column} not in ${values.map((v) => bindIfParam(v, column))}`;
  }
  return sql`${column} not in ${bindIfParam(values, column)}`;
}
function isNull(value) {
  return sql`${value} is null`;
}
function isNotNull(value) {
  return sql`${value} is not null`;
}
function exists(subquery) {
  return sql`exists ${subquery}`;
}
function notExists(subquery) {
  return sql`not exists ${subquery}`;
}
function between(column, min, max) {
  return sql`${column} between ${bindIfParam(min, column)} and ${bindIfParam(
    max,
    column
  )}`;
}
function notBetween(column, min, max) {
  return sql`${column} not between ${bindIfParam(
    min,
    column
  )} and ${bindIfParam(max, column)}`;
}
function like(column, value) {
  return sql`${column} like ${value}`;
}
function notLike(column, value) {
  return sql`${column} not like ${value}`;
}
function ilike(column, value) {
  return sql`${column} ilike ${value}`;
}
function notIlike(column, value) {
  return sql`${column} not ilike ${value}`;
}
function asc(column) {
  return sql`${column} asc`;
}
function desc(column) {
  return sql`${column} desc`;
}
_jb = entityKind;
class Relation {
  constructor(sourceTable, referencedTable, relationName) {
    __publicField(this, "referencedTableName");
    __publicField(this, "fieldName");
    this.sourceTable = sourceTable;
    this.referencedTable = referencedTable;
    this.relationName = relationName;
    this.referencedTableName = referencedTable[Table.Symbol.Name];
  }
}
__publicField(Relation, _jb, "Relation");
_kb = entityKind;
class Relations {
  constructor(table, config) {
    this.table = table;
    this.config = config;
  }
}
__publicField(Relations, _kb, "Relations");
const _One = class _One extends (_mb = Relation, _lb = entityKind, _mb) {
  constructor(sourceTable, referencedTable, config, isNullable) {
    super(sourceTable, referencedTable, config == null ? void 0 : config.relationName);
    this.config = config;
    this.isNullable = isNullable;
  }
  withFieldName(fieldName) {
    const relation = new _One(
      this.sourceTable,
      this.referencedTable,
      this.config,
      this.isNullable
    );
    relation.fieldName = fieldName;
    return relation;
  }
};
__publicField(_One, _lb, "One");
let One = _One;
const _Many = class _Many extends (_ob = Relation, _nb = entityKind, _ob) {
  constructor(sourceTable, referencedTable, config) {
    super(sourceTable, referencedTable, config == null ? void 0 : config.relationName);
    this.config = config;
  }
  withFieldName(fieldName) {
    const relation = new _Many(
      this.sourceTable,
      this.referencedTable,
      this.config
    );
    relation.fieldName = fieldName;
    return relation;
  }
};
__publicField(_Many, _nb, "Many");
let Many = _Many;
function getOperators() {
  return {
    and,
    between,
    eq,
    exists,
    gt,
    gte,
    ilike,
    inArray,
    isNull,
    isNotNull,
    like,
    lt,
    lte,
    ne,
    not,
    notBetween,
    notExists,
    notLike,
    notIlike,
    notInArray,
    or,
    sql
  };
}
function getOrderByOperators() {
  return {
    sql,
    asc,
    desc
  };
}
function extractTablesRelationalConfig(schema, configHelpers) {
  var _a2;
  if (Object.keys(schema).length === 1 && "default" in schema && !is(schema["default"], Table)) {
    schema = schema["default"];
  }
  const tableNamesMap = {};
  const relationsBuffer = {};
  const tablesConfig = {};
  for (const [key, value] of Object.entries(schema)) {
    if (is(value, Table)) {
      const dbName = getTableUniqueName(value);
      const bufferedRelations = relationsBuffer[dbName];
      tableNamesMap[dbName] = key;
      tablesConfig[key] = {
        tsName: key,
        dbName: value[Table.Symbol.Name],
        schema: value[Table.Symbol.Schema],
        columns: value[Table.Symbol.Columns],
        relations: (bufferedRelations == null ? void 0 : bufferedRelations.relations) ?? {},
        primaryKey: (bufferedRelations == null ? void 0 : bufferedRelations.primaryKey) ?? []
      };
      for (const column of Object.values(
        value[Table.Symbol.Columns]
      )) {
        if (column.primary) {
          tablesConfig[key].primaryKey.push(column);
        }
      }
      const extraConfig = (_a2 = value[Table.Symbol.ExtraConfigBuilder]) == null ? void 0 : _a2.call(value, value[Table.Symbol.ExtraConfigColumns]);
      if (extraConfig) {
        for (const configEntry of Object.values(extraConfig)) {
          if (is(configEntry, PrimaryKeyBuilder)) {
            tablesConfig[key].primaryKey.push(...configEntry.columns);
          }
        }
      }
    } else if (is(value, Relations)) {
      const dbName = getTableUniqueName(value.table);
      const tableName = tableNamesMap[dbName];
      const relations2 = value.config(
        configHelpers(value.table)
      );
      let primaryKey2;
      for (const [relationName, relation] of Object.entries(relations2)) {
        if (tableName) {
          const tableConfig = tablesConfig[tableName];
          tableConfig.relations[relationName] = relation;
        } else {
          if (!(dbName in relationsBuffer)) {
            relationsBuffer[dbName] = {
              relations: {},
              primaryKey: primaryKey2
            };
          }
          relationsBuffer[dbName].relations[relationName] = relation;
        }
      }
    }
  }
  return { tables: tablesConfig, tableNamesMap };
}
function createOne(sourceTable) {
  return function one(table, config) {
    return new One(
      sourceTable,
      table,
      config,
      (config == null ? void 0 : config.fields.reduce((res, f) => res && f.notNull, true)) ?? false
    );
  };
}
function createMany(sourceTable) {
  return function many(referencedTable, config) {
    return new Many(sourceTable, referencedTable, config);
  };
}
function normalizeRelation(schema, tableNamesMap, relation) {
  if (is(relation, One) && relation.config) {
    return {
      fields: relation.config.fields,
      references: relation.config.references
    };
  }
  const referencedTableTsName = tableNamesMap[getTableUniqueName(relation.referencedTable)];
  if (!referencedTableTsName) {
    throw new Error(
      `Table "${relation.referencedTable[Table.Symbol.Name]}" not found in schema`
    );
  }
  const referencedTableConfig = schema[referencedTableTsName];
  if (!referencedTableConfig) {
    throw new Error(`Table "${referencedTableTsName}" not found in schema`);
  }
  const sourceTable = relation.sourceTable;
  const sourceTableTsName = tableNamesMap[getTableUniqueName(sourceTable)];
  if (!sourceTableTsName) {
    throw new Error(
      `Table "${sourceTable[Table.Symbol.Name]}" not found in schema`
    );
  }
  const reverseRelations = [];
  for (const referencedTableRelation of Object.values(
    referencedTableConfig.relations
  )) {
    if (relation.relationName && relation !== referencedTableRelation && referencedTableRelation.relationName === relation.relationName || !relation.relationName && referencedTableRelation.referencedTable === relation.sourceTable) {
      reverseRelations.push(referencedTableRelation);
    }
  }
  if (reverseRelations.length > 1) {
    throw relation.relationName ? new Error(
      `There are multiple relations with name "${relation.relationName}" in table "${referencedTableTsName}"`
    ) : new Error(
      `There are multiple relations between "${referencedTableTsName}" and "${relation.sourceTable[Table.Symbol.Name]}". Please specify relation name`
    );
  }
  if (reverseRelations[0] && is(reverseRelations[0], One) && reverseRelations[0].config) {
    return {
      fields: reverseRelations[0].config.references,
      references: reverseRelations[0].config.fields
    };
  }
  throw new Error(
    `There is not enough information to infer relation "${sourceTableTsName}.${relation.fieldName}"`
  );
}
function createTableRelationsHelpers(sourceTable) {
  return {
    one: createOne(sourceTable),
    many: createMany(sourceTable)
  };
}
function mapRelationalRow(tablesConfig, tableConfig, row, buildQueryResultSelection, mapColumnValue = (value) => value) {
  const result = {};
  for (const [
    selectionItemIndex,
    selectionItem
  ] of buildQueryResultSelection.entries()) {
    if (selectionItem.isJson) {
      const relation = tableConfig.relations[selectionItem.tsKey];
      const rawSubRows = row[selectionItemIndex];
      const subRows = typeof rawSubRows === "string" ? JSON.parse(rawSubRows) : rawSubRows;
      result[selectionItem.tsKey] = is(relation, One) ? subRows && mapRelationalRow(
        tablesConfig,
        tablesConfig[selectionItem.relationTableTsKey],
        subRows,
        selectionItem.selection,
        mapColumnValue
      ) : subRows.map(
        (subRow) => mapRelationalRow(
          tablesConfig,
          tablesConfig[selectionItem.relationTableTsKey],
          subRow,
          selectionItem.selection,
          mapColumnValue
        )
      );
    } else {
      const value = mapColumnValue(row[selectionItemIndex]);
      const field = selectionItem.field;
      let decoder;
      if (is(field, Column)) {
        decoder = field;
      } else if (is(field, SQL)) {
        decoder = field.decoder;
      } else {
        decoder = field.sql.decoder;
      }
      result[selectionItem.tsKey] = value === null ? null : decoder.mapFromDriverValue(value);
    }
  }
  return result;
}
class SQLiteViewBase extends (_qb = View, _pb = entityKind, _qb) {
}
__publicField(SQLiteViewBase, _pb, "SQLiteViewBase");
_rb = entityKind;
class SQLiteDialect {
  constructor(config) {
    /** @internal */
    __publicField(this, "casing");
    this.casing = new CasingCache(config == null ? void 0 : config.casing);
  }
  escapeName(name) {
    return `"${name.replace(/"/g, '""')}"`;
  }
  escapeParam(_num) {
    return "?";
  }
  escapeString(str) {
    return `'${str.replace(/'/g, "''")}'`;
  }
  buildWithCTE(queries) {
    if (!(queries == null ? void 0 : queries.length)) return void 0;
    const withSqlChunks = [sql`with `];
    for (const [i, w] of queries.entries()) {
      withSqlChunks.push(sql`${sql.identifier(w._.alias)} as (${w._.sql})`);
      if (i < queries.length - 1) {
        withSqlChunks.push(sql`, `);
      }
    }
    withSqlChunks.push(sql` `);
    return sql.join(withSqlChunks);
  }
  buildDeleteQuery({
    table,
    where,
    returning,
    withList,
    limit,
    orderBy
  }) {
    const withSql = this.buildWithCTE(withList);
    const returningSql = returning ? sql` returning ${this.buildSelection(returning, { isSingleTable: true })}` : void 0;
    const whereSql = where ? sql` where ${where}` : void 0;
    const orderBySql = this.buildOrderBy(orderBy);
    const limitSql = this.buildLimit(limit);
    return sql`${withSql}delete from ${table}${whereSql}${returningSql}${orderBySql}${limitSql}`;
  }
  buildUpdateSet(table, set) {
    const tableColumns = table[Table.Symbol.Columns];
    const columnNames = Object.keys(tableColumns).filter(
      (colName) => {
        var _a2;
        return set[colName] !== void 0 || ((_a2 = tableColumns[colName]) == null ? void 0 : _a2.onUpdateFn) !== void 0;
      }
    );
    const setSize = columnNames.length;
    return sql.join(
      columnNames.flatMap((colName, i) => {
        var _a2;
        const col = tableColumns[colName];
        const onUpdateFnResult = (_a2 = col.onUpdateFn) == null ? void 0 : _a2.call(col);
        const value = set[colName] ?? (is(onUpdateFnResult, SQL) ? onUpdateFnResult : sql.param(onUpdateFnResult, col));
        const res = sql`${sql.identifier(this.casing.getColumnCasing(col))} = ${value}`;
        if (i < setSize - 1) {
          return [res, sql.raw(", ")];
        }
        return [res];
      })
    );
  }
  buildUpdateQuery({
    table,
    set,
    where,
    returning,
    withList,
    joins,
    from,
    limit,
    orderBy
  }) {
    const withSql = this.buildWithCTE(withList);
    const setSql = this.buildUpdateSet(table, set);
    const fromSql = from && sql.join([sql.raw(" from "), this.buildFromTable(from)]);
    const joinsSql = this.buildJoins(joins);
    const returningSql = returning ? sql` returning ${this.buildSelection(returning, { isSingleTable: true })}` : void 0;
    const whereSql = where ? sql` where ${where}` : void 0;
    const orderBySql = this.buildOrderBy(orderBy);
    const limitSql = this.buildLimit(limit);
    return sql`${withSql}update ${table} set ${setSql}${fromSql}${joinsSql}${whereSql}${returningSql}${orderBySql}${limitSql}`;
  }
  /**
   * Builds selection SQL with provided fields/expressions
   *
   * Examples:
   *
   * `select <selection> from`
   *
   * `insert ... returning <selection>`
   *
   * If `isSingleTable` is true, then columns won't be prefixed with table name
   */
  buildSelection(fields, { isSingleTable = false } = {}) {
    const columnsLen = fields.length;
    const chunks = fields.flatMap(({ field }, i) => {
      const chunk = [];
      if (is(field, SQL.Aliased) && field.isSelectionField) {
        chunk.push(sql.identifier(field.fieldAlias));
      } else if (is(field, SQL.Aliased) || is(field, SQL)) {
        const query = is(field, SQL.Aliased) ? field.sql : field;
        if (isSingleTable) {
          chunk.push(
            new SQL(
              query.queryChunks.map((c) => {
                if (is(c, Column)) {
                  return sql.identifier(this.casing.getColumnCasing(c));
                }
                return c;
              })
            )
          );
        } else {
          chunk.push(query);
        }
        if (is(field, SQL.Aliased)) {
          chunk.push(sql` as ${sql.identifier(field.fieldAlias)}`);
        }
      } else if (is(field, Column)) {
        const tableName = field.table[Table.Symbol.Name];
        if (field.columnType === "SQLiteNumericBigInt") {
          if (isSingleTable) {
            chunk.push(
              sql`cast(${sql.identifier(this.casing.getColumnCasing(field))} as text)`
            );
          } else {
            chunk.push(
              sql`cast(${sql.identifier(tableName)}.${sql.identifier(this.casing.getColumnCasing(field))} as text)`
            );
          }
        } else {
          if (isSingleTable) {
            chunk.push(sql.identifier(this.casing.getColumnCasing(field)));
          } else {
            chunk.push(
              sql`${sql.identifier(tableName)}.${sql.identifier(this.casing.getColumnCasing(field))}`
            );
          }
        }
      } else if (is(field, Subquery)) {
        const entries = Object.entries(field._.selectedFields);
        if (entries.length === 1) {
          const entry = entries[0][1];
          const fieldDecoder = is(entry, SQL) ? entry.decoder : is(entry, Column) ? { mapFromDriverValue: (v) => entry.mapFromDriverValue(v) } : entry.sql.decoder;
          if (fieldDecoder) field._.sql.decoder = fieldDecoder;
        }
        chunk.push(field);
      }
      if (i < columnsLen - 1) {
        chunk.push(sql`, `);
      }
      return chunk;
    });
    return sql.join(chunks);
  }
  buildJoins(joins) {
    if (!joins || joins.length === 0) {
      return void 0;
    }
    const joinsArray = [];
    if (joins) {
      for (const [index2, joinMeta] of joins.entries()) {
        if (index2 === 0) {
          joinsArray.push(sql` `);
        }
        const table = joinMeta.table;
        const onSql = joinMeta.on ? sql` on ${joinMeta.on}` : void 0;
        if (is(table, SQLiteTable)) {
          const tableName = table[SQLiteTable.Symbol.Name];
          const tableSchema = table[SQLiteTable.Symbol.Schema];
          const origTableName = table[SQLiteTable.Symbol.OriginalName];
          const alias = tableName === origTableName ? void 0 : joinMeta.alias;
          joinsArray.push(
            sql`${sql.raw(joinMeta.joinType)} join ${tableSchema ? sql`${sql.identifier(tableSchema)}.` : void 0}${sql.identifier(
              origTableName
            )}${alias && sql` ${sql.identifier(alias)}`}${onSql}`
          );
        } else {
          joinsArray.push(
            sql`${sql.raw(joinMeta.joinType)} join ${table}${onSql}`
          );
        }
        if (index2 < joins.length - 1) {
          joinsArray.push(sql` `);
        }
      }
    }
    return sql.join(joinsArray);
  }
  buildLimit(limit) {
    return typeof limit === "object" || typeof limit === "number" && limit >= 0 ? sql` limit ${limit}` : void 0;
  }
  buildOrderBy(orderBy) {
    const orderByList = [];
    if (orderBy) {
      for (const [index2, orderByValue] of orderBy.entries()) {
        orderByList.push(orderByValue);
        if (index2 < orderBy.length - 1) {
          orderByList.push(sql`, `);
        }
      }
    }
    return orderByList.length > 0 ? sql` order by ${sql.join(orderByList)}` : void 0;
  }
  buildFromTable(table) {
    if (is(table, Table) && table[Table.Symbol.IsAlias]) {
      return sql`${sql`${sql.identifier(table[Table.Symbol.Schema] ?? "")}.`.if(table[Table.Symbol.Schema])}${sql.identifier(
        table[Table.Symbol.OriginalName]
      )} ${sql.identifier(table[Table.Symbol.Name])}`;
    }
    return table;
  }
  buildSelectQuery({
    withList,
    fields,
    fieldsFlat,
    where,
    having,
    table,
    joins,
    orderBy,
    groupBy,
    limit,
    offset,
    distinct,
    setOperators
  }) {
    const fieldsList = fieldsFlat ?? orderSelectedFields(fields);
    for (const f of fieldsList) {
      if (is(f.field, Column) && getTableName(f.field.table) !== (is(table, Subquery) ? table._.alias : is(table, SQLiteViewBase) ? table[ViewBaseConfig].name : is(table, SQL) ? void 0 : getTableName(table)) && !((table2) => joins == null ? void 0 : joins.some(
        ({ alias }) => alias === (table2[Table.Symbol.IsAlias] ? getTableName(table2) : table2[Table.Symbol.BaseName])
      ))(f.field.table)) {
        const tableName = getTableName(f.field.table);
        throw new Error(
          `Your "${f.path.join(
            "->"
          )}" field references a column "${tableName}"."${f.field.name}", but the table "${tableName}" is not part of the query! Did you forget to join it?`
        );
      }
    }
    const isSingleTable = !joins || joins.length === 0;
    const withSql = this.buildWithCTE(withList);
    const distinctSql = distinct ? sql` distinct` : void 0;
    const selection = this.buildSelection(fieldsList, { isSingleTable });
    const tableSql = this.buildFromTable(table);
    const joinsSql = this.buildJoins(joins);
    const whereSql = where ? sql` where ${where}` : void 0;
    const havingSql = having ? sql` having ${having}` : void 0;
    const groupByList = [];
    if (groupBy) {
      for (const [index2, groupByValue] of groupBy.entries()) {
        groupByList.push(groupByValue);
        if (index2 < groupBy.length - 1) {
          groupByList.push(sql`, `);
        }
      }
    }
    const groupBySql = groupByList.length > 0 ? sql` group by ${sql.join(groupByList)}` : void 0;
    const orderBySql = this.buildOrderBy(orderBy);
    const limitSql = this.buildLimit(limit);
    const offsetSql = offset ? sql` offset ${offset}` : void 0;
    const finalQuery = sql`${withSql}select${distinctSql} ${selection} from ${tableSql}${joinsSql}${whereSql}${groupBySql}${havingSql}${orderBySql}${limitSql}${offsetSql}`;
    if (setOperators.length > 0) {
      return this.buildSetOperations(finalQuery, setOperators);
    }
    return finalQuery;
  }
  buildSetOperations(leftSelect, setOperators) {
    const [setOperator, ...rest] = setOperators;
    if (!setOperator) {
      throw new Error("Cannot pass undefined values to any set operator");
    }
    if (rest.length === 0) {
      return this.buildSetOperationQuery({ leftSelect, setOperator });
    }
    return this.buildSetOperations(
      this.buildSetOperationQuery({ leftSelect, setOperator }),
      rest
    );
  }
  buildSetOperationQuery({
    leftSelect,
    setOperator: { type, isAll, rightSelect, limit, orderBy, offset }
  }) {
    const leftChunk = sql`${leftSelect.getSQL()} `;
    const rightChunk = sql`${rightSelect.getSQL()}`;
    let orderBySql;
    if (orderBy && orderBy.length > 0) {
      const orderByValues = [];
      for (const singleOrderBy of orderBy) {
        if (is(singleOrderBy, SQLiteColumn)) {
          orderByValues.push(sql.identifier(singleOrderBy.name));
        } else if (is(singleOrderBy, SQL)) {
          for (let i = 0; i < singleOrderBy.queryChunks.length; i++) {
            const chunk = singleOrderBy.queryChunks[i];
            if (is(chunk, SQLiteColumn)) {
              singleOrderBy.queryChunks[i] = sql.identifier(
                this.casing.getColumnCasing(chunk)
              );
            }
          }
          orderByValues.push(sql`${singleOrderBy}`);
        } else {
          orderByValues.push(sql`${singleOrderBy}`);
        }
      }
      orderBySql = sql` order by ${sql.join(orderByValues, sql`, `)}`;
    }
    const limitSql = typeof limit === "object" || typeof limit === "number" && limit >= 0 ? sql` limit ${limit}` : void 0;
    const operatorChunk = sql.raw(`${type} ${isAll ? "all " : ""}`);
    const offsetSql = offset ? sql` offset ${offset}` : void 0;
    return sql`${leftChunk}${operatorChunk}${rightChunk}${orderBySql}${limitSql}${offsetSql}`;
  }
  buildInsertQuery({
    table,
    values: valuesOrSelect,
    onConflict,
    returning,
    withList,
    select
  }) {
    const valuesSqlList = [];
    const columns = table[Table.Symbol.Columns];
    const colEntries = Object.entries(columns).filter(
      ([_, col]) => !col.shouldDisableInsert()
    );
    const insertOrder = colEntries.map(([, column]) => sql.identifier(this.casing.getColumnCasing(column)));
    if (select) {
      const select2 = valuesOrSelect;
      if (is(select2, SQL)) {
        valuesSqlList.push(select2);
      } else {
        valuesSqlList.push(select2.getSQL());
      }
    } else {
      const values = valuesOrSelect;
      valuesSqlList.push(sql.raw("values "));
      for (const [valueIndex, value] of values.entries()) {
        const valueList = [];
        for (const [fieldName, col] of colEntries) {
          const colValue = value[fieldName];
          if (colValue === void 0 || is(colValue, Param) && colValue.value === void 0) {
            let defaultValue;
            if (col.default !== null && col.default !== void 0) {
              defaultValue = is(col.default, SQL) ? col.default : sql.param(col.default, col);
            } else if (col.defaultFn !== void 0) {
              const defaultFnResult = col.defaultFn();
              defaultValue = is(defaultFnResult, SQL) ? defaultFnResult : sql.param(defaultFnResult, col);
            } else if (!col.default && col.onUpdateFn !== void 0) {
              const onUpdateFnResult = col.onUpdateFn();
              defaultValue = is(onUpdateFnResult, SQL) ? onUpdateFnResult : sql.param(onUpdateFnResult, col);
            } else {
              defaultValue = sql`null`;
            }
            valueList.push(defaultValue);
          } else {
            valueList.push(colValue);
          }
        }
        valuesSqlList.push(valueList);
        if (valueIndex < values.length - 1) {
          valuesSqlList.push(sql`, `);
        }
      }
    }
    const withSql = this.buildWithCTE(withList);
    const valuesSql = sql.join(valuesSqlList);
    const returningSql = returning ? sql` returning ${this.buildSelection(returning, { isSingleTable: true })}` : void 0;
    const onConflictSql = (onConflict == null ? void 0 : onConflict.length) ? sql.join(onConflict) : void 0;
    return sql`${withSql}insert into ${table} ${insertOrder} ${valuesSql}${onConflictSql}${returningSql}`;
  }
  sqlToQuery(sql2, invokeSource) {
    return sql2.toQuery({
      casing: this.casing,
      escapeName: this.escapeName,
      escapeParam: this.escapeParam,
      escapeString: this.escapeString,
      invokeSource
    });
  }
  buildRelationalQuery({
    fullSchema,
    schema,
    tableNamesMap,
    table,
    tableConfig,
    queryConfig: config,
    tableAlias,
    nestedQueryRelation,
    joinOn
  }) {
    let selection = [];
    let limit, offset, orderBy = [], where;
    const joins = [];
    if (config === true) {
      const selectionEntries = Object.entries(tableConfig.columns);
      selection = selectionEntries.map(([key, value]) => ({
        dbKey: value.name,
        tsKey: key,
        field: aliasedTableColumn(value, tableAlias),
        relationTableTsKey: void 0,
        isJson: false,
        selection: []
      }));
    } else {
      const aliasedColumns = Object.fromEntries(
        Object.entries(tableConfig.columns).map(([key, value]) => [
          key,
          aliasedTableColumn(value, tableAlias)
        ])
      );
      if (config.where) {
        const whereSql = typeof config.where === "function" ? config.where(aliasedColumns, getOperators()) : config.where;
        where = whereSql && mapColumnsInSQLToAlias(whereSql, tableAlias);
      }
      const fieldsSelection = [];
      let selectedColumns = [];
      if (config.columns) {
        let isIncludeMode = false;
        for (const [field, value] of Object.entries(config.columns)) {
          if (value === void 0) {
            continue;
          }
          if (field in tableConfig.columns) {
            if (!isIncludeMode && value === true) {
              isIncludeMode = true;
            }
            selectedColumns.push(field);
          }
        }
        if (selectedColumns.length > 0) {
          selectedColumns = isIncludeMode ? selectedColumns.filter((c) => {
            var _a2;
            return ((_a2 = config.columns) == null ? void 0 : _a2[c]) === true;
          }) : Object.keys(tableConfig.columns).filter(
            (key) => !selectedColumns.includes(key)
          );
        }
      } else {
        selectedColumns = Object.keys(tableConfig.columns);
      }
      for (const field of selectedColumns) {
        const column = tableConfig.columns[field];
        fieldsSelection.push({ tsKey: field, value: column });
      }
      let selectedRelations = [];
      if (config.with) {
        selectedRelations = Object.entries(config.with).filter(
          (entry) => !!entry[1]
        ).map(([tsKey, queryConfig]) => ({
          tsKey,
          queryConfig,
          relation: tableConfig.relations[tsKey]
        }));
      }
      let extras;
      if (config.extras) {
        extras = typeof config.extras === "function" ? config.extras(aliasedColumns, { sql }) : config.extras;
        for (const [tsKey, value] of Object.entries(extras)) {
          fieldsSelection.push({
            tsKey,
            value: mapColumnsInAliasedSQLToAlias(value, tableAlias)
          });
        }
      }
      for (const { tsKey, value } of fieldsSelection) {
        selection.push({
          dbKey: is(value, SQL.Aliased) ? value.fieldAlias : tableConfig.columns[tsKey].name,
          tsKey,
          field: is(value, Column) ? aliasedTableColumn(value, tableAlias) : value,
          relationTableTsKey: void 0,
          isJson: false,
          selection: []
        });
      }
      let orderByOrig = typeof config.orderBy === "function" ? config.orderBy(aliasedColumns, getOrderByOperators()) : config.orderBy ?? [];
      if (!Array.isArray(orderByOrig)) {
        orderByOrig = [orderByOrig];
      }
      orderBy = orderByOrig.map((orderByValue) => {
        if (is(orderByValue, Column)) {
          return aliasedTableColumn(orderByValue, tableAlias);
        }
        return mapColumnsInSQLToAlias(orderByValue, tableAlias);
      });
      limit = config.limit;
      offset = config.offset;
      for (const {
        tsKey: selectedRelationTsKey,
        queryConfig: selectedRelationConfigValue,
        relation
      } of selectedRelations) {
        const normalizedRelation = normalizeRelation(
          schema,
          tableNamesMap,
          relation
        );
        const relationTableName = getTableUniqueName(relation.referencedTable);
        const relationTableTsName = tableNamesMap[relationTableName];
        const relationTableAlias = `${tableAlias}_${selectedRelationTsKey}`;
        const joinOn2 = and(
          ...normalizedRelation.fields.map(
            (field2, i) => eq(
              aliasedTableColumn(
                normalizedRelation.references[i],
                relationTableAlias
              ),
              aliasedTableColumn(field2, tableAlias)
            )
          )
        );
        const builtRelation = this.buildRelationalQuery({
          fullSchema,
          schema,
          tableNamesMap,
          table: fullSchema[relationTableTsName],
          tableConfig: schema[relationTableTsName],
          queryConfig: is(relation, One) ? selectedRelationConfigValue === true ? { limit: 1 } : { ...selectedRelationConfigValue, limit: 1 } : selectedRelationConfigValue,
          tableAlias: relationTableAlias,
          joinOn: joinOn2,
          nestedQueryRelation: relation
        });
        const field = sql`(${builtRelation.sql})`.as(selectedRelationTsKey);
        selection.push({
          dbKey: selectedRelationTsKey,
          tsKey: selectedRelationTsKey,
          field,
          relationTableTsKey: relationTableTsName,
          isJson: true,
          selection: builtRelation.selection
        });
      }
    }
    if (selection.length === 0) {
      throw new DrizzleError({
        message: `No fields selected for table "${tableConfig.tsName}" ("${tableAlias}"). You need to have at least one item in "columns", "with" or "extras". If you need to select all columns, omit the "columns" key or set it to undefined.`
      });
    }
    let result;
    where = and(joinOn, where);
    if (nestedQueryRelation) {
      let field = sql`json_array(${sql.join(
        selection.map(
          ({ field: field2 }) => is(field2, SQLiteColumn) ? sql.identifier(this.casing.getColumnCasing(field2)) : is(field2, SQL.Aliased) ? field2.sql : field2
        ),
        sql`, `
      )})`;
      if (is(nestedQueryRelation, Many)) {
        field = sql`coalesce(json_group_array(${field}), json_array())`;
      }
      const nestedSelection = [
        {
          dbKey: "data",
          tsKey: "data",
          field: field.as("data"),
          isJson: true,
          relationTableTsKey: tableConfig.tsName,
          selection
        }
      ];
      const needsSubquery = limit !== void 0 || offset !== void 0 || orderBy.length > 0;
      if (needsSubquery) {
        result = this.buildSelectQuery({
          table: aliasedTable(table, tableAlias),
          fields: {},
          fieldsFlat: [
            {
              path: [],
              field: sql.raw("*")
            }
          ],
          where,
          limit,
          offset,
          orderBy,
          setOperators: []
        });
        where = void 0;
        limit = void 0;
        offset = void 0;
        orderBy = void 0;
      } else {
        result = aliasedTable(table, tableAlias);
      }
      result = this.buildSelectQuery({
        table: is(result, SQLiteTable) ? result : new Subquery(result, {}, tableAlias),
        fields: {},
        fieldsFlat: nestedSelection.map(({ field: field2 }) => ({
          path: [],
          field: is(field2, Column) ? aliasedTableColumn(field2, tableAlias) : field2
        })),
        joins,
        where,
        limit,
        offset,
        orderBy,
        setOperators: []
      });
    } else {
      result = this.buildSelectQuery({
        table: aliasedTable(table, tableAlias),
        fields: {},
        fieldsFlat: selection.map(({ field }) => ({
          path: [],
          field: is(field, Column) ? aliasedTableColumn(field, tableAlias) : field
        })),
        joins,
        where,
        limit,
        offset,
        orderBy,
        setOperators: []
      });
    }
    return {
      tableTsKey: tableConfig.tsName,
      sql: result,
      selection
    };
  }
}
__publicField(SQLiteDialect, _rb, "SQLiteDialect");
class SQLiteSyncDialect extends (_tb = SQLiteDialect, _sb = entityKind, _tb) {
  migrate(migrations, session, config) {
    const migrationsTable = config === void 0 ? "__drizzle_migrations" : typeof config === "string" ? "__drizzle_migrations" : config.migrationsTable ?? "__drizzle_migrations";
    const migrationTableCreate = sql`
			CREATE TABLE IF NOT EXISTS ${sql.identifier(migrationsTable)} (
				id SERIAL PRIMARY KEY,
				hash text NOT NULL,
				created_at numeric
			)
		`;
    session.run(migrationTableCreate);
    const dbMigrations = session.values(
      sql`SELECT id, hash, created_at FROM ${sql.identifier(migrationsTable)} ORDER BY created_at DESC LIMIT 1`
    );
    const lastDbMigration = dbMigrations[0] ?? void 0;
    session.run(sql`BEGIN`);
    try {
      for (const migration of migrations) {
        if (!lastDbMigration || Number(lastDbMigration[2]) < migration.folderMillis) {
          for (const stmt of migration.sql) {
            session.run(sql.raw(stmt));
          }
          session.run(
            sql`INSERT INTO ${sql.identifier(
              migrationsTable
            )} ("hash", "created_at") VALUES(${migration.hash}, ${migration.folderMillis})`
          );
        }
      }
      session.run(sql`COMMIT`);
    } catch (e) {
      session.run(sql`ROLLBACK`);
      throw e;
    }
  }
}
__publicField(SQLiteSyncDialect, _sb, "SQLiteSyncDialect");
_ub = entityKind;
class TypedQueryBuilder {
  /** @internal */
  getSelectedFields() {
    return this._.selectedFields;
  }
}
__publicField(TypedQueryBuilder, _ub, "TypedQueryBuilder");
_vb = entityKind;
class SQLiteSelectBuilder {
  constructor(config) {
    __publicField(this, "fields");
    __publicField(this, "session");
    __publicField(this, "dialect");
    __publicField(this, "withList");
    __publicField(this, "distinct");
    this.fields = config.fields;
    this.session = config.session;
    this.dialect = config.dialect;
    this.withList = config.withList;
    this.distinct = config.distinct;
  }
  from(source) {
    const isPartialSelect = !!this.fields;
    let fields;
    if (this.fields) {
      fields = this.fields;
    } else if (is(source, Subquery)) {
      fields = Object.fromEntries(
        Object.keys(source._.selectedFields).map((key) => [key, source[key]])
      );
    } else if (is(source, SQLiteViewBase)) {
      fields = source[ViewBaseConfig].selectedFields;
    } else if (is(source, SQL)) {
      fields = {};
    } else {
      fields = getTableColumns(source);
    }
    return new SQLiteSelectBase({
      table: source,
      fields,
      isPartialSelect,
      session: this.session,
      dialect: this.dialect,
      withList: this.withList,
      distinct: this.distinct
    });
  }
}
__publicField(SQLiteSelectBuilder, _vb, "SQLiteSelectBuilder");
class SQLiteSelectQueryBuilderBase extends (_xb = TypedQueryBuilder, _wb = entityKind, _xb) {
  constructor({ table, fields, isPartialSelect, session, dialect, withList, distinct }) {
    super();
    __publicField(this, "_");
    /** @internal */
    __publicField(this, "config");
    __publicField(this, "joinsNotNullableMap");
    __publicField(this, "tableName");
    __publicField(this, "isPartialSelect");
    __publicField(this, "session");
    __publicField(this, "dialect");
    __publicField(this, "cacheConfig");
    __publicField(this, "usedTables", /* @__PURE__ */ new Set());
    /**
     * Executes a `left join` operation by adding another table to the current query.
     *
     * Calling this method associates each row of the table with the corresponding row from the joined table, if a match is found. If no matching row exists, it sets all columns of the joined table to null.
     *
     * See docs: {@link https://orm.drizzle.team/docs/joins#left-join}
     *
     * @param table the table to join.
     * @param on the `on` clause.
     *
     * @example
     *
     * ```ts
     * // Select all users and their pets
     * const usersWithPets: { user: User; pets: Pet | null; }[] = await db.select()
     *   .from(users)
     *   .leftJoin(pets, eq(users.id, pets.ownerId))
     *
     * // Select userId and petId
     * const usersIdsAndPetIds: { userId: number; petId: number | null; }[] = await db.select({
     *   userId: users.id,
     *   petId: pets.id,
     * })
     *   .from(users)
     *   .leftJoin(pets, eq(users.id, pets.ownerId))
     * ```
     */
    __publicField(this, "leftJoin", this.createJoin("left"));
    /**
     * Executes a `right join` operation by adding another table to the current query.
     *
     * Calling this method associates each row of the joined table with the corresponding row from the main table, if a match is found. If no matching row exists, it sets all columns of the main table to null.
     *
     * See docs: {@link https://orm.drizzle.team/docs/joins#right-join}
     *
     * @param table the table to join.
     * @param on the `on` clause.
     *
     * @example
     *
     * ```ts
     * // Select all users and their pets
     * const usersWithPets: { user: User | null; pets: Pet; }[] = await db.select()
     *   .from(users)
     *   .rightJoin(pets, eq(users.id, pets.ownerId))
     *
     * // Select userId and petId
     * const usersIdsAndPetIds: { userId: number | null; petId: number; }[] = await db.select({
     *   userId: users.id,
     *   petId: pets.id,
     * })
     *   .from(users)
     *   .rightJoin(pets, eq(users.id, pets.ownerId))
     * ```
     */
    __publicField(this, "rightJoin", this.createJoin("right"));
    /**
     * Executes an `inner join` operation, creating a new table by combining rows from two tables that have matching values.
     *
     * Calling this method retrieves rows that have corresponding entries in both joined tables. Rows without matching entries in either table are excluded, resulting in a table that includes only matching pairs.
     *
     * See docs: {@link https://orm.drizzle.team/docs/joins#inner-join}
     *
     * @param table the table to join.
     * @param on the `on` clause.
     *
     * @example
     *
     * ```ts
     * // Select all users and their pets
     * const usersWithPets: { user: User; pets: Pet; }[] = await db.select()
     *   .from(users)
     *   .innerJoin(pets, eq(users.id, pets.ownerId))
     *
     * // Select userId and petId
     * const usersIdsAndPetIds: { userId: number; petId: number; }[] = await db.select({
     *   userId: users.id,
     *   petId: pets.id,
     * })
     *   .from(users)
     *   .innerJoin(pets, eq(users.id, pets.ownerId))
     * ```
     */
    __publicField(this, "innerJoin", this.createJoin("inner"));
    /**
     * Executes a `full join` operation by combining rows from two tables into a new table.
     *
     * Calling this method retrieves all rows from both main and joined tables, merging rows with matching values and filling in `null` for non-matching columns.
     *
     * See docs: {@link https://orm.drizzle.team/docs/joins#full-join}
     *
     * @param table the table to join.
     * @param on the `on` clause.
     *
     * @example
     *
     * ```ts
     * // Select all users and their pets
     * const usersWithPets: { user: User | null; pets: Pet | null; }[] = await db.select()
     *   .from(users)
     *   .fullJoin(pets, eq(users.id, pets.ownerId))
     *
     * // Select userId and petId
     * const usersIdsAndPetIds: { userId: number | null; petId: number | null; }[] = await db.select({
     *   userId: users.id,
     *   petId: pets.id,
     * })
     *   .from(users)
     *   .fullJoin(pets, eq(users.id, pets.ownerId))
     * ```
     */
    __publicField(this, "fullJoin", this.createJoin("full"));
    /**
     * Executes a `cross join` operation by combining rows from two tables into a new table.
     *
     * Calling this method retrieves all rows from both main and joined tables, merging all rows from each table.
     *
     * See docs: {@link https://orm.drizzle.team/docs/joins#cross-join}
     *
     * @param table the table to join.
     *
     * @example
     *
     * ```ts
     * // Select all users, each user with every pet
     * const usersWithPets: { user: User; pets: Pet; }[] = await db.select()
     *   .from(users)
     *   .crossJoin(pets)
     *
     * // Select userId and petId
     * const usersIdsAndPetIds: { userId: number; petId: number; }[] = await db.select({
     *   userId: users.id,
     *   petId: pets.id,
     * })
     *   .from(users)
     *   .crossJoin(pets)
     * ```
     */
    __publicField(this, "crossJoin", this.createJoin("cross"));
    /**
     * Adds `union` set operator to the query.
     *
     * Calling this method will combine the result sets of the `select` statements and remove any duplicate rows that appear across them.
     *
     * See docs: {@link https://orm.drizzle.team/docs/set-operations#union}
     *
     * @example
     *
     * ```ts
     * // Select all unique names from customers and users tables
     * await db.select({ name: users.name })
     *   .from(users)
     *   .union(
     *     db.select({ name: customers.name }).from(customers)
     *   );
     * // or
     * import { union } from 'drizzle-orm/sqlite-core'
     *
     * await union(
     *   db.select({ name: users.name }).from(users),
     *   db.select({ name: customers.name }).from(customers)
     * );
     * ```
     */
    __publicField(this, "union", this.createSetOperator("union", false));
    /**
     * Adds `union all` set operator to the query.
     *
     * Calling this method will combine the result-set of the `select` statements and keep all duplicate rows that appear across them.
     *
     * See docs: {@link https://orm.drizzle.team/docs/set-operations#union-all}
     *
     * @example
     *
     * ```ts
     * // Select all transaction ids from both online and in-store sales
     * await db.select({ transaction: onlineSales.transactionId })
     *   .from(onlineSales)
     *   .unionAll(
     *     db.select({ transaction: inStoreSales.transactionId }).from(inStoreSales)
     *   );
     * // or
     * import { unionAll } from 'drizzle-orm/sqlite-core'
     *
     * await unionAll(
     *   db.select({ transaction: onlineSales.transactionId }).from(onlineSales),
     *   db.select({ transaction: inStoreSales.transactionId }).from(inStoreSales)
     * );
     * ```
     */
    __publicField(this, "unionAll", this.createSetOperator("union", true));
    /**
     * Adds `intersect` set operator to the query.
     *
     * Calling this method will retain only the rows that are present in both result sets and eliminate duplicates.
     *
     * See docs: {@link https://orm.drizzle.team/docs/set-operations#intersect}
     *
     * @example
     *
     * ```ts
     * // Select course names that are offered in both departments A and B
     * await db.select({ courseName: depA.courseName })
     *   .from(depA)
     *   .intersect(
     *     db.select({ courseName: depB.courseName }).from(depB)
     *   );
     * // or
     * import { intersect } from 'drizzle-orm/sqlite-core'
     *
     * await intersect(
     *   db.select({ courseName: depA.courseName }).from(depA),
     *   db.select({ courseName: depB.courseName }).from(depB)
     * );
     * ```
     */
    __publicField(this, "intersect", this.createSetOperator("intersect", false));
    /**
     * Adds `except` set operator to the query.
     *
     * Calling this method will retrieve all unique rows from the left query, except for the rows that are present in the result set of the right query.
     *
     * See docs: {@link https://orm.drizzle.team/docs/set-operations#except}
     *
     * @example
     *
     * ```ts
     * // Select all courses offered in department A but not in department B
     * await db.select({ courseName: depA.courseName })
     *   .from(depA)
     *   .except(
     *     db.select({ courseName: depB.courseName }).from(depB)
     *   );
     * // or
     * import { except } from 'drizzle-orm/sqlite-core'
     *
     * await except(
     *   db.select({ courseName: depA.courseName }).from(depA),
     *   db.select({ courseName: depB.courseName }).from(depB)
     * );
     * ```
     */
    __publicField(this, "except", this.createSetOperator("except", false));
    this.config = {
      withList,
      table,
      fields: { ...fields },
      distinct,
      setOperators: []
    };
    this.isPartialSelect = isPartialSelect;
    this.session = session;
    this.dialect = dialect;
    this._ = {
      selectedFields: fields,
      config: this.config
    };
    this.tableName = getTableLikeName(table);
    this.joinsNotNullableMap = typeof this.tableName === "string" ? { [this.tableName]: true } : {};
    for (const item of extractUsedTable(table)) this.usedTables.add(item);
  }
  /** @internal */
  getUsedTables() {
    return [...this.usedTables];
  }
  createJoin(joinType) {
    return (table, on) => {
      var _a2;
      const baseTableName = this.tableName;
      const tableName = getTableLikeName(table);
      for (const item of extractUsedTable(table)) this.usedTables.add(item);
      if (typeof tableName === "string" && ((_a2 = this.config.joins) == null ? void 0 : _a2.some((join) => join.alias === tableName))) {
        throw new Error(`Alias "${tableName}" is already used in this query`);
      }
      if (!this.isPartialSelect) {
        if (Object.keys(this.joinsNotNullableMap).length === 1 && typeof baseTableName === "string") {
          this.config.fields = {
            [baseTableName]: this.config.fields
          };
        }
        if (typeof tableName === "string" && !is(table, SQL)) {
          const selection = is(table, Subquery) ? table._.selectedFields : is(table, View) ? table[ViewBaseConfig].selectedFields : table[Table.Symbol.Columns];
          this.config.fields[tableName] = selection;
        }
      }
      if (typeof on === "function") {
        on = on(
          new Proxy(
            this.config.fields,
            new SelectionProxyHandler({ sqlAliasedBehavior: "sql", sqlBehavior: "sql" })
          )
        );
      }
      if (!this.config.joins) {
        this.config.joins = [];
      }
      this.config.joins.push({ on, table, joinType, alias: tableName });
      if (typeof tableName === "string") {
        switch (joinType) {
          case "left": {
            this.joinsNotNullableMap[tableName] = false;
            break;
          }
          case "right": {
            this.joinsNotNullableMap = Object.fromEntries(
              Object.entries(this.joinsNotNullableMap).map(([key]) => [key, false])
            );
            this.joinsNotNullableMap[tableName] = true;
            break;
          }
          case "cross":
          case "inner": {
            this.joinsNotNullableMap[tableName] = true;
            break;
          }
          case "full": {
            this.joinsNotNullableMap = Object.fromEntries(
              Object.entries(this.joinsNotNullableMap).map(([key]) => [key, false])
            );
            this.joinsNotNullableMap[tableName] = false;
            break;
          }
        }
      }
      return this;
    };
  }
  createSetOperator(type, isAll) {
    return (rightSelection) => {
      const rightSelect = typeof rightSelection === "function" ? rightSelection(getSQLiteSetOperators()) : rightSelection;
      if (!haveSameKeys(this.getSelectedFields(), rightSelect.getSelectedFields())) {
        throw new Error(
          "Set operator error (union / intersect / except): selected fields are not the same or are in a different order"
        );
      }
      this.config.setOperators.push({ type, isAll, rightSelect });
      return this;
    };
  }
  /** @internal */
  addSetOperators(setOperators) {
    this.config.setOperators.push(...setOperators);
    return this;
  }
  /**
   * Adds a `where` clause to the query.
   *
   * Calling this method will select only those rows that fulfill a specified condition.
   *
   * See docs: {@link https://orm.drizzle.team/docs/select#filtering}
   *
   * @param where the `where` clause.
   *
   * @example
   * You can use conditional operators and `sql function` to filter the rows to be selected.
   *
   * ```ts
   * // Select all cars with green color
   * await db.select().from(cars).where(eq(cars.color, 'green'));
   * // or
   * await db.select().from(cars).where(sql`${cars.color} = 'green'`)
   * ```
   *
   * You can logically combine conditional operators with `and()` and `or()` operators:
   *
   * ```ts
   * // Select all BMW cars with a green color
   * await db.select().from(cars).where(and(eq(cars.color, 'green'), eq(cars.brand, 'BMW')));
   *
   * // Select all cars with the green or blue color
   * await db.select().from(cars).where(or(eq(cars.color, 'green'), eq(cars.color, 'blue')));
   * ```
   */
  where(where) {
    if (typeof where === "function") {
      where = where(
        new Proxy(
          this.config.fields,
          new SelectionProxyHandler({ sqlAliasedBehavior: "sql", sqlBehavior: "sql" })
        )
      );
    }
    this.config.where = where;
    return this;
  }
  /**
   * Adds a `having` clause to the query.
   *
   * Calling this method will select only those rows that fulfill a specified condition. It is typically used with aggregate functions to filter the aggregated data based on a specified condition.
   *
   * See docs: {@link https://orm.drizzle.team/docs/select#aggregations}
   *
   * @param having the `having` clause.
   *
   * @example
   *
   * ```ts
   * // Select all brands with more than one car
   * await db.select({
   * 	brand: cars.brand,
   * 	count: sql<number>`cast(count(${cars.id}) as int)`,
   * })
   *   .from(cars)
   *   .groupBy(cars.brand)
   *   .having(({ count }) => gt(count, 1));
   * ```
   */
  having(having) {
    if (typeof having === "function") {
      having = having(
        new Proxy(
          this.config.fields,
          new SelectionProxyHandler({ sqlAliasedBehavior: "sql", sqlBehavior: "sql" })
        )
      );
    }
    this.config.having = having;
    return this;
  }
  groupBy(...columns) {
    if (typeof columns[0] === "function") {
      const groupBy = columns[0](
        new Proxy(
          this.config.fields,
          new SelectionProxyHandler({ sqlAliasedBehavior: "alias", sqlBehavior: "sql" })
        )
      );
      this.config.groupBy = Array.isArray(groupBy) ? groupBy : [groupBy];
    } else {
      this.config.groupBy = columns;
    }
    return this;
  }
  orderBy(...columns) {
    if (typeof columns[0] === "function") {
      const orderBy = columns[0](
        new Proxy(
          this.config.fields,
          new SelectionProxyHandler({ sqlAliasedBehavior: "alias", sqlBehavior: "sql" })
        )
      );
      const orderByArray = Array.isArray(orderBy) ? orderBy : [orderBy];
      if (this.config.setOperators.length > 0) {
        this.config.setOperators.at(-1).orderBy = orderByArray;
      } else {
        this.config.orderBy = orderByArray;
      }
    } else {
      const orderByArray = columns;
      if (this.config.setOperators.length > 0) {
        this.config.setOperators.at(-1).orderBy = orderByArray;
      } else {
        this.config.orderBy = orderByArray;
      }
    }
    return this;
  }
  /**
   * Adds a `limit` clause to the query.
   *
   * Calling this method will set the maximum number of rows that will be returned by this query.
   *
   * See docs: {@link https://orm.drizzle.team/docs/select#limit--offset}
   *
   * @param limit the `limit` clause.
   *
   * @example
   *
   * ```ts
   * // Get the first 10 people from this query.
   * await db.select().from(people).limit(10);
   * ```
   */
  limit(limit) {
    if (this.config.setOperators.length > 0) {
      this.config.setOperators.at(-1).limit = limit;
    } else {
      this.config.limit = limit;
    }
    return this;
  }
  /**
   * Adds an `offset` clause to the query.
   *
   * Calling this method will skip a number of rows when returning results from this query.
   *
   * See docs: {@link https://orm.drizzle.team/docs/select#limit--offset}
   *
   * @param offset the `offset` clause.
   *
   * @example
   *
   * ```ts
   * // Get the 10th-20th people from this query.
   * await db.select().from(people).offset(10).limit(10);
   * ```
   */
  offset(offset) {
    if (this.config.setOperators.length > 0) {
      this.config.setOperators.at(-1).offset = offset;
    } else {
      this.config.offset = offset;
    }
    return this;
  }
  /** @internal */
  getSQL() {
    return this.dialect.buildSelectQuery(this.config);
  }
  toSQL() {
    const { typings: _typings, ...rest } = this.dialect.sqlToQuery(this.getSQL());
    return rest;
  }
  as(alias) {
    const usedTables = [];
    usedTables.push(...extractUsedTable(this.config.table));
    if (this.config.joins) {
      for (const it of this.config.joins) usedTables.push(...extractUsedTable(it.table));
    }
    return new Proxy(
      new Subquery(this.getSQL(), this.config.fields, alias, false, [...new Set(usedTables)]),
      new SelectionProxyHandler({ alias, sqlAliasedBehavior: "alias", sqlBehavior: "error" })
    );
  }
  /** @internal */
  getSelectedFields() {
    return new Proxy(
      this.config.fields,
      new SelectionProxyHandler({ alias: this.tableName, sqlAliasedBehavior: "alias", sqlBehavior: "error" })
    );
  }
  $dynamic() {
    return this;
  }
}
__publicField(SQLiteSelectQueryBuilderBase, _wb, "SQLiteSelectQueryBuilder");
class SQLiteSelectBase extends (_zb = SQLiteSelectQueryBuilderBase, _yb = entityKind, _zb) {
  constructor() {
    super(...arguments);
    __publicField(this, "run", (placeholderValues) => {
      return this._prepare().run(placeholderValues);
    });
    __publicField(this, "all", (placeholderValues) => {
      return this._prepare().all(placeholderValues);
    });
    __publicField(this, "get", (placeholderValues) => {
      return this._prepare().get(placeholderValues);
    });
    __publicField(this, "values", (placeholderValues) => {
      return this._prepare().values(placeholderValues);
    });
  }
  /** @internal */
  _prepare(isOneTimeQuery = true) {
    if (!this.session) {
      throw new Error("Cannot execute a query on a query builder. Please use a database instance instead.");
    }
    const fieldsList = orderSelectedFields(this.config.fields);
    const query = this.session[isOneTimeQuery ? "prepareOneTimeQuery" : "prepareQuery"](
      this.dialect.sqlToQuery(this.getSQL()),
      fieldsList,
      "all",
      true,
      void 0,
      {
        type: "select",
        tables: [...this.usedTables]
      },
      this.cacheConfig
    );
    query.joinsNotNullableMap = this.joinsNotNullableMap;
    return query;
  }
  $withCache(config) {
    this.cacheConfig = config === void 0 ? { config: {}, enable: true, autoInvalidate: true } : config === false ? { enable: false } : { enable: true, autoInvalidate: true, ...config };
    return this;
  }
  prepare() {
    return this._prepare(false);
  }
  async execute() {
    return this.all();
  }
}
__publicField(SQLiteSelectBase, _yb, "SQLiteSelect");
applyMixins(SQLiteSelectBase, [QueryPromise]);
function createSetOperator(type, isAll) {
  return (leftSelect, rightSelect, ...restSelects) => {
    const setOperators = [rightSelect, ...restSelects].map((select) => ({
      type,
      isAll,
      rightSelect: select
    }));
    for (const setOperator of setOperators) {
      if (!haveSameKeys(leftSelect.getSelectedFields(), setOperator.rightSelect.getSelectedFields())) {
        throw new Error(
          "Set operator error (union / intersect / except): selected fields are not the same or are in a different order"
        );
      }
    }
    return leftSelect.addSetOperators(setOperators);
  };
}
const getSQLiteSetOperators = () => ({
  union,
  unionAll,
  intersect,
  except
});
const union = createSetOperator("union", false);
const unionAll = createSetOperator("union", true);
const intersect = createSetOperator("intersect", false);
const except = createSetOperator("except", false);
_Ab = entityKind;
class QueryBuilder {
  constructor(dialect) {
    __publicField(this, "dialect");
    __publicField(this, "dialectConfig");
    __publicField(this, "$with", (alias, selection) => {
      const queryBuilder = this;
      const as = (qb) => {
        if (typeof qb === "function") {
          qb = qb(queryBuilder);
        }
        return new Proxy(
          new WithSubquery(
            qb.getSQL(),
            selection ?? ("getSelectedFields" in qb ? qb.getSelectedFields() ?? {} : {}),
            alias,
            true
          ),
          new SelectionProxyHandler({ alias, sqlAliasedBehavior: "alias", sqlBehavior: "error" })
        );
      };
      return { as };
    });
    this.dialect = is(dialect, SQLiteDialect) ? dialect : void 0;
    this.dialectConfig = is(dialect, SQLiteDialect) ? void 0 : dialect;
  }
  with(...queries) {
    const self = this;
    function select(fields) {
      return new SQLiteSelectBuilder({
        fields: fields ?? void 0,
        session: void 0,
        dialect: self.getDialect(),
        withList: queries
      });
    }
    function selectDistinct(fields) {
      return new SQLiteSelectBuilder({
        fields: fields ?? void 0,
        session: void 0,
        dialect: self.getDialect(),
        withList: queries,
        distinct: true
      });
    }
    return { select, selectDistinct };
  }
  select(fields) {
    return new SQLiteSelectBuilder({ fields: fields ?? void 0, session: void 0, dialect: this.getDialect() });
  }
  selectDistinct(fields) {
    return new SQLiteSelectBuilder({
      fields: fields ?? void 0,
      session: void 0,
      dialect: this.getDialect(),
      distinct: true
    });
  }
  // Lazy load dialect to avoid circular dependency
  getDialect() {
    if (!this.dialect) {
      this.dialect = new SQLiteSyncDialect(this.dialectConfig);
    }
    return this.dialect;
  }
}
__publicField(QueryBuilder, _Ab, "SQLiteQueryBuilder");
_Bb = entityKind;
class SQLiteInsertBuilder {
  constructor(table, session, dialect, withList) {
    this.table = table;
    this.session = session;
    this.dialect = dialect;
    this.withList = withList;
  }
  values(values) {
    values = Array.isArray(values) ? values : [values];
    if (values.length === 0) {
      throw new Error("values() must be called with at least one value");
    }
    const mappedValues = values.map((entry) => {
      const result = {};
      const cols = this.table[Table.Symbol.Columns];
      for (const colKey of Object.keys(entry)) {
        const colValue = entry[colKey];
        result[colKey] = is(colValue, SQL) ? colValue : new Param(colValue, cols[colKey]);
      }
      return result;
    });
    return new SQLiteInsertBase(this.table, mappedValues, this.session, this.dialect, this.withList);
  }
  select(selectQuery) {
    const select = typeof selectQuery === "function" ? selectQuery(new QueryBuilder()) : selectQuery;
    if (!is(select, SQL) && !haveSameKeys(this.table[Columns], select._.selectedFields)) {
      throw new Error(
        "Insert select error: selected fields are not the same or are in a different order compared to the table definition"
      );
    }
    return new SQLiteInsertBase(this.table, select, this.session, this.dialect, this.withList, true);
  }
}
__publicField(SQLiteInsertBuilder, _Bb, "SQLiteInsertBuilder");
class SQLiteInsertBase extends (_Db = QueryPromise, _Cb = entityKind, _Db) {
  constructor(table, values, session, dialect, withList, select) {
    super();
    /** @internal */
    __publicField(this, "config");
    __publicField(this, "run", (placeholderValues) => {
      return this._prepare().run(placeholderValues);
    });
    __publicField(this, "all", (placeholderValues) => {
      return this._prepare().all(placeholderValues);
    });
    __publicField(this, "get", (placeholderValues) => {
      return this._prepare().get(placeholderValues);
    });
    __publicField(this, "values", (placeholderValues) => {
      return this._prepare().values(placeholderValues);
    });
    this.session = session;
    this.dialect = dialect;
    this.config = { table, values, withList, select };
  }
  returning(fields = this.config.table[SQLiteTable.Symbol.Columns]) {
    this.config.returning = orderSelectedFields(fields);
    return this;
  }
  /**
   * Adds an `on conflict do nothing` clause to the query.
   *
   * Calling this method simply avoids inserting a row as its alternative action.
   *
   * See docs: {@link https://orm.drizzle.team/docs/insert#on-conflict-do-nothing}
   *
   * @param config The `target` and `where` clauses.
   *
   * @example
   * ```ts
   * // Insert one row and cancel the insert if there's a conflict
   * await db.insert(cars)
   *   .values({ id: 1, brand: 'BMW' })
   *   .onConflictDoNothing();
   *
   * // Explicitly specify conflict target
   * await db.insert(cars)
   *   .values({ id: 1, brand: 'BMW' })
   *   .onConflictDoNothing({ target: cars.id });
   * ```
   */
  onConflictDoNothing(config = {}) {
    if (!this.config.onConflict) this.config.onConflict = [];
    if (config.target === void 0) {
      this.config.onConflict.push(sql` on conflict do nothing`);
    } else {
      const targetSql = Array.isArray(config.target) ? sql`${config.target}` : sql`${[config.target]}`;
      const whereSql = config.where ? sql` where ${config.where}` : sql``;
      this.config.onConflict.push(sql` on conflict ${targetSql} do nothing${whereSql}`);
    }
    return this;
  }
  /**
   * Adds an `on conflict do update` clause to the query.
   *
   * Calling this method will update the existing row that conflicts with the row proposed for insertion as its alternative action.
   *
   * See docs: {@link https://orm.drizzle.team/docs/insert#upserts-and-conflicts}
   *
   * @param config The `target`, `set` and `where` clauses.
   *
   * @example
   * ```ts
   * // Update the row if there's a conflict
   * await db.insert(cars)
   *   .values({ id: 1, brand: 'BMW' })
   *   .onConflictDoUpdate({
   *     target: cars.id,
   *     set: { brand: 'Porsche' }
   *   });
   *
   * // Upsert with 'where' clause
   * await db.insert(cars)
   *   .values({ id: 1, brand: 'BMW' })
   *   .onConflictDoUpdate({
   *     target: cars.id,
   *     set: { brand: 'newBMW' },
   *     where: sql`${cars.createdAt} > '2023-01-01'::date`,
   *   });
   * ```
   */
  onConflictDoUpdate(config) {
    if (config.where && (config.targetWhere || config.setWhere)) {
      throw new Error(
        'You cannot use both "where" and "targetWhere"/"setWhere" at the same time - "where" is deprecated, use "targetWhere" or "setWhere" instead.'
      );
    }
    if (!this.config.onConflict) this.config.onConflict = [];
    const whereSql = config.where ? sql` where ${config.where}` : void 0;
    const targetWhereSql = config.targetWhere ? sql` where ${config.targetWhere}` : void 0;
    const setWhereSql = config.setWhere ? sql` where ${config.setWhere}` : void 0;
    const targetSql = Array.isArray(config.target) ? sql`${config.target}` : sql`${[config.target]}`;
    const setSql = this.dialect.buildUpdateSet(this.config.table, mapUpdateSet(this.config.table, config.set));
    this.config.onConflict.push(
      sql` on conflict ${targetSql}${targetWhereSql} do update set ${setSql}${whereSql}${setWhereSql}`
    );
    return this;
  }
  /** @internal */
  getSQL() {
    return this.dialect.buildInsertQuery(this.config);
  }
  toSQL() {
    const { typings: _typings, ...rest } = this.dialect.sqlToQuery(this.getSQL());
    return rest;
  }
  /** @internal */
  _prepare(isOneTimeQuery = true) {
    return this.session[isOneTimeQuery ? "prepareOneTimeQuery" : "prepareQuery"](
      this.dialect.sqlToQuery(this.getSQL()),
      this.config.returning,
      this.config.returning ? "all" : "run",
      true,
      void 0,
      {
        type: "insert",
        tables: extractUsedTable(this.config.table)
      }
    );
  }
  prepare() {
    return this._prepare(false);
  }
  async execute() {
    return this.config.returning ? this.all() : this.run();
  }
  $dynamic() {
    return this;
  }
}
__publicField(SQLiteInsertBase, _Cb, "SQLiteInsert");
_Eb = entityKind;
class SQLiteUpdateBuilder {
  constructor(table, session, dialect, withList) {
    this.table = table;
    this.session = session;
    this.dialect = dialect;
    this.withList = withList;
  }
  set(values) {
    return new SQLiteUpdateBase(
      this.table,
      mapUpdateSet(this.table, values),
      this.session,
      this.dialect,
      this.withList
    );
  }
}
__publicField(SQLiteUpdateBuilder, _Eb, "SQLiteUpdateBuilder");
class SQLiteUpdateBase extends (_Gb = QueryPromise, _Fb = entityKind, _Gb) {
  constructor(table, set, session, dialect, withList) {
    super();
    /** @internal */
    __publicField(this, "config");
    __publicField(this, "leftJoin", this.createJoin("left"));
    __publicField(this, "rightJoin", this.createJoin("right"));
    __publicField(this, "innerJoin", this.createJoin("inner"));
    __publicField(this, "fullJoin", this.createJoin("full"));
    __publicField(this, "run", (placeholderValues) => {
      return this._prepare().run(placeholderValues);
    });
    __publicField(this, "all", (placeholderValues) => {
      return this._prepare().all(placeholderValues);
    });
    __publicField(this, "get", (placeholderValues) => {
      return this._prepare().get(placeholderValues);
    });
    __publicField(this, "values", (placeholderValues) => {
      return this._prepare().values(placeholderValues);
    });
    this.session = session;
    this.dialect = dialect;
    this.config = { set, table, withList, joins: [] };
  }
  from(source) {
    this.config.from = source;
    return this;
  }
  createJoin(joinType) {
    return (table, on) => {
      const tableName = getTableLikeName(table);
      if (typeof tableName === "string" && this.config.joins.some((join) => join.alias === tableName)) {
        throw new Error(`Alias "${tableName}" is already used in this query`);
      }
      if (typeof on === "function") {
        const from = this.config.from ? is(table, SQLiteTable) ? table[Table.Symbol.Columns] : is(table, Subquery) ? table._.selectedFields : is(table, SQLiteViewBase) ? table[ViewBaseConfig].selectedFields : void 0 : void 0;
        on = on(
          new Proxy(
            this.config.table[Table.Symbol.Columns],
            new SelectionProxyHandler({ sqlAliasedBehavior: "sql", sqlBehavior: "sql" })
          ),
          from && new Proxy(
            from,
            new SelectionProxyHandler({ sqlAliasedBehavior: "sql", sqlBehavior: "sql" })
          )
        );
      }
      this.config.joins.push({ on, table, joinType, alias: tableName });
      return this;
    };
  }
  /**
   * Adds a 'where' clause to the query.
   *
   * Calling this method will update only those rows that fulfill a specified condition.
   *
   * See docs: {@link https://orm.drizzle.team/docs/update}
   *
   * @param where the 'where' clause.
   *
   * @example
   * You can use conditional operators and `sql function` to filter the rows to be updated.
   *
   * ```ts
   * // Update all cars with green color
   * db.update(cars).set({ color: 'red' })
   *   .where(eq(cars.color, 'green'));
   * // or
   * db.update(cars).set({ color: 'red' })
   *   .where(sql`${cars.color} = 'green'`)
   * ```
   *
   * You can logically combine conditional operators with `and()` and `or()` operators:
   *
   * ```ts
   * // Update all BMW cars with a green color
   * db.update(cars).set({ color: 'red' })
   *   .where(and(eq(cars.color, 'green'), eq(cars.brand, 'BMW')));
   *
   * // Update all cars with the green or blue color
   * db.update(cars).set({ color: 'red' })
   *   .where(or(eq(cars.color, 'green'), eq(cars.color, 'blue')));
   * ```
   */
  where(where) {
    this.config.where = where;
    return this;
  }
  orderBy(...columns) {
    if (typeof columns[0] === "function") {
      const orderBy = columns[0](
        new Proxy(
          this.config.table[Table.Symbol.Columns],
          new SelectionProxyHandler({ sqlAliasedBehavior: "alias", sqlBehavior: "sql" })
        )
      );
      const orderByArray = Array.isArray(orderBy) ? orderBy : [orderBy];
      this.config.orderBy = orderByArray;
    } else {
      const orderByArray = columns;
      this.config.orderBy = orderByArray;
    }
    return this;
  }
  limit(limit) {
    this.config.limit = limit;
    return this;
  }
  returning(fields = this.config.table[SQLiteTable.Symbol.Columns]) {
    this.config.returning = orderSelectedFields(fields);
    return this;
  }
  /** @internal */
  getSQL() {
    return this.dialect.buildUpdateQuery(this.config);
  }
  toSQL() {
    const { typings: _typings, ...rest } = this.dialect.sqlToQuery(this.getSQL());
    return rest;
  }
  /** @internal */
  _prepare(isOneTimeQuery = true) {
    return this.session[isOneTimeQuery ? "prepareOneTimeQuery" : "prepareQuery"](
      this.dialect.sqlToQuery(this.getSQL()),
      this.config.returning,
      this.config.returning ? "all" : "run",
      true,
      void 0,
      {
        type: "insert",
        tables: extractUsedTable(this.config.table)
      }
    );
  }
  prepare() {
    return this._prepare(false);
  }
  async execute() {
    return this.config.returning ? this.all() : this.run();
  }
  $dynamic() {
    return this;
  }
}
__publicField(SQLiteUpdateBase, _Fb, "SQLiteUpdate");
const _SQLiteCountBuilder = class _SQLiteCountBuilder extends (_Jb = SQL, _Ib = entityKind, _Hb = Symbol.toStringTag, _Jb) {
  constructor(params) {
    super(_SQLiteCountBuilder.buildEmbeddedCount(params.source, params.filters).queryChunks);
    __publicField(this, "sql");
    __publicField(this, _Hb, "SQLiteCountBuilderAsync");
    __publicField(this, "session");
    this.params = params;
    this.session = params.session;
    this.sql = _SQLiteCountBuilder.buildCount(
      params.source,
      params.filters
    );
  }
  static buildEmbeddedCount(source, filters) {
    return sql`(select count(*) from ${source}${sql.raw(" where ").if(filters)}${filters})`;
  }
  static buildCount(source, filters) {
    return sql`select count(*) from ${source}${sql.raw(" where ").if(filters)}${filters}`;
  }
  then(onfulfilled, onrejected) {
    return Promise.resolve(this.session.count(this.sql)).then(
      onfulfilled,
      onrejected
    );
  }
  catch(onRejected) {
    return this.then(void 0, onRejected);
  }
  finally(onFinally) {
    return this.then(
      (value) => {
        onFinally == null ? void 0 : onFinally();
        return value;
      },
      (reason) => {
        onFinally == null ? void 0 : onFinally();
        throw reason;
      }
    );
  }
};
__publicField(_SQLiteCountBuilder, _Ib, "SQLiteCountBuilderAsync");
let SQLiteCountBuilder = _SQLiteCountBuilder;
_Kb = entityKind;
class RelationalQueryBuilder {
  constructor(mode, fullSchema, schema, tableNamesMap, table, tableConfig, dialect, session) {
    this.mode = mode;
    this.fullSchema = fullSchema;
    this.schema = schema;
    this.tableNamesMap = tableNamesMap;
    this.table = table;
    this.tableConfig = tableConfig;
    this.dialect = dialect;
    this.session = session;
  }
  findMany(config) {
    return this.mode === "sync" ? new SQLiteSyncRelationalQuery(
      this.fullSchema,
      this.schema,
      this.tableNamesMap,
      this.table,
      this.tableConfig,
      this.dialect,
      this.session,
      config ? config : {},
      "many"
    ) : new SQLiteRelationalQuery(
      this.fullSchema,
      this.schema,
      this.tableNamesMap,
      this.table,
      this.tableConfig,
      this.dialect,
      this.session,
      config ? config : {},
      "many"
    );
  }
  findFirst(config) {
    return this.mode === "sync" ? new SQLiteSyncRelationalQuery(
      this.fullSchema,
      this.schema,
      this.tableNamesMap,
      this.table,
      this.tableConfig,
      this.dialect,
      this.session,
      config ? { ...config, limit: 1 } : { limit: 1 },
      "first"
    ) : new SQLiteRelationalQuery(
      this.fullSchema,
      this.schema,
      this.tableNamesMap,
      this.table,
      this.tableConfig,
      this.dialect,
      this.session,
      config ? { ...config, limit: 1 } : { limit: 1 },
      "first"
    );
  }
}
__publicField(RelationalQueryBuilder, _Kb, "SQLiteAsyncRelationalQueryBuilder");
class SQLiteRelationalQuery extends (_Mb = QueryPromise, _Lb = entityKind, _Mb) {
  constructor(fullSchema, schema, tableNamesMap, table, tableConfig, dialect, session, config, mode) {
    super();
    /** @internal */
    __publicField(this, "mode");
    this.fullSchema = fullSchema;
    this.schema = schema;
    this.tableNamesMap = tableNamesMap;
    this.table = table;
    this.tableConfig = tableConfig;
    this.dialect = dialect;
    this.session = session;
    this.config = config;
    this.mode = mode;
  }
  /** @internal */
  getSQL() {
    return this.dialect.buildRelationalQuery({
      fullSchema: this.fullSchema,
      schema: this.schema,
      tableNamesMap: this.tableNamesMap,
      table: this.table,
      tableConfig: this.tableConfig,
      queryConfig: this.config,
      tableAlias: this.tableConfig.tsName
    }).sql;
  }
  /** @internal */
  _prepare(isOneTimeQuery = false) {
    const { query, builtQuery } = this._toSQL();
    return this.session[isOneTimeQuery ? "prepareOneTimeQuery" : "prepareQuery"](
      builtQuery,
      void 0,
      this.mode === "first" ? "get" : "all",
      true,
      (rawRows, mapColumnValue) => {
        const rows = rawRows.map(
          (row) => mapRelationalRow(this.schema, this.tableConfig, row, query.selection, mapColumnValue)
        );
        if (this.mode === "first") {
          return rows[0];
        }
        return rows;
      }
    );
  }
  prepare() {
    return this._prepare(false);
  }
  _toSQL() {
    const query = this.dialect.buildRelationalQuery({
      fullSchema: this.fullSchema,
      schema: this.schema,
      tableNamesMap: this.tableNamesMap,
      table: this.table,
      tableConfig: this.tableConfig,
      queryConfig: this.config,
      tableAlias: this.tableConfig.tsName
    });
    const builtQuery = this.dialect.sqlToQuery(query.sql);
    return { query, builtQuery };
  }
  toSQL() {
    return this._toSQL().builtQuery;
  }
  /** @internal */
  executeRaw() {
    if (this.mode === "first") {
      return this._prepare(false).get();
    }
    return this._prepare(false).all();
  }
  async execute() {
    return this.executeRaw();
  }
}
__publicField(SQLiteRelationalQuery, _Lb, "SQLiteAsyncRelationalQuery");
class SQLiteSyncRelationalQuery extends (_Ob = SQLiteRelationalQuery, _Nb = entityKind, _Ob) {
  sync() {
    return this.executeRaw();
  }
}
__publicField(SQLiteSyncRelationalQuery, _Nb, "SQLiteSyncRelationalQuery");
class SQLiteRaw extends (_Qb = QueryPromise, _Pb = entityKind, _Qb) {
  constructor(execute, getSQL, action, dialect, mapBatchResult) {
    super();
    /** @internal */
    __publicField(this, "config");
    this.execute = execute;
    this.getSQL = getSQL;
    this.dialect = dialect;
    this.mapBatchResult = mapBatchResult;
    this.config = { action };
  }
  getQuery() {
    return { ...this.dialect.sqlToQuery(this.getSQL()), method: this.config.action };
  }
  mapResult(result, isFromBatch) {
    return isFromBatch ? this.mapBatchResult(result) : result;
  }
  _prepare() {
    return this;
  }
  /** @internal */
  isResponseInArrayMode() {
    return false;
  }
}
__publicField(SQLiteRaw, _Pb, "SQLiteRaw");
_Rb = entityKind;
class BaseSQLiteDatabase {
  constructor(resultKind, dialect, session, schema) {
    __publicField(this, "query");
    /**
     * Creates a subquery that defines a temporary named result set as a CTE.
     *
     * It is useful for breaking down complex queries into simpler parts and for reusing the result set in subsequent parts of the query.
     *
     * See docs: {@link https://orm.drizzle.team/docs/select#with-clause}
     *
     * @param alias The alias for the subquery.
     *
     * Failure to provide an alias will result in a DrizzleTypeError, preventing the subquery from being referenced in other queries.
     *
     * @example
     *
     * ```ts
     * // Create a subquery with alias 'sq' and use it in the select query
     * const sq = db.$with('sq').as(db.select().from(users).where(eq(users.id, 42)));
     *
     * const result = await db.with(sq).select().from(sq);
     * ```
     *
     * To select arbitrary SQL values as fields in a CTE and reference them in other CTEs or in the main query, you need to add aliases to them:
     *
     * ```ts
     * // Select an arbitrary SQL value as a field in a CTE and reference it in the main query
     * const sq = db.$with('sq').as(db.select({
     *   name: sql<string>`upper(${users.name})`.as('name'),
     * })
     * .from(users));
     *
     * const result = await db.with(sq).select({ name: sq.name }).from(sq);
     * ```
     */
    __publicField(this, "$with", (alias, selection) => {
      const self = this;
      const as = (qb) => {
        if (typeof qb === "function") {
          qb = qb(new QueryBuilder(self.dialect));
        }
        return new Proxy(
          new WithSubquery(
            qb.getSQL(),
            selection ?? ("getSelectedFields" in qb ? qb.getSelectedFields() ?? {} : {}),
            alias,
            true
          ),
          new SelectionProxyHandler({ alias, sqlAliasedBehavior: "alias", sqlBehavior: "error" })
        );
      };
      return { as };
    });
    __publicField(this, "$cache");
    this.resultKind = resultKind;
    this.dialect = dialect;
    this.session = session;
    this._ = schema ? {
      schema: schema.schema,
      fullSchema: schema.fullSchema,
      tableNamesMap: schema.tableNamesMap
    } : {
      schema: void 0,
      fullSchema: {},
      tableNamesMap: {}
    };
    this.query = {};
    const query = this.query;
    if (this._.schema) {
      for (const [tableName, columns] of Object.entries(this._.schema)) {
        query[tableName] = new RelationalQueryBuilder(
          resultKind,
          schema.fullSchema,
          this._.schema,
          this._.tableNamesMap,
          schema.fullSchema[tableName],
          columns,
          dialect,
          session
        );
      }
    }
    this.$cache = { invalidate: async (_params) => {
    } };
  }
  $count(source, filters) {
    return new SQLiteCountBuilder({ source, filters, session: this.session });
  }
  /**
   * Incorporates a previously defined CTE (using `$with`) into the main query.
   *
   * This method allows the main query to reference a temporary named result set.
   *
   * See docs: {@link https://orm.drizzle.team/docs/select#with-clause}
   *
   * @param queries The CTEs to incorporate into the main query.
   *
   * @example
   *
   * ```ts
   * // Define a subquery 'sq' as a CTE using $with
   * const sq = db.$with('sq').as(db.select().from(users).where(eq(users.id, 42)));
   *
   * // Incorporate the CTE 'sq' into the main query and select from it
   * const result = await db.with(sq).select().from(sq);
   * ```
   */
  with(...queries) {
    const self = this;
    function select(fields) {
      return new SQLiteSelectBuilder({
        fields: fields ?? void 0,
        session: self.session,
        dialect: self.dialect,
        withList: queries
      });
    }
    function selectDistinct(fields) {
      return new SQLiteSelectBuilder({
        fields: fields ?? void 0,
        session: self.session,
        dialect: self.dialect,
        withList: queries,
        distinct: true
      });
    }
    function update(table) {
      return new SQLiteUpdateBuilder(table, self.session, self.dialect, queries);
    }
    function insert(into) {
      return new SQLiteInsertBuilder(into, self.session, self.dialect, queries);
    }
    function delete_(from) {
      return new SQLiteDeleteBase(from, self.session, self.dialect, queries);
    }
    return { select, selectDistinct, update, insert, delete: delete_ };
  }
  select(fields) {
    return new SQLiteSelectBuilder({ fields: fields ?? void 0, session: this.session, dialect: this.dialect });
  }
  selectDistinct(fields) {
    return new SQLiteSelectBuilder({
      fields: fields ?? void 0,
      session: this.session,
      dialect: this.dialect,
      distinct: true
    });
  }
  /**
   * Creates an update query.
   *
   * Calling this method without `.where()` clause will update all rows in a table. The `.where()` clause specifies which rows should be updated.
   *
   * Use `.set()` method to specify which values to update.
   *
   * See docs: {@link https://orm.drizzle.team/docs/update}
   *
   * @param table The table to update.
   *
   * @example
   *
   * ```ts
   * // Update all rows in the 'cars' table
   * await db.update(cars).set({ color: 'red' });
   *
   * // Update rows with filters and conditions
   * await db.update(cars).set({ color: 'red' }).where(eq(cars.brand, 'BMW'));
   *
   * // Update with returning clause
   * const updatedCar: Car[] = await db.update(cars)
   *   .set({ color: 'red' })
   *   .where(eq(cars.id, 1))
   *   .returning();
   * ```
   */
  update(table) {
    return new SQLiteUpdateBuilder(table, this.session, this.dialect);
  }
  /**
   * Creates an insert query.
   *
   * Calling this method will create new rows in a table. Use `.values()` method to specify which values to insert.
   *
   * See docs: {@link https://orm.drizzle.team/docs/insert}
   *
   * @param table The table to insert into.
   *
   * @example
   *
   * ```ts
   * // Insert one row
   * await db.insert(cars).values({ brand: 'BMW' });
   *
   * // Insert multiple rows
   * await db.insert(cars).values([{ brand: 'BMW' }, { brand: 'Porsche' }]);
   *
   * // Insert with returning clause
   * const insertedCar: Car[] = await db.insert(cars)
   *   .values({ brand: 'BMW' })
   *   .returning();
   * ```
   */
  insert(into) {
    return new SQLiteInsertBuilder(into, this.session, this.dialect);
  }
  /**
   * Creates a delete query.
   *
   * Calling this method without `.where()` clause will delete all rows in a table. The `.where()` clause specifies which rows should be deleted.
   *
   * See docs: {@link https://orm.drizzle.team/docs/delete}
   *
   * @param table The table to delete from.
   *
   * @example
   *
   * ```ts
   * // Delete all rows in the 'cars' table
   * await db.delete(cars);
   *
   * // Delete rows with filters and conditions
   * await db.delete(cars).where(eq(cars.color, 'green'));
   *
   * // Delete with returning clause
   * const deletedCar: Car[] = await db.delete(cars)
   *   .where(eq(cars.id, 1))
   *   .returning();
   * ```
   */
  delete(from) {
    return new SQLiteDeleteBase(from, this.session, this.dialect);
  }
  run(query) {
    const sequel = typeof query === "string" ? sql.raw(query) : query.getSQL();
    if (this.resultKind === "async") {
      return new SQLiteRaw(
        async () => this.session.run(sequel),
        () => sequel,
        "run",
        this.dialect,
        this.session.extractRawRunValueFromBatchResult.bind(this.session)
      );
    }
    return this.session.run(sequel);
  }
  all(query) {
    const sequel = typeof query === "string" ? sql.raw(query) : query.getSQL();
    if (this.resultKind === "async") {
      return new SQLiteRaw(
        async () => this.session.all(sequel),
        () => sequel,
        "all",
        this.dialect,
        this.session.extractRawAllValueFromBatchResult.bind(this.session)
      );
    }
    return this.session.all(sequel);
  }
  get(query) {
    const sequel = typeof query === "string" ? sql.raw(query) : query.getSQL();
    if (this.resultKind === "async") {
      return new SQLiteRaw(
        async () => this.session.get(sequel),
        () => sequel,
        "get",
        this.dialect,
        this.session.extractRawGetValueFromBatchResult.bind(this.session)
      );
    }
    return this.session.get(sequel);
  }
  values(query) {
    const sequel = typeof query === "string" ? sql.raw(query) : query.getSQL();
    if (this.resultKind === "async") {
      return new SQLiteRaw(
        async () => this.session.values(sequel),
        () => sequel,
        "values",
        this.dialect,
        this.session.extractRawValuesValueFromBatchResult.bind(this.session)
      );
    }
    return this.session.values(sequel);
  }
  transaction(transaction, config) {
    return this.session.transaction(transaction, config);
  }
}
__publicField(BaseSQLiteDatabase, _Rb, "BaseSQLiteDatabase");
_Sb = entityKind;
class Cache {
}
__publicField(Cache, _Sb, "Cache");
class NoopCache extends (_Ub = Cache, _Tb = entityKind, _Ub) {
  strategy() {
    return "all";
  }
  async get(_key) {
    return void 0;
  }
  async put(_hashedQuery, _response, _tables, _config) {
  }
  async onMutate(_params) {
  }
}
__publicField(NoopCache, _Tb, "NoopCache");
async function hashQuery(sql2, params) {
  const dataToHash = `${sql2}-${JSON.stringify(params)}`;
  const encoder = new TextEncoder();
  const data = encoder.encode(dataToHash);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = [...new Uint8Array(hashBuffer)];
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  return hashHex;
}
class ExecuteResultSync extends (_Wb = QueryPromise, _Vb = entityKind, _Wb) {
  constructor(resultCb) {
    super();
    this.resultCb = resultCb;
  }
  async execute() {
    return this.resultCb();
  }
  sync() {
    return this.resultCb();
  }
}
__publicField(ExecuteResultSync, _Vb, "ExecuteResultSync");
_Xb = entityKind;
class SQLitePreparedQuery {
  constructor(mode, executeMethod, query, cache, queryMetadata, cacheConfig) {
    /** @internal */
    __publicField(this, "joinsNotNullableMap");
    var _a2;
    this.mode = mode;
    this.executeMethod = executeMethod;
    this.query = query;
    this.cache = cache;
    this.queryMetadata = queryMetadata;
    this.cacheConfig = cacheConfig;
    if (cache && cache.strategy() === "all" && cacheConfig === void 0) {
      this.cacheConfig = { enable: true, autoInvalidate: true };
    }
    if (!((_a2 = this.cacheConfig) == null ? void 0 : _a2.enable)) {
      this.cacheConfig = void 0;
    }
  }
  /** @internal */
  async queryWithCache(queryString, params, query) {
    if (this.cache === void 0 || is(this.cache, NoopCache) || this.queryMetadata === void 0) {
      try {
        return await query();
      } catch (e) {
        throw new DrizzleQueryError(queryString, params, e);
      }
    }
    if (this.cacheConfig && !this.cacheConfig.enable) {
      try {
        return await query();
      } catch (e) {
        throw new DrizzleQueryError(queryString, params, e);
      }
    }
    if ((this.queryMetadata.type === "insert" || this.queryMetadata.type === "update" || this.queryMetadata.type === "delete") && this.queryMetadata.tables.length > 0) {
      try {
        const [res] = await Promise.all([
          query(),
          this.cache.onMutate({ tables: this.queryMetadata.tables })
        ]);
        return res;
      } catch (e) {
        throw new DrizzleQueryError(queryString, params, e);
      }
    }
    if (!this.cacheConfig) {
      try {
        return await query();
      } catch (e) {
        throw new DrizzleQueryError(queryString, params, e);
      }
    }
    if (this.queryMetadata.type === "select") {
      const fromCache = await this.cache.get(
        this.cacheConfig.tag ?? await hashQuery(queryString, params),
        this.queryMetadata.tables,
        this.cacheConfig.tag !== void 0,
        this.cacheConfig.autoInvalidate
      );
      if (fromCache === void 0) {
        let result;
        try {
          result = await query();
        } catch (e) {
          throw new DrizzleQueryError(queryString, params, e);
        }
        await this.cache.put(
          this.cacheConfig.tag ?? await hashQuery(queryString, params),
          result,
          // make sure we send tables that were used in a query only if user wants to invalidate it on each write
          this.cacheConfig.autoInvalidate ? this.queryMetadata.tables : [],
          this.cacheConfig.tag !== void 0,
          this.cacheConfig.config
        );
        return result;
      }
      return fromCache;
    }
    try {
      return await query();
    } catch (e) {
      throw new DrizzleQueryError(queryString, params, e);
    }
  }
  getQuery() {
    return this.query;
  }
  mapRunResult(result, _isFromBatch) {
    return result;
  }
  mapAllResult(_result, _isFromBatch) {
    throw new Error("Not implemented");
  }
  mapGetResult(_result, _isFromBatch) {
    throw new Error("Not implemented");
  }
  execute(placeholderValues) {
    if (this.mode === "async") {
      return this[this.executeMethod](placeholderValues);
    }
    return new ExecuteResultSync(() => this[this.executeMethod](placeholderValues));
  }
  mapResult(response, isFromBatch) {
    switch (this.executeMethod) {
      case "run": {
        return this.mapRunResult(response, isFromBatch);
      }
      case "all": {
        return this.mapAllResult(response, isFromBatch);
      }
      case "get": {
        return this.mapGetResult(response, isFromBatch);
      }
    }
  }
}
__publicField(SQLitePreparedQuery, _Xb, "PreparedQuery");
_Yb = entityKind;
class SQLiteSession {
  constructor(dialect) {
    this.dialect = dialect;
  }
  prepareOneTimeQuery(query, fields, executeMethod, isResponseInArrayMode, customResultMapper, queryMetadata, cacheConfig) {
    return this.prepareQuery(
      query,
      fields,
      executeMethod,
      isResponseInArrayMode,
      customResultMapper,
      queryMetadata,
      cacheConfig
    );
  }
  run(query) {
    const staticQuery = this.dialect.sqlToQuery(query);
    try {
      return this.prepareOneTimeQuery(staticQuery, void 0, "run", false).run();
    } catch (err) {
      throw new DrizzleError({ cause: err, message: `Failed to run the query '${staticQuery.sql}'` });
    }
  }
  /** @internal */
  extractRawRunValueFromBatchResult(result) {
    return result;
  }
  all(query) {
    return this.prepareOneTimeQuery(this.dialect.sqlToQuery(query), void 0, "run", false).all();
  }
  /** @internal */
  extractRawAllValueFromBatchResult(_result) {
    throw new Error("Not implemented");
  }
  get(query) {
    return this.prepareOneTimeQuery(this.dialect.sqlToQuery(query), void 0, "run", false).get();
  }
  /** @internal */
  extractRawGetValueFromBatchResult(_result) {
    throw new Error("Not implemented");
  }
  values(query) {
    return this.prepareOneTimeQuery(this.dialect.sqlToQuery(query), void 0, "run", false).values();
  }
  async count(sql2) {
    const result = await this.values(sql2);
    return result[0][0];
  }
  /** @internal */
  extractRawValuesValueFromBatchResult(_result) {
    throw new Error("Not implemented");
  }
}
__publicField(SQLiteSession, _Yb, "SQLiteSession");
class SQLiteTransaction extends (__b = BaseSQLiteDatabase, _Zb = entityKind, __b) {
  constructor(resultType, dialect, session, schema, nestedIndex = 0) {
    super(resultType, dialect, session, schema);
    this.schema = schema;
    this.nestedIndex = nestedIndex;
  }
  rollback() {
    throw new TransactionRollbackError();
  }
}
__publicField(SQLiteTransaction, _Zb, "SQLiteTransaction");
sqliteTable("app_metadata", {
  key: text("key").primaryKey(),
  value: text("value").notNull()
});
const reusableProductsTable = sqliteTable(
  "reusable_products",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    category: text("category").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    material: text("material").notNull(),
    variant: text("variant").notNull(),
    searchTextNormalized: text("search_text_normalized").notNull(),
    duplicateKey: text("duplicate_key").notNull(),
    deletedAt: text("deleted_at"),
    createdAt: text("created_at").notNull().default(drizzleOrm.sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(drizzleOrm.sql`CURRENT_TIMESTAMP`)
  },
  (table) => ({
    searchIndex: index("reusable_products_search_text_normalized_idx").on(table.searchTextNormalized),
    duplicateKeyIndex: index("reusable_products_duplicate_key_idx").on(table.duplicateKey)
  })
);
sqliteTable(
  "settings_margin_rules",
  {
    category: text("category").notNull(),
    materialNormalized: text("material_normalized").notNull(),
    materialLabel: text("material_label"),
    profitPercentageBasisPoints: integer("profit_percentage_basis_points").notNull(),
    personalizationPercentageBasisPoints: integer("personalization_percentage_basis_points").notNull()
  },
  (table) => ({
    pk: primaryKey({ columns: [table.category, table.materialNormalized] })
  })
);
const stockIntakesTable = sqliteTable(
  "stock_intakes",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    reusableProductId: integer("reusable_product_id").notNull().references(() => reusableProductsTable.id),
    enteredQuantity: integer("entered_quantity").notNull(),
    availableQuantity: integer("available_quantity").notNull(),
    supplierUnitCostCents: integer("supplier_unit_cost_cents").notNull(),
    cashPriceCents: integer("cash_price_cents").notNull(),
    listPriceCents: integer("list_price_cents").notNull(),
    profitPercentageBasisPoints: integer("profit_percentage_basis_points").notNull(),
    expectedProfitCents: integer("expected_profit_cents").notNull(),
    personalizationAmountCents: integer("personalization_amount_cents"),
    personalizationPercentageBasisPoints: integer("personalization_percentage_basis_points"),
    personalizationExpectedProfitCents: integer("personalization_expected_profit_cents"),
    intakeDate: text("intake_date").notNull(),
    notes: text("notes"),
    createdAt: text("created_at").notNull().default(drizzleOrm.sql`CURRENT_TIMESTAMP`)
  },
  (table) => ({
    productIndex: index("stock_intakes_reusable_product_id_idx").on(table.reusableProductId),
    intakeDateIndex: index("stock_intakes_intake_date_idx").on(table.intakeDate)
  })
);
const customersTable = sqliteTable(
  "customers",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    phoneText: text("phone_text").notNull(),
    note: text("note"),
    createdAt: text("created_at").notNull().default(drizzleOrm.sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(drizzleOrm.sql`CURRENT_TIMESTAMP`)
  },
  (table) => ({
    phoneIndex: index("customers_phone_text_idx").on(table.phoneText)
  })
);
const salesTable = sqliteTable(
  "sales",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    saleNumber: integer("sale_number").notNull(),
    customerId: integer("customer_id").references(() => customersTable.id),
    customerNameSnapshot: text("customer_name_snapshot"),
    customerPhoneSnapshot: text("customer_phone_snapshot"),
    customerNoteSnapshot: text("customer_note_snapshot"),
    saleDate: text("sale_date").notNull(),
    totalCents: integer("total_cents").notNull(),
    paidCents: integer("paid_cents").notNull(),
    balanceCents: integer("balance_cents").notNull(),
    status: text("status").notNull(),
    cancellationReason: text("cancellation_reason"),
    createdAt: text("created_at").notNull().default(drizzleOrm.sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(drizzleOrm.sql`CURRENT_TIMESTAMP`)
  },
  (table) => ({
    saleNumberIndex: index("sales_sale_number_idx").on(table.saleNumber),
    customerIndex: index("sales_customer_id_idx").on(table.customerId),
    statusIndex: index("sales_status_idx").on(table.status)
  })
);
const saleItemsTable = sqliteTable(
  "sale_items",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    saleId: integer("sale_id").notNull().references(() => salesTable.id),
    reusableProductId: integer("reusable_product_id").notNull().references(() => reusableProductsTable.id),
    productCategorySnapshot: text("product_category_snapshot").notNull(),
    productNameSnapshot: text("product_name_snapshot").notNull(),
    productMaterialSnapshot: text("product_material_snapshot").notNull(),
    productVariantSnapshot: text("product_variant_snapshot").notNull(),
    quantity: integer("quantity").notNull(),
    priceType: text("price_type").notNull(),
    unitPriceCents: integer("unit_price_cents").notNull(),
    unitBasePriceCents: integer("unit_base_price_cents"),
    unitPersonalizationAmountCents: integer("unit_personalization_amount_cents"),
    personalizationPercentageBasisPoints: integer("personalization_percentage_basis_points"),
    lineSubtotalCents: integer("line_subtotal_cents").notNull(),
    lineBaseSubtotalCents: integer("line_base_subtotal_cents"),
    linePersonalizationSubtotalCents: integer("line_personalization_subtotal_cents"),
    productGainCents: integer("product_gain_cents"),
    personalizationGainCents: integer("personalization_gain_cents"),
    totalGainCents: integer("total_gain_cents"),
    consignmentStatus: text("consignment_status").notNull(),
    createdAt: text("created_at").notNull().default(drizzleOrm.sql`CURRENT_TIMESTAMP`)
  },
  (table) => ({
    saleIndex: index("sale_items_sale_id_idx").on(table.saleId),
    productIndex: index("sale_items_reusable_product_id_idx").on(table.reusableProductId),
    consignmentStatusIndex: index("sale_items_consignment_status_idx").on(table.consignmentStatus)
  })
);
sqliteTable(
  "sale_item_allocations",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    saleItemId: integer("sale_item_id").notNull().references(() => saleItemsTable.id),
    stockIntakeId: integer("stock_intake_id").notNull().references(() => stockIntakesTable.id),
    consumedQuantity: integer("consumed_quantity").notNull(),
    historicalSupplierUnitCostCents: integer("historical_supplier_unit_cost_cents").notNull(),
    historicalProfitPercentageBasisPoints: integer("historical_profit_percentage_basis_points").notNull(),
    historicalCashPriceCents: integer("historical_cash_price_cents").notNull(),
    historicalListPriceCents: integer("historical_list_price_cents").notNull(),
    historicalPersonalizationAmountCents: integer("historical_personalization_amount_cents"),
    historicalPersonalizationPercentageBasisPoints: integer("historical_personalization_percentage_basis_points"),
    historicalPersonalizationExpectedProfitCents: integer("historical_personalization_expected_profit_cents"),
    allocationOrder: integer("allocation_order").notNull(),
    createdAt: text("created_at").notNull().default(drizzleOrm.sql`CURRENT_TIMESTAMP`)
  },
  (table) => ({
    saleItemIndex: index("sale_item_allocations_sale_item_id_idx").on(table.saleItemId),
    stockIntakeIndex: index("sale_item_allocations_stock_intake_id_idx").on(table.stockIntakeId)
  })
);
sqliteTable(
  "payments",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    saleId: integer("sale_id").notNull().references(() => salesTable.id),
    paymentDate: text("payment_date").notNull(),
    amountCents: integer("amount_cents").notNull(),
    paymentMethod: text("payment_method"),
    note: text("note"),
    cancelledAt: text("cancelled_at"),
    cancellationReason: text("cancellation_reason"),
    createdAt: text("created_at").notNull().default(drizzleOrm.sql`CURRENT_TIMESTAMP`)
  },
  (table) => ({
    saleIndex: index("payments_sale_id_idx").on(table.saleId),
    activeIndex: index("payments_cancelled_at_idx").on(table.cancelledAt)
  })
);
const consignmentBatchesTable = sqliteTable(
  "consignment_batches",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    batchNumber: integer("batch_number").notNull(),
    liquidationDate: text("liquidation_date").notNull(),
    totalCents: integer("total_cents").notNull(),
    totalGainCents: integer("total_gain_cents").notNull().default(0),
    notes: text("notes"),
    createdAt: text("created_at").notNull().default(drizzleOrm.sql`CURRENT_TIMESTAMP`)
  },
  (table) => ({
    batchNumberIndex: index("consignment_batches_batch_number_idx").on(table.batchNumber),
    liquidationDateIndex: index("consignment_batches_liquidation_date_idx").on(table.liquidationDate)
  })
);
sqliteTable(
  "consignment_batch_items",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    batchId: integer("batch_id").notNull().references(() => consignmentBatchesTable.id),
    saleItemId: integer("sale_item_id").notNull().references(() => saleItemsTable.id),
    amountCents: integer("amount_cents").notNull(),
    createdAt: text("created_at").notNull().default(drizzleOrm.sql`CURRENT_TIMESTAMP`)
  },
  (table) => ({
    batchIndex: index("consignment_batch_items_batch_id_idx").on(table.batchId),
    saleItemIndex: index("consignment_batch_items_sale_item_id_idx").on(table.saleItemId)
  })
);
sqliteTable(
  "audit_logs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    occurredAt: text("occurred_at").notNull(),
    operationType: text("operation_type").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    summary: text("summary").notNull(),
    detailJson: text("detail_json")
  },
  (table) => ({
    operationIndex: index("audit_logs_operation_type_idx").on(table.operationType),
    entityIndex: index("audit_logs_entity_type_entity_id_idx").on(table.entityType, table.entityId)
  })
);
function normalizeSearchText(value) {
  return value.normalize("NFD").replace(new RegExp("\\p{Diacritic}", "gu"), "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim().replace(/\s+/g, " ");
}
function tokenizeSearchQuery(query) {
  return normalizeSearchText(query).split(" ").filter((token) => token.length > 0);
}
function collapseSpacing(value) {
  return value.replace(/\s+/g, "");
}
function normalizeReusableProductIdentity(product) {
  const normalizedCategory = normalizeSearchText(product.category);
  const normalizedName = normalizeSearchText(product.name);
  const normalizedMaterial = normalizeSearchText(product.material);
  const normalizedVariant = normalizeSearchText(product.variant ?? "");
  const searchAliases = Array.from(
    new Set([
      normalizedCategory,
      normalizedName,
      normalizedMaterial,
      normalizedVariant,
      collapseSpacing(normalizedCategory),
      collapseSpacing(normalizedName),
      collapseSpacing(normalizedMaterial),
      collapseSpacing(normalizedVariant)
    ].filter((value) => value.length > 0))
  );
  return {
    normalizedCategory,
    normalizedName,
    normalizedMaterial,
    normalizedVariant,
    searchTextNormalized: searchAliases.join(" "),
    duplicateKey: [normalizedCategory, normalizedName, normalizedMaterial, normalizedVariant].map(collapseSpacing).join("|")
  };
}
function mapCatalogListRow(row) {
  return {
    ...row,
    isOutOfStock: row.availableQuantity === 0
  };
}
function trimMaterial(material) {
  return material.trim();
}
function buildCategoryClause(category) {
  if (category === "all") {
    return {
      clause: "",
      parameters: []
    };
  }
  return {
    clause: "rp.category = ?",
    parameters: [category]
  };
}
function buildSearchClause(query) {
  const tokens = tokenizeSearchQuery(query);
  if (tokens.length === 0) {
    return {
      clause: "",
      parameters: []
    };
  }
  return {
    clause: tokens.map(() => "rp.search_text_normalized LIKE ?").join(" AND "),
    parameters: tokens.map((token) => `%${token}%`)
  };
}
function combineWhereClauses(...clauses) {
  const activeClauses = clauses.filter((clause) => clause.length > 0);
  return activeClauses.length > 0 ? `WHERE ${activeClauses.join(" AND ")}` : "";
}
const ACTIVE_PRODUCT_CLAUSE = "rp.deleted_at IS NULL";
function createReusableProductRecord(database, product) {
  var _a2;
  const normalized = normalizeReusableProductIdentity(product);
  const now = product.now ?? (/* @__PURE__ */ new Date()).toISOString();
  const variant = product.variant ?? "";
  const description = ((_a2 = product.description) == null ? void 0 : _a2.trim()) || null;
  const statement = database.client.prepare(
    `
      INSERT INTO reusable_products (
        category,
        name,
        description,
        material,
        variant,
        search_text_normalized,
        duplicate_key,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
  );
  const result = statement.run(
    product.category,
    product.name.trim(),
    description,
    trimMaterial(product.material),
    variant.trim(),
    normalized.searchTextNormalized,
    normalized.duplicateKey,
    now,
    now
  );
  return Number(result.lastInsertRowid);
}
function updateReusableProductRecord(database, reusableProductId, product) {
  var _a2, _b2;
  const normalized = normalizeReusableProductIdentity(product);
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const result = database.client.prepare(
    `
        UPDATE reusable_products
        SET category = ?,
            name = ?,
            description = ?,
            material = ?,
            variant = ?,
            search_text_normalized = ?,
            duplicate_key = ?,
            updated_at = ?
        WHERE id = ? AND deleted_at IS NULL
      `
  ).run(
    product.category,
    product.name.trim(),
    ((_a2 = product.description) == null ? void 0 : _a2.trim()) || null,
    trimMaterial(product.material),
    ((_b2 = product.variant) == null ? void 0 : _b2.trim()) ?? "",
    normalized.searchTextNormalized,
    normalized.duplicateKey,
    now,
    reusableProductId
  );
  if (result.changes === 0) {
    throw new Error(`Reusable product ${reusableProductId} was not found.`);
  }
  return { reusableProductId };
}
function findDuplicateReusableProducts(database, product) {
  const normalized = normalizeReusableProductIdentity(product);
  const statement = database.client.prepare(
    `
      SELECT
        rp.id AS reusableProductId,
        rp.category AS category,
        rp.name AS name,
        rp.material AS material,
        rp.variant AS variant,
        COALESCE(SUM(si.available_quantity), 0) AS availableQuantity
      FROM reusable_products rp
      LEFT JOIN stock_intakes si ON si.reusable_product_id = rp.id
      WHERE rp.duplicate_key = ? AND rp.deleted_at IS NULL
      GROUP BY rp.id, rp.category, rp.name, rp.material, rp.variant
      ORDER BY rp.name ASC, rp.variant ASC
    `
  );
  return statement.all(normalized.duplicateKey);
}
function searchReusableProducts(database, query, limit = 20) {
  const tokens = tokenizeSearchQuery(query);
  if (tokens.length === 0) {
    return [];
  }
  const whereClauses = [ACTIVE_PRODUCT_CLAUSE, ...tokens.map(() => "rp.search_text_normalized LIKE ?")].join(" AND ");
  const parameters = tokens.map((token) => `%${token}%`);
  const statement = database.client.prepare(
    `
      SELECT
        rp.id AS reusableProductId,
        rp.category AS category,
        rp.name AS name,
        rp.material AS material,
        rp.variant AS variant,
        COALESCE(SUM(si.available_quantity), 0) AS availableQuantity
      FROM reusable_products rp
      LEFT JOIN stock_intakes si ON si.reusable_product_id = rp.id
      WHERE ${whereClauses}
      GROUP BY rp.id, rp.category, rp.name, rp.material, rp.variant
      ORDER BY rp.name ASC, rp.variant ASC
      LIMIT ?
    `
  );
  const rows = statement.all(...parameters, limit);
  return rows.map((row) => ({
    ...row,
    isOutOfStock: row.availableQuantity === 0
  }));
}
function listCatalogProducts(database, {
  query = "",
  category = "all",
  limit = 200,
  recentLimit = 6
} = {}) {
  const searchFilter = buildSearchClause(query);
  const categoryFilter = buildCategoryClause(category);
  const catalogWhere = combineWhereClauses(ACTIVE_PRODUCT_CLAUSE, searchFilter.clause, categoryFilter.clause);
  const recentWhere = combineWhereClauses(ACTIVE_PRODUCT_CLAUSE, categoryFilter.clause);
  const sharedSelect = `
      SELECT
        rp.id AS reusableProductId,
        rp.category AS category,
        rp.name AS name,
        rp.material AS material,
        rp.variant AS variant,
        COALESCE(SUM(si.available_quantity), 0) AS availableQuantity,
        (
          SELECT si_latest.cash_price_cents
          FROM stock_intakes si_latest
          WHERE si_latest.reusable_product_id = rp.id
          ORDER BY si_latest.intake_date DESC, si_latest.id DESC
          LIMIT 1
        ) AS currentCashPriceCents,
        (
          SELECT si_latest.list_price_cents
          FROM stock_intakes si_latest
          WHERE si_latest.reusable_product_id = rp.id
          ORDER BY si_latest.intake_date DESC, si_latest.id DESC
          LIMIT 1
        ) AS currentListPriceCents
      FROM reusable_products rp
      LEFT JOIN stock_intakes si ON si.reusable_product_id = rp.id
    `;
  const productsStatement = database.client.prepare(
    `
      ${sharedSelect}
      ${catalogWhere}
      GROUP BY rp.id, rp.category, rp.name, rp.material, rp.variant
      ORDER BY rp.name ASC, rp.variant ASC, rp.id ASC
      LIMIT ?
    `
  );
  const recentProductsStatement = database.client.prepare(
    `
      ${sharedSelect}
      ${recentWhere}
      GROUP BY rp.id, rp.category, rp.name, rp.material, rp.variant
      ORDER BY rp.created_at DESC, rp.id DESC
      LIMIT ?
    `
  );
  const products = productsStatement.all(
    ...searchFilter.parameters,
    ...categoryFilter.parameters,
    limit
  );
  const recentProducts = recentProductsStatement.all(
    ...categoryFilter.parameters,
    recentLimit
  );
  return {
    recentProducts: recentProducts.map(mapCatalogListRow),
    products: products.map(mapCatalogListRow)
  };
}
function getCatalogProductDetail(database, reusableProductId, recentIntakesLimit = 5) {
  const detailStatement = database.client.prepare(
    `
      SELECT
        rp.id AS reusableProductId,
        rp.category AS category,
        rp.name AS name,
        rp.description AS description,
        rp.material AS material,
        rp.variant AS variant,
        COALESCE(SUM(si.available_quantity), 0) AS availableQuantity,
        (
          SELECT si_latest.cash_price_cents
          FROM stock_intakes si_latest
          WHERE si_latest.reusable_product_id = rp.id
          ORDER BY si_latest.intake_date DESC, si_latest.id DESC
          LIMIT 1
        ) AS currentCashPriceCents,
        (
          SELECT si_latest.list_price_cents
          FROM stock_intakes si_latest
          WHERE si_latest.reusable_product_id = rp.id
          ORDER BY si_latest.intake_date DESC, si_latest.id DESC
          LIMIT 1
        ) AS currentListPriceCents,
        (
          SELECT si_latest.profit_percentage_basis_points
          FROM stock_intakes si_latest
          WHERE si_latest.reusable_product_id = rp.id
          ORDER BY si_latest.intake_date DESC, si_latest.id DESC
          LIMIT 1
        ) AS currentProfitPercentageBasisPoints,
        (
          SELECT si_latest.expected_profit_cents
          FROM stock_intakes si_latest
          WHERE si_latest.reusable_product_id = rp.id
          ORDER BY si_latest.intake_date DESC, si_latest.id DESC
          LIMIT 1
        ) AS currentExpectedProfitCents,
        (
          SELECT si_latest.personalization_expected_profit_cents
          FROM stock_intakes si_latest
          WHERE si_latest.reusable_product_id = rp.id
          ORDER BY si_latest.intake_date DESC, si_latest.id DESC
          LIMIT 1
        ) AS currentPersonalizationExpectedProfitCents
      FROM reusable_products rp
      LEFT JOIN stock_intakes si ON si.reusable_product_id = rp.id
       WHERE rp.id = ? AND rp.deleted_at IS NULL
      GROUP BY rp.id, rp.category, rp.name, rp.description, rp.material, rp.variant
      LIMIT 1
    `
  );
  const detailRow = detailStatement.get(reusableProductId);
  if (!detailRow) {
    throw new Error(`Reusable product ${reusableProductId} was not found.`);
  }
  const recentIntakesStatement = database.client.prepare(
    `
      SELECT
        si.id AS stockIntakeId,
        si.entered_quantity AS enteredQuantity,
        si.available_quantity AS availableQuantity,
        si.supplier_unit_cost_cents AS supplierUnitCostCents,
        si.cash_price_cents AS cashPriceCents,
        si.list_price_cents AS listPriceCents,
        si.profit_percentage_basis_points AS profitPercentageBasisPoints,
        si.expected_profit_cents AS expectedProfitCents,
        si.personalization_amount_cents AS personalizationAmountCents,
        si.personalization_percentage_basis_points AS personalizationPercentageBasisPoints,
        si.personalization_expected_profit_cents AS personalizationExpectedProfitCents,
        si.intake_date AS intakeDate,
        si.notes AS notes
      FROM stock_intakes si
      WHERE si.reusable_product_id = ?
      ORDER BY si.intake_date DESC, si.id DESC
      LIMIT ?
    `
  );
  const recentIntakeRows = recentIntakesStatement.all(
    reusableProductId,
    recentIntakesLimit
  );
  const recentIntakes = recentIntakeRows.map((row) => ({
    ...row,
    totalExpectedProfitCents: row.expectedProfitCents + (row.personalizationExpectedProfitCents ?? 0)
  }));
  return {
    ...detailRow,
    currentTotalExpectedProfitCents: detailRow.currentExpectedProfitCents == null ? null : detailRow.currentExpectedProfitCents + (detailRow.currentPersonalizationExpectedProfitCents ?? 0),
    recentIntakes
  };
}
function assertReusableProductExists(database, reusableProductId) {
  const reusableProduct = database.orm.select({
    id: reusableProductsTable.id,
    category: reusableProductsTable.category,
    deletedAt: reusableProductsTable.deletedAt
  }).from(reusableProductsTable).where(drizzleOrm.eq(reusableProductsTable.id, reusableProductId)).get();
  if (!reusableProduct || reusableProduct.deletedAt != null) {
    throw new Error(`Reusable product ${reusableProductId} was not found.`);
  }
  return {
    id: reusableProduct.id,
    category: reusableProduct.category
  };
}
function deleteReusableProductRecord(database, reusableProductId) {
  const deletedAt = (/* @__PURE__ */ new Date()).toISOString();
  const result = database.client.prepare(
    `
        UPDATE reusable_products
        SET deleted_at = ?,
            updated_at = ?
        WHERE id = ? AND deleted_at IS NULL
      `
  ).run(deletedAt, deletedAt, reusableProductId);
  if (result.changes === 0) {
    throw new Error(`Reusable product ${reusableProductId} was not found.`);
  }
  return { reusableProductId };
}
function createCatalogDeleteProductChannel({
  database
}) {
  return {
    channel: CATALOG_DELETE_PRODUCT_CHANNEL,
    requestSchema: deleteReusableProductRequestSchema,
    handle: ({ reusableProductId }) => deleteReusableProductRecord(database, reusableProductId)
  };
}
function createCatalogListChannel({
  database
}) {
  return {
    channel: CATALOG_LIST_CHANNEL,
    requestSchema: catalogListRequestSchema,
    handle: ({ query, category, limit, recentLimit }) => listCatalogProducts(database, { query, category, limit, recentLimit })
  };
}
function createCatalogProductDetailChannel({
  database
}) {
  return {
    channel: CATALOG_PRODUCT_DETAIL_CHANNEL,
    requestSchema: catalogProductDetailRequestSchema,
    handle: ({ reusableProductId, recentIntakesLimit }) => getCatalogProductDetail(database, reusableProductId, recentIntakesLimit)
  };
}
function createCatalogSearchChannel({
  database
}) {
  return {
    channel: CATALOG_SEARCH_CHANNEL,
    requestSchema: catalogSearchRequestSchema,
    handle: ({ query, limit }) => searchReusableProducts(database, query, limit)
  };
}
function createCatalogUpdateProductChannel({
  database
}) {
  return {
    channel: CATALOG_UPDATE_PRODUCT_CHANNEL,
    requestSchema: updateReusableProductRequestSchema,
    handle: ({ reusableProductId, product }) => updateReusableProductRecord(database, reusableProductId, product)
  };
}
const trimmedString$1 = zod.z.string().trim();
const isoDateStringSchema = trimmedString$1.refine((value) => !Number.isNaN(Date.parse(value)), {
  message: "Ingresá una fecha válida para la liquidación."
});
const listPendingConsignmentItemsRequestSchema = zod.z.object({
  limit: zod.z.number().int().positive().max(200).optional()
}).strict();
const confirmConsignmentBatchRequestSchema = zod.z.object({
  saleItemIds: zod.z.array(zod.z.number().int().positive()).min(1, "Seleccioná al menos un artículo para liquidar."),
  liquidationDate: isoDateStringSchema,
  notes: trimmedString$1.nullable().optional()
}).strict();
const listConsignmentBatchHistoryRequestSchema = zod.z.object({
  limit: zod.z.number().int().positive().max(200).optional()
}).strict();
const getConsignmentBatchDetailRequestSchema = zod.z.object({
  batchId: zod.z.number().int().positive()
}).strict();
const exportConsignmentBatchExcelRequestSchema = zod.z.object({
  batchId: zod.z.number().int().positive()
}).strict();
const DEFAULT_PERSONALIZATION_BASIS_POINTS = 500;
function calculateExpectedProfitCents(amountCents, basisPoints) {
  return Math.round(amountCents * basisPoints / 1e4);
}
function isPersonalizationAllowed(category) {
  return category === "jewelry" || category === "mate";
}
function calculatePricingSummary({
  supplierUnitCostCents,
  profitPercentageBasisPoints,
  personalizationAmountCents,
  personalizationPercentageBasisPoints
}) {
  const expectedProfitCents = calculateExpectedProfitCents(
    supplierUnitCostCents,
    profitPercentageBasisPoints
  );
  const suggestedPriceCents = supplierUnitCostCents + expectedProfitCents;
  if (personalizationAmountCents == null) {
    return {
      expectedProfitCents,
      suggestedPriceCents,
      personalizationPercentageBasisPoints: null,
      personalizationExpectedProfitCents: null,
      totalExpectedProfitCents: expectedProfitCents
    };
  }
  const resolvedPersonalizationBasisPoints = personalizationPercentageBasisPoints ?? DEFAULT_PERSONALIZATION_BASIS_POINTS;
  const personalizationExpectedProfitCents = calculateExpectedProfitCents(
    personalizationAmountCents,
    resolvedPersonalizationBasisPoints
  );
  return {
    expectedProfitCents,
    suggestedPriceCents,
    personalizationPercentageBasisPoints: resolvedPersonalizationBasisPoints,
    personalizationExpectedProfitCents,
    totalExpectedProfitCents: expectedProfitCents + personalizationExpectedProfitCents
  };
}
function loadHistoricalSaleItemFinancialsMap(database, saleItemIds) {
  if (saleItemIds.length === 0) {
    return /* @__PURE__ */ new Map();
  }
  const snapshotRows = loadSaleItemSnapshotFinancialRows(database, saleItemIds);
  const financialMap = /* @__PURE__ */ new Map();
  const missingSaleItemIds = [];
  snapshotRows.forEach((row) => {
    if (row.productGainCents == null || row.personalizationGainCents == null || row.totalGainCents == null) {
      missingSaleItemIds.push(row.saleItemId);
      return;
    }
    financialMap.set(row.saleItemId, {
      personalizationCents: row.personalizationCents,
      productGainCents: row.productGainCents,
      personalizationGainCents: row.personalizationGainCents,
      totalGainCents: row.totalGainCents
    });
  });
  const rows = loadHistoricalSaleItemProfitRows(database, missingSaleItemIds);
  rows.forEach((row) => {
    const productGainCents = row.consumedQuantity * calculateExpectedProfitCents(
      row.historicalSupplierUnitCostCents,
      row.historicalProfitPercentageBasisPoints
    );
    const personalizationGainCents = row.consumedQuantity * (row.historicalPersonalizationExpectedProfitCents ?? 0);
    const current = financialMap.get(row.saleItemId) ?? {
      personalizationCents: null,
      productGainCents: 0,
      personalizationGainCents: 0,
      totalGainCents: 0
    };
    financialMap.set(row.saleItemId, {
      personalizationCents: row.historicalPersonalizationAmountCents == null ? current.personalizationCents : (current.personalizationCents ?? 0) + row.consumedQuantity * row.historicalPersonalizationAmountCents,
      productGainCents: current.productGainCents + productGainCents,
      personalizationGainCents: current.personalizationGainCents + personalizationGainCents,
      totalGainCents: current.totalGainCents + productGainCents + personalizationGainCents
    });
  });
  return financialMap;
}
function loadHistoricalSaleItemProfitMap(database, saleItemIds) {
  return new Map(
    Array.from(loadHistoricalSaleItemFinancialsMap(database, saleItemIds).entries()).map(([saleItemId, financials]) => [
      saleItemId,
      financials.totalGainCents
    ])
  );
}
function sumHistoricalSaleItemProfits(profitMap, saleItemIds) {
  return saleItemIds.reduce((sum, saleItemId) => sum + (profitMap.get(saleItemId) ?? 0), 0);
}
function loadHistoricalSaleItemProfitRows(database, saleItemIds) {
  if (saleItemIds.length === 0) {
    return [];
  }
  const placeholders = saleItemIds.map(() => "?").join(", ");
  return database.client.prepare(
    `
        SELECT
          sale_item_id AS saleItemId,
          consumed_quantity AS consumedQuantity,
          historical_supplier_unit_cost_cents AS historicalSupplierUnitCostCents,
          historical_profit_percentage_basis_points AS historicalProfitPercentageBasisPoints,
          historical_personalization_amount_cents AS historicalPersonalizationAmountCents,
          historical_personalization_expected_profit_cents AS historicalPersonalizationExpectedProfitCents
        FROM sale_item_allocations
        WHERE sale_item_id IN (${placeholders})
        ORDER BY sale_item_id ASC, allocation_order ASC, id ASC
      `
  ).all(...saleItemIds);
}
function loadSaleItemSnapshotFinancialRows(database, saleItemIds) {
  const placeholders = saleItemIds.map(() => "?").join(", ");
  return database.client.prepare(
    `
        SELECT
          id AS saleItemId,
          unit_personalization_amount_cents * quantity AS personalizationCents,
          product_gain_cents AS productGainCents,
          personalization_gain_cents AS personalizationGainCents,
          total_gain_cents AS totalGainCents
        FROM sale_items
        WHERE id IN (${placeholders})
      `
  ).all(...saleItemIds);
}
const STATUS_CANCELLED$1 = "cancelled";
const STATUS_PENDING_SETTLEMENT = "pending_settlement";
const STATUS_SETTLED = "settled";
class ConsignmentServiceError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
    this.name = "ConsignmentServiceError";
  }
}
function listPendingConsignmentItems(database, request = {}) {
  const payload = listPendingConsignmentItemsRequestSchema.parse(request);
  const limit = payload.limit ?? 200;
  const rows = database.client.prepare(
    `
        SELECT
          si.id AS saleItemId,
          si.product_name_snapshot AS productName,
          s.sale_number AS saleNumber,
          s.sale_date AS saleDate,
          s.customer_name_snapshot AS buyerName,
          COALESCE(SUM(sia.consumed_quantity * sia.historical_supplier_unit_cost_cents), 0) AS amountCents,
          0 AS gainCents
        FROM sale_items si
        INNER JOIN sales s ON s.id = si.sale_id
        INNER JOIN sale_item_allocations sia ON sia.sale_item_id = si.id
        LEFT JOIN consignment_batch_items cbi ON cbi.sale_item_id = si.id
        WHERE s.status <> ?
          AND si.consignment_status = ?
          AND cbi.id IS NULL
        GROUP BY si.id, si.product_name_snapshot, s.sale_number, s.sale_date, s.customer_name_snapshot
        ORDER BY s.sale_date DESC, s.sale_number DESC, si.id DESC
        LIMIT ?
      `
  ).all(STATUS_CANCELLED$1, STATUS_PENDING_SETTLEMENT, limit);
  const profitMap = loadHistoricalSaleItemProfitMap(
    database,
    rows.map((row) => row.saleItemId)
  );
  return rows.map((row) => ({
    ...row,
    gainCents: sumHistoricalSaleItemProfits(profitMap, [row.saleItemId])
  }));
}
function confirmConsignmentBatch(database, request) {
  const payload = confirmConsignmentBatchRequestSchema.parse(request);
  const normalizedIds = normalizeSaleItemIds(payload.saleItemIds);
  const notes = normalizeOptionalNote(payload.notes);
  const liquidationDate = payload.liquidationDate;
  const createdAt = (/* @__PURE__ */ new Date()).toISOString();
  const transaction = database.client.transaction(() => {
    const saleItems = loadSaleItemsForSettlement(database, normalizedIds);
    const historicalAmounts = loadHistoricalAmounts(database, normalizedIds);
    const totalCents = normalizedIds.reduce((sum, saleItemId) => {
      const amount = historicalAmounts.get(saleItemId);
      if (amount == null) {
        throw new ConsignmentServiceError(
          "SALE_ITEM_WITHOUT_HISTORICAL_COST",
          `Sale item ${saleItemId} does not have historical cost allocations.`
        );
      }
      return sum + amount.amountCents;
    }, 0);
    const totalGainCents = sumHistoricalSaleItemProfits(
      loadHistoricalSaleItemProfitMap(database, normalizedIds),
      normalizedIds
    );
    const batchNumber = nextBatchNumber(database);
    const batchInsert = database.client.prepare(
      `
          INSERT INTO consignment_batches (
            batch_number,
            liquidation_date,
            total_cents,
            total_gain_cents,
            notes,
            created_at
          ) VALUES (?, ?, ?, ?, ?, ?)
        `
    ).run(batchNumber, liquidationDate, totalCents, totalGainCents, notes, createdAt);
    const batchId = Number(batchInsert.lastInsertRowid);
    const batchItemInsert = database.client.prepare(
      `
        INSERT INTO consignment_batch_items (
          batch_id,
          sale_item_id,
          amount_cents,
          created_at
        ) VALUES (?, ?, ?, ?)
      `
    );
    normalizedIds.forEach((saleItemId) => {
      var _a2;
      batchItemInsert.run(batchId, saleItemId, (_a2 = historicalAmounts.get(saleItemId)) == null ? void 0 : _a2.amountCents, createdAt);
    });
    database.client.prepare(
      `
          UPDATE sale_items
          SET consignment_status = ?
          WHERE id IN (${createPlaceholders(normalizedIds.length)})
        `
    ).run(STATUS_SETTLED, ...normalizedIds);
    insertAuditLog$2(database, {
      occurredAt: createdAt,
      operationType: "consignment_batch_confirmed",
      entityType: "consignment_batch",
      entityId: String(batchId),
      summary: `Confirmed consignment batch #${batchNumber}.`,
      detailJson: JSON.stringify({
        batchId,
        batchNumber,
        liquidationDate,
        saleItemIds: normalizedIds,
        quantity: saleItems.length,
        totalCents,
        totalGainCents,
        note: notes,
        createdAt
      })
    });
    return {
      batchId,
      batchNumber,
      liquidationDate,
      itemCount: saleItems.length,
      totalCents,
      totalGainCents,
      notes,
      createdAt
    };
  });
  return transaction();
}
function listConsignmentBatchHistory(database, request = {}) {
  const payload = listConsignmentBatchHistoryRequestSchema.parse(request);
  const limit = payload.limit ?? 100;
  const rows = database.client.prepare(
    `
        SELECT
          cb.id AS batchId,
          cb.batch_number AS batchNumber,
          cb.liquidation_date AS liquidationDate,
          cb.total_cents AS totalCents,
          cb.total_gain_cents AS totalGainCents,
          cb.notes AS notes,
          cb.created_at AS createdAt,
          COUNT(cbi.id) AS itemCount
        FROM consignment_batches cb
        INNER JOIN consignment_batch_items cbi ON cbi.batch_id = cb.id
        GROUP BY cb.id, cb.batch_number, cb.liquidation_date, cb.total_cents, cb.total_gain_cents, cb.notes, cb.created_at
        ORDER BY cb.liquidation_date DESC, cb.batch_number DESC, cb.id DESC
        LIMIT ?
      `
  ).all(limit);
  return rows;
}
function getConsignmentBatchDetail(database, request) {
  const payload = getConsignmentBatchDetailRequestSchema.parse(request);
  const header = database.client.prepare(
    `
        SELECT
          cb.id AS batchId,
          cb.batch_number AS batchNumber,
          cb.liquidation_date AS liquidationDate,
          cb.total_cents AS totalCents,
          cb.total_gain_cents AS totalGainCents,
          cb.notes AS notes,
          cb.created_at AS createdAt,
          COUNT(cbi.id) AS itemCount
        FROM consignment_batches cb
        INNER JOIN consignment_batch_items cbi ON cbi.batch_id = cb.id
        WHERE cb.id = ?
        GROUP BY cb.id, cb.batch_number, cb.liquidation_date, cb.total_cents, cb.total_gain_cents, cb.notes, cb.created_at
        LIMIT 1
      `
  ).get(payload.batchId);
  if (!header) {
    throw new ConsignmentServiceError("BATCH_NOT_FOUND", `Consignment batch ${payload.batchId} was not found.`);
  }
  const items = database.client.prepare(
    `
        SELECT
          si.id AS saleItemId,
          si.product_name_snapshot AS productName,
          si.product_category_snapshot AS category,
          si.product_material_snapshot AS material,
          si.product_variant_snapshot AS variant,
          s.sale_number AS saleNumber,
          s.sale_date AS saleDate,
          s.customer_name_snapshot AS buyerName,
          si.unit_price_cents AS unitPriceCents,
          si.line_subtotal_cents AS saleTotalCents,
          cbi.amount_cents AS amountCents,
          0 AS personalizationCents,
          0 AS productGainCents,
          0 AS personalizationGainCents,
          0 AS gainCents,
          cb.liquidation_date AS liquidationDate
        FROM consignment_batch_items cbi
        INNER JOIN consignment_batches cb ON cb.id = cbi.batch_id
        INNER JOIN sale_items si ON si.id = cbi.sale_item_id
        INNER JOIN sales s ON s.id = si.sale_id
        WHERE cbi.batch_id = ?
        ORDER BY s.sale_date DESC, s.sale_number DESC, cbi.id ASC
      `
  ).all(payload.batchId);
  const saleItemIds = getBatchSaleItemIds(database, payload.batchId);
  const financialsMap = loadHistoricalSaleItemFinancialsMap(database, saleItemIds);
  return {
    ...header,
    items: items.map(({ saleItemId, ...item }) => {
      var _a2, _b2, _c2, _d2;
      return {
        ...item,
        personalizationCents: ((_a2 = financialsMap.get(saleItemId)) == null ? void 0 : _a2.personalizationCents) ?? null,
        productGainCents: ((_b2 = financialsMap.get(saleItemId)) == null ? void 0 : _b2.productGainCents) ?? 0,
        personalizationGainCents: ((_c2 = financialsMap.get(saleItemId)) == null ? void 0 : _c2.personalizationGainCents) ?? 0,
        gainCents: ((_d2 = financialsMap.get(saleItemId)) == null ? void 0 : _d2.totalGainCents) ?? 0
      };
    })
  };
}
function normalizeSaleItemIds(saleItemIds) {
  if (saleItemIds.length === 0) {
    throw new ConsignmentServiceError("EMPTY_SELECTION", "At least one sale item is required.");
  }
  const uniqueIds = /* @__PURE__ */ new Set();
  for (const saleItemId of saleItemIds) {
    if (uniqueIds.has(saleItemId)) {
      throw new ConsignmentServiceError("DUPLICATE_ITEM_IDS", "Duplicate sale item ids are not allowed.");
    }
    uniqueIds.add(saleItemId);
  }
  return Array.from(uniqueIds);
}
function loadSaleItemsForSettlement(database, saleItemIds) {
  var _a2;
  const rows = database.client.prepare(
    `
        SELECT
          si.id AS saleItemId,
          s.sale_number AS saleNumber,
          s.status AS saleStatus,
          si.consignment_status AS consignmentStatus
        FROM sale_items si
        INNER JOIN sales s ON s.id = si.sale_id
        WHERE si.id IN (${createPlaceholders(saleItemIds.length)})
      `
  ).all(...saleItemIds);
  if (rows.length !== saleItemIds.length) {
    throw new ConsignmentServiceError(
      "SALE_ITEMS_NOT_FOUND",
      "One or more selected sale items were not found."
    );
  }
  const associatedRows = database.client.prepare(
    `
        SELECT sale_item_id AS saleItemId
        FROM consignment_batch_items
        WHERE sale_item_id IN (${createPlaceholders(saleItemIds.length)})
      `
  ).all(...saleItemIds);
  if (associatedRows.length > 0) {
    throw new ConsignmentServiceError(
      "SALE_ITEM_ALREADY_ASSOCIATED",
      `Sale item ${(_a2 = associatedRows[0]) == null ? void 0 : _a2.saleItemId} is already associated with a consignment batch.`
    );
  }
  rows.forEach((row) => {
    if (row.saleStatus === STATUS_CANCELLED$1) {
      throw new ConsignmentServiceError(
        "CANCELLED_SALE_ITEM",
        `Sale item ${row.saleItemId} belongs to a cancelled sale.`
      );
    }
    if (row.consignmentStatus !== STATUS_PENDING_SETTLEMENT) {
      throw new ConsignmentServiceError(
        "SALE_ITEM_NOT_PENDING_SETTLEMENT",
        `Sale item ${row.saleItemId} is not pending settlement.`
      );
    }
  });
  return rows;
}
function loadHistoricalAmounts(database, saleItemIds) {
  const rows = database.client.prepare(
    `
        SELECT
          sale_item_id AS saleItemId,
          SUM(consumed_quantity * historical_supplier_unit_cost_cents) AS amountCents
        FROM sale_item_allocations
        WHERE sale_item_id IN (${createPlaceholders(saleItemIds.length)})
        GROUP BY sale_item_id
      `
  ).all(...saleItemIds);
  return new Map(rows.map((row) => [row.saleItemId, { amountCents: row.amountCents }]));
}
function getBatchSaleItemIds(database, batchId) {
  return database.client.prepare(
    `
        SELECT sale_item_id AS saleItemId
        FROM consignment_batch_items
        WHERE batch_id = ?
        ORDER BY id ASC
      `
  ).all(batchId).map((row) => row.saleItemId);
}
function nextBatchNumber(database) {
  const row = database.client.prepare("SELECT COALESCE(MAX(batch_number), 0) + 1 AS nextBatchNumber FROM consignment_batches").get();
  return row.nextBatchNumber;
}
function createPlaceholders(length) {
  return Array.from({ length }, () => "?").join(", ");
}
function normalizeOptionalNote(value) {
  const normalized = (value == null ? void 0 : value.trim()) ?? "";
  return normalized.length > 0 ? normalized : null;
}
function insertAuditLog$2(database, input) {
  database.client.prepare(
    `
        INSERT INTO audit_logs (
          occurred_at,
          operation_type,
          entity_type,
          entity_id,
          summary,
          detail_json
        ) VALUES (?, ?, ?, ?, ?, ?)
      `
  ).run(
    input.occurredAt,
    input.operationType,
    input.entityType,
    input.entityId,
    input.summary,
    input.detailJson
  );
}
function mapConsignmentError(error) {
  if (error instanceof zod.ZodError) {
    const issue = error.issues[0];
    if ((issue == null ? void 0 : issue.path[0]) === "saleItemIds") {
      return new Error("Seleccioná al menos un artículo para liquidar.");
    }
    if ((issue == null ? void 0 : issue.path[0]) === "liquidationDate") {
      return new Error("Ingresá una fecha válida para la liquidación.");
    }
    if ((issue == null ? void 0 : issue.path[0]) === "notes") {
      return new Error("La nota de la liquidación no es válida.");
    }
    if ((issue == null ? void 0 : issue.path[0]) === "batchId") {
      return new Error("No pudimos abrir ese lote de liquidación.");
    }
  }
  if (error instanceof ConsignmentServiceError) {
    switch (error.code) {
      case "EMPTY_SELECTION":
        return new Error("Seleccioná al menos un artículo para liquidar.");
      case "DUPLICATE_ITEM_IDS":
        return new Error("La selección tiene artículos repetidos. Volvé a intentarlo.");
      case "SALE_ITEMS_NOT_FOUND":
        return new Error("Uno o más artículos ya no existen o cambiaron antes de confirmar.");
      case "CANCELLED_SALE_ITEM":
        return new Error("No podés liquidar artículos de una venta cancelada.");
      case "SALE_ITEM_NOT_PENDING_SETTLEMENT":
        return new Error("La selección incluye artículos que ya no están pendientes de liquidación.");
      case "SALE_ITEM_ALREADY_ASSOCIATED":
        return new Error("La selección incluye artículos ya asociados a otra liquidación.");
      case "SALE_ITEM_WITHOUT_HISTORICAL_COST":
        return new Error("No pudimos calcular el importe histórico de uno de los artículos seleccionados.");
      case "BATCH_NOT_FOUND":
        return new Error("No encontramos la liquidación solicitada.");
      default:
        return new Error("No pudimos completar la operación de consignaciones.");
    }
  }
  return error instanceof Error ? error : new Error("No pudimos completar la operación de consignaciones.");
}
function createConsignmentsConfirmBatchChannel({
  database
}) {
  return {
    channel: CONSIGNMENTS_CONFIRM_BATCH_CHANNEL,
    requestSchema: confirmConsignmentBatchRequestSchema,
    handle: (payload) => {
      try {
        return confirmConsignmentBatch(database, payload);
      } catch (error) {
        throw mapConsignmentError(error);
      }
    }
  };
}
const CURRENCY_FORMAT = "[$$-es-AR] #,##0.00";
function buildConsignmentBatchExcelWorkbook(detail, generatedAt) {
  const workbook = new exceljs.Workbook();
  workbook.creator = "project-mama";
  workbook.created = new Date(generatedAt);
  workbook.title = `Liquidation ${detail.batchNumber}`;
  workbook.subject = "Liquidation Excel receipt";
  appendSummarySheet(workbook, detail);
  appendDetailSheet(workbook, detail);
  return workbook;
}
async function serializeWorkbook(workbook) {
  const contents = await workbook.xlsx.writeBuffer();
  return Buffer.from(contents);
}
function appendSummarySheet(workbook, detail) {
  const totalSoldCents = detail.items.reduce((sum, item) => sum + item.saleTotalCents, 0);
  const rows = [
    ["Liquidation number", detail.batchNumber],
    ["Liquidation date", formatDate(detail.liquidationDate)],
    ["Item count", detail.itemCount],
    ["Total sold", toCurrency(totalSoldCents)],
    ["Total paid to supplier", toCurrency(detail.totalCents)],
    ["Total profit", toCurrency(detail.totalGainCents)]
  ];
  const sheet = workbook.addWorksheet("Summary", {
    views: [{ state: "frozen", ySplit: 1, topLeftCell: "A2" }]
  });
  rows.forEach((row) => {
    sheet.addRow(row);
  });
  applyHeaderStyle(sheet, 1, 1);
  applyCurrencyFormat(sheet, [4, 5, 6], [2]);
  applyColumnWidths(sheet, rows);
}
function appendDetailSheet(workbook, detail) {
  const headers = [
    "Sale date",
    "Sale number",
    "Product",
    "Category",
    "Material / variant",
    "Customer",
    "Product price",
    "Personalization",
    "Sale total",
    "Amount paid to supplier",
    "Product gain",
    "Personalization gain",
    "Total gain",
    "Liquidation date"
  ];
  const body = detail.items.map((item) => {
    var _a2;
    return [
      formatDate(item.saleDate),
      item.saleNumber,
      item.productName,
      formatCategory(item.category),
      buildMaterialVariantLabel(item.material, item.variant),
      ((_a2 = item.buyerName) == null ? void 0 : _a2.trim()) ? item.buyerName : "",
      toCurrency(item.unitPriceCents),
      item.personalizationCents == null ? "" : toCurrency(item.personalizationCents),
      toCurrency(item.saleTotalCents),
      toCurrency(item.amountCents),
      toCurrency(item.productGainCents),
      item.personalizationGainCents === 0 ? "" : toCurrency(item.personalizationGainCents),
      toCurrency(item.gainCents),
      formatDate(item.liquidationDate)
    ];
  });
  const totalsRow = [
    "Totals",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    toCurrency(detail.items.reduce((sum, item) => sum + item.saleTotalCents, 0)),
    toCurrency(detail.totalCents),
    "",
    "",
    toCurrency(detail.totalGainCents),
    ""
  ];
  const rows = [headers, ...body.length > 0 ? body : [Array.from({ length: headers.length }, () => "")], totalsRow];
  const sheet = workbook.addWorksheet("Detail", {
    views: [{ state: "frozen", ySplit: 1, topLeftCell: "A2" }]
  });
  rows.forEach((row) => {
    sheet.addRow(row);
  });
  applyHeaderStyle(sheet, 1, headers.length);
  applyHeaderStyle(sheet, rows.length, 1);
  applyCurrencyFormat(
    sheet,
    Array.from({ length: rows.length - 1 }, (_, index2) => index2 + 2),
    [7, 8, 9, 10, 11, 12, 13]
  );
  applyColumnWidths(sheet, rows);
}
function autoFitColumns(rows) {
  const widths = [];
  rows.forEach((row) => {
    row.forEach((value, index2) => {
      const width = String(value ?? "").length + 2;
      widths[index2] = Math.max(widths[index2] ?? 10, Math.min(width, 40));
    });
  });
  return widths;
}
function applyCurrencyFormat(sheet, rows, columns) {
  rows.forEach((rowNumber) => {
    columns.forEach((columnNumber) => {
      const cell = sheet.getRow(rowNumber).getCell(columnNumber);
      if (typeof cell.value === "number") {
        cell.numFmt = CURRENCY_FORMAT;
      }
    });
  });
}
function applyHeaderStyle(sheet, rowNumber, columnCount) {
  Array.from({ length: columnCount }, (_, index2) => index2 + 1).forEach((columnNumber) => {
    sheet.getRow(rowNumber).getCell(columnNumber).font = { bold: true };
  });
}
function applyColumnWidths(sheet, rows) {
  autoFitColumns(rows).forEach((width, index2) => {
    sheet.getColumn(index2 + 1).width = width;
  });
}
function buildMaterialVariantLabel(material, variant) {
  return [material, variant].filter((value) => value.trim().length > 0).join(" · ");
}
function formatCategory(value) {
  switch (value) {
    case "jewelry":
      return "Jewelry";
    case "mate":
      return "Mate products";
    case "clothing":
      return "Clothing";
    default:
      return value;
  }
}
function formatDate(value) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-");
    return `${day}/${month}/${year}`;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}
function toCurrency(cents) {
  return cents / 100;
}
async function exportConsignmentBatchExcel(database, shellAdapters, request) {
  const payload = exportConsignmentBatchExcelRequestSchema.parse(request);
  const detail = getConsignmentBatchDetail(database, payload);
  const generatedAt = (/* @__PURE__ */ new Date()).toISOString();
  const dialogResult = await shellAdapters.showSaveDialog({
    title: "Guardar comprobante Excel de liquidación",
    defaultPath: buildConsignmentBatchFileName(detail.batchNumber, detail.liquidationDate),
    filters: [
      {
        name: "Excel Workbook",
        extensions: ["xlsx"]
      }
    ]
  });
  if (dialogResult.canceled || !dialogResult.filePath) {
    return {
      status: "cancelled",
      batchId: detail.batchId,
      batchNumber: detail.batchNumber,
      generatedAt
    };
  }
  const workbook = buildConsignmentBatchExcelWorkbook(detail, generatedAt);
  const contents = await serializeWorkbook(workbook);
  await (shellAdapters.writeFile ?? writeWorkbookFile)(dialogResult.filePath, contents);
  insertAuditLog$1(database, {
    occurredAt: generatedAt,
    operationType: "consignment_batch_excel_exported",
    entityType: "consignment_batch",
    entityId: String(detail.batchId),
    summary: `Generated liquidation Excel receipt ${node_path.basename(dialogResult.filePath)} for batch #${detail.batchNumber}.`,
    detailJson: JSON.stringify({
      batchId: detail.batchId,
      batchNumber: detail.batchNumber,
      liquidationDate: detail.liquidationDate,
      filePath: dialogResult.filePath,
      generatedAt,
      workbookSheetNames: workbook.worksheets.map((worksheet) => worksheet.name)
    })
  });
  return {
    status: "saved",
    batchId: detail.batchId,
    batchNumber: detail.batchNumber,
    generatedAt,
    filePath: dialogResult.filePath
  };
}
function buildConsignmentBatchFileName(batchNumber, liquidationDate) {
  return `liquidacion-${batchNumber}-${liquidationDate}.xlsx`;
}
function writeWorkbookFile(filePath, contents) {
  node_fs.writeFileSync(filePath, contents);
}
function insertAuditLog$1(database, input) {
  database.client.prepare(
    `
        INSERT INTO audit_logs (
          occurred_at,
          operation_type,
          entity_type,
          entity_id,
          summary,
          detail_json
        ) VALUES (?, ?, ?, ?, ?, ?)
      `
  ).run(
    input.occurredAt,
    input.operationType,
    input.entityType,
    input.entityId,
    input.summary,
    input.detailJson
  );
}
function createConsignmentsExportBatchExcelChannel({
  database,
  showSaveDialog = (options) => electron.dialog.showSaveDialog(options),
  writeFile
}) {
  return {
    channel: CONSIGNMENTS_EXPORT_EXCEL_CHANNEL,
    requestSchema: exportConsignmentBatchExcelRequestSchema,
    handle: async (payload) => {
      try {
        return await exportConsignmentBatchExcel(database, {
          showSaveDialog,
          writeFile
        }, payload);
      } catch (error) {
        throw mapConsignmentError(error);
      }
    }
  };
}
function createConsignmentsGetDetailChannel({
  database
}) {
  return {
    channel: CONSIGNMENTS_DETAIL_CHANNEL,
    requestSchema: getConsignmentBatchDetailRequestSchema,
    handle: (payload) => {
      try {
        return getConsignmentBatchDetail(database, payload);
      } catch (error) {
        throw mapConsignmentError(error);
      }
    }
  };
}
function createConsignmentsListHistoryChannel({
  database
}) {
  return {
    channel: CONSIGNMENTS_HISTORY_LIST_CHANNEL,
    requestSchema: listConsignmentBatchHistoryRequestSchema,
    handle: (payload) => listConsignmentBatchHistory(database, payload)
  };
}
function createConsignmentsListPendingItemsChannel({
  database
}) {
  return {
    channel: CONSIGNMENTS_PENDING_LIST_CHANNEL,
    requestSchema: listPendingConsignmentItemsRequestSchema,
    handle: (payload) => listPendingConsignmentItems(database, payload)
  };
}
function registerValidatedIpc({
  ipcMainLike,
  definition
}) {
  ipcMainLike.handle(definition.channel, (_event, payload) => {
    const validatedPayload = definition.requestSchema.parse(payload);
    return definition.handle(validatedPayload);
  });
}
const SALE_PRICE_TYPES = ["cash", "list"];
const SALE_STATUSES = ["pending_payment", "partial_payment", "paid", "cancelled"];
const SALE_CONSIGNMENT_STATUSES = ["pending_settlement", "settled"];
const PAYMENT_METHODS = ["cash", "bank_transfer"];
const trimmedString = zod.z.string().trim();
const persistedIsoDateTimeString = zod.z.string().trim().min(1).transform((value, context) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    context.addIssue({
      code: zod.z.ZodIssueCode.custom,
      message: "Expected a valid date/time string."
    });
    return zod.z.NEVER;
  }
  return date.toISOString();
});
const paymentMethodSchema = zod.z.enum(PAYMENT_METHODS);
const salePriceTypeSchema = zod.z.enum(SALE_PRICE_TYPES);
zod.z.enum(SALE_STATUSES);
zod.z.enum(SALE_CONSIGNMENT_STATUSES);
const saleCustomerInputSchema = zod.z.object({
  customerId: zod.z.number().int().positive().optional(),
  name: trimmedString.optional(),
  phoneText: trimmedString.optional(),
  note: trimmedString.nullable().optional()
}).strict();
const confirmSaleDraftItemInputSchema = zod.z.object({
  reusableProductId: zod.z.number().int().positive(),
  quantity: zod.z.number().int().positive(),
  priceType: salePriceTypeSchema,
  personalizationAmountCents: zod.z.number().int().positive().nullable().optional(),
  personalizationPercentageBasisPoints: zod.z.number().int().nonnegative().nullable().optional()
}).strict().superRefine((value, context) => {
  const hasAmount = value.personalizationAmountCents != null;
  const hasPercentage = value.personalizationPercentageBasisPoints != null;
  if (!hasAmount && hasPercentage) {
    context.addIssue({
      code: zod.z.ZodIssueCode.custom,
      message: "Personalization percentage requires a personalization amount.",
      path: ["personalizationPercentageBasisPoints"]
    });
  }
});
const salePaymentInputSchema = zod.z.object({
  amountCents: zod.z.number().int().positive(),
  paymentMethod: paymentMethodSchema.nullable().optional(),
  note: trimmedString.nullable().optional()
}).strict();
const confirmSaleDraftRequestSchema = zod.z.object({
  customer: saleCustomerInputSchema.nullable().optional(),
  draftItems: zod.z.array(confirmSaleDraftItemInputSchema).min(1),
  initialPayment: salePaymentInputSchema.nullable().optional(),
  saleDate: persistedIsoDateTimeString.optional()
}).strict();
const listSalesHistoryRequestSchema = zod.z.object({
  query: trimmedString.optional(),
  limit: zod.z.number().int().positive().max(100).optional()
}).strict();
const getSaleDetailRequestSchema = zod.z.object({
  saleId: zod.z.number().int().positive()
}).strict();
const registerSalePaymentRequestSchema = salePaymentInputSchema.extend({
  saleId: zod.z.number().int().positive(),
  paymentDate: persistedIsoDateTimeString.optional()
}).strict();
const cancelSalePaymentRequestSchema = zod.z.object({
  saleId: zod.z.number().int().positive(),
  paymentId: zod.z.number().int().positive(),
  reason: trimmedString.min(1),
  cancelledAt: persistedIsoDateTimeString.optional()
}).strict();
const assignSaleCustomerForPaymentRecoveryRequestSchema = zod.z.object({
  saleId: zod.z.number().int().positive(),
  name: trimmedString.min(1),
  phoneText: trimmedString.min(1)
}).strict();
const cancelSaleRequestSchema = zod.z.object({
  saleId: zod.z.number().int().positive(),
  reason: trimmedString.min(1),
  cancelledAt: persistedIsoDateTimeString.optional()
}).strict();
const STATUS_PENDING = "pending_payment";
const STATUS_PARTIAL = "partial_payment";
const STATUS_PAID = "paid";
const STATUS_CANCELLED = "cancelled";
function listSalesHistory(database, request = {}) {
  var _a2;
  const payload = listSalesHistoryRequestSchema.parse(request);
  const query = ((_a2 = payload.query) == null ? void 0 : _a2.trim()) ?? "";
  const limit = payload.limit ?? 20;
  const likeQuery = `%${escapeLikePattern(query)}%`;
  const rows = database.client.prepare(
    `
        SELECT
          s.id AS saleId,
          s.sale_number AS saleNumber,
          s.sale_date AS saleDate,
          s.status AS status,
          s.total_cents AS totalCents,
          s.paid_cents AS paidCents,
          s.balance_cents AS balanceCents,
          s.customer_name_snapshot AS customerName,
          s.customer_phone_snapshot AS customerPhoneText
        FROM sales s
        WHERE (
          ? = ''
          OR CAST(s.sale_number AS TEXT) LIKE ? ESCAPE '\\'
          OR COALESCE(s.customer_name_snapshot, '') LIKE ? ESCAPE '\\'
          OR COALESCE(s.customer_phone_snapshot, '') LIKE ? ESCAPE '\\'
        )
        ORDER BY s.sale_date DESC, s.sale_number DESC, s.id DESC
        LIMIT ?
      `
  ).all(query, likeQuery, likeQuery, likeQuery, limit);
  const historyItemRows = rows.length ? database.client.prepare(
    `
            SELECT id AS saleItemId, sale_id AS saleId
            FROM sale_items
            WHERE sale_id IN (${rows.map(() => "?").join(", ")})
          `
  ).all(...rows.map((row) => row.saleId)) : [];
  const profitMap = loadHistoricalSaleItemProfitMap(
    database,
    historyItemRows.map((row) => row.saleItemId)
  );
  const itemIdsBySaleId = /* @__PURE__ */ new Map();
  historyItemRows.forEach((row) => {
    itemIdsBySaleId.set(row.saleId, [...itemIdsBySaleId.get(row.saleId) ?? [], row.saleItemId]);
  });
  return rows.map((row) => ({
    ...row,
    totalProfitCents: sumHistoricalSaleItemProfits(profitMap, itemIdsBySaleId.get(row.saleId) ?? [])
  }));
}
function getSaleDetail(database, request) {
  const payload = getSaleDetailRequestSchema.parse(request);
  return getSaleSnapshot(database, payload.saleId);
}
function confirmSaleDraft(database, request) {
  var _a2;
  const payload = confirmSaleDraftRequestSchema.parse(request);
  const saleDate = payload.saleDate ?? (/* @__PURE__ */ new Date()).toISOString();
  const initialPaymentAmount = ((_a2 = payload.initialPayment) == null ? void 0 : _a2.amountCents) ?? 0;
  const transaction = database.client.transaction(() => {
    const pricingStatement = database.client.prepare(
      `
        SELECT
          rp.id AS reusableProductId,
          rp.category AS category,
          rp.name AS name,
          rp.material AS material,
          rp.variant AS variant,
          (
            SELECT si.cash_price_cents
            FROM stock_intakes si
            WHERE si.reusable_product_id = rp.id
            ORDER BY si.intake_date DESC, si.id DESC
            LIMIT 1
          ) AS currentCashPriceCents,
          (
            SELECT si.list_price_cents
            FROM stock_intakes si
            WHERE si.reusable_product_id = rp.id
            ORDER BY si.intake_date DESC, si.id DESC
            LIMIT 1
          ) AS currentListPriceCents
          ,(
            SELECT si.expected_profit_cents
            FROM stock_intakes si
            WHERE si.reusable_product_id = rp.id
            ORDER BY si.intake_date DESC, si.id DESC
            LIMIT 1
          ) AS currentExpectedProfitCents
        FROM reusable_products rp
        WHERE rp.id = ? AND rp.deleted_at IS NULL
        LIMIT 1
      `
    );
    const draftItems = payload.draftItems.map((item) => {
      const pricing = pricingStatement.get(item.reusableProductId);
      if (!pricing) {
        throw new Error(`Reusable product ${item.reusableProductId} was not found.`);
      }
      const unitPriceCents = item.priceType === "cash" ? pricing.currentCashPriceCents : pricing.currentListPriceCents;
      if (unitPriceCents == null) {
        throw new Error(`Reusable product ${item.reusableProductId} does not have a current ${item.priceType} price.`);
      }
      return {
        ...item,
        category: pricing.category,
        name: pricing.name,
        material: pricing.material,
        variant: pricing.variant,
        unitBasePriceCents: unitPriceCents,
        unitPersonalizationAmountCents: resolveSaleItemPersonalizationAmountCents(item, pricing.category),
        personalizationPercentageBasisPoints: resolveSaleItemPersonalizationPercentage(item),
        unitPersonalizationExpectedProfitCents: item.personalizationAmountCents == null ? null : calculateExpectedProfitCents(
          resolveSaleItemPersonalizationAmountCents(item, pricing.category) ?? 0,
          resolveSaleItemPersonalizationPercentage(item) ?? DEFAULT_PERSONALIZATION_BASIS_POINTS
        )
      };
    });
    const finalizedDraftItems = draftItems.map((item) => {
      const lineBaseSubtotalCents = item.unitBasePriceCents * item.quantity;
      const linePersonalizationSubtotalCents = (item.unitPersonalizationAmountCents ?? 0) * item.quantity;
      return {
        ...item,
        unitPriceCents: item.unitBasePriceCents + (item.unitPersonalizationAmountCents ?? 0),
        lineBaseSubtotalCents,
        linePersonalizationSubtotalCents,
        lineSubtotalCents: lineBaseSubtotalCents + linePersonalizationSubtotalCents
      };
    });
    const totalCents = finalizedDraftItems.reduce((sum, item) => sum + item.lineSubtotalCents, 0);
    if (initialPaymentAmount > totalCents) {
      throw new Error("Initial payment cannot be greater than the sale total.");
    }
    const balanceCents = totalCents - initialPaymentAmount;
    const customer = resolveCustomerSnapshot(database, payload.customer ?? null, balanceCents);
    const saleNumber = nextSaleNumber(database);
    const status = computeSaleStatus(totalCents, initialPaymentAmount, false);
    const saleInsert = database.client.prepare(
      `
          INSERT INTO sales (
            sale_number,
            customer_id,
            customer_name_snapshot,
            customer_phone_snapshot,
            customer_note_snapshot,
            sale_date,
            total_cents,
            paid_cents,
            balance_cents,
            status,
            cancellation_reason,
            created_at,
            updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)
        `
    ).run(
      saleNumber,
      customer.customerId,
      customer.name,
      customer.phoneText,
      customer.note,
      saleDate,
      totalCents,
      initialPaymentAmount,
      balanceCents,
      status,
      saleDate,
      saleDate
    );
    const saleId = Number(saleInsert.lastInsertRowid);
    const itemInsertStatement = database.client.prepare(
      `
        INSERT INTO sale_items (
          sale_id,
          reusable_product_id,
          product_category_snapshot,
          product_name_snapshot,
          product_material_snapshot,
          product_variant_snapshot,
          quantity,
          price_type,
          unit_price_cents,
          line_subtotal_cents,
          consignment_status,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending_settlement', ?)
      `
    );
    const allocationInsertStatement = database.client.prepare(
      `
        INSERT INTO sale_item_allocations (
          sale_item_id,
          stock_intake_id,
          consumed_quantity,
          historical_supplier_unit_cost_cents,
          historical_profit_percentage_basis_points,
          historical_cash_price_cents,
          historical_list_price_cents,
          historical_personalization_amount_cents,
          historical_personalization_percentage_basis_points,
          historical_personalization_expected_profit_cents,
          allocation_order,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
    );
    const stockUpdateStatement = database.client.prepare(
      "UPDATE stock_intakes SET available_quantity = available_quantity - ? WHERE id = ?"
    );
    for (const item of finalizedDraftItems) {
      const saleItemInsert = itemInsertStatement.run(
        saleId,
        item.reusableProductId,
        item.category,
        item.name,
        item.material,
        item.variant,
        item.quantity,
        item.priceType,
        item.unitPriceCents,
        item.lineSubtotalCents,
        saleDate
      );
      const saleItemId = Number(saleItemInsert.lastInsertRowid);
      const allocations = allocateStock(database, item.reusableProductId, item.quantity);
      const financials = calculateHistoricalSaleItemFinancials(item, allocations);
      database.client.prepare(
        `
            UPDATE sale_items
            SET unit_base_price_cents = ?,
                unit_personalization_amount_cents = ?,
                personalization_percentage_basis_points = ?,
                line_base_subtotal_cents = ?,
                line_personalization_subtotal_cents = ?,
                product_gain_cents = ?,
                personalization_gain_cents = ?,
                total_gain_cents = ?
            WHERE id = ?
          `
      ).run(
        item.unitBasePriceCents,
        item.unitPersonalizationAmountCents,
        item.personalizationPercentageBasisPoints,
        item.lineBaseSubtotalCents,
        item.linePersonalizationSubtotalCents,
        financials.productGainCents,
        financials.personalizationGainCents,
        financials.totalGainCents,
        saleItemId
      );
      allocations.forEach((allocation, index2) => {
        stockUpdateStatement.run(allocation.consumedQuantity, allocation.stockIntakeId);
        allocationInsertStatement.run(
          saleItemId,
          allocation.stockIntakeId,
          allocation.consumedQuantity,
          allocation.historicalSupplierUnitCostCents,
          allocation.historicalProfitPercentageBasisPoints,
          allocation.historicalCashPriceCents,
          allocation.historicalListPriceCents,
          item.unitPersonalizationAmountCents,
          item.personalizationPercentageBasisPoints,
          item.unitPersonalizationExpectedProfitCents,
          index2 + 1,
          saleDate
        );
      });
    }
    if (payload.initialPayment) {
      createPayment(database, {
        saleId,
        paymentDate: saleDate,
        amountCents: payload.initialPayment.amountCents,
        paymentMethod: payload.initialPayment.paymentMethod ?? null,
        note: payload.initialPayment.note ?? null
      });
    }
    insertAuditLog(database, {
      occurredAt: saleDate,
      operationType: "sale_confirmed",
      entityType: "sale",
      entityId: String(saleId),
      summary: `Confirmed sale #${saleNumber}.`,
      detailJson: JSON.stringify({ saleId, totalCents, paidCents: initialPaymentAmount, balanceCents })
    });
    syncSaleTotals(database, saleId, saleDate);
    return getSaleSnapshot(database, saleId);
  });
  return transaction();
}
function registerSalePayment(database, request) {
  const payload = registerSalePaymentRequestSchema.parse(request);
  const paymentDate = payload.paymentDate ?? (/* @__PURE__ */ new Date()).toISOString();
  const transaction = database.client.transaction(() => {
    const sale = getSaleRecord(database, payload.saleId);
    if (sale.status === STATUS_CANCELLED) {
      throw new Error("Cancelled sales do not accept new payments.");
    }
    if (payload.amountCents > sale.balanceCents) {
      throw new Error("Payment amount cannot be greater than the remaining balance.");
    }
    createPayment(database, {
      saleId: payload.saleId,
      paymentDate,
      amountCents: payload.amountCents,
      paymentMethod: payload.paymentMethod ?? null,
      note: payload.note ?? null
    });
    insertAuditLog(database, {
      occurredAt: paymentDate,
      operationType: "sale_payment_registered",
      entityType: "sale",
      entityId: String(payload.saleId),
      summary: `Registered payment for sale #${sale.saleNumber}.`,
      detailJson: JSON.stringify({ saleId: payload.saleId, amountCents: payload.amountCents })
    });
    syncSaleTotals(database, payload.saleId, paymentDate);
    return getSaleSnapshot(database, payload.saleId);
  });
  return transaction();
}
function cancelSalePayment(database, request) {
  const payload = cancelSalePaymentRequestSchema.parse(request);
  const cancelledAt = payload.cancelledAt ?? (/* @__PURE__ */ new Date()).toISOString();
  const transaction = database.client.transaction(() => {
    const sale = getSaleRecord(database, payload.saleId);
    if (sale.status === STATUS_CANCELLED) {
      throw new Error("Cancelled sales do not allow payment cancellation changes.");
    }
    const payment = database.client.prepare(
      `
          SELECT id, amount_cents AS amountCents, cancelled_at AS cancelledAt
          FROM payments
          WHERE id = ? AND sale_id = ?
          LIMIT 1
        `
    ).get(payload.paymentId, payload.saleId);
    if (!payment) {
      throw new Error(`Payment ${payload.paymentId} was not found for sale ${payload.saleId}.`);
    }
    if (payment.cancelledAt) {
      throw new Error("The selected payment is already cancelled.");
    }
    const nextBalance = sale.balanceCents + payment.amountCents;
    if (nextBalance > 0 && sale.customerId == null) {
      throw new Error("A walk-in sale cannot become pending after cancelling a payment.");
    }
    database.client.prepare(
      "UPDATE payments SET cancelled_at = ?, cancellation_reason = ? WHERE id = ? AND sale_id = ?"
    ).run(cancelledAt, payload.reason, payload.paymentId, payload.saleId);
    insertAuditLog(database, {
      occurredAt: cancelledAt,
      operationType: "sale_payment_cancelled",
      entityType: "payment",
      entityId: String(payload.paymentId),
      summary: `Cancelled payment ${payload.paymentId} for sale #${sale.saleNumber}.`,
      detailJson: JSON.stringify({ saleId: payload.saleId, paymentId: payload.paymentId, reason: payload.reason })
    });
    syncSaleTotals(database, payload.saleId, cancelledAt);
    return getSaleSnapshot(database, payload.saleId);
  });
  return transaction();
}
function cancelSale(database, request) {
  const payload = cancelSaleRequestSchema.parse(request);
  const cancelledAt = payload.cancelledAt ?? (/* @__PURE__ */ new Date()).toISOString();
  const transaction = database.client.transaction(() => {
    const sale = getSaleRecord(database, payload.saleId);
    if (sale.status === STATUS_CANCELLED) {
      throw new Error("The selected sale is already cancelled.");
    }
    const settledItem = database.client.prepare(
      `
          SELECT id
          FROM sale_items
          WHERE sale_id = ? AND consignment_status = 'settled'
          LIMIT 1
        `
    ).get(payload.saleId);
    if (settledItem) {
      throw new Error("The sale cannot be cancelled because it has settled items.");
    }
    const allocations = database.client.prepare(
      `
          SELECT stock_intake_id AS stockIntakeId, consumed_quantity AS consumedQuantity
          FROM sale_item_allocations
          WHERE sale_item_id IN (
            SELECT id FROM sale_items WHERE sale_id = ?
          )
          ORDER BY allocation_order ASC, id ASC
        `
    ).all(payload.saleId);
    const stockRestoreStatement = database.client.prepare(
      "UPDATE stock_intakes SET available_quantity = available_quantity + ? WHERE id = ?"
    );
    allocations.forEach((allocation) => {
      stockRestoreStatement.run(allocation.consumedQuantity, allocation.stockIntakeId);
    });
    database.client.prepare(
      `
          UPDATE sales
          SET status = ?,
              cancellation_reason = ?,
              updated_at = ?
          WHERE id = ?
        `
    ).run(STATUS_CANCELLED, payload.reason, cancelledAt, payload.saleId);
    insertAuditLog(database, {
      occurredAt: cancelledAt,
      operationType: "sale_cancelled",
      entityType: "sale",
      entityId: String(payload.saleId),
      summary: `Cancelled sale #${sale.saleNumber}.`,
      detailJson: JSON.stringify({ saleId: payload.saleId, reason: payload.reason })
    });
    return getSaleSnapshot(database, payload.saleId);
  });
  return transaction();
}
function assignSaleCustomerForPaymentRecovery(database, request) {
  const payload = assignSaleCustomerForPaymentRecoveryRequestSchema.parse(request);
  const assignedAt = (/* @__PURE__ */ new Date()).toISOString();
  const transaction = database.client.transaction(() => {
    const sale = getSaleRecord(database, payload.saleId);
    if (sale.status === STATUS_CANCELLED) {
      throw new Error("Cancelled sales do not allow recovery customer assignment.");
    }
    if (sale.customerId != null) {
      throw new Error("The selected sale already has a customer assigned.");
    }
    if (sale.balanceCents !== 0 || sale.status !== STATUS_PAID) {
      throw new Error("Recovery customer assignment is limited to fully paid walk-in sales.");
    }
    const customerId = createCustomer(database, {
      name: payload.name,
      phoneText: payload.phoneText,
      note: null,
      timestamp: assignedAt
    });
    const customer = getCustomerSnapshotById(database, customerId);
    database.client.prepare(
      `
          UPDATE sales
          SET customer_id = ?,
              customer_name_snapshot = ?,
              customer_phone_snapshot = ?,
              customer_note_snapshot = ?,
              updated_at = ?
          WHERE id = ?
        `
    ).run(customerId, customer.name, customer.phoneText, customer.note, assignedAt, payload.saleId);
    insertAuditLog(database, {
      occurredAt: assignedAt,
      operationType: "sale_customer_assigned_for_payment_recovery",
      entityType: "sale",
      entityId: String(payload.saleId),
      summary: `Assigned a customer to fully paid walk-in sale #${sale.saleNumber} for payment recovery.`,
      detailJson: JSON.stringify({ saleId: payload.saleId, customerId })
    });
    return getSaleSnapshot(database, payload.saleId);
  });
  return transaction();
}
function resolveCustomerSnapshot(database, customer, balanceCents) {
  var _a2, _b2, _c2;
  if (!customer) {
    if (balanceCents > 0) {
      throw new Error("A customer with name and phone is required when the sale has a pending balance.");
    }
    return {
      customerId: null,
      name: null,
      phoneText: null,
      note: null
    };
  }
  if (customer.customerId != null) {
    const existingCustomer = getCustomerSnapshotById(database, customer.customerId);
    if (balanceCents > 0 && (!(existingCustomer.name ?? "").trim() || !(existingCustomer.phoneText ?? "").trim())) {
      throw new Error("The selected customer must include both name and phone for a pending sale.");
    }
    return existingCustomer;
  }
  const name = ((_a2 = customer.name) == null ? void 0 : _a2.trim()) ?? "";
  const phoneText = ((_b2 = customer.phoneText) == null ? void 0 : _b2.trim()) ?? "";
  const note = ((_c2 = customer.note) == null ? void 0 : _c2.trim()) || null;
  const wantsCustomerRecord = name.length > 0 || phoneText.length > 0 || note != null;
  if (!wantsCustomerRecord) {
    if (balanceCents > 0) {
      throw new Error("A customer with name and phone is required when the sale has a pending balance.");
    }
    return {
      customerId: null,
      name: null,
      phoneText: null,
      note: null
    };
  }
  if (!name || !phoneText) {
    throw new Error("Customer name and phone are both required when customer details are provided.");
  }
  const customerId = createCustomer(database, {
    name,
    phoneText,
    note,
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  });
  return getCustomerSnapshotById(database, customerId);
}
function getCustomerSnapshotById(database, customerId) {
  const existingCustomer = database.client.prepare(
    `
        SELECT id AS customerId, name, phone_text AS phoneText, note
        FROM customers
        WHERE id = ?
        LIMIT 1
      `
  ).get(customerId);
  if (!existingCustomer) {
    throw new Error(`Customer ${customerId} was not found.`);
  }
  return existingCustomer;
}
function createCustomer(database, input) {
  const result = database.client.prepare(
    `
        INSERT INTO customers (name, phone_text, note, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?)
      `
  ).run(input.name.trim(), input.phoneText.trim(), input.note, input.timestamp, input.timestamp);
  return Number(result.lastInsertRowid);
}
function nextSaleNumber(database) {
  const row = database.client.prepare("SELECT COALESCE(MAX(sale_number), 0) + 1 AS nextSaleNumber FROM sales").get();
  return row.nextSaleNumber;
}
function allocateStock(database, reusableProductId, quantity) {
  const rows = database.client.prepare(
    `
        SELECT
          id AS stockIntakeId,
          reusable_product_id AS reusableProductId,
          available_quantity AS availableQuantity,
          supplier_unit_cost_cents AS supplierUnitCostCents,
          cash_price_cents AS cashPriceCents,
          list_price_cents AS listPriceCents,
          profit_percentage_basis_points AS profitPercentageBasisPoints,
          personalization_amount_cents AS personalizationAmountCents,
          personalization_percentage_basis_points AS personalizationPercentageBasisPoints,
          personalization_expected_profit_cents AS personalizationExpectedProfitCents
        FROM stock_intakes
        WHERE reusable_product_id = ? AND available_quantity > 0
        ORDER BY intake_date ASC, created_at ASC, id ASC
      `
  ).all(reusableProductId);
  let remaining = quantity;
  const allocations = [];
  for (const row of rows) {
    if (remaining === 0) {
      break;
    }
    const consumedQuantity = Math.min(remaining, row.availableQuantity);
    allocations.push({
      stockIntakeId: row.stockIntakeId,
      consumedQuantity,
      historicalSupplierUnitCostCents: row.supplierUnitCostCents,
      historicalProfitPercentageBasisPoints: row.profitPercentageBasisPoints,
      historicalCashPriceCents: row.cashPriceCents,
      historicalListPriceCents: row.listPriceCents,
      historicalPersonalizationAmountCents: row.personalizationAmountCents,
      historicalPersonalizationPercentageBasisPoints: row.personalizationPercentageBasisPoints,
      historicalPersonalizationExpectedProfitCents: row.personalizationExpectedProfitCents
    });
    remaining -= consumedQuantity;
  }
  if (remaining > 0) {
    throw new Error(`Insufficient stock for reusable product ${reusableProductId}.`);
  }
  return allocations;
}
function resolveSaleItemPersonalizationAmountCents(item, category) {
  if (item.personalizationAmountCents == null) {
    return null;
  }
  if (!isPersonalizationAllowed(category)) {
    throw new Error(`Personalization is not allowed for ${category} products.`);
  }
  return item.personalizationAmountCents;
}
function resolveSaleItemPersonalizationPercentage(item) {
  if (item.personalizationAmountCents == null) {
    return null;
  }
  return item.personalizationPercentageBasisPoints ?? DEFAULT_PERSONALIZATION_BASIS_POINTS;
}
function calculateHistoricalSaleItemFinancials(item, allocations) {
  const productGainCents = allocations.reduce(
    (sum, allocation) => sum + allocation.consumedQuantity * calculateExpectedProfitCents(
      allocation.historicalSupplierUnitCostCents,
      allocation.historicalProfitPercentageBasisPoints
    ),
    0
  );
  const personalizationGainCents = (item.unitPersonalizationExpectedProfitCents ?? 0) * item.quantity;
  return {
    productGainCents,
    personalizationGainCents,
    totalGainCents: productGainCents + personalizationGainCents
  };
}
function createPayment(database, input) {
  const result = database.client.prepare(
    `
        INSERT INTO payments (
          sale_id,
          payment_date,
          amount_cents,
          payment_method,
          note,
          cancelled_at,
          cancellation_reason,
          created_at
        ) VALUES (?, ?, ?, ?, ?, NULL, NULL, ?)
      `
  ).run(input.saleId, input.paymentDate, input.amountCents, input.paymentMethod, input.note, input.paymentDate);
  return Number(result.lastInsertRowid);
}
function escapeLikePattern(value) {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}
function syncSaleTotals(database, saleId, updatedAt) {
  const sale = getSaleRecord(database, saleId);
  const paymentRow = database.client.prepare(
    `
        SELECT COALESCE(SUM(amount_cents), 0) AS paidCents
        FROM payments
        WHERE sale_id = ? AND cancelled_at IS NULL
      `
  ).get(saleId);
  const paidCents = paymentRow.paidCents;
  const balanceCents = sale.totalCents - paidCents;
  const status = computeSaleStatus(sale.totalCents, paidCents, sale.status === STATUS_CANCELLED);
  if (balanceCents > 0 && sale.customerId == null) {
    throw new Error("A sale with pending balance must have a customer.");
  }
  database.client.prepare(
    `
        UPDATE sales
        SET paid_cents = ?,
            balance_cents = ?,
            status = ?,
            updated_at = ?
        WHERE id = ?
      `
  ).run(paidCents, balanceCents, status, updatedAt, saleId);
}
function computeSaleStatus(totalCents, paidCents, isCancelled) {
  if (isCancelled) {
    return STATUS_CANCELLED;
  }
  if (paidCents <= 0) {
    return STATUS_PENDING;
  }
  return paidCents >= totalCents ? STATUS_PAID : STATUS_PARTIAL;
}
function getSaleRecord(database, saleId) {
  const sale = database.client.prepare(
    `
        SELECT
          s.id AS saleId,
          s.sale_number AS saleNumber,
          s.sale_date AS saleDate,
          s.status AS status,
          s.total_cents AS totalCents,
          s.paid_cents AS paidCents,
          s.balance_cents AS balanceCents,
          s.cancellation_reason AS cancellationReason,
          s.customer_id AS customerId,
          s.customer_name_snapshot AS customerNameSnapshot,
          s.customer_phone_snapshot AS customerPhoneSnapshot,
          s.customer_note_snapshot AS customerNoteSnapshot
        FROM sales s
        WHERE s.id = ?
        LIMIT 1
      `
  ).get(saleId);
  if (!sale) {
    throw new Error(`Sale ${saleId} was not found.`);
  }
  return sale;
}
function getSaleSnapshot(database, saleId) {
  const sale = getSaleRecord(database, saleId);
  const itemRows = database.client.prepare(
    `
        SELECT
          id AS saleItemId,
          reusable_product_id AS reusableProductId,
          product_category_snapshot AS productCategory,
          product_name_snapshot AS productName,
          product_material_snapshot AS productMaterial,
          product_variant_snapshot AS productVariant,
          quantity,
          price_type AS priceType,
          unit_price_cents AS unitPriceCents,
          unit_base_price_cents AS unitBasePriceCents,
          unit_personalization_amount_cents AS unitPersonalizationAmountCents,
          personalization_percentage_basis_points AS personalizationPercentageBasisPoints,
          line_subtotal_cents AS lineSubtotalCents,
          line_base_subtotal_cents AS lineBaseSubtotalCents,
          line_personalization_subtotal_cents AS linePersonalizationSubtotalCents,
          product_gain_cents AS productGainCents,
          personalization_gain_cents AS personalizationGainCents,
          total_gain_cents AS totalGainCents,
          consignment_status AS consignmentStatus
        FROM sale_items
        WHERE sale_id = ?
        ORDER BY id ASC
      `
  ).all(saleId);
  const allocationRows = database.client.prepare(
    `
        SELECT
          id AS allocationId,
          sale_item_id AS saleItemId,
          stock_intake_id AS stockIntakeId,
          consumed_quantity AS consumedQuantity,
          allocation_order AS allocationOrder,
          historical_supplier_unit_cost_cents AS historicalSupplierUnitCostCents,
          historical_profit_percentage_basis_points AS historicalProfitPercentageBasisPoints,
          historical_cash_price_cents AS historicalCashPriceCents,
          historical_list_price_cents AS historicalListPriceCents,
          historical_personalization_amount_cents AS historicalPersonalizationAmountCents,
          historical_personalization_percentage_basis_points AS historicalPersonalizationPercentageBasisPoints,
          historical_personalization_expected_profit_cents AS historicalPersonalizationExpectedProfitCents
        FROM sale_item_allocations
        WHERE sale_item_id IN (SELECT id FROM sale_items WHERE sale_id = ?)
        ORDER BY sale_item_id ASC, allocation_order ASC, id ASC
      `
  ).all(saleId);
  const paymentRows = database.client.prepare(
    `
        SELECT
          id AS paymentId,
          payment_date AS paymentDate,
          amount_cents AS amountCents,
          payment_method AS paymentMethod,
          note,
          cancelled_at AS cancelledAt,
          cancellation_reason AS cancellationReason
        FROM payments
        WHERE sale_id = ?
        ORDER BY created_at ASC, id ASC
      `
  ).all(saleId);
  const allocationsByItem = /* @__PURE__ */ new Map();
  allocationRows.forEach((row) => {
    const current = allocationsByItem.get(row.saleItemId) ?? [];
    current.push({
      allocationId: row.allocationId,
      stockIntakeId: row.stockIntakeId,
      consumedQuantity: row.consumedQuantity,
      allocationOrder: row.allocationOrder,
      historicalSupplierUnitCostCents: row.historicalSupplierUnitCostCents,
      historicalProfitPercentageBasisPoints: row.historicalProfitPercentageBasisPoints,
      historicalCashPriceCents: row.historicalCashPriceCents,
      historicalListPriceCents: row.historicalListPriceCents,
      historicalPersonalizationAmountCents: row.historicalPersonalizationAmountCents,
      historicalPersonalizationPercentageBasisPoints: row.historicalPersonalizationPercentageBasisPoints,
      historicalPersonalizationExpectedProfitCents: row.historicalPersonalizationExpectedProfitCents
    });
    allocationsByItem.set(row.saleItemId, current);
  });
  const customer = {
    customerId: sale.customerId,
    name: sale.customerNameSnapshot,
    phoneText: sale.customerPhoneSnapshot,
    note: sale.customerNoteSnapshot
  };
  const saleItemIds = itemRows.map((item) => item.saleItemId);
  const financialsByItem = loadHistoricalSaleItemFinancialsMap(database, saleItemIds);
  const items = itemRows.map((item) => {
    var _a2, _b2, _c2;
    return {
      ...item,
      unitBasePriceCents: item.unitBasePriceCents ?? item.unitPriceCents,
      unitPersonalizationAmountCents: item.unitPersonalizationAmountCents,
      personalizationPercentageBasisPoints: item.personalizationPercentageBasisPoints,
      lineBaseSubtotalCents: item.lineBaseSubtotalCents ?? item.lineSubtotalCents,
      linePersonalizationSubtotalCents: item.linePersonalizationSubtotalCents ?? 0,
      productGainCents: item.productGainCents ?? ((_a2 = financialsByItem.get(item.saleItemId)) == null ? void 0 : _a2.productGainCents) ?? 0,
      personalizationGainCents: item.personalizationGainCents ?? ((_b2 = financialsByItem.get(item.saleItemId)) == null ? void 0 : _b2.personalizationGainCents) ?? 0,
      totalGainCents: item.totalGainCents ?? ((_c2 = financialsByItem.get(item.saleItemId)) == null ? void 0 : _c2.totalGainCents) ?? 0,
      allocations: allocationsByItem.get(item.saleItemId) ?? []
    };
  });
  const payments = paymentRows.map((payment) => ({
    ...payment,
    isActive: payment.cancelledAt == null
  }));
  const totalProfitCents = sumHistoricalSaleItemProfits(
    loadHistoricalSaleItemProfitMap(database, saleItemIds),
    saleItemIds
  );
  const totalProductGainCents = items.reduce((sum, item) => sum + (item.productGainCents ?? 0), 0);
  const totalPersonalizationGainCents = items.reduce(
    (sum, item) => sum + (item.personalizationGainCents ?? 0),
    0
  );
  return {
    saleId: sale.saleId,
    saleNumber: sale.saleNumber,
    saleDate: sale.saleDate,
    status: sale.status,
    totalCents: sale.totalCents,
    paidCents: sale.paidCents,
    balanceCents: sale.balanceCents,
    cancellationReason: sale.cancellationReason,
    customer,
    items,
    payments,
    totalProductGainCents,
    totalPersonalizationGainCents,
    totalProfitCents,
    canRegisterPayment: sale.status !== STATUS_CANCELLED && sale.balanceCents > 0,
    canCancelSale: sale.status !== STATUS_CANCELLED && items.every((item) => item.consignmentStatus !== "settled")
  };
}
function insertAuditLog(database, input) {
  database.client.prepare(
    `
        INSERT INTO audit_logs (
          occurred_at,
          operation_type,
          entity_type,
          entity_id,
          summary,
          detail_json
        ) VALUES (?, ?, ?, ?, ?, ?)
      `
  ).run(
    input.occurredAt,
    input.operationType,
    input.entityType,
    input.entityId,
    input.summary,
    input.detailJson
  );
}
function createSalesCancelChannel({
  database
}) {
  return {
    channel: SALES_CANCEL_CHANNEL,
    requestSchema: cancelSaleRequestSchema,
    handle: (payload) => cancelSale(database, payload)
  };
}
function createSalesAssignCustomerForPaymentRecoveryChannel({
  database
}) {
  return {
    channel: SALES_ASSIGN_CUSTOMER_FOR_PAYMENT_RECOVERY_CHANNEL,
    requestSchema: assignSaleCustomerForPaymentRecoveryRequestSchema,
    handle: (payload) => assignSaleCustomerForPaymentRecovery(database, payload)
  };
}
function createSalesCancelPaymentChannel({
  database
}) {
  return {
    channel: SALES_CANCEL_PAYMENT_CHANNEL,
    requestSchema: cancelSalePaymentRequestSchema,
    handle: (payload) => cancelSalePayment(database, payload)
  };
}
function createSalesConfirmDraftChannel({
  database
}) {
  return {
    channel: SALES_CONFIRM_DRAFT_CHANNEL,
    requestSchema: confirmSaleDraftRequestSchema,
    handle: (payload) => confirmSaleDraft(database, payload)
  };
}
function createSalesGetDetailChannel({
  database
}) {
  return {
    channel: SALES_DETAIL_CHANNEL,
    requestSchema: getSaleDetailRequestSchema,
    handle: (payload) => getSaleDetail(database, payload)
  };
}
function createSalesListHistoryChannel({
  database
}) {
  return {
    channel: SALES_HISTORY_LIST_CHANNEL,
    requestSchema: listSalesHistoryRequestSchema,
    handle: (payload) => listSalesHistory(database, payload)
  };
}
function createSalesRegisterPaymentChannel({
  database
}) {
  return {
    channel: SALES_REGISTER_PAYMENT_CHANNEL,
    requestSchema: registerSalePaymentRequestSchema,
    handle: (payload) => registerSalePayment(database, payload)
  };
}
function saveStockIntake(database, request) {
  const payload = saveStockIntakeRequestSchema.parse(request);
  if (payload.newReusableProduct && !payload.allowDuplicate) {
    const duplicates = findDuplicateReusableProducts(database, payload.newReusableProduct);
    if (duplicates.length > 0) {
      return {
        kind: "duplicate-warning",
        matches: duplicates
      };
    }
  }
  const resolvedProduct = payload.reusableProductId ? assertReusableProductExists(database, payload.reusableProductId) : null;
  const newReusableProduct = payload.newReusableProduct;
  const pricingSummary = calculatePricingSummary({
    supplierUnitCostCents: payload.supplierUnitCostCents,
    profitPercentageBasisPoints: payload.profitPercentageBasisPoints
  });
  const transaction = database.client.transaction(() => {
    var _a2;
    const reusableProductId = (resolvedProduct == null ? void 0 : resolvedProduct.id) ?? createReusableProductRecord(
      database,
      newReusableProduct ?? (() => {
        throw new Error("A new reusable product payload is required when reusableProductId is missing.");
      })()
    );
    const notes = ((_a2 = payload.notes) == null ? void 0 : _a2.trim()) || null;
    const statement = database.client.prepare(
      `
        INSERT INTO stock_intakes (
          reusable_product_id,
          entered_quantity,
          available_quantity,
          supplier_unit_cost_cents,
          cash_price_cents,
          list_price_cents,
          profit_percentage_basis_points,
          expected_profit_cents,
          personalization_amount_cents,
          personalization_percentage_basis_points,
          personalization_expected_profit_cents,
          intake_date,
          notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
    );
    const result = statement.run(
      reusableProductId,
      payload.enteredQuantity,
      payload.availableQuantity,
      payload.supplierUnitCostCents,
      payload.cashPriceCents,
      payload.listPriceCents,
      payload.profitPercentageBasisPoints,
      pricingSummary.expectedProfitCents,
      null,
      null,
      null,
      payload.intakeDate,
      notes
    );
    return {
      kind: "saved",
      stockIntakeId: Number(result.lastInsertRowid),
      reusableProductId
    };
  });
  return transaction();
}
function createSaveStockIntakeChannel({
  database
}) {
  return {
    channel: STOCK_SAVE_INTAKE_CHANNEL,
    requestSchema: saveStockIntakeRequestSchema,
    handle: (payload) => saveStockIntake(database, payload)
  };
}
function registerIpc({
  bootstrapState,
  database,
  getAppVersion = () => "0.0.0",
  ipcMainLike = electron.ipcMain,
  showConsignmentExportSaveDialog,
  writeConsignmentExportFile
}) {
  registerValidatedIpc({
    ipcMainLike,
    definition: createAppHealthChannel({
      getAppVersion,
      bootstrapState
    })
  });
  registerValidatedIpc({
    ipcMainLike,
    definition: createCatalogSearchChannel({ database })
  });
  registerValidatedIpc({
    ipcMainLike,
    definition: createCatalogListChannel({ database })
  });
  registerValidatedIpc({
    ipcMainLike,
    definition: createCatalogProductDetailChannel({ database })
  });
  registerValidatedIpc({
    ipcMainLike,
    definition: createCatalogUpdateProductChannel({ database })
  });
  registerValidatedIpc({
    ipcMainLike,
    definition: createCatalogDeleteProductChannel({ database })
  });
  registerValidatedIpc({
    ipcMainLike,
    definition: createSaveStockIntakeChannel({ database })
  });
  registerValidatedIpc({
    ipcMainLike,
    definition: createSalesListHistoryChannel({ database })
  });
  registerValidatedIpc({
    ipcMainLike,
    definition: createSalesGetDetailChannel({ database })
  });
  registerValidatedIpc({
    ipcMainLike,
    definition: createSalesConfirmDraftChannel({ database })
  });
  registerValidatedIpc({
    ipcMainLike,
    definition: createSalesRegisterPaymentChannel({ database })
  });
  registerValidatedIpc({
    ipcMainLike,
    definition: createSalesCancelPaymentChannel({ database })
  });
  registerValidatedIpc({
    ipcMainLike,
    definition: createSalesAssignCustomerForPaymentRecoveryChannel({ database })
  });
  registerValidatedIpc({
    ipcMainLike,
    definition: createSalesCancelChannel({ database })
  });
  registerValidatedIpc({
    ipcMainLike,
    definition: createConsignmentsListPendingItemsChannel({ database })
  });
  registerValidatedIpc({
    ipcMainLike,
    definition: createConsignmentsConfirmBatchChannel({ database })
  });
  registerValidatedIpc({
    ipcMainLike,
    definition: createConsignmentsListHistoryChannel({ database })
  });
  registerValidatedIpc({
    ipcMainLike,
    definition: createConsignmentsGetDetailChannel({ database })
  });
  registerValidatedIpc({
    ipcMainLike,
    definition: createConsignmentsExportBatchExcelChannel({
      database,
      showSaveDialog: showConsignmentExportSaveDialog,
      writeFile: writeConsignmentExportFile
    })
  });
}
_$b = entityKind;
class ConsoleLogWriter {
  write(message) {
    console.log(message);
  }
}
__publicField(ConsoleLogWriter, _$b, "ConsoleLogWriter");
_ac = entityKind;
class DefaultLogger {
  constructor(config) {
    __publicField(this, "writer");
    this.writer = (config == null ? void 0 : config.writer) ?? new ConsoleLogWriter();
  }
  logQuery(query, params) {
    const stringifiedParams = params.map((p) => {
      try {
        return JSON.stringify(p);
      } catch {
        return String(p);
      }
    });
    const paramsStr = stringifiedParams.length ? ` -- params: [${stringifiedParams.join(", ")}]` : "";
    this.writer.write(`Query: ${query}${paramsStr}`);
  }
}
__publicField(DefaultLogger, _ac, "DefaultLogger");
_bc = entityKind;
class NoopLogger {
  logQuery() {
  }
}
__publicField(NoopLogger, _bc, "NoopLogger");
class BetterSQLiteSession extends (_dc = SQLiteSession, _cc = entityKind, _dc) {
  constructor(client, dialect, schema, options = {}) {
    super(dialect);
    __publicField(this, "logger");
    __publicField(this, "cache");
    this.client = client;
    this.schema = schema;
    this.logger = options.logger ?? new NoopLogger();
    this.cache = options.cache ?? new NoopCache();
  }
  prepareQuery(query, fields, executeMethod, isResponseInArrayMode, customResultMapper, queryMetadata, cacheConfig) {
    const stmt = this.client.prepare(query.sql);
    return new PreparedQuery(
      stmt,
      query,
      this.logger,
      this.cache,
      queryMetadata,
      cacheConfig,
      fields,
      executeMethod,
      isResponseInArrayMode,
      customResultMapper
    );
  }
  transaction(transaction, config = {}) {
    const tx = new BetterSQLiteTransaction("sync", this.dialect, this, this.schema);
    const nativeTx = this.client.transaction(transaction);
    return nativeTx[config.behavior ?? "deferred"](tx);
  }
}
__publicField(BetterSQLiteSession, _cc, "BetterSQLiteSession");
const _BetterSQLiteTransaction = class _BetterSQLiteTransaction extends (_fc = SQLiteTransaction, _ec = entityKind, _fc) {
  transaction(transaction) {
    const savepointName = `sp${this.nestedIndex}`;
    const tx = new _BetterSQLiteTransaction("sync", this.dialect, this.session, this.schema, this.nestedIndex + 1);
    this.session.run(sql.raw(`savepoint ${savepointName}`));
    try {
      const result = transaction(tx);
      this.session.run(sql.raw(`release savepoint ${savepointName}`));
      return result;
    } catch (err) {
      this.session.run(sql.raw(`rollback to savepoint ${savepointName}`));
      throw err;
    }
  }
};
__publicField(_BetterSQLiteTransaction, _ec, "BetterSQLiteTransaction");
let BetterSQLiteTransaction = _BetterSQLiteTransaction;
class PreparedQuery extends (_hc = SQLitePreparedQuery, _gc = entityKind, _hc) {
  constructor(stmt, query, logger, cache, queryMetadata, cacheConfig, fields, executeMethod, _isResponseInArrayMode, customResultMapper) {
    super("sync", executeMethod, query, cache, queryMetadata, cacheConfig);
    this.stmt = stmt;
    this.logger = logger;
    this.fields = fields;
    this._isResponseInArrayMode = _isResponseInArrayMode;
    this.customResultMapper = customResultMapper;
  }
  run(placeholderValues) {
    const params = fillPlaceholders(this.query.params, placeholderValues ?? {});
    this.logger.logQuery(this.query.sql, params);
    return this.stmt.run(...params);
  }
  all(placeholderValues) {
    const { fields, joinsNotNullableMap, query, logger, stmt, customResultMapper } = this;
    if (!fields && !customResultMapper) {
      const params = fillPlaceholders(query.params, placeholderValues ?? {});
      logger.logQuery(query.sql, params);
      return stmt.all(...params);
    }
    const rows = this.values(placeholderValues);
    if (customResultMapper) {
      return customResultMapper(rows);
    }
    return rows.map((row) => mapResultRow(fields, row, joinsNotNullableMap));
  }
  get(placeholderValues) {
    const params = fillPlaceholders(this.query.params, placeholderValues ?? {});
    this.logger.logQuery(this.query.sql, params);
    const { fields, stmt, joinsNotNullableMap, customResultMapper } = this;
    if (!fields && !customResultMapper) {
      return stmt.get(...params);
    }
    const row = stmt.raw().get(...params);
    if (!row) {
      return void 0;
    }
    if (customResultMapper) {
      return customResultMapper([row]);
    }
    return mapResultRow(fields, row, joinsNotNullableMap);
  }
  values(placeholderValues) {
    const params = fillPlaceholders(this.query.params, placeholderValues ?? {});
    this.logger.logQuery(this.query.sql, params);
    return this.stmt.raw().all(...params);
  }
  /** @internal */
  isResponseInArrayMode() {
    return this._isResponseInArrayMode;
  }
}
__publicField(PreparedQuery, _gc, "BetterSQLitePreparedQuery");
class BetterSQLite3Database extends (_jc = BaseSQLiteDatabase, _ic = entityKind, _jc) {
}
__publicField(BetterSQLite3Database, _ic, "BetterSQLite3Database");
function construct(client, config = {}) {
  const dialect = new SQLiteSyncDialect({ casing: config.casing });
  let logger;
  if (config.logger === true) {
    logger = new DefaultLogger();
  } else if (config.logger !== false) {
    logger = config.logger;
  }
  let schema;
  if (config.schema) {
    const tablesConfig = extractTablesRelationalConfig(
      config.schema,
      createTableRelationsHelpers
    );
    schema = {
      fullSchema: config.schema,
      schema: tablesConfig.tables,
      tableNamesMap: tablesConfig.tableNamesMap
    };
  }
  const session = new BetterSQLiteSession(client, dialect, schema, { logger });
  const db = new BetterSQLite3Database("sync", dialect, session, schema);
  db.$client = client;
  return db;
}
function drizzle(...params) {
  if (params[0] === void 0 || typeof params[0] === "string") {
    const instance = params[0] === void 0 ? new Client() : new Client(params[0]);
    return construct(instance, params[1]);
  }
  if (isConfig(params[0])) {
    const { connection, client, ...drizzleConfig } = params[0];
    if (client) return construct(client, drizzleConfig);
    if (typeof connection === "object") {
      const { source, ...options } = connection;
      const instance2 = new Client(source, options);
      return construct(instance2, drizzleConfig);
    }
    const instance = new Client(connection);
    return construct(instance, drizzleConfig);
  }
  return construct(params[0], params[1]);
}
((drizzle2) => {
  function mock(config) {
    return construct({}, config);
  }
  drizzle2.mock = mock;
})(drizzle || (drizzle = {}));
function openSqliteDatabase({
  databaseFilePath,
  ensureDirectory = node_fs.mkdirSync,
  openDatabase = createDrizzleSqliteDatabase
}) {
  ensureDirectory(node_path.dirname(databaseFilePath), { recursive: true });
  return openDatabase(databaseFilePath);
}
function createDrizzleSqliteDatabase(databaseFilePath) {
  const client = new Client(databaseFilePath);
  const orm = drizzle({ client });
  return {
    client,
    orm,
    exec(sql2) {
      client.exec(sql2);
    },
    prepare(sql2) {
      return client.prepare(sql2);
    },
    close() {
      client.close();
    }
  };
}
const initialSchemaMigration = {
  version: 1,
  name: "v001_initial_schema",
  sql: `
    PRAGMA application_id = 0x4D414D41;

    CREATE TABLE IF NOT EXISTS app_metadata (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    INSERT OR IGNORE INTO app_metadata (key, value)
    VALUES ('app_id', 'project-mama');
  `
};
const catalogStockMigration = {
  version: 2,
  name: "v002_catalog_stock",
  sql: `
    CREATE TABLE IF NOT EXISTS reusable_products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      material TEXT NOT NULL,
      variant TEXT NOT NULL,
      search_text_normalized TEXT NOT NULL,
      duplicate_key TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS reusable_products_search_text_normalized_idx
      ON reusable_products (search_text_normalized);

    CREATE INDEX IF NOT EXISTS reusable_products_duplicate_key_idx
      ON reusable_products (duplicate_key);

    CREATE TABLE IF NOT EXISTS settings_margin_rules (
      category TEXT NOT NULL,
      material_normalized TEXT NOT NULL,
      material_label TEXT,
      profit_percentage_basis_points INTEGER NOT NULL,
      personalization_percentage_basis_points INTEGER NOT NULL,
      PRIMARY KEY (category, material_normalized)
    );

    INSERT OR IGNORE INTO settings_margin_rules (
      category,
      material_normalized,
      material_label,
      profit_percentage_basis_points,
      personalization_percentage_basis_points
    ) VALUES
      ('jewelry', 'gold', 'Gold', 300, 500),
      ('jewelry', 'silver', 'Silver', 1000, 500),
      ('mate', '', NULL, 1000, 500),
      ('clothing', '', NULL, 1000, 500);

    CREATE TABLE IF NOT EXISTS stock_intakes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reusable_product_id INTEGER NOT NULL REFERENCES reusable_products(id),
      entered_quantity INTEGER NOT NULL,
      available_quantity INTEGER NOT NULL,
      supplier_unit_cost_cents INTEGER NOT NULL,
      cash_price_cents INTEGER NOT NULL,
      list_price_cents INTEGER NOT NULL,
      profit_percentage_basis_points INTEGER NOT NULL,
      expected_profit_cents INTEGER NOT NULL,
      personalization_amount_cents INTEGER,
      personalization_percentage_basis_points INTEGER,
      personalization_expected_profit_cents INTEGER,
      intake_date TEXT NOT NULL,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CHECK (entered_quantity > 0),
      CHECK (available_quantity >= 0),
      CHECK (available_quantity <= entered_quantity),
      CHECK (supplier_unit_cost_cents >= 0),
      CHECK (cash_price_cents >= 0),
      CHECK (list_price_cents >= 0),
      CHECK (profit_percentage_basis_points >= 0),
      CHECK (
        personalization_amount_cents IS NULL
        OR personalization_amount_cents >= 0
      ),
      CHECK (
        personalization_percentage_basis_points IS NULL
        OR personalization_percentage_basis_points >= 0
      ),
      CHECK (
        personalization_expected_profit_cents IS NULL
        OR personalization_expected_profit_cents >= 0
      )
    );

    CREATE INDEX IF NOT EXISTS stock_intakes_reusable_product_id_idx
      ON stock_intakes (reusable_product_id);

    CREATE INDEX IF NOT EXISTS stock_intakes_intake_date_idx
      ON stock_intakes (intake_date);
  `
};
const salesCoreMigration = {
  version: 3,
  name: "v003_sales_core",
  sql: `
    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone_text TEXT NOT NULL,
      note TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CHECK (length(trim(name)) > 0),
      CHECK (length(trim(phone_text)) > 0)
    );

    CREATE INDEX IF NOT EXISTS customers_phone_text_idx
      ON customers (phone_text);

    CREATE TABLE IF NOT EXISTS sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_number INTEGER NOT NULL UNIQUE,
      customer_id INTEGER REFERENCES customers(id),
      sale_date TEXT NOT NULL,
      total_cents INTEGER NOT NULL,
      paid_cents INTEGER NOT NULL,
      balance_cents INTEGER NOT NULL,
      status TEXT NOT NULL,
      cancellation_reason TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CHECK (total_cents >= 0),
      CHECK (paid_cents >= 0),
      CHECK (balance_cents >= 0),
      CHECK (balance_cents = total_cents - paid_cents),
      CHECK (
        status IN ('pending_payment', 'partial_payment', 'paid', 'cancelled')
      ),
      CHECK (
        cancellation_reason IS NULL OR status = 'cancelled'
      ),
      CHECK (
        customer_id IS NOT NULL OR (balance_cents = 0 AND status IN ('paid', 'cancelled'))
      )
    );

    CREATE INDEX IF NOT EXISTS sales_sale_number_idx
      ON sales (sale_number);

    CREATE INDEX IF NOT EXISTS sales_customer_id_idx
      ON sales (customer_id);

    CREATE INDEX IF NOT EXISTS sales_status_idx
      ON sales (status);

    CREATE TABLE IF NOT EXISTS sale_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id INTEGER NOT NULL REFERENCES sales(id),
      reusable_product_id INTEGER NOT NULL REFERENCES reusable_products(id),
      quantity INTEGER NOT NULL,
      price_type TEXT NOT NULL,
      unit_price_cents INTEGER NOT NULL,
      line_subtotal_cents INTEGER NOT NULL,
      consignment_status TEXT NOT NULL DEFAULT 'pending_settlement',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CHECK (quantity > 0),
      CHECK (price_type IN ('cash', 'list')),
      CHECK (unit_price_cents >= 0),
      CHECK (line_subtotal_cents >= 0),
      CHECK (consignment_status IN ('pending_settlement', 'settled'))
    );

    CREATE INDEX IF NOT EXISTS sale_items_sale_id_idx
      ON sale_items (sale_id);

    CREATE INDEX IF NOT EXISTS sale_items_reusable_product_id_idx
      ON sale_items (reusable_product_id);

    CREATE INDEX IF NOT EXISTS sale_items_consignment_status_idx
      ON sale_items (consignment_status);

    CREATE TABLE IF NOT EXISTS sale_item_allocations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_item_id INTEGER NOT NULL REFERENCES sale_items(id),
      stock_intake_id INTEGER NOT NULL REFERENCES stock_intakes(id),
      consumed_quantity INTEGER NOT NULL,
      historical_supplier_unit_cost_cents INTEGER NOT NULL,
      historical_profit_percentage_basis_points INTEGER NOT NULL,
      historical_cash_price_cents INTEGER NOT NULL,
      historical_list_price_cents INTEGER NOT NULL,
      historical_personalization_amount_cents INTEGER,
      historical_personalization_percentage_basis_points INTEGER,
      historical_personalization_expected_profit_cents INTEGER,
      allocation_order INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CHECK (consumed_quantity > 0),
      CHECK (historical_supplier_unit_cost_cents >= 0),
      CHECK (historical_profit_percentage_basis_points >= 0),
      CHECK (historical_cash_price_cents >= 0),
      CHECK (historical_list_price_cents >= 0),
      CHECK (
        historical_personalization_amount_cents IS NULL
        OR historical_personalization_amount_cents >= 0
      ),
      CHECK (
        historical_personalization_percentage_basis_points IS NULL
        OR historical_personalization_percentage_basis_points >= 0
      ),
      CHECK (
        historical_personalization_expected_profit_cents IS NULL
        OR historical_personalization_expected_profit_cents >= 0
      ),
      CHECK (allocation_order > 0)
    );

    CREATE INDEX IF NOT EXISTS sale_item_allocations_sale_item_id_idx
      ON sale_item_allocations (sale_item_id);

    CREATE INDEX IF NOT EXISTS sale_item_allocations_stock_intake_id_idx
      ON sale_item_allocations (stock_intake_id);

    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id INTEGER NOT NULL REFERENCES sales(id),
      payment_date TEXT NOT NULL,
      amount_cents INTEGER NOT NULL,
      payment_method TEXT,
      note TEXT,
      cancelled_at TEXT,
      cancellation_reason TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CHECK (amount_cents > 0),
      CHECK (
        payment_method IS NULL OR payment_method IN ('cash', 'bank_transfer')
      ),
      CHECK (
        cancelled_at IS NULL OR length(trim(cancellation_reason)) > 0
      )
    );

    CREATE INDEX IF NOT EXISTS payments_sale_id_idx
      ON payments (sale_id);

    CREATE INDEX IF NOT EXISTS payments_cancelled_at_idx
      ON payments (cancelled_at);

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      occurred_at TEXT NOT NULL,
      operation_type TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      summary TEXT NOT NULL,
      detail_json TEXT
    );

    CREATE INDEX IF NOT EXISTS audit_logs_operation_type_idx
      ON audit_logs (operation_type);

    CREATE INDEX IF NOT EXISTS audit_logs_entity_type_entity_id_idx
      ON audit_logs (entity_type, entity_id);
  `
};
const consignmentsCoreMigration = {
  version: 4,
  name: "v004_consignments_core",
  sql: `
    CREATE TABLE IF NOT EXISTS consignment_batches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_number INTEGER NOT NULL UNIQUE,
      liquidation_date TEXT NOT NULL,
      total_cents INTEGER NOT NULL,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CHECK (batch_number > 0),
      CHECK (total_cents >= 0)
    );

    CREATE INDEX IF NOT EXISTS consignment_batches_liquidation_date_idx
      ON consignment_batches (liquidation_date);

    CREATE TABLE IF NOT EXISTS consignment_batch_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_id INTEGER NOT NULL REFERENCES consignment_batches(id),
      sale_item_id INTEGER NOT NULL UNIQUE REFERENCES sale_items(id),
      amount_cents INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CHECK (amount_cents >= 0)
    );

    CREATE INDEX IF NOT EXISTS consignment_batch_items_batch_id_idx
      ON consignment_batch_items (batch_id);
  `
};
const catalogSoftDeleteMigration = {
  version: 5,
  name: "v005_catalog_soft_delete",
  sql: `
    ALTER TABLE reusable_products ADD COLUMN deleted_at TEXT;
  `
};
const consignmentBatchGainMigration = {
  version: 6,
  name: "v006_consignment_batch_gain",
  sql: `
    ALTER TABLE consignment_batches
      ADD COLUMN total_gain_cents INTEGER NOT NULL DEFAULT 0;

    UPDATE consignment_batches
    SET total_gain_cents = COALESCE((
      SELECT SUM(
        sia.consumed_quantity * (
          ROUND(
            (
              sia.historical_supplier_unit_cost_cents
              * sia.historical_profit_percentage_basis_points
            ) / 10000.0
          )
          + COALESCE(sia.historical_personalization_expected_profit_cents, 0)
        )
      )
      FROM consignment_batch_items cbi
      INNER JOIN sale_item_allocations sia ON sia.sale_item_id = cbi.sale_item_id
      WHERE cbi.batch_id = consignment_batches.id
    ), 0);
  `
};
const historicalSnapshotsResetMigration = {
  version: 7,
  name: "v007_historical_snapshots_reset",
  sql: `
    ALTER TABLE sales ADD COLUMN customer_name_snapshot TEXT;
    ALTER TABLE sales ADD COLUMN customer_phone_snapshot TEXT;
    ALTER TABLE sales ADD COLUMN customer_note_snapshot TEXT;

    UPDATE sales
    SET customer_name_snapshot = COALESCE(customer_name_snapshot, (
          SELECT customers.name FROM customers WHERE customers.id = sales.customer_id
        )),
        customer_phone_snapshot = COALESCE(customer_phone_snapshot, (
          SELECT customers.phone_text FROM customers WHERE customers.id = sales.customer_id
        )),
        customer_note_snapshot = COALESCE(customer_note_snapshot, (
          SELECT customers.note FROM customers WHERE customers.id = sales.customer_id
        ));

    CREATE INDEX IF NOT EXISTS sales_customer_name_snapshot_idx
      ON sales (customer_name_snapshot);

    ALTER TABLE sale_items ADD COLUMN product_category_snapshot TEXT;
    ALTER TABLE sale_items ADD COLUMN product_name_snapshot TEXT;
    ALTER TABLE sale_items ADD COLUMN product_material_snapshot TEXT;
    ALTER TABLE sale_items ADD COLUMN product_variant_snapshot TEXT;

    UPDATE sale_items
    SET product_category_snapshot = COALESCE(product_category_snapshot, (
          SELECT reusable_products.category FROM reusable_products WHERE reusable_products.id = sale_items.reusable_product_id
        )),
        product_name_snapshot = COALESCE(product_name_snapshot, (
          SELECT reusable_products.name FROM reusable_products WHERE reusable_products.id = sale_items.reusable_product_id
        )),
        product_material_snapshot = COALESCE(product_material_snapshot, (
          SELECT reusable_products.material FROM reusable_products WHERE reusable_products.id = sale_items.reusable_product_id
        )),
        product_variant_snapshot = COALESCE(product_variant_snapshot, (
          SELECT reusable_products.variant FROM reusable_products WHERE reusable_products.id = sale_items.reusable_product_id
        ));

    CREATE INDEX IF NOT EXISTS sale_items_product_name_snapshot_idx
      ON sale_items (product_name_snapshot);

    CREATE INDEX IF NOT EXISTS consignment_batches_batch_number_idx
      ON consignment_batches (batch_number);

    CREATE INDEX IF NOT EXISTS consignment_batch_items_sale_item_id_idx
      ON consignment_batch_items (sale_item_id);
  `
};
const saleItemPersonalizationSnapshotsMigration = {
  version: 8,
  name: "v008_sale_item_personalization_snapshots",
  sql: `
    ALTER TABLE sale_items ADD COLUMN unit_base_price_cents INTEGER;
    ALTER TABLE sale_items ADD COLUMN unit_personalization_amount_cents INTEGER;
    ALTER TABLE sale_items ADD COLUMN personalization_percentage_basis_points INTEGER;
    ALTER TABLE sale_items ADD COLUMN line_base_subtotal_cents INTEGER;
    ALTER TABLE sale_items ADD COLUMN line_personalization_subtotal_cents INTEGER;
    ALTER TABLE sale_items ADD COLUMN product_gain_cents INTEGER;
    ALTER TABLE sale_items ADD COLUMN personalization_gain_cents INTEGER;
    ALTER TABLE sale_items ADD COLUMN total_gain_cents INTEGER;

    UPDATE sale_items
    SET unit_base_price_cents = COALESCE(unit_base_price_cents, unit_price_cents),
        line_base_subtotal_cents = COALESCE(line_base_subtotal_cents, line_subtotal_cents),
        line_personalization_subtotal_cents = COALESCE(line_personalization_subtotal_cents, 0),
        product_gain_cents = COALESCE(product_gain_cents, (
          SELECT COALESCE(SUM(
            sale_item_allocations.consumed_quantity * CAST(ROUND(
              sale_item_allocations.historical_supplier_unit_cost_cents
              * sale_item_allocations.historical_profit_percentage_basis_points
              / 10000.0
            ) AS INTEGER)
          ), 0)
          FROM sale_item_allocations
          WHERE sale_item_allocations.sale_item_id = sale_items.id
        )),
        personalization_gain_cents = COALESCE(personalization_gain_cents, (
          SELECT COALESCE(SUM(
            sale_item_allocations.consumed_quantity
            * COALESCE(sale_item_allocations.historical_personalization_expected_profit_cents, 0)
          ), 0)
          FROM sale_item_allocations
          WHERE sale_item_allocations.sale_item_id = sale_items.id
        )),
        total_gain_cents = COALESCE(total_gain_cents,
          COALESCE(product_gain_cents, (
            SELECT COALESCE(SUM(
              sale_item_allocations.consumed_quantity * CAST(ROUND(
                sale_item_allocations.historical_supplier_unit_cost_cents
                * sale_item_allocations.historical_profit_percentage_basis_points
                / 10000.0
              ) AS INTEGER)
            ), 0)
            FROM sale_item_allocations
            WHERE sale_item_allocations.sale_item_id = sale_items.id
          ))
          +
          COALESCE(personalization_gain_cents, (
            SELECT COALESCE(SUM(
              sale_item_allocations.consumed_quantity
              * COALESCE(sale_item_allocations.historical_personalization_expected_profit_cents, 0)
            ), 0)
            FROM sale_item_allocations
            WHERE sale_item_allocations.sale_item_id = sale_items.id
          ))
        );

    CREATE INDEX IF NOT EXISTS sale_items_total_gain_cents_idx
      ON sale_items (total_gain_cents);
  `
};
const foundationMigrations = [
  initialSchemaMigration,
  catalogStockMigration,
  salesCoreMigration,
  consignmentsCoreMigration,
  catalogSoftDeleteMigration,
  consignmentBatchGainMigration,
  historicalSnapshotsResetMigration,
  saleItemPersonalizationSnapshotsMigration
];
function getSchemaVersion(database) {
  const row = database.prepare("PRAGMA user_version").get();
  return typeof (row == null ? void 0 : row.user_version) === "number" ? row.user_version : 0;
}
function runMigrations(database, migrations = foundationMigrations) {
  const fromVersion = getSchemaVersion(database);
  const pendingMigrations = migrations.filter((migration) => migration.version > fromVersion).sort((left, right) => left.version - right.version);
  for (const migration of pendingMigrations) {
    applyMigration(database, migration);
  }
  return {
    fromVersion,
    toVersion: getSchemaVersion(database),
    appliedVersions: pendingMigrations.map((migration) => migration.version)
  };
}
function applyMigration(database, migration) {
  try {
    database.exec("BEGIN IMMEDIATE");
    database.exec(migration.sql);
    database.exec(`PRAGMA user_version = ${migration.version}`);
    database.exec("COMMIT");
  } catch (error) {
    try {
      database.exec("ROLLBACK");
    } catch {
    }
    throw error;
  }
}
const DATABASE_FILE_NAME = "project-mama.sqlite";
function resolveAppPaths({ pathProvider }) {
  const userDataDirectory = pathProvider.getPath("userData");
  return {
    userDataDirectory,
    databaseFilePath: node_path.join(userDataDirectory, DATABASE_FILE_NAME)
  };
}
function initializeApp({
  pathProvider,
  openDatabase = openSqliteDatabase,
  migrateDatabase = runMigrations
}) {
  const paths = resolveAppPaths({ pathProvider });
  const database = openDatabase({ databaseFilePath: paths.databaseFilePath });
  try {
    const migrationResult = migrateDatabase(database);
    return {
      paths,
      database,
      state: {
        dbReady: true,
        schemaVersion: migrationResult.toVersion
      }
    };
  } catch (error) {
    database.close();
    throw error;
  }
}
function resolveDesktopWindowIconPath(app) {
  if ("isPackaged" in app && app.isPackaged) {
    return node_path.join(process.resourcesPath, "windows", "ordena-icon.ico");
  }
  return node_path.join(app.getAppPath(), "assets", "branding", "windows", "ordena-icon.ico");
}
function registerDesktopLifecycle({
  app,
  BrowserWindow,
  initializeApplication = initializeApp,
  registerIpcHandlers,
  mainWindowViteDevServerUrl,
  mainWindowRendererViteName = "main_window"
}) {
  let initializedApp = null;
  const createMainWindow = () => {
    const window = new BrowserWindow({
      width: 1200,
      height: 800,
      minWidth: 960,
      minHeight: 640,
      show: false,
      autoHideMenuBar: true,
      icon: resolveDesktopWindowIconPath(app),
      webPreferences: {
        preload: node_path.join(__dirname, "preload.js"),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true
      }
    });
    window.once("ready-to-show", () => {
      window.show();
    });
    {
      void window.loadURL(mainWindowViteDevServerUrl);
    }
    return window;
  };
  const startApplication = async () => {
    initializedApp = initializeApplication({ pathProvider: app });
    registerIpcHandlers({
      bootstrapState: initializedApp.state,
      database: initializedApp.database,
      getAppVersion: () => app.getVersion()
    });
    createMainWindow();
    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createMainWindow();
      }
    });
  };
  app.whenReady().then(startApplication).catch((error) => {
    console.error("Failed to start desktop foundation.", error);
    app.quit();
  });
  app.on("before-quit", () => {
    initializedApp == null ? void 0 : initializedApp.database.close();
    initializedApp = null;
  });
  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
      app.quit();
    }
  });
}
registerDesktopLifecycle({
  app: electron.app,
  BrowserWindow: electron.BrowserWindow,
  registerIpcHandlers: registerIpc,
  mainWindowViteDevServerUrl: "http://localhost:5173",
  mainWindowRendererViteName: "main_window"
});
//# sourceMappingURL=main.js.map
