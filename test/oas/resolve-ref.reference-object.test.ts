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
import { ReferenceObjectResolverOverrideField } from '../../src/references/ref-resolver'

const OPTIONS = { resolveRef: true }

describe('OAS Reference object', () => {

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
    const VALUE_OVERRIDEN = 'overriden value'
    const VALUE_BASE = 'base value'
    const VALUE_SECOND = 'second value'
    const APPLICATION_JSON = 'application/json'

    type DataValue = Record<string, any> | string
    type AdditionalValuePair = [DataValue, DataValue]

    /** An additional values to add next to the Ref fields. This values should not be overridden. */
    interface AdditionalValue {
      path: JsonPath
      values: AdditionalValuePair
    }

    interface ReferenceObjectRuleTestData {
      refPaths: JsonPath[]
      componentsPath: JsonPath
      overridableFields: ReferenceObjectResolverOverrideField[]
      /**
       * Additional values that can be added to the object, including both simple key-value pairs
       * and more complex structures.
       *
       * Example of a simple case:
       * - 'name': 'someName'
       *
       * Example of a more complex case:
       * - 'content': {'application/xml': ... }
       *
       * This array allows values to be added at a specified path
       */
      additionalValues: AdditionalValue[]
    }

    const objectSchemaType = {
      type: 'object',
    }

    const integerSchemaType = {
      type: 'integer',
    }

    const schemaObjectContent = {
      schema: objectSchemaType,
    }

    const applicationXmlContent = {
      'application/xml': schemaObjectContent,
    }

    const applicationJsonContent = {
      APPLICATION_JSON: schemaObjectContent,
    }

    const nameValuePair: AdditionalValue = {
      path: ['name'],
      values: [
        'someName',
        'overridedName',
      ],
    }

    const operationIdValuePair: AdditionalValue = {
      path: ['operationId'],
      values: [
        'getUserAddress',
        'getUserAddressByUUID',
      ],
    }

    const schemaValuePair: AdditionalValue = {
      path: ['schema'],
      values: [
        objectSchemaType,
        integerSchemaType,
      ],
    }

    const contentValuePair: AdditionalValue = {
      path: ['content'],
      values: [
        applicationXmlContent,
        applicationJsonContent,
      ],
    }

    const parametersValuePair: AdditionalValue = {
      path: ['parameters'],
      values: [
        {
          username: '$response.body#/username1',
        },
        {
          username: '$response.body#/username2',
        },
      ],
    }

    const customValuePair: AdditionalValue = {
      path: ['value'],
      values: [
        { 'bar': 'baz' },
        { 'foo': 'bar' },
      ],
    }

    const externalValuePair: AdditionalValue = {
      path: ['externalValue'],
      values: [
        'https://example.com/username.json',
        'https://example.com/username2.json',
      ],
    }

    const responseObjectPaths: JsonPath[] = [
      ['components', 'responses', 'someResponse'],
      ['paths', '/somePath', 'get', 'responses', '200'],
    ]

    const requestBodyObjectPaths: JsonPath[] = [
      ['paths', '/somePath', 'get', 'requestBody'],
      ['components', 'requestBodies', 'someRequestBody'],
    ]

    const parameterObjectPaths: JsonPath[] = [
      ['components', 'parameters', 'someParameter'],
      ['paths', '/somePath', 'parameters', 0],
      ['paths', '/somePath', 'get', 'parameters', 0],
    ]

    const contentEncodingHeaderSuffix = ['content', APPLICATION_JSON, 'encoding', 'someProperty', 'headers', 'someHeader']

    const headerObjectPaths: JsonPath[] = [
      ['components', 'headers', 'someHeader'],
      ['components', 'responses', 'someResponse', 'headers', 'someHeader'],
      ['paths', '/somePath', 'get', 'responses', '200', 'headers', 'someHeader'],
      ...parameterObjectPaths.map(path => [...path, ...contentEncodingHeaderSuffix]),
      ...requestBodyObjectPaths.map(path => [...path, ...contentEncodingHeaderSuffix]),
      ...responseObjectPaths.map(path => [...path, ...contentEncodingHeaderSuffix]),
    ]

    const headerObjectPathsWithRecursionFirstLevel: JsonPath[] = [
      ...headerObjectPaths,
      ...headerObjectPaths.map(path => [...path, ...contentEncodingHeaderSuffix]),
    ]

    const mediaTypeObjectPaths: JsonPath[] = [
      ...parameterObjectPaths.map(path => [...path, 'content', APPLICATION_JSON]),
      ...headerObjectPathsWithRecursionFirstLevel.map(path => [...path, 'content', APPLICATION_JSON]),
      ...requestBodyObjectPaths.map(path => [...path, 'content', APPLICATION_JSON]),
      ...responseObjectPaths.map(path => [...path, 'content', APPLICATION_JSON]),
    ]

    const linkObjectPaths: JsonPath[] = [
      // Link Object unification rules are not implemented yet
      //['components', 'links', 'someLink'],
      //...responseObjectPaths.map(path => [...path, 'links', 'someLink']),
    ]

    const callbackObjectPaths: JsonPath[] = [
      // Callback Object unification rules are not implemented yet
      //['components', 'callbacks', 'someCallback'],
      //...operationObjectPaths.map(path => [...path, 'callbacks', 'someCallback']),
    ]

    const pathItemObjectPaths: JsonPath[] = [
      ['paths', '/somePath'],
      ...callbackObjectPaths.map(path => [...path, 'someExpression']),
      // ['components', 'pathItems', 'somePathItem'], // support path items in components for OAS 3.1
    ]

    const securitySchemeObjectPaths: JsonPath[] = [
      ['components', 'securitySchemes', 'oauth2'],
    ]

    const exampleObjectPaths: JsonPath[] = [
      ['components', 'examples', 'someExample'],
      ...parameterObjectPaths.map(path => [...path, 'examples', 'someExample']),
      ...headerObjectPathsWithRecursionFirstLevel.map(path => [...path, 'examples', 'someExample']),
      ...mediaTypeObjectPaths.map(path => [...path, 'examples', 'someExample']),
    ]

    const parameterObject: ReferenceObjectRuleTestData = {
      refPaths: parameterObjectPaths,
      componentsPath: ['components', 'parameters', 'componentsParameter'],
      overridableFields: [OPEN_API_PROPERTY_DESCRIPTION],
      additionalValues: [
        nameValuePair,
        schemaValuePair,
      ],
    }

    const requestBodyObject: ReferenceObjectRuleTestData = {
      refPaths: requestBodyObjectPaths,
      componentsPath: ['components', 'requestBodies', 'componentsRequestBody'],
      overridableFields: [OPEN_API_PROPERTY_DESCRIPTION],
      additionalValues: [contentValuePair],
    }

    const responseObject: ReferenceObjectRuleTestData = {
      refPaths: responseObjectPaths,
      componentsPath: ['components', 'responses', 'componentsResponse'],
      overridableFields: [OPEN_API_PROPERTY_DESCRIPTION],
      additionalValues: [contentValuePair],
    }

    const headerObject: ReferenceObjectRuleTestData = {
      refPaths: headerObjectPaths,
      componentsPath: ['components', 'headers', 'componentsHeader'],
      overridableFields: [OPEN_API_PROPERTY_DESCRIPTION],
      additionalValues: [schemaValuePair],
    }

    const linkObject: ReferenceObjectRuleTestData = {
      refPaths: linkObjectPaths,
      componentsPath: ['components', 'links', 'componentsLink'],
      overridableFields: [OPEN_API_PROPERTY_DESCRIPTION],
      additionalValues: [parametersValuePair, operationIdValuePair],
    }

    const securitySchemeObject: ReferenceObjectRuleTestData = {
      refPaths: securitySchemeObjectPaths,
      componentsPath: ['components', 'securitySchemes', 'componentsOauth2'],
      overridableFields: [OPEN_API_PROPERTY_DESCRIPTION],
      additionalValues: [nameValuePair],
    }

    const callbackObject: ReferenceObjectRuleTestData = {
      refPaths: callbackObjectPaths,
      componentsPath: ['components', 'callbacks', 'componentsCallback'],
      overridableFields: [OPEN_API_PROPERTY_DESCRIPTION],
      additionalValues: [parametersValuePair],
    }

    const pathItemObject: ReferenceObjectRuleTestData = {
      refPaths: pathItemObjectPaths,
      componentsPath: ['components', 'pathItems', 'componentsPathItem'],
      overridableFields: [OPEN_API_PROPERTY_DESCRIPTION, OPEN_API_PROPERTY_SUMMARY],
      additionalValues: [parametersValuePair],
    }

    const mediaTypeObject: JsonPath[] = [
      ...responseObject.refPaths.map(path => [...path, 'content', APPLICATION_JSON]),
      ...parameterObject.refPaths.map(path => [...path, 'content', APPLICATION_JSON]),
      ...requestBodyObject.refPaths.map(path => [...path, 'content', APPLICATION_JSON]),
      ...headerObject.refPaths.map(path => [...path, 'content', APPLICATION_JSON]),
    ]

    const exampleObject: ReferenceObjectRuleTestData = {
      refPaths: exampleObjectPaths,
      componentsPath: ['components', 'examples', 'componentsExample'],
      overridableFields: [OPEN_API_PROPERTY_DESCRIPTION, OPEN_API_PROPERTY_SUMMARY],
      additionalValues: [customValuePair, externalValuePair],
    }

    const referenceObjectPathsTestData: ReferenceObjectRuleTestData[] = [
      parameterObject,
      requestBodyObject,
      headerObject,
      linkObject,
      securitySchemeObject,
      // callbackObject,
      // pathItemObject,
      exampleObject,
    ]

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

    const createRef = (path: JsonPath) => `#/${path.join('/')}`

    const createBase = (version: string, path: JsonPath, components: JsonPath) => {
      const base = { openapi: version }
      setValueAtPath(base, path, { $ref: createRef(components) })
      return base
    }

    const checkCyclicReferenceObjects = (title: string, base31: any, refPath: JsonPath, componentsPath: JsonPath, value: ReferenceObjectResolverOverrideField, allowOverride: boolean) => {
      const name = `secondLevel${title}`
      const secondLevelRefPath = [...componentsPath.slice(0, componentsPath.length - 1), name]
      const secondLevelRef = createRef(secondLevelRefPath)
      setValueAtPath(base31, componentsPath, { $ref: secondLevelRef })
      setValueAtPath(base31, [...secondLevelRefPath, value], VALUE_BASE)
      setValueAtPath(base31, [...componentsPath, value], VALUE_SECOND)
      setValueAtPath(base31, [...refPath, value], VALUE_OVERRIDEN)

      const result = normalize(base31, OPTIONS) as any

      const expectation = expect(result)

      expectation.toHaveProperty([...secondLevelRefPath, value], VALUE_BASE)
      if (allowOverride) {
        expectation.toHaveProperty([...componentsPath, value], VALUE_SECOND)
        expectation.toHaveProperty([...refPath, value], VALUE_OVERRIDEN)
      } else {
        expectation.toHaveProperty([...componentsPath, value], VALUE_BASE)
        expectation.toHaveProperty([...refPath, value], VALUE_BASE)
      }
    }

    referenceObjectPathsTestData.forEach(({ refPaths, componentsPath, overridableFields, additionalValues }) => {
      const allowDescriptionOverride = overridableFields.includes(OPEN_API_PROPERTY_DESCRIPTION)
      const allowSummaryOverride = overridableFields.includes(OPEN_API_PROPERTY_SUMMARY)
      refPaths.forEach(refPath => {
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
              setValueAtPath(base31, [...componentsPath, OPEN_API_PROPERTY_DESCRIPTION], VALUE_BASE)

              const result = normalize(base31, OPTIONS) as any

              const refContent = getValueByPath(result, refPath)
              const componentsContent = getValueByPath(result, componentsPath)
              expect(refContent).toBe(componentsContent)
            })

            it(`could ${allowDescriptionOverride ? '' : 'not '}override description via reference object`, () => {
              setValueAtPath(base31, [...componentsPath, OPEN_API_PROPERTY_DESCRIPTION], VALUE_BASE)
              setValueAtPath(base31, [...refPath, OPEN_API_PROPERTY_DESCRIPTION], VALUE_OVERRIDEN)

              const result = normalize(base31, OPTIONS) as any

              const expectation = expect(result)

              expectation.toHaveProperty([...componentsPath, OPEN_API_PROPERTY_DESCRIPTION], VALUE_BASE)
              allowDescriptionOverride
                ? expectation.toHaveProperty([...refPath, OPEN_API_PROPERTY_DESCRIPTION], VALUE_OVERRIDEN)
                : expectation.not.toHaveProperty([...refPath, OPEN_API_PROPERTY_DESCRIPTION])
            })

            it(`could ${allowSummaryOverride ? '' : 'not '}override summary via reference object`, () => {
              setValueAtPath(base31, [...refPath, OPEN_API_PROPERTY_SUMMARY], VALUE_OVERRIDEN)
              setValueAtPath(base31, componentsPath, {})

              const result = normalize(base31, OPTIONS) as any

              const expectation = expect(result)
              allowSummaryOverride
                ? expectation.toHaveProperty([...refPath, OPEN_API_PROPERTY_SUMMARY])
                : expectation.not.toHaveProperty([...refPath, OPEN_API_PROPERTY_SUMMARY])
            })

            it(`could ${allowDescriptionOverride ? '' : 'not '}override description via cyclic reference objects`, () => {
              checkCyclicReferenceObjects(title, base31, refPath, componentsPath, OPEN_API_PROPERTY_DESCRIPTION, allowDescriptionOverride)
            })

            it(`could ${allowSummaryOverride ? '' : 'not '}override summary via cyclic reference objects`, () => {
              checkCyclicReferenceObjects(title, base31, refPath, componentsPath, OPEN_API_PROPERTY_SUMMARY, allowSummaryOverride)
            })

            it(`properties other than description and summary could not be overriden via reference object`, () => {
              additionalValues.forEach(additionalData => {
                const path = additionalData.path
                const values = additionalData.values

                setValueAtPath(base31, [...componentsPath, ...path], values[0])
                setValueAtPath(base31, [...refPath, ...path], values[1])
              })

              setValueAtPath(base31, [...refPath, OPEN_API_PROPERTY_SUMMARY], VALUE_OVERRIDEN)
              setValueAtPath(base31, [...refPath, OPEN_API_PROPERTY_DESCRIPTION], VALUE_OVERRIDEN)

              const result = normalize(base31, OPTIONS) as any

              additionalValues.forEach(additionalData => {
                const path = additionalData.path

                const refContent = getValueByPath(result, [...refPath, ...path])
                const componentsContent = getValueByPath(result, [...componentsPath, ...path])
                expect(refContent).toBe(componentsContent)
              })
            })

            it(`could not override description or summary via reference object in OAS 3.0`, () => {
              setValueAtPath(base30, [...componentsPath, OPEN_API_PROPERTY_DESCRIPTION], VALUE_BASE)
              setValueAtPath(base30, [...componentsPath, OPEN_API_PROPERTY_SUMMARY], VALUE_BASE)
              setValueAtPath(base30, [...refPath, OPEN_API_PROPERTY_DESCRIPTION], VALUE_OVERRIDEN)
              setValueAtPath(base30, [...refPath, OPEN_API_PROPERTY_SUMMARY], VALUE_OVERRIDEN)

              const result = normalize(base30, OPTIONS) as any
              expect(result).toHaveProperty([...refPath, OPEN_API_PROPERTY_DESCRIPTION], VALUE_BASE)
              expect(result).toHaveProperty([...refPath, OPEN_API_PROPERTY_SUMMARY], VALUE_BASE)
            })
          })
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
                    description: [{ parent: undefined as any, value: 'description' }],
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
      expected.paths['/test'].get.responses['200'][TEST_ORIGINS_FLAG].description[0].parent = expected.paths['/test'].get.responses[TEST_ORIGINS_FLAG][200][0]

      const result = defineOriginsAndResolveRef(source, { originsFlag: TEST_ORIGINS_FLAG, source: components })
      expect(result).toEqual(expected)
    })
  })
})