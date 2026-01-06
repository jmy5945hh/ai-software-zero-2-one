from fastapi import APIRouter
from api.v1.endpoints import auth, users, customer_visits, gift_management, dashboard, ai, content

api_router = APIRouter()

# Include all API routers
api_router.include_router(auth.router, tags=["auth"])
api_router.include_router(users.router, tags=["users"])
api_router.include_router(customer_visits.router, tags=["customer-visits"])
api_router.include_router(gift_management.router, tags=["gift-management"])
api_router.include_router(dashboard.router, tags=["dashboard"])
api_router.include_router(ai.router, tags=["ai"])
api_router.include_router(content.router, tags=["content"])