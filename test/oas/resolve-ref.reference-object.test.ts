import { normalize, RefErrorType, RefErrorTypes } from '../../src'
import headers from '../resources/reference-object/headers.json'
import examples from '../resources/reference-object/examples.json'
import parameters from '../resources/reference-object/parameters.json'
import requestBodies from '../resources/reference-object/requestBodies.json'
import response from '../resources/reference-object/response.json'
import 'jest-extended'
import { defineOriginsAndResolveRef } from '../../src/define-origins-and-resolve-ref'
import { JsonPath } from '@netcracker/qubership-apihub-json-crawl'

const POST_PATH = ['paths', '/path1', 'post']
const OPTIONS = { resolveRef: true }

//todo rename jsons
describe('OAS 3.1. Reference Object. Support of summary/description fields in ref object', () => {
  // it('Override description and summary in properties examples', () => {
  //   const path = [...POST_PATH, 'responses', '200', 'content', 'application/json', 'schema', 'properties', 'prop1', 'examples', 0]
  //   const result = normalize(examples, OPTIONS)
  //
  //   expect(result).toHaveProperty([...path, 'description'], 'example description override')
  //   expect(result).toHaveProperty([...path, 'summary'], 'example summary override')
  // })

  it('Override description in headers', () => {
    const result = normalize(headers, OPTIONS)

    expect(result).toHaveProperty([...POST_PATH, 'responses', '200', 'headers', 'X-Rate-Limit', 'description'], 'header description override')
  })

  // it('Override description in parameters', () => {
  //   const result = normalize(parameters, OPTIONS)
  //   expect(result).toHaveProperty([...POST_PATH, 'parameters', 0, 'description'], 'status parameter description override')
  // })

  // it('Override description in requestBody', () => {
  //   const result = normalize(requestBodies, OPTIONS)
  //   expect(result).toHaveProperty([...POST_PATH, 'requestBody', 'description'], 'rb description override')
  // })

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

    //todo fix it
    it.skip('reference object in non-valid location is ignored', (done) => {
      const onRefResolveError = (message: string, path: JsonPath, ref: string, errorType: RefErrorType) => {
        expect(ref).toBe('#/components/responses/SuccessResponse')
        expect(errorType).toBe(RefErrorTypes.REF_NOT_FOUND)
        done()
      }

      const source = {
        openapi: '3.1.0',
        paths: {
          $ref: '#/components/responses/SuccessResponse',
          '/test': {
            get: {
              responses: {
                '200': {
                  description: 'Successful response',
                },
              },
            },
          },
        },
        components: {
          responses: {
            SuccessResponse: {
              description: 'Some description',
            },
          },
        },
      }
      const result = defineOriginsAndResolveRef(source, { onRefResolveError }) as any
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
