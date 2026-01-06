from sqlalchemy import Column, DateTime, String, func, Text, Integer, Boolean, Date, JSON, DECIMAL, ForeignKey
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from sqlalchemy.dialects.mysql import UUID
from sqlalchemy import Enum as SQLEnum
from db.session import Base
from typing import Optional, List
import enum
import uuid
from datetime import date, datetime


class UserRole(str, enum.Enum):
    CUSTOMER_MANAGER = "customer_manager"
    OPERATIONS_STAFF = "operations_staff"
    APPROVER = "approver"
    BRANCH_MANAGER = "branch_manager"


class UserStatus(str, enum.Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"


class VisitMethod(str, enum.Enum):
    PHONE = "phone"
    FACE_TO_FACE = "face_to_face"
    VIDEO = "video"


class VisitStatus(str, enum.Enum):
    PENDING = "pending"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class GiftApplicationStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    CANCELLED = "cancelled"


class GiftPurposeType(str, enum.Enum):
    CUSTOMER_MAINTENANCE = "customer_maintenance"
    MARKETING_ACTIVITY = "marketing_activity"
    OTHER = "other"


class GiftLedgerStatus(str, enum.Enum):
    PICKED_UP = "picked_up"
    CANCELLED = "cancelled"
    PENDING = "pending"


class NewsStatus(str, enum.Enum):
    DRAFT = "draft"
    PUBLISHED = "published"
    UNPUBLISHED = "unpublished"


class User(Base):
    __tablename__ = "users"

    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    username: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    real_name: Mapped[str] = mapped_column(String(100), nullable=False)
    department: Mapped[Optional[str]] = mapped_column(String(100))
    role: Mapped[UserRole] = mapped_column(SQLEnum(UserRole), nullable=False)
    email: Mapped[Optional[str]] = mapped_column(String(100))
    phone: Mapped[Optional[str]] = mapped_column(String(20))
    status: Mapped[UserStatus] = mapped_column(SQLEnum(UserStatus), default=UserStatus.ACTIVE, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    created_visits: Mapped[List["CustomerVisit"]] = relationship("CustomerVisit", foreign_keys="CustomerVisit.creator_id", back_populates="creator")
    created_gift_applications: Mapped[List["GiftApplication"]] = relationship("GiftApplication", foreign_keys="GiftApplication.creator_id", back_populates="creator")
    applied_gifts: Mapped[List["GiftApplication"]] = relationship("GiftApplication", foreign_keys="GiftApplication.applicant_id", back_populates="applicant")
    approved_gifts: Mapped[List["GiftApplication"]] = relationship("GiftApplication", foreign_keys="GiftApplication.approver_id", back_populates="approver")
    authored_news: Mapped[List["News"]] = relationship("News", back_populates="author")
    ai_questions: Mapped[List["AIQuestion"]] = relationship("AIQuestion", back_populates="user")


class CustomerVisit(Base):
    __tablename__ = "customer_visits"

    visit_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    customer_id: Mapped[str] = mapped_column(String(50), nullable=False)
    customer_name: Mapped[str] = mapped_column(String(200), nullable=False)
    planned_date: Mapped[date] = mapped_column(Date, nullable=False)
    actual_date: Mapped[Optional[date]] = mapped_column(Date)
    visit_method: Mapped[VisitMethod] = mapped_column(SQLEnum(VisitMethod), nullable=False)
    products_interested: Mapped[Optional[dict]] = mapped_column(JSON)
    participants: Mapped[Optional[dict]] = mapped_column(JSON)
    status: Mapped[VisitStatus] = mapped_column(SQLEnum(VisitStatus), default=VisitStatus.PENDING, nullable=False)
    visit_notes: Mapped[Optional[str]] = mapped_column(Text)
    creator_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.user_id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    creator: Mapped["User"] = relationship("User", foreign_keys=[creator_id], back_populates="created_visits")
    related_gift_applications: Mapped[List["GiftApplication"]] = relationship("GiftApplication", back_populates="related_visit")


class GiftApplication(Base):
    __tablename__ = "gift_applications"

    application_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    applicant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.user_id"), nullable=False)
    recipient_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.user_id"))
    gift_items: Mapped[dict] = mapped_column(JSON, nullable=False)
    total_amount: Mapped[float] = mapped_column(DECIMAL(10, 2), nullable=False)
    planned_pickup_date: Mapped[date] = mapped_column(Date, nullable=False)
    purpose_type: Mapped[GiftPurposeType] = mapped_column(SQLEnum(GiftPurposeType), nullable=False)
    related_visit_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("customer_visits.visit_id"))
    application_status: Mapped[GiftApplicationStatus] = mapped_column(
        SQLEnum(GiftApplicationStatus),
        default=GiftApplicationStatus.PENDING,
        nullable=False
    )
    application_date: Mapped[date] = mapped_column(Date, default=date.today, nullable=False)
    approver_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.user_id"))
    approval_date: Mapped[Optional[datetime]] = mapped_column(DateTime)
    rejection_reason: Mapped[Optional[str]] = mapped_column(Text)
    creator_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.user_id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    applicant: Mapped["User"] = relationship("User", foreign_keys=[applicant_id], back_populates="applied_gifts")
    recipient: Mapped[Optional["User"]] = relationship("User", foreign_keys=[recipient_id])
    approver: Mapped[Optional["User"]] = relationship("User", foreign_keys=[approver_id], back_populates="approved_gifts")
    creator: Mapped["User"] = relationship("User", foreign_keys=[creator_id], back_populates="created_gift_applications")
    related_visit: Mapped[Optional["CustomerVisit"]] = relationship("CustomerVisit", back_populates="related_gift_applications")
    ledger_entries: Mapped[List["GiftLedger"]] = relationship("GiftLedger", back_populates="gift_application")


class GiftLedger(Base):
    __tablename__ = "gift_ledger"

    ledger_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    gift_application_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("gift_applications.application_id"), nullable=False)
    gift_type: Mapped[str] = mapped_column(String(100), nullable=False)
    gift_name: Mapped[str] = mapped_column(String(200), nullable=False)
    quantity: Mapped[int] = mapped_column(nullable=False)
    unit_price: Mapped[float] = mapped_column(DECIMAL(10, 2), nullable=False)
    total_price: Mapped[float] = mapped_column(DECIMAL(10, 2), nullable=False)
    pickup_date: Mapped[Optional[date]] = mapped_column(Date)
    pickup_person: Mapped[Optional[str]] = mapped_column(String(100))
    purpose: Mapped[Optional[str]] = mapped_column(Text)
    status: Mapped[GiftLedgerStatus] = mapped_column(
        SQLEnum(GiftLedgerStatus),
        default=GiftLedgerStatus.PENDING,
        nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    gift_application: Mapped["GiftApplication"] = relationship("GiftApplication", back_populates="ledger_entries")


class HomepageCarousel(Base):
    __tablename__ = "homepage_carousel"

    carousel_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    image_url: Mapped[str] = mapped_column(String(500), nullable=False)
    link_url: Mapped[Optional[str]] = mapped_column(String(500))
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=func.now(), onupdate=func.now(), nullable=False)


class News(Base):
    __tablename__ = "news"

    news_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    summary: Mapped[Optional[str]] = mapped_column(String(500))
    author_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.user_id"), nullable=False)
    publish_date: Mapped[Optional[datetime]] = mapped_column(DateTime)
    status: Mapped[NewsStatus] = mapped_column(
        SQLEnum(NewsStatus),
        default=NewsStatus.DRAFT,
        nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    author: Mapped["User"] = relationship("User", back_populates="authored_news")


class AIQuestion(Base):
    __tablename__ = "ai_questions"

    question_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.user_id"), nullable=False)
    question: Mapped[str] = mapped_column(Text, nullable=False)
    answer: Mapped[str] = mapped_column(Text, nullable=False)
    question_time: Mapped[datetime] = mapped_column(DateTime, default=func.now(), nullable=False)
    session_id: Mapped[str] = mapped_column(String(100), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now(), nullable=False)

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="ai_questions")