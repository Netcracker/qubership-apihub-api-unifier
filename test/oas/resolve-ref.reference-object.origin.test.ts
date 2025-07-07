import { convertOriginToHumanReadable, NormalizeOptions } from '../../src'
import 'jest-extended'
import { defineOriginsAndResolveRef } from '../../src/define-origins-and-resolve-ref'
import { TEST_ORIGINS_FLAG } from '../helpers'

const OPTIONS: NormalizeOptions = {
  originsFlag: TEST_ORIGINS_FLAG,
}

describe('OAS 3.1. Reference Object. Validate origins', () => {
  //todo to file?
  it('Check reference object with override responses origin', () => {
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
            type: "object",
          },
        },
      },
    }
    const result = defineOriginsAndResolveRef(source, OPTIONS) as any
    const resultWithHmr = convertOriginToHumanReadable(result, TEST_ORIGINS_FLAG)
    expect(resultWithHmr).toHaveProperty(['paths', '/test', 'get', 'responses', '200', TEST_ORIGINS_FLAG, 'description'], (['paths//test/get/responses/200']))
    expect(resultWithHmr).toHaveProperty(['paths', '/test', 'get', 'responses', '200', TEST_ORIGINS_FLAG, 'type'], (['components/responses/SuccessResponse/type']))
  })

  it('Check none override summary doesn\'t lose origin ', () => {
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
            summary: 'Successful summary',
          },
        },
      },
    }

    const result = defineOriginsAndResolveRef(source, OPTIONS) as any
    const resultWithHmr = convertOriginToHumanReadable(result, TEST_ORIGINS_FLAG)
    expect(resultWithHmr).toHaveProperty(['paths', '/test', 'get', 'responses', '200', TEST_ORIGINS_FLAG, 'summary'], (['components/responses/SuccessResponse/summary']))
  })
})
