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

    function clone(obj: any): any {
      return JSON.parse(JSON.stringify(obj))
    }

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

    const getValueByPatch = (value: any, path: JsonPath) => {
      return path.reduce((data, key) => data[key], value)
    }

    const createBase = (version: string, path: JsonPath, components: JsonPath) => {
      const ref = `#/${components.join('/')}`
      const base = { openapi: version }
      setValueAtPath(base, path, { $ref: ref })
      return base
    }

    const postPath = ['paths', '/somePath', 'post']
    const responsesPath = [...postPath, 'responses', '200']
    const referenceObjectRulesData = [
      {
        title: 'responses',
        overrides: [OPEN_API_PROPERTY_DESCRIPTION],
        path: responsesPath,
        components: ['components', 'responses', 'someResponse'],
      },
      {
        title: 'parameters',
        overrides: [OPEN_API_PROPERTY_DESCRIPTION],
        path: [...postPath, 'parameters', 0],
        components: ['components', 'parameters', 'status'],
      },
      {
        title: 'examples',
        overrides: [OPEN_API_PROPERTY_DESCRIPTION, OPEN_API_PROPERTY_SUMMARY],
        path: [...responsesPath, 'content', 'application/json', 'schema', 'properties', 'prop1', 'examples', 0],
        components: ['components', 'examples', 'ex1'],
      },
      {
        title: 'requestBodies',
        overrides: [OPEN_API_PROPERTY_DESCRIPTION],
        path: [...postPath, 'requestBody'],
        components: ['components', 'requestBody', 'someRequestBody'],
      },
      {
        title: 'headers',
        overrides: [OPEN_API_PROPERTY_DESCRIPTION],
        path: [...responsesPath, 'headers', 'X-Rate-Limit'],
        components: ['components', 'headers', 'X-Rate-Limit'],
      },
      {
        title: 'links',
        overrides: [OPEN_API_PROPERTY_DESCRIPTION],
        path: [...responsesPath, 'links', 'someLink'],
        components: ['components', 'links', 'someLink'],
      }
    ]

    referenceObjectRulesData.forEach(({ title, overrides, path, components }) => {
      describe(`Rules for ${title}`, () => {
        const base30 = createBase('3.0.0', path, components)
        const base31 = createBase('3.1.0', path, components)

        const descriptionOverride = overrides.includes(OPEN_API_PROPERTY_DESCRIPTION)
        const summaryOverride = overrides.includes(OPEN_API_PROPERTY_SUMMARY)

        it(`could define ${title} via reference object`, () => {
          const source = clone(base31)
          setValueAtPath(source, [...components, OPEN_API_PROPERTY_DESCRIPTION], DESCRIPTION_BASE)

          const result = normalize(source, OPTIONS) as any

          const pathContent = getValueByPatch(result, path)
          const componentsContent = getValueByPatch(result, components)
          expect(pathContent).toBe(componentsContent)
        })

        it(`could ${descriptionOverride ? '' : 'not '}override description for ${title} via reference object`, () => {
          const source = clone(base31)
          setValueAtPath(source, [...components, OPEN_API_PROPERTY_DESCRIPTION], DESCRIPTION_BASE)
          setValueAtPath(source, [...path, OPEN_API_PROPERTY_DESCRIPTION], DESCRIPTION_OVERRIDEN)

          const result = normalize(source, OPTIONS) as any

          const expectation = expect(result);
          expectation.toHaveProperty([...components, OPEN_API_PROPERTY_DESCRIPTION], DESCRIPTION_BASE)

          if (descriptionOverride) {
            expectation.toHaveProperty([...path, OPEN_API_PROPERTY_DESCRIPTION], DESCRIPTION_OVERRIDEN)
          } else {
            expectation.not.toHaveProperty([...path, OPEN_API_PROPERTY_DESCRIPTION]);
          }
        })

        it(`could ${summaryOverride ? '' : 'not '}override summary for the ${title} via reference object`, () => {
          const source = clone(base31)
          setValueAtPath(source, [...path, OPEN_API_PROPERTY_SUMMARY], SUMMARY_OVERRIDEN)
          setValueAtPath(source, components, {})

          const result = normalize(source, OPTIONS) as any

          const expectation = expect(result);
          if (summaryOverride) {
            expectation.toHaveProperty([...path, OPEN_API_PROPERTY_SUMMARY])
          } else {
            expectation.not.toHaveProperty([...path, OPEN_API_PROPERTY_SUMMARY])
          }
        })

        it(`properties other than description and summary could not be overriden via reference object for ${title}`, () => {
          const source = clone(base31)
          const content = {
            schema: {
              type: 'object',
            },
          }

          setValueAtPath(source, [...components, 'content'], {
            'application/xml': content
          })
          setValueAtPath(source, [...path, 'content'], {
            'application/json': content
          })

          setValueAtPath(source, [...path, OPEN_API_PROPERTY_SUMMARY], SUMMARY_OVERRIDEN)
          setValueAtPath(source, [...path, OPEN_API_PROPERTY_DESCRIPTION], DESCRIPTION_OVERRIDEN)

          const result = normalize(source, OPTIONS) as any
          const pathContent = getValueByPatch(result, [...path, 'content'])
          const componentsContent = getValueByPatch(result, [...components, 'content'])
          expect(pathContent).toBe(componentsContent)
        })

        it(`could not override description or summary for ${title} via reference object in OAS 3.0`, () => {
          const source = clone(base30)

          setValueAtPath(source, [...components, OPEN_API_PROPERTY_DESCRIPTION], DESCRIPTION_BASE)
          setValueAtPath(source, [...components, OPEN_API_PROPERTY_SUMMARY], SUMMARY_BASE)
          setValueAtPath(source, [...path, OPEN_API_PROPERTY_DESCRIPTION], DESCRIPTION_OVERRIDEN)
          setValueAtPath(source, [...path, OPEN_API_PROPERTY_SUMMARY], SUMMARY_OVERRIDEN)

          const result = normalize(source, OPTIONS) as any
          expect(result).toHaveProperty([...path, OPEN_API_PROPERTY_DESCRIPTION], DESCRIPTION_BASE)
          expect(result).toHaveProperty([...path, OPEN_API_PROPERTY_SUMMARY], SUMMARY_BASE)
        })
      })
    })
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