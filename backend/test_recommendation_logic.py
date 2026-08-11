import sys
from pathlib import Path

# Add backend to path
sys.path.append(str(Path(__file__).resolve().parent))

from main import SessionLocal, Product, SalesRecord
from services.pricing_service import PricingService
from services.forecast_service import ForecastService
from services.recommendation_service import RecommendationService

def run_tests():
    # Initialize services
    pricing_service = PricingService()
    forecast_service = ForecastService()
    rec_service = RecommendationService(
        pricing_service=pricing_service,
        forecast_service=forecast_service
    )

    product_id = "elec_laptop"
    comp_price = 47000.0

    db = SessionLocal()
    try:
        product = db.query(Product).filter(Product.id == product_id).first()
        if not product:
            print(f"Product {product_id} not found in database!")
            return

        # Query historical sales records
        sales_records = db.query(SalesRecord).filter(SalesRecord.product_name == product.name).all()
        hist_sales = sum(r.units_sold for r in sales_records) if sales_records else 19.0
        hist_rev = sum(r.revenue for r in sales_records) if sales_records else (hist_sales * product.current_price)

        # Get features
        features = pricing_service.get_features_for_product(product_id)
        if not features:
            features = {"stockcode": product_id, "quantity": 10.0}

        # Generate recommendation
        res = rec_service.get_recommendation(
            product_features=features,
            current_price=product.current_price,
            current_inventory=product.stock,
            historical_sales=hist_sales,
            historical_revenue=hist_rev,
            cost_price=product.cost_price,
            competitor_price=comp_price
        )

        daily_velocity = hist_sales / 30.0

        print("=" * 70)
        print("LAPTOP SINGLE TEST RESULT:")
        print(f"Stock                 : {product.stock} units")
        print(f"Historical Sales      : {hist_sales} units")
        print(f"Daily Velocity        : {daily_velocity:.4f} units/day")
        print(f"Days of Supply        : {res['pricing_analysis_report']['days_of_supply']:.1f} days")
        print(f"Recommended Price     : Rs. {res['recommended_price']:.2f}")
        print("=" * 70 + "\n")

    except Exception as e:
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    run_tests()
