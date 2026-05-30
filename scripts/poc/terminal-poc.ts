/**
 * PoC 1: Bun Terminal API 验证
 * Bun.spawn terminal.data 签名: (terminal, data) => void
 * proc.stdin/stdout/stderr 为 null，使用 proc.terminal.write() 和 data 回调
 */

let passed = 0, failed = 0
function log(name: string, ok: boolean, detail = '') {
  if (ok) passed++; else failed++
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ': ' + detail : ''}`)
}

async function main() {
  console.log('=== Bun Terminal API PoC ===\n')
  console.log(`Bun version: ${Bun.version}\n`)

  // Test 1: Basic PTY
  await new Promise<void>(resolve => {
    let out = ''
    const proc = Bun.spawn(['/bin/bash', '-c', 'echo hello-pty'], {
      terminal: { cols: 80, rows: 24, data: (_terminal: any, data: any) => {
        out += new TextDecoder().decode(data)
      }, exit: () => {
        log('PTY 创建 + 命令输出', out.includes('hello-pty'))
        resolve()
      }}
    })
    setTimeout(() => { log('PTY 创建 + 命令输出', false, 'timeout'); resolve() }, 5000)
  })

  // Test 2: UTF-8/CJK
  await new Promise<void>(resolve => {
    let out = ''
    const proc = Bun.spawn(['/bin/bash', '-c', 'echo "你好世界"'], {
      terminal: { cols: 80, rows: 24, data: (_t: any, data: any) => {
        out += new TextDecoder().decode(data)
      }, exit: () => {
        log('UTF-8 / CJK 字符', out.includes('你好'))
        resolve()
      }}
    })
    setTimeout(() => { log('UTF-8 / CJK 字符', false, 'timeout'); resolve() }, 5000
    )
  })

  // Test 3: ANSI colors
  await new Promise<void>(resolve => {
    let out = ''
    const proc = Bun.spawn(['/bin/bash', '-c', 'echo -e "\\033[31mRED\\033[0m"'], {
      terminal: { cols: 80, rows: 24, data: (_t: any, data: any) => {
        out += new TextDecoder().decode(data)
      }, exit: () => {
        log('ANSI 转义序列', out.includes('RED') && out.includes('\x1b['))
        resolve()
      }}
    })
    setTimeout(() => { log('ANSI 转义序列', false, 'timeout'); resolve() }, 5000)
  })

  // Test 4: Resize + terminal.write
  await new Promise<void>(resolve => {
    let out = ''
    const proc = Bun.spawn(['/bin/bash', '-i'], {
      terminal: { cols: 80, rows: 24, data: (_t: any, data: any) => {
        out += new TextDecoder().decode(data)
      }}
    })
    setTimeout(() => {
      try {
        proc.terminal.write('tput cols\n')
        setTimeout(() => {
          proc.terminal.resize(120, 40)
          proc.terminal.write('tput cols\n')
          setTimeout(() => {
            proc.terminal.close()
            log('PTY Resize (80→120)', out.includes('120'))
            resolve()
          }, 800)
        }, 500)
      } catch (e: any) {
        try { proc.terminal.close() } catch {}
        log('PTY Resize (80→120)', false, e.message)
        resolve()
      }
    }, 300)
    setTimeout(() => { resolve() }, 8000)
  })

  // Test 5: Concurrent 4 terminals
  const results = await Promise.all([0,1,2,3].map(i =>
    new Promise<boolean>(resolve => {
      let out = ''
      const proc = Bun.spawn(['/bin/bash', '-c', `echo t${i}`], {
        terminal: { cols: 80, rows: 24, data: (_t: any, data: any) => {
          out += new TextDecoder().decode(data)
        }, exit: () => {
          resolve(out.includes(`t${i}`))
        }}
      })
      setTimeout(() => resolve(false), 5000)
    })
  ))
  log('并发 4 个终端', results.every(r => r))

  // Test 6: Close/destroy
  await new Promise<void>(resolve => {
    const proc = Bun.spawn(['/bin/bash', '-c', 'sleep 100'], {
      terminal: { cols: 80, rows: 24, data: () => {}, exit: () => {
        log('Terminal close() 销毁', true)
        resolve()
      }}
    })
    setTimeout(() => {
      try { proc.terminal.close() } catch { proc.kill() }
      setTimeout(() => { log('Terminal close()', false, 'no exit'); resolve() }, 2000)
    }, 500)
    setTimeout(() => { resolve() }, 5000)
  })

  console.log(`\n=== Summary: ${passed}/${passed+failed} passed ===`)
  process.exit(failed > 0 ? 1 : 0)
}

main()
