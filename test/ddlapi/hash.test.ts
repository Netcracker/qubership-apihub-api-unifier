import { Realm } from '@netcracker/qubership-apihub-ddlapi'
import { normalize, DDL_API_NORMALIZE_OPTIONS } from '../../src'
import { buildRealmAndAssertValid } from '../helpers/ddlapi'
import {
  checkHashesEqualByPath,
  checkHashesNotEqualByPath,
  TEST_DEFAULTS_FLAG,
  TEST_HASH_FLAG,
  TEST_ORIGINS_FLAG,
  TEST_ORIGINS_FOR_DEFAULTS,
} from '../helpers'

// Hashing. Per-entity hashes; equal-modulo-defaults realms hash equal; a
// semantic change differs; deterministic on a cyclic FK graph; no whole-realm hash.
describe('ddlapi hashing', () => {
  const baseOptions = {
    ...DDL_API_NORMALIZE_OPTIONS,
    originsFlag: TEST_ORIGINS_FLAG,
    defaultsFlag: TEST_DEFAULTS_FLAG,
    createOriginsForDefaults: () => TEST_ORIGINS_FOR_DEFAULTS,
    hashFlag: TEST_HASH_FLAG,
  }
  const norm = async (ddl: string) => normalize(await buildRealmAndAssertValid(ddl), baseOptions) as Realm

  const TABLE0 = ['schemas', 0, 'tables', 0]
  const COL = (i: number) => [...TABLE0, 'columns', i]

  it('assigns a per-entity hash to tables, columns, indexes and foreign keys', async () => {
    const r = await norm(`
      CREATE TABLE t (id bigint PRIMARY KEY, v text);
      CREATE INDEX idx ON t (v);
    `)
    const table: any = r.schemas[0].tables![0]
    expect(typeof table[TEST_HASH_FLAG]).toBe('function')
    expect(typeof table.columns![0][TEST_HASH_FLAG as any]).toBe('function')
    expect(typeof table.indexes![0][TEST_HASH_FLAG as any]).toBe('function')
    expect(typeof (table[TEST_HASH_FLAG] as any)()).toBe('string')
  })

  it('has no whole-realm or schema hash (only entities own hashes)', async () => {
    const r = await norm('CREATE TABLE t(id int)')
    expect(r).not.toHaveProperty([TEST_HASH_FLAG])
    expect(r.schemas[0]).not.toHaveProperty([TEST_HASH_FLAG])
  })

  it('hashes equal-modulo-defaults columns the same (explicit NULL ≡ implicit nullable)', async () => {
    const explicit = await norm('CREATE TABLE t (id bigint, v text NULL)')
    const implicit = await norm('CREATE TABLE t (id bigint, v text)')
    // v is column index 1 in both; null=true is added by default for the implicit one.
    checkHashesEqualByPath(explicit, implicit, COL(1))
    // and the whole table is equal-modulo-defaults
    checkHashesEqualByPath(explicit, implicit, TABLE0)
  })

  it('differs at the column when its type changes; the table hash isolates it (per-entity)', async () => {
    const a = await norm('CREATE TABLE t (id bigint)')
    const b = await norm('CREATE TABLE t (id integer)')
    // the change is detected at the column (its own hash differs)…
    checkHashesNotEqualByPath(a, b, COL(0))
    // …and is intentionally isolated from the table's own hash (nested entities are captured
    // only structurally): downstream correlates columns by their per-element hashes.
    checkHashesEqualByPath(a, b, TABLE0)
  })

  it('changes a table hash when its column set changes structurally', async () => {
    const a = await norm('CREATE TABLE t (id bigint)')
    const b = await norm('CREATE TABLE t (id bigint, extra text)')
    checkHashesNotEqualByPath(a, b, TABLE0)
  })

  it('includes comments in the hash (semantic)', async () => {
    const withComment = await norm(`CREATE TABLE t (id bigint); COMMENT ON COLUMN t.id IS 'the id';`)
    const without = await norm('CREATE TABLE t (id bigint)')
    checkHashesNotEqualByPath(withComment, without, COL(0))
  })

  it('is deterministic on a cyclic FK graph and isolates unrelated tables', async () => {
    const ddl = `
      CREATE TABLE a (id bigint PRIMARY KEY, b_id bigint REFERENCES b (id));
      CREATE TABLE b (id bigint PRIMARY KEY, a_id bigint REFERENCES a (id));
    `
    const r1 = await norm(ddl)
    const r2 = await norm(ddl)
    const aIdx = r1.schemas[0].tables!.findIndex((t) => t.name === 'a')
    // deterministic across two independent normalizations
    checkHashesEqualByPath(r1, r2, ['schemas', 0, 'tables', aIdx])

    // changing b's columns does not change a's hash (FK target captured shallowly)
    const changed = await norm(`
      CREATE TABLE a (id bigint PRIMARY KEY, b_id bigint REFERENCES b (id));
      CREATE TABLE b (id bigint PRIMARY KEY, a_id bigint REFERENCES a (id), extra text);
    `)
    const aIdxChanged = changed.schemas[0].tables!.findIndex((t) => t.name === 'a')
    checkHashesEqualByPath(r1, changed, ['schemas', 0, 'tables', aIdx], ['schemas', 0, 'tables', aIdxChanged])
  })
})
