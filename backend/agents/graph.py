import os
import logging
from typing import TypedDict, List, Dict, Any, Optional
from dotenv import load_dotenv

from langgraph.graph import StateGraph, END
from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage
from langsmith import traceable

from backend.services.vector_store import query_vector_store

# Setup module logger
logger = logging.getLogger(__name__)

# ------------------------------------------------------------------------------
# 1. Environment & Mesh API Configuration
# ------------------------------------------------------------------------------
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ENV_PATH = os.path.normcase(os.path.abspath(os.path.join(BASE_DIR, "..", "..", ".env")))
load_dotenv(dotenv_path=ENV_PATH, override=True)

MESH_API_KEY = os.getenv("MESH_API_KEY", "").strip()
MESH_BASE_URL = os.getenv("MESH_BASE_URL", "https://api.meshapi.ai/v1").strip()
PRIMARY_MODEL = os.getenv("PRIMARY_MODEL", "openai/gpt-4o")

# Initialize ChatOpenAI client routed strictly through Mesh API Gateway
llm = ChatOpenAI(
    model=PRIMARY_MODEL,
    api_key=MESH_API_KEY if MESH_API_KEY else "placeholder_key",
    base_url=MESH_BASE_URL,
    temperature=0.6,
    max_tokens=200,
    request_timeout=12.0
)

# ------------------------------------------------------------------------------
# 2. State Schema
# ------------------------------------------------------------------------------
class RecommendationState(TypedDict):
    session_id: str
    telemetry_logs: List[Dict[str, Any]]
    inferred_intent: str
    retrieved_products: List[Dict[str, Any]]
    final_pitch: str

# ------------------------------------------------------------------------------
# 3. Node 1: Analyze Behavioral Telemetry with Dynamic Target Parsing
# ------------------------------------------------------------------------------
@traceable(name="Node_AnalyzeTelemetry")
def analyze_telemetry_node(state: RecommendationState) -> Dict[str, Any]:
    """
    Parses recent behavioral events, accurately extracting intent signals from 
    event_type, target_id, and metadata to build a dynamic semantic query.
    """
    logs = state.get("telemetry_logs", [])
    if not logs:
        return {"inferred_intent": "General software engineering and cloud development exploration"}

    # Process most recent 10 events for high temporal relevance
    recent_events = logs[-10:]
    
    categories = []
    queries = []
    selected_courses = []
    cart_courses = []

    for event in recent_events:
        event_type = event.get("event_type", "")
        target_id = event.get("target_id", "")
        meta = event.get("metadata", {})

        if event_type == "Category_Filter_Applied" and target_id and target_id != "All":
            categories.append(target_id)
        elif event_type == "Course_Selected" and target_id:
            selected_courses.append(target_id)
        elif event_type == "Added_To_Cart" and target_id:
            cart_courses.append(target_id)
        elif event_type == "Catalog_Search" and target_id:
            queries.append(target_id)

        # Fallback check inside metadata
        if meta.get("category") and meta.get("category") != "All":
            categories.append(meta["category"])
        if meta.get("query"):
            queries.append(meta["query"])

    # Build clear, high-precision intent signals
    intent_signals = []
    if cart_courses:
        intent_signals.append(f"High intent cart item: {cart_courses[-1]}")
    if selected_courses:
        intent_signals.append(f"Inspecting course: {selected_courses[-1]}")
    if categories:
        intent_signals.append(f"Active domain filter: {categories[-1]}")
    if queries:
        intent_signals.append(f"Search queries: {', '.join(set(queries))}")

    if intent_signals:
        inferred = " | ".join(intent_signals)
    else:
        inferred = "General full-stack and modern AI engineering exploration"

    logger.info(f"[Graph Node: Telemetry] Session {state.get('session_id')}: Inferred Intent -> {inferred}")
    return {"inferred_intent": inferred}

