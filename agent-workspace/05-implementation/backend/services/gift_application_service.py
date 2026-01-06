from sqlalchemy.orm import Session
from typing import Optional
from datetime import date, datetime
from models import GiftApplication as GiftApplicationModel, User
from schemas import GiftApplicationCreate, GiftApplicationUpdate, GiftItem
from uuid import UUID


class GiftApplicationService:
    @staticmethod
    def get_gift_application_by_id(db: Session, application_id: str) -> Optional[GiftApplicationModel]:
        """
        Get gift application by ID
        """
        return db.query(GiftApplicationModel).filter(GiftApplicationModel.application_id == application_id).first()
    
    @staticmethod
    def get_gift_applications(
        db: Session,
        skip: int = 0,
        limit: int = 100,
        status: Optional[str] = None,
        applicant_id: Optional[str] = None,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None
    ) -> tuple[list[GiftApplicationModel], int]:
        """
        Get gift applications with filters and pagination
        """
        query = db.query(GiftApplicationModel).join(
            User, GiftApplicationModel.applicant_id == User.user_id
        ).outerjoin(
            User, GiftApplicationModel.approver_id == User.user_id
        )
        
        # Apply filters
        if status:
            query = query.filter(GiftApplicationModel.application_status == status)
        if applicant_id:
            query = query.filter(GiftApplicationModel.applicant_id == applicant_id)
        if start_date:
            query = query.filter(GiftApplicationModel.application_date >= start_date)
        if end_date:
            query = query.filter(GiftApplicationModel.application_date <= end_date)
        
        # Get total count
        total = query.count()
        
        # Apply pagination
        applications = query.offset(skip).limit(limit).all()
        
        return applications, total
    
    @staticmethod
    def create_gift_application(
        db: Session, 
        application_create: GiftApplicationCreate, 
        applicant_id: str,
        creator_id: str
    ) -> GiftApplicationModel:
        """
        Create a new gift application
        """
        # Calculate total amount
        total_amount = 0
        for item in application_create.gift_items:
            total_amount += item.quantity * item.unit_price
        
        # Create new gift application
        db_application = GiftApplicationModel(
            applicant_id=applicant_id,
            recipient_id=application_create.recipient_id,
            gift_items=[item.model_dump() for item in application_create.gift_items],
            total_amount=total_amount,
            planned_pickup_date=application_create.planned_pickup_date,
            purpose_type=application_create.purpose_type,
            related_visit_id=application_create.related_visit_id,
            creator_id=creator_id
        )
        
        db.add(db_application)
        db.commit()
        db.refresh(db_application)
        
        return db_application
    
    @staticmethod
    def update_gift_application(
        db: Session, 
        application_id: str, 
        application_update: GiftApplicationUpdate
    ) -> Optional[GiftApplicationModel]:
        """
        Update gift application
        """
        db_application = db.query(GiftApplicationModel).filter(
            GiftApplicationModel.application_id == application_id
        ).first()
        if not db_application:
            return None
        
        # Update fields if provided
        if application_update.recipient_id is not None:
            db_application.recipient_id = application_update.recipient_id
        if application_update.planned_pickup_date is not None:
            db_application.planned_pickup_date = application_update.planned_pickup_date
        if application_update.purpose_type is not None:
            db_application.purpose_type = application_update.purpose_type
        if application_update.related_visit_id is not None:
            db_application.related_visit_id = application_update.related_visit_id
        
        db.commit()
        db.refresh(db_application)
        
        return db_application
    
    @staticmethod
    def approve_gift_application(
        db: Session, 
        application_id: str, 
        approver_id: str,
        approval_notes: Optional[str] = None
    ) -> Optional[GiftApplicationModel]:
        """
        Approve a gift application
        """
        application = db.query(GiftApplicationModel).filter(
            GiftApplicationModel.application_id == application_id
        ).first()
        if not application:
            return None
        
        # Check if application is already approved/rejected
        if application.application_status != "pending":
            return None
        
        # Update application status
        application.application_status = "approved"
        application.approver_id = approver_id
        application.approval_date = datetime.utcnow()
        
        db.commit()
        db.refresh(application)
        
        return application
    
    @staticmethod
    def reject_gift_application(
        db: Session, 
        application_id: str, 
        approver_id: str,
        rejection_reason: str
    ) -> Optional[GiftApplicationModel]:
        """
        Reject a gift application
        """
        application = db.query(GiftApplicationModel).filter(
            GiftApplicationModel.application_id == application_id
        ).first()
        if not application:
            return None
        
        # Check if application is already approved/rejected
        if application.application_status != "pending":
            return None
        
        # Update application status
        application.application_status = "rejected"
        application.approver_id = approver_id
        application.approval_date = datetime.utcnow()
        application.rejection_reason = rejection_reason
        
        db.commit()
        db.refresh(application)
        
        return application