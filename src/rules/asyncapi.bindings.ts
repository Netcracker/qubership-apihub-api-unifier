import { NormalizationRules } from '../types'
import { checkType, TYPE_JSON_ANY, TYPE_OBJECT, TYPE_STRING } from '../validate/checker'
import { valueDefaults } from '../unifies/defaults'
import { referenceObjectResolver } from '../references/ref-resolver'
import { specificationExtensionsRules } from './asyncapi.jsonschema.common'

/**
 * Allowed AsyncAPI binding protocol names.
 * Bindings object keys are expected to be one of these protocols
 */
export const ASYNCAPI_3_0_BINDING_PROTOCOLS = [
  'http',
  'ws',
  'kafka',
  'anypointmq',
  'amqp',
  'amqp1',
  'mqtt',
  'mqtt5',
  'nats',
  'jms',
  'sns',
  'solace',
  'sqs',
  'stomp',
  'redis',
  'mercure',
  'ibmmq',
  'googlepubsub',
  'pulsar',
] as const

/** Default for bindingVersion when absent (per binding object). */
const ASYNCAPI_BINDING_VERSION_DEFAULT = 'latest'

/**
 * Rules for a single binding object (specific to a protocol).
 */
export const bindingRules: NormalizationRules = {
  '/bindingVersion': { validate: checkType(TYPE_STRING) },
  ...specificationExtensionsRules,
  // for now we chose not to enforce a specific schema for the binding objects, so any JSON is allowed
  '/*': { validate: checkType(...TYPE_JSON_ANY) },
  '/**': { validate: checkType(...TYPE_JSON_ANY) },
  validate: checkType(TYPE_OBJECT),
  unify: [valueDefaults({ bindingVersion: ASYNCAPI_BINDING_VERSION_DEFAULT })],
}

/**
 * Builds bindings object rules: protocol names as keys, each value validated with bindingRules.
 * Protocol-specific level first (only allowed protocol keys), then each value uses bindingRules.
 * Specification extensions (x-*) are allowed
 */
function createBindingsRules(): NormalizationRules {
  const protocolEntries: Record<string, NormalizationRules> = {}
  for (const protocol of ASYNCAPI_3_0_BINDING_PROTOCOLS) {
    protocolEntries[`/${protocol}`] = bindingRules
  }
  return {
    ...protocolEntries,
    ...specificationExtensionsRules,
    referenceHandler: referenceObjectResolver(),
    validate: checkType(TYPE_OBJECT),
  }
}

const bindingsRules = createBindingsRules()

export const serverBindingsRules: NormalizationRules = bindingsRules
export const channelBindingsRules: NormalizationRules = bindingsRules
export const operationBindingsRules: NormalizationRules = bindingsRules
export const messageBindingsRules: NormalizationRules = bindingsRules
