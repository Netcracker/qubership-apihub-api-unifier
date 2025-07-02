import { defineOriginsAndResolveRef } from '../../src/define-origins-and-resolve-ref'
import { commonOriginsCheck, TEST_ORIGINS_FLAG, TEST_SYNTHETIC_TITLE_FLAG } from '../helpers'

describe('OAS 3.1 reference object', () => {

  it('could define response via reference object', () => {
    const source = {
      openapi: '3.1.0',
      paths: {
        '/test': {
          get: {
            responses: {
              '200': {
                $ref: '#/components/responses/SuccessResponse'
              }
            }
          }
        }
      },
      components: {
        responses: {
          SuccessResponse: {
            description: 'Successful response',            
          }
        }
      }
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
              }
            }
          }
        }
      },
      components: {
        responses: {
          SuccessResponse: {
            description: 'Successful response',
          }
        }
      }
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
              }
            }
          }
        }
      },
      components: {
        responses: {
          SuccessResponse: {
            description: 'Successful response',
          }
        }
      }
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
              }
            }
          }
        }
      },  
      components: {
        responses: {
          SuccessResponse: {
            description: 'Successful response',
            content: {
              'application/json': {
                schema: {
                  type: 'object'
                }
              }
            }
          }
        }
      }
    }   

    const result = defineOriginsAndResolveRef(source) as any        
    expect(result.paths['/test'].get.responses['200'].content).toBe(result.components.responses.SuccessResponse.content)
  })  
  
  it('reference object pointing to non-valid components section is ignored for the response', () => {
    const source = {
      openapi: '3.1.0',
      paths: {
        '/test': {
          get: {
            responses: {
              '200': {
                $ref: '#/components/requests/SuccessRequest',
              }
            }
          }
        }
      },
      components: {
        requests: {
          SuccessRequest: {
            description: 'Successful request',
          }
        }
      }
    }

    const result = defineOriginsAndResolveRef(source) as any    
    expect(result.paths['/test'].get.responses['200']).toEqual({}) // or not defined?, check with schemas
    //TODO: reported to onRefResolveError callback?
  })

  it('refernece object pointing to non-existing component is ignored for the response', () => {
    const source = {
      openapi: '3.1.0',
      paths: {
        '/test': {
          get: {
            responses: {
              '200': {
                $ref: '#/components/requests/SuccessRequest',
              }
            }
          }
        }
      }
    }

    const result = defineOriginsAndResolveRef(source) as any    
    expect(result.paths['/test'].get.responses['200']).toEqual({}) // or not defined?, check with schemas
    //TODO: reported to onRefResolveError callback?
  })

  it('could define response via reference object chain', () => {
    const source = {
      openapi: '3.1.0',
      paths: {
        '/test': {
          get: {
            responses: {
              '200': {
                $ref: '#/components/responses/SuccessResponse'
              }
            }
          }
        }
      },
      components: {
        responses: {
          SuccessResponse: {
            $ref: '#/components/responses/SuccessResponse2'
          },
          SuccessResponse2: {
            description: 'Some request',
          }
        }
      }
    }

    const result = defineOriginsAndResolveRef(source) as any    
    expect(result.paths['/test'].get.responses['200']).toBe(result.components.responses.SuccessResponse2)
  })

  it('should not hang up when processing reference object for response which points to itself', () => {
    const source = {
      openapi: '3.1.0',
      paths: {
        '/test': {
          get: {
            responses: {
              '200': {
                $ref: '#/components/responses/SuccessResponse'
              }
            }
          }
        }
      },
      components: {
        responses: {
          SuccessResponse: {
            $ref: '#/components/responses/SuccessResponse'
          }
        }
      }
    }

    const result = defineOriginsAndResolveRef(source) as any    
    expect(result.paths['/test'].get.responses['200']).toBe(result.components.responses.SuccessResponse) // or not defined?, check with schemas     
  })

  it('should not hang up when processing cycled chain of reference objects for response', () => {
    const source = {
      openapi: '3.1.0',
      paths: {
        '/test': {
          get: {
            responses: {
              '200': {
                $ref: '#/components/responses/SuccessResponse'
              }
            }
          }
        }
      },
      components: {
        responses: {
          SuccessResponse: {
            $ref: '#/components/responses/SuccessResponse2'
          },
          SuccessResponse2: {
            $ref: '#/components/responses/SuccessResponse'
          }
        }
      }
    }

    const result = defineOriginsAndResolveRef(source) as any    
    expect(result.paths['/test'].get.responses['200']).toBe(result.components.responses.SuccessResponse) // or not defined?, check with schemas
  })

  it('reference object in non-valid location is ignored', () => {
    const source = {
      openapi: '3.1.0',
      paths: {
        $ref: '#/components/responses/SuccessResponse',
        '/test': {
          get: {
            responses: {
              '200': {
                description: 'Successful response',
              }
            }
          }
        }
      },
      components: {
        responses: {
          SuccessResponse: {
            description: 'Some description',
          }
        }
      }
    }
    const result = defineOriginsAndResolveRef(source) as any    
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
                      type: 'object'
                    }
                  }
                }
              }
            }
          }
        }
      },
      components: {
        responses: {
          SuccessResponse: {
            description: 'Successful response',
            content: {
              'application/xml': {
                schema: {
                  type: 'object'
                }
              }
            }
          }
        }
      }
    }

    const result = defineOriginsAndResolveRef(source) as any      
    expect(result.paths['/test'].get.responses['200'].content).toBe(result.components.responses.SuccessResponse.content)
  })

  it('reference object for response is ignored in OAS 3.0', () => {
    const source = {
      openapi: '3.0.0',
      paths: {
        '/test': {
          get: {
            responses: {
              '200': {
                $ref: '#/components/responses/SuccessResponse'
              }
            }
          }
        }
      },
      components: {
        responses: {
          SuccessResponse: {
            description: 'Successful response',
          }
        }
      }
    }

    const result = defineOriginsAndResolveRef(source) as any      
    expect(result.paths['/test'].get.responses['200']).toEqual({}) // or not defined?, check with schemas
    // TODO: reported via onRefResolveError callback?
  })
})