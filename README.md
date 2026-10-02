# opencode-zhihu-websearch

English | [简体中文](README.zh.md)

Zhihu Web Search ([Global Search](https://developer.zhihu.com/docs?key=global_search)) as an [OpenCode](https://opencode.ai) websearch provider.

> Zhihu Global Search is a high-trust search service for AI applications, combining high-quality Zhihu content with authoritative web sources to deliver real-time, structured, and traceable results. It offers high-quality, highly relevant results for **Chinese-language** queries.

## Requirements

- OpenCode v2
- A Zhihu Open Platform account with an Access Secret: https://developer.zhihu.com/profile

## Install

```sh
opencode plugin add opencode-zhihu-websearch
```

Or add it to `opencode.jsonc`:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": ["opencode-zhihu-websearch"],
  "websearch": { "provider": "zhihu" },
}
```

Without `websearch.provider`, OpenCode asks you to pick a provider the first time you search.

## Credentials

Run `/connect` and pick **Zhihu**, or set `ZHIHU_ACCESS_SECRET` before starting OpenCode. A stored credential takes priority over the environment variable.

## Options

Plugin options are optional:

```jsonc
{
  "plugins": [
    {
      "package": "opencode-zhihu-websearch",
      "options": { "count": 8, "searchDB": "realtime" },
    },
  ],
}
```

| Option     | Values                      | Default                 | Description                            |
| ---------- | --------------------------- | ----------------------- | -------------------------------------- |
| `count`    | 1-20                        | `10`                    | Number of results                      |
| `searchDB` | `all`, `realtime`, `static` | `all`                   | Search index                           |
| `filter`   | Filter expression           | none                    | Filter results by site or publish time |
| `endpoint` | URL                         | Zhihu Global Search API | Override the search endpoint           |

`filter` uses Zhihu's [filter syntax](https://developer.zhihu.com/docs?key=global_search): `host` supports `==` and `!=` with a double-quoted value, `publish_time` (Unix seconds) supports `==`, `!=`, `>`, `>=`, `<` and `<=`, and conditions combine with uppercase `AND`/`OR` and parentheses. Filtering on `zhihu.com` itself is not supported. Escape the quotes in JSON:

```jsonc
"options": { "filter": "host!=\"example.com\" AND publish_time>=1735689600" }
```

## Development

```sh
bun install
bun run typecheck
bun run test

# optional: hits the real API, needs ZHIHU_ACCESS_SECRET
LIVE=1 bun run test:live
```

## License

[MIT](LICENSE)
