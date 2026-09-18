"""
Database bridge package to allow seamless imports when running from repository root.
"""
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent / "backend"
backend_dir_str = str(BACKEND_DIR)
if backend_dir_str not in sys.path:
    sys.path.insert(0, backend_dir_str)

try:
    from backend.database import postgres, mongodb, health
except (ImportError, ModuleNotFoundError):
    pass
