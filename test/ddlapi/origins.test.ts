import { normalize, DDL_API_NORMALIZE_OPTIONS } from '../../src'
import { buildRealmAndAssertValid } from '../helpers/ddlapi'
import { commonOriginsCheck, TEST_ORIGINS_FLAG } from '../helpers'

// Origins from the model hierarchy. commonOriginsCheck enforces the whole
// output contract: every node carries an origins record, ChainItems are interned per
// path position, and reference instances carry their definition-site origin.
describe('ddlapi origins', () => {
  const baseOptions = {
    ...DDL_API_NORMALIZE_OPTIONS,
    unify: false,
    originsFlag: TEST_ORIGINS_FLAG,
  }

  it('assigns a valid, interned origins tree over a realm with enum, PK, FK and index', async () => {
    const realm = await buildRealmAndAssertValid(`
      CREATE TYPE mood AS ENUM ('happy', 'sad');
      CREATE TABLE users (
        id bigint NOT NULL,
        mood mood,
        PRIMARY KEY (id)
      );
      CREATE TABLE orders (
        id bigint NOT NULL,
        user_id bigint NOT NULL,
        PRIMARY KEY (id),
        CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
      );
      CREATE INDEX idx_orders_user ON orders (user_id);
    `)

    const result = normalize(realm, baseOptions)

    commonOriginsCheck(result, { originsFlag: TEST_ORIGINS_FLAG })
  })

  it('roots a top-level property origin at its containment path', async () => {
    const realm = await buildRealmAndAssertValid('CREATE TABLE t(id int)')
    const result = normalize(realm, baseOptions) as Record<symbol, any>

    // schemas[0].tables[0].name → origin chain reversed is [schemas, 0, tables, 0, name]
    const schemasArr: any = (result as any).schemas
    const tablesArr: any = schemasArr[0].tables
    const table: any = tablesArr[0]
    const nameLeaf = table[TEST_ORIGINS_FLAG].name[0]

    const path: PropertyKey[] = []
    let item = nameLeaf
    while (item) { path.push(item.value); item = item.parent }
    expect(path.reverse()).toEqual(['schemas', 0, 'tables', 0, 'name'])
  })

  it('does not mutate the input realm (identity-preserving clone)', async () => {
    const realm = await buildRealmAndAssertValid('CREATE TABLE t(id int)')
    const result = normalize(realm, baseOptions)

    expect(result).not.toBe(realm)
    expect(realm).not.toHaveProperty([TEST_ORIGINS_FLAG])
    expect((result as any).schemas[0]).not.toBe(realm.schemas[0])
  })
})
