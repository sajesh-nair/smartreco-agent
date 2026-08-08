python -m venv venv
venv\Scripts\activate
python -m pip install --upgrade pip
pip install -r requirements.txt
python test_env.py


uvicorn backend.main:app --reload --port 8000

cd frontend
npm run dev
npm run build