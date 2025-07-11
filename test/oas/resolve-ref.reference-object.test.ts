import { normalize, RefErrorType, RefErrorTypes } from '../../src'
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
    describe('Rules for response', () => {
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

    describe('Rules for requestBody', () => {
      it('could define requestBody via reference object', () => {
        const source = {
          openapi: '3.1.0',
          paths: {
            '/test': {
              post: {
                requestBody: {
                  $ref: '#/components/requestBodies/Data',
                },
              },
            },
          },
          components: {
            requestBodies: {
              Data: {
                description: 'RequestBodies data',
              },
            },
          },
        }

        const result = normalize(source, { resolveRef: true }) as any
        expect(result.paths['/test'].post.requestBodies).toBe(result.components.requestBodies.request)
      })

      it('could override description for requestBody via reference object', () => {
        const source = {
          openapi: '3.1.0',
          paths: {
            '/test': {
              post: {
                requestBody: {
                  $ref: '#/components/requestBodies/Data',
                  description: 'Overriden description',
                },
              },
            },
          },
          components: {
            requestBodies: {
              Data: {
                description: 'RequestBodies data',
              },
            },
          },
        }

        const result = normalize(source, { resolveRef: true }) as any
        expect(result.paths['/test'].post.requestBody.description).toBe('Overriden description')
        expect(result.components.requestBodies.Data.description).toBe('RequestBodies data')
      })

      it('could not override summary for the requestBody via reference object', () => {
        const source = {
          openapi: '3.1.0',
          paths: {
            '/test': {
              post: {
                requestBody: {
                  $ref: '#/components/requestBodies/Data',
                  summary: 'Overriden summary',
                },
              },
            },
          },
          components: {
            requestBodies: {
              Data: {
                description: 'RequestBodies data',
              },
            },
          },
        }

        const result = defineOriginsAndResolveRef(source) as any
        expect(result.paths['/test'].post.requestBody).not.toHaveProperty('summary')
        // TODO: reported via onRefResolveError callback?
      })

      it('properties other than description and summary could not be overriden via reference object for requestBody', () => {
        const source = {
          openapi: '3.1.0',
          paths: {
            '/test': {
              post: {
                requestBody: {
                  $ref: '#/components/requestBodies/Data',
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
          components: {
            requestBodies: {
              Data: {
                description: 'RequestBodies data',
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
        expect(result.paths['/test'].post.requestBody.content).toBe(result.components.requestBodies.Data.content)
      })

      it('could not override description for responses via requestBody object in OAS 3.0', () => {
        const source = {
          openapi: '3.0.0',
          paths: {
            '/test': {
              post: {
                requestBody: {
                  $ref: '#/components/requestBodies/Data',
                  description: 'Overriden description',
                },
              },
            },
          },
          components: {
            requestBodies: {
              Data: {
                description: 'RequestBodies data',
              },
            },
          },
        }

        const result = defineOriginsAndResolveRef(source) as any
        expect(result.paths['/test'].post.requestBody.description).toEqual('RequestBodies data')
      })
    })

    describe('Rules for headers', () => {
      it('could define headers via reference object', () => {
        const source = {
          openapi: '3.1.0',
          paths: {
            '/test': {
              post: {
                responses: {
                  '200': {
                    headers: {
                      'X-Rate-Limit': {
                        $ref: '#/components/headers/X-Rate-Limit',
                      },
                    },
                  },
                },
              },
            },
          },
          components: {
            headers: {
              'X-Rate-Limit': {
                description: 'header description from components',
              },
            },
          },
        }

        const result = normalize(source, { resolveRef: true }) as any
        expect(result.paths['/test'].post.responses['200'].headers['X-Rate-Limit']).toBe(result.components.headers['X-Rate-Limit'])
      })

      it('could override description for headers via reference object', () => {
        const source = {
          openapi: '3.1.0',
          paths: {
            '/test': {
              post: {
                responses: {
                  '200': {
                    headers: {
                      'X-Rate-Limit': {
                        $ref: '#/components/headers/X-Rate-Limit',
                        description: 'Overriden description',
                      },
                    },
                  },
                },
              },
            },
          },
          components: {
            headers: {
              'X-Rate-Limit': {
                description: 'header description from components',
              },
            },
          },
        }

        const result = normalize(source, { resolveRef: true }) as any
        expect(result.paths['/test'].post.responses['200'].headers['X-Rate-Limit'].description).toBe('Overriden description')
        expect(result.components.headers['X-Rate-Limit'].description).toBe('header description from components')
      })

      it('could not override summary for the requestBody via reference object', () => {
        const source = {
          openapi: '3.1.0',
          paths: {
            '/test': {
              post: {
                responses: {
                  '200': {
                    headers: {
                      'X-Rate-Limit': {
                        $ref: '#/components/headers/X-Rate-Limit',
                        summary: 'Overriden summary',
                      },
                    },
                  },
                },
              },
            },
          },
          components: {
            headers: {
              'X-Rate-Limit': {
                description: 'header description from components',
              },
            },
          },
        }

        const result = defineOriginsAndResolveRef(source) as any
        expect(result.paths['/test'].post.responses['200'].headers['X-Rate-Limit']).not.toHaveProperty('summary')
        // TODO: reported via onRefResolveError callback?
      })

      it('properties other than description and summary could not be overriden via reference object for headers', () => {
        const source = {
          openapi: '3.1.0',
          paths: {
            '/test': {
              post: {
                responses: {
                  '200': {
                    headers: {
                      'X-Rate-Limit': {
                        $ref: '#/components/headers/X-Rate-Limit',
                      },
                    },
                  },
                },
              },
            },
          },
          components: {
            headers: {
              'X-Rate-Limit': {
                description: 'header description from components',
                schema: {
                  type: 'integer',
                  format: 'int32',
                },
              },
            },
          },
        }

        const result = defineOriginsAndResolveRef(source) as any
        expect(result.paths['/test'].post.responses['200'].headers['X-Rate-Limit'].schema).toBe(result.components.headers['X-Rate-Limit'].schema)
      })

      it('could not override description for responses via requestBody object in OAS 3.0', () => {
        const source = {
          openapi: '3.0.0',
          paths: {
            '/test': {
              post: {
                responses: {
                  '200': {
                    headers: {
                      'X-Rate-Limit': {
                        $ref: '#/components/headers/X-Rate-Limit',
                        description: 'Overriden description',
                      },
                    },
                  },
                },
              },
            },
          },
          components: {
            headers: {
              'X-Rate-Limit': {
                description: 'header description from components',
              },
            },
          },
        }
        const result = defineOriginsAndResolveRef(source) as any
        expect(result.paths['/test'].post.responses['200'].headers['X-Rate-Limit'].description).toEqual('header description from components')
      })
    })

    describe('Rules for examples', () => {
      it('could define examples via reference object', () => {
        const source = {
          openapi: '3.1.0',
          paths: {
            '/test': {
              post: {
                responses: {
                  '200': {
                    content: {
                      'application/json': {
                        schema: {
                          type: 'object',
                          properties: {
                            prop1: {
                              type: 'string',
                              examples: [
                                {
                                  $ref: '#/components/examples/ex1',
                                },
                              ],
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          components: {
            examples: {
              ex1: {
                description: 'examples description from components',
              },
            },
          },
        }

        const result = normalize(source, { resolveRef: true }) as any
        expect(result.paths['/test'].post.responses['200'].content['application/json'].schema.properties.prop1.examples[0]).toBe(result.components.examples.ex1)
      })

      it('could override description and summary for examples via reference object', () => {
        const source = {
          openapi: '3.1.0',
          paths: {
            '/test': {
              post: {
                responses: {
                  '200': {
                    content: {
                      'application/json': {
                        schema: {
                          type: 'object',
                          properties: {
                            prop1: {
                              type: 'string',
                              examples: [
                                {
                                  $ref: '#/components/examples/ex1',
                                  description: 'Overriden description',
                                  summary: 'Overriden summary',
                                },
                              ],
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          components: {
            examples: {
              ex1: {
                description: 'examples description from components',
                summary: 'example summary from components',
              },
            },
          },
        }

        const result = normalize(source, { resolveRef: true }) as any
        expect(result.paths['/test'].post.responses['200'].content['application/json'].schema.properties.prop1.examples[0].description).toBe('Overriden description')
        expect(result.paths['/test'].post.responses['200'].content['application/json'].schema.properties.prop1.examples[0].summary).toBe('Overriden summary')
        expect(result.components.examples.ex1.description).toBe('examples description from components')
        expect(result.components.examples.ex1.summary).toBe('example summary from components')
      })

      it('properties other than description and summary could not be overriden via reference object for examples', () => {
        const source = {
          openapi: '3.1.0',
          paths: {
            '/test': {
              post: {
                responses: {
                  '200': {
                    content: {
                      'application/json': {
                        schema: {
                          type: 'object',
                          properties: {
                            prop1: {
                              type: 'string',
                              examples: [
                                {
                                  $ref: '#/components/examples/ex1',
                                },
                              ],
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          components: {
            examples: {
              ex1: {
                description: 'examples description from components',
                summary: 'example summary from components',
                schema: {
                  type: 'integer',
                  format: 'int32',
                },
              },
            },
          },
        }

        const result = defineOriginsAndResolveRef(source) as any
        expect(result.paths['/test'].post.responses['200'].content['application/json'].schema.properties.prop1.examples[0].schema).toBe(result.components.examples.ex1.schema)
      })

      it('could not override description and summary for responses via examples object in OAS 3.0', () => {
        const source = {
          openapi: '3.0.0',
          paths: {
            '/test': {
              post: {
                responses: {
                  '200': {
                    content: {
                      'application/json': {
                        schema: {
                          type: 'object',
                          properties: {
                            prop1: {
                              type: 'string',
                              examples: [
                                {
                                  $ref: '#/components/examples/ex1',
                                  description: 'Overriden description',
                                  summary: 'Overriden summary',
                                },
                              ],
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          components: {
            examples: {
              ex1: {
                description: 'examples description from components',
                summary: 'example summary from components',
              },
            },
          },
        }

        const result = defineOriginsAndResolveRef(source) as any
        expect(result.paths['/test'].post.responses['200'].content['application/json'].schema.properties.prop1.examples[0].description).toEqual('examples description from components')
        expect(result.paths['/test'].post.responses['200'].content['application/json'].schema.properties.prop1.examples[0].summary).toEqual('example summary from components')
      })
    })

    describe('Rules for parameters', () => {
      it('could define parameters via reference object', () => {
        const source = {
          openapi: '3.1.0',
          paths: {
            '/test': {
              post: {
                parameters: [
                  {
                    $ref: '#/components/parameters/status',
                  },
                ],
              },
            },
          },
          components: {
            parameters: {
              status: {
                description: 'parameters description from components',
              },
            },
          },
        }

        const result = normalize(source, { resolveRef: true }) as any
        expect(result.paths['/test'].post.parameters[0]).toBe(result.components.parameters.status)
      })

      it('could override description and summary for parameters via reference object', () => {
        const source = {
          openapi: '3.1.0',
          paths: {
            '/test': {
              post: {
                parameters: [
                  {
                    $ref: '#/components/parameters/status',
                    description: 'Overriden description',
                  },
                ],
              },
            },
          },
          components: {
            parameters: {
              status: {
                description: 'parameters description from components',
              },
            },
          },
        }

        const result = normalize(source, { resolveRef: true }) as any
        expect(result.paths['/test'].post.parameters[0].description).toBe('Overriden description')
        expect(result.components.parameters.status.description).toBe('parameters description from components')
      })

      it('properties other than description could not be overriden via reference object for parameters', () => {
        const source = {
          openapi: '3.1.0',
          paths: {
            '/test': {
              post: {
                parameters: [
                  {
                    $ref: '#/components/parameters/status',
                  },
                ],
              },
            },
          },
          components: {
            parameters: {
              status: {
                description: 'parameters description from components',
                schema: {
                  type: 'string',
                },
              },
            },
          },
        }

        const result = defineOriginsAndResolveRef(source) as any
        expect(result.paths['/test'].post.parameters[0].schema).toBe(result.components.parameters.status.schema)
      })

      it('could not override summary for the parameters via reference object', () => {
        const source = {
          openapi: '3.1.0',
          paths: {
            '/test': {
              post: {
                parameters: [
                  {
                    $ref: '#/components/parameters/status',
                    summary: 'Overriden summary',
                  },
                ],
              },
            },
          },
          components: {
            parameters: {
              status: {
                description: 'parameters description from components',
              },
            },
          },
        }

        const result = defineOriginsAndResolveRef(source) as any
        expect(result.paths['/test'].post.parameters[0]).not.toHaveProperty('summary')
        // TODO: reported via onRefResolveError callback?
      })

      it('could not override description and summary for responses via examples object in OAS 3.0', () => {
        const source = {
          openapi: '3.0.0',
          paths: {
            '/test': {
              post: {
                parameters: [
                  {
                    $ref: '#/components/parameters/status',
                    description: 'Overriden description',
                  },
                ],
              },
            },
          },
          components: {
            parameters: {
              status: {
                description: 'parameters description from components',
              },
            },
          },
        }

        const result = defineOriginsAndResolveRef(source) as any
        expect(result.paths['/test'].post.parameters[0].description).toEqual('parameters description from components')
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