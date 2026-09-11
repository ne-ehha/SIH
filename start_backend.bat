@echo off
cd /d D:\SIH\SIH
D:\SIH\SIH\backend\.venv\Scripts\python.exe -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000
