from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import date
from models import CustomerVisit as CustomerVisitModel, User
from schemas import CustomerVisitCreate, CustomerVisitUpdate
from uuid import UUID


class CustomerVisitService:
    @staticmethod
    def get_customer_visit_by_id(db: Session, visit_id: str) -> Optional[CustomerVisitModel]:
        """
        Get customer visit by ID
        """
        return db.query(CustomerVisitModel).filter(CustomerVisitModel.visit_id == visit_id).first()
    
    @staticmethod
    def get_customer_visits(
        db: Session,
        skip: int = 0,
        limit: int = 100,
        status: Optional[str] = None,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        customer_id: Optional[str] = None,
        creator_id: Optional[str] = None
    ) -> tuple[list[CustomerVisitModel], int]:
        """
        Get customer visits with filters and pagination
        """
        query = db.query(CustomerVisitModel).join(User, CustomerVisitModel.creator_id == User.user_id)
        
        # Apply filters
        if status:
            query = query.filter(CustomerVisitModel.status == status)
        if start_date:
            query = query.filter(CustomerVisitModel.planned_date >= start_date)
        if end_date:
            query = query.filter(CustomerVisitModel.planned_date <= end_date)
        if customer_id:
            query = query.filter(CustomerVisitModel.customer_id == customer_id)
        if creator_id:
            query = query.filter(CustomerVisitModel.creator_id == creator_id)
        
        # Get total count
        total = query.count()
        
        # Apply pagination
        visits = query.offset(skip).limit(limit).all()
        
        return visits, total
    
    @staticmethod
    def create_customer_visit(db: Session, visit_create: CustomerVisitCreate, creator_id: str) -> CustomerVisitModel:
        """
        Create a new customer visit
        """
        db_visit = CustomerVisitModel(
            customer_id=visit_create.customer_id,
            customer_name=visit_create.customer_name,
            planned_date=visit_create.planned_date,
            visit_method=visit_create.visit_method,
            products_interested=visit_create.products_interested,
            participants=visit_create.participants,
            status=visit_create.status,
            visit_notes=visit_create.visit_notes,
            creator_id=creator_id
        )
        
        db.add(db_visit)
        db.commit()
        db.refresh(db_visit)
        
        return db_visit
    
    @staticmethod
    def update_customer_visit(db: Session, visit_id: str, visit_update: CustomerVisitUpdate) -> Optional[CustomerVisitModel]:
        """
        Update customer visit
        """
        db_visit = db.query(CustomerVisitModel).filter(CustomerVisitModel.visit_id == visit_id).first()
        if not db_visit:
            return None
        
        # Update fields if provided
        if visit_update.customer_name is not None:
            db_visit.customer_name = visit_update.customer_name
        if visit_update.planned_date is not None:
            db_visit.planned_date = visit_update.planned_date
        if visit_update.actual_date is not None:
            db_visit.actual_date = visit_update.actual_date
        if visit_update.visit_method is not None:
            db_visit.visit_method = visit_update.visit_method
        if visit_update.products_interested is not None:
            db_visit.products_interested = visit_update.products_interested
        if visit_update.participants is not None:
            db_visit.participants = visit_update.participants
        if visit_update.status is not None:
            db_visit.status = visit_update.status
        if visit_update.visit_notes is not None:
            db_visit.visit_notes = visit_update.visit_notes
        
        db.commit()
        db.refresh(db_visit)
        
        return db_visit
    
    @staticmethod
    def delete_customer_visit(db: Session, visit_id: str) -> bool:
        """
        Delete customer visit (soft delete by setting status to cancelled)
        """
        db_visit = db.query(CustomerVisitModel).filter(CustomerVisitModel.visit_id == visit_id).first()
        if not db_visit:
            return False
        
        # For soft delete, we'll set the status to cancelled
        db_visit.status = "cancelled"
        db.commit()
        
        return True