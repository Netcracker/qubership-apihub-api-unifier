import {
  normalize,
  OPEN_API_PROPERTY_DESCRIPTION,
  OPEN_API_PROPERTY_SUMMARY,
  RefErrorType,
  RefErrorTypes,
} from '../../src'
import 'jest-extended'
import { defineOriginsAndResolveRef } from '../../src/define-origins-and-resolve-ref'
import { JsonPath } from '@netcracker/qubership-apihub-json-crawl'
import { TEST_ORIGINS_FLAG } from '../helpers'
import defineResponseViaReferenceObjectChain
  from '../resources/reference-object/define-response-via-reference-object-chain.json'
import secondLevelObjectSameWhenOverridingDescriptionForResponse
  from '../resources/reference-object/second-level-object-are-the-same-when-overriding-for-response.json'
import notHangUpWhenProcessingCycledChainOfForResponse
  from '../resources/reference-object/not-hang-up-when-processing-cycled-chain-for-response.json'
import notHangUpWhenProcessingResponseWhichPointsToItself
  from '../resources/reference-object/not-hang-up-when-processing-for-response-which-points-to-itself.json'

const OPTIONS = { resolveRef: true }

describe('OAS 3.1 Reference object', () => {

  describe('Reference object general behaviour', () => {
    it('second-level object are the same when overriding description for response via reference object', () => {

      const result = defineOriginsAndResolveRef(secondLevelObjectSameWhenOverridingDescriptionForResponse) as any
      expect(result.paths['/test'].get.responses['200'].content).toBe(result.components.responses.SuccessResponse.content)
    })

    it('reference object pointing to non-existing component is ignored for the response', (done) => {
      const onRefResolveError = (message: string, path: JsonPath, ref: string, errorType: RefErrorType) => {
        expect(ref).toBe('#/components/requests/SuccessRequest')
        expect(errorType).toBe(RefErrorTypes.REF_NOT_FOUND)
        done()
      }

      const source = {
        openapi: '3.1.0',
        paths: {
          '/test': {
            get: {
              responses: {
                '200': {
                  $ref: '#/components/requests/SuccessRequest',
                },
              },
            },
          },
        },
      }

      const result = defineOriginsAndResolveRef(source, { onRefResolveError }) as any
      expect(result).toEqual(source)
    })

    it('could define response via reference object chain', () => {
      const result = defineOriginsAndResolveRef(defineResponseViaReferenceObjectChain) as any
      expect(result.paths['/test'].get.responses['200']).toBe(result.components.responses.SuccessResponse2)
    })

    it('should not hang up when processing reference object for response which points to itself', (done) => {
      const onRefResolveError = (message: string, path: JsonPath, ref: string, errorType: RefErrorType) => {
        expect(ref).toBe('#/components/responses/SuccessResponse')
        expect(errorType).toBe(RefErrorTypes.REF_NOT_FOUND)
        done()
      }

      const result = defineOriginsAndResolveRef(notHangUpWhenProcessingResponseWhichPointsToItself, { onRefResolveError }) as any
      expect(result.paths['/test'].get.responses['200'].$ref).toBe('#/components/responses/SuccessResponse')
    })

    it('should not hang up when processing cycled chain of reference objects for response', () => {
      let errorCount = 0
      const result = defineOriginsAndResolveRef(notHangUpWhenProcessingCycledChainOfForResponse, { onRefResolveError: () => errorCount++ }) as any
      expect(errorCount).toBe(2)
      expect(result.paths['/test'].get.responses['200'].$ref).toBe('#/components/responses/SuccessResponse')
    })
  })

  describe('Reference object rules', () => {
    const DESCRIPTION_OVERRIDEN = 'overriden description'
    const SUMMARY_OVERRIDEN = 'overriden summary'
    const DESCRIPTION_BASE = 'base description'
    const SUMMARY_BASE = 'base summary'

    const postPath: JsonPath = ['paths', '/somePath', 'post']
    const responsesPath: JsonPath = [...postPath, 'responses', '200']
    const parametersPath: JsonPath = [...postPath, 'parameters', 0]
    const headersPath: JsonPath = [...responsesPath, 'headers', 'X-Rate-Limit']

    const referenceObjectWithDescriptionOverride: JsonPath[][] = [
      [
        responsesPath,
        ['components', 'responses', 'data']
      ],
      [
        parametersPath,
        ['components', 'parameters', 'data']
      ],
      [
        headersPath,
        ['components', 'headers', 'data']
      ],
      [
        [...responsesPath, 'links', 'someLink'],
        ['components', 'links', 'data']
      ],
    ]

    const componentsExamplesPath: JsonPath = ['components', 'examples', 'data']
    const referenceObjectWithDescriptionAndSummaryOverride: JsonPath[][] = [
      [
        [...postPath, 'requestBody', 'content', 'application/json', 'examples', 'ex1'],
        componentsExamplesPath,
      ],
      [
        [...responsesPath, 'content', 'application/json', 'schema', 'properties', 'prop1', 'examples', 0],
        componentsExamplesPath,
      ],
      [
        [...parametersPath, 'examples', 'ex1'],
        componentsExamplesPath,
      ],
      [
        [...headersPath, 'examples', 'ex1'],
        componentsExamplesPath,
      ],
      [
        ['components', 'requestBodies', 'ExampleBody', 'content', 'application/json', 'examples', 'ex1'],
        componentsExamplesPath
      ],
      [
        // pathItems
        ['paths', '/users'],
        ['components', 'pathItems', 'UserPath'],
      ],
    ]

    const clone = (obj: any): any => JSON.parse(JSON.stringify(obj))

    function setValueAtPath(obj: any, path: JsonPath, value: any): void {
      if (path.length === 0) {return}

      let current = obj
      for (let i = 0; i < path.length - 1; i++) {
        const key = path[i]
        const nextKey = path[i + 1]
        if (!(key in current)) {
          current[key] = typeof nextKey === 'number' ? [] : {}
        }
        current = current[key]
      }
      if (value !== undefined) {
        current[path[path.length - 1]] = value
      }
    }

    const getValueByPath = (value: any, path: JsonPath) => path.reduce((data, key) => data[key], value)

    const createBase = (version: string, path: JsonPath, components: JsonPath) => {
      const ref = `#/${components.join('/')}`
      const base = { openapi: version }
      setValueAtPath(base, path, { $ref: ref })
      return base
    }

    const runReferenceObjectRulesTests = (paths: JsonPath[][], overrides: string[] = []): void => {
      paths.forEach((paths: JsonPath[]) => {
        const allowDescriptionOverride = overrides.includes(OPEN_API_PROPERTY_DESCRIPTION)
        const allowSummaryOverride = overrides.includes(OPEN_API_PROPERTY_SUMMARY)

        const refPath = paths[0]
        const componentsPath = paths[1]

        const title = refPath.at(-2) as string
        const pathDescription = refPath.length > 0 ? refPath.join('.') : '[]'

        describe(`Rules for ${title}`, () => {
          describe(`Path: ${pathDescription}`, () => {
            let base30: any
            let base31: any

            beforeEach(() => {
              base30 = createBase('3.0.0', refPath, componentsPath)
              base31 = createBase('3.1.0', refPath, componentsPath)
            })

            it(`could define data via reference object`, () => {
              setValueAtPath(base31, [...componentsPath, OPEN_API_PROPERTY_DESCRIPTION], DESCRIPTION_BASE)

              const result = normalize(base31, OPTIONS) as any

              const pathContent = getValueByPath(result, refPath)
              const componentsContent = getValueByPath(result, componentsPath)
              expect(pathContent).toBe(componentsContent)
            })

            it(`could ${allowDescriptionOverride ? '' : 'not '}override description via reference object`, () => {
              setValueAtPath(base31, [...componentsPath, OPEN_API_PROPERTY_DESCRIPTION], DESCRIPTION_BASE)
              setValueAtPath(base31, [...refPath, OPEN_API_PROPERTY_DESCRIPTION], DESCRIPTION_OVERRIDEN)

              const result = normalize(base31, OPTIONS) as any

              const expectation = expect(result)

              expectation.toHaveProperty([...componentsPath, OPEN_API_PROPERTY_DESCRIPTION], DESCRIPTION_BASE)
              allowDescriptionOverride
                ? expectation.toHaveProperty([...refPath, OPEN_API_PROPERTY_DESCRIPTION], DESCRIPTION_OVERRIDEN)
                : expectation.not.toHaveProperty([...refPath, OPEN_API_PROPERTY_DESCRIPTION])
            })

            it(`could ${allowSummaryOverride ? '' : 'not '}override summary via reference object`, () => {
              const source = clone(base31)
              setValueAtPath(source, [...refPath, OPEN_API_PROPERTY_SUMMARY], SUMMARY_OVERRIDEN)
              setValueAtPath(source, componentsPath, {})

              const result = normalize(source, OPTIONS) as any

              const expectation = expect(result)
              allowSummaryOverride
                ? expectation.toHaveProperty([...refPath, OPEN_API_PROPERTY_SUMMARY])
                : expectation.not.toHaveProperty([...refPath, OPEN_API_PROPERTY_SUMMARY])
            })

            it(`properties other than description and summary could not be overriden via reference object`, () => {
              const content = {
                schema: {
                  type: 'object',
                },
              }

              setValueAtPath(base31, [...componentsPath, 'content'], {
                'application/xml': content,
              })
              setValueAtPath(base31, [...refPath, 'content'], {
                'application/json': content,
              })

              setValueAtPath(base31, [...refPath, OPEN_API_PROPERTY_SUMMARY], SUMMARY_OVERRIDEN)
              setValueAtPath(base31, [...refPath, OPEN_API_PROPERTY_DESCRIPTION], DESCRIPTION_OVERRIDEN)

              const result = normalize(base31, OPTIONS) as any

              const pathContent = getValueByPath(result, [...refPath, 'content'])
              const componentsContent = getValueByPath(result, [...componentsPath, 'content'])
              expect(pathContent).toBe(componentsContent)
            })

            it(`could not override description or summary via reference object in OAS 3.0`, () => {

              setValueAtPath(base30, [...componentsPath, OPEN_API_PROPERTY_DESCRIPTION], DESCRIPTION_BASE)
              setValueAtPath(base30, [...componentsPath, OPEN_API_PROPERTY_SUMMARY], SUMMARY_BASE)
              setValueAtPath(base30, [...refPath, OPEN_API_PROPERTY_DESCRIPTION], DESCRIPTION_OVERRIDEN)
              setValueAtPath(base30, [...refPath, OPEN_API_PROPERTY_SUMMARY], SUMMARY_OVERRIDEN)

              const result = normalize(base30, OPTIONS) as any
              expect(result).toHaveProperty([...refPath, OPEN_API_PROPERTY_DESCRIPTION], DESCRIPTION_BASE)
              expect(result).toHaveProperty([...refPath, OPEN_API_PROPERTY_SUMMARY], SUMMARY_BASE)
            })
          })
        })
      })
    }

    runReferenceObjectRulesTests(referenceObjectWithDescriptionOverride, [OPEN_API_PROPERTY_DESCRIPTION])
    runReferenceObjectRulesTests(referenceObjectWithDescriptionAndSummaryOverride,
      [OPEN_API_PROPERTY_DESCRIPTION, OPEN_API_PROPERTY_SUMMARY],
    )
  })

  describe('OAS 3.1. Reference Object. Validate origins', () => {
    it('origin is calculated correctly for field overriden using reference object', () => {
      const source = {
        openapi: '3.1.0',
        paths: {
          '/test': {
            get: {
              responses: {
                '200': {
                  $ref: '#/components/responses/SuccessResponse',
                  description: 'Overriden description',
                },
              },
            },
          },
        },
      }

      const components = {
        components: {
          responses: {
            SuccessResponse: {
              description: 'Successful response',
              type: 'object',
            },
          },
        },
      }

      const componentsOrigins = {
        components: [{ parent: undefined, value: 'components' }],
        responses: [{ parent: undefined as any, value: 'responses' }],
        SuccessResponse: [{ parent: undefined as any, value: 'SuccessResponse' }],
        description: [{ parent: undefined as any, value: 'description' }],
        type: [{ parent: undefined as any, value: 'type' }],
      }
      componentsOrigins.responses[0].parent = componentsOrigins.components[0]
      componentsOrigins.SuccessResponse[0].parent = componentsOrigins.responses[0]
      componentsOrigins.description[0].parent = componentsOrigins.SuccessResponse[0]
      componentsOrigins.type[0].parent = componentsOrigins.SuccessResponse[0]

      const expected = {
        openapi: '3.1.0',
        paths: {
          '/test': {
            get: {
              responses: {
                '200': {
                  description: 'Overriden description',
                  type: 'object',
                  [TEST_ORIGINS_FLAG]: {
                    description: [{ parent: undefined as any, value: '200' }],
                    type: [{ parent: undefined as any, value: 'type' }],
                  },
                },
                [TEST_ORIGINS_FLAG]: {
                  '200': [{ parent: undefined as any, value: '200' }],
                },
              },
              [TEST_ORIGINS_FLAG]: {
                responses: [{ parent: undefined as any, value: 'responses' }],
              },
            } as any,
            [TEST_ORIGINS_FLAG]: {
              get: [{ parent: undefined as any, value: 'get' }],
            },
          },
          [TEST_ORIGINS_FLAG]: {
            '/test': [{ parent: undefined as any, value: '/test' }],
          },
        },
        [TEST_ORIGINS_FLAG]: {
          openapi: [{ parent: undefined as any, value: 'openapi' }],
          paths: [{ parent: undefined as any, value: 'paths' }],
        },
      }

      expected.paths[TEST_ORIGINS_FLAG]['/test'][0].parent = expected[TEST_ORIGINS_FLAG].paths[0]
      expected.paths['/test'][TEST_ORIGINS_FLAG].get[0].parent = expected.paths[TEST_ORIGINS_FLAG]['/test'][0]
      expected.paths['/test'].get[TEST_ORIGINS_FLAG].responses[0].parent = expected.paths['/test'][TEST_ORIGINS_FLAG].get[0]
      expected.paths['/test'].get.responses[TEST_ORIGINS_FLAG]['200'][0].parent = expected.paths['/test'].get[TEST_ORIGINS_FLAG].responses[0]
      // type parent from components
      expected.paths['/test'].get.responses['200'][TEST_ORIGINS_FLAG].type[0].parent = componentsOrigins.SuccessResponse[0]
      // description parent from responses
      expected.paths['/test'].get.responses['200'][TEST_ORIGINS_FLAG].description[0].parent = expected.paths['/test'].get[TEST_ORIGINS_FLAG].responses[0]

      const result = defineOriginsAndResolveRef(source, { originsFlag: TEST_ORIGINS_FLAG, source: components })
      expect(result).toEqual(expected)
    })
  })
})