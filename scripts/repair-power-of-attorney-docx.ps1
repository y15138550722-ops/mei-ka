Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

function Write-Utf8NoBom {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Path,
    [Parameter(Mandatory = $true)]
    [string]$Content
  )

  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($Path, $Content, $utf8NoBom)
}

function Test-ZipHeader {
  param(
    [Parameter(Mandatory = $true)]
    [byte[]]$Bytes
  )

  return $Bytes.Length -ge 4 -and $Bytes[0] -eq 0x50 -and $Bytes[1] -eq 0x4B -and $Bytes[2] -eq 0x03 -and $Bytes[3] -eq 0x04
}

function Escape-XmlText {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Value
  )

  return [System.Security.SecurityElement]::Escape($Value)
}

function New-DocxParagraphXml {
  param(
    [Parameter(Mandatory = $true)]
    [AllowEmptyString()]
    [string]$Text
  )

  $runProperties = '<w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:eastAsia="SimSun"/><w:sz w:val="24"/></w:rPr>'

  if ([string]::IsNullOrEmpty($Text)) {
    return "<w:p><w:r>$runProperties<w:br/></w:r></w:p>"
  }

  $escapedText = Escape-XmlText -Value $Text
  return "<w:p><w:r>$runProperties<w:t xml:space=""preserve"">$escapedText</w:t></w:r></w:p>"
}

function New-MinimalDocxXml {
  param(
    [Parameter(Mandatory = $true)]
    [AllowEmptyString()]
    [string[]]$Paragraphs
  )

  $paragraphXml = ($Paragraphs | ForEach-Object { New-DocxParagraphXml -Text $_ }) -join ''

  return @{
    ContentTypes = @'
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>
'@;
    Relationships = @'
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>
'@;
    Document = @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    $paragraphXml
    <w:sectPr>
      <w:pgSz w:w="11906" w:h="16838"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>
"@;
  }
}

function Convert-WordHtmlToParagraphs {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Html
  )

  $bodyMatch = [regex]::Match($Html, '(?is)<body[^>]*>(?<body>.*)</body>')
  $bodyContent = if ($bodyMatch.Success) { $bodyMatch.Groups['body'].Value } else { $Html }

  $normalized = $bodyContent
  $normalized = [regex]::Replace($normalized, '(?is)<!--.*?-->', '')
  $normalized = [regex]::Replace($normalized, '(?is)<img\b[^>]*>', "`n[Embedded image omitted in generated DOCX]`n")
  $normalized = [regex]::Replace($normalized, '(?is)<br\s*/?>', "`n")
  $normalized = [regex]::Replace($normalized, '(?is)</p\s*>', "`n")
  $normalized = [regex]::Replace($normalized, '(?is)</div\s*>', "`n")
  $normalized = [regex]::Replace($normalized, '(?is)</tr\s*>', "`n")
  $normalized = [regex]::Replace($normalized, '(?is)</t[dh]\s*>', '    ')
  $normalized = [regex]::Replace($normalized, '(?is)<[^>]+>', '')

  $decoded = [System.Net.WebUtility]::HtmlDecode($normalized)
  $decoded = $decoded -replace "`r`n?", "`n"
  $decoded = $decoded -replace '[\x00-\x08\x0B\x0C\x0E-\x1F]', ''
  $decoded = $decoded -replace "[`t ]+`n", "`n"
  $decoded = $decoded -replace "`n{3,}", "`n`n"

  $paragraphs = New-Object System.Collections.Generic.List[string]
  $lastBlank = $false

  foreach ($line in ($decoded -split "`n")) {
    $trimmed = ($line -replace "`t", '    ').Trim()

    if ([string]::IsNullOrWhiteSpace($trimmed)) {
      if (-not $lastBlank) {
        [void]$paragraphs.Add('')
      }

      $lastBlank = $true
      continue
    }

    [void]$paragraphs.Add($trimmed)
    $lastBlank = $false
  }

  return $paragraphs.ToArray()
}

function Write-DocxPackage {
  param(
    [Parameter(Mandatory = $true)]
    [string]$OutputPath,
    [Parameter(Mandatory = $true)]
    [hashtable]$PackageXml
  )

  if (Test-Path -LiteralPath $OutputPath) {
    Remove-Item -LiteralPath $OutputPath -Force
  }

  $zip = [System.IO.Compression.ZipFile]::Open($OutputPath, [System.IO.Compression.ZipArchiveMode]::Create)

  try {
    $entries = @{
      '[Content_Types].xml' = $PackageXml.ContentTypes
      '_rels/.rels' = $PackageXml.Relationships
      'word/document.xml' = $PackageXml.Document
    }

    foreach ($entryPath in $entries.Keys) {
      $entry = $zip.CreateEntry($entryPath, [System.IO.Compression.CompressionLevel]::Optimal)
      $stream = $entry.Open()

      try {
        $writer = New-Object System.IO.StreamWriter($stream, (New-Object System.Text.UTF8Encoding($false)))
        try {
          $writer.Write($entries[$entryPath])
        }
        finally {
          $writer.Dispose()
        }
      }
      finally {
        $stream.Dispose()
      }
    }
  }
  finally {
    $zip.Dispose()
  }
}

$repoRoot = Split-Path -Parent $PSScriptRoot
$docsDir = Join-Path $repoRoot 'docs\Preview file\yulan'
$publicDir = Join-Path $repoRoot 'src\public\Preview file\yulan'
$backupDir = Join-Path $repoRoot 'docs\_repair-backups'
$docsDocxPath = Join-Path $docsDir 'Power of Attorney.docx'
$publicDocxPath = Join-Path $publicDir 'Power of Attorney.docx'
$docsHtmlBackupPath = Join-Path $backupDir 'Power of Attorney.source.html'

$sourceHtml =
  if (Test-Path -LiteralPath $docsHtmlBackupPath) {
    Get-Content -LiteralPath $docsHtmlBackupPath -Raw -Encoding UTF8
  }
  else {
    $rawBytes = [System.IO.File]::ReadAllBytes($docsDocxPath)

    if (Test-ZipHeader -Bytes $rawBytes) {
      throw "The DOCX file has already been repaired, but the HTML backup is missing: $docsHtmlBackupPath"
    }

    $html = [System.Text.Encoding]::UTF8.GetString($rawBytes)

    if ($html -notmatch '(?is)<html') {
      throw "The source file is not Word HTML and cannot be repaired automatically."
    }

    if (-not (Test-Path -LiteralPath $backupDir)) {
      New-Item -ItemType Directory -Path $backupDir | Out-Null
    }

    Write-Utf8NoBom -Path $docsHtmlBackupPath -Content $html
    $html
  }

$paragraphs = Convert-WordHtmlToParagraphs -Html $sourceHtml

if ($paragraphs.Count -eq 0) {
  throw 'No readable content was extracted from the Word HTML source.'
}

$packageXml = New-MinimalDocxXml -Paragraphs $paragraphs
Write-DocxPackage -OutputPath $docsDocxPath -PackageXml $packageXml
[System.IO.File]::Copy($docsDocxPath, $publicDocxPath, $true)

Write-Host "Repaired DOCX written to:"
Write-Host " - $docsDocxPath"
Write-Host " - $publicDocxPath"
Write-Host "HTML backup written to:"
Write-Host " - $docsHtmlBackupPath"
