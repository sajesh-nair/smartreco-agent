import logging
from typing import Dict, Any
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

# Setup module logger
logger = logging.getLogger("SmartRecoScheduler")

scheduler = BackgroundScheduler()

def decay_stale_intent_scores() -> None:
    """
    Background Task: Periodic decay routine for decaying historical session telemetry.
    Ensures long-lived sessions prioritize recent browsing intent over older actions.
    """
    try:
        logger.info("⏰ [APScheduler] Running background intent score decay routine...")
        # Import lazily to avoid circular dependency issues at boot
        from backend.main import SESSION_DB
        
        current_time = float(__import__("time").time())
        thirty_mins_ago = current_time - (30 * 60)

        for session_id, logs in list(SESSION_DB.items()):
            # Filter out micro-interactions older than 30 minutes
            fresh_logs = [e for e in logs if e.get("timestamp", 0) > thirty_mins_ago]
            if len(fresh_logs) != len(logs):
                SESSION_DB[session_id] = fresh_logs
                logger.info(f"Cleaned stale telemetry events for session '{session_id}'.")

    except Exception as err:
        logger.error(f"[APScheduler Error] Intent score decay job failed: {err}")

def sync_vector_catalog() -> None:
    """
    Background Task: Periodically audits ChromaDB collection against local JSON persistence
    to guarantee dual-write consistency.
    """
    try:
        logger.info("⏰ [APScheduler] Verifying ChromaDB catalog state synchronization...")
        from backend.services.vector_store import seed_vector_store_from_json, CATALOG_FILE
        
        seed_vector_store_from_json(CATALOG_FILE)
        logger.info("✅ [APScheduler] Vector catalog state audit completed successfully.")

    except Exception as err:
        logger.error(f"[APScheduler Error] Vector catalog sync job failed: {err}")

def dispatch_proactive_daily_digests() -> None:
    """
    ⭐ Bonus Feature: Scheduled Proactive Delivery
    Background Task: Compiles daily personalized learning digests for active sessions
    and generates persuasive AI recommendations via LangGraph & Mesh API.
    """
    try:
        logger.info("⏰ [APScheduler] Compiling proactive daily recommendation digests...")
        from backend.main import SESSION_DB
        from backend.agents.graph import recommendation_graph

        for session_id, logs in list(SESSION_DB.items()):
            if not logs:
                continue

            logger.info(f"Generating proactive daily digest recommendation for active session '{session_id}'...")
            
            # Execute LangGraph engine for proactive push notification payload
            initial_state = {
                "session_id": session_id,
                "telemetry_logs": logs,
                "inferred_intent": "",
                "retrieved_products": [],
                "final_pitch": ""
            }
            
            result = recommendation_graph.invoke(initial_state)
            pitch = result.get("final_pitch")
            matches = result.get("retrieved_products", [])

            # In production, this dispatches via SMTP/SendGrid or Telegram Webhook
            logger.info(f"📬 Proactive Digest Ready for Session [{session_id}]: '{pitch}' | Top Matches: {[m.get('title') for m in matches]}")

    except Exception as err:
        logger.error(f"[APScheduler Error] Proactive daily digest dispatch failed: {err}")

def start_scheduler() -> None:
    """
    Initializes and starts the background job scheduler.
    """
    if not scheduler.running:
        # Job 1: Decay stale intent signals every 10 minutes
        scheduler.add_job(
            decay_stale_intent_scores, 
            "interval", 
            minutes=10, 
            id="intent_decay_job",
            replace_existing=True
        )

        # Job 2: Audit vector DB catalog consistency every hour
        scheduler.add_job(
            sync_vector_catalog, 
            "interval", 
            hours=1, 
            id="vector_sync_job",
            replace_existing=True
        )

        # Job 3 (Bonus): Daily proactive digest dispatch (runs daily at 17:00 / 5 PM)
        scheduler.add_job(
            dispatch_proactive_daily_digests,
            CronTrigger(hour=17, minute=0),
            id="proactive_digest_job",
            replace_existing=True
        )

        scheduler.start()
        logger.info("✅ APScheduler started successfully with active proactive delivery jobs.")

def stop_scheduler() -> None:
    """
    Gracefully shuts down the background scheduler during server termination.
    """
    if scheduler.running:
        scheduler.shutdown(wait=False)
        logger.info("🛑 APScheduler shut down gracefully.")