from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Any, Optional
from datetime import date
from core.security import get_current_active_user
from db.session import get_db
from schemas import CustomerVisit, CustomerVisitCreate, CustomerVisitUpdate, DataResponse, ListResponse, Pagination
from models import CustomerVisit as CustomerVisitModel, User
import logging

logger = logging.getLogger("zhaocai_portal")

router = APIRouter()

@router.get("/", response_model=ListResponse)
async def get_customer_visits_list(
    page: int = 1,
    size: int = 10,
    status_param: Optional[str] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    customer_id: Optional[str] = None,
    creator_id: Optional[str] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
) -> Any:
    """
    Get customer visits list
    """
    # Build query
    query = db.query(CustomerVisitModel).join(User, CustomerVisitModel.creator_id == User.user_id)
    
    # Apply filters
    if status_param:
        query = query.filter(CustomerVisitModel.status == status_param)
    if start_date:
        query = query.filter(CustomerVisitModel.planned_date >= start_date)
    if end_date:
        query = query.filter(CustomerVisitModel.planned_date <= end_date)
    if customer_id:
        query = query.filter(CustomerVisitModel.customer_id == customer_id)
    if creator_id:
        query = query.filter(CustomerVisitModel.creator_id == creator_id)
    
    # Calculate pagination
    total = query.count()
    total_pages = (total + size - 1) // size
    
    # Apply pagination
    visits = query.offset((page - 1) * size).limit(size).all()
    
    # Format response
    visits_data = []
    for visit in visits:
        visit_data = {
            "visit_id": str(visit.visit_id),
            "customer_id": visit.customer_id,
            "customer_name": visit.customer_name,
            "planned_date": visit.planned_date,
            "actual_date": visit.actual_date,
            "visit_method": visit.visit_method,
            "products_interested": visit.products_interested,
            "participants": visit.participants,
            "status": visit.status,
            "visit_notes": visit.visit_notes,
            "creator_id": str(visit.creator_id),
            "creator_name": visit.creator.real_name if visit.creator else None,
            "created_at": visit.created_at,
            "updated_at": visit.updated_at
        }
        visits_data.append(visit_data)
    
    return ListResponse(
        success=True,
        data={
            "items": visits_data,
            "pagination": {
                "page": page,
                "size": size,
                "total": total,
                "total_pages": total_pages
            }
        },
        message="Get customer visits list successful",
        code=200
    )


@router.post("/", response_model=DataResponse)
async def create_customer_visit(
    visit_create: CustomerVisitCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
) -> Any:
    """
    Create a customer visit record
    """
    # Create new customer visit
    db_visit = CustomerVisitModel(
        customer_id=visit_create.customer_id,
        customer_name=visit_create.customer_name,
        planned_date=visit_create.planned_date,
        visit_method=visit_create.visit_method,
        products_interested=visit_create.products_interested,
        participants=visit_create.participants,
        status=visit_create.status,
        visit_notes=visit_create.visit_notes,
        creator_id=current_user.user_id
    )
    
    db.add(db_visit)
    db.commit()
    db.refresh(db_visit)
    
    logger.info(f"Customer visit created: {db_visit.visit_id} by {current_user.username}")
    
    visit_data = {
        "visit_id": str(db_visit.visit_id),
        "customer_id": db_visit.customer_id,
        "customer_name": db_visit.customer_name,
        "planned_date": db_visit.planned_date,
        "actual_date": db_visit.actual_date,
        "visit_method": db_visit.visit_method,
        "products_interested": db_visit.products_interested,
        "participants": db_visit.participants,
        "status": db_visit.status,
        "visit_notes": db_visit.visit_notes,
        "creator_id": str(db_visit.creator_id),
        "creator_name": current_user.real_name,
        "created_at": db_visit.created_at,
        "updated_at": db_visit.updated_at
    }
    
    return DataResponse(
        success=True,
        data={"customer_visit": visit_data},
        message="Customer visit created successfully",
        code=201
    )


