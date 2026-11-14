import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import settings, UPLOAD_DIR, OUTPUT_DIR, SAMPLE_DIR
from app.api import images, videos, history, auth, system
from app.services.sample_generator import generate_sample_media

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: ensure demo samples are generated
    try:
        generate_sample_media()
        print("CleanFrame AI backend initialized with sample media.")
    except Exception as e:
        print(f"Sample generation warning: {e}")
    yield

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Intelligent AI-Powered Video & Image Watermark Cleaner API",
    lifespan=lifespan
)

# CORS middleware configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static file directories for media serving
app.mount("/api/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")
app.mount("/api/outputs", StaticFiles(directory=str(OUTPUT_DIR)), name="outputs")
app.mount("/api/sample_media", StaticFiles(directory=str(SAMPLE_DIR)), name="sample_media")

# Include API routers
app.include_router(images.router, prefix=settings.API_PREFIX)
app.include_router(videos.router, prefix=settings.API_PREFIX)
app.include_router(history.router, prefix=settings.API_PREFIX)
app.include_router(auth.router, prefix=settings.API_PREFIX)
app.include_router(system.router, prefix=settings.API_PREFIX)

@app.get("/")
async def root():
    return {
        "name": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "docs_url": "/docs",
        "status": "online"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="127.0.0.1", port=8005, reload=True)
