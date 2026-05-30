/**
 * PoC 6: Path Security Enhancement
 * 验证增强版路径安全中间件防御各种路径遍历攻击
 */

import path from 'path'
import fs from 'fs'
import os from 'os'

const results: { attack: string; blocked: boolean; detail: string }[] = []

// Enhanced sanitizePath
function sanitizePath(root: string, input: string): string {
  // 1. URL decode
  const decoded = decodeURIComponent(input)
  // 2. Unicode NFC normalization
  const normalized = decoded.normalize('NFC')
  // 3. Path resolve
  const resolved = path.resolve(root, normalized)
  // 4. Realpath (resolve symlinks)
  let real: string
  try {
    real = fs.realpathSync(resolved)
  } catch {
    // If file doesn't exist, use resolved path but check it
    real = resolved
  }
  // 5. Prefix check
  const rootReal = fs.realpathSync(root)
  if (!real.startsWith(rootReal + path.sep) && real !== rootReal) {
    throw new Error(`Path traversal detected: ${real} escapes ${rootReal}`)
  }
  return real
}

async function main() {
  console.log('=== Path Security Enhancement PoC ===\n')

  // Setup test environment
  const testRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'pathsec-'))
  const testFile = path.join(testRoot, 'safe.txt')
  const testSubDir = path.join(testRoot, 'subdir')
  fs.writeFileSync(testFile, 'safe content')
  fs.mkdirSync(testSubDir)

  console.log(`Test root: ${testRoot}\n`)

  // Helper
  function tryPath(attack: string, input: string) {
    try {
      const result = sanitizePath(testRoot, input)
      results.push({ attack, blocked: false, detail: `resolved to: ${result}` })
      console.log(`  ✗ ${attack}: NOT blocked → ${result}`)
    } catch (e: any) {
      results.push({ attack, blocked: true, detail: e.message })
      console.log(`  ✓ ${attack}: blocked (${e.message})`)
    }
  }

  function tryValidPath(name: string, input: string) {
    try {
      const result = sanitizePath(testRoot, input)
      const valid = result.startsWith(testRoot)
      results.push({ attack: `VALID: ${name}`, blocked: !valid, detail: `resolved to: ${result}` })
      console.log(`  ${valid ? '✓' : '✗'} ${name}: resolved to ${result} (valid=${valid})`)
    } catch (e: any) {
      results.push({ attack: `VALID: ${name}`, blocked: true, detail: e.message })
      console.log(`  ✗ ${name}: blocked (FALSE POSITIVE: ${e.message})`)
    }
  }

  // Attack vectors
  console.log('--- Attack Vectors ---')
  tryPath('Basic traversal', '../../../etc/passwd')
  tryPath('Deep traversal', '../../.././../../etc/shadow')
  tryPath('URL encoded', '%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd')
  tryPath('Mixed encoding', '..%2f..%2f..%2fetc%2fpasswd')
  tryPath('Double URL encoded', '%252e%252e%252f%252e%252e%252fetc%252fpasswd')
  tryPath('Null byte injection', 'safe.txt%00.exe')
  tryPath('Path with dots', '.../.../.../etc/passwd')
  tryPath('Backslash (Windows)', '..\\..\\..\\etc\\passwd')
  tryPath('Absolute path escape', '/etc/passwd')
  tryPath('Unicode lookalike', '../../etc/passwd')

  // Symlink test
  console.log('\n--- Symlink Attack ---')
  const symlinkPath = path.join(testRoot, 'evil-link')
  try {
    fs.symlinkSync('/etc', symlinkPath)
    tryPath('Symlink to /etc', 'evil-link/passwd')
  } catch (e: any) {
    console.log(`  (symlink creation skipped: ${e.message})`)
  } finally {
    try { fs.unlinkSync(symlinkPath) } catch {}
  }

  // Valid paths (should NOT be blocked)
  console.log('\n--- Valid Paths (should pass) ---')
  tryValidPath('Simple file', 'safe.txt')
  tryValidPath('Subdirectory file', 'subdir/test.txt')
  tryValidPath('Dot prefix', './safe.txt')
  tryValidPath('Repeated slashes', 'subdir//test.txt')

  // Summary
  console.log('\n=== Summary ===')
  const attacks = results.filter(r => !r.attack.startsWith('VALID'))
  const valids = results.filter(r => r.attack.startsWith('VALID'))
  const blockedCount = attacks.filter(r => r.blocked).length
  const falseNegatives = attacks.filter(r => !r.blocked)
  const falsePositives = valids.filter(r => r.blocked)

  console.log(`Attacks blocked: ${blockedCount}/${attacks.length}`)
  if (falseNegatives.length > 0) {
    console.log('False negatives (attacks NOT blocked):')
    falseNegatives.forEach(r => console.log(`  ⚠ ${r.attack}: ${r.detail}`))
  }

  console.log(`Valid paths passed: ${valids.length - falsePositives.length}/${valids.length}`)
  if (falsePositives.length > 0) {
    console.log('False positives (valid paths blocked):')
    falsePositives.forEach(r => console.log(`  ⚠ ${r.attack}: ${r.detail}`))
  }

  // Cleanup
  fs.rmSync(testRoot, { recursive: true })

  const allPassed = falseNegatives.length === 0 && falsePositives.length === 0
  process.exit(allPassed ? 0 : 1)
}

main()
