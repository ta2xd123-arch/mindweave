$WshShell = New-Object -comObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut("C:\Users\IT-GOOD\Desktop\MINDWEAVE.lnk")
$Shortcut.TargetPath = "C:\Users\IT-GOOD\MINDWEAVE\start_mindweave.bat"
$Shortcut.WorkingDirectory = "C:\Users\IT-GOOD\MINDWEAVE"
$Shortcut.IconLocation = "C:\Users\IT-GOOD\MINDWEAVE\public\app_icon.ico"
$Shortcut.Save()
