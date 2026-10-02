# opencode-zhihu-websearch

[English](README.md) | 简体中文

使用知乎全网搜索（[Global Search](https://developer.zhihu.com/docs?key=global_search)）作为 [OpenCode](https://opencode.ai) websearch provider。

> 知乎全网搜索是面向 AI 应用的高可信搜索服务，融合知乎高质量内容与权威网络来源，提供实时、结构化、可追溯的结果，对**中文**查询有高质量、高相关性的表现。

## 环境要求

- OpenCode v2
- 知乎数据开放平台账号及 Access Secret：https://developer.zhihu.com/profile

## 安装

```sh
opencode plugin add opencode-zhihu-websearch
```

或写入 `opencode.jsonc`：

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": ["opencode-zhihu-websearch"],
  "websearch": { "provider": "zhihu" },
}
```

不设置 `websearch.provider` 时，OpenCode 会在首次搜索时让你选择 provider。

## 凭据

执行 `/connect` 并选择 **Zhihu**，或在启动 OpenCode 前设置 `ZHIHU_ACCESS_SECRET`。已保存的凭据优先于环境变量。

## 配置

插件配置均为可选：

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

| 选项       | 取值                        | 默认值                  | 说明                     |
| ---------- | --------------------------- | ----------------------- | ------------------------ |
| `count`    | 1-20                        | `10`                    | 结果数量                 |
| `searchDB` | `all`、`realtime`、`static` | `all`                   | 搜索索引                 |
| `filter`   | 过滤表达式                  | 无                      | 按站点或发布时间过滤结果 |
| `endpoint` | URL                         | 知乎全网搜索 API        | 覆盖搜索端点             |

`filter` 使用知乎的[Filter 语法](https://developer.zhihu.com/docs?key=global_search)：`host` 支持 `==` 和 `!=`（值需双引号），`publish_time`（Unix 秒）支持 `==`、`!=`、`>`、`>=`、`<`、`<=`，条件之间用大写 `AND`/`OR` 与括号组合；不支持对 `zhihu.com` 本身过滤。JSON 中引号需转义：

```jsonc
"options": { "filter": "host!=\"example.com\" AND publish_time>=1735689600" }
```

## 开发

```sh
bun install
bun run typecheck
bun run test

# 可选：请求真实 API，需要 ZHIHU_ACCESS_SECRET
LIVE=1 bun run test:live
```

## License

[MIT](LICENSE)
