from datetime import datetime, timedelta
from pathlib import Path

import pandas as pd

from fastapi import FastAPI, Depends, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from passlib.context import CryptContext
from pydantic import BaseModel
from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime
from sqlalchemy.orm import sessionmaker, declarative_base, Session

BASE_DIR = Path(__file__).resolve().parent.parent
DATABASE_URL = f"sqlite:///{BASE_DIR / 'pricepilot.db'}"
SECRET_KEY = "change-this-secret-key"
ALGORITHM = "HS256"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(bind=engine)
Base = declarative_base()

app = FastAPI(title="PricePilot AI API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
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


def seed_initial_data(db: Session):
    if db.query(Product).count() == 0:
        for product_data in INITIAL_PRODUCTS:
            db.add(Product(**product_data))
        db.commit()

    if db.query(SalesRecord).count() == 0:
        for sale_data in INITIAL_SALES:
            db.add(SalesRecord(**sale_data))
        db.commit()

    if db.query(User).count() == 0:
        demo_user = User(
            name="Admin User",
            email="admin@revenueiq.com",
            password_hash=hash_password("admin123"),
            role="manager",
        )
        db.add(demo_user)
        db.commit()


class RegisterRequest(BaseModel):
    name: str
    email: str
    password: str
    role: str = "manager"


class LoginRequest(BaseModel):
    email: str
    password: str


class ProductRequest(BaseModel):
    name: str
    category: str
    current_price: float
    cost_price: float
    stock: int


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

    user = User(
        name=data.name,
        email=data.email,
        password_hash=hash_password(data.password),
        role=data.role,
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