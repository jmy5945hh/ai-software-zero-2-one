from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import Any
from core.security import get_current_active_user, require_any_role
from db.session import get_db
from schemas import DataResponse, DashboardOverview
from models import CustomerVisit, GiftApplication
import logging

logger = logging.getLogger("zhaocai_portal")

router = APIRouter()

@router.get("/overview", response_model=DataResponse)
async def get_dashboard_overview(
    current_user: str = Depends(require_any_role("operations_staff", "branch_manager")),
    db: Session = Depends(get_db)
) -> Any:
    """
    Get dashboard overview data
    """
    # Get total visits
    total_visits = db.query(CustomerVisit).count()
    
    # Get completed visits
    completed_visits = db.query(CustomerVisit).filter(CustomerVisit.status == "completed").count()
    
    # Get pending visits
    pending_visits = db.query(CustomerVisit).filter(CustomerVisit.status == "pending").count()
    
    # Get total gift applications
    total_gift_applications = db.query(GiftApplication).count()
    
    # Get approved gift applications
    approved_gift_applications = db.query(GiftApplication).filter(GiftApplication.application_status == "approved").count()
    
    # Get total gift expense
    approved_applications = db.query(GiftApplication).filter(GiftApplication.application_status == "approved").all()
    total_gift_expense = sum(float(app.total_amount) for app in approved_applications)
    
    # Get recent news count (placeholder - would need News model)
    recent_news_count = 0  # Placeholder - would implement based on News model
    
    overview_data = {
        "total_visits": total_visits,
        "completed_visits": completed_visits,
        "pending_visits": pending_visits,
        "total_gift_applications": total_gift_applications,
        "approved_gift_applications": approved_gift_applications,
        "total_gift_expense": total_gift_expense,
        "recent_news_count": recent_news_count
    }
    
    return DataResponse(
        success=True,
        data=overview_data,
        message="Get dashboard overview successful",
        code=200
    )


@router.get("/visit-trends", response_model=DataResponse)
async def get_visit_trends(
    time_range: str = "30d",
    group_by: str = "day",
    current_user: str = Depends(require_any_role("operations_staff", "branch_manager")),
    db: Session = Depends(get_db)
) -> Any:
    """
    Get visit trends data
    """
    # This is a simplified implementation
    # In a real application, you would query the database based on the time range and grouping
    
    # For demonstration, return sample data
    if group_by == "day":
        labels = ["2023-12-01", "2023-12-02", "2023-12-03", "2023-12-04", "2023-12-05"]
        data_values = [10, 15, 8, 12, 20]
    elif group_by == "week":
        labels = ["Week 1", "Week 2", "Week 3", "Week 4"]
        data_values = [45, 52, 38, 60]
    else:  # month
        labels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"]
        data_values = [120, 135, 110, 145, 160, 140]
    
    trends_data = {
        "labels": labels,
        "datasets": [
            {
                "label": "New Visits",
                "data": data_values
            }
        ]
    }
    
    return DataResponse(
        success=True,
        data=trends_data,
        message="Get visit trends successful",
        code=200
    )