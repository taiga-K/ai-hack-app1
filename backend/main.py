"""FastAPI application composition root."""

from fastapi import FastAPI

from app.infrastructure.config import settings
from app.presentation.routes import router

app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    debug=settings.debug,
)

app.include_router(router, prefix="/api/v1")


@app.get("/")
def root() -> dict[str, str]:
    return {"message": "AI HACK APP1 Backend API", "docs": "/docs"}
