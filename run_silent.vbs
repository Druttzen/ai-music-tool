Set WshShell = CreateObject("WScript.Shell")
Set FSO = CreateObject("Scripting.FileSystemObject")

scriptDir = FSO.GetParentFolderName(WScript.ScriptFullName)
batPath = FSO.BuildPath(scriptDir, "RUN.bat")

WshShell.Run "cmd /c """ & batPath & """", 0