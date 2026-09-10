@echo off

REM get current branch
for /f "delims=" %%b in ('git rev-parse --abbrev-ref HEAD') do set branch=%%b

git pull origin %branch%
