import type { Plugin, PluginOptions } from '@opencode/plugin'

const DEFAULT_ENDPOINT = 'https://developer.zhihu.com/api/v1/content/global_search'

// Integration id and websearch provider id share the same short id.
const ZHIHU_ID = 'zhihu'

const DEFAULT_COUNT = 10

type SearchDB = 'all' | 'realtime' | 'static'
const DEFAULT_SEARCH_DB: SearchDB = 'all'

function readEndpoint(value: unknown) {
  if (typeof value !== 'string') return DEFAULT_ENDPOINT
  try {
    const endpoint = new URL(value)
    return endpoint.protocol === 'http:' || endpoint.protocol === 'https:'
      ? endpoint.toString()
      : DEFAULT_ENDPOINT
  } catch {
    return DEFAULT_ENDPOINT
  }
}

function readOptions(options: PluginOptions) {
  const count = options['count']
  const searchDB = options['searchDB']
  const filter = options['filter']
  return {
    count:
      typeof count === 'number' && Number.isFinite(count)
        ? Math.min(Math.max(Math.trunc(count), 1), 20)
        : DEFAULT_COUNT,
    searchDB:
      searchDB === 'all' || searchDB === 'realtime' || searchDB === 'static'
        ? searchDB
        : DEFAULT_SEARCH_DB,
    // Zhihu filter expression, e.g. host!="example.com" AND publish_time>=1735689600
    filter: typeof filter === 'string' ? filter.trim() : '',
    endpoint: readEndpoint(options['endpoint']),
  }
}

type ZhihuItem = {
  Title?: string
  ContentText?: string
  Url?: string
  EditTime?: number
}

type ZhihuResponse = {
  Code?: number
  Message?: string
  Data?: { Items?: ZhihuItem[] }
}

// Zhihu marks query matches in snippets with <em> tags
function stripHighlights(text: string | undefined) {
  return text?.replace(/<\/?em>/g, '')
}

function errorHint(code: number | undefined, filter: string) {
  // Invalid parameters; count and searchDB are validated locally, so point at the filter
  if (code === 10001 && filter) return ' (check the filter option)'
  // Auth failure; the server also checks X-Request-Timestamp against its own clock (10 min tolerance)
  if (code === 20001)
    return ' (check the Access Secret and system clock, see https://developer.zhihu.com/profile)'
  if (code === 30001)
    return ' (rate limited or quota exceeded, see https://developer.zhihu.com/profile)'
  if (code === 30002) return ' (quota exhausted, see https://developer.zhihu.com/profile)'
  return ''
}

export default {
  id: 'zhihu-websearch',
  async setup(ctx) {
    const { count, searchDB, filter, endpoint } = readOptions(ctx.options)

    // Credential entry: key method (manual) + env method (ZHIHU_ACCESS_SECRET)
    await ctx.integration.transform((editor) => {
      editor.update(ZHIHU_ID, (integration) => {
        integration.name = 'Zhihu'
      })
      editor.method.update({
        integrationID: ZHIHU_ID,
        method: { type: 'key', label: 'Access Secret' },
      })
      editor.method.update({
        integrationID: ZHIHU_ID,
        method: { type: 'env', names: ['ZHIHU_ACCESS_SECRET'] },
      })
    })

    // Register the provider only. The default comes from `websearch.provider`
    // in the config or from the user's choice in the UI.
    await ctx.websearch.transform((editor) => {
      editor.add({
        id: ZHIHU_ID,
        name: 'Zhihu',
        async execute({ query }, { signal }) {
          const connection = await ctx.integration.connection.active(ZHIHU_ID)
          const credential = connection
            ? await ctx.integration.connection.resolve(connection)
            : undefined
          if (!credential || credential.type !== 'key') {
            throw new Error(
              'Zhihu Access Secret is not configured: save one for the Zhihu integration in settings, or set ZHIHU_ACCESS_SECRET',
            )
          }

          const url = new URL(endpoint)
          url.searchParams.set('Query', query)
          url.searchParams.set('Count', String(count))
          url.searchParams.set('SearchDB', searchDB)
          if (filter) url.searchParams.set('Filter', filter)

          const response = await fetch(url, {
            signal,
            headers: {
              Authorization: `Bearer ${credential.key}`,
              'Content-Type': 'application/json',
              'X-Request-Timestamp': String(Math.floor(Date.now() / 1000)),
            },
          })
          if (!response.ok) throw new Error(`Zhihu search failed: HTTP ${response.status}`)

          const body = (await response.json()) as ZhihuResponse
          if (body.Code !== 0) {
            throw new Error(
              `Zhihu search failed: Code=${body.Code} ${body.Message ?? ''}${errorHint(body.Code, filter)}`,
            )
          }

          return (body.Data?.Items ?? []).flatMap((item) => {
            if (!item.Url) return []
            const title = stripHighlights(item.Title)
            const content = stripHighlights(item.ContentText)
            return [
              {
                url: item.Url,
                ...(title ? { title } : {}),
                ...(content ? { content } : {}),
                // Zhihu EditTime is a seconds timestamp; the websearch tool renders milliseconds
                time: item.EditTime ? { published: item.EditTime * 1000 } : {},
              },
            ]
          })
        },
      })
    })
  },
} satisfies Plugin.Plugin
