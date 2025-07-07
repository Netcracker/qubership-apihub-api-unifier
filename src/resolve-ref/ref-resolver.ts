import {
  ChainItem,
  DefineOriginsAndResolveRefState,
  InternalResolveOptions,
  ReferenceResolver,
  RichReference,
} from '../types'
import { CloneState, CrawlRules } from '@netcracker/qubership-apihub-json-crawl'
import { OPEN_API_PROPERTY_DESCRIPTION, OPEN_API_PROPERTY_SUMMARY } from '../rules/openapi.const'
import {
  ResolvedRefWithSibling,
  ResolvedRef,
  resolveReferenceObjectWithOverrides,
  wrapRefWithAllOfIfNeed,
} from '../define-origins-and-resolve-ref'

export type Override =
  | typeof OPEN_API_PROPERTY_DESCRIPTION
  | typeof OPEN_API_PROPERTY_SUMMARY

export function referenceObject31ReferenceResolver<R extends {}>(...overrides: Override[]): ReferenceResolver<CloneState<DefineOriginsAndResolveRefState>, R> {
  return (
    options: InternalResolveOptions,
    state: CloneState<DefineOriginsAndResolveRefState>,
    rules: CrawlRules<R> | undefined,
    refInResultedJso: ResolvedRef,
    originForObj: ChainItem,
    sibling: Record<PropertyKey, unknown>,
    syntheticTitleCache: Map<string, Record<PropertyKey, unknown>>,
    reference: RichReference,
  ): ResolvedRefWithSibling => {
    return resolveReferenceObjectWithOverrides(
      overrides,
      options,
      state,
      rules,
      refInResultedJso,
      originForObj,
      sibling,
      syntheticTitleCache,
      reference,
    )
  }
}

export function schemaRefResolver<R extends {}>(): ReferenceResolver<CloneState<DefineOriginsAndResolveRefState>, R> {
  return (
    options: InternalResolveOptions,
    state: CloneState<DefineOriginsAndResolveRefState>,
    rules: CrawlRules<R> | undefined,
    refInResultedJso: ResolvedRef,
    originForObj: ChainItem,
    sibling: Record<PropertyKey, unknown>,
    syntheticTitleCache: Map<string, Record<PropertyKey, unknown>>,
    reference: RichReference,
  ): ResolvedRefWithSibling => {
    return wrapRefWithAllOfIfNeed(
      options,
      state,
      rules,
      refInResultedJso,
      originForObj,
      sibling,
      syntheticTitleCache,
      reference,
    )
  }
}