from fastapi import HTTPException
from typing import Dict, List, Optional
import httpx
import json
from datetime import datetime, timedelta

class GoogleAnalyticsService:
    """Service for handling Google Analytics OAuth and data fetching"""
    
    def __init__(self):
        self.client_id: Optional[str] = None  # Will be set from environment or user setup
        self.client_secret: Optional[str] = None
        self.redirect_uri: Optional[str] = None
        
    def get_oauth_url(self, state: str = None) -> str:
        """Generate Google OAuth URL for user authentication"""
        if not self.client_id:
            raise HTTPException(
                status_code=400, 
                detail="Google OAuth not configured. Please set up OAuth credentials."
            )
            
        base_url = "https://accounts.google.com/o/oauth2/v2/auth"
        scopes = [
            "https://www.googleapis.com/auth/analytics.readonly",
            "https://www.googleapis.com/auth/userinfo.email"
        ]
        
        params = {
            "client_id": self.client_id or "",
            "redirect_uri": self.redirect_uri or "",
            "scope": " ".join(scopes),
            "response_type": "code",
            "access_type": "offline",
            "prompt": "select_account",  # Always show account picker
            "include_granted_scopes": "true"
        }
        
        if state:
            params["state"] = state
            
        query_string = "&".join([f"{k}={v}" for k, v in params.items() if v])
        return f"{base_url}?{query_string}"
    
    async def exchange_code_for_tokens(self, auth_code: str) -> Dict:
        """Exchange authorization code for access and refresh tokens"""
        if not self.client_id or not self.client_secret:
            raise HTTPException(
                status_code=400,
                detail="Google OAuth credentials not configured"
            )
            
        token_url = "https://oauth2.googleapis.com/token"
        data = {
            "client_id": self.client_id or "",
            "client_secret": self.client_secret or "",
            "code": auth_code,
            "grant_type": "authorization_code",
            "redirect_uri": self.redirect_uri or ""
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.post(token_url, data=data)
            
        if response.status_code != 200:
            raise HTTPException(
                status_code=400,
                detail=f"Failed to exchange code for tokens: {response.text}"
            )
            
        return response.json()
    
    async def get_analytics_accounts(self, access_token: str) -> List[Dict]:
        """Fetch user's Google Analytics accounts"""
        url = "https://analyticsreporting.googleapis.com/v4/reports:batchGet"
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json"
        }
        
        # First, get account summaries
        management_url = "https://www.googleapis.com/analytics/v3/management/accountSummaries"
        
        async with httpx.AsyncClient() as client:
            response = await client.get(management_url, headers=headers)
            
        if response.status_code != 200:
            raise HTTPException(
                status_code=400,
                detail=f"Failed to fetch Analytics accounts: {response.text}"
            )
            
        return response.json().get("items", [])
    
    async def get_campaign_data(
        self, 
        access_token: str, 
        view_id: str,
        start_date: str = None,
        end_date: str = None
    ) -> Dict:
        """Fetch campaign performance data from Google Analytics"""
        if not start_date:
            start_date = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
        if not end_date:
            end_date = datetime.now().strftime("%Y-%m-%d")
            
        url = "https://analyticsreporting.googleapis.com/v4/reports:batchGet"
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json"
        }
        
        # Request campaign performance metrics
        request_body = {
            "reportRequests": [{
                "viewId": view_id,
                "dateRanges": [{
                    "startDate": start_date,
                    "endDate": end_date
                }],
                "metrics": [
                    {"expression": "ga:sessions"},
                    {"expression": "ga:users"},
                    {"expression": "ga:pageviews"},
                    {"expression": "ga:bounceRate"},
                    {"expression": "ga:avgSessionDuration"}
                ],
                "dimensions": [
                    {"name": "ga:source"},
                    {"name": "ga:medium"},
                    {"name": "ga:campaign"}
                ],
                "orderBys": [{
                    "fieldName": "ga:sessions",
                    "sortOrder": "DESCENDING"
                }]
            }]
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.post(url, headers=headers, json=request_body)
            
        if response.status_code != 200:
            raise HTTPException(
                status_code=400,
                detail=f"Failed to fetch campaign data: {response.text}"
            )
            
        return self._parse_analytics_response(response.json())
    
    def _parse_analytics_response(self, response_data: Dict) -> Dict:
        """Parse Google Analytics API response into structured campaign data"""
        reports = response_data.get("reports", [])
        if not reports:
            return {"campaigns": [], "total_metrics": {}}
            
        report = reports[0]
        rows = report.get("data", {}).get("rows", [])
        
        campaigns = []
        total_sessions = 0
        total_users = 0
        total_pageviews = 0
        
        for row in rows:
            dimensions = row.get("dimensions", [])
            metrics = row.get("metrics", [{}])[0].get("values", [])
            
            if len(dimensions) >= 3 and len(metrics) >= 5:
                source = dimensions[0]
                medium = dimensions[1] 
                campaign_name = dimensions[2]
                
                sessions = int(metrics[0]) if metrics[0].isdigit() else 0
                users = int(metrics[1]) if metrics[1].isdigit() else 0
                pageviews = int(metrics[2]) if metrics[2].isdigit() else 0
                bounce_rate = float(metrics[3]) if metrics[3].replace('.', '').isdigit() else 0
                avg_duration = float(metrics[4]) if metrics[4].replace('.', '').isdigit() else 0
                
                campaigns.append({
                    "name": campaign_name,
                    "source": source,
                    "medium": medium,
                    "sessions": sessions,
                    "users": users,
                    "pageviews": pageviews,
                    "bounce_rate": bounce_rate,
                    "avg_session_duration": avg_duration
                })
                
                total_sessions += sessions
                total_users += users
                total_pageviews += pageviews
        
        return {
            "campaigns": campaigns,
            "total_metrics": {
                "total_sessions": total_sessions,
                "total_users": total_users,
                "total_pageviews": total_pageviews
            }
        }

# Global service instance
ga_service = GoogleAnalyticsService()