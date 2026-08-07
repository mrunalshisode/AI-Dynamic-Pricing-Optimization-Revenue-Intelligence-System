import os
import sys
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Any, List

from fastapi import APIRouter, HTTPException

# Ensure the backend directory is in the system path to allow absolute imports
BASE_DIR = Path(__file__).resolve().parent.parent
if str(BASE_DIR) not in sys.path:
    sys.path.append(str(BASE_DIR))

from database.mongodb import db, test_connection
from services.prediction_history import get_prediction_history, is_db_connected
from services.model_monitor import get_monitor_status
from services.audit_logger import get_recent_logs
from services.model_versioning import get_all_versions

# Setup logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("routes.dashboard")

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])

@router.get("/overview")
def get_overview():
    """
    Returns high-level summary metrics of the AI Dynamic Pricing system.
    """
    if db is None:
        raise HTTPException(status_code=500, detail="Database client is not initialized.")
        
    try:
        # Check database connection state
        mongo_connected, _ = test_connection()
        system_health = "Healthy" if mongo_connected else "Unhealthy"
        
        # 1. Total predictions count
        prediction_history_col = db["prediction_history"]
        total_predictions = prediction_history_col.count_documents({})
        
        # 2. Total registered models count
        model_registry_col = db["model_registry"]
        registered_models = model_registry_col.count_documents({})
        
        # 3. Active models count
        active_models = model_registry_col.count_documents({"Status": "active"})
        
        # 4. Total audit events count
        audit_col = db["audit_logs"]
        total_audit_events = audit_col.count_documents({})
        
        # Determine degraded health status if any active models have degraded performance monitor states
        monitor_col = db["model_monitoring"]
        degraded_models = monitor_col.count_documents({"model_health": "Degraded"})
        unhealthy_models = monitor_col.count_documents({"model_health": "Unhealthy"})
        
        if unhealthy_models > 0:
            system_health = "Unhealthy"
        elif degraded_models > 0 or not mongo_connected:
            system_health = "Degraded"
            
        return {
            "status": "success",
            "overview": {
                "total_predictions_served": total_predictions,
                "registered_models_count": registered_models,
                "active_models_count": active_models,
                "recent_audit_events_count": total_audit_events,
                "system_health": system_health,
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
        }
    except Exception as e:
        logger.error(f"Error compiling dashboard overview metrics: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to load overview analytics: {str(e)}")

@router.get("/models")
def get_models():
    """
    Returns registered models along with their complete version histories.
    """
    if db is None:
        raise HTTPException(status_code=500, detail="Database client is not initialized.")
        
    try:
        # 1. Fetch registered models
        model_registry_col = db["model_registry"]
        cursor = model_registry_col.find({}, {"_id": 0})
        registered_list = list(cursor)
        
        # 2. Fetch all version entries
        versions_list = get_all_versions()
        
        return {
            "status": "success",
            "registered_models": registered_list,
            "version_history": versions_list,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
    except Exception as e:
        logger.error(f"Error compiling dashboard models data: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to load models data: {str(e)}")

@router.get("/history")
def get_history():
    """
    Returns the recent price prediction logs served by the system.
    """
    try:
        history = get_prediction_history(limit=50)
        return {
            "status": "success",
            "count": len(history),
            "prediction_history": history,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
    except Exception as e:
        logger.error(f"Error querying prediction history for dashboard: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to load prediction history: {str(e)}")

@router.get("/performance")
def get_performance():
    """
    Returns model latency and failure rate statistics.
    """
    try:
        monitors = get_monitor_status(model_name=None)
        return {
            "status": "success",
            "performance_monitoring": monitors,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
    except Exception as e:
        logger.error(f"Error querying performance monitor states: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to load performance metrics: {str(e)}")

@router.get("/health")
def get_health():
    """
    Returns core database ping states and recent system audit trails.
    """
    try:
        mongo_connected, mongo_message = test_connection()
        recent_logs = get_recent_logs(limit=20)
        
        return {
            "status": "success",
            "database_health": {
                "mongodb": {
                    "connected": mongo_connected,
                    "message": mongo_message
                }
            },
            "recent_audit_logs": recent_logs,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
    except Exception as e:
        logger.error(f"Error loading system health diagnostics: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to query system health: {str(e)}")
