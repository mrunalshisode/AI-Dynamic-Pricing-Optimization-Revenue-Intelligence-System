"""
Bridge module for database.postgres to resolve to backend.database.postgres
"""
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent / "backend"
backend_dir_str = str(BACKEND_DIR)
if backend_dir_str not in sys.path:
    sys.path.insert(0, backend_dir_str)

from backend.database.postgres import *
from backend.database.postgres import POSTGRES_URL, engine, SessionLocal, Base, test_connection
