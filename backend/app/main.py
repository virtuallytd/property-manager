import logging
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.core.security import hash_password
from app.db.session import engine, SessionLocal
from app.models import Base
from app.models.user import User, UserRole
from app.api.routes import auth, admin, properties, tenancies, tenants, tickets, documents
from app.api.routes import settings as settings_routes

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def seed_admin(db):
    """Create the default admin user if no admin exists yet."""
    existing_admin = db.query(User).filter(User.role == UserRole.ADMIN).first()
    if existing_admin:
        return

    if settings.admin_password == "changeme123":
        logger.warning(
            "WARNING: Using default admin password 'changeme123'. "
            "Set ADMIN_PASSWORD environment variable to a secure password."
        )

    admin_user = User(
        email=settings.admin_email,
        username=settings.admin_username,
        hashed_password=hash_password(settings.admin_password),
        role=UserRole.ADMIN,
        is_approved=True,
        is_active=True,
    )
    db.add(admin_user)
    db.commit()
    logger.info(f"Admin user created: {settings.admin_email} / @{settings.admin_username}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        seed_admin(db)
    finally:
        db.close()
    os.makedirs(settings.upload_dir, exist_ok=True)
    yield


app = FastAPI(title="Property Manager API", version="1.0.0", lifespan=lifespan, redirect_slashes=False)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url, "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(admin.router, prefix="/api/admin", tags=["admin"])
app.include_router(properties.router, prefix="/api/properties", tags=["properties"])
app.include_router(tenancies.router, prefix="/api/properties", tags=["tenancies"])
app.include_router(documents.router, prefix="/api/properties", tags=["documents"])
app.include_router(tenants.router, prefix="/api/tenants", tags=["tenants"])
app.include_router(tickets.router, prefix="/api/tickets", tags=["tickets"])
app.include_router(settings_routes.router, prefix="/api/settings", tags=["settings"])

app.mount("/uploads", StaticFiles(directory=settings.upload_dir), name="uploads")


@app.get("/api/health")
def health():
    return {"status": "ok"}
