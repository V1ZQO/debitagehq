; Nettoie les anciennes versions installées à la main (« Le QG » et DebitageHQ 1.1)
!macro customInstall
  nsExec::Exec 'taskkill /F /IM "Le QG.exe"'
  IfFileExists "$LOCALAPPDATA\Programs\Le QG\Desinstaller Le QG.exe" 0 +2
    ExecWait '"$LOCALAPPDATA\Programs\Le QG\Desinstaller Le QG.exe" /S _?=$LOCALAPPDATA\Programs\Le QG'
  RMDir /r "$LOCALAPPDATA\Programs\Le QG"
  Delete "$DESKTOP\Le QG.lnk"
  RMDir /r "$SMPROGRAMS\Le QG"
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\LeQG"
  ; ancienne installation manuelle de DebitageHQ 1.1
  Delete "$INSTDIR\Desinstaller DebitageHQ.exe"
  RMDir /r "$SMPROGRAMS\DebitageHQ"
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\DebitageHQ"
!macroend
