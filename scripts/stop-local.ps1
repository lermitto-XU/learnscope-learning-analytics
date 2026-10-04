$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$pidFile = Join-Path $projectRoot '.local\processes.json'
if (!(Test-Path -LiteralPath $pidFile)) { Write-Output 'No services recorded by start-local.ps1'; exit }
$records = Get-Content -LiteralPath $pidFile -Raw | ConvertFrom-Json
$remaining = @()
foreach ($record in $records) {
    try {
        $candidate = Get-Process -Id $record.Id -ErrorAction SilentlyContinue
        if (!$candidate) { continue }
        if ($record.StartTimeUtcTicks) {
            # The creation time identifies this process even after Windows reuses its PID.
            $owned = $candidate.ProcessName -eq $record.ProcessName -and [string]$candidate.StartTime.ToUniversalTime().Ticks -eq $record.StartTimeUtcTicks
        } else {
            # Backward compatibility with records written by the first version.
            $legacy = Get-CimInstance Win32_Process -Filter "ProcessId=$($record.Id)" -ErrorAction Stop
            $owned = $candidate.ProcessName -eq $record.ProcessName -and $legacy.CommandLine -and $legacy.CommandLine.IndexOf($projectRoot, [StringComparison]::OrdinalIgnoreCase) -ge 0
        }
        if (!$owned) { continue }
        & taskkill.exe /PID $record.Id /T /F
        $candidate.Refresh()
        if (!$candidate.HasExited) { throw "Process $($record.Id) is still running." }
    } catch {
        $remaining += $record
        Write-Warning "Could not verify or stop recorded process $($record.Id): $($_.Exception.Message)"
    }
}
if ($remaining.Count -gt 0) {
    $remaining | ConvertTo-Json | Set-Content -LiteralPath $pidFile -Encoding utf8
    throw 'Some services could not be stopped. Their records were kept so you can retry.'
}
Remove-Item -LiteralPath $pidFile
Write-Output 'Stopped recorded LearnScope services.'
