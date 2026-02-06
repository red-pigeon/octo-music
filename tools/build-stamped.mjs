import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

function bin(name) {
  // Let Node/libuv resolve the right executable/shim via PATH/PATHEXT.
  return name
}

function quoteArg(arg) {
  const s = String(arg)
  if (!/[\s"]/g.test(s)) return s
  return `"${s.replaceAll('"', '\\"')}"`
}

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const isWindows = process.platform === 'win32'

    // On Windows, `npm`/`npx` are often cmd-shims; invoking them without a shell
    // can fail depending on how Node/npm were installed.
    const shouldUseShell = isWindows && (cmd === 'npm' || cmd === 'npx')

    const child = shouldUseShell
      ? spawn([cmd, ...args].map(quoteArg).join(' '), {
          stdio: 'inherit',
          shell: true,
          ...opts
        })
      : spawn(cmd, args, {
          stdio: 'inherit',
          ...opts
        })

    child.once('error', err => reject(err))
    child.once('exit', code => {
      if (code === 0) resolve()
      else reject(new Error(`${cmd} ${args.join(' ')} exited with code ${code}`))
    })
  })
}

function pad2(n) {
  return String(n).padStart(2, '0')
}

function stamp() {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = pad2(d.getMonth() + 1)
  const dd = pad2(d.getDate())
  const hh = pad2(d.getHours())
  const mi = pad2(d.getMinutes())
  const ss = pad2(d.getSeconds())
  return `${yyyy}${mm}${dd}-${hh}${mi}${ss}`
}

async function main() {
  const mode = process.argv[2] || 'dir' // dir | nsis | appimage
  const platform = process.argv[3] || 'win' // win | linux

  const repoRoot = process.cwd()
  const pkgPath = path.join(repoRoot, 'package.json')
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
  const version = pkg.version || '0.0.0'

  // Best-effort: close running app so app.asar isn't locked.
  if (process.platform === 'win32') {
    try {
      // Suppress stderr noise when not running.
      await run('taskkill', ['/IM', 'Octo.exe', '/F'], { stdio: 'ignore' })
    } catch {
      // ignore (not running)
    }
  }

  const outDir = path.join(repoRoot, 'release-builds', `${version}-${stamp()}`)
  fs.mkdirSync(outDir, { recursive: true })

  // 1) Build Vite
  await run(bin('npm'), ['run', 'build'])

  // 2) Package via electron-builder
  const ebArgs = ['electron-builder', `--config.directories.output=${outDir}`]
  
  if (platform === 'linux') {
    ebArgs.push('--linux')
  } else {
    ebArgs.push('--win')
  }

  if (mode === 'dir') {
    ebArgs.push('dir')
  } else if (mode === 'nsis') {
    ebArgs.push('nsis')
  } else if (mode === 'appimage') {
    ebArgs.push('AppImage')
  } else {
    throw new Error(`Unknown mode: ${mode} (use dir|nsis|appimage)`) 
  }

  await run(bin('npx'), ['--yes', ...ebArgs])

  console.log(`\nBuild output: ${outDir}`)
  if (mode === 'dir') {
    console.log(`Run: ${path.join(outDir, 'win-unpacked', 'Octo.exe')}`)
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
