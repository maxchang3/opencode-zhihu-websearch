import plugin from '../src/index.ts'

type Credential = { type: 'key'; key: string }

type RegisteredProvider = {
  id: string
  name: string
  execute: (
    input: { query: string },
    context: { signal: AbortSignal },
  ) => Promise<readonly Record<string, unknown>[]>
}

type IntegrationMethod = {
  integrationID: string
  method: { type: string; names?: readonly string[] }
}

export function createHarness(
  options: Record<string, unknown> = {},
  credential: Credential | null = { type: 'key', key: 'test-key' },
) {
  let provider: RegisteredProvider | undefined
  let integrationName = ''
  const methods: IntegrationMethod[] = []

  const ctx = {
    options,
    integration: {
      transform: async (callback: (editor: unknown) => void) => {
        callback({
          update: (_id: string, update: (integration: { name: string }) => void) => {
            const integration = { name: '' }
            update(integration)
            integrationName = integration.name
          },
          method: { update: (input: IntegrationMethod) => methods.push(input) },
        })
      },
      connection: {
        active: async () => (credential ? { id: 'connection' } : undefined),
        resolve: async () => credential,
      },
    },
    websearch: {
      transform: async (
        callback: (editor: { add: (definition: RegisteredProvider) => void }) => void,
      ) => {
        callback({
          add: (definition) => {
            provider = definition
          },
        })
      },
    },
  }

  return {
    setup: async () => {
      await plugin.setup(ctx as unknown as Parameters<typeof plugin.setup>[0])
    },
    provider: () => provider,
    integrationName: () => integrationName,
    methods: () => methods,
  }
}

export function json(body: unknown) {
  return new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } })
}

const servers: Array<{ stop: () => void }> = []

export function startServer(handler: (url: URL, request: Request) => Response) {
  const server = Bun.serve({
    port: 0,
    fetch: (request) => handler(new URL(request.url), request),
  })
  const handle = {
    url: server.url.toString(),
    stop: () => void server.stop(true),
  }
  servers.push(handle)
  return handle
}

export function stopServers() {
  for (const server of servers.splice(0)) server.stop()
}
