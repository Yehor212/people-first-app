import type { KvNamespace } from "../src/types";

export class FakeKvNamespace implements KvNamespace {
  private readonly values = new Map<string, string>();

  async get(key: string): Promise<string | null> {
    return this.values.get(key) ?? null;
  }

  async put(key: string, value: string, _options?: { expirationTtl?: number }): Promise<void> {
    this.values.set(key, value);
  }

  async delete(key: string): Promise<void> {
    this.values.delete(key);
  }

  async list(options: { prefix?: string; limit?: number } = {}): Promise<{ keys: Array<{ name: string }> }> {
    const keys = [...this.values.keys()]
      .filter((key) => (options.prefix ? key.startsWith(options.prefix) : true))
      .slice(0, options.limit ?? 1000)
      .map((name) => ({ name }));
    return { keys };
  }
}
