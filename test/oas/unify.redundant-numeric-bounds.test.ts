import { deUnify, unify } from '../../src/unify'
import { convertOriginToHumanReadable, normalize, NormalizeOptions, SPEC_TYPE_OPEN_API_30 } from '../../src'
import { createOas, TEST_ORIGINS_FLAG, TEST_SCHEMA_NAME } from '../helpers'
import { parseAsyncApiAndAssertValid } from '../helpers/asyncapi'
import { JSON_SCHEMA_REDUNDANT_CONSTRAINTS_SYMBOL } from '../../src/unifies/redundant-numeric-bounds'

describe('exclusive bounds unification', () => {
  describe('plain JSON Schema', () => {
    it.each([
      {
        name: 'keeps greater exclusiveMinimum over minimum',
        source: { type: 'number', minimum: 1, exclusiveMinimum: 2 },
        expectedPresentProperty: 'exclusiveMinimum',
        expectedPresentValue: 2,
        expectedRemoved: 'minimum',
      },
      {
        name: 'keeps minimum over lower exclusiveMinimum',
        source: { type: 'number', minimum: 2, exclusiveMinimum: 1 },
        expectedPresentProperty: 'minimum',
        expectedPresentValue: 2,
        expectedRemoved: 'exclusiveMinimum',
      },
      {
        name: 'keeps exclusiveMinimum when lower bounds are equal',
        source: { type: 'number', minimum: 1, exclusiveMinimum: 1 },
        expectedPresentProperty: 'exclusiveMinimum',
        expectedPresentValue: 1,
        expectedRemoved: 'minimum',
      },
      {
        name: 'keeps lower exclusiveMaximum over maximum',
        source: { type: 'number', maximum: 2, exclusiveMaximum: 1 },
        expectedPresentProperty: 'exclusiveMaximum',
        expectedPresentValue: 1,
        expectedRemoved: 'maximum',
      },
      {
        name: 'keeps maximum over greater exclusiveMaximum',
        source: { type: 'number', maximum: 1, exclusiveMaximum: 2 },
        expectedPresentProperty: 'maximum',
        expectedPresentValue: 1,
        expectedRemoved: 'exclusiveMaximum',
      },
      {
        name: 'keeps exclusiveMaximum when upper bounds are equal',
        source: { type: 'number', maximum: 1, exclusiveMaximum: 1 },
        expectedPresentProperty: 'exclusiveMaximum',
        expectedPresentValue: 1,
        expectedRemoved: 'maximum',
      },
    ])('$name', ({ source, expectedPresentProperty, expectedPresentValue, expectedRemoved }) => {
      const result = unify(source, { unify: true }) as Record<PropertyKey, unknown>

      expect(result).toHaveProperty(expectedPresentProperty, expectedPresentValue)
      expect(result).not.toHaveProperty(expectedRemoved)
    })

    it('restores removed bounds and cleans private metadata during deunification', () => {
      const source = {
        type: 'number',
        minimum: 1,
        exclusiveMinimum: 2,
        maximum: 10,
        exclusiveMaximum: 8,
      }
      const intermediate = unify(source, { unify: true }) as Record<PropertyKey, unknown>

      expect(Object.getOwnPropertySymbols(intermediate)).toContain(JSON_SCHEMA_REDUNDANT_CONSTRAINTS_SYMBOL)

      const result = deUnify(intermediate, { unify: true }) as Record<PropertyKey, unknown>

      expect(result).toMatchObject(source)
      expect(Object.getOwnPropertySymbols(result)).not.toContain(JSON_SCHEMA_REDUNDANT_CONSTRAINTS_SYMBOL)
    })

    it('does not remove redundant pairs when removeRedundantConstraints is false', () => {
      const source = {
        type: 'number',
        minimum: 1,
        exclusiveMinimum: 2,
      }

      const result = unify(source, { unify: true, removeRedundantConstraints: false }) as Record<PropertyKey, unknown>

      expect(result).toHaveProperty('minimum', 1)
      expect(result).toHaveProperty('exclusiveMinimum', 2)
    })

    it('skip prevents restoration but still removes private metadata', () => {
      const intermediate = unify({
        type: 'number',
        minimum: 1,
        exclusiveMinimum: 2,
      }, { unify: true }) as Record<PropertyKey, unknown>

      const result = deUnify(intermediate, {
        unify: true,
        skip: (_value, path) => path.at(-1) === 'minimum',
      }) as Record<PropertyKey, unknown>

      expect(result).not.toHaveProperty('minimum')
      expect(result).toHaveProperty('exclusiveMinimum', 2)
      expect(Object.getOwnPropertySymbols(result)).not.toContain(JSON_SCHEMA_REDUNDANT_CONSTRAINTS_SYMBOL)
    })

    it('restores values without inventing origins when removed value had no origin entry', () => {
      const source = {
        type: 'number',
        minimum: 1,
        exclusiveMinimum: 2,
        [TEST_ORIGINS_FLAG]: {
          type: [{ value: 'type' }],
          exclusiveMinimum: [{ value: 'exclusiveMinimum' }],
        },
      }
      const intermediate = unify(source, { unify: true, originsFlag: TEST_ORIGINS_FLAG }) as Record<PropertyKey, unknown>

      const result = deUnify(intermediate, { unify: true, originsFlag: TEST_ORIGINS_FLAG }) as Record<PropertyKey, unknown>

      expect(result).toHaveProperty('minimum', 1)
      expect(result[TEST_ORIGINS_FLAG]).not.toHaveProperty('minimum')
    })

    it('does not restore private metadata when removeRedundantConstraints is false', () => {
      const intermediate = unify({
        type: 'number',
        minimum: 1,
        exclusiveMinimum: 2,
      }, { unify: true }) as Record<PropertyKey, unknown>

      const result = deUnify(intermediate, { unify: true, removeRedundantConstraints: false }) as Record<PropertyKey, unknown>

      expect(result).not.toHaveProperty('minimum')
      expect(result).toHaveProperty('exclusiveMinimum', 2)
      expect(Object.getOwnPropertySymbols(result)).not.toContain(JSON_SCHEMA_REDUNDANT_CONSTRAINTS_SYMBOL)
    })
  })

  describe('JSON schema as part of other specifications', () => {
    it('leaves OpenAPI 3.0 boolean exclusive flags untouched', () => {
      const result = normalize(createOas({
        type: 'number',
        minimum: 1,
        exclusiveMinimum: true,
      }), { unify: true })

      expect(result).toHaveProperty(['components', 'schemas', 'Single', 'minimum'], 1)
      expect(result).toHaveProperty(['components', 'schemas', 'Single', 'exclusiveMinimum'], true)
    })

    it('normalizes OpenAPI 3.1 numeric exclusive bounds', () => {
      const result = normalize(createOas({
        type: 'number',
        minimum: 1,
        exclusiveMinimum: 2,
      }, '3.1.0'), { unify: true })

      expect(result).not.toHaveProperty(['components', 'schemas', 'Single', 'minimum'])
      expect(result).toHaveProperty(['components', 'schemas', 'Single', 'exclusiveMinimum'], 2)
    })

    it('normalizes plain AsyncAPI JSON Schema', async () => {
      const source = {
        asyncapi: '3.0.0',
        info: {
          title: 'Test API',
          version: '1.0.0',
        },
        components: {
          schemas: {
            TestSchema: {
              type: 'number',
              maximum: 10,
              exclusiveMaximum: 8,
            },
          },
        },
      }

      await parseAsyncApiAndAssertValid(source)

      const result = normalize(source, { unify: true })

      expect(result).not.toHaveProperty(['components', 'schemas', 'TestSchema', 'maximum'])
      expect(result).toHaveProperty(['components', 'schemas', 'TestSchema', 'exclusiveMaximum'], 8)
    })

    it('normalizes AsyncAPI JSON Schema draft-07 multi-format schemas', async () => {
      const source = {
        asyncapi: '3.0.0',
        info: {
          title: 'Test API',
          version: '1.0.0',
        },
        components: {
          schemas: {
            TestSchema: {
              schemaFormat: 'application/schema+json;version=draft-07',
              schema: {
                type: 'number',
                maximum: 10,
                exclusiveMaximum: 8,
              },
            },
          },
        },
      }

      await parseAsyncApiAndAssertValid(source)

      const result = normalize(source, { unify: true })

      expect(result).not.toHaveProperty(['components', 'schemas', 'TestSchema', 'schema', 'maximum'])
      expect(result).toHaveProperty(['components', 'schemas', 'TestSchema', 'schema', 'exclusiveMaximum'], 8)
    })

    it('does not restore metadata when forced to OpenAPI 3.0 draft-04 semantics', () => {
      const intermediate = normalize(createOas({
        type: 'number',
        minimum: 1,
        exclusiveMinimum: 2,
      }, '3.1.0'), { unify: true }) as Record<PropertyKey, unknown>

      const result = deUnify(intermediate, {
        unify: true,
        forceRulesForSpecVersion: SPEC_TYPE_OPEN_API_30,
      }) as Record<PropertyKey, unknown>

      const schema = (result as any).components.schemas.Single as object
      expect(schema).not.toHaveProperty('minimum')
      expect(schema).toHaveProperty('exclusiveMinimum', 2)
      // The draft-04/OpenAPI 3.0 deunify pipeline does not include this unifier, so its private metadata remains opaque.
      expect(Object.getOwnPropertySymbols(schema)).toContain(JSON_SCHEMA_REDUNDANT_CONSTRAINTS_SYMBOL)
    })
  })

  describe('origins', () => {
    const OPTIONS: NormalizeOptions = {
      originsFlag: TEST_ORIGINS_FLAG,
      unify: true,
    }

    it('restores captured origins for removed constraints during deunification', () => {
      const source = createOas({
        type: 'number',
        minimum: 1,
        exclusiveMinimum: 2,
      }, '3.1.0')
      const intermediate = normalize(source, OPTIONS)

      const result = deUnify(intermediate, OPTIONS)
      const resultWithHmr = convertOriginToHumanReadable(result, TEST_ORIGINS_FLAG)

      expect(resultWithHmr).toHaveProperty(['components', 'schemas', TEST_SCHEMA_NAME, 'minimum'], 1)
      expect(resultWithHmr).toHaveProperty(['components', 'schemas', TEST_SCHEMA_NAME, TEST_ORIGINS_FLAG, 'minimum'], ['components/schemas/Single/minimum'])
      expect(resultWithHmr).toHaveProperty(['components', 'schemas', TEST_SCHEMA_NAME, TEST_ORIGINS_FLAG, 'exclusiveMinimum'], ['components/schemas/Single/exclusiveMinimum'])
    })
  })
})
