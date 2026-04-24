param(
  [string]$DocsRoot = (Join-Path (Split-Path -Parent $PSScriptRoot) 'docs\Preview file'),
  [string]$BackupRoot = (Join-Path (Split-Path -Parent $PSScriptRoot) 'docs\_repair-backups'),
  [string]$MirrorRoot = (Join-Path (Split-Path -Parent $PSScriptRoot) 'src\dist\Preview file'),
  [switch]$MirrorToDist = $true,
  [switch]$RebuildFromBackups
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
Add-Type -AssemblyName System.Drawing

try {
  Add-Type -AssemblyName System.Text.Encoding.CodePages
}
catch {
}

if ('System.Text.CodePagesEncodingProvider' -as [type]) {
  [System.Text.Encoding]::RegisterProvider([System.Text.CodePagesEncodingProvider]::Instance)
}

function Write-Utf8NoBom {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Path,
    [Parameter(Mandatory = $true)]
    [string]$Content
  )

  $parent = Split-Path -Parent $Path
  if ($parent -and -not (Test-Path -LiteralPath $parent)) {
    New-Item -ItemType Directory -Path $parent | Out-Null
  }

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

function Get-RelativePath {
  param(
    [Parameter(Mandatory = $true)]
    [string]$BasePath,
    [Parameter(Mandatory = $true)]
    [string]$TargetPath
  )

  $resolvedBase = Resolve-Path -LiteralPath $BasePath
  $resolvedTarget = Resolve-Path -LiteralPath $TargetPath
  $baseUri = New-Object System.Uri(($resolvedBase.Path.TrimEnd('\') + '\'))
  $targetUri = New-Object System.Uri($resolvedTarget.Path)
  return [System.Uri]::UnescapeDataString($baseUri.MakeRelativeUri($targetUri).ToString()).Replace('/', '\')
}

function Get-DocxContentEncoding {
  param(
    [Parameter(Mandatory = $true)]
    [byte[]]$Bytes
  )

  $sampleLength = [Math]::Min(4096, $Bytes.Length)
  $sample = [System.Text.Encoding]::ASCII.GetString($Bytes, 0, $sampleLength)
  $charsetMatch = [regex]::Match($sample, '(?i)charset\s*=\s*["'']?(?<charset>[A-Za-z0-9._-]+)')
  $declaredCharset = $charsetMatch.Groups['charset'].Value.Trim()
  $encodingNames = New-Object System.Collections.Generic.List[string]

  if ($declaredCharset) {
    [void]$encodingNames.Add($declaredCharset)
  }

  foreach ($encodingName in @('gb18030', 'gbk', 'gb2312', 'utf-8')) {
    if (-not $encodingNames.Contains($encodingName)) {
      [void]$encodingNames.Add($encodingName)
    }
  }

  foreach ($encodingName in $encodingNames) {
    try {
      return [System.Text.Encoding]::GetEncoding($encodingName)
    }
    catch {
      continue
    }
  }

  return [System.Text.Encoding]::UTF8
}

function Read-NonZipWordHtml {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Path
  )

  $bytes = [System.IO.File]::ReadAllBytes($Path)
  if (Test-ZipHeader -Bytes $bytes) {
    return $null
  }

  $encoding = Get-DocxContentEncoding -Bytes $bytes
  return $encoding.GetString($bytes)
}

function Get-WordHtmlBackupPath {
  param(
    [Parameter(Mandatory = $true)]
    [string]$DocxPath
  )

  $relativeDocPath = Get-RelativePath -BasePath $DocsRoot -TargetPath $DocxPath
  return Join-Path $BackupRoot ($relativeDocPath -replace '\.docx$', '.source.html')
}

function Save-WordHtmlBackup {
  param(
    [Parameter(Mandatory = $true)]
    [string]$DocxPath,
    [Parameter(Mandatory = $true)]
    [string]$Html
  )

  $backupPath = Get-WordHtmlBackupPath -DocxPath $DocxPath
  Write-Utf8NoBom -Path $backupPath -Content $Html
  return $backupPath
}

function Read-WordHtmlBackup {
  param(
    [Parameter(Mandatory = $true)]
    [string]$DocxPath
  )

  $backupPath = Get-WordHtmlBackupPath -DocxPath $DocxPath
  if (-not (Test-Path -LiteralPath $backupPath)) {
    return $null
  }

  return [pscustomobject]@{
    Html = Get-Content -LiteralPath $backupPath -Raw -Encoding UTF8
    BackupPath = $backupPath
  }
}

function Get-SourceHtmlForDocx {
  param(
    [Parameter(Mandatory = $true)]
    [string]$DocxPath
  )

  $html = Read-NonZipWordHtml -Path $DocxPath
  if ($html -and $html -match '(?is)<html') {
    $backupPath = Save-WordHtmlBackup -DocxPath $DocxPath -Html $html
    return [pscustomobject]@{
      Html = $html
      BackupPath = $backupPath
      Source = 'current'
    }
  }

  if (-not $RebuildFromBackups) {
    return $null
  }

  $backup = Read-WordHtmlBackup -DocxPath $DocxPath
  if ($null -eq $backup -or $backup.Html -notmatch '(?is)<html') {
    return $null
  }

  return [pscustomobject]@{
    Html = $backup.Html
    BackupPath = $backup.BackupPath
    Source = 'backup'
  }
}

function Escape-XmlText {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Value
  )

  return [System.Security.SecurityElement]::Escape($Value)
}

function Get-ImageMimeType {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Extension
  )

  switch ($Extension.ToLowerInvariant()) {
    '.png' { return 'image/png' }
    '.jpg' { return 'image/jpeg' }
    '.jpeg' { return 'image/jpeg' }
    '.gif' { return 'image/gif' }
    '.bmp' { return 'image/bmp' }
    default { return 'application/octet-stream' }
  }
}

function Get-ImagePartContentTypeEntry {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Extension
  )

  $normalizedExtension = $Extension.TrimStart('.').ToLowerInvariant()
  $mimeType = Get-ImageMimeType -Extension ('.' + $normalizedExtension)
  return "<Default Extension=""$normalizedExtension"" ContentType=""$mimeType""/>"
}

function Get-ImageSize {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Path
  )

  $image = [System.Drawing.Image]::FromFile($Path)

  try {
    return @{
      Width = [int]$image.Width
      Height = [int]$image.Height
    }
  }
  finally {
    $image.Dispose()
  }
}

