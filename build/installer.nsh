!macro customInit
  ; electron-builder will reuse the previous InstallLocation from the registry.
  ; If you previously installed a test build into an "Octo-Test" folder, that can
  ; become the default for new runs. Reset it back to the standard default.

  StrCpy $0 $INSTDIR 9 -9
  StrCmp $0 "Octo-Test" +2 0
    StrCpy $INSTDIR "$PROGRAMFILES\${APP_FILENAME}"

  StrCmp $0 "octo-test" +2 0
    StrCpy $INSTDIR "$PROGRAMFILES\${APP_FILENAME}"
!macroend
