import { CrawlRulesContext, isObject } from '@netcracker/qubership-apihub-json-crawl'
import { BEFORE_SECOND_DATA_LEVEL, CURRENT_DATA_LEVEL, NormalizationRules, NormalizeOptions, UnifyFunction } from '../types'
import { SPEC_TYPE_DDL_API_1 } from '../spec-type'
import {
  checkContains,
  checkType,
  TYPE_ARRAY,
  TYPE_BOOLEAN,
  TYPE_JSON_ANY,
  TYPE_NUMBER,
  TYPE_OBJECT,
  TYPE_STRING,
} from '../validate/checker'
import { AttrKind, ExprKind, ObjectKind, ReferenceOption, TypeKind } from '@netcracker/qubership-apihub-ddlapi'
import { DefaultValueMapping, valueDefaults } from '../unifies/defaults'
import { EMPTY_MARKER, ReplaceMapping, TO_EMPTY_ARRAY_MAPPING, valueReplaces } from '../unifies/replaces'
import { ddlApiNullabilityDefault, reportDanglingForeignKey } from '../unifies/ddlapi'
import {
  DDL_API_PROPERTY_ATTRS,
  DDL_API_PROPERTY_COLUMNS,
  DDL_API_PROPERTY_DEPS,
  DDL_API_PROPERTY_DESC,
  DDL_API_PROPERTY_FOREIGN_KEYS,
  DDL_API_PROPERTY_INDEXES,
  DDL_API_PROPERTY_OBJECTS,
  DDL_API_PROPERTY_ON_DELETE,
  DDL_API_PROPERTY_ON_UPDATE,
  DDL_API_PROPERTY_PARTS,
  DDL_API_PROPERTY_TABLES,
  DDL_API_PROPERTY_TYPE,
  DDL_API_PROPERTY_UNIQUE,
  DDL_API_PROPERTY_UNSIGNED,
} from './ddlapi.const'
import { DdlApiDialect } from './ddlapi.dialect'

export type DdlApiSpecVersion = typeof SPEC_TYPE_DDL_API_1

/**
 * Canonical option bundle for normalizing ddlapi documents. ddlapi documents have
 * no `allOf` / traits / `$ref`, so those stages are turned off; leaving them at their
 * `true` defaults would do wasteful (and on the cyclic Realm graph, meaningless) work.
 * Exported as one constant so api-diff imports a stable contract instead of six flags.
 */
export const DDL_API_NORMALIZE_OPTIONS: Readonly<NormalizeOptions> = {
  validate: true,
  unify: true,
  mergeAllOf: false,
  mergeTraits: false,
  liftCombiners: false,
  resolveRef: false,
}

// hashStrategy: CURRENT_DATA_LEVEL marks a key as part of its owner entity's hash. A
// rule WITHOUT a hashStrategy is excluded from the hash, so every content key carries it;
// nested entities instead get a newDataLayer boundary (see hashBoundary) and so contribute
// only structurally to the parent's hash while owning their own.
const HASHED = { hashStrategy: CURRENT_DATA_LEVEL } as const

const STRING_RULE: NormalizationRules = { validate: checkType(TYPE_STRING), ...HASHED }
const BOOLEAN_RULE: NormalizationRules = { validate: checkType(TYPE_BOOLEAN), ...HASHED }
const NUMBER_RULE: NormalizationRules = { validate: checkType(TYPE_NUMBER), ...HASHED }
const STRING_ARRAY_RULE: NormalizationRules = { '/*': STRING_RULE, validate: checkType(TYPE_ARRAY), ...HASHED }

const REFERENCE_OPTION_VALUES = Object.values(ReferenceOption)

// Validates the discriminant `kind` carries exactly the expected union-member string.
const kindRule = (kindValue: string): NormalizationRules => ({
  validate: [checkType(TYPE_STRING), checkContains(kindValue)],
  ...HASHED,
})

const readKind = (value: unknown): string | undefined =>
  isObject(value) && typeof (value as Record<string, unknown>).kind === 'string'
    ? (value as Record<string, string>).kind
    : undefined

