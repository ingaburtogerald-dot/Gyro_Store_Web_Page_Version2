Add-Type -AssemblyName System.Drawing

$sourceDir = "C:\Users\Gerald\OneDrive\Gyro Store Productos\Mouse X11"
$files = Get-ChildItem -Path $sourceDir -Filter "*.jpeg"

$targetSize = 1080
$counter = 1

foreach ($file in $files) {
    $img = [System.Drawing.Image]::FromFile($file.FullName)
    
    # Create new 1080x1080 bitmap
    $bmp = New-Object System.Drawing.Bitmap($targetSize, $targetSize)
    $bmp.SetResolution($img.HorizontalResolution, $img.VerticalResolution)
    
    $graphics = [System.Drawing.Graphics]::FromImage($bmp)
    $graphics.Clear([System.Drawing.Color]::White)
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    
    # Calculate dimensions to maintain aspect ratio
    $ratio = [math]::Min($targetSize / $img.Width, $targetSize / $img.Height)
    $newWidth = [int]($img.Width * $ratio)
    $newHeight = [int]($img.Height * $ratio)
    
    # Center the image
    $posX = [int](($targetSize - $newWidth) / 2)
    $posY = [int](($targetSize - $newHeight) / 2)
    
    $graphics.DrawImage($img, $posX, $posY, $newWidth, $newHeight)
    
    $outputPath = Join-Path $sourceDir "Optimized_$counter.jpg"
    
    # Save as JPEG with good quality
    $bmp.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Jpeg)
    
    $graphics.Dispose()
    $bmp.Dispose()
    $img.Dispose()
    
    Write-Host "Procesado: Optimized_$counter.jpg"
    $counter++
}
