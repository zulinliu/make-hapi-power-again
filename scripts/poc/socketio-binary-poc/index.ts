/**
 * PoC 2: Socket.IO Binary Event 传输
 * 验证 Socket.IO 在 Bun 环境下发送/接收二进制数据的效率
 * 对比 string vs binary 传输性能
 */

import { Server } from "socket.io"
import { io as clientIo } from "socket.io-client"

const results: { name: string; passed: boolean; detail: string }[] = []

async function main() {
  console.log('=== Socket.IO Binary Event PoC ===\n')
  console.log(`Bun version: ${Bun.version}\n`)

  const PORT = 19876

  // Test 1: Server + Client connection
  console.log('Test 1: Socket.IO 服务器启动 + 客户端连接')
  const server = new Server(PORT, {
    cors: { origin: '*' }
  })

  await new Promise<void>((resolve) => {
    server.on('connection', (socket) => {
      socket.on('echo-binary', (data: Uint8Array, callback: (resp: Uint8Array) => void) => {
        callback(data)
      })
      socket.on('echo-string', (data: string, callback: (resp: string) => void) => {
        callback(data)
      })
      resolve()
    })

    const client = clientIo(`http://localhost:${PORT}`)
    client.on('connect', () => {
      console.log(`  ✓ Client connected: ${client.id}`)
    })
  })

  // Wait a bit for server to be ready
  await new Promise(r => setTimeout(r, 200))

  // Test 2: Binary roundtrip
  console.log('\nTest 2: 二进制数据往返')
  try {
    const client = clientIo(`http://localhost:${PORT}`)
    await new Promise<void>(r => client.on('connect', r))

    const testData = new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f, 0x00, 0xff, 0xfe])
    const result = await new Promise<Uint8Array>((resolve) => {
      client.emit('echo-binary', testData, (resp: Uint8Array) => resolve(resp))
    })

    const match = result.length === testData.length &&
      result.every((v, i) => v === testData[i])
    console.log(`  ${match ? '✓' : '✗'} Binary roundtrip (${testData.length} bytes)`)
    results.push({ name: '二进制数据往返', passed: match, detail: `${testData.length} bytes` })
    client.disconnect()
  } catch (e: any) {
    console.log(`  ✗ ${e.message}`)
    results.push({ name: '二进制数据往返', passed: false, detail: e.message })
  }

  // Test 3: Large binary payload (1MB)
  console.log('\nTest 3: 大二进制传输 (1MB)')
  try {
    const client = clientIo(`http://localhost:${PORT}`)
    await new Promise<void>(r => client.on('connect', r))

    const largeData = new Uint8Array(1024 * 1024) // 1MB
    for (let i = 0; i < largeData.length; i++) largeData[i] = i % 256

    const start = performance.now()
    const result = await new Promise<Uint8Array>((resolve) => {
      client.emit('echo-binary', largeData, (resp: Uint8Array) => resolve(resp))
    })
    const elapsed = performance.now() - start

    const match = result.length === largeData.length
    console.log(`  ${match ? '✓' : '✗'} 1MB binary: ${elapsed.toFixed(1)}ms`)
    results.push({ name: '大二进制传输', passed: match, detail: `1MB in ${elapsed.toFixed(1)}ms` })
    client.disconnect()
  } catch (e: any) {
    console.log(`  ✗ ${e.message}`)
    results.push({ name: '大二进制传输', passed: false, detail: e.message })
  }

  // Test 4: String vs Binary throughput comparison
  console.log('\nTest 4: String vs Binary 吞吐量对比')
  try {
    const client = clientIo(`http://localhost:${PORT}`)
    await new Promise<void>(r => client.on('connect', r))

    const size = 100 * 1024 // 100KB
    const binaryData = new Uint8Array(size).fill(0x41)
    const stringData = 'A'.repeat(size)

    // Binary throughput
    const binStart = performance.now()
    for (let i = 0; i < 10; i++) {
      await new Promise<void>((resolve) => {
        client.emit('echo-binary', binaryData, () => resolve())
      })
    }
    const binElapsed = performance.now() - binStart

    // String throughput
    const strStart = performance.now()
    for (let i = 0; i < 10; i++) {
      await new Promise<void>((resolve) => {
        client.emit('echo-string', stringData, () => resolve())
      })
    }
    const strElapsed = performance.now() - strStart

    console.log(`  Binary 10x100KB: ${binElapsed.toFixed(1)}ms`)
    console.log(`  String 10x100KB: ${strElapsed.toFixed(1)}ms`)
    console.log(`  Ratio: ${(strElapsed / binElapsed).toFixed(2)}x`)
    results.push({
      name: 'String vs Binary 对比',
      passed: true,
      detail: `binary=${binElapsed.toFixed(0)}ms, string=${strElapsed.toFixed(0)}ms`
    })
    client.disconnect()
  } catch (e: any) {
    console.log(`  ✗ ${e.message}`)
    results.push({ name: 'String vs Binary 对比', passed: false, detail: e.message })
  }

  // Test 5: Concurrent clients
  console.log('\nTest 5: 并发多客户端')
  try {
    const concurrentClients = 4
    const clients = await Promise.all(
      Array.from({ length: concurrentClients }, async () => {
        const c = clientIo(`http://localhost:${PORT}`)
        await new Promise<void>(r => c.on('connect', r))
        return c
      })
    )

    const testData = new Uint8Array(1024).fill(0x42)
    const roundtripResults = await Promise.all(
      clients.map(c => new Promise<Uint8Array>(resolve => {
        c.emit('echo-binary', testData, (resp: Uint8Array) => resolve(resp))
      }))
    )

    const allMatch = roundtripResults.every(r => r.length === testData.length)
    console.log(`  ${allMatch ? '✓' : '✗'} ${concurrentClients} concurrent clients`)
    results.push({ name: '并发多客户端', passed: allMatch, detail: `${concurrentClients} clients` })
    clients.forEach(c => c.disconnect())
  } catch (e: any) {
    console.log(`  ✗ ${e.message}`)
    results.push({ name: '并发多客户端', passed: false, detail: e.message })
  }

  // Cleanup
  server.close()

  // Summary
  console.log('\n=== Summary ===')
  const passed = results.filter(r => r.passed).length
  results.forEach(r => console.log(`  ${r.passed ? '✓' : '✗'} ${r.name}${r.detail ? ': ' + r.detail : ''}`))
  console.log(`\nPassed: ${passed}/${results.length}`)
  process.exit(0)
}

main().catch(e => {
  console.error('Fatal:', e)
  process.exit(1)
})
