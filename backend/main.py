import os
from datetime import datetime, timedelta
from pathlib import Path

import pandas as pd
import requests

from fastapi import FastAPI, Depends, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from passlib.context import CryptContext
from pydantic import BaseModel, Field
from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime
from sqlalchemy.orm import sessionmaker, declarative_base, Session

BASE_DIR = Path(__file__).resolve().parent.parent
BACKEND_DIR = Path(__file__).resolve().parent
DATABASE_URL = f"sqlite:///{BASE_DIR / 'pricepilot.db'}"
SECRET_KEY = "change-this-secret-key"
ALGORITHM = "HS256"
ALLOWED_ROLES = {"pricing manager", "business analyst", "user"}


def load_env_file():
    env_path = BACKEND_DIR / ".env"
    if not env_path.exists():
        return

    for line in env_path.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue
        key, value = stripped.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


load_env_file()
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(bind=engine)
Base = declarative_base()

app = FastAPI(title="PricePilot AI API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "http://0.0.0.0:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    name = Column(String)
    email = Column(String, unique=True, index=True)
    password_hash = Column(String)
    role = Column(String, default="manager")


class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True)
    name = Column(String)
    category = Column(String)
    current_price = Column(Float)
    cost_price = Column(Float)
    stock = Column(Integer)
    created_at = Column(DateTime, default=datetime.utcnow)


class SalesRecord(Base):
    __tablename__ = "sales_records"

    id = Column(Integer, primary_key=True)
    product_name = Column(String)
    units_sold = Column(Integer)
    revenue = Column(Float)
    price = Column(Float)


Base.metadata.create_all(bind=engine)

INITIAL_PRODUCTS = [
    {"name": "Wireless Headphones", "category": "Audio", "current_price": 1999.0, "cost_price": 1299.0, "stock": 85},
    {"name": "Smartwatch", "category": "Wearables", "current_price": 3499.0, "cost_price": 2299.0, "stock": 64},
    {"name": "Bluetooth Speaker", "category": "Audio", "current_price": 1499.0, "cost_price": 899.0, "stock": 92},
    {"name": "Gaming Mouse", "category": "Peripherals", "current_price": 1199.0, "cost_price": 699.0, "stock": 120},
    {"name": "Mechanical Keyboard", "category": "Peripherals", "current_price": 2499.0, "cost_price": 1599.0, "stock": 78},
    {"name": "4K Monitor", "category": "Displays", "current_price": 18999.0, "cost_price": 12999.0, "stock": 47},
    {"name": "Laptop", "category": "Computers", "current_price": 59999.0, "cost_price": 44999.0, "stock": 36},
    {"name": "Smartphone", "category": "Mobiles", "current_price": 39999.0, "cost_price": 29999.0, "stock": 55},
    {"name": "Tablet", "category": "Mobiles", "current_price": 27999.0, "cost_price": 19999.0, "stock": 41},
    {"name": "Webcam", "category": "Accessories", "current_price": 3499.0, "cost_price": 2299.0, "stock": 70},
    {"name": "External SSD", "category": "Storage", "current_price": 8999.0, "cost_price": 5999.0, "stock": 63},
    {"name": "Portable Charger", "category": "Accessories", "current_price": 1999.0, "cost_price": 1199.0, "stock": 88},
    {"name": "Smart Lamp", "category": "Home", "current_price": 2999.0, "cost_price": 1899.0, "stock": 52},
    {"name": "Fitness Band", "category": "Wearables", "current_price": 2499.0, "cost_price": 1499.0, "stock": 74},
    {"name": "Noise-Canceling Earbuds", "category": "Audio", "current_price": 2999.0, "cost_price": 1799.0, "stock": 91},
]

