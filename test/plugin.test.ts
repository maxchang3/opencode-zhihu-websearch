import { afterEach, describe, expect, test } from 'bun:test'
import { createHarness, json, startServer, stopServers } from './harness.ts'

afterEach(stopServers)

const signal = () => new AbortController().signal

describe('zhihu-websearch', () => {
  test('registers the provider and integration', async () => {
    const harness = createHarness()
    await harness.setup()

    expect(harness.provider()?.id).toBe('zhihu')
    expect(harness.provider()?.name).toBe('Zhihu')
    expect(harness.integrationName()).toBe('Zhihu')

    const methods = harness.methods()
    expect(methods.some((entry) => entry.method.type === 'key')).toBe(true)
    const env = methods.find((entry) => entry.method.type === 'env')
    expect(env?.method.names).toContain('ZHIHU_ACCESS_SECRET')
  })

  test('fails when no credential is configured', async () => {
    const harness = createHarness({}, null)
    await harness.setup()

    await expect(
      harness.provider()!.execute({ query: 'opencode' }, { signal: signal() }),
    ).rejects.toThrow('Access Secret is not configured')
  })

  test('sends auth headers', async () => {
    let headers: Headers | undefined
    const server = startServer((_url, request) => {
      headers = new Headers(request.headers)
      return json({ Code: 0, Data: { Items: [] } })
    })

    const harness = createHarness({ endpoint: server.url })
    await harness.setup()
    const before = Math.floor(Date.now() / 1000)
    await harness.provider()!.execute({ query: 'q' }, { signal: signal() })

    expect(headers!.get('authorization')).toBe('Bearer test-key')
    const timestamp = Number(headers!.get('x-request-timestamp'))
    expect(timestamp).toBeGreaterThanOrEqual(before)
    expect(timestamp).toBeLessThanOrEqual(Math.floor(Date.now() / 1000))
  })

  test('sends options and maps results', async () => {
    let requested: URL | undefined
    const server = startServer((url) => {
      requested = url
      return json({
        Code: 0,
        Data: {
          Items: [
            {
              Title: '<em>Answer</em>',
              ContentText: 'hello <em>world</em>',
              Url: 'https://www.zhihu.com/question/1',
              EditTime: 1_700_000_000,
            },
            { Title: 'skipped, no Url' },
            { Url: 'https://www.zhihu.com/question/2' },
            { Url: 'https://www.zhihu.com/question/3', EditTime: 0 },
          ],
        },
      })
    })

    const filter = 'host!="example.com" AND publish_time>=1735689600'
    const harness = createHarness({ endpoint: server.url, count: 25, searchDB: 'realtime', filter })
    await harness.setup()
    const results = await harness
      .provider()!
      .execute({ query: 'opencode 插件' }, { signal: signal() })

    expect(requested!.searchParams.get('Query')).toBe('opencode 插件')
    expect(requested!.searchParams.get('Count')).toBe('20')
    expect(requested!.searchParams.get('SearchDB')).toBe('realtime')
    expect(requested!.searchParams.get('Filter')).toBe(filter)
    expect(results).toEqual([
      {
        url: 'https://www.zhihu.com/question/1',
        title: 'Answer',
        content: 'hello world',
        time: { published: 1_700_000_000_000 },
      },
      { url: 'https://www.zhihu.com/question/2', time: {} },
      { url: 'https://www.zhihu.com/question/3', time: {} },
    ])
  })

  test('clamps and validates options', async () => {
    const cases = [
      { options: {}, count: '10', searchDB: 'all' },
      { options: { count: 0 }, count: '1', searchDB: 'all' },
      { options: { count: Number.NaN }, count: '10', searchDB: 'all' },
      { options: { count: '8' }, count: '10', searchDB: 'all' },
      { options: { count: 25, searchDB: 'bogus' }, count: '20', searchDB: 'all' },
      { options: { filter: '  ' }, count: '10', searchDB: 'all' },
      { options: { filter: 42 }, count: '10', searchDB: 'all' },
      {
        options: { filter: ' host=="a.com" ' },
        count: '10',
        searchDB: 'all',
        filter: 'host=="a.com"',
      },
    ]

    let requested: URL | undefined
    const server = startServer((url) => {
      requested = url
      return json({ Code: 0, Data: { Items: [] } })
    })

    for (const entry of cases) {
      const harness = createHarness({ ...entry.options, endpoint: server.url })
      await harness.setup()
      await harness.provider()!.execute({ query: 'q' }, { signal: signal() })

      expect(requested!.searchParams.get('Count')).toBe(entry.count)
      expect(requested!.searchParams.get('SearchDB')).toBe(entry.searchDB)
      expect(requested!.searchParams.get('Filter')).toBe(entry.filter ?? null)
    }
  })

  test('returns no results when Items is missing', async () => {
    const server = startServer(() => json({ Code: 0 }))
    const harness = createHarness({ endpoint: server.url })
    await harness.setup()

    const results = await harness.provider()!.execute({ query: 'q' }, { signal: signal() })
    expect(results).toEqual([])
  })

  test('explains API error codes', async () => {
    const cases = [
      { code: 10001, hint: 'check the filter option' },
      { code: 20001, hint: 'check the Access Secret and system clock' },
      { code: 30001, hint: 'rate limited or quota exceeded' },
      { code: 30002, hint: 'quota exhausted' },
    ]

    let code = 0
    const server = startServer(() => json({ Code: code, Message: 'failed', Data: null }))
    const harness = createHarness({ endpoint: server.url, filter: 'publish_time>0' })
    await harness.setup()

    for (const entry of cases) {
      code = entry.code
      await expect(
        harness.provider()!.execute({ query: 'x' }, { signal: signal() }),
      ).rejects.toThrow(entry.hint)
    }

    // Without a filter, a parameter error has no hint to give
    const plain = createHarness({ endpoint: server.url })
    await plain.setup()
    code = 10001
    await expect(plain.provider()!.execute({ query: 'x' }, { signal: signal() })).rejects.toThrow(
      /Code=10001 failed$/,
    )
  })

  test('reports HTTP failures', async () => {
    const server = startServer(() => new Response('boom', { status: 500 }))
    const harness = createHarness({ endpoint: server.url })
    await harness.setup()

    await expect(harness.provider()!.execute({ query: 'x' }, { signal: signal() })).rejects.toThrow(
      'HTTP 500',
    )
  })

  test('propagates aborts', async () => {
    const server = startServer(() => json({ Code: 0, Data: { Items: [] } }))
    const harness = createHarness({ endpoint: server.url })
    await harness.setup()

    const controller = new AbortController()
    controller.abort()
    await expect(
      harness.provider()!.execute({ query: 'x' }, { signal: controller.signal }),
    ).rejects.toThrow()
  })
})