// Empty-collection normalization + reversible primitive defaults. Absent array
// properties become `[]` (TO_EMPTY_ARRAY_MAPPING); listed primitive defaults are added
// reversibly. `valueDefaults` runs before the `valueReplaces` that consumes its EMPTY_MARKER.
const collectionUnify = (arrayKeys: string[], primitiveDefaults: DefaultValueMapping = {}): UnifyFunction[] => {
  const defaults: DefaultValueMapping = { ...primitiveDefaults }
  const replaces: Record<string, ReplaceMapping> = {}
  for (const key of arrayKeys) {
    defaults[key] = EMPTY_MARKER
    replaces[key] = TO_EMPTY_ARRAY_MAPPING
  }
  return [valueDefaults(defaults), valueReplaces(replaces)]
}

const emptyArrayUnify = (...keys: string[]): UnifyFunction[] => collectionUnify(keys)

// Hashing. Each independently-comparable entity owns its hash; nested entities are
// captured shallowly in the parent's hash via a newDataLayer boundary while owning their
// own deeper hash (mirrors JSON Schema). No whole-realm/schema hash — only entities.
const ENTITY_HASH = { hashOwner: true, hashStrategy: CURRENT_DATA_LEVEL } as const
// Wrap an entity rule where it is referenced/contained so the enclosing entity's hash sees
// it one data level deeper (shallow capture). Lazy so cyclic entity rules resolve at crawl.
const hashBoundary = (rulesFn: () => NormalizationRules) => () => ({
  ...rulesFn(),
  newDataLayer: true,
  hashStrategy: BEFORE_SECOND_DATA_LEVEL,
})
// Same boundary for a union kind-dispatcher (objects can hold any SchemaObject kind).
const hashBoundaryDispatcher = (fn: (ctx: CrawlRulesContext) => NormalizationRules) =>
  (ctx: CrawlRulesContext): NormalizationRules => ({
    ...fn(ctx),
    newDataLayer: true,
    hashStrategy: BEFORE_SECOND_DATA_LEVEL,
  })
// Container for an entity array: recursed at the owner's level so its boundaried elements
// are captured shallowly in the owner's hash.
const ENTITY_ARRAY_HASH = { hashStrategy: CURRENT_DATA_LEVEL } as const

/**
 * Core, driver-neutral ddlapi rules factory. Parameterized by version (one today —
 * the seam for future stamps) and a `DdlApiDialect` that supplies dialect-specific rules
 * for the four open `kind`-unions. All rule nodes are declared inside this closure so
 * they capture `dialect`; the kind-dispatchers (`schemaTypeRules`, `attrRules`,
 * `exprRules`, `objectRules`) and the cyclic edges (`fk.refTable`, `enum.schema`) are
 * resolved lazily at crawl time, so declaration order only matters for eager references.
 *
 * Covers structural + value validation (`checkType`/`checkContains`), empty-collection and
 * primitive defaults (`unify`), and per-entity hashing markers. Dialect-specific kinds and
 * primitive defaults come from the injected `dialect`; kinds it does not recognise fall
 * through to the generic `Unknown*` passthrough.
 */
