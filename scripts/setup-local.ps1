$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$runtimeRoot = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies'
$pythonExe = Join-Path $runtimeRoot 'python\python.exe'
if (!(Test-Path -LiteralPath $pythonExe)) { $pythonExe=(Get-Command python -ErrorAction Stop).Source }
$nodeExe=Join-Path $runtimeRoot 'node\bin\node.exe'
if (!(Test-Path -LiteralPath $nodeExe)) { $nodeExe=(Get-Command node -ErrorAction Stop).Source }
$pnpmExe=Join-Path $runtimeRoot 'bin\fallback\pnpm.cmd'
if (!(Test-Path -LiteralPath $pnpmExe)) { $pnpmExe=(Get-Command pnpm -ErrorAction Stop).Source }
Set-Location -LiteralPath $projectRoot
& $pythonExe -X utf8 (Join-Path $PSScriptRoot 'bootstrap_tools.py')
if ($LASTEXITCODE -ne 0) { throw 'Tool bootstrap failed' }
if (!(Test-Path -LiteralPath '.venv\Scripts\python.exe')) { & $pythonExe -m venv .venv }
& '.\.venv\Scripts\python.exe' -m pip install -r predictor\requirements.txt
if ($LASTEXITCODE -ne 0) { throw 'Python dependency installation failed' }
& '.\.venv\Scripts\python.exe' -X utf8 predictor\train.py
if ($LASTEXITCODE -ne 0) { throw 'Model training failed' }
Push-Location -LiteralPath (Join-Path $projectRoot 'web')
try { & $pnpmExe install --frozen-lockfile; if ($LASTEXITCODE -ne 0) { throw 'Frontend dependency installation failed' } } finally { Pop-Location }
Write-Output 'Setup complete. Run scripts/start-local.ps1 -Build'
