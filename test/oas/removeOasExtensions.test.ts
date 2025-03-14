import { normalize, NormalizeOptions } from '../../src'
import openapiWithExtensions from '../resources/openapi-with-extensions.json'
import openapiWithoutExtensions from '../resources/openapi-without-extensions.json'

const DEFAULT_OPTIONS: NormalizeOptions = {
  resolveRef: false,
  mergeAllOf: false,
  removeOasExtensions: true,
  shouldRemoveOasExtension: () => true,
}

function createFullyCycledOpenApi(includeExtensions: boolean): Record<PropertyKey, unknown> {
  const OPEN_API_EXTERNAL_DOCS = {
    ...(includeExtensions ? { 'x-externalDocs-extension': 'example' } : {}),
    url: 'str',
    description: 'str',
  }

  const OPEN_API_JSON_SCHEMA_FULLY_CYCLED = {
    ...(includeExtensions ? { 'x-schema-extension': 'example' } : {}),
      type: 'object',
      title: 'str',
      description: 'str',
      format: 'str',
      default: 42,
      multipleOf: 42,
      maximum: 42,
      minimum: 42,
      maxLength: 42,
      minLength: 42,
      pattern: 'str',
      maxItems: 42,
      minItems: 42,
      uniqueItems: true,
      maxProperties: 42,
      minProperties: 42,
      required: ['str'],
      enum: ['str'],
      readOnly: true,
      writeOnly: true,
      deprecated: true,
      $ref: 'str',
      example: 'str',
      examples: ['str'],
      nullable: true,
      exclusiveMaximum: true,
      exclusiveMinimum: true,
      items: null as any,
      additionalItems: null as any,
      properties: {
        something: null as any,
      },
      additionalProperties: {
        something: null as any,
      },
      allOf: null as any,
      oneOf: null as any,
      anyOf: null as any,
      not: null as any,
      definitions: {
        something: null as any,
      },
      externalDocs: OPEN_API_EXTERNAL_DOCS,
      xml: {
        name: 'user',
        ...(includeExtensions ? { 'x-xml-extension': 'example' } : {}),
      },
  }
  OPEN_API_JSON_SCHEMA_FULLY_CYCLED['items'] = OPEN_API_JSON_SCHEMA_FULLY_CYCLED
  OPEN_API_JSON_SCHEMA_FULLY_CYCLED['additionalItems'] = OPEN_API_JSON_SCHEMA_FULLY_CYCLED
  OPEN_API_JSON_SCHEMA_FULLY_CYCLED['properties']['something'] = OPEN_API_JSON_SCHEMA_FULLY_CYCLED
  OPEN_API_JSON_SCHEMA_FULLY_CYCLED['additionalProperties']['something'] = OPEN_API_JSON_SCHEMA_FULLY_CYCLED
  OPEN_API_JSON_SCHEMA_FULLY_CYCLED['allOf'] = [OPEN_API_JSON_SCHEMA_FULLY_CYCLED]
  OPEN_API_JSON_SCHEMA_FULLY_CYCLED['oneOf'] = [OPEN_API_JSON_SCHEMA_FULLY_CYCLED]
  OPEN_API_JSON_SCHEMA_FULLY_CYCLED['anyOf'] = [OPEN_API_JSON_SCHEMA_FULLY_CYCLED]
  OPEN_API_JSON_SCHEMA_FULLY_CYCLED['not'] = OPEN_API_JSON_SCHEMA_FULLY_CYCLED
  OPEN_API_JSON_SCHEMA_FULLY_CYCLED['definitions']['something'] = OPEN_API_JSON_SCHEMA_FULLY_CYCLED

  const OPEN_API_EXAMPLES = {
    something: {
      ...(includeExtensions ? { 'x-example-extension': 'example' } : {}),
      description: 'str',
      value: 'str',
      summary: 'str',
      externalValue: 'str',
    },
  }
  const OPEN_API_CONTENT = {
    something: {
      ...(includeExtensions ? { 'x-mediaType-extension': 'example' } : {}),
      examples: OPEN_API_EXAMPLES,
      example: 'str',
      schema: OPEN_API_JSON_SCHEMA_FULLY_CYCLED,
      encoding: {
        something: {
          ...(includeExtensions ? { 'x-encoding-extension': 'example' } : {}),
          contentType: 'str',
          headers: null as any,
          style: 'str',
          explode: true,
          allowReserved: true,
        },
      },
    },
  }
  const OPEN_API_HEADERS: Record<PropertyKey, unknown> = {
    something: {
      ...(includeExtensions ? { 'x-header-extension': 'example' } : {}),
      description: 'str',
      examples: OPEN_API_EXAMPLES,
      required: true,
      example: 'str',
      deprecated: true,
      schema: OPEN_API_JSON_SCHEMA_FULLY_CYCLED,
      allowEmptyValue: true,
      allowReserved: true,
      explode: true,
      style: 'str',
      content: OPEN_API_CONTENT,
    },
  }
  OPEN_API_CONTENT.something.encoding.something.headers = OPEN_API_HEADERS
  const OPEN_API_SERVER = {
    ...(includeExtensions ? { 'x-server-extension': 'example' } : {}),
    url: 'str',
    description: 'str',
    variables: {
      something: {
        ...(includeExtensions ? { 'x-serverVariable-extension': 'example' } : {}),
        default: 'str',
        description: 'str',
        enum: ['str'],
      },
    },
  }
  const OPEN_API_LINKS = {
    something: {
      ...(includeExtensions ? { 'x-link-extension': 'example' } : {}),
      description: 'str',
      operationId: 'str',
      operationRef: 'str',
      server: OPEN_API_SERVER,
      parameters: {
        something: 'str',
      },
      requestBody: 'str',
    },
  }
  const OPEN_API_RESPONSE = {
    ...(includeExtensions ? { 'x-response-extension': 'example' } : {}),
    description: 'str',
    headers: OPEN_API_HEADERS,
    content: OPEN_API_CONTENT,
    links: OPEN_API_LINKS,
  }
  const OPEN_API_RESPONSES = {
    ...(includeExtensions ? { 'x-responses-extension': 'example' } : {}),
    something: OPEN_API_RESPONSE,
  }
  const OPEN_API_PARAMETER = {
    ...(includeExtensions ? { 'x-parameter-extension': 'example' } : {}),
    description: 'str',
    examples: OPEN_API_EXAMPLES,
    required: true,
    example: 'str',
    deprecated: true,
    schema: OPEN_API_JSON_SCHEMA_FULLY_CYCLED,
    allowEmptyValue: true,
    allowReserved: true,
    explode: true,
    style: 'str',
    content: OPEN_API_CONTENT,
    name: 'str',
    in: 'str',
  }
  const OPEN_API_PARAMETERS = {
    something: OPEN_API_PARAMETER,
  }
  const OPEN_API_REQUEST_BODY = {
    ...(includeExtensions ? { 'x-requestBody-extension': 'example' } : {}),
    description: 'str',
    content: OPEN_API_CONTENT,
    required: true,
  }
  const OPEN_API_REQUEST_BODIES = {
    something: OPEN_API_REQUEST_BODY,
  }
  const OPEN_API_SECURITY = [
    {
      something: ['str'],
    },
  ]
  return {
    ...(includeExtensions ? { 'x-root-extension': 'example' } : {}),
    openapi: '3.0.1',
    info: {
      ...(includeExtensions ? { 'x-info-extension': 'example' } : {}),
      description: 'str',
      title: 'str',
      version: 'str',
      termsOfService: 'str',
      contact: {
        ...(includeExtensions ? { 'x-contact-extension': 'example' } : {}),
        name: 'str',
        url: 'str',
        email: 'str',
      },
      license: {
        ...(includeExtensions ? { 'x-license-extension': 'example' } : {}),
        name: 'str',
        url: 'str',
      },
    },
    tags: [
      {
        ...(includeExtensions ? { 'x-tag-extension': 'example' } : {}),
        name: 'str',
        description: 'str',
        externalDocs: OPEN_API_EXTERNAL_DOCS,
      },
    ],
    externalDocs: OPEN_API_EXTERNAL_DOCS,
    servers: [
      OPEN_API_SERVER,
    ],
    security: OPEN_API_SECURITY,
    components: {
      ...(includeExtensions ? { 'x-components-extension': 'example' } : {}),
      schemas: {
        something: OPEN_API_JSON_SCHEMA_FULLY_CYCLED,
      },
      responses: {
        something: OPEN_API_RESPONSE,
      },
      examples: OPEN_API_EXAMPLES,
      headers: OPEN_API_HEADERS,
      links: OPEN_API_LINKS,
      securitySchemes: {
        http: {
          ...(includeExtensions ? { 'x-httpSecurityScheme-extension': 'example' } : {}),
          type: 'http',
          description: 'str',
          scheme: 'str',
          bearerFormat: 'str',
        },
        apiKey: {
          ...(includeExtensions ? { 'x-securityScheme-extension': 'example' } : {}),
          type: 'apiKey',
          description: 'str',
          name: 'str',
          in: 'str',
        },
        oauth2: {
          ...(includeExtensions ? { 'x-oauth2SecurityScheme-extension': 'example' } : {}),
          type: 'oauth2',
          description: 'str',
          flows: {
            ...(includeExtensions ? { 'x-oauthFlows-extension': 'example' } : {}),
            implicit: {
              ...(includeExtensions ? { 'x-oauthImplicitFlow-extension': 'example' } : {}),
              authorizationUrl: 'str',
              refreshUrl: 'str',
              scopes: {
                something: 'str',
              },
            },
            password: {
              ...(includeExtensions ? { 'x-oauthPasswordFlow-extension': 'example' } : {}),
              tokenUrl: 'str',
              refreshUrl: 'str',
              scopes: {
                something: 'str',
              },
            },
            authorizationCode: {
              ...(includeExtensions ? { 'x-oauthAuthorizationCodeFlow-extension': 'example' } : {}),
              refreshUrl: 'str',
              authorizationUrl: 'str',
              tokenUrl: 'str',
              scopes: {
                something: 'str',
              },
            },
            clientCredentials: {
              ...(includeExtensions ? { 'x-oauthClientCredentialsFlow-extension': 'example' } : {}),
              refreshUrl: 'str',
              tokenUrl: 'str',
              scopes: {
                something: 'str',
              },
            },
          },
        },
        openIdConnect: {
          ...(includeExtensions ? { 'x-openIdConnectSecurityScheme-extension': 'example' } : {}),
          type: 'openIdConnect',
          description: 'str',
          openIdConnectUrl: 'str',
        },
      },
      parameters: OPEN_API_PARAMETERS,
      requestBodies: OPEN_API_REQUEST_BODIES,
    },
    paths: {
      ...(includeExtensions ? { 'x-paths-extension': 'example' } : {}),
      something: {
        ...(includeExtensions ? { 'x-pathItem-extension': 'example' } : {}),
        description: 'str',
        parameters: [OPEN_API_PARAMETER],
        servers: [OPEN_API_SERVER], // was missing???
        get: {
          ...(includeExtensions ? { 'x-operation-extension': 'example' } : {}),
          description: 'str',
          parameters: [OPEN_API_PARAMETER],
          deprecated: true,
          responses: OPEN_API_RESPONSES,
          requestBody: OPEN_API_REQUEST_BODY,
          summary: 'str',
          operationId: 'str',
          externalDocs: OPEN_API_EXTERNAL_DOCS,
          servers: [OPEN_API_SERVER],
          security: OPEN_API_SECURITY,
          tags: ['str'],
        },
      },
    },
  }
}

describe('remove OAS extensions', () => {
  it('removes OAS extensions', () => {
    const normalizedSchema = normalize(openapiWithExtensions, DEFAULT_OPTIONS)
    expect(normalizedSchema).toEqual(openapiWithoutExtensions)
  })

  it('removes OAS extensions - take 2', () => {
    const normalizedSchema = normalize(createFullyCycledOpenApi(true), DEFAULT_OPTIONS)
    expect(normalizedSchema).toEqual(createFullyCycledOpenApi(false))
  })
})
