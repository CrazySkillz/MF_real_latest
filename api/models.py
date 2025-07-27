from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum

class CampaignStatus(str, Enum):
    ACTIVE = "active"
    PAUSED = "paused"
    COMPLETED = "completed"
    DRAFT = "draft"

class IntegrationStatus(str, Enum):
    CONNECTED = "connected"
    DISCONNECTED = "disconnected"
    ERROR = "error"

class Campaign(BaseModel):
    id: Optional[str] = None
    name: str = Field(..., min_length=1, max_length=200)
    type: str = Field(..., min_length=1)
    platform: str = Field(..., min_length=1)
    impressions: int = Field(default=0, ge=0)
    clicks: int = Field(default=0, ge=0)
    spend: str = Field(..., pattern=r'^\d+(\.\d{1,2})?$')
    status: CampaignStatus = CampaignStatus.ACTIVE
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }

class Metric(BaseModel):
    id: Optional[str] = None
    name: str = Field(..., min_length=1)
    value: str = Field(..., min_length=1)
    change: str = Field(..., min_length=1)
    period: str = Field(default="30d")
    created_at: Optional[datetime] = None

    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }

class Integration(BaseModel):
    id: Optional[str] = None
    platform: str = Field(..., min_length=1)
    status: IntegrationStatus = IntegrationStatus.DISCONNECTED
    api_key: Optional[str] = None
    account_id: Optional[str] = None
    last_sync: Optional[datetime] = None
    created_at: Optional[datetime] = None

    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }

class PerformanceData(BaseModel):
    id: Optional[str] = None
    date: str = Field(..., min_length=1)
    impressions: int = Field(default=0, ge=0)
    clicks: int = Field(default=0, ge=0)
    conversions: int = Field(default=0, ge=0)
    spend: float = Field(default=0.0, ge=0)
    revenue: float = Field(default=0.0, ge=0)
    platform: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }

# Request/Response models for API operations
class CreateCampaignRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    type: str = Field(..., min_length=1)
    platform: str = Field(..., min_length=1)
    spend: str = Field(..., pattern=r'^\d+(\.\d{1,2})?$')
    impressions: int = Field(default=0, ge=0)
    clicks: int = Field(default=0, ge=0)

class UpdateCampaignRequest(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    type: Optional[str] = Field(None, min_length=1)
    platform: Optional[str] = Field(None, min_length=1)
    spend: Optional[str] = Field(None, pattern=r'^\d+(\.\d{1,2})?$')
    impressions: Optional[int] = Field(None, ge=0)
    clicks: Optional[int] = Field(None, ge=0)
    status: Optional[CampaignStatus] = None

class CreateIntegrationRequest(BaseModel):
    platform: str = Field(..., min_length=1)
    api_key: str = Field(..., min_length=1)
    account_id: Optional[str] = None

class UpdateIntegrationRequest(BaseModel):
    status: Optional[IntegrationStatus] = None
    api_key: Optional[str] = Field(None, min_length=1)
    account_id: Optional[str] = None