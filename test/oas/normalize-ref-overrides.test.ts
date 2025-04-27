import { normalize, NormalizeOptions } from '../../src'
import { TEST_INLINE_REFS_FLAG, TEST_ORIGINS_FLAG } from '../helpers'

describe('normalize reference object description and summary overrides in OAS 3.1', () => {
  it('should override description in a reference object', () => {
    const source = {
      openapi: '3.1.0',
      components: {
        schemas: {
          Person: {
            type: 'object',
            description: 'Original description',
            properties: {
              name: {
                type: 'string'
              },
              age: {
                type: 'integer'
              }
            }
          }
        }
      },
      paths: {
        '/people': {
          get: {
            responses: {
              '200': {
                content: {
                  'application/json': {
                    schema: {
                      $ref: '#/components/schemas/Person',
                      description: 'Overridden description'
                    }
                  }
                }
              }
            }
          }
        }
      }
    }

    const DEFAULT_OPTIONS: NormalizeOptions = {
        resolveRef: true,
        mergeAllOf: true
      }

    const result: any = normalize(source, DEFAULT_OPTIONS)    
    
    const schema = result.paths['/people'].get.responses['200'].content['application/json'].schema    
    expect(schema).toHaveProperty('description', 'Overridden description')    
  })  
  
  it('should override description in a response reference object', () => {
    const source = {
      openapi: '3.1.0',
      info: {
        title: 'Swagger Petstore - OpenAPI 3.1',
        version: '1.0.12'
      },
      paths: {
        '/pet': {
          post: {
            summary: 'Add a new pet to the store. (response)',
            description: 'Add a new pet to the store.',
            operationId: 'addPet',
            responses: {
              '200': {
                $ref: '#/components/responses/response200',
                description: 'Response 200 description override'
              }
            }
          }
        }
      },
      components: {
        responses: {
          response200: {
            description: 'Successful operation (description)',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    id: {
                      type: 'integer',
                      format: 'int64',
                      example: 10
                    },
                    name: {
                      type: 'string'
                    }
                  }
                }
              }
            }
          }
        }
      }
    }

    const DEFAULT_OPTIONS: NormalizeOptions = {
      resolveRef: true,
      mergeAllOf: true
    }

    const result: any = normalize(source, DEFAULT_OPTIONS)
    
    const response = result.paths['/pet'].post.responses['200']
    expect(response).toHaveProperty('description', 'Response 200 description override')    
  })
}) 