export const ddlApiRules = (_version: DdlApiSpecVersion, dialect: DdlApiDialect): NormalizationRules => {
  // Pick the dialect-provided primitive defaults (e.g. `unsigned`,
  // GeneratedExpr `type`) for the given property keys. Empty when the dialect supplies none,
  // keeping core dialect-agnostic.
  const dialectPrimitive = (...keys: string[]): DefaultValueMapping => {
    const out: DefaultValueMapping = {}
    const provided = dialect.primitiveDefaults
    if (!provided) { return out }
    for (const key of keys) {
      if (provided[key] !== undefined) { out[key] = provided[key] }
    }
    return out
  }

  // Driver-neutral or future kinds we do not model: validate only that `kind` is a
  // string and let arbitrary nested content pass. Used as the shared fallback.
  const unknownPassthroughRules: NormalizationRules = {
    '/kind': STRING_RULE,
    '/**': { validate: checkType(...TYPE_JSON_ANY), ...HASHED },
    validate: checkType(TYPE_OBJECT),
    ...HASHED, // unknown escape-hatch kinds are hashed opaquely
  }

  // --- union kind-dispatchers (lazy bodies; default branch → dialect lookup → fallback) ---

  const schemaTypeRules = ({ value }: CrawlRulesContext): NormalizationRules => {
    const kind = readKind(value)
    switch (kind) {
      case TypeKind.BoolType:
      case TypeKind.JSONType:
      case TypeKind.SpatialType:
      case TypeKind.UUIDType:
      case TypeKind.UnsupportedType:
        return scalarTypeRules(kind)
      case TypeKind.IntegerType: return integerTypeRules
      case TypeKind.DecimalType: return decimalTypeRules
      case TypeKind.FloatType: return floatTypeRules
      case TypeKind.StringType: return stringTypeRules
      case TypeKind.BinaryType: return binaryTypeRules
      case TypeKind.TimeType: return timeTypeRules
      case TypeKind.EnumType: return enumTypeRules
      default:
        return (kind !== undefined ? dialect.typeRulesFor(kind) : undefined) ?? unknownPassthroughRules
    }
  }

  const attrRules = ({ value }: CrawlRulesContext): NormalizationRules => {
    const kind = readKind(value)
    switch (kind) {
      case AttrKind.Comment: return commentRules
      case AttrKind.Charset: return charsetRules
      case AttrKind.Collation: return collationRules
      case AttrKind.Check: return checkRules
      case AttrKind.GeneratedExpr: return generatedExprRules
      default:
        return (kind !== undefined ? dialect.attrRulesFor(kind) : undefined) ?? unknownPassthroughRules
    }
  }

  const exprRules = ({ value }: CrawlRulesContext): NormalizationRules => {
    const kind = readKind(value)
    switch (kind) {
      case ExprKind.Literal: return literalRules
      case ExprKind.RawExpr: return rawExprRules
      case ObjectKind.NamedDefault: return namedDefaultRules
      default:
        // Expr has no dialect lookup (no escape-hatch Expr kinds are emitted); fall back.
        return unknownPassthroughRules
    }
  }

  const objectRules = ({ value }: CrawlRulesContext): NormalizationRules => {
    const kind = readKind(value)
    switch (kind) {
      case ObjectKind.Table: return tableRules
      case ObjectKind.View: return viewRules
      case ObjectKind.Index: return indexRules
      case ObjectKind.ForeignKey: return foreignKeyRules
      case ObjectKind.Check: return checkRules
      case ObjectKind.NamedDefault: return namedDefaultRules
      case ObjectKind.EnumType: return enumTypeRules
      default:
        return (kind !== undefined ? dialect.objectRulesFor(kind) : undefined) ?? unknownPassthroughRules
    }
  }

  // --- collection rules (arrays of union members) ---
  // attrs are entity content (not nested entities) → included in the owner's hash.
  const attrsArrayRule: NormalizationRules = { '/*': attrRules, validate: checkType(TYPE_ARRAY), ...HASHED }
  // objects hold entity SchemaObjects (Table/EnumType/PG named types), so each element is a
  // hash boundary and the container is recursed at the owner's level.
  const objectsArrayRule: NormalizationRules = {
    '/*': hashBoundaryDispatcher(objectRules),
    validate: checkType(TYPE_ARRAY),
    ...ENTITY_ARRAY_HASH,
  }
  // `deps`: minimal defensive rule — route each entry through the object dispatcher.
  const depsArrayRule: NormalizationRules = objectsArrayRule

  // --- SchemaType members ---
  // Bool/JSON/Spatial/UUID/Unsupported: just { kind, t }.
  const scalarTypeRules = (kindValue: string): NormalizationRules => ({
    '/kind': kindRule(kindValue),
    '/t': STRING_RULE,
    validate: checkType(TYPE_OBJECT),
    ...HASHED,
  })
  const integerTypeRules: NormalizationRules = {
    '/kind': kindRule(TypeKind.IntegerType),
    '/t': STRING_RULE,
    '/unsigned': BOOLEAN_RULE,
    '/attrs': attrsArrayRule,
    validate: checkType(TYPE_OBJECT),
    // unsigned is a dialect concept (MySQL); PG defaults it to false.
    unify: collectionUnify([DDL_API_PROPERTY_ATTRS], dialectPrimitive(DDL_API_PROPERTY_UNSIGNED)),
    ...HASHED,
  }
  const decimalTypeRules: NormalizationRules = {
    '/kind': kindRule(TypeKind.DecimalType),
    '/t': STRING_RULE,
    '/precision': NUMBER_RULE,
    '/scale': NUMBER_RULE,
    '/unsigned': BOOLEAN_RULE,
    validate: checkType(TYPE_OBJECT),
    unify: collectionUnify([], dialectPrimitive(DDL_API_PROPERTY_UNSIGNED)),
    ...HASHED,
  }
  const floatTypeRules: NormalizationRules = {
    '/kind': kindRule(TypeKind.FloatType),
    '/t': STRING_RULE,
    '/unsigned': BOOLEAN_RULE,
    '/precision': NUMBER_RULE,
    validate: checkType(TYPE_OBJECT),
    unify: collectionUnify([], dialectPrimitive(DDL_API_PROPERTY_UNSIGNED)),
    ...HASHED,
  }
  const stringTypeRules: NormalizationRules = {
    '/kind': kindRule(TypeKind.StringType),
    '/t': STRING_RULE,
    '/size': NUMBER_RULE,
    '/attrs': attrsArrayRule,
    validate: checkType(TYPE_OBJECT),
    unify: emptyArrayUnify(DDL_API_PROPERTY_ATTRS),
    ...HASHED,
  }
  const binaryTypeRules: NormalizationRules = {
    '/kind': kindRule(TypeKind.BinaryType),
    '/t': STRING_RULE,
    '/size': NUMBER_RULE,
    validate: checkType(TYPE_OBJECT),
    ...HASHED,
  }
  const timeTypeRules: NormalizationRules = {
    '/kind': kindRule(TypeKind.TimeType),
    '/t': STRING_RULE,
    '/precision': NUMBER_RULE,
    '/scale': NUMBER_RULE,
    '/attrs': attrsArrayRule,
    validate: checkType(TYPE_OBJECT),
    unify: emptyArrayUnify(DDL_API_PROPERTY_ATTRS),
    ...HASHED,
  }
  const enumTypeRules: NormalizationRules = {
    '/kind': kindRule(TypeKind.EnumType),
    '/t': STRING_RULE,
    '/values': STRING_ARRAY_RULE,
    // back-reference to the owning Schema (reference edge / cycle) — resolved lazily.
    '/schema': () => schemaRules,
    '/attrs': attrsArrayRule,
    validate: checkType(TYPE_OBJECT),
    unify: emptyArrayUnify(DDL_API_PROPERTY_ATTRS),
    ...ENTITY_HASH,
  }

  // --- Attr members ---
  const commentRules: NormalizationRules = {
    '/kind': kindRule(AttrKind.Comment),
    '/text': STRING_RULE,
    validate: checkType(TYPE_OBJECT),
    ...HASHED,
  }
  const charsetRules: NormalizationRules = {
    '/kind': kindRule(AttrKind.Charset),
    '/v': STRING_RULE,
    validate: checkType(TYPE_OBJECT),
    ...HASHED,
  }
  const collationRules: NormalizationRules = {
    '/kind': kindRule(AttrKind.Collation),
    '/v': STRING_RULE,
    validate: checkType(TYPE_OBJECT),
    ...HASHED,
  }
  // Check is both an Attr and a SchemaObject (same `kind` string) — one rule serves both.
  const checkRules: NormalizationRules = {
    '/kind': kindRule(AttrKind.Check),
    '/name': STRING_RULE,
    '/expr': STRING_RULE,
    '/attrs': attrsArrayRule,
    validate: checkType(TYPE_OBJECT),
    unify: emptyArrayUnify(DDL_API_PROPERTY_ATTRS),
    ...HASHED,
  }
  const generatedExprRules: NormalizationRules = {
    '/kind': kindRule(AttrKind.GeneratedExpr),
    '/expr': STRING_RULE,
    '/type': STRING_RULE,
    validate: checkType(TYPE_OBJECT),
    // PG only supports STORED generated columns → default GeneratedExpr.type.
    unify: collectionUnify([], dialectPrimitive(DDL_API_PROPERTY_TYPE)),
    ...HASHED,
  }

  // --- Expr members ---
  const literalRules: NormalizationRules = {
    '/kind': kindRule(ExprKind.Literal),
    '/v': STRING_RULE,
    validate: checkType(TYPE_OBJECT),
    ...HASHED,
  }
  const rawExprRules: NormalizationRules = {
    '/kind': kindRule(ExprKind.RawExpr),
    '/x': STRING_RULE,
    validate: checkType(TYPE_OBJECT),
    ...HASHED,
  }
  const namedDefaultRules: NormalizationRules = {
    '/kind': kindRule(ObjectKind.NamedDefault),
    '/name': STRING_RULE,
    '/expr': exprRules, // Literal | RawExpr
    '/attrs': attrsArrayRule,
    validate: checkType(TYPE_OBJECT),
    unify: emptyArrayUnify(DDL_API_PROPERTY_ATTRS),
    ...HASHED,
  }

  // --- Column / ColumnType ---
  // ColumnType is column content (not a nested entity) → fully part of the column's hash.
  const columnTypeRules: NormalizationRules = {
    '/type': schemaTypeRules,
    '/raw': STRING_RULE,
    '/null': BOOLEAN_RULE,
    validate: checkType(TYPE_OBJECT),
    ...HASHED,
  }
  const columnRules: NormalizationRules = {
    '/name': STRING_RULE,
    '/type': columnTypeRules,
    '/default': exprRules,
    '/attrs': attrsArrayRule,
    validate: checkType(TYPE_OBJECT),
    unify: emptyArrayUnify(DDL_API_PROPERTY_ATTRS),
    ...ENTITY_HASH,
  }

  // --- Index / IndexPart ---
  // IndexPart is index content (which column/expr, order) → included in the index's hash so
  // an index over column a differs from one over column b. The referenced column is included
  // (not boundaried): conservative — a column change also perturbs its index's hash.
  const indexPartRules: NormalizationRules = {
    '/seqNo': NUMBER_RULE,
    '/desc': BOOLEAN_RULE,
    '/x': exprRules,
    '/c': () => columnRules, // reference edge to a table column (same instance)
    '/attrs': attrsArrayRule,
    validate: checkType(TYPE_OBJECT),
    // desc:false — ascending is the SQL default.
    unify: collectionUnify([DDL_API_PROPERTY_ATTRS], { [DDL_API_PROPERTY_DESC]: false }),
    ...HASHED,
  }
  const indexRules: NormalizationRules = {
    '/kind': kindRule(ObjectKind.Index),
    '/name': STRING_RULE,
    '/unique': BOOLEAN_RULE,
    '/attrs': attrsArrayRule,
    '/parts': { '/*': indexPartRules, validate: checkType(TYPE_ARRAY), ...ENTITY_ARRAY_HASH },
    validate: checkType(TYPE_OBJECT),
    // unique:false — an unmarked index is non-unique.
    unify: collectionUnify([DDL_API_PROPERTY_ATTRS, DDL_API_PROPERTY_PARTS], { [DDL_API_PROPERTY_UNIQUE]: false }),
    ...ENTITY_HASH,
  }

  // --- ForeignKey ---
  const foreignKeyRules: NormalizationRules = {
    '/kind': kindRule(ObjectKind.ForeignKey),
    '/symbol': STRING_RULE,
    // FK columns/refColumns are part of the FK's identity → included in its hash.
    '/columns': { '/*': () => columnRules, validate: checkType(TYPE_ARRAY), ...ENTITY_ARRAY_HASH },
    // refTable is boundaried: shallow capture cuts the table↔fk cycle for object-hash.
    '/refTable': hashBoundary(() => tableRules),
    '/refColumns': { '/*': () => columnRules, validate: checkType(TYPE_ARRAY), ...ENTITY_ARRAY_HASH },
    '/onUpdate': { validate: [checkType(TYPE_STRING), checkContains(...REFERENCE_OPTION_VALUES)], ...HASHED },
    '/onDelete': { validate: [checkType(TYPE_STRING), checkContains(...REFERENCE_OPTION_VALUES)], ...HASHED },
    '/attrs': attrsArrayRule,
    validate: checkType(TYPE_OBJECT),
    // onUpdate/onDelete default to ANSI 'NO ACTION'; dangling-refTable reporter.
    unify: [
      ...collectionUnify([DDL_API_PROPERTY_ATTRS], {
        [DDL_API_PROPERTY_ON_UPDATE]: ReferenceOption.NoAction,
        [DDL_API_PROPERTY_ON_DELETE]: ReferenceOption.NoAction,
      }),
      reportDanglingForeignKey,
    ],
    ...ENTITY_HASH,
  }

  // --- View: minimal defensive rule until a producer emits views ---
  const viewRules: NormalizationRules = {
    '/kind': kindRule(ObjectKind.View),
    '/name': STRING_RULE,
    '/def': STRING_RULE,
    '/columns': { '/*': hashBoundary(() => columnRules), validate: checkType(TYPE_ARRAY), ...ENTITY_ARRAY_HASH },
    '/attrs': attrsArrayRule,
    '/deps': depsArrayRule,
    validate: checkType(TYPE_OBJECT),
    unify: emptyArrayUnify(DDL_API_PROPERTY_COLUMNS, DDL_API_PROPERTY_ATTRS, DDL_API_PROPERTY_DEPS),
    ...ENTITY_HASH,
  }

  // --- Table ---
  const tableRules: NormalizationRules = {
    '/kind': kindRule(ObjectKind.Table),
    '/name': STRING_RULE,
    '/columns': { '/*': hashBoundary(() => columnRules), validate: checkType(TYPE_ARRAY), ...ENTITY_ARRAY_HASH },
    '/indexes': { '/*': hashBoundary(() => indexRules), validate: checkType(TYPE_ARRAY), ...ENTITY_ARRAY_HASH },
    '/primaryKey': hashBoundary(() => indexRules),
    '/foreignKeys': { '/*': hashBoundary(() => foreignKeyRules), validate: checkType(TYPE_ARRAY), ...ENTITY_ARRAY_HASH },
    '/attrs': attrsArrayRule,
    '/objects': objectsArrayRule,
    '/deps': depsArrayRule,
    validate: checkType(TYPE_OBJECT),
    // primaryKey is intentionally NOT defaulted: its absence means "no PK".
    // ddlApiNullabilityDefault runs at the table level because PK-aware nullability needs
    // table scope; it owns ColumnType.null and mutates shared types in place.
    unify: [
      ...collectionUnify([
        DDL_API_PROPERTY_COLUMNS,
        DDL_API_PROPERTY_INDEXES,
        DDL_API_PROPERTY_FOREIGN_KEYS,
        DDL_API_PROPERTY_ATTRS,
        DDL_API_PROPERTY_OBJECTS,
        DDL_API_PROPERTY_DEPS,
      ]),
      ddlApiNullabilityDefault,
    ],
    ...ENTITY_HASH,
  }

  // --- Schema ---
  const schemaRules: NormalizationRules = {
    '/name': STRING_RULE,
    '/tables': { '/*': tableRules, validate: checkType(TYPE_ARRAY) },
    '/attrs': attrsArrayRule,
    '/objects': objectsArrayRule,
    validate: checkType(TYPE_OBJECT),
    unify: emptyArrayUnify(DDL_API_PROPERTY_TABLES, DDL_API_PROPERTY_ATTRS, DDL_API_PROPERTY_OBJECTS),
  }

  // --- Realm (root) ---
  return {
    '/ddlapi': STRING_RULE,
    '/schemas': { '/*': schemaRules, validate: checkType(TYPE_ARRAY) },
    '/attrs': attrsArrayRule,
    '/objects': objectsArrayRule,
    validate: checkType(TYPE_OBJECT),
    // schemas is required — present, not defaulted.
    unify: emptyArrayUnify(DDL_API_PROPERTY_ATTRS, DDL_API_PROPERTY_OBJECTS),
  }
}
