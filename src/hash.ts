import { HashOptions, InternalHashOptions, NormalizationRule } from './types'
import { resolveSpec, SPEC_TYPE_GRAPH_API } from './spec-type'
import { isObject, syncCrawl, SyncCrawlHook } from '@netcracker/qubership-apihub-json-crawl'
import { RULES } from './rules'
import { cryptoMd5, objectToString } from './utils'

export type ObjPath = (string | number)[]

//todo only for tests
const optionalFieldFlag = Symbol('optional-fields')

const createHashObjectCreatorHook: (options: HashOptions) => HashScannerCrawlHook = (options) => {
  const { semanticHashProperty, hashProperty } = options

  const cycleIndexMap: Map<unknown, number> = new Map()
  const optionalFieldStates = new Map<any, ObjPath>()

  const generateHash = (value: any, flag: symbol, cycleIndexMap: Map<unknown, number>, firstOccurrence: boolean, optionalFields?: ObjPath): string => {
    return cryptoMd5(objectToString(value, flag, cycleIndexMap, firstOccurrence, optionalFields))
  }

  const hashHook: HashScannerCrawlHook = ({ key, value, rules, state }) => {
    if (typeof key === 'symbol') {
      return { done: true, state: { ...state, fieldsForOptionalHash: [] } }
    }
    if (!rules) {
      state.fieldsForOptionalHash.push(key)
      return { done: true }
    }
    const ignoreKey = rules.excludeFromSemanticHash
    ignoreKey && state.fieldsForOptionalHash.push(key)
    if (!isObject(value)) {
      return { done: true, value }
    }
    const nestedFieldsForOptionalHash = optionalFieldStates.get(value) || []
    if (!optionalFieldStates.has(value)) {
      optionalFieldStates.set(value, nestedFieldsForOptionalHash)
    }

    const firstOccurrence = !cycleIndexMap.has(value)
    const done = !(firstOccurrence && cycleIndexMap.set(value, cycleIndexMap.size))
    return {
      done,
      value,
      state: { ...state, fieldsForOptionalHash: nestedFieldsForOptionalHash },
      exitHook: () => {
        if (hashProperty) {
          value[hashProperty] = generateHash(value, hashProperty, cycleIndexMap, firstOccurrence)
        }

        // even if the optionalFields are empty, it is necessary to calculate the hash again,
        // since its children may have optional fields and their hash will be different.
        if (semanticHashProperty) {
          value[semanticHashProperty] = generateHash(value, semanticHashProperty, cycleIndexMap, firstOccurrence, nestedFieldsForOptionalHash)
        }

        value[optionalFieldFlag] = nestedFieldsForOptionalHash
      },
    }
  }

  return hashHook
}

type HashScannerCrawlHook = SyncCrawlHook<HashScannerCrawlState, NormalizationRule>

export interface HashScannerCrawlState {
  fieldsForOptionalHash: ObjPath
}

export const hash = (value: unknown, options?: HashOptions) => {
  const internalOptions = {
    ...options,
  } satisfies InternalHashOptions
  const semanticHashProperty = options?.semanticHashProperty
  const hashProperty = options?.hashProperty
  if (!semanticHashProperty && !hashProperty) {
    return value
  }
  const spec = resolveSpec(value)
  syncCrawl<HashScannerCrawlState, NormalizationRule>(
    value,
    [createHashObjectCreatorHook(internalOptions)],
    { state: { fieldsForOptionalHash: [] }, rules: RULES[spec.type] },
  )

  return value
}

export const deHash = (value: unknown, options?: HashOptions) => {
  const semanticHashProperty = options?.semanticHashProperty
  const hashProperty = options?.hashProperty
  if (!semanticHashProperty && !hashProperty) {
    return value
  }
  const cycleGuard: Set<unknown> = new Set()
  syncCrawl(value, ({ value }) => {
    if (!isObject(value)) {
      return { done: true }
    }
    if (cycleGuard.has(value)) {
      return { done: true }
    }
    cycleGuard.add(value)
    if (semanticHashProperty && semanticHashProperty in value) { delete value[semanticHashProperty] }
    if (hashProperty && hashProperty in value) { delete value[hashProperty] }
    //todo del after tests
    if (optionalFieldFlag in value) { delete value[optionalFieldFlag] }
    return { value }
  })
  return value
}
