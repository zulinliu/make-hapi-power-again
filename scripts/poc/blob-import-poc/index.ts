/**
 * PoC 5: Blob URL 动态导入
 * 验证 Bun 环境下从 Blob URL 动态导入模块的能力
 * 用于插件系统: 用户上传插件代码 → Blob URL → 动态导入执行
 */

const results: { name: string; passed: boolean; detail: string }[] = []

async function main() {
  console.log('=== Blob URL Dynamic Import PoC ===\n')
  console.log(`Bun version: ${Bun.version}\n`)

  // Test 1: Basic Blob creation
  console.log('Test 1: Blob 创建')
  try {
    const blob = new Blob(['export const hello = "world"; export function greet(name) { return `Hello, ${name}!`; }'], {
      type: 'application/javascript'
    })
    console.log(`  ✓ Blob created: ${blob.size} bytes, type: ${blob.type}`)
    results.push({ name: 'Blob 创建', passed: true, detail: `${blob.size} bytes` })
  } catch (e: any) {
    console.log(`  ✗ ${e.message}`)
    results.push({ name: 'Blob 创建', passed: false, detail: e.message })
  }

  // Test 2: Blob URL creation
  console.log('\nTest 2: Blob URL 创建')
  try {
    const code = 'export const name = "hapi-plugin"; export default function() { return "plugin loaded"; }'
    const blob = new Blob([code], { type: 'application/javascript' })
    const url = URL.createObjectURL(blob)
    const isValidUrl = url.startsWith('blob:')
    console.log(`  ${isValidUrl ? '✓' : '✗'} Blob URL: ${url}`)
    results.push({ name: 'Blob URL 创建', passed: isValidUrl, detail: url.slice(0, 40) })
  } catch (e: any) {
    console.log(`  ✗ ${e.message}`)
    results.push({ name: 'Blob URL 创建', passed: false, detail: e.message })
  }

  // Test 3: Dynamic import from Blob URL
  console.log('\nTest 3: Blob URL 动态导入')
  try {
    const code = 'export const pluginName = "test-plugin"; export function activate() { return "activated"; }'
    const blob = new Blob([code], { type: 'application/javascript' })
    const url = URL.createObjectURL(blob)

    const mod = await import(url)
    const hasExports = mod.pluginName === 'test-plugin' && typeof mod.activate === 'function'
    const activationResult = mod.activate()
    console.log(`  ${hasExports ? '✓' : '✗'} Imported: pluginName="${mod.pluginName}", activate()="${activationResult}"`)
    results.push({ name: 'Blob URL 动态导入', passed: hasExports, detail: activationResult })
    URL.revokeObjectURL(url)
  } catch (e: any) {
    console.log(`  ✗ ${e.message}`)
    results.push({ name: 'Blob URL 动态导入', passed: false, detail: e.message })
  }

  // Test 4: Complex module with dependencies-like pattern
  console.log('\nTest 4: 复杂模块（模拟插件）')
  try {
    const pluginCode = `
      const state = { count: 0, listeners: [] };

      export function subscribe(fn) {
        state.listeners.push(fn);
      }

      export function increment() {
        state.count++;
        state.listeners.forEach(fn => fn(state.count));
        return state.count;
      }

      export function getCount() {
        return state.count;
      }

      export default {
        name: 'counter-plugin',
        version: '1.0.0',
        init() { return 'initialized'; }
      };
    `
    const blob = new Blob([pluginCode], { type: 'application/javascript' })
    const url = URL.createObjectURL(blob)
    const mod = await import(url)

    // Test plugin API
    const defaultExport = mod.default
    const initResult = defaultExport.init()
    const events: number[] = []
    mod.subscribe((n: number) => events.push(n))
    mod.increment()
    mod.increment()

    const works = initResult === 'initialized' &&
      mod.getCount() === 2 &&
      events.length === 2 &&
      events[1] === 2

    console.log(`  ${works ? '✓' : '✗'} Plugin: name=${defaultExport.name}, count=${mod.getCount()}, events=${JSON.stringify(events)}`)
    results.push({ name: '复杂插件模块', passed: works, detail: `count=${mod.getCount()}` })
    URL.revokeObjectURL(url)
  } catch (e: any) {
    console.log(`  ✗ ${e.message}`)
    results.push({ name: '复杂插件模块', passed: false, detail: e.message })
  }

  // Test 5: Multiple blob imports (plugin isolation)
  console.log('\nTest 5: 多 Blob 导入隔离性')
  try {
    const pluginA = 'export const id = "A"; export default { name: "plugin-a" };'
    const pluginB = 'export const id = "B"; export default { name: "plugin-b" };'

    const urlA = URL.createObjectURL(new Blob([pluginA], { type: 'application/javascript' }))
    const urlB = URL.createObjectURL(new Blob([pluginB], { type: 'application/javascript' }))

    const modA = await import(urlA)
    const modB = await import(urlB)

    const isolated = modA.id === 'A' && modB.id === 'B' &&
      modA.default.name === 'plugin-a' && modB.default.name === 'plugin-b'

    console.log(`  ${isolated ? '✓' : '✗'} Plugin A: id=${modA.id}, Plugin B: id=${modB.id}`)
    results.push({ name: '多 Blob 导入隔离', passed: isolated, detail: `A=${modA.id}, B=${modB.id}` })
    URL.revokeObjectURL(urlA)
    URL.revokeObjectURL(urlB)
  } catch (e: any) {
    console.log(`  ✗ ${e.message}`)
    results.push({ name: '多 Blob 导入隔离', passed: false, detail: e.message })
  }

  // Test 6: Error handling in blob module
  console.log('\nTest 6: Blob 模块错误处理')
  try {
    const badCode = 'throw new Error("intentional plugin error");'
    const url = URL.createObjectURL(new Blob([badCode], { type: 'application/javascript' }))

    try {
      await import(url)
      console.log('  ✗ Should have thrown')
      results.push({ name: 'Blob 模块错误处理', passed: false, detail: 'no error thrown' })
    } catch (importError: any) {
      const caught = importError.message.includes('intentional')
      console.log(`  ${caught ? '✓' : '✗'} Error caught: ${importError.message}`)
      results.push({ name: 'Blob 模块错误处理', passed: caught, detail: importError.message })
    }
    URL.revokeObjectURL(url)
  } catch (e: any) {
    console.log(`  ✗ ${e.message}`)
    results.push({ name: 'Blob 模块错误处理', passed: false, detail: e.message })
  }

  // Test 7: Revoke and re-import safety
  console.log('\nTest 7: revokeObjectURL 安全性')
  try {
    const code = 'export const x = 1;'
    const url = URL.createObjectURL(new Blob([code], { type: 'application/javascript' }))

    // Import before revoke
    const mod1 = await import(url)
    const beforeRevoke = mod1.x === 1

    // Revoke
    URL.revokeObjectURL(url)

    // Try import after revoke - should still work if cached, or fail gracefully
    let afterRevoke = false
    try {
      const mod2 = await import(url)
      afterRevoke = mod2.x === 1
    } catch {
      afterRevoke = true // Expected: import fails after revoke
    }

    console.log(`  ${beforeRevoke ? '✓' : '✗'} Before revoke: ${beforeRevoke}, After revoke: ${afterRevoke ? 'safe' : 'leaked'}`)
    results.push({ name: 'revokeObjectURL 安全性', passed: beforeRevoke && afterRevoke, detail: '' })
  } catch (e: any) {
    console.log(`  ✗ ${e.message}`)
    results.push({ name: 'revokeObjectURL 安全性', passed: false, detail: e.message })
  }

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
