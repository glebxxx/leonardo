-- Leonardo installer applet.
-- Double-click → native admin prompt → copies the bundled plugin payload into the
-- DaVinci Resolve Workflow Integration Plugins folder and copies the matching
-- WorkflowIntegration.node from the installed Resolve Studio SDK.

on run
	set pluginID to "com.gleb.leonardo"
	set myPath to POSIX path of (path to me)
	set payloadPath to myPath & "Contents/Resources/leonardo"
	set resolveSupport to "/Library/Application Support/Blackmagic Design/DaVinci Resolve"
	set destRoot to resolveSupport & "/Workflow Integration Plugins"
	set destPath to destRoot & "/" & pluginID
	set nodeSrc to resolveSupport & "/Developer/Workflow Integrations/Examples/SamplePlugin/WorkflowIntegration.node"

	if not fileExists(payloadPath) then
		display dialog "Внутри установщика нет файлов плагина (Contents/Resources/leonardo). Пересобери установщик через build-installer.sh." buttons {"OK"} default button "OK" with icon stop with title "Leonardo"
		return
	end if

	if not fileExists(nodeSrc) then
		display dialog "Не найден WorkflowIntegration.node:" & return & nodeSrc & return & return & "Похоже, не установлена DaVinci Resolve STUDIO (с компонентом Developer ▸ Workflow Integrations). Бесплатная версия не поддерживает Workflow Integration плагины." buttons {"OK"} default button "OK" with icon stop with title "Leonardo"
		return
	end if

	set s to "mkdir -p " & quoted form of destPath
	set s to s & " && rsync -a --delete --exclude '.git' --exclude '.DS_Store' --exclude 'WorkflowIntegration.node' " & quoted form of (payloadPath & "/") & " " & quoted form of (destPath & "/")
	set s to s & " && cp " & quoted form of nodeSrc & " " & quoted form of (destPath & "/WorkflowIntegration.node")

	try
		do shell script s with administrator privileges
	on error errMsg number errNum
		if errNum is -128 then return -- пользователь отменил ввод пароля
		display dialog "Не удалось установить Leonardo:" & return & errMsg buttons {"OK"} default button "OK" with icon stop with title "Leonardo"
		return
	end try

	display dialog "Leonardo установлен ✅" & return & return & "Осталось:" & return & "1) DaVinci Resolve → Preferences → General →" & return & "    External scripting using = Local" & return & "2) Полностью перезапусти DaVinci Resolve Studio" & return & "3) Workspace → Workflow Integrations → Leonardo" & return & "4) В панели нажми ⚙ и вставь Anthropic API-ключ" buttons {"Готово"} default button "Готово" with icon note with title "Leonardo"
end run

on fileExists(p)
	try
		do shell script "test -e " & quoted form of p
		return true
	on error
		return false
	end try
end fileExists
