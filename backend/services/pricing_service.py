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
    def __init__(self, model_path: Path = None):
        if model_path is None:
            model_path = SAVED_MODELS_DIR / "price_prediction_lightgbm.joblib"
        self.model_path = model_path
        self.model = self._load_model()
        
    def _load_model(self) -> Any:
        if not self.model_path.exists():
            raise FileNotFoundError(f"LightGBM price prediction model not found at: {self.model_path}")
        logger.info(f"Loading LightGBM price model from: {self.model_path}")
        return joblib.load(self.model_path)
        
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
