$ErrorActionPreference = 'Stop'

$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$WorkspaceRoot = (Resolve-Path (Join-Path $ProjectRoot '..')).Path
$ZipPath = Join-Path $WorkspaceRoot 'pozo-com-py-hostinger-ready-2026-09-02.zip'

if (Test-Path -LiteralPath $ZipPath) {
    $resolvedZip = (Resolve-Path -LiteralPath $ZipPath).Path
    if ((Split-Path $resolvedZip -Parent) -ne $WorkspaceRoot) {
        throw "Refusing to replace ZIP outside workspace: $resolvedZip"
    }
    Remove-Item -LiteralPath $resolvedZip
}

$deployRoots = @(
    'assets',
    'config',
    'contacto',
    'gracias',
    'servicios',
    'zonas',
    'privacidad'
)

$rootFiles = @('.htaccess', '404.html', 'contacto.php', 'favicon.svg', 'index.html', 'robots.txt', 'sitemap.xml')

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$stream = [System.IO.File]::Open($ZipPath, [System.IO.FileMode]::CreateNew)
try {
    $archive = [System.IO.Compression.ZipArchive]::new($stream, [System.IO.Compression.ZipArchiveMode]::Create, $false)
    try {
        $files = @()
        foreach ($rootFile in $rootFiles) {
            $files += Get-Item -LiteralPath (Join-Path $ProjectRoot $rootFile)
        }
        foreach ($deployRoot in $deployRoots) {
            $files += Get-ChildItem -LiteralPath (Join-Path $ProjectRoot $deployRoot) -Recurse -File
        }

        foreach ($file in $files) {
            $entryName = $file.FullName.Substring($ProjectRoot.Length + 1).Replace('\', '/')
            [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
                $archive,
                $file.FullName,
                $entryName,
                [System.IO.Compression.CompressionLevel]::Optimal
            ) | Out-Null
        }
    }
    finally {
        $archive.Dispose()
    }
}
finally {
    $stream.Dispose()
}

Write-Output $ZipPath
