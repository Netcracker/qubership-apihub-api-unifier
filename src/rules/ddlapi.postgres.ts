import { CURRENT_DATA_LEVEL, NormalizationRules } from '../types'
import { checkContains, checkType, TYPE_ARRAY, TYPE_BOOLEAN, TYPE_JSON_ANY, TYPE_NUMBER, TYPE_OBJECT, TYPE_STRING } from '../validate/checker'
import { DdlApiDialect, DIALECT_ID_POSTGRES } from './ddlapi.dialect'
import { DDL_API_PROPERTY_TYPE, DDL_API_PROPERTY_UNSIGNED } from './ddlapi.const'

// PostgreSQL escape-hatch `kind` discriminants emitted by buildFromDdl. These are not part
// of ddlapi's core unions (TypeKind/AttrKind/ObjectKind), so they are declared here — the
// dialect overlay is their only owner.
export const PG_KIND_IDENTITY = 'Identity'
export const PG_KIND_PARTITION = 'Partition'
export const PG_KIND_INHERITS = 'Inherits'
export const PG_KIND_STORAGE_PARAMS = 'StorageParams'
export const PG_KIND_TRIGGER = 'Trigger'
export const PG_KIND_INDEX_INCLUDE = 'IndexInclude'
export const PG_KIND_INDEX_NULLS_DISTINCT = 'IndexNullsDistinct'
export const PG_KIND_INDEX_TYPE = 'IndexType'
export const PG_KIND_INDEX_PREDICATE = 'IndexPredicate'
export const PG_KIND_CONCURRENTLY = 'Concurrently'
export const PG_KIND_INDEX_COLUMN_PROP = 'IndexColumnProp'
export const PG_KIND_INDEX_OP_CLASS = 'IndexOpClass'
export const PG_KIND_EXCLUDE_CONSTRAINT = 'ExcludeConstraint'
export const PG_KIND_COMPOSITE_TYPE = 'CompositeType'
export const PG_KIND_RANGE_TYPE = 'RangeType'
export const PG_KIND_DOMAIN = 'pg:domain'

// hashStrategy: CURRENT_DATA_LEVEL includes a key in its owner entity's hash (see ddlapi.ts).
// PG kind fields are content (opaque) so every leaf carries it.
const HASHED = { hashStrategy: CURRENT_DATA_LEVEL } as const

const STRING_RULE: NormalizationRules = { validate: checkType(TYPE_STRING), ...HASHED }
const BOOLEAN_RULE: NormalizationRules = { validate: checkType(TYPE_BOOLEAN), ...HASHED }
const NUMBER_RULE: NormalizationRules = { validate: checkType(TYPE_NUMBER), ...HASHED }
const STRING_ARRAY_RULE: NormalizationRules = { '/*': STRING_RULE, validate: checkType(TYPE_ARRAY), ...HASHED }
// Accept any JSON value (and any nested content) without stripping — used for opaque,
// PG-specific data blobs (partition spec, exclusions, composite fields, base type, …)
// that api-unifier compares opaquely and only needs to pass through + carry origins.
const ANY_DESCENDANT: NormalizationRules = { validate: checkType(...TYPE_JSON_ANY), ...HASHED }
const ANY_RULE: NormalizationRules = { validate: checkType(...TYPE_JSON_ANY), '/**': ANY_DESCENDANT, ...HASHED }

const pgKind = (kindValue: string): NormalizationRules => ({
  validate: [checkType(TYPE_STRING), checkContains(kindValue)],
  ...HASHED,
})

// Named-type / constraint objects are independently-comparable entities → own their hash.
// Reached via boundaried `objects` arrays in core, so the parent captures them shallowly.
const ENTITY_HASH = { hashOwner: true, hashStrategy: CURRENT_DATA_LEVEL } as const

