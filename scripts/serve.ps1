param(
  [int]$Port = 8000
)

$ErrorActionPreference = 'Stop'

$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path

Add-Type -AssemblyName System.Net.HttpListener | Out-Null
$listener = [System.Net.HttpListener]::new()
$listener.Prefixes.Add("http://localhost:$Port/")
$listener.Start()

Write-Host "Serving $root at http://localhost:$Port/  (Ctrl+C to stop)"

function Get-ContentType([string]$path) {
  switch ([IO.Path]::GetExtension($path).ToLowerInvariant()) {
    '.html' { 'text/html; charset=utf-8' }
    '.js'   { 'text/javascript; charset=utf-8' }
    '.css'  { 'text/css; charset=utf-8' }
    '.json' { 'application/json; charset=utf-8' }
    '.png'  { 'image/png' }
    '.jpg'  { 'image/jpeg' }
    '.jpeg' { 'image/jpeg' }
    '.gif'  { 'image/gif' }
    '.svg'  { 'image/svg+xml' }
    '.ico'  { 'image/x-icon' }
    '.txt'  { 'text/plain; charset=utf-8' }
    default { 'application/octet-stream' }
  }
}

try {
  while ($listener.IsListening) {
    $context = $listener.GetContext()
    $request = $context.Request
    $response = $context.Response

    try {
      $rawPath = $request.Url.AbsolutePath
      if ([string]::IsNullOrWhiteSpace($rawPath) -or $rawPath -eq '/') {
        $rawPath = '/index.html'
      }

      $relative = [Uri]::UnescapeDataString($rawPath.TrimStart('/')) -replace '/', '\'
      if ($relative -match '\.\.') {
        $response.StatusCode = 400
        $bytes = [Text.Encoding]::UTF8.GetBytes("Bad request")
        $response.OutputStream.Write($bytes, 0, $bytes.Length)
        continue
      }

      $fullPath = Join-Path $root $relative
      if (-not (Test-Path -LiteralPath $fullPath -PathType Leaf)) {
        $response.StatusCode = 404
        $bytes = [Text.Encoding]::UTF8.GetBytes("Not found")
        $response.OutputStream.Write($bytes, 0, $bytes.Length)
        continue
      }

      $response.StatusCode = 200
      $response.ContentType = Get-ContentType $fullPath
      $data = [IO.File]::ReadAllBytes($fullPath)
      $response.ContentLength64 = $data.Length
      $response.OutputStream.Write($data, 0, $data.Length)
    } catch {
      $response.StatusCode = 500
      $bytes = [Text.Encoding]::UTF8.GetBytes("Server error")
      $response.OutputStream.Write($bytes, 0, $bytes.Length)
    } finally {
      $response.OutputStream.Close()
      $response.Close()
    }
  }
} finally {
  if ($listener.IsListening) { $listener.Stop() }
  $listener.Close()
}

