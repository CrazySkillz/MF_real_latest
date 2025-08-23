from fastapi import FastAPI, HTTPException, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, RedirectResponse
from pydantic import BaseModel
from typing import List, Optional
import os
from datetime import datetime
import uvicorn

# Import our data models and storage
from models import Campaign, Metric, Integration, PerformanceData
from storage import get_storage, IStorage
from google_analytics import ga_service

app = FastAPI(title="PerformanceCore API", version="1.0.0")

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

# Google Analytics OAuth endpoints
@app.get("/api/auth/google/url")
async def get_google_oauth_url(state: Optional[str] = None):
    """Generate Google OAuth URL for user authentication"""
    try:
        # Set up OAuth configuration
        ga_service.client_id = os.getenv("GOOGLE_CLIENT_ID") 
        ga_service.client_secret = os.getenv("GOOGLE_CLIENT_SECRET")
        ga_service.redirect_uri = f"{os.getenv('REPLIT_DOMAINS', 'http://localhost:5000')}/api/auth/google/callback"
        
        if not ga_service.client_id:
            return {
                "error": "Google OAuth not configured",
                "setup_required": True,
                "instructions": "Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to your Replit secrets"
            }
            
        oauth_url = ga_service.get_oauth_url(state)
        return {"oauth_url": oauth_url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/auth/google/callback")
async def google_oauth_callback(
    code: Optional[str] = Query(None),
    error: Optional[str] = Query(None),
    state: Optional[str] = Query(None)
):
    """Handle Google OAuth callback"""
    if error:
        return RedirectResponse(url=f"/?error={error}")
    
    if not code:
        return RedirectResponse(url="/?error=no_code")
    
    try:
        # Exchange code for tokens
        tokens = await ga_service.exchange_code_for_tokens(code)
        
        # In a real app, store tokens securely for the user
        # For now, redirect back with success
        return RedirectResponse(url="/?google_connected=true")
        
    except Exception as e:
        return RedirectResponse(url=f"/?error={str(e)}")

@app.get("/api/analytics/accounts")
async def get_analytics_accounts(access_token: str = Query(...)):
    """Get user's Google Analytics accounts"""
    try:
        accounts = await ga_service.get_analytics_accounts(access_token)
        return {"accounts": accounts}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/api/analytics/campaigns")
async def get_analytics_campaigns(
    access_token: str = Query(...),
    view_id: str = Query(...),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None)
):
    """Get campaign data from Google Analytics"""
    try:
        campaign_data = await ga_service.get_campaign_data(
            access_token, view_id, start_date, end_date
        )
        return campaign_data
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

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