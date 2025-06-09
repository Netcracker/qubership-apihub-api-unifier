import { JSON_SCHEMA_PROPERTY_NULLABLE, normalize } from '../../src'
import ignoresNullableForSchemasIn31 from '../resources/incompatibility/ignores-nullable-for-schemas-in-31.json'
import arrayOfTypeContainOneOfPrimitiveTypes31 from '../resources/incompatibility/array-of-type-contain-one-of-primitive-types-31.json'
import nonExistingTypeNullInArrayOfTypes31 from '../resources/incompatibility/type-null-in-array-of-types-31.json'
import typesInArrayAreUnique from '../resources/incompatibility/types-in-array-are-unique-31.json'

import arrayOfTypes30 from '../resources/incompatibility/array-of-types-30.json'
import typeNull30 from '../resources/incompatibility/type-null-in-30.json'

const schemaPath = ['paths', '/example', 'post', 'responses', '200', 'content', 'application/json', 'schema']

const defaultNormalize = (value: unknown) => normalize(value, {
  validate: true,
  unify: true,
  liftCombiners: true,
})

const NOT_ANY_MATCHER = {
  anyOf: expect.arrayContaining([
    expect.objectContaining({ type: 'boolean' }),
    expect.objectContaining({ type: 'string' }),
    expect.objectContaining({ type: 'number' }),
    expect.objectContaining({ type: 'integer' }),
    expect.objectContaining({ type: 'object' }),
    expect.objectContaining({ type: 'array' }),
  ]),
}

describe('OAS 3.0 features not supported in OAS 3.1', () => {
  it('ignores nullable for schemas in 3.1', () => {
    const result = defaultNormalize(ignoresNullableForSchemasIn31)

    expect(result).not.toHaveProperty([...schemaPath, 'type', JSON_SCHEMA_PROPERTY_NULLABLE])
  })
})

describe('OAS 3.1 Type validations: array of types', () => {
  it('array of type must contain one of primitive types or integer', () => {
    const result = defaultNormalize(arrayOfTypeContainOneOfPrimitiveTypes31)

    expect(result).toHaveProperty([...schemaPath, 'type'], 'string')
  })

  it('ignores non-existing type null in array of types', () => {
    const result = defaultNormalize(nonExistingTypeNullInArrayOfTypes31)

    expect(result).toHaveProperty([...schemaPath, 'type'], 'string')
  })

  it('types in array are unique', () => {
    const result = defaultNormalize(typesInArrayAreUnique)

    expect(result).toHaveProperty([...schemaPath, 'type'], 'string')
  })
})

describe('OAS 3.1 features not supported in OAS 3.0', () => {
  it('does not support array of types', () => {
    const result = defaultNormalize(arrayOfTypes30)

    expect(result).toHaveProperty([...schemaPath], NOT_ANY_MATCHER)
  })

  it('does not support "null" type', () => {
    const result = defaultNormalize(typeNull30)

    expect(result).toHaveProperty([...schemaPath], NOT_ANY_MATCHER)
  })
})
