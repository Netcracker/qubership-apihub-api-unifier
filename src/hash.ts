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

  const cycleGuard: Set<unknown> = new Set()
  const optionalFieldStates = new Map<any, ObjPath>()

  const generateHash = (value: any, flag: symbol, optionalFields?: ObjPath): string => {
    return cryptoMd5(objectToString(value, flag, optionalFields))
  }

  const hashHook: HashScannerCrawlHook = ({ key, value, rules, state }) => {
    if (typeof key === 'symbol') {
      return { done: true, state: { ...state, fieldsForOptionalHash: [] } }
    }
    if (!rules) {
      state.fieldsForOptionalHash.push(key)
      return { done: true }
    }
    const ignoreKey = rules.noHash
    ignoreKey && state.fieldsForOptionalHash.push(key)
    if (!isObject(value)) {
      return { done: true, value }
    }
    const nestedFieldsForOptionalHash = optionalFieldStates.get(value) || []
    if (!optionalFieldStates.has(value)) {
      optionalFieldStates.set(value, nestedFieldsForOptionalHash)
    }

    const done = !(!cycleGuard.has(value) && cycleGuard.add(value))
    return {
      done,
      value,
      state: { ...state, fieldsForOptionalHash: nestedFieldsForOptionalHash },
      exitHook: () => {
        if (hashProperty) {
          value[hashProperty] = generateHash(value, hashProperty)
        }

        // even if the optionalFields are empty, it is necessary to calculate the hash again,
        // since its children may have optional fields and their hash will be different.
        if (semanticHashProperty) {
          value[semanticHashProperty] = generateHash(value, semanticHashProperty, nestedFieldsForOptionalHash)
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
  const semanticHashFlag = options?.semanticHashProperty
  const hashFlag = options?.hashProperty
  if (!semanticHashFlag && !hashFlag) {
    return value
  }
  const spec = resolveSpec(value)
  if (spec.type === SPEC_TYPE_GRAPH_API) {
    return value //cause not implemented
  }
  syncCrawl<HashScannerCrawlState, NormalizationRule>(
    value,
    [createHashObjectCreatorHook(internalOptions)],
    { state: { fieldsForOptionalHash: [] }, rules: RULES[spec.type] },
  )

  return value
}

export const deHash = (value: unknown, options?: HashOptions) => {
  const semanticHashFlag = options?.semanticHashProperty
  const hashFlag = options?.hashProperty
  if (!semanticHashFlag && !hashFlag) {
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
    if (semanticHashFlag && semanticHashFlag in value) {delete value[semanticHashFlag]}
    if (hashFlag && hashFlag in value) { delete value[hashFlag] }
    //todo del after tests
    if (optionalFieldFlag in value) { delete value[optionalFieldFlag] }
    return { value }
  })
  return value
}