INITIAL_SALES = [
    {"product_name": "Wireless Headphones", "units_sold": 48, "revenue": 95952.0, "price": 1999.0},
    {"product_name": "Smartwatch", "units_sold": 36, "revenue": 125964.0, "price": 3499.0},
    {"product_name": "Bluetooth Speaker", "units_sold": 54, "revenue": 80946.0, "price": 1499.0},
    {"product_name": "Gaming Mouse", "units_sold": 72, "revenue": 86328.0, "price": 1199.0},
    {"product_name": "Mechanical Keyboard", "units_sold": 41, "revenue": 102459.0, "price": 2499.0},
    {"product_name": "4K Monitor", "units_sold": 27, "revenue": 512973.0, "price": 18999.0},
    {"product_name": "Laptop", "units_sold": 19, "revenue": 1_139_981.0, "price": 59999.0},
    {"product_name": "Smartphone", "units_sold": 33, "revenue": 1_319_967.0, "price": 39999.0},
    {"product_name": "Tablet", "units_sold": 22, "revenue": 615_978.0, "price": 27999.0},
    {"product_name": "Webcam", "units_sold": 60, "revenue": 209_940.0, "price": 3499.0},
    {"product_name": "External SSD", "units_sold": 28, "revenue": 251_972.0, "price": 8999.0},
    {"product_name": "Portable Charger", "units_sold": 67, "revenue": 133_933.0, "price": 1999.0},
    {"product_name": "Smart Lamp", "units_sold": 31, "revenue": 92_969.0, "price": 2999.0},
    {"product_name": "Fitness Band", "units_sold": 45, "revenue": 112_455.0, "price": 2499.0},
    {"product_name": "Noise-Canceling Earbuds", "units_sold": 58, "revenue": 173_942.0, "price": 2999.0},
]


def normalize_role(role: str) -> str:
    normalized = (role or "pricing manager").strip().lower()

    if normalized in {"manager", "pricing_manager", "pricing manager"}:
        return "pricing manager"
    if normalized in {"business_analyst", "business analyst", "analyst"}:
        return "business analyst"
    if normalized in {"user", "customer", "end_user", "end user"}:
        return "user"

    return "pricing manager"


def seed_initial_data(db: Session):
    if db.query(Product).count() == 0:
        for product_data in INITIAL_PRODUCTS:
            db.add(Product(**product_data))
        db.commit()

    if db.query(SalesRecord).count() == 0:
        for sale_data in INITIAL_SALES:
            db.add(SalesRecord(**sale_data))
        db.commit()

    demo_users = [
        {
            "name": "Pricing Manager",
            "email": "admin@revenueiq.com",
            "password": "admin123",
            "role": "pricing manager",
        },
        {
            "name": "Business Analyst",
            "email": "analyst@revenueiq.com",
            "password": "analyst123",
            "role": "business analyst",
        },
        {
            "name": "Standard User",
            "email": "user@revenueiq.com",
            "password": "user123",
            "role": "user",
        },
    ]

    for demo_user in demo_users:
        existing = db.query(User).filter(User.email == demo_user["email"]).first()
        if existing is None:
            db.add(
                User(
                    name=demo_user["name"],
                    email=demo_user["email"],
                    password_hash=hash_password(demo_user["password"]),
                    role=normalize_role(demo_user["role"]),
                )
            )
        else:
            existing.name = demo_user["name"]
            existing.role = normalize_role(demo_user["role"])
            existing.password_hash = hash_password(demo_user["password"])

    db.commit()


class RegisterRequest(BaseModel):
    name: str
    email: str
    password: str
    role: str = "manager"


class LoginRequest(BaseModel):
    email: str
    password: str


class GoogleAuthRequest(BaseModel):
    credential: str = ""
    email: str = ""
    name: str = ""
    role: str = "user"


class ProductRequest(BaseModel):
    name: str = Field(min_length=1)
    category: str = Field(min_length=1)
    current_price: float = Field(ge=0)
    cost_price: float = Field(ge=0)
    stock: int = Field(ge=0)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def to_dict(instance):
    return {column.name: getattr(instance, column.name) for column in instance.__table__.columns}


def hash_password(password):
    return pwd_context.hash(password)


def verify_password(password, password_hash):
    return pwd_context.verify(password, password_hash)


def create_token(data: dict):
    payload = data.copy()
    payload["exp"] = datetime.utcnow() + timedelta(hours=8)
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def verify_google_token(credential: str):
    if not credential:
        return None

    try:
        response = requests.get(
            f"https://oauth2.googleapis.com/tokeninfo?id_token={credential}",
            timeout=5,
        )
    except requests.RequestException:
        return None

    if response.status_code != 200:
        return None

    payload = response.json()

    if GOOGLE_CLIENT_ID and payload.get("aud") not in {GOOGLE_CLIENT_ID, None}:
        return None

    return payload


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email = payload.get("sub")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

    user = db.query(User).filter(User.email == email).first()

    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    return user


@app.on_event("startup")
def initialize_database():
    db = SessionLocal()
    try:
        seed_initial_data(db)
    finally:
        db.close()


@app.get("/")
def home():
    return {"message": "PricePilot AI backend running"}


