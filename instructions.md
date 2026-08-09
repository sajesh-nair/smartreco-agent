python -m venv venv
venv\Scripts\activate
python -m pip install --upgrade pip
pip install -r requirements.txt
python test_env.py


uvicorn backend.main:app --reload --port 8000

cd frontend
npm run build


Linkedin Post
Built Aura Academy for the SmartReco Build Challenge 2026 hosted by Krish Naik and KRISHAI Technologies Private Limited

Problem: Static e-learning catalogs miss real-time user intent, leading to irrelevant recommendations.

Solution: An event-driven platform powered by Mesh API, using LangGraph to evaluate live behavior and generate instant, targeted course pitches.

Stack: FastAPI, LangGraph, ChromaDB, SQLite.
Demo video below 

#LangGraph #ChromaDB #FastAPI #SmartReco2026