function Convert-PixelsToEmu {
  param(
    [Parameter(Mandatory = $true)]
    [int]$Pixels
  )

  return [int64]$Pixels * 9525
}

function Get-ScaledImageDimensions {
  param(
    [Parameter(Mandatory = $true)]
    [int]$Width,
    [Parameter(Mandatory = $true)]
    [int]$Height
  )

  $originalWidthEmu = Convert-PixelsToEmu -Pixels $Width
  $originalHeightEmu = Convert-PixelsToEmu -Pixels $Height
  $maxWidthEmu = 5731510L

  if ($originalWidthEmu -le $maxWidthEmu) {
    return @{
      WidthEmu = $originalWidthEmu
      HeightEmu = $originalHeightEmu
    }
  }

  $scaledHeight = [Math]::Round(($originalHeightEmu * $maxWidthEmu) / $originalWidthEmu)
  return @{
    WidthEmu = $maxWidthEmu
    HeightEmu = [int64]$scaledHeight
  }
}

function Resolve-WordHtmlAssetPath {
  param(
    [Parameter(Mandatory = $true)]
    [string]$DocxPath,
    [Parameter(Mandatory = $true)]
    [string]$AssetPath
  )

  $relativeAssetPath = $AssetPath.Trim()
  if (-not $relativeAssetPath) {
    return $null
  }

  $documentDirectory = Split-Path -Parent $DocxPath
  $normalizedAssetPath = $relativeAssetPath -replace '/', '\'
  try {
    $candidatePath = [System.IO.Path]::GetFullPath((Join-Path $documentDirectory $normalizedAssetPath))
    if (Test-Path -LiteralPath $candidatePath) {
      return $candidatePath
    }
  }
  catch {
    $candidatePath = $null
  }

  $assetFileName = [System.IO.Path]::GetFileName($normalizedAssetPath)
  if (-not $assetFileName) {
    return $null
  }

  $sameNameFolder = Join-Path $documentDirectory ([System.IO.Path]::GetFileNameWithoutExtension($DocxPath) + '.files')
  $sameNameCandidate = Join-Path $sameNameFolder $assetFileName
  if (Test-Path -LiteralPath $sameNameCandidate) {
    return $sameNameCandidate
  }

  $folderCandidates = Get-ChildItem -LiteralPath $documentDirectory -Directory | Where-Object { $_.Name -like '*.files' } | Sort-Object Name
  foreach ($folderCandidate in $folderCandidates) {
    $fallbackCandidate = Join-Path $folderCandidate.FullName $assetFileName
    if (Test-Path -LiteralPath $fallbackCandidate) {
      return $fallbackCandidate
    }
  }

  return $null
}

