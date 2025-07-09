import {
  ChainItem,
  DefineOriginsAndResolveRefState,
  InternalResolveOptions,
  NormalizationRule,
  ReferenceHandler,
  RefErrorTypes,
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
import { ErrorMessage } from '../errors'

export type Override =
  | typeof OPEN_API_PROPERTY_DESCRIPTION
  | typeof OPEN_API_PROPERTY_SUMMARY


export const jsonSchemaReferenceResolver: ReferenceHandler<CloneState<DefineOriginsAndResolveRefState>,CrawlRules<NormalizationRule>> = args => wrapRefWithAllOfIfNeed(args)
export const notAllowedReferenceHandler: ReferenceHandler<CloneState<DefineOriginsAndResolveRefState>,CrawlRules<NormalizationRule>> = args => aaa(args)

export const aaa = ({ options, state,  }: ResolvedRefData): ResolvedRefWithSibling => {
  options.onRefResolveError?.(ErrorMessage.richRefObjectNotAllowed($ref), path, $ref, RefErrorTypes.RICH_REF_NOT_ALLOWED)
  state.node[safeKey] = value
  return { done: true }
}

export function referenceObjectResolver<T extends  CloneState<DefineOriginsAndResolveRefState>, R extends CrawlRules<NormalizationRule>>(overrides?: {allowOverrides: Override[]}): ReferenceHandler<T, R> {
  return (data: ResolvedRefData): ResolvedRefWithSibling => {
    return resolveReferenceObjectWithOverrides(data, overrides?.allowOverrides ?? [])
  }
}

export interface ResolvedRefData {
  options: InternalResolveOptions,
  state: CloneState<DefineOriginsAndResolveRefState>,
  refInResultedJso: ResolvedRef,
  originForObj: ChainItem,
  sibling: Record<PropertyKey, unknown>,
  rules: CrawlRules<NormalizationRule> | undefined,
  syntheticTitleCache: Map<string, Record<PropertyKey, unknown>>,
  reference: RichReference,
}
