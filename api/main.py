from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import List, Optional
import os
from datetime import datetime
import uvicorn

# Import our data models and storage
from models import Campaign, Metric, Integration, PerformanceData
from storage import get_storage, IStorage

app = FastAPI(title="MarketPulse API", version="1.0.0")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify actual origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve static files (React build)
if os.path.exists("dist"):
    app.mount("/assets", StaticFiles(directory="dist/assets"), name="assets")

# API Routes
@app.get("/api/campaigns", response_model=List[Campaign])
async def get_campaigns(storage: IStorage = Depends(get_storage)):
    return await storage.get_campaigns()

@app.post("/api/campaigns", response_model=Campaign)
async def create_campaign(campaign: Campaign, storage: IStorage = Depends(get_storage)):
    return await storage.create_campaign(campaign)

@app.patch("/api/campaigns/{campaign_id}")
async def update_campaign(campaign_id: str, updates: dict, storage: IStorage = Depends(get_storage)):
    return await storage.update_campaign(campaign_id, updates)

@app.delete("/api/campaigns/{campaign_id}")
async def delete_campaign(campaign_id: str, storage: IStorage = Depends(get_storage)):
    return await storage.delete_campaign(campaign_id)

@app.get("/api/metrics", response_model=List[Metric])
async def get_metrics(storage: IStorage = Depends(get_storage)):
    return await storage.get_metrics()

@app.get("/api/performance", response_model=List[PerformanceData])
async def get_performance(storage: IStorage = Depends(get_storage)):
    return await storage.get_performance()

@app.get("/api/integrations", response_model=List[Integration])
async def get_integrations(storage: IStorage = Depends(get_storage)):
    return await storage.get_integrations()

@app.post("/api/integrations", response_model=Integration)
async def create_integration(integration: Integration, storage: IStorage = Depends(get_storage)):
    return await storage.create_integration(integration)

@app.patch("/api/integrations/{integration_id}")
async def update_integration(integration_id: str, updates: dict, storage: IStorage = Depends(get_storage)):
    return await storage.update_integration(integration_id, updates)

@app.delete("/api/integrations/{integration_id}")
async def delete_integration(integration_id: str, storage: IStorage = Depends(get_storage)):
    return await storage.delete_integration(integration_id)

# Health check
@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}

# Serve React app for all other routes
@app.get("/{path:path}")
async def serve_react_app(path: str):
    if os.path.exists("dist/index.html"):
        return FileResponse("dist/index.html")
    return {"message": "React app not built yet. Run 'npm run build' first."}

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=5000, reload=True)