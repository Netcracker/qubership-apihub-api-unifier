import { normalize } from '../../src'
import pathItemsOas30 from '../resources/pathitems/pathItems-oas-30.json'
import pathItemsOas31 from '../resources/pathitems/pathItems-oas-31.json'

const OPTIONS = { resolveRef: true, validate: true }
describe('OAS 3.1 Path Item Object', () => {
  it('validation must pass for the Item Object in components', () => {
    const result = normalize(pathItemsOas31, OPTIONS) as any

    expect(result.components.pathItems.componentsPathItem).not.toEqual({})
  })

  it('could define Path Item Object via ref', () => {
    const result = normalize(pathItemsOas31, OPTIONS) as any

    expect(result.paths['/path1'].post).toBe(result.components.pathItems.componentsPathItem.post)
  })
})

describe('OAS 3.0 Path Item Object', () => {
  it('validation must not pass for the Item Object in components', () => {
    const result = normalize(pathItemsOas30, OPTIONS) as any

    expect(result.components).toEqual({})
  })

  // Validation should not allow the ref to be resolved from components
  it.skip('could not be resolved pathItem from components via reference object', () => {
    const result = normalize(pathItemsOas30, OPTIONS) as any

    const expectedResult = {
      '/path1': {
        '$ref': '#/components/pathItems/componentsPathItem',
      },
    }

    expect(result.paths['/path1'].post).not.toBe(result.components.pathItems.componentsPathItem.post)
    expect(result.paths).toEqual(expectedResult)
  })
})