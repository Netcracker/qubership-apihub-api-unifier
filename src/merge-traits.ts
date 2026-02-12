import { isArray, isObject, JSON_ROOT_KEY, syncClone } from '@netcracker/qubership-apihub-json-crawl'

import {
  DEFAULT_OPTION_MERGE_TRAITS,
  DEFAULT_OPTION_ORIGINS_ALREADY_DEFINED,
  InternalMergeTraitsOptions,
  MergeTraitsOptions,
  MergeTraitsState,
  MergeTraitsSyncCloneHook,
  NormalizationRule,
  NormalizationRules,
  ResolveOptions,
} from './types'
import { mergePatchWithOrigins, copySymbolProperties } from './utils'
import { resolveSpec, SPEC_TYPE_ASYNCAPI_3 } from './spec-type'
import { createCycledJsoHandlerHook } from './cycle-jso'
import { RULES } from './rules'
import { createSelfOriginsCloneHook } from './origins'
import { ASYNCAPI_PROPERTY_TRAITS } from './rules/asyncapi.const'

export const mergeTraits = (value: unknown, options?: MergeTraitsOptions & ResolveOptions) => {
  const spec = resolveSpec(value)

  // Short-circuit for non-AsyncAPI specs
  if (spec.type !== SPEC_TYPE_ASYNCAPI_3) {
    return value
  }

  const internalMergeTraitsOptions: InternalMergeTraitsOptions = {
    mergeTraits: DEFAULT_OPTION_MERGE_TRAITS,
    originsAlreadyDefined: DEFAULT_OPTION_ORIGINS_ALREADY_DEFINED,
    ...options,
    ignoreSymbols: new Set([
      ...(options?.originsFlag ? [options.originsFlag] : []),
      ...(options?.inlineRefsFlag ? [options.inlineRefsFlag] : []),
      ...(options?.syntheticTitleFlag ? [options.syntheticTitleFlag] : []),
      ...(options?.syntheticAllOfFlag ? [options.syntheticAllOfFlag] : []),
      ...(options?.referenceNameProperty ? [options.referenceNameProperty] : []),
      ...(options?.ignoreSymbols ? options.ignoreSymbols : []),
    ]),
  }

  const cycledJsoHandlerHook = createCycledJsoHandlerHook<MergeTraitsState, NormalizationRule>()
  return syncClone(
    value,
    [
      cycledJsoHandlerHook,
      createMergeTraitsHook(internalMergeTraitsOptions),
      cycledJsoHandlerHook,
      createSelfOriginsCloneHook(internalMergeTraitsOptions.originsFlag),
    ],
    {
      rules: RULES[spec.type] || {},
      state: { ignoreTreeUnderSymbols: false, selfOriginResolver: () => [] }
    }
  )
}

/**
 * Check if the current rules have a mergeTraits flag at the /traits path
 */
const isTraitsMergeRule = (rules?: NormalizationRules): boolean => {
  return !!rules && !!rules[`/${ASYNCAPI_PROPERTY_TRAITS}`] && ('mergeTraits' in rules[`/${ASYNCAPI_PROPERTY_TRAITS}`])
}

/**
 * Create the hook that applies traits merging to objects
 * This implements the exact logic from applyTraitsToObjectV3 in @asyncapi/parser
 */
const createMergeTraitsHook = (options: InternalMergeTraitsOptions): MergeTraitsSyncCloneHook => {
  const traitsResolver: MergeTraitsSyncCloneHook = ({ value, key, path, rules, state }) => {

    if (state.ignoreTreeUnderSymbols) {
      return { value }
    }

    const safeKey = key ?? JSON_ROOT_KEY
    if (typeof safeKey === 'symbol' && options.ignoreSymbols.has(safeKey)) {
      return {
        value,
        state: { ...state, ignoreTreeUnderSymbols: true },
      }
    }

    // Skip if not object or array
    if (!isObject(value) || isArray(value)) {
      return { value }
    }

    // Check if this node has a /traits path with mergeTraits rule
    if (!isTraitsMergeRule(rules)) {
      return { value }
    }

    // Check if the object has a traits array property
    const traits = value[ASYNCAPI_PROPERTY_TRAITS]
    if (!isArray(traits)) {
      return { value }
    }

    // Apply traits merging - optimized to only process properties that appear in traits
    // Merge traits disrupts reference equality on the objects, so some properties of the original object
    // are not in traits- we want them intact
    // Step 1: Collect all top-level properties from all trait objects
    const traitProperties = new Set<string>()
    for (const trait of traits) {
      if (isObject(trait) && !isArray(trait)) {
        for (const k in trait) {
          traitProperties.add(k)
        }
      }
    }

    // Step 2: Create shallow copy (including symbols) and delete properties that are not in traits
    // since they are kept on original object and need not to be processed by merge patch
    const copy = { ...value }
    for (const k in value) {
      if (!traitProperties.has(k)) {
        delete copy[k]
      }
    }

    // Step 3: Delete ONLY properties that exist in traits from the original object
    // Properties not in any trait stay intact on the base object
    for (const k of traitProperties) {
      if (k in value) {
        delete value[k]
      }
    }

    // Step 4: Merge traits THEN root object (this ensures root properties override trait properties)
    // This is the key part that ensures AsyncAPI spec compliance:
    // "A property on a trait MUST NOT override the same property on the target object"
    const itemsToMerge = [...traits, copy]

    // Create a set of symbols to skip when copying symbol properties
    // originsFlag is managed by separate origins clone hooks and should not be copied here
    const skipSymbols = new Set<symbol>()
    if (options.originsFlag) {
      skipSymbols.add(options.originsFlag)
    }

    // Merge values from traits and root object to the target
    itemsToMerge.forEach((item) => {
      // First, copy symbol properties from the item to value (before merging regular properties)
      // This ensures symbols at the root level of each trait/object are preserved
      copySymbolProperties(item, value, skipSymbols)

      // Then merge regular properties recursively
      // The copySymbolProperties inside mergePatchWithOrigins will handle symbols at deeper levels
      for (const k in item) {
        mergePatchWithOrigins(item, value, String(k), options.originsFlag, skipSymbols)
      }
    })

    return { value }
  }

  return traitsResolver
}
