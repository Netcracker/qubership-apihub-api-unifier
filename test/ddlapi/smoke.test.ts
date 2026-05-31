import { buildFromDdl } from '@netcracker/qubership-apihub-ddlapi'

// Smoke test: the ddlapi library is linked and importable from its package root.
describe('ddlapi link smoke test', () => {
  it('buildFromDdl returns a Realm from the package root', async () => {
    const realm = await buildFromDdl('CREATE TABLE t(id int)')

    expect(realm).toMatchObject({
      ddlapi: '1.0.0',
      schemas: [
        {
          tables: [
            {
              kind: 'Table',
              name: 't',
              columns: [{ name: 'id' }],
            },
          ],
        },
      ],
    })
  })
})
