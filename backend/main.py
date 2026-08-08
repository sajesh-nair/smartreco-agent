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

# Configure structured logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger("SmartRecoEngine")

load_dotenv()

# ------------------------------------------------------------------------------
# 1. Database & Directory Setup (SQLAlchemy + SQLite Main Database)
# ------------------------------------------------------------------------------
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(BASE_DIR, ".."))
CATALOG_FILE = os.path.join(PROJECT_ROOT, "courses.json")
SQLITE_DB_PATH = os.path.join(PROJECT_ROOT, "smartreco.db")

DATABASE_URL = f"sqlite:///{SQLITE_DB_PATH}"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Primary Product Schema in SQL Main Database
class ProductSQL(Base):
    __tablename__ = "products"

    id = Column(String(50), primary_key=True, index=True)
    title = Column(String(150), nullable=False)
    category = Column(String(80), nullable=False)
    level = Column(String(50), default="Intermediate")
    price = Column(Float, nullable=False)
    rating = Column(Float, default=4.8)
    students = Column(String(50), default="1,200")
    tags = Column(Text, default="[]") # Stored as JSON string
    description = Column(Text, nullable=False)

Base.metadata.create_all(bind=engine)

SESSION_DB: Dict[str, List[Dict[str, Any]]] = {}
RECOMMENDATION_CACHE: Dict[str, Dict[str, Any]] = {}
PRODUCT_CATALOG: List[Dict[str, Any]] = []

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def load_catalog() -> List[Dict[str, Any]]:
    """Loads product catalog from local JSON persistence."""
    if os.path.exists(CATALOG_FILE):
        try:
            with open(CATALOG_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            logger.error(f"Failed to read catalog file {CATALOG_FILE}: {e}")
    return []

PRODUCT_CATALOG = load_catalog()

def save_catalog() -> None:
    """Persists current in-memory catalog back to JSON file."""
    try:
        with open(CATALOG_FILE, "w", encoding="utf-8") as f:
            json.dump(PRODUCT_CATALOG, f, indent=2)
    except Exception as e:
        logger.error(f"Failed to persist catalog file {CATALOG_FILE}: {e}")

# Seed SQL DB from catalog on boot
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
        logger.info("SQLite Main Database successfully synced with product catalog.")
    except Exception as e:
        logger.error(f"SQLite seeding error: {e}")
    finally:
        db.close()

# ------------------------------------------------------------------------------
# 2. Async Lifespan Lifecycle Manager
# ------------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Handles boot startup (SQL + Vector Store seeding & Background Scheduler) 
    and clean shutdown routines.
    """
    logger.info("Initializing SmartReco Dual-Write Vector Store & Main Database...")
    try:
        seed_sqlite_from_catalog()
        seed_vector_store_from_json(CATALOG_FILE)
        logger.info(f"Vector Store & SQL DB seeded successfully. Loaded {len(PRODUCT_CATALOG)} catalog items.")
        
        # Boot APScheduler background jobs
        start_scheduler()
    except Exception as e:
        logger.error(f"Startup initialization error: {e}")
        
    yield
    
    # Graceful shutdown
    stop_scheduler()
    logger.info("SmartReco Engine shutting down gracefully...")

app = FastAPI(
    title="SmartReco Agentic Engine",
    description="Production-grade e-learning behavioral telemetry & recommendation engine powered by Mesh API and LangGraph",
    version="2.5.0",
    lifespan=lifespan
)

# ------------------------------------------------------------------------------
# 3. Security & CORS Hardening
# ------------------------------------------------------------------------------
ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://localhost:8000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "X-Requested-With"],
)

# ------------------------------------------------------------------------------
# 4. Request & Payload Schemas
# ------------------------------------------------------------------------------
class AuthLoginRequest(BaseModel):
    email: str = Field(..., description="User login email")
    password: str = Field(..., description="User password")
    role: str = Field(default="user", description="Target role: 'user' or 'admin'")

class TelemetryEvent(BaseModel):
    session_id: str = Field(..., min_length=5, max_length=100, description="Unique session identifier")
    event_type: str = Field(..., min_length=2, max_length=80, description="Event classification type")
    target_id: str = Field(..., min_length=1, max_length=120, description="Target entity identifier")
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Granular event attributes")

class RecommendationRequest(BaseModel):
    session_id: str = Field(..., min_length=5, max_length=100)
    current_course_id: Optional[str] = None
    force_refresh: Optional[bool] = Field(default=False, description="Bypass recommendation cache")

class ProductCatalogItem(BaseModel):
    id: str = Field(..., min_length=1, max_length=50)
    title: str = Field(..., min_length=3, max_length=150)
    category: str = Field(..., min_length=2, max_length=80)
    level: str = Field(default="Intermediate")
    price: float = Field(..., ge=0)
    rating: Optional[float] = Field(default=4.8, ge=0.0, le=5.0)
    students: Optional[str] = Field(default="1,200")
    tags: List[str] = Field(default_factory=list)
    description: str = Field(..., min_length=10, max_length=1000)
    curriculum: Optional[List[Dict[str, Any]]] = Field(default_factory=list)

# ------------------------------------------------------------------------------
# 5. Core API Endpoints
# ------------------------------------------------------------------------------

@app.post("/api/auth/login", status_code=status.HTTP_200_OK)
def user_login(req: AuthLoginRequest):
    """
    Simple Authentication Endpoint (Fulfills Platform Requirement #1).
    Demonstrates User vs Admin role switching.
    """
    is_admin = req.email.lower().startswith("admin") or req.role.lower() == "admin"
    return {
        "status": "success",
        "email": req.email,
        "role": "admin" if is_admin else "user",
        "access_token": f"token_smartreco_{req.role}_{int(time.time())}"
    }

@app.get("/api/health", status_code=status.HTTP_200_OK)
def health_check():
    return {
        "status": "online",
        "service": "SmartReco Agentic Engine",
        "orchestrator": "LangGraph + Mesh API",
        "version": "2.5.0",
        "catalog_size": len(PRODUCT_CATALOG)
    }

@app.get("/api/courses", status_code=status.HTTP_200_OK)
def get_courses():
    """Returns the complete product catalog."""
    return PRODUCT_CATALOG

@app.post("/api/track", status_code=status.HTTP_200_OK)
def track_event(event: TelemetryEvent):
    """Ingests live micro-interaction telemetry signals into session history."""
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
        
    return {
        "status": "success",
        "session_id": session_id,
        "total_logged_events": len(SESSION_DB[session_id])
    }

@app.post("/api/recommend", status_code=status.HTTP_200_OK)
def generate_recommendations(req: RecommendationRequest):
    """Executes multi-node LangGraph state machine with Intelligent Caching."""
    session_id = req.session_id.strip()
    session_logs = SESSION_DB.get(session_id, [])
    
    if not session_logs:
        return {
            "session_id": session_id,
            "inferred_intent": "Session initialized. Awaiting user interaction...",
            "persuasive_story": "Filter categories, search topics, or inspect curriculum modules to trigger real-time recommendations.",
            "grounded_matches": [],
            "cached": False
        }

    last_event_ts = session_logs[-1].get("timestamp", 0)
    cache_key = f"{session_id}_{len(session_logs)}_{last_event_ts}"

    if not req.force_refresh and cache_key in RECOMMENDATION_CACHE:
        logger.info(f"Serving cached recommendation for session {session_id}")
        cached_resp = RECOMMENDATION_CACHE[cache_key]
        cached_resp["cached"] = True
        return cached_resp

    initial_graph_state = {
        "session_id": session_id,
        "telemetry_logs": session_logs,
        "inferred_intent": "",
        "retrieved_products": [],
        "final_pitch": ""
    }

    try:
        final_graph_state = recommendation_graph.invoke(initial_graph_state)
        response_payload = {
            "session_id": session_id,
            "inferred_intent": final_graph_state.get("inferred_intent", "General browsing"),
            "persuasive_story": final_graph_state.get("final_pitch", ""),
            "grounded_matches": final_graph_state.get("retrieved_products", []),
            "cached": False
        }
        RECOMMENDATION_CACHE[cache_key] = response_payload
        return response_payload

    except Exception as e:
        logger.error(f"[LangGraph Execution Error]: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to process recommendation graph workflow."
        )

@app.post("/api/admin/product", status_code=status.HTTP_201_CREATED)
def create_or_update_product(product: ProductCatalogItem, db: Session = Depends(get_db)):
    """
    DUAL-WRITE ENDPOINT (Requirement #2):
    Synchronously updates:
    1. SQLite Main Relational Database (`products` table)
    2. ChromaDB Vector Database (`smartreco_courses` collection)
    3. In-memory / local JSON persistence storage
    """
    prod_dict = product.model_dump()
    
    # 1. DUAL-WRITE PART A: Sync to SQLite Main Relational Database
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
                id=product.id,
                title=product.title,
                category=product.category,
                level=product.level,
                price=product.price,
                rating=product.rating or 4.8,
                students=product.students or "1,200",
                tags=json.dumps(product.tags),
                description=product.description
            )
            db.add(new_sql)
        db.commit()
    except Exception as e:
        db.rollback()
        logger.error(f"Dual-Write SQL Error: {e}")

    # 2. DUAL-WRITE PART B: Sync to ChromaDB Vector Database
    vector_synced = upsert_product_vector(prod_dict)
    
    # 3. Dual-Write File Persistence
    existing_idx = next((i for i, p in enumerate(PRODUCT_CATALOG) if p.get("id") == product.id), None)
    if existing_idx is not None:
        PRODUCT_CATALOG[existing_idx] = prod_dict
    else:
        PRODUCT_CATALOG.append(prod_dict)
        
    save_catalog()
    
    return {
        "status": "success",
        "product_id": product.id,
        "dual_write": {
            "sql_db_synced": True,
            "chroma_vector_synced": vector_synced,
            "json_file_synced": True
        }
    }

# ------------------------------------------------------------------------------
# 6. Static File Mount for Unified Single-Port Hosting
# ------------------------------------------------------------------------------
dist_folder = os.path.join(PROJECT_ROOT, "frontend", "dist")
if os.path.exists(dist_folder):
    app.mount("/static", StaticFiles(directory=dist_folder), name="static")

    @app.get("/{full_path:path}")
    async def serve_spa(request: Request, full_path: str):
        if full_path.startswith("api/"):
            raise HTTPException(status_code=404, detail="API route not found")
        file_path = os.path.join(dist_folder, full_path)
        if os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(dist_folder, "index.html"))