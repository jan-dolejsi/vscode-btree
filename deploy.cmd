 @echo off
:: https://code.visualstudio.com/docs/extensions/publish-extension
:: https://code.visualstudio.com/docs/editor/extension-gallery#_install-from-a-vsix

call npm install
call npm install --location=global vsce

call vsce ls
echo Review the files included before you continue
pause

if not exist vsix-archive mkdir vsix-archive
move /Y *.vsix vsix-archive
call vsce package

set vsix_count=0
for %%A in (*.vsix) do set /a vsix_count+=1

if not %vsix_count% == 1 (
    echo Found unexpected number of .vsix files: %vsix_count%
    exit /B 1
)
set vsix_name=not_found
for %%f in (*.vsix) do (
    set vsix_name=%%f
)

echo Installing the extension locally...

echo Installing %vsix_name%
call code --install-extension %vsix_name%
echo Done. Test the extension now.

