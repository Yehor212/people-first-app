[CmdletBinding()]
param(
    [string]$ProjectPath = $PSScriptRoot
)

$ErrorActionPreference = "Stop"

function Write-Step {
    param([string]$Message)
    Write-Host "[codex-from-powershell] $Message"
}

function Convert-ToWslPath {
    param([string]$WindowsPath)

    $resolved = (Resolve-Path -LiteralPath $WindowsPath).Path

    if ($resolved -notmatch '^[A-Za-z]:\\') {
        throw "Expected a Windows path like C:\..., got: $resolved"
    }

    $drive = $resolved.Substring(0, 1).ToLowerInvariant()
    $rest = $resolved.Substring(2) -replace '\\', '/'
    return "/mnt/$drive$rest"
}

function Invoke-WslBash {
    param(
        [string]$Command,
        [switch]$AsRoot
    )

    $arguments = @()
    if ($AsRoot) {
        $arguments += @("-u", "root")
    }

    $arguments += @("-e", "bash", "-lc", $Command)

    & wsl.exe @arguments
    if ($LASTEXITCODE -ne 0) {
        throw "WSL command failed: $Command"
    }
}

Write-Step "Resolving project path"
$wslProjectPath = Convert-ToWslPath -WindowsPath $ProjectPath

Write-Step "Installing rsync in WSL"
Invoke-WslBash -AsRoot "export DEBIAN_FRONTEND=noninteractive; apt-get update && apt-get install -y rsync"

Write-Step "Bootstrapping Node.js and Codex in WSL"
Invoke-WslBash "bash '$wslProjectPath/codex-wsl-guest.sh'"

Write-Step "Launching Codex from Linux-backed checkout"
Invoke-WslBash "bash '$wslProjectPath/codex-wsl-run.sh'"
