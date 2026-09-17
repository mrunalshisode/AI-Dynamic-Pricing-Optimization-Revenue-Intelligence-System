import sys
import asyncio
from pathlib import Path

# Add backend directory to sys.path
BASE_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(BASE_DIR))

from main import app, FRONTEND_DIST

async def asgi_request(app, method: str, path: str, headers_dict: dict = None, body: bytes = b""):
    raw_headers = []
    if headers_dict:
        for k, v in headers_dict.items():
            raw_headers.append((k.lower().encode("latin1"), v.encode("latin1")))

    scope = {
        "type": "http",
        "asgi": {"version": "3.0", "spec_version": "2.1"},
        "http_version": "1.1",
        "method": method.upper(),
        "scheme": "http",
        "path": path,
        "raw_path": path.encode("latin1"),
        "query_string": b"",
        "headers": raw_headers,
        "client": ("127.0.0.1", 12345),
        "server": ("127.0.0.1", 8000),
    }

    response_started = {}
    response_body = []

    async def receive():
        return {"type": "http.request", "body": body, "more_body": False}

    async def send(message):
        if message["type"] == "http.response.start":
            response_started["status"] = message["status"]
            response_started["headers"] = dict(message.get("headers", []))
        elif message["type"] == "http.response.body":
            response_body.append(message.get("body", b""))

    await app(scope, receive, send)

    headers = {}
    for k, v in response_started.get("headers", {}).items():
        headers[k.decode("latin1").lower()] = v.decode("latin1")

    return {
        "status_code": response_started.get("status", 500),
        "headers": headers,
        "body": b"".join(response_body).decode("utf-8", errors="replace"),
    }

async def run_tests():
    print("=" * 80)
    print("RUNNING COMBINED SERVICE DIRECT ASGI TESTS")
    print("=" * 80)
    all_passed = True

    # Dynamically find current built asset names
    assets_dir = FRONTEND_DIST / "assets"
    js_files = list(assets_dir.glob("*.js"))
    css_files = list(assets_dir.glob("*.css"))
    js_name = js_files[0].name if js_files else "index.js"
    css_name = css_files[0].name if css_files else "index.css"

    tests = [
        # 1. Root route browser access -> HTML
        ("Browser Root (/)", "GET", "/", {"accept": "text/html,application/xhtml+xml"}, 200, "text/html", "<!doctype html>"),
        
        # 2. Root route API/JSON access -> JSON
        ("API Root (/)", "GET", "/", {"accept": "application/json"}, 200, "application/json", "PricePilot AI backend running"),
        
        # 3. Static Assets: JS
        ("Static JS Asset", "GET", f"/assets/{js_name}", {}, 200, "javascript", None),
        
        # 4. Static Assets: CSS
        ("Static CSS Asset", "GET", f"/assets/{css_name}", {}, 200, "text/css", None),
        
        # 5. Root Static: favicon.svg
        ("Favicon (/favicon.svg)", "GET", "/favicon.svg", {}, 200, "svg", None),
        
        # 6. Root Static: icons.svg
        ("Icons (/icons.svg)", "GET", "/icons.svg", {}, 200, "svg", None),
        
        # 7. SPA Fallback: /login
        ("SPA Fallback (/login)", "GET", "/login", {"accept": "text/html"}, 200, "text/html", "<!doctype html>"),
        
        # 8. SPA Fallback: /admin
        ("SPA Fallback (/admin)", "GET", "/admin", {"accept": "text/html"}, 200, "text/html", "<!doctype html>"),
        
        # 9. SPA Fallback: /dashboard with browser headers
        ("SPA Fallback (/dashboard [browser])", "GET", "/dashboard", {"accept": "text/html"}, 200, "text/html", "<!doctype html>"),
        
        # 10. Dashboard API: /dashboard with Axios/JSON headers
        ("Dashboard API (/dashboard [json])", "GET", "/dashboard", {"accept": "application/json, text/plain, */*"}, 200, "application/json", "total_products"),
        
        # 11. Backend API Route (/products)
        ("Products API (/products)", "GET", "/products", {}, 200, "application/json", "elec_headphones"),
        
        # 12. Non-existent API route -> JSON 404 (NOT HTML)
        ("Unknown API 404", "GET", "/api/nonexistent-route", {}, 404, "application/json", "Endpoint not found"),
    ]

    for name, method, path, headers, expected_status, expected_mime, content_check in tests:
        resp = await asgi_request(app, method, path, headers)
        status = resp["status_code"]
        content_type = resp["headers"].get("content-type", "")
        body_text = resp["body"]

        status_ok = status == expected_status
        mime_ok = expected_mime.lower() in content_type.lower()
        body_ok = content_check is None or content_check in body_text

        passed = status_ok and mime_ok and body_ok
        if not passed:
            all_passed = False
            print(f"FAILED: {name}")
            print(f"  Status: expected {expected_status}, got {status}")
            print(f"  Content-Type: expected {expected_mime}, got {content_type}")
            if content_check and content_check not in body_text:
                print(f"  Content missing: '{content_check}'")
                print(f"  Body preview: {body_text[:200]}")
        else:
            print(f"PASSED: {name:<36} | {status} | {content_type.split(';')[0]}")

    print("=" * 80)
    if all_passed:
        print("ALL VERIFICATION TESTS PASSED SUCCESSFULLY!")
    else:
        print("SOME TESTS FAILED! Please inspect errors above.")
    print("=" * 80)
    return all_passed

if __name__ == "__main__":
    success = asyncio.run(run_tests())
    sys.exit(0 if success else 1)
