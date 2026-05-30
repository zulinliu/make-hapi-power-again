/**
 * PoC 4: isomorphic-git 服务端 Git 操作
 * 验证 isomorphic-git 在 Bun 环境下的基本 Git 操作
 * 使用 node:fs 原生模块（Bun 兼容）
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import { tmpdir } from 'node:os'

const results: { name: string; passed: boolean; detail: string }[] = []

async function main() {
  console.log('=== isomorphic-git PoC ===\n')
  console.log(`Bun version: ${Bun.version}\n`)

  let git: any
  try {
    git = await import('isomorphic-git')
    console.log('  isomorphic-git: loaded')
  } catch (e: any) {
    console.log(`  isomorphic-git not available: ${e.message}`)
    process.exit(0)
  }

  const testDir = path.join(tmpdir(), `iso-git-poc-${Date.now()}`)
  fs.mkdirSync(testDir, { recursive: true })
  console.log(`Test dir: ${testDir}\n`)

  // isomorphic-git 需要 node:fs 的 promises API
  const nodeFs = fs

  // Test 1: git init
  console.log('Test 1: git init')
  try {
    await git.init({ fs: nodeFs, dir: testDir })
    const hasGitDir = fs.existsSync(path.join(testDir, '.git'))
    console.log(`  ${hasGitDir ? '✓' : '✗'} git init`)
    results.push({ name: 'git init', passed: hasGitDir, detail: '' })
  } catch (e: any) {
    console.log(`  ✗ ${e.message}`)
    results.push({ name: 'git init', passed: false, detail: e.message })
  }

  // Test 2: git add + commit
  console.log('\nTest 2: git add + commit')
  try {
    fs.writeFileSync(path.join(testDir, 'hello.txt'), 'Hello, Hapi Power!')
    fs.writeFileSync(path.join(testDir, 'README.md'), '# Test Repo')

    await git.add({ fs: nodeFs, dir: testDir, filepath: 'hello.txt' })
    await git.add({ fs: nodeFs, dir: testDir, filepath: 'README.md' })

    const sha = await git.commit({
      fs: nodeFs, dir: testDir,
      message: 'Initial commit',
      author: { name: 'PoC', email: 'poc@test.com' }
    })

    console.log(`  ✓ Commit: ${sha.slice(0, 8)}`)
    results.push({ name: 'git add + commit', passed: !!sha, detail: sha.slice(0, 8) })
  } catch (e: any) {
    console.log(`  ✗ ${e.message}`)
    results.push({ name: 'git add + commit', passed: false, detail: e.message })
  }

  // Test 3: git log
  console.log('\nTest 3: git log')
  try {
    const logs = await git.log({ fs: nodeFs, dir: testDir, depth: 10 })
    console.log(`  ${logs.length > 0 ? '✓' : '✗'} Found ${logs.length} commit(s)`)
    results.push({ name: 'git log', passed: logs.length > 0, detail: `${logs.length} commits` })
  } catch (e: any) {
    console.log(`  ✗ ${e.message}`)
    results.push({ name: 'git log', passed: false, detail: e.message })
  }

  // Test 4: git status (modified file)
  console.log('\nTest 4: git status')
  try {
    fs.writeFileSync(path.join(testDir, 'hello.txt'), 'Modified content!')
    const status = await git.status({ fs: nodeFs, dir: testDir, filepath: 'hello.txt' })
    const modified = status === 'modified'
    console.log(`  ${modified ? '✓' : '✗'} Status: ${status}`)
    results.push({ name: 'git status', passed: modified, detail: status })
  } catch (e: any) {
    console.log(`  ✗ ${e.message}`)
    results.push({ name: 'git status', passed: false, detail: e.message })
  }

  // Test 5: git diff via walk
  console.log('\nTest 5: git diff (via walk)')
  try {
    const changes = await git.walk({
      fs: nodeFs, dir: testDir,
      trees: ['WORKDIR', 'HEAD'],
      map: async (filepath: string, entries: any[]) => {
        if (filepath === '.') return
        if (!entries[0] || !entries[1]) return
        const workdirOid = await entries[0].oid()
        const headOid = await entries[1].oid()
        if (workdirOid !== headOid) {
          return { path: filepath, changed: true }
        }
      }
    })
    const real = changes.filter(Boolean)
    console.log(`  ${real.length > 0 ? '✓' : '✗'} ${real.length} change(s): ${real.map((c: any) => c?.path).join(', ')}`)
    results.push({ name: 'git diff (walk)', passed: real.length > 0, detail: `${real.length} changes` })
  } catch (e: any) {
    console.log(`  ✗ ${e.message}`)
    results.push({ name: 'git diff (walk)', passed: false, detail: e.message })
  }

  // Test 6: Unicode/CJK filenames
  console.log('\nTest 6: Unicode/CJK 文件名')
  try {
    fs.writeFileSync(path.join(testDir, '你好世界.txt'), 'Chinese content')
    await git.add({ fs: nodeFs, dir: testDir, filepath: '你好世界.txt' })
    const sha = await git.commit({
      fs: nodeFs, dir: testDir,
      message: 'Add CJK file',
      author: { name: 'PoC', email: 'poc@test.com' }
    })
    console.log(`  ${!!sha ? '✓' : '✗'} CJK commit: ${sha.slice(0, 8)}`)
    results.push({ name: 'Unicode/CJK 文件名', passed: !!sha, detail: sha.slice(0, 8) })
  } catch (e: any) {
    console.log(`  ✗ ${e.message}`)
    results.push({ name: 'Unicode/CJK 文件名', passed: false, detail: e.message })
  }

  // Cleanup
  fs.rmSync(testDir, { recursive: true, force: true })

  // Summary
  console.log('\n=== Summary ===')
  const passed = results.filter(r => r.passed).length
  results.forEach(r => console.log(`  ${r.passed ? '✓' : '✗'} ${r.name}${r.detail ? ': ' + r.detail : ''}`))
  console.log(`\nPassed: ${passed}/${results.length}`)
}

main().catch(e => {
  console.error('Fatal:', e)
  process.exit(1)
})
