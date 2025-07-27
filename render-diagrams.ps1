# Render and Validate Mermaid Diagrams Script
# This script processes all .mmd files and converts them to SVG and PDF formats

Write-Host "Starting Mermaid diagram validation and rendering..." -ForegroundColor Green

# Ensure output directory exists
if (!(Test-Path "docs/diagrams")) {
    New-Item -ItemType Directory -Path "docs/diagrams" -Force
    Write-Host "Created docs/diagrams directory" -ForegroundColor Yellow
}

# Get all .mmd files
$mmdFiles = Get-ChildItem -Filter "*.mmd"

if ($mmdFiles.Count -eq 0) {
    Write-Host "No .mmd files found in current directory!" -ForegroundColor Red
    exit 1
}

Write-Host "Found $($mmdFiles.Count) Mermaid files to process" -ForegroundColor Cyan

$successCount = 0
$errorCount = 0
$errorFiles = @()

foreach ($file in $mmdFiles) {
    $baseName = [System.IO.Path]::GetFileNameWithoutExtension($file.Name)
    $svgOutput = "docs/diagrams/$baseName.svg"
    $pdfOutput = "docs/diagrams/$baseName.pdf"
    
    Write-Host "`nProcessing: $($file.Name)" -ForegroundColor Yellow
    
    try {
        # Generate SVG
        Write-Host "  -> Generating SVG..." -ForegroundColor Gray
        $svgResult = & npx mmdc -i $file.FullName -o $svgOutput -e svg 2>&1
        
        if ($LASTEXITCODE -ne 0) {
            throw "SVG generation failed: $svgResult"
        }
        
        # Generate PDF
        Write-Host "  -> Generating PDF..." -ForegroundColor Gray
        $pdfResult = & npx mmdc -i $file.FullName -o $pdfOutput -e pdf 2>&1
        
        if ($LASTEXITCODE -ne 0) {
            throw "PDF generation failed: $pdfResult"
        }
        
        Write-Host "  ✓ Successfully rendered $($file.Name)" -ForegroundColor Green
        $successCount++
        
    } catch {
        Write-Host "  ✗ Error rendering $($file.Name): $($_.Exception.Message)" -ForegroundColor Red
        $errorCount++
        $errorFiles += $file.Name
    }
}

Write-Host "`n" + "="*60 -ForegroundColor Magenta
Write-Host "SUMMARY:" -ForegroundColor Magenta
Write-Host "="*60 -ForegroundColor Magenta
Write-Host "Successfully processed: $successCount files" -ForegroundColor Green
Write-Host "Failed to process: $errorCount files" -ForegroundColor Red

if ($errorFiles.Count -gt 0) {
    Write-Host "`nFiles with errors:" -ForegroundColor Red
    foreach ($errorFile in $errorFiles) {
        Write-Host "  - $errorFile" -ForegroundColor Red
    }
}

# List generated files
$generatedFiles = Get-ChildItem "docs/diagrams" -File
if ($generatedFiles.Count -gt 0) {
    Write-Host "`nGenerated files in docs/diagrams/:" -ForegroundColor Cyan
    foreach ($generatedFile in $generatedFiles) {
        $sizeKB = [math]::Round($generatedFile.Length/1KB, 2)
        Write-Host "  - $($generatedFile.Name) ($sizeKB KB)" -ForegroundColor Gray
    }
}

Write-Host "`nDiagram rendering complete!" -ForegroundColor Green

if ($errorCount -gt 0) {
    exit 1
} else {
    exit 0
}
