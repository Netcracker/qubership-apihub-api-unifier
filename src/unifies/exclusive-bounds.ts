import { isArray, isObject } from '@netcracker/qubership-apihub-json-crawl'
import { InternalDeUnifyOptions, InternalUnifyOptions, OriginsMetaRecord, UnifyContext, UnifyFunction } from '../types'
import {
  JSON_SCHEMA_PROPERTY_EXCLUSIVE_MAXIMUM,
  JSON_SCHEMA_PROPERTY_EXCLUSIVE_MINIMUM,
  JSON_SCHEMA_PROPERTY_MAXIMUM,
  JSON_SCHEMA_PROPERTY_MINIMUM,
} from '../rules/jsonschema.const'
import { cleanOrigins, resolveOrigins, setOrigins } from '../origins'
import { isBroken, isPureCombiner } from './type'

type ConstraintProperty =
  typeof JSON_SCHEMA_PROPERTY_MINIMUM
  | typeof JSON_SCHEMA_PROPERTY_EXCLUSIVE_MINIMUM
  | typeof JSON_SCHEMA_PROPERTY_MAXIMUM
  | typeof JSON_SCHEMA_PROPERTY_EXCLUSIVE_MAXIMUM

type RemovedConstraints = Partial<Record<ConstraintProperty, number>>

interface RedundantConstraintsMeta {
  removed: RemovedConstraints
  origins?: OriginsMetaRecord
}

// Internal metadata for lossless deunification. It is intentionally not exported from the package entrypoint.
export const JSON_SCHEMA_REDUNDANT_CONSTRAINTS_SYMBOL = Symbol('redundant-constraints')

function isString(value: unknown): value is string {
  return typeof value === 'string'
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' || isString(value) && !Number.isNaN(+value)
}

function removeConstraint(
  jso: Record<PropertyKey, unknown>,
  propertyKey: ConstraintProperty,
  meta: RedundantConstraintsMeta,
  ctx: UnifyContext<InternalUnifyOptions>,
): Record<PropertyKey, unknown> {
  meta.removed[propertyKey] = jso[propertyKey] as number

  const origins = resolveOrigins(jso, propertyKey, ctx.options.originsFlag)
  if (origins) {
    meta.origins = {
      ...(meta.origins ?? {}),
      [propertyKey]: origins,
    }
  }

  delete jso[propertyKey]
  cleanOrigins(jso, propertyKey, ctx.options.originsFlag)
  return jso
}

function restoreConstraint(
  jso: Record<PropertyKey, unknown>,
  propertyKey: ConstraintProperty,
  value: number,
  meta: RedundantConstraintsMeta,
  ctx: UnifyContext<InternalDeUnifyOptions>,
): void {
  if (ctx.options.skip?.(value, [...ctx.path, propertyKey])) {
    return
  }

  jso[propertyKey] = value
  const origins = meta.origins?.[propertyKey]
  if (origins) {
    setOrigins(jso, propertyKey, ctx.options.originsFlag, origins)
  } else {
    cleanOrigins(jso, propertyKey, ctx.options.originsFlag)
  }
}

export const unifyJsonSchemaExclusiveBounds: UnifyFunction = {
  forward: (jso, ctx) => {
    if (!ctx.options.removeRedundantConstraints) {
      return jso
    }
    if (!isObject(jso) || isArray(jso)) {
      return jso
    }
    if (isPureCombiner(jso)) {
      return jso
    }
    if (isBroken(jso)) {
      return jso
    }

    let result: Record<PropertyKey, unknown> | null = null
    const meta: RedundantConstraintsMeta = {
      removed: {
        ...((jso[JSON_SCHEMA_REDUNDANT_CONSTRAINTS_SYMBOL] as RedundantConstraintsMeta | undefined)?.removed ?? {}),
      },
      origins: {
        ...((jso[JSON_SCHEMA_REDUNDANT_CONSTRAINTS_SYMBOL] as RedundantConstraintsMeta | undefined)?.origins ?? {}),
      },
    }

    const minimum = jso[JSON_SCHEMA_PROPERTY_MINIMUM]
    const exclusiveMinimum = jso[JSON_SCHEMA_PROPERTY_EXCLUSIVE_MINIMUM]
    if (isNumber(minimum) && isNumber(exclusiveMinimum)) {
      result = removeConstraint(
        result ?? { ...jso },
        exclusiveMinimum >= minimum ? JSON_SCHEMA_PROPERTY_MINIMUM : JSON_SCHEMA_PROPERTY_EXCLUSIVE_MINIMUM,
        meta,
        ctx,
      )
    }

    const maximum = (result ?? jso)[JSON_SCHEMA_PROPERTY_MAXIMUM]
    const exclusiveMaximum = (result ?? jso)[JSON_SCHEMA_PROPERTY_EXCLUSIVE_MAXIMUM]
    if (isNumber(maximum) && isNumber(exclusiveMaximum)) {
      result = removeConstraint(
        result ?? { ...jso },
        exclusiveMaximum <= maximum ? JSON_SCHEMA_PROPERTY_MAXIMUM : JSON_SCHEMA_PROPERTY_EXCLUSIVE_MAXIMUM,
        meta,
        ctx,
      )
    }

    if (!result) {
      return jso
    }

    if (meta.origins && Object.keys(meta.origins).length === 0) {
      delete meta.origins
    }
    result[JSON_SCHEMA_REDUNDANT_CONSTRAINTS_SYMBOL] = meta
    return result
  },
  backward: (jso, ctx) => {
    if (!isObject(jso) || isArray(jso)) {
      return
    }
    if (isBroken(jso)) {
      return
    }

    const meta = jso[JSON_SCHEMA_REDUNDANT_CONSTRAINTS_SYMBOL] as RedundantConstraintsMeta | undefined
    if (!meta) {
      return
    }

    delete jso[JSON_SCHEMA_REDUNDANT_CONSTRAINTS_SYMBOL]
    if (!ctx.options.removeRedundantConstraints) {
      return
    }

    Object.entries(meta.removed).forEach(([propertyKey, value]) => {
      restoreConstraint(jso, propertyKey as ConstraintProperty, value, meta, ctx)
    })
  },
}
