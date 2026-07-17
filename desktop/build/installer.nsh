; Script NSIS personalizado para o instalador da Gestao de Gado.
; Adiciona uma checkbox na pagina final a perguntar se o utilizador
; quer criar um atalho no ambiente de trabalho.
;
; O electron-builder insere este ficheiro automaticamente (build/installer.nsh)
; e usa o macro "customFinishPage" para substituir a pagina final por defeito.

!macro customFinishPage
  ; Titulo e texto da pagina final (PT-PT)
  !define MUI_TEXT_FINISH_INFO_TITLE "Instalacao concluida"
  !define MUI_TEXT_FINISH_INFO_TEXT "A Gestao de Gado foi instalada no seu computador."

  ; Checkbox (reutiliza o slot do "readme") para criar o atalho.
  ; NOTCHECKED = por defeito NAO fica marcada; o utilizador escolhe.
  !define MUI_FINISHPAGE_SHOWREADME ""
  !define MUI_FINISHPAGE_SHOWREADME_NOTCHECKED
  !define MUI_FINISHPAGE_SHOWREADME_TEXT "Criar um atalho no ambiente de trabalho"
  !define MUI_FINISHPAGE_SHOWREADME_FUNCTION CriarAtalhoAmbienteTrabalho

  ; Checkbox para abrir a app logo apos instalar (funcao interna do electron-builder).
  !define MUI_FINISHPAGE_RUN
  !define MUI_FINISHPAGE_RUN_FUNCTION StartApp
  !define MUI_FINISHPAGE_RUN_TEXT "Abrir a Gestao de Gado"

  !insertmacro MUI_PAGE_FINISH
!macroend

Function CriarAtalhoAmbienteTrabalho
  CreateShortcut "$DESKTOP\${SHORTCUT_NAME}.lnk" "$INSTDIR\${APP_EXECUTABLE_FILENAME}"
FunctionEnd