// Each rule validates `kind` + the documented fields, treats opaque structured fields as
// ANY_RULE, and keeps a `/**` catch-all so unforeseen fields pass through (escape-hatch
// resilience). The model-aware origins walk decorates these generically.
const identityRules: NormalizationRules = {
  '/kind': pgKind(PG_KIND_IDENTITY),
  '/generation': STRING_RULE,
  '/seqStart': NUMBER_RULE,
  '/seqIncrement': NUMBER_RULE,
  '/**': ANY_DESCENDANT,
  validate: checkType(TYPE_OBJECT),
  ...HASHED,
}
const partitionRules: NormalizationRules = {
  '/kind': pgKind(PG_KIND_PARTITION),
  '/T': STRING_RULE,
  '/parts': ANY_RULE,
  '/**': ANY_DESCENDANT,
  validate: checkType(TYPE_OBJECT),
  ...HASHED,
}
const inheritsRules: NormalizationRules = {
  '/kind': pgKind(PG_KIND_INHERITS),
  '/parents': STRING_ARRAY_RULE,
  '/**': ANY_DESCENDANT,
  validate: checkType(TYPE_OBJECT),
  ...HASHED,
}
const storageParamsRules: NormalizationRules = {
  '/kind': pgKind(PG_KIND_STORAGE_PARAMS),
  '/params': ANY_RULE,
  '/**': ANY_DESCENDANT,
  validate: checkType(TYPE_OBJECT),
  ...HASHED,
}
const triggerRules: NormalizationRules = {
  '/kind': pgKind(PG_KIND_TRIGGER),
  '/name': STRING_RULE,
  '/timing': STRING_RULE,
  '/events': ANY_RULE,
  '/forEachRow': BOOLEAN_RULE,
  '/funcName': STRING_RULE,
  '/when': STRING_RULE,
  '/isConstraint': BOOLEAN_RULE,
  '/deferrable': BOOLEAN_RULE,
  '/initDeferred': BOOLEAN_RULE,
  '/**': ANY_DESCENDANT,
  validate: checkType(TYPE_OBJECT),
  ...HASHED,
}
const indexIncludeRules: NormalizationRules = {
  '/kind': pgKind(PG_KIND_INDEX_INCLUDE),
  '/columns': STRING_ARRAY_RULE,
  '/**': ANY_DESCENDANT,
  validate: checkType(TYPE_OBJECT),
  ...HASHED,
}
const indexNullsDistinctRules: NormalizationRules = {
  '/kind': pgKind(PG_KIND_INDEX_NULLS_DISTINCT),
  '/V': BOOLEAN_RULE,
  '/**': ANY_DESCENDANT,
  validate: checkType(TYPE_OBJECT),
  ...HASHED,
}
const indexTypeRules: NormalizationRules = {
  '/kind': pgKind(PG_KIND_INDEX_TYPE),
  '/T': STRING_RULE,
  '/**': ANY_DESCENDANT,
  validate: checkType(TYPE_OBJECT),
  ...HASHED,
}
const indexPredicateRules: NormalizationRules = {
  '/kind': pgKind(PG_KIND_INDEX_PREDICATE),
  '/P': STRING_RULE,
  '/**': ANY_DESCENDANT,
  validate: checkType(TYPE_OBJECT),
  ...HASHED,
}
const concurrentlyRules: NormalizationRules = {
  '/kind': pgKind(PG_KIND_CONCURRENTLY),
  '/**': ANY_DESCENDANT,
  validate: checkType(TYPE_OBJECT),
  ...HASHED,
}
const indexColumnPropRules: NormalizationRules = {
  '/kind': pgKind(PG_KIND_INDEX_COLUMN_PROP),
  '/nullsFirst': BOOLEAN_RULE,
  '/nullsLast': BOOLEAN_RULE,
  '/**': ANY_DESCENDANT,
  validate: checkType(TYPE_OBJECT),
  ...HASHED,
}
const indexOpClassRules: NormalizationRules = {
  '/kind': pgKind(PG_KIND_INDEX_OP_CLASS),
  '/name': STRING_RULE,
  '/**': ANY_DESCENDANT,
  validate: checkType(TYPE_OBJECT),
  ...HASHED,
}
const excludeConstraintRules: NormalizationRules = {
  '/kind': pgKind(PG_KIND_EXCLUDE_CONSTRAINT),
  '/name': STRING_RULE,
  '/method': STRING_RULE,
  '/exclusions': ANY_RULE,
  '/**': ANY_DESCENDANT,
  validate: checkType(TYPE_OBJECT),
  ...ENTITY_HASH,
}
const compositeTypeRules: NormalizationRules = {
  '/kind': pgKind(PG_KIND_COMPOSITE_TYPE),
  '/name': STRING_RULE,
  '/schema': STRING_RULE, // schema *name* string (not a Schema back-ref)
  '/fields': ANY_RULE,
  '/**': ANY_DESCENDANT,
  validate: checkType(TYPE_OBJECT),
  ...ENTITY_HASH,
}
const rangeTypeRules: NormalizationRules = {
  '/kind': pgKind(PG_KIND_RANGE_TYPE),
  '/name': STRING_RULE,
  '/schema': STRING_RULE, // schema *name* string
  '/subtype': STRING_RULE,
  '/params': ANY_RULE,
  '/**': ANY_DESCENDANT,
  validate: checkType(TYPE_OBJECT),
  ...ENTITY_HASH,
}
// pg:domain is dual-role: a SchemaObject in schema.objects AND a SchemaType at column.type.type.
const pgDomainRules: NormalizationRules = {
  '/kind': pgKind(PG_KIND_DOMAIN),
  '/t': STRING_RULE,
  '/baseType': ANY_RULE, // a SchemaType, compared opaquely
  '/null': BOOLEAN_RULE,
  '/default': ANY_RULE, // an Expr
  '/checks': ANY_RULE, // Check[]
  '/**': ANY_DESCENDANT,
  validate: checkType(TYPE_OBJECT),
  ...ENTITY_HASH,
}

