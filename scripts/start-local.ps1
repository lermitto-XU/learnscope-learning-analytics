param([switch]$Build)
$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$logRoot = Join-Path $projectRoot '.local'
$pidFile = Join-Path $logRoot 'processes.json'

function Assert-PortAvailable([int]$PortNumber) {
    # Binding works without the elevated permissions Get-NetTCPConnection can require.
    $listener = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, $PortNumber)
    try {
        $listener.ExclusiveAddressUse = $true
        $listener.Start()
    } catch {
        throw "Port $PortNumber is unavailable. Stop the existing local service before starting. $($_.Exception.Message)"
    } finally {
        $listener.Stop()
    }
}

# Check before Maven touches the running JAR, including when -Build was requested.
foreach ($portNumber in @(5173, 8080, 8001)) { Assert-PortAvailable $portNumber }
if (Test-Path -LiteralPath $pidFile) {
    foreach ($record in @(Get-Content -LiteralPath $pidFile -Raw | ConvertFrom-Json)) {
        $candidate = Get-Process -Id $record.Id -ErrorAction SilentlyContinue
        if ($candidate -and $candidate.ProcessName -eq $record.ProcessName) {
            if (!$record.StartTimeUtcTicks -or [string]$candidate.StartTime.ToUniversalTime().Ticks -eq $record.StartTimeUtcTicks) {
                throw 'A recorded service is still running. Run scripts/stop-local.ps1 before starting again.'
            }
        }
    }
    Remove-Item -LiteralPath $pidFile
}

$runtimeRoot = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies'
$jdkRoot = Get-ChildItem -LiteralPath (Join-Path $projectRoot '.tools') -Directory -ErrorAction SilentlyContinue | Where-Object Name -Like 'jdk*' | Select-Object -First 1
$javaExe = if ($jdkRoot) { Join-Path $jdkRoot.FullName 'bin\java.exe' } else { (Get-Command java -ErrorAction Stop).Source }
$pythonExe = Join-Path $projectRoot '.venv\Scripts\python.exe'
if (!(Test-Path -LiteralPath $pythonExe)) { throw 'Run scripts/setup-local.ps1 first.' }
$nodeExe = Join-Path $runtimeRoot 'node\bin\node.exe'
if (!(Test-Path -LiteralPath $nodeExe)) { $nodeExe = (Get-Command node -ErrorAction Stop).Source }
$jarPath = Join-Path $projectRoot 'server\target\learnscope-server-1.0.0.jar'
if ($Build -or !(Test-Path -LiteralPath $jarPath)) {
    $mavenRoot = Get-ChildItem -LiteralPath (Join-Path $projectRoot '.tools') -Directory -ErrorAction SilentlyContinue | Where-Object Name -Like 'apache-maven*' | Select-Object -First 1
    $mavenExe = if ($mavenRoot) { Join-Path $mavenRoot.FullName 'bin\mvn.cmd' } else { (Get-Command mvn -ErrorAction Stop).Source }
    if ($jdkRoot) { $env:JAVA_HOME = $jdkRoot.FullName }
    & $mavenExe -f (Join-Path $projectRoot 'server\pom.xml') package
    if ($LASTEXITCODE -ne 0) { throw 'Backend build failed' }
}
New-Item -ItemType Directory -Force -Path $logRoot | Out-Null
$recorded = @()

function Start-LocalService([string]$Name, [string]$Executable, [string[]]$Arguments, [string]$Directory) {
    $process = Start-Process -FilePath $Executable -ArgumentList $Arguments -WorkingDirectory $Directory -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $logRoot "$Name.log") -RedirectStandardError (Join-Path $logRoot "$Name-error.log")
    if ($process.HasExited) { throw "$Name exited during startup. Check .local/$Name-error.log." }
    return [pscustomobject]@{
        Process = $process
        Id = $process.Id
        ProcessName = $process.ProcessName
        StartTimeUtcTicks = [string]$process.StartTime.ToUniversalTime().Ticks
        Service = $Name
    }
}

