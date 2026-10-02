import { describe, expect, test } from "bun:test"
import { createHarness } from "./harness.ts"

const live = process.env.LIVE === "1"

describe.skipIf(!live)("zhihu-websearch (live)", () => {
  test("returns results from the real API", async () => {
    const secret = process.env.ZHIHU_ACCESS_SECRET
    if (!secret) throw new Error("ZHIHU_ACCESS_SECRET is required when LIVE=1")

    const harness = createHarness({ count: 3 }, { type: "key", key: secret })
    await harness.setup()
    const results = await harness.provider()!.execute({ query: "OpenCode" }, { signal: AbortSignal.timeout(30_000) })

    expect(results.length).toBeGreaterThan(0)
    for (const result of results) {
      expect(typeof result.url).toBe("string")
      expect(String(result.url).startsWith("http")).toBe(true)
      if (result.content !== undefined) {
        expect(typeof result.content).toBe("string")
        expect(String(result.content)).not.toContain("<em>")
      }
    }
  })

  test("accepts a filter expression", async () => {
    const secret = process.env.ZHIHU_ACCESS_SECRET
    if (!secret) throw new Error("ZHIHU_ACCESS_SECRET is required when LIVE=1")

    // Quotes, spaces and operators must survive query encoding, or the API rejects the request
    const filter = 'host!="example.com" AND publish_time>=1735689600'
    const harness = createHarness({ count: 3, filter }, { type: "key", key: secret })
    await harness.setup()
    const results = await harness.provider()!.execute({ query: "OpenCode" }, { signal: AbortSignal.timeout(30_000) })

    expect(results.length).toBeGreaterThan(0)
  })
})