@router.get("/{visit_id}", response_model=DataResponse)
async def get_customer_visit_detail(
    visit_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
) -> Any:
    """
    Get customer visit detail
    """
    visit = db.query(CustomerVisitModel).filter(CustomerVisitModel.visit_id == visit_id).first()
    if not visit:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Customer visit not found"
        )
    
    visit_data = {
        "visit_id": str(visit.visit_id),
        "customer_id": visit.customer_id,
        "customer_name": visit.customer_name,
        "planned_date": visit.planned_date,
        "actual_date": visit.actual_date,
        "visit_method": visit.visit_method,
        "products_interested": visit.products_interested,
        "participants": visit.participants,
        "status": visit.status,
        "visit_notes": visit.visit_notes,
        "creator_id": str(visit.creator_id),
        "creator_name": visit.creator.real_name if visit.creator else None,
        "created_at": visit.created_at,
        "updated_at": visit.updated_at
    }
    
    return DataResponse(
        success=True,
        data={"customer_visit": visit_data},
        message="Get customer visit detail successful",
        code=200
    )


@router.put("/{visit_id}", response_model=DataResponse)
async def update_customer_visit(
    visit_id: str,
    visit_update: CustomerVisitUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
) -> Any:
    """
    Update customer visit record
    """
    visit = db.query(CustomerVisitModel).filter(CustomerVisitModel.visit_id == visit_id).first()
    if not visit:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Customer visit not found"
        )
    
    # Check if current user is the creator or has appropriate permissions
    if visit.creator_id != current_user.user_id:
        # In a real implementation, you might want to check for manager roles
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to update this visit record"
        )
    
    # Update fields if provided
    if visit_update.customer_name is not None:
        visit.customer_name = visit_update.customer_name
    if visit_update.planned_date is not None:
        visit.planned_date = visit_update.planned_date
    if visit_update.actual_date is not None:
        visit.actual_date = visit_update.actual_date
    if visit_update.visit_method is not None:
        visit.visit_method = visit_update.visit_method
    if visit_update.products_interested is not None:
        visit.products_interested = visit_update.products_interested
    if visit_update.participants is not None:
        visit.participants = visit_update.participants
    if visit_update.status is not None:
        visit.status = visit_update.status
    if visit_update.visit_notes is not None:
        visit.visit_notes = visit_update.visit_notes
    
    db.commit()
    db.refresh(visit)
    
    logger.info(f"Customer visit updated: {visit.visit_id} by {current_user.username}")
    
    visit_data = {
        "visit_id": str(visit.visit_id),
        "customer_id": visit.customer_id,
        "customer_name": visit.customer_name,
        "planned_date": visit.planned_date,
        "actual_date": visit.actual_date,
        "visit_method": visit.visit_method,
        "products_interested": visit.products_interested,
        "participants": visit.participants,
        "status": visit.status,
        "visit_notes": visit.visit_notes,
        "creator_id": str(visit.creator_id),
        "creator_name": visit.creator.real_name if visit.creator else None,
        "created_at": visit.created_at,
        "updated_at": visit.updated_at
    }
    
    return DataResponse(
        success=True,
        data={"customer_visit": visit_data},
        message="Customer visit updated successfully",
        code=200
    )


@router.delete("/{visit_id}", response_model=DataResponse)
async def delete_customer_visit(
    visit_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
) -> Any:
    """
    Delete customer visit record (soft delete by setting status to cancelled)
    """
    visit = db.query(CustomerVisitModel).filter(CustomerVisitModel.visit_id == visit_id).first()
    if not visit:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Customer visit not found"
        )
    
    # Check if current user is the creator or has appropriate permissions
    if visit.creator_id != current_user.user_id:
        # In a real implementation, you might want to check for manager roles
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to delete this visit record"
        )
    
    # For soft delete, we'll set the status to cancelled
    visit.status = "cancelled"
    db.commit()
    
    logger.info(f"Customer visit deleted: {visit.visit_id} by {current_user.username}")
    
    return DataResponse(
        success=True,
        message="Customer visit deleted successfully",
        code=200
    )