@app.post("/auth/register")
def register(data: RegisterRequest, db: Session = Depends(get_db)):
    existing_user = db.query(User).filter(User.email == data.email).first()

    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")

    role = normalize_role(data.role)
    user = User(
        name=data.name,
        email=data.email,
        password_hash=hash_password(data.password),
        role=role,
    )

    db.add(user)
    db.commit()

    return {"message": "User registered successfully"}


@app.post("/auth/login")
def login(data: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == data.email).first()

    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_token({"sub": user.email, "role": user.role})

    return {
        "access_token": token,
        "token_type": "bearer",
        "role": user.role,
    }


@app.post("/auth/google")
def google_login(data: GoogleAuthRequest, db: Session = Depends(get_db)):
    payload = verify_google_token(data.credential)

    if payload:
        email = payload.get("email")
        name = payload.get("name") or data.name or (email.split("@", 1)[0] if email else "Google User")
    else:
        email = data.email
        name = data.name or (email.split("@", 1)[0] if email else "Google User")

    if not email:
        raise HTTPException(status_code=400, detail="Google email is required")

    role = normalize_role(data.role)
    user = db.query(User).filter(User.email == email).first()

    if not user:
        user = User(
            name=name,
            email=email,
            password_hash=hash_password(os.urandom(16).hex()),
            role=role,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    else:
        user.name = name or user.name
        user.role = role
        db.commit()

    token = create_token({"sub": user.email, "role": user.role})

    return {
        "access_token": token,
        "token_type": "bearer",
        "role": user.role,
        "user_name": user.name,
    }


@app.post("/products")
def create_product(
    data: ProductRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    product = Product(**data.dict())

    db.add(product)
    db.commit()
    db.refresh(product)

    return product


@app.get("/products")
def list_products(db: Session = Depends(get_db)):
    products = db.query(Product).all()
    return [to_dict(product) for product in products]


@app.get("/sales")
def get_sales(db: Session = Depends(get_db)):
    sales = db.query(SalesRecord).all()
    return [to_dict(record) for record in sales]


@app.get("/sales/count")
def get_sales_count(db: Session = Depends(get_db)):
    return {"sales_count": db.query(SalesRecord).count()}


@app.get("/sales/sample")
def get_sales_sample(db: Session = Depends(get_db)):
    sales = db.query(SalesRecord).order_by(SalesRecord.id).limit(10).all()
    return [to_dict(record) for record in sales]


@app.put("/products/{product_id}")
def update_product(
    product_id: int,
    data: ProductRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    product = db.query(Product).filter(Product.id == product_id).first()

    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    product.name = data.name
    product.category = data.category
    product.current_price = data.current_price
    product.cost_price = data.cost_price
    product.stock = data.stock

    db.commit()
    db.refresh(product)

    return product


@app.delete("/products/{product_id}")
def delete_product(
    product_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    product = db.query(Product).filter(Product.id == product_id).first()

    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    db.delete(product)
    db.commit()

    return {"message": "Product deleted"}


@app.post("/datasets/upload-sales")
def upload_sales_dataset(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    df = pd.read_csv(file.file)

    # Support both the original schema and common retail CSV columns
    required_columns = {"product_name", "price", "quantity_sold"}
    if not required_columns.issubset(df.columns):
        raise HTTPException(
            status_code=400,
            detail="CSV must contain product_name, price, quantity_sold",
        )

    for _, row in df.iterrows():
        product_name = row["product_name"]
        price = float(row["price"])
        units_sold = int(row.get("quantity_sold", row.get("units_sold", 0)))
        revenue = float(row.get("revenue", price * units_sold))

        record = SalesRecord(
            product_name=product_name,
            units_sold=units_sold,
            revenue=revenue,
            price=price,
        )
        db.add(record)

    db.commit()

    return {
        "message": "Dataset uploaded successfully",
        "rows": len(df),
    }


@app.get("/dashboard")
def dashboard(db: Session = Depends(get_db)):
    products = db.query(Product).all()
    sales = db.query(SalesRecord).all()

    total_revenue = sum(s.revenue for s in sales)
    total_units = sum(s.units_sold for s in sales)

    if products:
        average_price = sum(p.current_price for p in products) / len(products)
    else:
        average_price = 0

    return {
        "total_products": len(products),
        "total_revenue": total_revenue,
        "total_units_sold": total_units,
        "average_product_price": round(average_price, 2),
    }