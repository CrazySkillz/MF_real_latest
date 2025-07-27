from abc import ABC, abstractmethod
from typing import List, Optional, Dict, Any
from models import Campaign, Metric, Integration, PerformanceData, CampaignStatus, IntegrationStatus
from datetime import datetime
import uuid

class IStorage(ABC):
    @abstractmethod
    async def get_campaigns(self) -> List[Campaign]:
        pass
    
    @abstractmethod
    async def create_campaign(self, campaign: Campaign) -> Campaign:
        pass
    
    @abstractmethod
    async def update_campaign(self, campaign_id: str, updates: Dict[str, Any]) -> Campaign:
        pass
    
    @abstractmethod
    async def delete_campaign(self, campaign_id: str) -> bool:
        pass
    
    @abstractmethod
    async def get_metrics(self) -> List[Metric]:
        pass
    
    @abstractmethod
    async def get_performance(self) -> List[PerformanceData]:
        pass
    
    @abstractmethod
    async def get_integrations(self) -> List[Integration]:
        pass
    
    @abstractmethod
    async def create_integration(self, integration: Integration) -> Integration:
        pass
    
    @abstractmethod
    async def update_integration(self, integration_id: str, updates: Dict[str, Any]) -> Integration:
        pass
    
    @abstractmethod
    async def delete_integration(self, integration_id: str) -> bool:
        pass

class MemoryStorage(IStorage):
    def __init__(self):
        self.campaigns: List[Campaign] = [
            Campaign(
                id="1",
                name="Summer Sale Campaign",
                type="conversions",
                platform="Facebook",
                impressions=15420,
                clicks=892,
                spend="456.78",
                status=CampaignStatus.ACTIVE,
                created_at=datetime.now()
            ),
            Campaign(
                id="2", 
                name="Brand Awareness Push",
                type="awareness",
                platform="Google Ads",
                impressions=28900,
                clicks=1245,
                spend="789.50",
                status=CampaignStatus.ACTIVE,
                created_at=datetime.now()
            ),
            Campaign(
                id="3",
                name="Retargeting Campaign",
                type="conversions", 
                platform="LinkedIn",
                impressions=8750,
                clicks=425,
                spend="234.25",
                status=CampaignStatus.PAUSED,
                created_at=datetime.now()
            )
        ]
        
        self.metrics: List[Metric] = [
            Metric(
                id="1",
                name="Total Impressions",
                value="324,567",
                change="+12.5%",
                period="30d",
                created_at=datetime.now()
            ),
            Metric(
                id="2",
                name="Total Clicks", 
                value="18,923",
                change="+8.3%",
                period="30d",
                created_at=datetime.now()
            ),
            Metric(
                id="3",
                name="Conversion Rate",
                value="4.2%",
                change="-2.1%", 
                period="30d",
                created_at=datetime.now()
            ),
            Metric(
                id="4",
                name="Cost Per Click",
                value="$2.34",
                change="-5.8%",
                period="30d", 
                created_at=datetime.now()
            )
        ]
        
        self.performance_data: List[PerformanceData] = [
            PerformanceData(
                id="1",
                date="2024-01-01",
                impressions=45000,
                clicks=2200,
                conversions=180,
                spend=1200.0,
                revenue=5400.0,
                platform="Facebook",
                created_at=datetime.now()
            ),
            PerformanceData(
                id="2",
                date="2024-01-02", 
                impressions=52000,
                clicks=2800,
                conversions=220,
                spend=1450.0,
                revenue=6200.0,
                platform="Google Ads",
                created_at=datetime.now()
            ),
            PerformanceData(
                id="3",
                date="2024-01-03",
                impressions=48000,
                clicks=2500,
                conversions=195,
                spend=1300.0,
                revenue=5850.0,
                platform="LinkedIn",
                created_at=datetime.now()
            )
        ]
        
        self.integrations: List[Integration] = [
            Integration(
                id="1",
                platform="Facebook",
                status=IntegrationStatus.CONNECTED,
                account_id="fb_account_123",
                last_sync=datetime.now(),
                created_at=datetime.now()
            ),
            Integration(
                id="2",
                platform="Google Ads",
                status=IntegrationStatus.CONNECTED, 
                account_id="ga_account_456",
                last_sync=datetime.now(),
                created_at=datetime.now()
            ),
            Integration(
                id="3",
                platform="LinkedIn",
                status=IntegrationStatus.DISCONNECTED,
                created_at=datetime.now()
            ),
            Integration(
                id="4",
                platform="Twitter",
                status=IntegrationStatus.ERROR,
                created_at=datetime.now()
            )
        ]

    async def get_campaigns(self) -> List[Campaign]:
        return self.campaigns
    
    async def create_campaign(self, campaign: Campaign) -> Campaign:
        campaign = Campaign(
            id=str(uuid.uuid4()),
            name=campaign.name,
            type=campaign.type,
            platform=campaign.platform,
            impressions=campaign.impressions,
            clicks=campaign.clicks,
            spend=campaign.spend,
            status=campaign.status,
            created_at=datetime.now(),
            updated_at=datetime.now()
        )
        self.campaigns.append(campaign)
        return campaign
    
    async def update_campaign(self, campaign_id: str, updates: Dict[str, Any]) -> Campaign:
        for i, campaign in enumerate(self.campaigns):
            if campaign.id == campaign_id:
                # Update fields
                for key, value in updates.items():
                    if hasattr(campaign, key):
                        setattr(campaign, key, value)
                campaign.updated_at = datetime.now()
                self.campaigns[i] = campaign
                return campaign
        raise ValueError(f"Campaign with id {campaign_id} not found")
    
    async def delete_campaign(self, campaign_id: str) -> bool:
        for i, campaign in enumerate(self.campaigns):
            if campaign.id == campaign_id:
                del self.campaigns[i]
                return True
        return False
    
    async def get_metrics(self) -> List[Metric]:
        return self.metrics
    
    async def get_performance(self) -> List[PerformanceData]:
        return self.performance_data
    
    async def get_integrations(self) -> List[Integration]:
        return self.integrations
    
    async def create_integration(self, integration: Integration) -> Integration:
        integration = Integration(
            id=str(uuid.uuid4()),
            platform=integration.platform,
            status=integration.status,
            api_key=integration.api_key,
            account_id=integration.account_id,
            created_at=datetime.now()
        )
        self.integrations.append(integration)
        return integration
    
    async def update_integration(self, integration_id: str, updates: Dict[str, Any]) -> Integration:
        for i, integration in enumerate(self.integrations):
            if integration.id == integration_id:
                # Update fields
                for key, value in updates.items():
                    if hasattr(integration, key):
                        setattr(integration, key, value)
                if 'status' in updates and updates['status'] == 'connected':
                    integration.last_sync = datetime.now()
                self.integrations[i] = integration
                return integration
        raise ValueError(f"Integration with id {integration_id} not found")
    
    async def delete_integration(self, integration_id: str) -> bool:
        for i, integration in enumerate(self.integrations):
            if integration.id == integration_id:
                del self.integrations[i]
                return True
        return False

# Global storage instance
_storage = MemoryStorage()

def get_storage() -> IStorage:
    return _storage