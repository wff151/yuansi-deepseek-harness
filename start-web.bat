@echo off
setlocal
cd /d "%~dp0"
set "DSH_HOME=%CD%\.dsh-home"
echo ============================================
echo  dsh web 一键重启
echo  URL: http://127.0.0.1:3080
echo  DSH_HOME: %DSH_HOME%
echo ============================================

echo [1/2] 检测占用端口 3080 的进程...
set "FOUND="
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":3080 " ^| findstr "LISTENING"') do (
  set "FOUND=1"
  echo   停止 PID %%p
  taskkill /F /T /PID %%p >nul 2>&1
)

if not defined FOUND (
  echo   端口 3080 未被占用，可直接启动
) else (
  echo   正在等待端口释放...
  timeout /t 2 /nobreak >nul
)

echo [2/2] 启动 dsh web...
call pnpm dsh web

endlocal
