import { normalize, NormalizeOptions } from '../../src'
import openapiWithExtensions from '../resources/openapi-with-extensions.json'
import openapiWithoutExtensions from '../resources/openapi-without-extensions.json'

const DEFAULT_OPTIONS: NormalizeOptions = {
  resolveRef: false,
  mergeAllOf: false,
  removeOasExtensions: true,
  shouldRemoveOasExtension: () => true,
}

describe('remove OAS extensions', () => {
  it('removes OAS extensions', () => {
    const normalizedSchema = normalize(openapiWithExtensions, DEFAULT_OPTIONS)
    expect(normalizedSchema).toEqual(openapiWithoutExtensions)
  })
})