function Assert-ServicesRunning {
    foreach ($record in $recorded) {
        $record.Process.Refresh()
        if ($record.Process.HasExited) { throw "$($record.Service) exited during startup. Check .local/$($record.Service)-error.log." }
    }
}

try {
    $recorded += Start-LocalService 'server' $javaExe @('-jar',('"' + $jarPath + '"')) $projectRoot
    $recorded += Start-LocalService 'predictor' $pythonExe @('-m','uvicorn','app:app','--app-dir',('"'+(Join-Path $projectRoot 'predictor')+'"'),'--host','127.0.0.1','--port','8001') (Join-Path $projectRoot 'predictor')
    $recorded += Start-LocalService 'web' $nodeExe @(('"'+(Join-Path $projectRoot 'web\node_modules\vite\bin\vite.js')+'"'),'--host','127.0.0.1','--port','5173','--strictPort') (Join-Path $projectRoot 'web')
    $recorded | Select-Object Id,ProcessName,StartTimeUtcTicks,Service | ConvertTo-Json | Set-Content -LiteralPath $pidFile -Encoding utf8

    $timer = [Diagnostics.Stopwatch]::StartNew()
    $ready = @{ server = $false; predictor = $false; web = $false }
    while ($timer.Elapsed.TotalSeconds -lt 60) {
        Assert-ServicesRunning
        try { $ready.server = (Invoke-RestMethod -Uri 'http://127.0.0.1:8080/api/health' -TimeoutSec 2).status -eq 'ok' } catch { $ready.server = $false }
        $predictionHealth = $null
        try { $predictionHealth = Invoke-RestMethod -Uri 'http://127.0.0.1:8001/health' -TimeoutSec 2 } catch { }
        if ($predictionHealth -and $predictionHealth.modelLoaded -eq $false) {
            throw 'Prediction model is missing. Run scripts/setup-local.ps1 to train it, then start again.'
        }
        $ready.predictor = $predictionHealth -and $predictionHealth.status -eq 'ok' -and $predictionHealth.modelLoaded -eq $true
        try {
            $webResponse = Invoke-WebRequest -Uri 'http://127.0.0.1:5173/' -UseBasicParsing -TimeoutSec 2
            $ready.web = $webResponse.StatusCode -eq 200 -and $webResponse.Content -match '<title>[^<]*LearnScope'
        } catch { $ready.web = $false }
        Assert-ServicesRunning
        if ($ready.server -and $ready.predictor -and $ready.web) { break }
        Start-Sleep -Milliseconds 500
    }
    if (!$ready.server -or !$ready.predictor -or !$ready.web) {
        $waiting = @($ready.Keys | Where-Object { !$ready[$_] }) -join ', '
        throw "Startup timed out waiting for: $waiting. Check the corresponding logs in .local."
    }
    Write-Output 'LearnScope is running at http://127.0.0.1:5173'
    Write-Output 'Frontend, backend and prediction model are ready.'
    Write-Output 'Stop with scripts/stop-local.ps1. Logs are in .local.'
} catch {
    $startupError = $_
    $survivors = @()
    foreach ($record in $recorded) {
        try {
            $candidate = Get-Process -Id $record.Id -ErrorAction SilentlyContinue
            # Only terminate processes started by this invocation, never a reused PID.
            if ($candidate -and [string]$candidate.StartTime.ToUniversalTime().Ticks -eq $record.StartTimeUtcTicks) {
                & taskkill.exe /PID $record.Id /T /F 2>&1 | Out-Null
                $candidate.Refresh()
                if (!$candidate.HasExited) { $survivors += $record }
            }
        } catch {
            $survivors += $record
            Write-Warning "Could not clean up process $($record.Id): $($_.Exception.Message)"
        }
    }
    if ($survivors.Count -gt 0) {
        $survivors | Select-Object Id,ProcessName,StartTimeUtcTicks,Service | ConvertTo-Json | Set-Content -LiteralPath $pidFile -Encoding utf8
        Write-Warning 'Some processes could not be stopped. Their records were kept; run scripts/stop-local.ps1.'
    } elseif (Test-Path -LiteralPath $pidFile) {
        Remove-Item -LiteralPath $pidFile
    }
    throw $startupError
}