function Get-HtmlParagraphAlignment {
  param(
    [Parameter(Mandatory = $true)]
    $ParagraphNode
  )

  $align = ''

  try {
    $align = ([string]$ParagraphNode.getAttribute('align')).Trim().ToLowerInvariant()
  }
  catch {
    $align = ''
  }

  if (-not $align) {
    $style = ''
    try {
      $style = [string]$ParagraphNode.getAttribute('style')
    }
    catch {
      $style = ''
    }

    $styleMatch = [regex]::Match($style, '(?i)text-align\s*:\s*(?<align>[a-z]+)')
    $align = $styleMatch.Groups['align'].Value.Trim().ToLowerInvariant()
  }

  switch ($align) {
    'center' { return 'center' }
    'right' { return 'right' }
    'justify' { return 'both' }
    default { return '' }
  }
}

function Add-HtmlRunsFromNode {
  param(
    [Parameter(Mandatory = $true)]
    $Node,
    [Parameter(Mandatory = $true)]
    [AllowEmptyCollection()]
    [System.Collections.Generic.List[object]]$Runs,
    [Parameter(Mandatory = $true)]
    [string]$DocxPath
  )

  if ($null -eq $Node) {
    return
  }

  if ($Node.nodeType -eq 3) {
    $textValue = [string]$Node.nodeValue
    if ($textValue.Length -gt 0) {
      [void]$Runs.Add([pscustomobject]@{
          Type = 'text'
          Value = $textValue
        })
    }
    return
  }

  if ($Node.nodeType -ne 1) {
    return
  }

  $nodeName = ([string]$Node.nodeName).ToLowerInvariant()

  switch ($nodeName) {
    'br' {
      [void]$Runs.Add([pscustomobject]@{ Type = 'break' })
      return
    }
    'img' {
      $imageSource = [string]$Node.getAttribute('src')
      $resolvedImagePath = Resolve-WordHtmlAssetPath -DocxPath $DocxPath -AssetPath $imageSource
      if ($resolvedImagePath) {
        [void]$Runs.Add([pscustomobject]@{
            Type = 'image'
            Path = $resolvedImagePath
          })
      }
      return
    }
    default {
      foreach ($childNode in @($Node.childNodes)) {
        Add-HtmlRunsFromNode -Node $childNode -Runs $Runs -DocxPath $DocxPath
      }
    }
  }
}

function Convert-WordHtmlToPlainBlocks {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Html
  )

  $bodyMatch = [regex]::Match($Html, '(?is)<body[^>]*>(?<body>.*)</body>')
  $bodyContent = if ($bodyMatch.Success) { $bodyMatch.Groups['body'].Value } else { $Html }

  $normalized = $bodyContent
  $normalized = [regex]::Replace($normalized, '(?is)<!--.*?-->', '')
  $normalized = [regex]::Replace($normalized, '(?is)<img\b[^>]*>', '')
  $normalized = [regex]::Replace($normalized, '(?is)<br\s*/?>', "`n")
  $normalized = [regex]::Replace($normalized, '(?is)</p\s*>', "`n")
  $normalized = [regex]::Replace($normalized, '(?is)</div\s*>', "`n")
  $normalized = [regex]::Replace($normalized, '(?is)</tr\s*>', "`n")
  $normalized = [regex]::Replace($normalized, '(?is)</t[dh]\s*>', '    ')
  $normalized = [regex]::Replace($normalized, '(?is)<[^>]+>', '')

  $decoded = [System.Net.WebUtility]::HtmlDecode($normalized)
  $decoded = $decoded -replace "`r`n?", "`n"
  $decoded = $decoded -replace '[\x00-\x08\x0B\x0C\x0E-\x1F]', ''
  $decoded = $decoded -replace "`n{3,}", "`n`n"

  $blocks = New-Object System.Collections.Generic.List[object]
  foreach ($line in ($decoded -split "`n")) {
    $blockRuns = New-Object System.Collections.Generic.List[object]
    if ([string]::IsNullOrWhiteSpace($line)) {
      [void]$blocks.Add([pscustomobject]@{
          Alignment = ''
          Runs = @()
        })
      continue
    }

    [void]$blockRuns.Add([pscustomobject]@{
        Type = 'text'
        Value = $line.Trim()
      })

    [void]$blocks.Add([pscustomobject]@{
        Alignment = ''
        Runs = @($blockRuns.ToArray())
      })
  }

  return ,($blocks.ToArray())
}

