$ErrorActionPreference = 'Stop'
$taskNode = (Get-Command node -ErrorAction Stop).Source
$taskScript = Join-Path $PSScriptRoot 'verify-saved-key.cjs'
$taskSecureKey = Read-Host 'Paste the TOKEN_ENCRYPTION_KEY from your saved recovery copy (hidden), then press Enter' -AsSecureString
$taskPointer = [IntPtr]::Zero
$taskProcess = $null
$taskKeyBytes = $null
try {
  $taskInfo = New-Object System.Diagnostics.ProcessStartInfo
  $taskInfo.FileName = $taskNode
  $taskInfo.Arguments = '"' + $taskScript + '" --verify'
  $taskInfo.UseShellExecute = $false
  $taskInfo.CreateNoWindow = $true
  $taskInfo.WindowStyle = [System.Diagnostics.ProcessWindowStyle]::Hidden
  $taskInfo.RedirectStandardInput = $true
  $taskProcess = [System.Diagnostics.Process]::Start($taskInfo)
  $taskPointer = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($taskSecureKey)
  $taskKeyBytes = [System.Text.Encoding]::UTF8.GetBytes([System.Runtime.InteropServices.Marshal]::PtrToStringBSTR($taskPointer))
  $taskProcess.StandardInput.BaseStream.Write($taskKeyBytes, 0, $taskKeyBytes.Length)
  $taskProcess.StandardInput.BaseStream.Flush()
  $taskProcess.StandardInput.Close()
  [Array]::Clear($taskKeyBytes, 0, $taskKeyBytes.Length)
  [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($taskPointer)
  $taskPointer = [IntPtr]::Zero
  $taskSecureKey.Dispose()
  $taskProcess.WaitForExit()
} finally {
  if ($null -ne $taskKeyBytes) { [Array]::Clear($taskKeyBytes, 0, $taskKeyBytes.Length) }
  if ($taskPointer -ne [IntPtr]::Zero) { [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($taskPointer) }
  if ($null -ne $taskSecureKey) { $taskSecureKey.Dispose() }
  if ($null -ne $taskProcess) { $taskProcess.Dispose() }
}
