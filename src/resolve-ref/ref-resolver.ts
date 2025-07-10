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
import { OpenApiSpecVersion, SPEC_TYPE_OPEN_API_30, SPEC_TYPE_OPEN_API_31 } from '../spec-type'

export type Override =
  | typeof OPEN_API_PROPERTY_DESCRIPTION
  | typeof OPEN_API_PROPERTY_SUMMARY

export  interface Data1 {
  version: OpenApiSpecVersion,
  allowOverrides?: Override[]
}

export function referenceObjectRuleFunction({version, allowOverrides}: Data1){
  switch (version) {
    case SPEC_TYPE_OPEN_API_31:
      return referenceObjectResolver({ allowOverrides })
    case SPEC_TYPE_OPEN_API_30:
      return referenceObjectResolver()
  //   default:
  //     return notAllowedReferenceHandler
  }
}

export const jsonSchemaReferenceResolver: ReferenceHandler<CloneState<DefineOriginsAndResolveRefState>,CrawlRules<NormalizationRule>> = args => wrapRefWithAllOfIfNeed(args)
// export const notAllowedReferenceHandler: ReferenceHandler<CloneState<DefineOriginsAndResolveRefState>,CrawlRules<NormalizationRule>> = args => aaa(args)

export function referenceObjectResolver<T extends  CloneState<DefineOriginsAndResolveRefState>, R extends CrawlRules<NormalizationRule>>(overrides?: {allowOverrides?: Override[]}): ReferenceHandler<T, R> {
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
