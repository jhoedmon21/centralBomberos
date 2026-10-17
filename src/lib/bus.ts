// Autobús de eventos en memoria para SSE (válido en una sola instancia).
// En despliegues multi-instancia se puede sustituir por Redis Pub/Sub
// manteniendo la misma interfaz (subscribe/broadcast).

type Listener = (data: string) => void;

const globalBus = globalThis as unknown as { __fwBus?: Set<Listener> };
const bus: Set<Listener> = globalBus.__fwBus ?? (globalBus.__fwBus = new Set());

export function subscribe(fn: Listener): () => void {
  bus.add(fn);
  return () => bus.delete(fn);
}

export function broadcast(event: Record<string, unknown>): void {
  const data = JSON.stringify({ ...event, at: Date.now() });
  for (const fn of [...bus]) {
    try {
      fn(data);
    } catch {
      bus.delete(fn);
    }
  }
}

export function clientCount(): number {
  return bus.size;
}
