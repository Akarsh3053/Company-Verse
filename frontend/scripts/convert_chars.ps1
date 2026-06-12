# Convert Last Guardian character GIFs → transparent PNGs.
#
# The source sprites (public/assets/charcters/last-guardian-sprites/*.gif) are
# 8-bit indexed GIFs with an OPAQUE WHITE background and no transparency. This
# script removes only the background by flood-filling from the image edges, so
# white pixels INSIDE a sprite (e.g. a white mage's robe) are preserved. Output
# goes to public/assets/characters_png/ which the game loads at runtime.
#
# Usage (from frontend/):  pwsh ./scripts/convert_chars.ps1
# Only the character prefixes actually used by the game are converted.

Add-Type -AssemblyName System.Drawing

$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$src = Join-Path $here "..\public\assets\charcters\last-guardian-sprites"
$dst = Join-Path $here "..\public\assets\characters_png"
New-Item -ItemType Directory -Force -Path $dst | Out-Null

# Must match CHAR_ROLE_PREFIX (+ default) in src/game/assets/manifest.ts.
$prefixes = @("avt1", "kin1", "man1", "gsd1", "wmg1", "amg1", "knt1", "scr1", "thf1", "ftr1")
$dirs = @("fr", "bk", "lf", "rt")
$frames = @(1, 2)

function IsBg($c) {
  return ($c.R -ge 234 -and $c.G -ge 234 -and $c.B -ge 234)
}

$total = 0
foreach ($p in $prefixes) {
  foreach ($d in $dirs) {
    foreach ($f in $frames) {
      $inFile = Join-Path $src "${p}_${d}${f}.gif"
      if (-not (Test-Path $inFile)) { Write-Output "MISSING $inFile"; continue }
      $gif = [System.Drawing.Bitmap]::FromFile($inFile)
      $w = $gif.Width; $h = $gif.Height
      $bmp = New-Object System.Drawing.Bitmap $w, $h, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
      $g = [System.Drawing.Graphics]::FromImage($bmp)
      $g.DrawImage($gif, 0, 0, $w, $h)
      $g.Dispose()
      $gif.Dispose()

      $visited = New-Object 'bool[,]' $w, $h
      $queue = New-Object System.Collections.Generic.Queue[int[]]
      for ($x = 0; $x -lt $w; $x++) {
        foreach ($y in @(0, ($h - 1))) {
          if (-not $visited[$x, $y] -and (IsBg $bmp.GetPixel($x, $y))) { $queue.Enqueue(@($x, $y)); $visited[$x, $y] = $true }
        }
      }
      for ($y = 0; $y -lt $h; $y++) {
        foreach ($x in @(0, ($w - 1))) {
          if (-not $visited[$x, $y] -and (IsBg $bmp.GetPixel($x, $y))) { $queue.Enqueue(@($x, $y)); $visited[$x, $y] = $true }
        }
      }
      $clear = [System.Drawing.Color]::FromArgb(0, 0, 0, 0)
      while ($queue.Count -gt 0) {
        $cur = $queue.Dequeue(); $cx = $cur[0]; $cy = $cur[1]
        $bmp.SetPixel($cx, $cy, $clear)
        foreach ($nb in @(@(($cx - 1), $cy), @(($cx + 1), $cy), @($cx, ($cy - 1)), @($cx, ($cy + 1)))) {
          $nx = $nb[0]; $ny = $nb[1]
          if ($nx -ge 0 -and $nx -lt $w -and $ny -ge 0 -and $ny -lt $h -and -not $visited[$nx, $ny]) {
            if (IsBg $bmp.GetPixel($nx, $ny)) { $visited[$nx, $ny] = $true; $queue.Enqueue(@($nx, $ny)) }
          }
        }
      }

      $bmp.Save((Join-Path $dst "${p}_${d}${f}.png"), [System.Drawing.Imaging.ImageFormat]::Png)
      $bmp.Dispose()
      $total++
    }
  }
}
Write-Output "Converted $total character frames -> $dst"
