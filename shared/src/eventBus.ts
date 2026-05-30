/**
 * 泛型 EventBus — 模块间 typed pub/sub 通信
 * 替代直接函数调用，支持跨模块解耦
 */

type EventHandler<T = unknown> = (payload: T) => void

interface EventMap {
  [key: string]: unknown
}

export class EventBus<TEvents extends EventMap = EventMap> {
  private handlers = new Map<keyof TEvents, Set<EventHandler>>()

  on<K extends keyof TEvents>(event: K, handler: EventHandler<TEvents[K]>): () => void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set())
    }
    const set = this.handlers.get(event)!
    set.add(handler as EventHandler)
    return () => this.off(event, handler)
  }

  once<K extends keyof TEvents>(event: K, handler: EventHandler<TEvents[K]>): () => void {
    const wrapper: EventHandler<TEvents[K]> = (payload) => {
      this.off(event, wrapper)
      handler(payload)
    }
    return this.on(event, wrapper)
  }

  off<K extends keyof TEvents>(event: K, handler: EventHandler<TEvents[K]>): void {
    this.handlers.get(event)?.delete(handler as EventHandler)
  }

  emit<K extends keyof TEvents>(event: K, payload: TEvents[K]): void {
    const set = this.handlers.get(event)
    if (!set) return
    for (const handler of set) {
      try {
        handler(payload)
      } catch (err) {
        console.error(`EventBus handler error on "${String(event)}":`, err)
      }
    }
  }

  listenerCount(event: keyof TEvents): number {
    return this.handlers.get(event)?.size ?? 0
  }

  removeAllListeners(event?: keyof TEvents): void {
    if (event) {
      this.handlers.delete(event)
    } else {
      this.handlers.clear()
    }
  }
}

/** Hapi Power 全局事件定义 */
export interface HapiPowerEvents {
  'git:status-changed': { sessionId: string; namespace: string; branch: string; dirty: boolean }
  'git:commit-created': { sessionId: string; namespace: string; sha: string; message: string }
  'pty:session-created': { sessionId: string; namespace: string; pid: number; cols: number; rows: number }
  'pty:session-destroyed': { sessionId: string; namespace: string; pid: number }
  'file:changed': { sessionId: string; namespace: string; path: string; type: 'create' | 'modify' | 'delete' }
  'plugin:loaded': { namespace: string; pluginId: string; version: string }
  'plugin:unloaded': { namespace: string; pluginId: string }
  'workflow:started': { sessionId: string; namespace: string; workflowId: string }
  'workflow:completed': { sessionId: string; namespace: string; workflowId: string; result: unknown }
}

/** 全局单例 */
export const eventBus = new EventBus<HapiPowerEvents>()
