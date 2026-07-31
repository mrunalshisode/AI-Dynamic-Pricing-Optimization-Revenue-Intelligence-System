from datetime import datetime, timedelta
import pandas as pd

from fastapi import FastAPI, Depends, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from passlib.context import CryptContext
from pydantic import BaseModel
from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime
from sqlalchemy.orm import sessionmaker, declarative_base, Session

DATABASE_URL = "sqlite:///./pricepilot.db"
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
def list_products(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return db.query(Product).all()


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
    user: User = Depends(get_current_user),
):
    df = pd.read_csv(file.file)

    required_columns = {"product_name", "units_sold", "revenue", "price"}

    if not required_columns.issubset(df.columns):
        raise HTTPException(
            status_code=400,
            detail="CSV must contain product_name, units_sold, revenue, price",
        )

    for _, row in df.iterrows():
        record = SalesRecord(
            product_name=row["product_name"],
            units_sold=int(row["units_sold"]),
            revenue=float(row["revenue"]),
            price=float(row["price"]),
        )
        db.add(record)

    db.commit()

    return {
        "message": "Dataset uploaded successfully",
        "rows": len(df),
    }


@app.get("/dashboard")
def dashboard(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
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

