import os
import sys
import logging
from pathlib import Path
from typing import Dict, Any, List, Union

import pandas as pd
import joblib

# Ensure the backend directory is in the system path to allow absolute imports
BASE_DIR = Path(__file__).resolve().parent.parent
if str(BASE_DIR) not in sys.path:
    sys.path.append(str(BASE_DIR))

from ml_pipeline.train_price_model import SAVED_MODELS_DIR

logger = logging.getLogger("services.pricing_service")

class PricingService:
    """
    A reusable service designed to load the pre-trained LightGBM price prediction model
    and execute pricing predictions for single feature dictionaries or batches.
    """
    _model = None
    _features_cache = None

    def __init__(self, model_path: Path = None):
        if model_path is None:
            model_path = SAVED_MODELS_DIR / "price_prediction_lightgbm.joblib"
        self.model_path = model_path
        self.model = self._load_model()
        self._ensure_features_cache()

    @classmethod
    def _ensure_features_cache(cls):
        if cls._features_cache is None:
            features_csv_path = BASE_DIR / "datasets" / "features" / "online_retail" / "online_retail_II.csv"
            if not features_csv_path.exists():
                features_csv_path = BASE_DIR / "datasets" / "training" / "lightgbm_price_train.csv"

            cache = {}
            if features_csv_path.exists():
                logger.info(f"Building compact features cache once from {features_csv_path}")
                try:
                    df = pd.read_csv(features_csv_path)
                    if "stockcode" in df.columns:
                        df["stockcode"] = df["stockcode"].astype(str).str.strip()
                        last_records = df.groupby("stockcode").last().reset_index()
                        for _, row in last_records.iterrows():
                            cache[str(row["stockcode"])] = row.to_dict()
                except Exception as e:
                    logger.error(f"Failed to load features dataset: {e}")
            else:
                logger.warning(f"Features dataset not found at {features_csv_path}")
            cls._features_cache = cache
        
    def _load_model(self) -> Any:
        if PricingService._model is None:
            if not self.model_path.exists():
                try:
                    from services.ensure_models import ensure_models
                    ensure_models()
                except Exception as e:
                    logger.warning(f"ensure_models attempt failed: {e}")
            if not self.model_path.exists():
                raise FileNotFoundError(f"LightGBM price prediction model not found at: {self.model_path}")
            logger.info(f"Loading LightGBM price model from: {self.model_path}")
            PricingService._model = joblib.load(self.model_path)
        return PricingService._model
        
    def get_features_for_product(self, stockcode: str) -> Dict[str, Any]:
        """
        Looks up the latest feature row for a given product stockcode.
        """
        if self._features_cache is None:
            self._ensure_features_cache()
        cleaned_code = str(stockcode).strip()
        return self._features_cache.get(cleaned_code, {})
        
    def predict_optimal_price(self, features: Dict[str, Any]) -> float:
        """
        Predicts optimal price for a single product/transaction feature dictionary.
        """
        df = pd.DataFrame([features])
        return float(self.predict_optimal_prices_batch(df)[0])
        
    def predict_optimal_prices_batch(self, df: pd.DataFrame) -> List[float]:
        """
        Predicts optimal prices for a DataFrame of features.
        """
        df = df.copy()
        
        # Cast categorical columns to Pandas category dtype as expected by LightGBM
        for col in ["stockcode", "country"]:
            if col in df.columns:
                df[col] = df[col].astype("category")
                
        # Required columns in the correct order for model predictions
        required_features = [
            "quantity", "revenue", "year", "month", "week", "day", "day_of_week", "quarter",
            "quantity_lag_1", "quantity_lag_7", "quantity_rolling_mean_7", "quantity_rolling_mean_14",
            "stockcode", "country"
        ]
        
        # Ensure all columns exist, if not, initialize with default values
        for col in required_features:
            if col not in df.columns:
                if col in ["stockcode", "country"]:
                    df[col] = "United Kingdom" if col == "country" else "M"
                    df[col] = df[col].astype("category")
                else:
                    df[col] = 0.0
                    
        X = df[required_features]
        preds = self.model.predict(X)
        return [float(p) for p in preds]

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    print("Testing PricingService...")
    try:
        service = PricingService()
        test_features = {
            "quantity": 10,
            "revenue": 50.0,
            "year": 2018,
            "month": 3,
            "week": 10,
            "day": 5,
            "day_of_week": 1,
            "quarter": 1,
            "quantity_lag_1": 12.0,
            "quantity_lag_7": 8.0,
            "quantity_rolling_mean_7": 9.5,
            "quantity_rolling_mean_14": 10.2,
            "stockcode": "22423",
            "country": "United Kingdom"
        }
        pred = service.predict_optimal_price(test_features)
        print(f"Optimal Price Prediction Success! Predicted: ${pred:.2f}")
    except Exception as e:
        print(f"Optimal Price Prediction Failed: {e}")