function Convert-WordHtmlToStructuredBlocks {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Html,
    [Parameter(Mandatory = $true)]
    [string]$DocxPath
  )

  try {
    $htmlDocument = New-Object -ComObject 'HTMLFile'
    $htmlDocument.IHTMLDocument2_write($Html)
    $paragraphNodes = @($htmlDocument.getElementsByTagName('p'))
  }
  catch {
    return Convert-WordHtmlToPlainBlocks -Html $Html
  }

  if ($paragraphNodes.Count -eq 0) {
    return Convert-WordHtmlToPlainBlocks -Html $Html
  }

  $blocks = New-Object System.Collections.Generic.List[object]

  foreach ($paragraphNode in $paragraphNodes) {
    $runs = New-Object System.Collections.Generic.List[object]
    foreach ($childNode in @($paragraphNode.childNodes)) {
      Add-HtmlRunsFromNode -Node $childNode -Runs $runs -DocxPath $DocxPath
    }

    [void]$blocks.Add([pscustomobject]@{
        Alignment = Get-HtmlParagraphAlignment -ParagraphNode $paragraphNode
        Runs = @($runs.ToArray())
      })
  }

  return ,($blocks.ToArray())
}

function New-RunPropertiesXml {
  return '<w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:eastAsia="SimSun"/><w:sz w:val="24"/></w:rPr>'
}

function Convert-TextToRunXml {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Text,
    [Parameter(Mandatory = $true)]
    [string]$RunPropertiesXml
  )

  $normalizedText = $Text -replace "`r`n?", "`n"
  $parts = $normalizedText -split "`n", -1
  $segments = New-Object System.Collections.Generic.List[string]

  for ($index = 0; $index -lt $parts.Length; $index += 1) {
    $part = $parts[$index]
    if ($part.Length -gt 0) {
      [void]$segments.Add("<w:t xml:space=""preserve"">$(Escape-XmlText -Value $part)</w:t>")
    }

    if ($index -lt ($parts.Length - 1)) {
      [void]$segments.Add('<w:br/>')
    }
  }

  if ($segments.Count -eq 0) {
    return ''
  }

  return "<w:r>$RunPropertiesXml$($segments -join '')</w:r>"
}

function Get-OrAddImageDescriptor {
  param(
    [Parameter(Mandatory = $true)]
    [string]$ImagePath,
    [Parameter(Mandatory = $true)]
    [hashtable]$State
  )

  if ($State.ImageDescriptors.ContainsKey($ImagePath)) {
    return $State.ImageDescriptors[$ImagePath]
  }

  $imageIndex = [int]$State.NextImageIndex
  $State.NextImageIndex = $imageIndex + 1

  $imageExtension = [System.IO.Path]::GetExtension($ImagePath).ToLowerInvariant()
  $imagePartPath = "word/media/image$imageIndex$imageExtension"
  $relationshipId = "rId$($imageIndex + 1)"
  $imageSize = Get-ImageSize -Path $ImagePath
  $scaledDimensions = Get-ScaledImageDimensions -Width $imageSize.Width -Height $imageSize.Height

  $State.BinaryEntries[$imagePartPath] = [System.IO.File]::ReadAllBytes($ImagePath)

  $contentTypeEntry = Get-ImagePartContentTypeEntry -Extension $imageExtension
  if (-not $State.ContentTypeEntries.Contains($contentTypeEntry)) {
    [void]$State.ContentTypeEntries.Add($contentTypeEntry)
  }

  [void]$State.RelationshipEntries.Add("<Relationship Id=""$relationshipId"" Type=""http://schemas.openxmlformats.org/officeDocument/2006/relationships/image"" Target=""media/image$imageIndex$imageExtension""/>")

  $descriptor = [pscustomobject]@{
    Name = Escape-XmlText -Value ([System.IO.Path]::GetFileName($ImagePath))
    RelationshipId = $relationshipId
    DocPrId = $imageIndex
    WidthEmu = $scaledDimensions.WidthEmu
    HeightEmu = $scaledDimensions.HeightEmu
  }

  $State.ImageDescriptors[$ImagePath] = $descriptor
  return $descriptor
}

