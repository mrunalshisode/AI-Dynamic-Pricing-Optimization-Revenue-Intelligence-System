import os
import sys
import shutil
import logging
from pathlib import Path

# Ensure backend directory is in sys.path
BASE_DIR = Path(__file__).resolve().parent.parent
if str(BASE_DIR) not in sys.path:
    sys.path.append(str(BASE_DIR))

logger = logging.getLogger("services.ensure_models")

SAVED_MODELS_DIR = BASE_DIR / "saved_models"
BACKUP_DIR = BASE_DIR / "saved_models_backup"

REQUIRED_MODELS = [
    "price_prediction_lightgbm.joblib",
    "demand_forecast_prophet.pkl",
    "demand_prediction_lightgbm.joblib",
    "categorical_encoder.joblib",
    "price_prediction_xgboost.joblib",
]

def ensure_models() -> bool:
    """
    Verifies that all required ML model artifacts exist in backend/saved_models.
    If any model is missing, it attempts to restore it from saved_models_backup or
    trains it deterministically from repository datasets.
    """
    SAVED_MODELS_DIR.mkdir(parents=True, exist_ok=True)
    all_ok = True

    for model_name in REQUIRED_MODELS:
        model_path = SAVED_MODELS_DIR / model_name
        if model_path.exists() and model_path.stat().st_size > 0:
            continue

        logger.warning(f"Model artifact missing: {model_path}. Attempting restoration...")
        
        # 1. Try restoring from backup directory
        if BACKUP_DIR.exists():
            backup_path = BACKUP_DIR / model_name
            if backup_path.exists() and backup_path.stat().st_size > 0:
                logger.info(f"Restoring {model_name} from backup: {backup_path}")
                shutil.copy2(backup_path, model_path)
                continue

        # 2. Train / generate deterministically from datasets/training
        logger.info(f"Training/generating missing model: {model_name}...")
        try:
            if model_name == "price_prediction_lightgbm.joblib":
                from ml_pipeline.train_lightgbm import main as train_lgb
                train_lgb()
            elif model_name == "demand_prediction_lightgbm.joblib":
                from ml_pipeline.train_demand_lightgbm import main as train_demand_lgb
                train_demand_lgb()
            elif model_name == "demand_forecast_prophet.pkl":
                from ml_pipeline.train_prophet import main as train_prophet
                train_prophet()
            elif model_name in ("price_prediction_xgboost.joblib", "categorical_encoder.joblib"):
                from ml_pipeline.train_price_model import main as train_xgb
                train_xgb()
        except Exception as e:
            logger.error(f"Failed to generate {model_name}: {e}")
            all_ok = False

    # Final verification
    missing = [m for m in REQUIRED_MODELS if not (SAVED_MODELS_DIR / m).exists()]
    if missing:
        logger.error(f"Models still missing after ensure_models: {missing}")
        return False

    logger.info("All required model artifacts verified and ready.")
    return True

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
    print("Running ensure_models check...")
    success = ensure_models()
    if success:
        print("[OK] All ML model artifacts are present and verified.")
        sys.exit(0)
    else:
        print("[ERROR] Some ML models could not be verified.")
        sys.exit(1)
