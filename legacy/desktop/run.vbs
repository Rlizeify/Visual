CreateObject("WScript.Shell").Run "cmd /c cd /d """ & CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName) & """\apps\desktop && npm run dev", 0, False
