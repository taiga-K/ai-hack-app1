"""Presentation API v1 package."""

from app.presentation.api.v1.websocket import router as websocket_router

__all__ = ["websocket_router"]
