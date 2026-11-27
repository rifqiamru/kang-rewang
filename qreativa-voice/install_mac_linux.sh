#!/usr/bin/env bash
set -e
python3 -m venv venv && source venv/bin/activate
pip install --upgrade pip
if command -v nvidia-smi >/dev/null; then
  pip install torch==2.8.0+cu128 torchaudio==2.8.0+cu128 --extra-index-url https://download.pytorch.org/whl/cu128
else
  pip install torch==2.8.0 torchaudio==2.8.0
fi
pip install -r requirements.txt
echo "Selesai. Jalankan: source venv/bin/activate && python app.py"
