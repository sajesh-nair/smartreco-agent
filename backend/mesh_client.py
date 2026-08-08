import os
import logging
from typing import Optional, Dict, Any, List
from dotenv import load_dotenv

from openai import OpenAI, OpenAIError
from langchain_openai import ChatOpenAI
from langsmith import traceable

# Setup logging
logger = logging.getLogger(__name__)

load_dotenv()

# Configuration constants
MESH_BASE_URL = os.getenv("MESH_BASE_URL", "https://api.meshapi.ai/v1")
MESH_API_KEY = os.getenv("MESH_API_KEY", "")
PRIMARY_MODEL = os.getenv("PRIMARY_MODEL", "openai/gpt-4o")
FALLBACK_MODEL = os.getenv("FALLBACK_MODEL", "openai/gpt-4o-mini")

class MeshLLMService:
    """
    Enterprise wrapper for Mesh API gateway providing robust inference capabilities,
    failover mechanisms, and direct compatibility with LangChain/LangGraph.
    """

    def __init__(self):
        self.api_key = MESH_API_KEY
        self.base_url = MESH_BASE_URL
        self._sync_client: Optional[OpenAI] = None

    def _get_client(self) -> OpenAI:
        """Lazy instantiation of the standard OpenAI client configured for Mesh API."""
        if not self._sync_client:
            if not self.api_key or self.api_key.startswith("your_"):
                logger.warning("MESH_API_KEY is missing or invalid. Calls will trigger heuristic fallback.")
            self._sync_client = OpenAI(
                api_key=self.api_key or "placeholder_key",
                base_url=self.base_url,
                timeout=12.0,
                max_retries=2,
            )
        return self._sync_client

    def get_langchain_llm(
        self, 
        model_name: str = PRIMARY_MODEL, 
        temperature: float = 0.6,
        max_tokens: int = 500
    ) -> ChatOpenAI:
        """
        Returns an initialized ChatOpenAI instance configured specifically for Mesh API endpoints,
        enabling native compatibility with LangGraph and LangChain constructs.
        """
        return ChatOpenAI(
            model=model_name,
            openai_api_key=self.api_key or "placeholder_key",
            openai_api_base=self.base_url,
            temperature=temperature,
            max_tokens=max_tokens,
            request_timeout=15.0,
        )

    @traceable(name="MeshAPI_GenerateRecommendation")
    def generate_recommendation_copy(
        self, 
        prompt: str, 
        system_prompt: str = "You are an elite, persuasive AI learning path recommendations advisor.",
        temperature: float = 0.6,
        max_tokens: int = 250
    ) -> str:
        """
        Executes a completion request via Mesh API with model failover and contextual fallback.
        """
        if not self.api_key or self.api_key.startswith("your_"):
            return self._heuristic_fallback(prompt)

        client = self._get_client()
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": prompt}
        ]

        # Primary Attempt using Primary Model (e.g., openai/gpt-4o)
        try:
            response = client.chat.completions.create(
                model=PRIMARY_MODEL,
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens,
            )
            return response.choices[0].message.content.strip()

        except OpenAIError as primary_err:
            logger.warning(f"Primary model ({PRIMARY_MODEL}) failed: {primary_err}. Attempting fallback ({FALLBACK_MODEL}).")
            
            # Secondary Attempt using Fallback Model (e.g., openai/gpt-4o-mini)
            try:
                response = client.chat.completions.create(
                    model=FALLBACK_MODEL,
                    messages=messages,
                    temperature=temperature,
                    max_tokens=max_tokens,
                )
                return response.choices[0].message.content.strip()

            except OpenAIError as fallback_err:
                logger.error(f"Fallback model call to Mesh API failed: {fallback_err}. Routing to heuristic engine.")
                return self._heuristic_fallback(prompt)

    def _heuristic_fallback(self, prompt: str) -> str:
        """Graceful local heuristic fallback to prevent downstream application failure."""
        prompt_lower = prompt.lower()

        if any(kw in prompt_lower for kw in ["cloud", "devops", "terraform", "aws", "kubernetes"]):
            return (
                "Notice you're exploring Cloud & DevOps infrastructure. Master production Kubernetes, "
                "Infrastructure-as-Code (Terraform), and cloud-native resilience to scale enterprise workloads!"
            )
        elif any(kw in prompt_lower for kw in ["rag", "agent", "generative", "langgraph", "llm"]):
            return (
                "High engagement with Generative AI detected. We recommend diving into production LangGraph multi-agent "
                "orchestration and hybrid vector retrieval to build scalable AI systems!"
            )
        elif any(kw in prompt_lower for kw in ["python", "fastapi", "backend", "system design"]):
            return (
                "Focused on backend engineering excellence? Master high-throughput FastAPI design, clean architecture, "
                "and async event processing for mission-critical systems!"
            )
        else:
            return (
                "Based on your recent learning patterns, we recommend exploring high-impact AI engineering "
                "and system design courses tailored to your career trajectory."
            )

# Singleton instance for platform-wide importing
mesh_service = MeshLLMService()
call_mesh_llm = mesh_service.generate_recommendation_copy