# ------------------------------------------------------------------------------
# 4. Node 2: Vector Retrieval Grounding (RAG)
# ------------------------------------------------------------------------------
@traceable(name="Node_VectorRetrieval")
def vector_retrieval_node(state: RecommendationState) -> Dict[str, Any]:
    """
    Queries ChromaDB vector database using the dynamically computed user intent string.
    """
    intent = state.get("inferred_intent", "General software development")
    try:
        retrieved = query_vector_store(search_text=intent, top_k=3)
    except Exception as err:
        logger.error(f"[Graph Node: Retrieval Error] Failed querying vector store: {err}")
        retrieved = []

    logger.info(f"[Graph Node: Retrieval] Retrieved {len(retrieved)} grounded catalog items.")
    return {"retrieved_products": retrieved}

# ------------------------------------------------------------------------------
# 5. Node 3: Mesh API Persuasive Pitch Generation with Contextual Fallbacks
# ------------------------------------------------------------------------------
@traceable(name="Node_GeneratePersuasion")
def persuasion_generation_node(state: RecommendationState) -> Dict[str, Any]:
    """
    Generates a personalized, persuasive pitch using Mesh API gateway based on
    user telemetry and grounded catalog recommendations.
    """
    intent = state.get("inferred_intent", "General tech exploration")
    products = state.get("retrieved_products", [])
    
    prod_titles = ", ".join([p.get("title", "") for p in products if p.get("title")]) or "Modern Software Engineering Path"

    sys_msg = SystemMessage(content=(
        "You are an elite developer career advisor for SmartReco. "
        "Craft a compelling, 1-2 sentence recommendation pitch explaining why these specific learning modules "
        "directly accelerate the user's immediate technical goals based on their real-time session activity."
    ))
    
    usr_msg = HumanMessage(content=(
        f"User Session Signals: {intent}\n"
        f"Grounded Catalog Recommendations: {prod_titles}\n\n"
        "Generate a persuasive, highly relevant recommendation message:"
    ))

    try:
        if not MESH_API_KEY or MESH_API_KEY.startswith("your_") or MESH_API_KEY == "placeholder_key":
            raise ValueError("Mesh API Key unconfigured or using template default.")

        response = llm.invoke([sys_msg, usr_msg])
        pitch = response.content.strip()
        
    except Exception as e:
        logger.warning(f"[Mesh API Gateway Fallback Triggered]: {str(e)}")

        # Resilient Contextual Heuristic Fallback
        intent_lower = intent.lower()
        if any(kw in intent_lower for kw in ["cloud", "devops", "kubernetes", "aws", "terraform"]):
            pitch = "Focusing on Cloud & DevOps — master production Kubernetes, Terraform automation, and high-availability cloud architecture!"
        elif any(kw in intent_lower for kw in ["rag", "generative", "llm", "vector", "prompt", "multimodal"]):
            pitch = "High engagement with Generative AI detected — master hybrid vector retrieval, fine-tuning, and production RAG pipelines!"
        elif any(kw in intent_lower for kw in ["agent", "langgraph", "agentic", "software synthesis"]):
            pitch = "Exploring Agentic AI — master state machines in LangGraph to build resilient, autonomous multi-agent systems!"
        elif any(kw in intent_lower for kw in ["mlops", "triton", "model serving", "data engineering", "spark"]):
            pitch = "Deep diving into MLOps & Data Systems — master high-throughput inference pipelines, Spark streaming, and model monitoring!"
        elif any(kw in intent_lower for kw in ["fastapi", "python", "backend", "full-stack"]):
            pitch = "Optimizing backend infrastructure — dive into high-throughput FastAPI architecture, async processing, and microservice resilience!"
        else:
            pitch = f"Based on your active learning session ({intent}), we recommend exploring our production-grade architecture and targeted skill paths."

    return {"final_pitch": pitch}

# ------------------------------------------------------------------------------
# 6. Build & Compile LangGraph State Machine
# ------------------------------------------------------------------------------
workflow = StateGraph(RecommendationState)

workflow.add_node("analyze_telemetry", analyze_telemetry_node)
workflow.add_node("vector_retrieval", vector_retrieval_node)
workflow.add_node("generate_persuasion", persuasion_generation_node)

workflow.set_entry_point("analyze_telemetry")
workflow.add_edge("analyze_telemetry", "vector_retrieval")
workflow.add_edge("vector_retrieval", "generate_persuasion")
workflow.add_edge("generate_persuasion", END)

recommendation_graph = workflow.compile()