function New-ImageRunXml {
  param(
    [Parameter(Mandatory = $true)]
    [string]$ImagePath,
    [Parameter(Mandatory = $true)]
    [hashtable]$State
  )

  $descriptor = Get-OrAddImageDescriptor -ImagePath $ImagePath -State $State

  return @"
<w:r>
  <w:drawing>
    <wp:inline distT="0" distB="0" distL="0" distR="0"
      xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
      xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
      xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
      <wp:extent cx="$($descriptor.WidthEmu)" cy="$($descriptor.HeightEmu)"/>
      <wp:effectExtent l="0" t="0" r="0" b="0"/>
      <wp:docPr id="$($descriptor.DocPrId)" name="$($descriptor.Name)"/>
      <wp:cNvGraphicFramePr>
        <a:graphicFrameLocks noChangeAspect="1"/>
      </wp:cNvGraphicFramePr>
      <a:graphic>
        <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">
          <pic:pic>
            <pic:nvPicPr>
              <pic:cNvPr id="0" name="$($descriptor.Name)"/>
              <pic:cNvPicPr/>
            </pic:nvPicPr>
            <pic:blipFill>
              <a:blip r:embed="$($descriptor.RelationshipId)" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/>
              <a:stretch>
                <a:fillRect/>
              </a:stretch>
            </pic:blipFill>
            <pic:spPr>
              <a:xfrm>
                <a:off x="0" y="0"/>
                <a:ext cx="$($descriptor.WidthEmu)" cy="$($descriptor.HeightEmu)"/>
              </a:xfrm>
              <a:prstGeom prst="rect">
                <a:avLst/>
              </a:prstGeom>
            </pic:spPr>
          </pic:pic>
        </a:graphicData>
      </a:graphic>
    </wp:inline>
  </w:drawing>
</w:r>
"@
}

function New-StructuredDocxPackage {
  param(
    [Parameter(Mandatory = $true)]
    [object[]]$Blocks
  )

  $runPropertiesXml = New-RunPropertiesXml
  $state = @{
    NextImageIndex = 1
    ContentTypeEntries = (New-Object System.Collections.Generic.List[string])
    RelationshipEntries = (New-Object System.Collections.Generic.List[string])
    BinaryEntries = @{}
    ImageDescriptors = @{}
  }

  $paragraphXmlList = New-Object System.Collections.Generic.List[string]

  foreach ($block in $Blocks) {
    $runXmlList = New-Object System.Collections.Generic.List[string]

    foreach ($run in @($block.Runs)) {
      switch ($run.Type) {
        'text' {
          $textRunXml = Convert-TextToRunXml -Text ([string]$run.Value) -RunPropertiesXml $runPropertiesXml
          if ($textRunXml) {
            [void]$runXmlList.Add($textRunXml)
          }
        }
        'break' {
          [void]$runXmlList.Add("<w:r>$runPropertiesXml<w:br/></w:r>")
        }
        'image' {
          [void]$runXmlList.Add((New-ImageRunXml -ImagePath ([string]$run.Path) -State $state))
        }
      }
    }

    $paragraphPropertiesXml = ''
    if ($block.Alignment) {
      $paragraphPropertiesXml = "<w:pPr><w:jc w:val=""$($block.Alignment)""/></w:pPr>"
    }

    if ($runXmlList.Count -eq 0) {
      [void]$paragraphXmlList.Add("<w:p>$paragraphPropertiesXml<w:r>$runPropertiesXml<w:br/></w:r></w:p>")
      continue
    }

    [void]$paragraphXmlList.Add("<w:p>$paragraphPropertiesXml$($runXmlList -join '')</w:p>")
  }

  if ($paragraphXmlList.Count -eq 0) {
    throw 'No readable content was extracted from the Word HTML source.'
  }

  $contentTypeXml = @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  $($state.ContentTypeEntries -join "`n  ")
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>
"@

  $textEntries = @{
    '[Content_Types].xml' = $contentTypeXml
    '_rels/.rels' = @'
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>
'@
    'word/document.xml' = @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    $($paragraphXmlList -join "`n    ")
    <w:sectPr>
      <w:pgSz w:w="11906" w:h="16838"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>
"@
  }

  if ($state.RelationshipEntries.Count -gt 0) {
    $textEntries['word/_rels/document.xml.rels'] = @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  $($state.RelationshipEntries -join "`n  ")
</Relationships>
"@
  }

  return @{
    TextEntries = $textEntries
    BinaryEntries = $state.BinaryEntries
  }
}

