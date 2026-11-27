@echo off
echo === Qreativa Voice: instalasi (sekali saja) ===
python -m venv venv
call venv\Scripts\activate
python -m pip install --upgrade pip
echo.
echo Punya GPU NVIDIA? Install PyTorch versi CUDA:
nvidia-smi >nul 2>&1
if %errorlevel%==0 (
  pip install torch==2.8.0+cu128 torchaudio==2.8.0+cu128 --extra-index-url https://download.pytorch.org/whl/cu128
) else (
  echo GPU NVIDIA tidak terdeteksi - pakai CPU, proses akan lebih lambat.
  pip install torch==2.8.0 torchaudio==2.8.0
)
pip install -r requirements.txt
echo.
echo Selesai. Jalankan run_windows.bat
pause
