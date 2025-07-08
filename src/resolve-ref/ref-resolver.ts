import {
  ChainItem,
  DefineOriginsAndResolveRefState,
  InternalResolveOptions,
  NormalizationRule,
  ReferenceHandler,
  RichReference,
} from '../types'
import { CloneState, CrawlRules } from '@netcracker/qubership-apihub-json-crawl'
import { OPEN_API_PROPERTY_DESCRIPTION, OPEN_API_PROPERTY_SUMMARY } from '../rules/openapi.const'
import {
  ResolvedRef,
  ResolvedRefWithSibling,
  resolveReferenceObjectWithOverrides,
  wrapRefWithAllOfIfNeed,
} from '../define-origins-and-resolve-ref'

export type Override =
  | typeof OPEN_API_PROPERTY_DESCRIPTION
  | typeof OPEN_API_PROPERTY_SUMMARY


export const jsonSchemaReferenceResolver: ReferenceHandler<CloneState<DefineOriginsAndResolveRefState>,CrawlRules<NormalizationRule>> = args => wrapRefWithAllOfIfNeed(args)
export const notAllowedReferenceHandler: ReferenceHandler<CloneState<DefineOriginsAndResolveRefState>,CrawlRules<NormalizationRule>> = args => {
  return null
}

export function referenceObjectResolver<T extends  CloneState<DefineOriginsAndResolveRefState>, R extends CrawlRules<NormalizationRule>>(overrides?: {allowOverrides: Override[]}): ReferenceHandler<T, R> {
  return (data: ResolvedRefData<T,R>): ResolvedRefWithSibling => {
    return resolveReferenceObjectWithOverrides(data, overrides?.allowOverrides ?? [])
  }
}

export interface ResolvedRefData<T, R extends {}> {
  options: InternalResolveOptions,
  state: T,
  refInResultedJso: ResolvedRef,
  originForObj: ChainItem,
  sibling: Record<PropertyKey, unknown>,
  rules: CrawlRules<R> | undefined,
  syntheticTitleCache: Map<string, Record<PropertyKey, unknown>>,
  reference: RichReference,
}
