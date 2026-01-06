from sqlalchemy.orm import Session
from models import CustomerVisit, GiftApplication


class DashboardService:
    @staticmethod
    def get_dashboard_overview(db: Session):
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
        
        return {
            "total_visits": total_visits,
            "completed_visits": completed_visits,
            "pending_visits": pending_visits,
            "total_gift_applications": total_gift_applications,
            "approved_gift_applications": approved_gift_applications,
            "total_gift_expense": total_gift_expense,
            "recent_news_count": recent_news_count
        }
    
    @staticmethod
    def get_visit_trends(time_range: str = "30d", group_by: str = "day"):
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
        
        return {
            "labels": labels,
            "datasets": [
                {
                    "label": "New Visits",
                    "data": data_values
                }
            ]
        }