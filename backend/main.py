import os
import time
import json
import logging
from typing import List, Dict, Any, Optional
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, status, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from dotenv import load_dotenv

# Database & Vector Imports
from sqlalchemy import create_engine, Column, String, Float, Text
from sqlalchemy.orm import declarative_base, sessionmaker, Session

# Import Agent State Machine & Core Services
from backend.agents.graph import recommendation_graph
from backend.services.vector_store import seed_vector_store_from_json, upsert_product_vector
from backend.services.scheduler import start_scheduler, stop_scheduler

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("SmartRecoEngine")

load_dotenv()

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(BASE_DIR, ".."))
CATALOG_FILE = os.path.join(PROJECT_ROOT, "courses.json")
SQLITE_DB_PATH = os.path.join(PROJECT_ROOT, "smartreco.db")

DATABASE_URL = f"sqlite:///{SQLITE_DB_PATH}"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class ProductSQL(Base):
    __tablename__ = "products"
    id = Column(String(50), primary_key=True, index=True)
    title = Column(String(150), nullable=False)
    category = Column(String(80), nullable=False)
    level = Column(String(50), default="Intermediate")
    price = Column(Float, nullable=False)
    rating = Column(Float, default=4.8)
    students = Column(String(50), default="1,200")
    tags = Column(Text, default="[]")
    description = Column(Text, nullable=False)

Base.metadata.create_all(bind=engine)

SESSION_DB: Dict[str, List[Dict[str, Any]]] = {}
RECOMMENDATION_CACHE: Dict[str, Dict[str, Any]] = {}

