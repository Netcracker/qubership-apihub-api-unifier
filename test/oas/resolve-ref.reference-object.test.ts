import { normalize, RefErrorType, RefErrorTypes } from '../../src'
import headers from '../resources/reference-object/headers.json'
import examples from '../resources/reference-object/examples.json'
import parameters from '../resources/reference-object/parameters.json'
import requestBodies from '../resources/reference-object/requestBodies.json'
import response from '../resources/reference-object/response.json'
import 'jest-extended'
import { defineOriginsAndResolveRef } from '../../src/define-origins-and-resolve-ref'
import { JsonPath } from '@netcracker/qubership-apihub-json-crawl'
import { TEST_ORIGINS_FLAG } from '../helpers'

const POST_PATH = ['paths', '/path1', 'post']
const OPTIONS = { resolveRef: true }

//todo rename jsons
describe('OAS 3.1. Reference Object. Support of summary/description fields in ref object', () => {
  it('Override description and summary in properties examples', () => {
    const path = [...POST_PATH, 'responses', '200', 'content', 'application/json', 'schema', 'properties', 'prop1', 'examples', 0]
    const result = normalize(examples, OPTIONS)

    expect(result).toHaveProperty([...path, 'description'], 'example description override')
    expect(result).toHaveProperty([...path, 'summary'], 'example summary override')
  })

  it('Override description in headers', () => {
    const result = normalize(headers, OPTIONS)

    expect(result).toHaveProperty([...POST_PATH, 'responses', '200', 'headers', 'X-Rate-Limit', 'description'], 'header description override')
  })

  it('Override description in parameters', () => {
    const result = normalize(parameters, OPTIONS)
    expect(result).toHaveProperty([...POST_PATH, 'parameters', 0, 'description'], 'status parameter description override')
  })

  it('Override description in requestBody', () => {
    const result = normalize(requestBodies, OPTIONS)
    expect(result).toHaveProperty([...POST_PATH, 'requestBody', 'description'], 'rb description override')
  })

  it('Override description in responses', () => {
    const result = normalize(response, OPTIONS)
    expect(result).toHaveProperty([...POST_PATH, 'responses', '200', 'description'], 'Response 200 description override')
  })

  describe('OAS 3.1 reference object', () => {
    it('could define response via reference object', () => {
      const source = {
        openapi: '3.1.0',
        paths: {
          '/test': {
            get: {
              responses: {
                '200': {
                  $ref: '#/components/responses/SuccessResponse',
                },
              },
            },
          },
        },
        components: {
          responses: {
            SuccessResponse: {
              description: 'Successful response',
            },
          },
        },
      }

      const result = defineOriginsAndResolveRef(source) as any
      expect(result.paths['/test'].get.responses['200']).toBe(result.components.responses.SuccessResponse)
    })

    it('could override description for response via reference object', () => {
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
        components: {
          responses: {
            SuccessResponse: {
              description: 'Successful response',
            },
          },
        },
      }

      const result = defineOriginsAndResolveRef(source) as any
      expect(result.paths['/test'].get.responses['200'].description).toBe('Overriden description')
      expect(result.components.responses.SuccessResponse.description).toBe('Successful response')
    })

    it('could not override summary for the response via reference object', () => {
      const source = {
        openapi: '3.1.0',
        paths: {
          '/test': {
            get: {
              responses: {
                '200': {
                  $ref: '#/components/responses/SuccessResponse',
                  summary: 'Overriden summary',
                },
              },
            },
          },
        },
        components: {
          responses: {
            SuccessResponse: {
              description: 'Successful response',
            },
          },
        },
      }

      const result = defineOriginsAndResolveRef(source) as any
      expect(result.paths['/test'].get.responses['200']).not.toHaveProperty('summary')
      // TODO: reported via onRefResolveError callback?
    })

    it('second-level object are the same when overriding description for response via reference object', () => {
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
        components: {
          responses: {
            SuccessResponse: {
              description: 'Successful response',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                  },
                },
              },
            },
          },
        },
      }

      const result = defineOriginsAndResolveRef(source) as any
      expect(result.paths['/test'].get.responses['200'].content).toBe(result.components.responses.SuccessResponse.content)
    })

    // todo ask this
    it('reference object pointing to non-valid components section is ignored for the response', () => {
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
        components: {
          requests: {
            SuccessRequest: {
              description: 'Successful request',
            },
          },
        },
      }

      const result = defineOriginsAndResolveRef(source) as any
      expect(result.paths['/test'].get.responses['200'].description).toEqual('Successful request')
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
      const source = {
        openapi: '3.1.0',
        paths: {
          '/test': {
            get: {
              responses: {
                '200': {
                  $ref: '#/components/responses/SuccessResponse',
                },
              },
            },
          },
        },
        components: {
          responses: {
            SuccessResponse: {
              $ref: '#/components/responses/SuccessResponse2',
            },
            SuccessResponse2: {
              description: 'Some request',
            },
          },
        },
      }

      const result = defineOriginsAndResolveRef(source) as any
      expect(result.paths['/test'].get.responses['200']).toBe(result.components.responses.SuccessResponse2)
    })

    it('should not hang up when processing reference object for response which points to itself', (done) => {
      const onRefResolveError = (message: string, path: JsonPath, ref: string, errorType: RefErrorType) => {
        expect(ref).toBe('#/components/responses/SuccessResponse')
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
                  $ref: '#/components/responses/SuccessResponse',
                },
              },
            },
          },
        },
        components: {
          responses: {
            SuccessResponse: {
              $ref: '#/components/responses/SuccessResponse',
            },
          },
        },
      }

      const result = defineOriginsAndResolveRef(source, { onRefResolveError }) as any
      expect(result.paths['/test'].get.responses['200'].$ref).toBe('#/components/responses/SuccessResponse')
    })

    it('should not hang up when processing cycled chain of reference objects for response', () => {
      const source = {
        openapi: '3.1.0',
        paths: {
          '/test': {
            get: {
              responses: {
                '200': {
                  $ref: '#/components/responses/SuccessResponse',
                },
              },
            },
          },
        },
        components: {
          responses: {
            SuccessResponse: {
              $ref: '#/components/responses/SuccessResponse2',
            },
            SuccessResponse2: {
              $ref: '#/components/responses/SuccessResponse',
            },
          },
        },
      }
      let errorCount = 0
      const result = defineOriginsAndResolveRef(source, { onRefResolveError: () => errorCount++ }) as any
      expect(errorCount).toBe(2)
      expect(result.paths['/test'].get.responses['200'].$ref).toBe('#/components/responses/SuccessResponse')
    })

    it('properties other than description and summary could not be overriden via reference object for response', () => {
      const source = {
        openapi: '3.1.0',
        paths: {
          '/test': {
            get: {
              responses: {
                '200': {
                  $ref: '#/components/responses/SuccessResponse',
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                      },
                    },
                  },
                },
              },
            },
          },
        },
        components: {
          responses: {
            SuccessResponse: {
              description: 'Successful response',
              content: {
                'application/xml': {
                  schema: {
                    type: 'object',
                  },
                },
              },
            },
          },
        },
      }

      const result = defineOriginsAndResolveRef(source) as any
      expect(result.paths['/test'].get.responses['200'].content).toBe(result.components.responses.SuccessResponse.content)
    })

    it('could not override description for responses via reference object in OAS 3.0', () => {
      const source = {
        openapi: '3.0.0',
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
        components: {
          responses: {
            SuccessResponse: {
              description: 'Successful response',
            },
          },
        },
      }

      const result = defineOriginsAndResolveRef(source) as any
      expect(result.paths['/test'].get.responses['200'].description).toEqual('Successful response')
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