const ATTR_RULES: Record<string, NormalizationRules> = {
  [PG_KIND_IDENTITY]: identityRules,
  [PG_KIND_PARTITION]: partitionRules,
  [PG_KIND_INHERITS]: inheritsRules,
  [PG_KIND_STORAGE_PARAMS]: storageParamsRules,
  [PG_KIND_TRIGGER]: triggerRules,
  [PG_KIND_INDEX_INCLUDE]: indexIncludeRules,
  [PG_KIND_INDEX_NULLS_DISTINCT]: indexNullsDistinctRules,
  [PG_KIND_INDEX_TYPE]: indexTypeRules,
  [PG_KIND_INDEX_PREDICATE]: indexPredicateRules,
  [PG_KIND_CONCURRENTLY]: concurrentlyRules,
  [PG_KIND_INDEX_COLUMN_PROP]: indexColumnPropRules,
  [PG_KIND_INDEX_OP_CLASS]: indexOpClassRules,
}

const OBJECT_RULES: Record<string, NormalizationRules> = {
  [PG_KIND_EXCLUDE_CONSTRAINT]: excludeConstraintRules,
  [PG_KIND_COMPOSITE_TYPE]: compositeTypeRules,
  [PG_KIND_RANGE_TYPE]: rangeTypeRules,
  [PG_KIND_DOMAIN]: pgDomainRules,
}

const TYPE_RULES: Record<string, NormalizationRules> = {
  [PG_KIND_DOMAIN]: pgDomainRules,
}

/**
 * PostgreSQL dialect. Supplies rules for the PG escape-hatch kinds and the
 * dialect-specific primitive defaults (unsigned, GeneratedExpr.type='STORED'). Composes
 * onto the driver-neutral core through the registry the core consults; unknown-to-PG kinds
 * still fall back to the core generic passthrough.
 */
export const DIALECT_POSTGRES: DdlApiDialect = {
  id: DIALECT_ID_POSTGRES,
  attrRulesFor: (kind) => ATTR_RULES[kind],
  objectRulesFor: (kind) => OBJECT_RULES[kind],
  typeRulesFor: (kind) => TYPE_RULES[kind],
  primitiveDefaults: {
    [DDL_API_PROPERTY_UNSIGNED]: false,
    [DDL_API_PROPERTY_TYPE]: 'STORED', // GeneratedExpr.type
  },
}
