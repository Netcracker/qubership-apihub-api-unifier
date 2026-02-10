
import { normalize, convertOriginToHumanReadable } from '../../src'
import { checkOriginsAreTheSame, commonOriginsCheck, setValueAtPath, TEST_ORIGINS_FLAG } from '../helpers'
import { parseAsyncApiAndAssertValid } from '../helpers/asyncapi'
import type { Input } from '@asyncapi/parser/esm/types'
import 'jest-extended'


describe('AsyncAPI: merge traits', () => {
  describe('operation traits merging', () => {
    it('should merge operation traits with last trait winning', async () => {
      const spec = {
        asyncapi: '3.0.0',
        info: {
          title: 'Test',
          version: '1.0',
        },
        channels: {
          channel1: {}
        },
        operations: {
          someOperation1: {
            action: 'send',
            channel: {
              $ref: '#/channels/channel1'
            },
            traits: [
              {
                description: 'first description'
              },
              {
                description: 'last description'
              }
            ]
          }
        }
      }

      const unifierResult: any = normalize(spec)
      const parserResult = await parseAsyncApiAndAssertValid(spec)

      // Verify traits were merged and last trait wins (same for unifier and parser)
      for (const result of [unifierResult, parserResult]) {
        expect(result.operations.someOperation1.description).toBe('last description')
        expect(result.operations.someOperation1.traits).toBeArray()
        expect(result.operations.someOperation1.traits).toHaveLength(2)
      }
    })

    it('should merge operation with root property overriding traits', async () => {
      const spec = {
        asyncapi: '3.0.0',
        info: {
          title: 'Test',
          version: '1.0',
        },
        channels: {
          channel1: {}
        },
        operations: {
          someOperation2: {
            action: 'send',
            channel: {
              $ref: '#/channels/channel1'
            },
            description: 'root description',
            traits: [
              {
                description: 'trait description 1'
              },
              {
                description: 'trait description 2'
              }
            ]
          }
        }
      }

      const unifierResult: any = normalize(spec)
      const parserResult = await parseAsyncApiAndAssertValid(spec)

      // Verify root property wins over traits (same for unifier and parser)
      for (const result of [unifierResult, parserResult]) {
        expect(result.operations.someOperation2.description).toBe('root description')
      }
    })

    it('should merge complex operation traits with bindings', async () => {
      const spec = {
        asyncapi: '3.0.0',
        info: {
          title: 'Test',
          version: '1.0',
        },
        channels: {
          channel1: {}
        },
        operations: {
          complexOp: {
            action: 'receive',
            channel: {
              $ref: '#/channels/channel1'
            },
            traits: [
              {
                summary: 'trait summary',
                bindings: {
                  kafka: {
                    clientId: {}
                  }
                }
              },
              {
                description: 'trait description',
                bindings: {
                  kafka: {
                    groupId: {}
                  }
                }
              }
            ]
          }
        }
      }

      const unifierResult: any = normalize(spec)
      const parserResult = await parseAsyncApiAndAssertValid(spec)

      // Verify all properties merged correctly (same for normalize result and parser)
      for (const result of [unifierResult, parserResult]) {
        expect(result.operations.complexOp.summary).toBe('trait summary')
        expect(result.operations.complexOp.description).toBe('trait description')
        expect(result.operations.complexOp.bindings).toEqual({
          kafka: {
            clientId: {},  // from first trait
            groupId: {}    // from second trait (merged)
          }
        })
      }
    })
  })

  describe('message traits merging', () => {
    it('should merge message traits in channels', async () => {
      const spec = {
        asyncapi: '3.0.0',
        info: {
          title: 'Test',
          version: '1.0',
        },
        channels: {
          someChannel1: {
            messages: {
              someMessage: {
                traits: [
                  {
                    summary: 'trait summary',
                    description: 'trait description'
                  },
                  {
                    description: 'last description'
                  }
                ]
              }
            }
          }
        }
      }

      const unifierResult: any = normalize(spec)
      const parserResult = await parseAsyncApiAndAssertValid(spec)

      // Verify merge: summary from first trait, description from second (same for unifier and parser)
      for (const result of [unifierResult, parserResult]) {
        expect(result.channels.someChannel1.messages.someMessage.summary).toBe('trait summary')
        expect(result.channels.someChannel1.messages.someMessage.description).toBe('last description')
      }
    })

    it('should merge message with root properties overriding traits', async () => {
      const spec = {
        asyncapi: '3.0.0',
        info: {
          title: 'Test',
          version: '1.0',
        },
        channels: {
          someChannel2: {
            messages: {
              someMessage: {
                summary: 'root summary',
                description: 'root description',
                traits: [
                  {
                    summary: 'trait summary',
                    description: 'trait description'
                  },
                  {
                    description: 'another trait description'
                  }
                ]
              }
            }
          }
        }
      }

      const unifierResult: any = normalize(spec)
      const parserResult = await parseAsyncApiAndAssertValid(spec)

      // Verify root properties win (same for unifier and parser)
      for (const result of [unifierResult, parserResult]) {
        expect(result.channels.someChannel2.messages.someMessage.summary).toBe('root summary')
        expect(result.channels.someChannel2.messages.someMessage.description).toBe('root description')
      }
    })

    it('should merge message traits in components', async () => {
      const spec = {
        asyncapi: '3.0.0',
        info: {
          title: 'Test',
          version: '1.0',
        },
        components: {
          messages: {
            someMessage1: {
              traits: [
                {
                  summary: 'trait summary',
                  description: 'trait description'
                },
                {
                  description: 'last description'
                }
              ]
            },
            someMessage2: {
              summary: 'root summary',
              description: 'root description',
              traits: [
                {
                  summary: 'trait summary',
                  description: 'trait description'
                },
                {
                  description: 'another description'
                }
              ]
            }
          }
        }
      }

      const unifierResult: any = normalize(spec)
      const parserResult = await parseAsyncApiAndAssertValid(spec)

      // Message 1: traits only; Message 2: root overrides traits (same for unifier and parser)
      for (const result of [unifierResult, parserResult]) {
        expect(result.components.messages.someMessage1.summary).toBe('trait summary')
        expect(result.components.messages.someMessage1.description).toBe('last description')
        expect(result.components.messages.someMessage2.summary).toBe('root summary')
        expect(result.components.messages.someMessage2.description).toBe('root description')
      }
    })
  })

  describe('origins tracking', () => {
    it('should track origins for properties from traits', async () => {
      const spec = {
        asyncapi: '3.0.0',
        info: {
          title: 'Test',
          version: '1.0',
        },
        channels: {
          channel1: {}
        },
        operations: {
          op1: {
            action: 'send',
            channel: {
              $ref: '#/channels/channel1'
            },
            traits: [
              {
                description: 'trait description',
                summary: 'trait summary'
              }
            ]
          }
        }
      }

      await parseAsyncApiAndAssertValid(spec)

      const result: any = normalize(spec, { originsFlag: TEST_ORIGINS_FLAG })

      // Check origins are tracked
      commonOriginsCheck(result, { source: spec })

      checkOriginsAreTheSame(result.operations.op1, result.operations.op1.traits[0], 'description', TEST_ORIGINS_FLAG)
      checkOriginsAreTheSame(result.operations.op1, result.operations.op1.traits[0], 'summary', TEST_ORIGINS_FLAG)

      const resultWithHmr = convertOriginToHumanReadable(result, TEST_ORIGINS_FLAG)

      expect(resultWithHmr).toHaveProperty(
        ['operations', 'op1', TEST_ORIGINS_FLAG, 'description'],
        ['operations/op1/traits/0/description']
      )
      expect(resultWithHmr).toHaveProperty(
        ['operations', 'op1', TEST_ORIGINS_FLAG, 'summary'],
        ['operations/op1/traits/0/summary']
      )
    })

    it('should track origins for root properties overriding traits', async () => {
      const spec = {
        asyncapi: '3.0.0',
        info: {
          title: 'Test',
          version: '1.0',
        },
        channels: {
          channel1: {}
        },
        operations: {
          op1: {
            action: 'send',
            channel: {
              $ref: '#/channels/channel1'
            },
            description: 'root description',
            traits: [
              {
                description: 'trait description',
                summary: 'trait summary'
              }
            ]
          }
        }
      }

      await parseAsyncApiAndAssertValid(spec)

      const result: any = normalize(spec, { originsFlag: TEST_ORIGINS_FLAG })

      commonOriginsCheck(result, { source: spec })

      checkOriginsAreTheSame(result.operations.op1, result.operations.op1.traits[0], 'summary', TEST_ORIGINS_FLAG)

      const resultWithHmr = convertOriginToHumanReadable(result, TEST_ORIGINS_FLAG)

      // Verify description origin points to root (not traits)
      expect(resultWithHmr).toHaveProperty(
        ['operations', 'op1', TEST_ORIGINS_FLAG, 'description'],
        ['operations/op1/description']
      )

      // Verify summary origin points to traits
      expect(resultWithHmr).toHaveProperty(
        ['operations', 'op1', TEST_ORIGINS_FLAG, 'summary'],
        ['operations/op1/traits/0/summary']
      )
    })

    it('should track origins for nested objects from traits', async () => {
      const spec = {
        asyncapi: '3.0.0',
        info: {
          title: 'Test',
          version: '1.0',
        },
        channels: {
          channel1: {}
        },
        operations: {
          op1: {
            action: 'send',
            channel: {
              $ref: '#/channels/channel1'
            },
            traits: [
              {
                bindings: {
                  kafka: {
                    clientId: {}
                  }
                }
              }
            ]
          }
        }
      }

      await parseAsyncApiAndAssertValid(spec)

      const result: any = normalize(spec, { originsFlag: TEST_ORIGINS_FLAG })

      commonOriginsCheck(result, { source: spec })

      checkOriginsAreTheSame(result.operations.op1, result.operations.op1.traits[0], 'bindings', TEST_ORIGINS_FLAG)
      checkOriginsAreTheSame(result.operations.op1.bindings.kafka, result.operations.op1.traits[0].bindings.kafka, 'clientId', TEST_ORIGINS_FLAG)

      const resultWithHmr = convertOriginToHumanReadable(result, TEST_ORIGINS_FLAG)

      // Verify bindings origin
      expect(resultWithHmr).toHaveProperty(
        ['operations', 'op1', TEST_ORIGINS_FLAG, 'bindings'],
        ['operations/op1/traits/0/bindings']
      )
      expect(resultWithHmr).toHaveProperty(
        ['operations', 'op1', 'bindings', 'kafka', TEST_ORIGINS_FLAG, 'clientId'],
        ['operations/op1/traits/0/bindings/kafka/clientId']
      )
    })

    it('should track origins from shared trait in components for multiple operations', async () => {
      const spec = {
        asyncapi: '3.0.0',
        info: {
          title: 'Test',
          version: '1.0',
        },
        channels: {
          channel1: {},
          channel2: {}
        },
        operations: {
          operation1: {
            action: 'send',
            channel: {
              $ref: '#/channels/channel1'
            },
            traits: [
              {
                $ref: '#/components/operationTraits/commonTrait'
              }
            ]
          },
          operation2: {
            action: 'receive',
            channel: {
              $ref: '#/channels/channel2'
            },
            traits: [
              {
                $ref: '#/components/operationTraits/commonTrait'
              }
            ]
          }
        },
        components: {
          operationTraits: {
            commonTrait: {
              description: 'shared trait description',
              bindings: {
                kafka: {
                  clientId: {
                    type: 'string'
                  },
                  groupId: {
                    type: 'string'
                  }
                }
              }
            }
          }
        }
      }

      await parseAsyncApiAndAssertValid(spec)

      const result: any = normalize(spec, { originsFlag: TEST_ORIGINS_FLAG })

      // Check origins are tracked
      commonOriginsCheck(result, { source: spec })

      // Both operations should have the merged properties from the shared trait
      expect(result.operations.operation1.description).toBe('shared trait description')
      expect(result.operations.operation2.description).toBe('shared trait description')

      // Check origin identity: both operations should point to the SAME origin object for root properties
      checkOriginsAreTheSame(
        result.operations.operation1,
        result.operations.operation1.traits[0],
        'description',
        TEST_ORIGINS_FLAG
      )
      checkOriginsAreTheSame(
        result.operations.operation2,
        result.operations.operation2.traits[0],
        'description',
        TEST_ORIGINS_FLAG
      )

      // Check origin identity for nested properties (bindings)
      checkOriginsAreTheSame(
        result.operations.operation1,
        result.operations.operation1.traits[0],
        'bindings',
        TEST_ORIGINS_FLAG
      )
      checkOriginsAreTheSame(
        result.operations.operation2,
        result.operations.operation2.traits[0],
        'bindings',
        TEST_ORIGINS_FLAG
      )
      checkOriginsAreTheSame(
        result.operations.operation1.bindings.kafka,
        result.operations.operation1.traits[0].bindings.kafka,
        'clientId',
        TEST_ORIGINS_FLAG
      )
      checkOriginsAreTheSame(
        result.operations.operation1.bindings.kafka,
        result.operations.operation1.traits[0].bindings.kafka,
        'groupId',
        TEST_ORIGINS_FLAG
      )
      checkOriginsAreTheSame(
        result.operations.operation2.bindings.kafka,
        result.operations.operation2.traits[0].bindings.kafka,
        'clientId',
        TEST_ORIGINS_FLAG
      )
      checkOriginsAreTheSame(
        result.operations.operation2.bindings.kafka,
        result.operations.operation2.traits[0].bindings.kafka,
        'groupId',
        TEST_ORIGINS_FLAG
      )

      // Verify human-readable origins point to the component trait
      const resultWithHmr = convertOriginToHumanReadable(result, TEST_ORIGINS_FLAG)

      // Check HMR for operation1 root properties
      expect(resultWithHmr).toHaveProperty(
        ['operations', 'operation1', TEST_ORIGINS_FLAG, 'description'],
        ['components/operationTraits/commonTrait/description']
      )

      // Check HMR for operation2 root properties
      expect(resultWithHmr).toHaveProperty(
        ['operations', 'operation2', TEST_ORIGINS_FLAG, 'description'],
        ['components/operationTraits/commonTrait/description']
      )

      // Check HMR for operation1 nested properties (bindings)
      expect(resultWithHmr).toHaveProperty(
        ['operations', 'operation1', TEST_ORIGINS_FLAG, 'bindings'],
        ['components/operationTraits/commonTrait/bindings']
      )
      expect(resultWithHmr).toHaveProperty(
        ['operations', 'operation1', 'bindings', 'kafka', TEST_ORIGINS_FLAG, 'clientId'],
        ['components/operationTraits/commonTrait/bindings/kafka/clientId']
      )
      expect(resultWithHmr).toHaveProperty(
        ['operations', 'operation1', 'bindings', 'kafka', TEST_ORIGINS_FLAG, 'groupId'],
        ['components/operationTraits/commonTrait/bindings/kafka/groupId']
      )

      // Check HMR for operation2 nested properties (bindings)
      expect(resultWithHmr).toHaveProperty(
        ['operations', 'operation2', TEST_ORIGINS_FLAG, 'bindings'],
        ['components/operationTraits/commonTrait/bindings']
      )
      expect(resultWithHmr).toHaveProperty(
        ['operations', 'operation2', 'bindings', 'kafka', TEST_ORIGINS_FLAG, 'clientId'],
        ['components/operationTraits/commonTrait/bindings/kafka/clientId']
      )
      expect(resultWithHmr).toHaveProperty(
        ['operations', 'operation2', 'bindings', 'kafka', TEST_ORIGINS_FLAG, 'groupId'],
        ['components/operationTraits/commonTrait/bindings/kafka/groupId']
      )
    })
  })

  describe('edge cases', () => {
    it('should handle empty traits array', async () => {
      const spec = {
        asyncapi: '3.0.0',
        info: {
          title: 'Test',
          version: '1.0',
        },
        channels: {
          channel1: {}
        },
        operations: {
          op1: {
            action: 'send',
            channel: {
              $ref: '#/channels/channel1'
            },
            description: 'root description',
            traits: []
          }
        }
      }

      const unifierResult: any = normalize(spec)
      const parserResult = await parseAsyncApiAndAssertValid(spec)

      for (const result of [unifierResult, parserResult]) {
        expect(result.operations.op1.description).toBe('root description')
      }
    })

    it('should handle object without traits property', async () => {
      const spec = {
        asyncapi: '3.0.0',
        info: {
          title: 'Test',
          version: '1.0',
        },
        channels: {
          channel1: {}
        },
        operations: {
          op1: {
            action: 'send',
            channel: {
              $ref: '#/channels/channel1'
            },
            description: 'root description'
          }
        }
      }

      const unifierResult: any = normalize(spec)
      const parserResult = await parseAsyncApiAndAssertValid(spec)

      for (const result of [unifierResult, parserResult]) {
        expect(result.operations.op1.description).toBe('root description')
      }
    })
  })

  describe('option flags', () => {
    it('should skip merging when mergeTraits is false', async () => {
      const spec = {
        asyncapi: '3.0.0',
        info: {
          title: 'Test',
          version: '1.0',
        },
        channels: {
          channel1: {}
        },
        operations: {
          op1: {
            action: 'send',
            channel: {
              $ref: '#/channels/channel1'
            },
            traits: [
              {
                description: 'trait description'
              }
            ]
          }
        }
      }

      await parseAsyncApiAndAssertValid(spec)

      const result: any = normalize(spec, { mergeTraits: false })

      // Traits should not be merged
      expect(result.operations.op1.traits).toBeArray()
      expect(result.operations.op1.traits).toHaveLength(1)
      // Description should not be present at root level
      expect(result.operations.op1).not.toHaveProperty('description')
    })

    it('should merge when mergeTraits is true (default)', async () => {
      const spec = {
        asyncapi: '3.0.0',
        info: {
          title: 'Test',
          version: '1.0',
        },
        channels: {
          channel1: {}
        },
        operations: {
          op1: {
            action: 'send',
            channel: {
              $ref: '#/channels/channel1'
            },
            traits: [
              {
                description: 'trait description'
              }
            ]
          }
        }
      }

      const unifierResult: any = normalize(spec, { mergeTraits: true })
      const parserResult = await parseAsyncApiAndAssertValid(spec)

      // Traits should be merged (same for unifier and parser)
      for (const result of [unifierResult, parserResult]) {
        expect(result.operations.op1.description).toBe('trait description')
        expect(result.operations.op1.traits).toBeArray()
      }
    })
  })

  describe('null handling check', () => {
    type ExtensionValue = undefined | null | 'value'
    const VALUE: ExtensionValue = 'value'

    function sampleAsyncAPISpecWithNulls(values: [ExtensionValue, ExtensionValue, ExtensionValue], nested: boolean): Input {
      const pathPrefixes = [
        ['operations', 'op1', 'traits', 0],
        ['operations', 'op1', 'traits', 1],
        ['operations', 'op1'],
      ]
      const nestedPathFragment = ['bindings', 'kafka']

      const paths = pathPrefixes.map(prefix =>
        nested
          ? [...prefix, ...nestedPathFragment, 'x-test']
          : [...prefix, 'x-test']
      )

      const spec = {
        asyncapi: '3.0.0',
        info: { title: 'Test', version: '1.0' },
        channels: { channel1: {} },
        operations: {
          op1: {
            action: 'send',
            channel: { $ref: '#/channels/channel1' },
          }
        }
      }

      for (let i = 0; i < paths.length; i++) {
        setValueAtPath(spec, paths[i], values[i])
      }
      return spec
    }

    // trait1Value, trait2Value, operationValue, expectedValue
    const TRAITS_MERGE_NULL_TEST_DATA: [ExtensionValue, ExtensionValue, ExtensionValue, ExtensionValue][] = [
      [undefined, undefined, null, null],
      [undefined, null, undefined, null],
      [undefined, null, null, null],
      [undefined, null, VALUE, VALUE],
      [undefined, VALUE, null, null],
      [null, undefined, undefined, null],
      [null, undefined, null, null],
      [null, undefined, VALUE, VALUE],
      [null, null, undefined, null],
      [null, null, null, null],
      [null, null, VALUE, VALUE],
      [null, VALUE, undefined, VALUE],
      [null, VALUE, null, null],
      [null, VALUE, VALUE, VALUE],
      [VALUE, undefined, null, null],
      [VALUE, null, undefined, null],
      [VALUE, null, null, null],
      [VALUE, null, VALUE, VALUE],
      [VALUE, VALUE, null, null],
      [VALUE, VALUE, VALUE, VALUE],
    ]
    it.each(TRAITS_MERGE_NULL_TEST_DATA)(
      'root property merged value equals expected when (trait1Value, trait2Value, operationValue) = (%s, %s, %s)',
      async (trait1Val, trait2Val, opVal, expected) => {
        const spec = sampleAsyncAPISpecWithNulls([trait1Val, trait2Val, opVal], false)

        const unifierResult: any = normalize(spec)
        const parserResult = await parseAsyncApiAndAssertValid(spec)

        for (const result of [unifierResult, parserResult]) {
          if (expected === undefined) {
            expect(result).not.toHaveProperty(['operations', 'op1', 'x-test'])
          } else {
            expect(result).toHaveProperty(['operations', 'op1', 'x-test'], expected)
          }
        }
      }
    )

    it.each(TRAITS_MERGE_NULL_TEST_DATA)(
      'nested property merged value equals expected when (trait1Value, trait2Value, operationValue) = (%s, %s, %s)',
      async (trait1Val, trait2Val, opVal, expected) => {
        const spec = sampleAsyncAPISpecWithNulls([trait1Val, trait2Val, opVal], true)

        const unifierResult: any = normalize(spec)
        const parserResult = await parseAsyncApiAndAssertValid(spec)

        for (const result of [unifierResult, parserResult]) {
          // note that for root properties and nested properties the behaviour of @asyncapi/parser is different
          // current behaviour of api-unifier is aligned with @asyncapi/parser
          // see https://github.com/asyncapi/spec/issues/1178
          if (expected === undefined || expected === null) {
            expect(result).not.toHaveProperty(['operations', 'op1', 'bindings', 'kafka', 'x-test'])
          } else {
            expect(result).toHaveProperty(['operations', 'op1', 'bindings', 'kafka', 'x-test'], expected)
          }
        }
      }
    )
  })
})
