// Effect adapter interfaces for Layer 3 I/O.
// A kriya with a sparsha block may call these adapters at runtime.
// Pure kriya (no sparsha) must not call impure kriya — enforced by the typechecker.

export interface HttpAdapter {
  get(url: string, headers?: Record<string, string>): Promise<{ status: number; body: string }>
  post(url: string, body: string, headers?: Record<string, string>): Promise<{ status: number; body: string }>
}

export interface FileAdapter {
  read(path: string): Promise<string>
  write(path: string, content: string): Promise<void>
}

export interface EventAdapter {
  emit(name: string, payload: Record<string, unknown>): Promise<void>
}

// EffectAdapter is passed to the runtime executor when running impure kriya.
// Absent adapters fall through to null (avyakta) — safe default for testing.
export interface EffectAdapter {
  http?: HttpAdapter
  file?: FileAdapter
  event?: EventAdapter
}

// Default no-op adapters used in tests and CLI --dry-run mode.
// Every call returns a safe sentinel value rather than throwing.
export const nullHttpAdapter: HttpAdapter = {
  get:  async () => ({ status: 0, body: '' }),
  post: async () => ({ status: 0, body: '' }),
}

export const nullFileAdapter: FileAdapter = {
  read:  async () => '',
  write: async () => {},
}

export const nullEventAdapter: EventAdapter = {
  emit: async () => {},
}

export const nullEffectAdapter: EffectAdapter = {
  http:  nullHttpAdapter,
  file:  nullFileAdapter,
  event: nullEventAdapter,
}