def load_catalog() -> List[Dict[str, Any]]:
    if os.path.exists(CATALOG_FILE):
        try:
            with open(CATALOG_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            logger.error(f"Failed to read catalog file {CATALOG_FILE}: {e}")
    return []

PRODUCT_CATALOG = load_catalog()

def save_catalog() -> None:
    try:
        with open(CATALOG_FILE, "w", encoding="utf-8") as f:
            json.dump(PRODUCT_CATALOG, f, indent=2)
    except Exception as e:
        logger.error(f"Failed to persist catalog file {CATALOG_FILE}: {e}")

def seed_sqlite_from_catalog():
    db = SessionLocal()
    try:
        for item in PRODUCT_CATALOG:
            existing = db.query(ProductSQL).filter(ProductSQL.id == item["id"]).first()
            if not existing:
                prod = ProductSQL(
                    id=item["id"],
                    title=item.get("title", ""),
                    category=item.get("category", "General"),
                    level=item.get("level", "Intermediate"),
                    price=float(item.get("price", 0.0)),
                    rating=float(item.get("rating", 4.8)),
                    students=str(item.get("students", "1,200")),
                    tags=json.dumps(item.get("tags", [])),
                    description=item.get("description", "")
                )
                db.add(prod)
        db.commit()
    except Exception as e:
        logger.error(f"SQLite seeding error: {e}")
    finally:
        db.close()

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Initializing SmartReco Engine...")
    try:
        seed_sqlite_from_catalog()
        seed_vector_store_from_json(CATALOG_FILE)
        start_scheduler()
    except Exception as e:
        logger.error(f"Startup initialization error: {e}")
    yield
    stop_scheduler()

app = FastAPI(title="SmartReco Agentic Engine", version="2.5.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class AuthLoginRequest(BaseModel):
    email: str
    password: str
    role: str = "user"

class TelemetryEvent(BaseModel):
    session_id: str
    event_type: str
    target_id: str
    metadata: Optional[Dict[str, Any]] = {}

class RecommendationRequest(BaseModel):
    session_id: str
    current_course_id: Optional[str] = None
    category_filter: Optional[str] = None
    force_refresh: Optional[bool] = False

class ProductCatalogItem(BaseModel):
    id: str
    title: str
    category: str
    level: str = "Intermediate"
    price: float
    rating: Optional[float] = 4.8
    students: Optional[str] = "1,200"
    tags: List[str] = []
    description: str

@app.post("/api/auth/login")
def user_login(req: AuthLoginRequest):
    selected_role = req.role.lower()
    is_admin = selected_role == "admin" or req.email.lower().startswith("admin")
    return {
        "status": "success",
        "email": req.email,
        "role": "admin" if is_admin else "user",
        "access_token": f"token_smartreco_{req.role}_{int(time.time())}"
    }

@app.get("/api/courses")
def get_courses():
    return PRODUCT_CATALOG

@app.post("/api/track")
def track_event(event: TelemetryEvent):
    session_id = event.session_id.strip()
    if session_id not in SESSION_DB:
        SESSION_DB[session_id] = []
    
    event_payload = {
        "event_type": event.event_type,
        "target_id": event.target_id,
        "metadata": event.metadata or {},
        "timestamp": time.time()
    }
    SESSION_DB[session_id].append(event_payload)
    if len(SESSION_DB[session_id]) > 30:
        SESSION_DB[session_id] = SESSION_DB[session_id][-30:]
    return {"status": "success", "session_id": session_id, "total_logged_events": len(SESSION_DB[session_id])}

@app.post("/api/recommend")
def generate_recommendations(req: RecommendationRequest):
    session_id = req.session_id.strip()
    session_logs = SESSION_DB.get(session_id, [])

    # If telemetry is triggered directly with course_id or category_filter
    if req.current_course_id:
        synth_event = {
            "event_type": "Course_Selected",
            "target_id": req.current_course_id,
            "metadata": {"source": "direct_click"},
            "timestamp": time.time()
        }
        if session_id not in SESSION_DB:
            SESSION_DB[session_id] = []
        SESSION_DB[session_id].append(synth_event)
        session_logs = SESSION_DB[session_id]

    elif req.category_filter and req.category_filter != "All":
        synth_event = {
            "event_type": "Category_Filter_Applied",
            "target_id": req.category_filter,
            "metadata": {"source": "filter_click"},
            "timestamp": time.time()
        }
        if session_id not in SESSION_DB:
            SESSION_DB[session_id] = []
        SESSION_DB[session_id].append(synth_event)
        session_logs = SESSION_DB[session_id]

    # Fallback synthetic event if logs are completely empty
    if not session_logs:
        session_logs = [{
            "event_type": "Category_Filter_Applied",
            "target_id": "Agentic AI",
            "metadata": {"source": "default_boost"},
            "timestamp": time.time()
        }]

    initial_graph_state = {
        "session_id": session_id,
        "telemetry_logs": session_logs,
        "inferred_intent": "",
        "retrieved_products": [],
        "final_pitch": ""
    }

    try:
        final_graph_state = recommendation_graph.invoke(initial_graph_state)
        return {
            "session_id": session_id,
            "inferred_intent": final_graph_state.get("inferred_intent", "General browsing"),
            "persuasive_story": final_graph_state.get("final_pitch", ""),
            "grounded_matches": final_graph_state.get("retrieved_products", []),
            "cached": False
        }
    except Exception as e:
        logger.error(f"[LangGraph Execution Error]: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to process recommendation graph workflow.")

@app.post("/api/admin/product", status_code=status.HTTP_201_CREATED)
def create_or_update_product(product: ProductCatalogItem):
    prod_dict = product.model_dump()
    
    # Dual-Write SQL
    db = SessionLocal()
    try:
        existing_sql = db.query(ProductSQL).filter(ProductSQL.id == product.id).first()
        if existing_sql:
            existing_sql.title = product.title
            existing_sql.category = product.category
            existing_sql.price = product.price
            existing_sql.description = product.description
            existing_sql.tags = json.dumps(product.tags)
        else:
            new_sql = ProductSQL(
                id=product.id, title=product.title, category=product.category,
                level=product.level, price=product.price, rating=product.rating or 4.8,
                students=product.students or "1,200", tags=json.dumps(product.tags),
                description=product.description
            )
            db.add(new_sql)
        db.commit()
    except Exception as e:
        db.rollback()
        logger.error(f"SQL Dual write error: {e}")
    finally:
        db.close()

    # Dual-Write Vector DB
    vector_synced = upsert_product_vector(prod_dict)
    
    # Dual-Write JSON
    existing_idx = next((i for i, p in enumerate(PRODUCT_CATALOG) if p.get("id") == product.id), None)
    if existing_idx is not None:
        PRODUCT_CATALOG[existing_idx] = prod_dict
    else:
        PRODUCT_CATALOG.append(prod_dict)
    save_catalog()
    
    return {"status": "success", "product_id": product.id, "dual_write": {"sql": True, "vector": vector_synced}}

dist_folder = os.path.join(PROJECT_ROOT, "frontend", "dist")
if os.path.exists(dist_folder):
    app.mount("/assets", StaticFiles(directory=os.path.join(dist_folder, "assets")), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(request: Request, full_path: str):
        if full_path.startswith("api/"):
            raise HTTPException(status_code=404, detail="API route not found")
        file_path = os.path.join(dist_folder, full_path)
        if os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(dist_folder, "index.html"))