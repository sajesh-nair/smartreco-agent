import fastapi
import apscheduler
import chromadb
from importlib.metadata import version

print("✅ FastAPI version:", fastapi.__version__)
print("✅ LangGraph version:", version("langgraph"))
print("✅ APScheduler version:", apscheduler.__version__)
print("✅ ChromaDB version:", chromadb.__version__)
print("\n🎉 Environment is fully configured and ready for building!")