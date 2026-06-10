/**
 * A Map subclass with a hard size cap. When the cap is exceeded, the oldest
 * entries (by insertion order, which Map preserves) are evicted. This keeps
 * the per-instance memory of long-lived serverless lambdas flat under heavy
 * concurrent traffic with many unique keys, preventing slow OOM crashes.
 *
 * Drop-in replacement for `new Map()` — same get/has/set API.
 */
export class BoundedCache<K, V> extends Map<K, V> {
  private readonly max: number

  constructor(max = 1000) {
    super()
    this.max = max
  }

  set(key: K, value: V): this {
    // Re-inserting an existing key should refresh its recency.
    if (this.has(key)) this.delete(key)
    super.set(key, value)
    while (this.size > this.max) {
      const oldest = this.keys().next().value
      if (oldest === undefined) break
      this.delete(oldest)
    }
    return this
  }
}
