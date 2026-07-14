$ErrorActionPreference = "Stop"

# Paths
$iconPath = "C:\Users\IT-GOOD\.gemini\antigravity-ide\brain\e567fc28-a56d-44d7-bb6c-a4e06b6c9303\mindweave_app_icon_1784025570490.png"
$icoPath = "C:\Users\IT-GOOD\MINDWEAVE\public\mindweave.ico"

# Load System.Drawing to convert PNG to ICO
Add-Type -AssemblyName System.Drawing
$img = [System.Drawing.Image]::FromFile($iconPath)
$stream = New-Object System.IO.FileStream($icoPath, [System.IO.FileMode]::Create)
$icon = [System.Drawing.Icon]::FromHandle((New-Object System.Drawing.Bitmap($img)).GetHicon())
$icon.Save($stream)
$stream.Close()
$img.Dispose()
$icon.Dispose()

Write-Host "Created ICO file at $icoPath"

# Create Desktop Shortcut
$desktopPath = [Environment]::GetFolderPath("Desktop")
$shortcutPath = Join-Path $desktopPath "MINDWEAVE.lnk"

$wshShell = New-Object -ComObject WScript.Shell
$shortcut = $wshShell.CreateShortcut($shortcutPath)

# Point to Edge and open as app
$shortcut.TargetPath = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
$shortcut.Arguments = "--app=http://localhost:3000"
$shortcut.IconLocation = $icoPath
$shortcut.WindowStyle = 1
$shortcut.Save()

Write-Host "Created Desktop Shortcut at $shortcutPath"
