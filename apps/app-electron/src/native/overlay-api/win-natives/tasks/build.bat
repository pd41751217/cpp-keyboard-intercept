echo "Building binaries..."

"C:\Program Files\Microsoft Visual Studio\2022\Preview\Msbuild\Current\Bin\MSBuild.exe" ..\gameoverlay.sln /t:build /p:Configuration=Release /p:Platform=Win32
"C:\Program Files\Microsoft Visual Studio\2022\Preview\Msbuild\Current\Bin\MSBuild.exe" ..\gameoverlay.sln /t:build /p:Configuration=Release /p:Platform=x64
