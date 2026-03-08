import EventEmitter from 'eventemitter3' // eslint-disable-line import/no-extraneous-dependencies

// biome-ignore lint/suspicious/noExplicitAny: EventEmitter callback args must accept any argument list
export type EventsDefinition = { [K in string | symbol]: (...args: any[]) => void } | undefined

/**
 * An extension of `EventEmitter` (provided by `eventemitter3`) with an adjusted
 * type interface that supports the unique structure of Newton Wallet SDK modules.
 */
export class TypedEmitter<Events extends EventsDefinition = undefined> extends EventEmitter<
  Events extends undefined ? string | symbol : Events
> {}

type ChainingMethods = 'on' | 'once' | 'addListener' | 'off' | 'removeListener' | 'removeAllListeners'
type NonChainingMethods = 'emit' | 'eventNames' | 'listeners' | 'listenerCount'

// biome-ignore lint/suspicious/noExplicitAny: generic constraint requires any for function type matching
type ReplaceReturnType<T extends (...a: any) => any, TNewReturn> = (...a: Parameters<T>) => TNewReturn

/**
 * Creates a `TypedEmitter` instance and returns helper functions for easily
 * mixing `TypedEmitter` methods into other objects.
 */
export function createTypedEmitter<Events extends EventsDefinition = undefined>() {
  const emitter = new TypedEmitter<Events>()

  const createChainingEmitterMethod = <T1 extends ChainingMethods, T2>(
    method: T1,
    source: T2,
  ): ReplaceReturnType<TypedEmitter[T1], T2> => {
    // biome-ignore lint/suspicious/noExplicitAny: dynamic emitter method dispatch requires type erasure
    return (...args: any[]) => {
      // biome-ignore lint/suspicious/noExplicitAny: dynamic emitter method dispatch requires type erasure
      ;(emitter as any)[method].apply(emitter, args)
      return source
    }
  }

  const createBoundEmitterMethod = <T extends NonChainingMethods>(method: T): TypedEmitter[T] => {
    // biome-ignore lint/suspicious/noExplicitAny: dynamic emitter method dispatch requires type erasure
    return (...args: any[]) => {
      // biome-ignore lint/suspicious/noExplicitAny: dynamic emitter method dispatch requires type erasure
      return (emitter as any)[method].apply(emitter, args)
    }
  }

  return {
    emitter,
    createChainingEmitterMethod,
    createBoundEmitterMethod,
  }
}
