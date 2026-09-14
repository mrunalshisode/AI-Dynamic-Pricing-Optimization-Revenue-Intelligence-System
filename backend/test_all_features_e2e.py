import requests
import json

BASE = "http://127.0.0.1:8000"

# 1. Login
login_res = requests.post(
    f"{BASE}/auth/login",
    json={"email": "manager@revenueiq.com", "password": "manager123"},
    timeout=10
)
if login_res.status_code != 200:
    print(f"Login failed [{login_res.status_code}]: {login_res.text}")
    exit(1)

token = login_res.json()["access_token"]
auth_headers = {"Authorization": f"Bearer {token}"}

endpoints = [
    ("Root Home", "GET", "/", {}),
    ("AI Health", "GET", "/api/ai/health", {}),
    ("AI Model Status", "GET", "/api/ai/model-status", {}),
    ("Price Prediction", "GET", "/api/ai/predict-price?quantity=10&revenue=50", {}),
    ("Demand Forecast (90d)", "GET", "/api/ai/forecast-demand?horizon=90_days", {}),
    ("Demand Forecast (All)", "GET", "/api/ai/forecast-demand?horizon=all", {}),
    ("Price Recommendation", "GET", "/api/ai/recommend-price?stockcode=elec_headphones", {}),
    ("Executive BI Summary", "GET", "/api/executive-bi/summary", auth_headers),
    ("Portfolio Market Intelligence", "GET", "/api/market-intelligence/portfolio", auth_headers),
    ("Product Market Intelligence", "GET", "/api/market-intelligence/elec_headphones", auth_headers),
    ("Profitability Overview", "GET", "/api/profitability/overview", auth_headers),
    ("Product Profitability Details", "GET", "/api/profitability/product/elec_headphones", auth_headers),
    ("Pricing Strategy", "GET", "/api/pricing-strategy/elec_headphones", auth_headers),
    ("Pricing Comparison", "GET", "/api/pricing-comparison/elec_headphones", auth_headers),
    ("Competitor Monitoring Status", "GET", "/api/competitor-monitoring/status", auth_headers),
    ("Competitor Monitoring Latest", "GET", "/api/competitor-monitoring/latest", auth_headers),
    ("Competitor Monitoring Alerts", "GET", "/api/competitor-monitoring/alerts", auth_headers),
    ("Competitor Monitoring Scheduler", "GET", "/api/competitor-monitoring/scheduler", auth_headers),
    ("Seasonal Trends", "GET", "/api/seasonal-trends/elec_headphones", auth_headers),
]

print("\n" + "="*85)
print(f"{'Endpoint Name':<35} | {'Method':<6} | {'Status':<6} | {'Status Text':<12} | {'Response Preview'}")
print("="*85)

all_passed = True
for name, method, ep, headers in endpoints:
    try:
        if method == "GET":
            resp = requests.get(f"{BASE}{ep}", headers=headers, timeout=15)
        else:
            resp = requests.post(f"{BASE}{ep}", headers=headers, timeout=15)
            
        status = resp.status_code
        status_text = "PASS (200)" if status == 200 else f"FAIL ({status})"
        if status != 200:
            all_passed = False
            preview = resp.text[:60]
        else:
            try:
                data = resp.json()
                if isinstance(data, dict):
                    preview = f"Keys: {list(data.keys())[:4]}"
                elif isinstance(data, list):
                    preview = f"List len: {len(data)}"
                else:
                    preview = str(data)[:40]
            except Exception:
                preview = resp.text[:40]
                
        print(f"{name:<35} | {method:<6} | {status:<6} | {status_text:<12} | {preview}")
    except Exception as ex:
        all_passed = False
        print(f"{name:<35} | {method:<6} | {'ERR':<6} | {'EXCEPTION':<12} | {str(ex)[:50]}")

print("="*85)
if all_passed:
    print("ALL ENDPOINTS RETURNED HTTP 200 OK! ZERO BACKEND FAILURES DETECTED.")
else:
    print("WARNING: Some endpoints failed. Check details above.")
