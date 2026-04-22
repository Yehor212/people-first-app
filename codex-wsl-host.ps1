[CmdletBinding()]
param(
    [string]$Distribution = "Ubuntu"
)

$ErrorActionPreference = "Stop"

function Write-Step {
    param([string]$Message)
    Write-Host "[codex-wsl-host] $Message"
}

$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).
    IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Step "Requesting elevation via UAC"

    $scriptPath = $MyInvocation.MyCommand.Path
    $quotedScriptPath = '"' + $scriptPath + '"'
    $quotedDistribution = '"' + $Distribution + '"'
    $argumentList = @(
        "-NoProfile"
        "-ExecutionPolicy"
        "Bypass"
        "-File"
        $quotedScriptPath
        "-Distribution"
        $quotedDistribution
    )

    try {
        Start-Process -FilePath "powershell.exe" -Verb RunAs -ArgumentList $argumentList | Out-Null
        Write-Step "Elevation request sent. Approve the UAC prompt if it appears."
        return
    } catch {
        throw "Elevation was not granted. Re-run the script and approve the UAC prompt."
    }
}

Write-Step "Checking WSL status"
$wslStatus = & wsl.exe --status 2>$null
$wslStatusText = ($wslStatus | Out-String)

if ($LASTEXITCODE -ne 0) {
    Write-Step "Installing WSL"
    & wsl.exe --install -d $Distribution
    if ($LASTEXITCODE -ne 0) {
        throw "WSL installation failed."
    }
    Write-Step "WSL install command completed. A reboot may be required."
} else {
    Write-Step "WSL is already available"
}

Write-Step "Setting WSL default version to 2"
& wsl.exe --set-default-version 2
if ($LASTEXITCODE -ne 0) {
    throw "Failed to set WSL default version to 2."
}

$listed = & wsl.exe -l -q 2>$null
$listedText = ($listed | Out-String).Trim()

if (-not $listedText) {
    Write-Step "No distribution appears installed yet. If required, run:"
    Write-Host "  wsl --install -d $Distribution"
} else {
    Write-Step "Installed distributions:"
    Write-Host $listedText
}

Write-Step "Next steps"
Write-Host "1. Start the distro with: wsl"
Write-Host "2. Run: bash ~/codex-wsl-guest.sh"
Write-Host "3. Clone the repo into ~/code and run Codex there"
