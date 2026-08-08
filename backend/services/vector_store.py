import os
import json
import logging
from typing import List, Dict, Any
import chromadb
from chromadb.config import Settings

logger = logging.getLogger(__name__)

# Dynamically target the exact backend/services/chroma_db path seen in workspace
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(CURRENT_DIR, "..", ".."))
CHROMA_PERSIST_DIR = os.path.join(CURRENT_DIR, "chroma_db")

# Initialize ChromaDB Persistent Client
chroma_client = chromadb.PersistentClient(
    path=CHROMA_PERSIST_DIR,
    settings=Settings(anonymized_telemetry=False)
)

COLLECTION_NAME = "smartreco_courses"
collection = chroma_client.get_or_create_collection(
    name=COLLECTION_NAME,
    metadata={"hnsw:space": "cosine"}
)

def _build_searchable_text(course: Dict[str, Any]) -> str:
    """Builds an enriched string combining metadata for semantic search embedding."""
    title = course.get("title", "")
    category = course.get("category", "")
    description = course.get("description", "")
    tags = ", ".join(course.get("tags", [])) if isinstance(course.get("tags"), list) else str(course.get("tags", ""))
    level = course.get("level", "")
    
    return f"Title: {title} | Category: {category} | Level: {level} | Tags: {tags} | Description: {description}"

def seed_vector_store_from_json(json_file_path: str) -> None:
    """
    Seeds ChromaDB from courses.json on boot if collection is empty.
    Satisfies catalog dual-write requirements.
    """
    try:
        if collection.count() > 0:
            logger.info(f"ChromaDB collection '{COLLECTION_NAME}' active with {collection.count()} items. Skipping seed.")
            return

        if not os.path.exists(json_file_path):
            logger.warning(f"Catalog file missing for seeding: {json_file_path}")
            return

        with open(json_file_path, "r", encoding="utf-8") as f:
            courses = json.load(f)

        if not courses:
            logger.warning("Course catalog JSON is empty.")
            return

        documents, metadatas, ids = [], [], []

        for course in courses:
            course_id = str(course.get("id"))
            doc_text = _build_searchable_text(course)
            
            meta = {
                "id": course_id,
                "title": course.get("title", ""),
                "category": course.get("category", ""),
                "level": course.get("level", "Intermediate"),
                "price": float(course.get("price", 0.0)),
                "rating": float(course.get("rating", 4.8))
            }

            documents.append(doc_text)
            metadatas.append(meta)
            ids.append(course_id)

        collection.upsert(
            documents=documents,
            metadatas=metadatas,
            ids=ids
        )
        logger.info(f"Successfully populated vector store with {len(ids)} courses.")

    except Exception as e:
        logger.error(f"Vector store seed error: {str(e)}")

def upsert_product_vector(course: Dict[str, Any]) -> bool:
    """
    Synchronizes product additions or updates directly into ChromaDB.
    Executed synchronously during Admin product dual-writes.
    """
    try:
        course_id = str(course.get("id"))
        doc_text = _build_searchable_text(course)
        meta = {
            "id": course_id,
            "title": course.get("title", ""),
            "category": course.get("category", ""),
            "level": course.get("level", "Intermediate"),
            "price": float(course.get("price", 0.0)),
            "rating": float(course.get("rating", 4.8))
        }

        collection.upsert(
            documents=[doc_text],
            metadatas=[meta],
            ids=[course_id]
        )
        logger.info(f"Dual-write successful: Product '{course_id}' synced to ChromaDB.")
        return True

    except Exception as e:
        logger.error(f"Failed to upsert product vector for ID {course.get('id')}: {str(e)}")
        return False

def query_vector_store(search_text: str, top_k: int = 3) -> List[Dict[str, Any]]:
    """
    Performs semantic vector query over course embeddings.
    Returns grounded catalog metadata matches.
    """
    try:
        if collection.count() == 0:
            logger.warning("Vector query invoked on empty ChromaDB collection.")
            return []

        results = collection.query(
            query_texts=[search_text],
            n_results=min(top_k, collection.count())
        )

        retrieved_products = []
        if results and "metadatas" in results and results["metadatas"]:
            for meta in results["metadatas"][0]:
                retrieved_products.append(meta)

        return retrieved_products

    except Exception as e:
        logger.error(f"Vector search query exception: {str(e)}")
        return []