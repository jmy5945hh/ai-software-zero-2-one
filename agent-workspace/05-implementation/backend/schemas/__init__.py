from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, date
from uuid import UUID


# User schemas
class UserBase(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    real_name: str = Field(..., min_length=1, max_length=100)
    department: Optional[str] = Field(None, max_length=100)
    role: str = Field(..., pattern=r"^(customer_manager|operations_staff|approver|branch_manager)$")
    email: Optional[str] = Field(None, max_length=100)
    phone: Optional[str] = Field(None, max_length=20)


class UserCreate(UserBase):
    password: str = Field(..., min_length=6)


class UserUpdate(BaseModel):
    real_name: Optional[str] = Field(None, min_length=1, max_length=100)
    department: Optional[str] = Field(None, max_length=100)
    role: Optional[str] = Field(None, pattern=r"^(customer_manager|operations_staff|approver|branch_manager)$")
    email: Optional[str] = Field(None, max_length=100)
    phone: Optional[str] = Field(None, max_length=20)
    status: Optional[str] = Field(None, pattern=r"^(active|inactive)$")


class UserInDB(UserBase):
    user_id: UUID
    status: str = Field(..., pattern=r"^(active|inactive)$")
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class User(UserInDB):
    pass


# Token schemas
class Token(BaseModel):
    access_token: str
    token_type: str


class TokenData(BaseModel):
    user_id: Optional[str] = None


# Customer Visit schemas
class CustomerVisitBase(BaseModel):
    customer_id: str = Field(..., min_length=1, max_length=50)
    customer_name: str = Field(..., min_length=1, max_length=200)
    planned_date: date
    visit_method: str = Field(..., pattern=r"^(phone|face_to_face|video)$")
    products_interested: Optional[List[str]] = []
    participants: Optional[List[str]] = []
    status: str = Field(default="pending", pattern=r"^(pending|completed|cancelled)$")
    visit_notes: Optional[str] = Field(None, max_length=1000)


class CustomerVisitCreate(CustomerVisitBase):
    pass


class CustomerVisitUpdate(BaseModel):
    customer_name: Optional[str] = Field(None, min_length=1, max_length=200)
    planned_date: Optional[date] = None
    actual_date: Optional[date] = None
    visit_method: Optional[str] = Field(None, pattern=r"^(phone|face_to_face|video)$")
    products_interested: Optional[List[str]] = None
    participants: Optional[List[str]] = None
    status: Optional[str] = Field(None, pattern=r"^(pending|completed|cancelled)$")
    visit_notes: Optional[str] = Field(None, max_length=1000)


class CustomerVisitInDB(CustomerVisitBase):
    visit_id: UUID
    creator_id: UUID
    creator_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class CustomerVisit(CustomerVisitInDB):
    pass


# Gift Application schemas
class GiftItem(BaseModel):
    gift_id: str = Field(..., min_length=1)
    name: str = Field(..., min_length=1, max_length=200)
    quantity: int = Field(..., ge=1)
    unit_price: float = Field(..., ge=0)


class GiftApplicationBase(BaseModel):
    recipient_id: Optional[UUID] = None
    gift_items: List[GiftItem]
    planned_pickup_date: date
    purpose_type: str = Field(..., pattern=r"^(customer_maintenance|marketing_activity|other)$")
    related_visit_id: Optional[UUID] = None


class GiftApplicationCreate(GiftApplicationBase):
    pass


class GiftApplicationUpdate(BaseModel):
    recipient_id: Optional[UUID] = None
    planned_pickup_date: Optional[date] = None
    purpose_type: Optional[str] = Field(None, pattern=r"^(customer_maintenance|marketing_activity|other)$")
    related_visit_id: Optional[UUID] = None


class GiftApplicationApproval(BaseModel):
    approval_notes: Optional[str] = Field(None, max_length=500)


class GiftApplicationRejection(BaseModel):
    rejection_reason: str = Field(..., min_length=10, max_length=500)


class GiftApplicationInDB(GiftApplicationBase):
    application_id: UUID
    applicant_id: UUID
    applicant_name: Optional[str] = None
    recipient_name: Optional[str] = None
    total_amount: float
    application_status: str = Field(..., pattern=r"^(pending|approved|rejected|cancelled)$")
    application_date: date
    approver_id: Optional[UUID] = None
    approver_name: Optional[str] = None
    approval_date: Optional[datetime] = None
    rejection_reason: Optional[str] = Field(None, max_length=500)
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class GiftApplication(GiftApplicationInDB):
    pass


# Gift Ledger schemas
class GiftLedgerBase(BaseModel):
    gift_application_id: UUID
    gift_type: str = Field(..., min_length=1, max_length=100)
    gift_name: str = Field(..., min_length=1, max_length=200)
    quantity: int = Field(..., ge=1)
    unit_price: float = Field(..., ge=0)
    total_price: float = Field(..., ge=0)
    pickup_date: Optional[date] = None
    pickup_person: Optional[str] = Field(None, max_length=100)
    purpose: Optional[str] = Field(None, max_length=500)
    status: str = Field(default="pending", pattern=r"^(picked_up|cancelled|pending)$")


class GiftLedgerCreate(GiftLedgerBase):
    pass


class GiftLedgerUpdate(BaseModel):
    pickup_date: Optional[date] = None
    pickup_person: Optional[str] = Field(None, max_length=100)
    purpose: Optional[str] = Field(None, max_length=500)
    status: Optional[str] = Field(None, pattern=r"^(picked_up|cancelled|pending)$")


class GiftLedgerInDB(GiftLedgerBase):
    ledger_id: UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class GiftLedger(GiftLedgerInDB):
    pass


# Homepage Carousel schemas
class HomepageCarouselBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    image_url: str = Field(..., min_length=1, max_length=500)
    link_url: Optional[str] = Field(None, max_length=500)
    sort_order: int = Field(default=0, ge=0)
    is_active: bool = Field(default=True)


class HomepageCarouselCreate(HomepageCarouselBase):
    pass


class HomepageCarouselUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    image_url: Optional[str] = Field(None, min_length=1, max_length=500)
    link_url: Optional[str] = Field(None, max_length=500)
    sort_order: Optional[int] = Field(None, ge=0)
    is_active: Optional[bool] = None


class HomepageCarouselInDB(HomepageCarouselBase):
    carousel_id: UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class HomepageCarousel(HomepageCarouselInDB):
    pass


# News schemas
class NewsBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    content: str
    summary: Optional[str] = Field(None, max_length=500)
    status: str = Field(default="draft", pattern=r"^(draft|published|unpublished)$")


class NewsCreate(NewsBase):
    pass


class NewsUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    content: Optional[str] = None
    summary: Optional[str] = Field(None, max_length=500)
    status: Optional[str] = Field(None, pattern=r"^(draft|published|unpublished)$")


class NewsInDB(NewsBase):
    news_id: UUID
    author_id: UUID
    publish_date: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class News(NewsInDB):
    pass


# AI Question schemas
class AIQuestionBase(BaseModel):
    question: str = Field(..., min_length=1)
    answer: str = Field(..., min_length=1)
    session_id: str = Field(..., min_length=1, max_length=100)


class AIQuestionCreate(AIQuestionBase):
    pass


class AIQuestionInDB(AIQuestionBase):
    question_id: UUID
    user_id: UUID
    question_time: datetime
    created_at: datetime

    class Config:
        from_attributes = True


class AIQuestion(AIQuestionInDB):
    pass


# Response schemas
class BaseResponse(BaseModel):
    success: bool
    message: str
    code: int


class DataResponse(BaseResponse):
    data: Optional[dict] = None


class ListResponse(BaseResponse):
    data: Optional[dict] = None


class Pagination(BaseModel):
    page: int
    size: int
    total: int
    total_pages: int


class LoginRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=6)


class LoginResponse(BaseModel):
    success: bool
    data: Optional[dict] = None
    message: str
    code: int


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1)
    session_id: Optional[str] = Field(None, min_length=1, max_length=100)


class ChatResponse(BaseModel):
    success: bool
    data: Optional[dict] = None
    message: str
    code: int


class DashboardOverview(BaseModel):
    total_visits: int
    completed_visits: int
    pending_visits: int
    total_gift_applications: int
    approved_gift_applications: int
    total_gift_expense: float
    recent_news_count: int