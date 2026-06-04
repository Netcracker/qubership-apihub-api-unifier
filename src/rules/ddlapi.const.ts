// Property-name constants for the ddlapi (Realm) model. These mirror the field names
// of `@netcracker/qubership-apihub-ddlapi`'s typed model and exist so the rules tree
// never hard-codes bare string literals (see api-unifier-authoring skill).
//
// `kind` discriminant *values* (ObjectKind/TypeKind/AttrKind/ExprKind/ReferenceOption)
// are imported straight from ddlapi by the rules modules rather than re-declared here,
// so they cannot drift from the upstream model.

// --- Realm ---
export const DDL_API_PROPERTY_DDLAPI = 'ddlapi'
export const DDL_API_PROPERTY_SCHEMAS = 'schemas'

// --- shared / collections ---
export const DDL_API_PROPERTY_NAME = 'name'
export const DDL_API_PROPERTY_KIND = 'kind'
export const DDL_API_PROPERTY_ATTRS = 'attrs'
export const DDL_API_PROPERTY_OBJECTS = 'objects'
export const DDL_API_PROPERTY_EXPR = 'expr' // Atlas Go: X Expr
export const DDL_API_PROPERTY_TYPE = 'type'  // Atlas Go: T string

// --- Schema ---
export const DDL_API_PROPERTY_TABLES = 'tables'

// --- Table ---
export const DDL_API_PROPERTY_COLUMNS = 'columns'
export const DDL_API_PROPERTY_INDEXES = 'indexes'
export const DDL_API_PROPERTY_PRIMARY_KEY = 'primaryKey'
export const DDL_API_PROPERTY_FOREIGN_KEYS = 'foreignKeys'
export const DDL_API_PROPERTY_DEPS = 'deps'

// --- Column / ColumnType ---

export const DDL_API_PROPERTY_DEFAULT = 'default'
export const DDL_API_PROPERTY_RAW = 'raw'
export const DDL_API_PROPERTY_NULL = 'null'

// --- Index / IndexPart ---
export const DDL_API_PROPERTY_UNIQUE = 'unique'
export const DDL_API_PROPERTY_PARTS = 'parts'
export const DDL_API_PROPERTY_SEQ_NO = 'seqNo'
export const DDL_API_PROPERTY_DESC = 'desc'
export const DDL_API_PROPERTY_COLUMN = 'column'      // Atlas Go: C *Column

// --- ForeignKey ---
export const DDL_API_PROPERTY_SYMBOL = 'symbol'
export const DDL_API_PROPERTY_REF_TABLE = 'refTable'
export const DDL_API_PROPERTY_REF_COLUMNS = 'refColumns'
export const DDL_API_PROPERTY_ON_UPDATE = 'onUpdate'
export const DDL_API_PROPERTY_ON_DELETE = 'onDelete'

// --- SchemaType members ---
export const DDL_API_PROPERTY_VALUES = 'values'
export const DDL_API_PROPERTY_SCHEMA = 'schema'
export const DDL_API_PROPERTY_UNSIGNED = 'unsigned'
export const DDL_API_PROPERTY_PRECISION = 'precision'
export const DDL_API_PROPERTY_SCALE = 'scale'
export const DDL_API_PROPERTY_SIZE = 'size'

// --- Attr members ---
export const DDL_API_PROPERTY_TEXT = 'text'
export const DDL_API_PROPERTY_VALUE = 'value' // Atlas Go: V string (Charset / Collation value)


// --- Expr members (NamedDefault.expr, etc.) ---
// (NamedDefault reuses DDL_API_PROPERTY_EXPR / _NAME / _ATTRS; Literal uses _V; RawExpr uses _X.)
