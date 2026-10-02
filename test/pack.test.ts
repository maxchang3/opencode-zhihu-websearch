import { describe, expect, test } from 'bun:test'
import { $ } from 'bun'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

const pack = process.env.PACK === '1'

// npm doesn't install a package's devDependencies for its users, so @opencode/plugin is
// missing when OpenCode loads the plugin. Install the packed tarball the same way and load it.
describe.skipIf(!pack)('zhihu-websearch (packed)', () => {
  test('loads with production dependencies only', async () => {
    const root = path.join(import.meta.dir, '..')
    const dir = await mkdtemp(path.join(tmpdir(), 'zhihu-websearch-pack-'))
    try {
      const [{ filename }] = await $`npm pack --json --pack-destination ${dir}`
        .cwd(root)
        .quiet()
        .json()
      await Bun.write(path.join(dir, 'package.json'), JSON.stringify({ private: true }))
      await $`npm install --ignore-scripts --no-audit --no-fund ${path.join(dir, filename)}`
        .cwd(dir)
        .quiet()

      // Fresh process with auto-install off, so nothing resolves from this repo or the network
      const load =
        'const p = (await import("opencode-zhihu-websearch")).default; console.log(p.id, typeof p.setup)'
      const result = await $`bun --no-install -e ${load}`.cwd(dir).nothrow().quiet()
      if (result.exitCode !== 0) throw new Error(result.stderr.toString())
      expect(result.stdout.toString().trim()).toBe('zhihu-websearch function')
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  }, 60_000)
})
