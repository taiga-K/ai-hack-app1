"""FastAPI application composition root."""

from fastapi import FastAPI

from app.infrastructure.config import settings
from app.presentation.api.v1.websocket import router as websocket_router
from app.presentation.routes import router

app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    debug=settings.debug,
)

app.include_router(router, prefix="/api/v1")
app.include_router(websocket_router)


@app.get("/")
def root() -> dict[str, str]:
    return {"message": "AI HACK APP1 Backend API", "docs": "/docs"}
