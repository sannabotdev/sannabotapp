@echo off
rem Windows has no prebuilt hermesc in the hermes-compiler package, so run the
rem Linux binary through WSL instead. The React Native Gradle plugin runs this
rem from the project root and passes paths relative to it, so turning
rem backslashes into forward slashes is enough for WSL to find the files.
setlocal
set "ARGS=%*"
set "ARGS=%ARGS:\=/%"
wsl.exe -e ./node_modules/hermes-compiler/hermesc/linux64-bin/hermesc %ARGS%
exit /b %ERRORLEVEL%