function Write-DocxPackage {
  param(
    [Parameter(Mandatory = $true)]
    [string]$OutputPath,
    [Parameter(Mandatory = $true)]
    [hashtable]$Package
  )

  if (Test-Path -LiteralPath $OutputPath) {
    Remove-Item -LiteralPath $OutputPath -Force
  }

  $zip = [System.IO.Compression.ZipFile]::Open($OutputPath, [System.IO.Compression.ZipArchiveMode]::Create)

  try {
    foreach ($entryPath in $Package.TextEntries.Keys) {
      $entry = $zip.CreateEntry($entryPath, [System.IO.Compression.CompressionLevel]::Optimal)
      $stream = $entry.Open()

      try {
        $writer = New-Object System.IO.StreamWriter($stream, (New-Object System.Text.UTF8Encoding($false)))
        try {
          $writer.Write($Package.TextEntries[$entryPath])
        }
        finally {
          $writer.Dispose()
        }
      }
      finally {
        $stream.Dispose()
      }
    }

    foreach ($entryPath in $Package.BinaryEntries.Keys) {
      $entry = $zip.CreateEntry($entryPath, [System.IO.Compression.CompressionLevel]::Optimal)
      $stream = $entry.Open()

      try {
        $bytes = $Package.BinaryEntries[$entryPath]
        $stream.Write($bytes, 0, $bytes.Length)
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

function Mirror-RepairedDocx {
  param(
    [Parameter(Mandatory = $true)]
    [string]$SourcePath
  )

  if (-not $MirrorToDist) {
    return $null
  }

  if (-not (Test-Path -LiteralPath $MirrorRoot)) {
    return $null
  }

  $relativePath = Get-RelativePath -BasePath $DocsRoot -TargetPath $SourcePath
  $mirrorPath = Join-Path $MirrorRoot $relativePath

  if (-not (Test-Path -LiteralPath $mirrorPath)) {
    return $null
  }

  [System.IO.File]::Copy($SourcePath, $mirrorPath, $true)
  return $mirrorPath
}

$targets = Get-ChildItem -LiteralPath $DocsRoot -Recurse -File -Filter '*.docx' | Sort-Object FullName
$results = New-Object System.Collections.Generic.List[object]

foreach ($target in $targets) {
  $source = Get-SourceHtmlForDocx -DocxPath $target.FullName
  if ($null -eq $source) {
    continue
  }

  $blocks = Convert-WordHtmlToStructuredBlocks -Html $source.Html -DocxPath $target.FullName
  $package = New-StructuredDocxPackage -Blocks @($blocks)

  $repairMode = if (@($blocks | Where-Object { @($_.Runs | Where-Object { $_.Type -eq 'image' }).Count -gt 0 }).Count -gt 0) {
    'structured+image'
  }
  else {
    'structured'
  }

  Write-DocxPackage -OutputPath $target.FullName -Package $package
  $mirrorPath = Mirror-RepairedDocx -SourcePath $target.FullName

  [void]$results.Add([pscustomobject]@{
      File = $target.FullName
      Mode = $repairMode
      Source = $source.Source
      Backup = $source.BackupPath
      Mirror = $mirrorPath
    })
}

if ($results.Count -eq 0) {
  Write-Host 'No faux DOCX files were found under the target directory.'
  exit 0
}

Write-Host 'Repaired faux DOCX files:'
foreach ($result in $results) {
  Write-Host " - $($result.File) [$($result.Mode)]"
  Write-Host "   source: $($result.Source)"
  Write-Host "   backup: $($result.Backup)"
  if ($result.Mirror) {
    Write-Host "   mirror: $($result.Mirror)"
  }
}
