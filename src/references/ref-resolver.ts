import {
  ChainItem,
  DefineOriginsAndResolveRefState,
  InternalResolveOptions,
  NormalizationRule,
  OriginsMetaRecord,
  ReferenceHandler,
  RefErrorTypes,
  RichReference,
} from '../types'
import { CloneState, CrawlHookResponse, CrawlRules, isObject, JsonPath } from '@netcracker/qubership-apihub-json-crawl'
import { OPEN_API_PROPERTY_DESCRIPTION, OPEN_API_PROPERTY_SUMMARY } from '../rules/openapi.const'
import {
  evaluateSyntheticTitle,
  getOrReuseOrigin,
  ResolvedRef,
  SyntheticAllOf,
} from '../define-origins-and-resolve-ref'
import { OpenApiSpecVersion } from '../spec-type'
import { ErrorMessage } from '../errors'
import { JSON_SCHEMA_PROPERTY_ALL_OF } from '../rules/jsonschema.const'
import { setJsoProperty } from '../utils'

export type ReferenceObjectResolverOverrideField =
  | typeof OPEN_API_PROPERTY_DESCRIPTION
  | typeof OPEN_API_PROPERTY_SUMMARY

export type ReferenceResolverResponse =
  void
  | CrawlHookResponse<CloneState<DefineOriginsAndResolveRefState>, NormalizationRule>
export type ResolvedRefWithSibling = ResolvedRefSibling | ResolvedRefAllOf
export type ReferenceResolverHandler = (data: ResolvedRefData) => ResolvedRefWithSibling

export interface ReferenceObjectRuleData {
  version: OpenApiSpecVersion,
  allowOverrides?: ReferenceObjectResolverOverrideField[]
}

export interface ReferenceResolverContext {
  value: unknown,
  safeKey: PropertyKey,
  ref: any,
  path: JsonPath,
  state: CloneState<DefineOriginsAndResolveRefState>,
  options: InternalResolveOptions,
}

export interface ReferenceResolverContextWithDefaultResolver extends ReferenceResolverContext {
  resolveDefaultReference: (referenceResolverContext: ReferenceResolverContext, referenceHandler: ReferenceResolverHandler) => ReferenceResolverResponse,
}

export interface ResolvedRefSibling extends ResolvedRef {
  childrenOrigins: OriginsMetaRecord
}

export interface ResolvedRefAllOf extends ResolvedRef {
  titleIndex: number
  refIndex: number
  siblingIndex: number
}

export interface ResolvedRefData {
  options: InternalResolveOptions,
  state: CloneState<DefineOriginsAndResolveRefState>,
  resolvedRef: ResolvedRef,
  originForObj: ChainItem,
  sibling: Record<PropertyKey, unknown>,
  rules: CrawlRules<NormalizationRule> | undefined,
  syntheticTitleCache: Map<string, Record<PropertyKey, unknown>>,
  reference: RichReference,
}

export const notAllowedReferenceHandler: ReferenceHandler = args => forbidReferenceResolver(args)
export const jsonSchemaReferenceResolverHandler: ReferenceHandler = args => resolveJsonSchemaReferenceWithAllOf(args)
export const referenceObjectResolverHandler: ReferenceHandler = referenceObjectResolver()

export function forbidReferenceResolver({
  options,
  state,
  safeKey,
  ref,
  path,
  value,
}: ReferenceResolverContextWithDefaultResolver): ReferenceResolverResponse {
  options.onRefResolveError?.(ErrorMessage.referenceNotAllowed(ref), path, ref, RefErrorTypes.RICH_REF_NOT_ALLOWED)
  state.node[safeKey] = value
  return { done: true }
}

export function referenceObjectResolver(overrides?: ReferenceObjectResolverOverrideField[]): ReferenceHandler {
  return (data: ReferenceResolverContextWithDefaultResolver): ReferenceResolverResponse => {
    const overrideFieldsWithSiblings = ({
      options,
      state,
      resolvedRef,
      originForObj,
      sibling,
    }: ResolvedRefData): ResolvedRefWithSibling => {
      const { refValue, origin } = resolvedRef
      const referenceValue = refValue as Record<PropertyKey, unknown>

      const childrenOrigins: OriginsMetaRecord = {}
      if (!overrides?.length || !isObject(sibling)) {
        return { refValue: referenceValue, origin, childrenOrigins }
      }

      let modifiedReferenceValue = false
      const newResult = { ...referenceValue }

      overrides.forEach(field => {
        if (field in sibling) {
          const siblingField = sibling[field]
          newResult[field] = siblingField
          modifiedReferenceValue = true
          options.originsFlag && getOrReuseOrigin(siblingField, originForObj, state.originCache)
          childrenOrigins[field] = [originForObj]
        }
      })
      const finalRef = modifiedReferenceValue ? newResult : referenceValue
      return { refValue: finalRef, origin, childrenOrigins }
    }
    const { resolveDefaultReference, ...referenceData } = data
    return resolveDefaultReference(referenceData, overrideFieldsWithSiblings)
  }
}

export const resolveJsonSchemaReferenceWithAllOf = (data: ReferenceResolverContextWithDefaultResolver): ReferenceResolverResponse => {
  const wrapRefWithAllOfIfNeed = ({
    options,
    state,
    resolvedRef,
    originForObj,
    sibling,
    rules,
    syntheticTitleCache,
    reference,
  }: ResolvedRefData): ResolvedRefWithSibling => {
    const { refValue, origin } = resolvedRef
    const referenceValue = refValue as Record<PropertyKey, unknown>

    const wrap: SyntheticAllOf & Record<PropertyKey, unknown> = { [JSON_SCHEMA_PROPERTY_ALL_OF]: [] }
    options.originsFlag && getOrReuseOrigin(wrap, originForObj, state.originCache)
    options.originsFlag && getOrReuseOrigin(wrap[JSON_SCHEMA_PROPERTY_ALL_OF], originForObj, state.originCache)
    options.syntheticAllOfFlag && setJsoProperty(wrap, options.syntheticAllOfFlag, true)
    let titleIndex = -1
    let refIndex = 0
    let siblingIndex = -1
    if (options.syntheticTitleFlag && rules?.resolvedReferenceNamePropertyKey) {
      let syntheticTitle = syntheticTitleCache?.get(reference.normalized)
      if (syntheticTitle === undefined) {
        syntheticTitle = evaluateSyntheticTitle(reference.jsonPath, options.syntheticTitleFlag, rules.resolvedReferenceNamePropertyKey)
        syntheticTitleCache.set(reference.normalized, syntheticTitle)
        state.lazySourceOriginCollector.set(syntheticTitle, { [rules.resolvedReferenceNamePropertyKey]: origin ? [origin] : [] })
      }
      wrap.allOf.push(syntheticTitle)
      titleIndex = 0
      refIndex++
    }
    wrap.allOf.push(referenceValue)
    options.originsFlag && getOrReuseOrigin(referenceValue, originForObj, state.originCache)
    if (Reflect.ownKeys(sibling).length) {
      wrap.allOf.push(sibling)
      siblingIndex = refIndex + 1
      options.originsFlag && getOrReuseOrigin(sibling, originForObj, state.originCache)
    }
    return wrap.allOf.length === 1
      ? { refValue: referenceValue, origin, childrenOrigins: {} }
      : { refValue: wrap, titleIndex, refIndex, siblingIndex, origin }
  }
  const { resolveDefaultReference, ...referenceData } = data
  return resolveDefaultReference(referenceData, wrapRefWithAllOfIfNeed)
}
