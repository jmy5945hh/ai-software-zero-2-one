from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Any, Optional
from datetime import date, datetime
from core.security import get_current_active_user, require_role
from db.session import get_db
from schemas import GiftApplication, GiftApplicationCreate, GiftApplicationUpdate, GiftApplicationApproval, GiftApplicationRejection, DataResponse, ListResponse, Pagination
from models import GiftApplication as GiftApplicationModel, User, CustomerVisit
import logging

logger = logging.getLogger("zhaocai_portal")

router = APIRouter()

@router.get("/", response_model=ListResponse)
async def get_gift_applications_list(
    page: int = 1,
    size: int = 10,
    status_param: Optional[str] = None,
    applicant_id: Optional[str] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
) -> Any:
    """
    Get gift applications list
    """
    # Build query
    query = db.query(GiftApplicationModel).join(
        User, GiftApplicationModel.applicant_id == User.user_id
    ).outerjoin(
        User, GiftApplicationModel.approver_id == User.user_id
    )
    
    # Apply filters
    if status_param:
        query = query.filter(GiftApplicationModel.application_status == status_param)
    if applicant_id:
        query = query.filter(GiftApplicationModel.applicant_id == applicant_id)
    if start_date:
        query = query.filter(GiftApplicationModel.application_date >= start_date)
    if end_date:
        query = query.filter(GiftApplicationModel.application_date <= end_date)
    
    # Calculate pagination
    total = query.count()
    total_pages = (total + size - 1) // size
    
    # Apply pagination
    applications = query.offset((page - 1) * size).limit(size).all()
    
    # Format response
    applications_data = []
    for app in applications:
        application_data = {
            "application_id": str(app.application_id),
            "applicant_id": str(app.applicant_id),
            "applicant_name": app.applicant.real_name if app.applicant else None,
            "recipient_id": str(app.recipient_id) if app.recipient_id else None,
            "recipient_name": app.recipient.real_name if app.recipient else None,
            "gift_items": app.gift_items,
            "total_amount": float(app.total_amount),
            "planned_pickup_date": app.planned_pickup_date,
            "purpose_type": app.purpose_type,
            "related_visit_id": str(app.related_visit_id) if app.related_visit_id else None,
            "application_status": app.application_status,
            "application_date": app.application_date,
            "approver_id": str(app.approver_id) if app.approver_id else None,
            "approver_name": app.approver.real_name if app.approver else None,
            "approval_date": app.approval_date,
            "rejection_reason": app.rejection_reason,
            "created_at": app.created_at,
            "updated_at": app.updated_at
        }
        applications_data.append(application_data)
    
    return ListResponse(
        success=True,
        data={
            "items": applications_data,
            "pagination": {
                "page": page,
                "size": size,
                "total": total,
                "total_pages": total_pages
            }
        },
        message="Get gift applications list successful",
        code=200
    )


@router.post("/", response_model=DataResponse)
async def create_gift_application(
    application_create: GiftApplicationCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
) -> Any:
    """
    Create a gift application
    """
    # Calculate total amount
    total_amount = 0
    for item in application_create.gift_items:
        total_amount += item.quantity * item.unit_price
    
    # Create new gift application
    db_application = GiftApplicationModel(
        applicant_id=current_user.user_id,
        recipient_id=application_create.recipient_id,
        gift_items=[item.model_dump() for item in application_create.gift_items],
        total_amount=total_amount,
        planned_pickup_date=application_create.planned_pickup_date,
        purpose_type=application_create.purpose_type,
        related_visit_id=application_create.related_visit_id,
        creator_id=current_user.user_id
    )
    
    db.add(db_application)
    db.commit()
    db.refresh(db_application)
    
    logger.info(f"Gift application created: {db_application.application_id} by {current_user.username}")
    
    application_data = {
        "application_id": str(db_application.application_id),
        "applicant_id": str(db_application.applicant_id),
        "applicant_name": current_user.real_name,
        "recipient_id": str(db_application.recipient_id) if db_application.recipient_id else None,
        "recipient_name": db_application.recipient.real_name if db_application.recipient else None,
        "gift_items": db_application.gift_items,
        "total_amount": float(db_application.total_amount),
        "planned_pickup_date": db_application.planned_pickup_date,
        "purpose_type": db_application.purpose_type,
        "related_visit_id": str(db_application.related_visit_id) if db_application.related_visit_id else None,
        "application_status": db_application.application_status,
        "application_date": db_application.application_date,
        "approver_id": str(db_application.approver_id) if db_application.approver_id else None,
        "approver_name": None,
        "approval_date": db_application.approval_date,
        "rejection_reason": db_application.rejection_reason,
        "created_at": db_application.created_at,
        "updated_at": db_application.updated_at
    }
    
    return DataResponse(
        success=True,
        data={"gift_application": application_data},
        message="Gift application created successfully",
        code=201
    )


@router.post("/{application_id}/approve", response_model=DataResponse)
async def approve_gift_application(
    application_id: str,
    approval_data: GiftApplicationApproval,
    current_user: User = Depends(require_role("approver")),
    db: Session = Depends(get_db)
) -> Any:
    """
    Approve a gift application
    """
    application = db.query(GiftApplicationModel).filter(GiftApplicationModel.application_id == application_id).first()
    if not application:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Gift application not found"
        )
    
    # Check if application is already approved/rejected
    if application.application_status != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Application is not in pending status"
        )
    
    # Update application status
    application.application_status = "approved"
    application.approver_id = current_user.user_id
    application.approval_date = datetime.utcnow()
    
    db.commit()
    db.refresh(application)
    
    logger.info(f"Gift application approved: {application.application_id} by {current_user.username}")
    
    application_data = {
        "application_id": str(application.application_id),
        "applicant_id": str(application.applicant_id),
        "applicant_name": application.applicant.real_name if application.applicant else None,
        "recipient_id": str(application.recipient_id) if application.recipient_id else None,
        "recipient_name": application.recipient.real_name if application.recipient else None,
        "gift_items": application.gift_items,
        "total_amount": float(application.total_amount),
        "planned_pickup_date": application.planned_pickup_date,
        "purpose_type": application.purpose_type,
        "related_visit_id": str(application.related_visit_id) if application.related_visit_id else None,
        "application_status": application.application_status,
        "application_date": application.application_date,
        "approver_id": str(application.approver_id) if application.approver_id else None,
        "approver_name": application.approver.real_name if application.approver else None,
        "approval_date": application.approval_date,
        "rejection_reason": application.rejection_reason,
        "created_at": application.created_at,
        "updated_at": application.updated_at
    }
    
    return DataResponse(
        success=True,
        data={"gift_application": application_data},
        message="Gift application approved successfully",
        code=200
    )


@router.post("/{application_id}/reject", response_model=DataResponse)
async def reject_gift_application(
    application_id: str,
    rejection_data: GiftApplicationRejection,
    current_user: User = Depends(require_role("approver")),
    db: Session = Depends(get_db)
) -> Any:
    """
    Reject a gift application
    """
    application = db.query(GiftApplicationModel).filter(GiftApplicationModel.application_id == application_id).first()
    if not application:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Gift application not found"
        )
    
    # Check if application is already approved/rejected
    if application.application_status != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Application is not in pending status"
        )
    
    # Update application status
    application.application_status = "rejected"
    application.approver_id = current_user.user_id
    application.approval_date = datetime.utcnow()
    application.rejection_reason = rejection_data.rejection_reason
    
    db.commit()
    db.refresh(application)
    
    logger.info(f"Gift application rejected: {application.application_id} by {current_user.username}")
    
    application_data = {
        "application_id": str(application.application_id),
        "applicant_id": str(application.applicant_id),
        "applicant_name": application.applicant.real_name if application.applicant else None,
        "recipient_id": str(application.recipient_id) if application.recipient_id else None,
        "recipient_name": application.recipient.real_name if application.recipient else None,
        "gift_items": application.gift_items,
        "total_amount": float(application.total_amount),
        "planned_pickup_date": application.planned_pickup_date,
        "purpose_type": application.purpose_type,
        "related_visit_id": str(application.related_visit_id) if application.related_visit_id else None,
        "application_status": application.application_status,
        "application_date": application.application_date,
        "approver_id": str(application.approver_id) if application.approver_id else None,
        "approver_name": application.approver.real_name if application.approver else None,
        "approval_date": application.approval_date,
        "rejection_reason": application.rejection_reason,
        "created_at": application.created_at,
        "updated_at": application.updated_at
    }
    
    return DataResponse(
        success=True,
        data={"gift_application": application_data},
        message="Gift application rejected successfully",
        code=200
    )


@router.get("/{application_id}", response_model=DataResponse)
async def get_gift_application_detail(
    application_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
) -> Any:
    """
    Get gift application detail
    """
    application = db.query(GiftApplicationModel).filter(GiftApplicationModel.application_id == application_id).first()
    if not application:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Gift application not found"
        )
    
    application_data = {
        "application_id": str(application.application_id),
        "applicant_id": str(application.applicant_id),
        "applicant_name": application.applicant.real_name if application.applicant else None,
        "recipient_id": str(application.recipient_id) if application.recipient_id else None,
        "recipient_name": application.recipient.real_name if application.recipient else None,
        "gift_items": application.gift_items,
        "total_amount": float(application.total_amount),
        "planned_pickup_date": application.planned_pickup_date,
        "purpose_type": application.purpose_type,
        "related_visit_id": str(application.related_visit_id) if application.related_visit_id else None,
        "application_status": application.application_status,
        "application_date": application.application_date,
        "approver_id": str(application.approver_id) if application.approver_id else None,
        "approver_name": application.approver.real_name if application.approver else None,
        "approval_date": application.approval_date,
        "rejection_reason": application.rejection_reason,
        "created_at": application.created_at,
        "updated_at": application.updated_at
    }
    
    return DataResponse(
        success=True,
        data={"gift_application": application_data},
        message="Get gift application detail successful",
        code=200
    )


@router.put("/{application_id}", response_model=DataResponse)
async def update_gift_application(
    application_id: str,
    application_update: GiftApplicationUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
) -> Any:
    """
    Update gift application
    """
    application = db.query(GiftApplicationModel).filter(GiftApplicationModel.application_id == application_id).first()
    if not application:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Gift application not found"
        )
    
    # Check if current user is the applicant or has appropriate permissions
    if application.applicant_id != current_user.user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to update this gift application"
        )
    
    # Check if application is already approved/rejected
    if application.application_status != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot update application that is not in pending status"
        )
    
    # Update fields if provided
    if application_update.recipient_id is not None:
        application.recipient_id = application_update.recipient_id
    if application_update.planned_pickup_date is not None:
        application.planned_pickup_date = application_update.planned_pickup_date
    if application_update.purpose_type is not None:
        application.purpose_type = application_update.purpose_type
    if application_update.related_visit_id is not None:
        application.related_visit_id = application_update.related_visit_id
    
    db.commit()
    db.refresh(application)
    
    logger.info(f"Gift application updated: {application.application_id} by {current_user.username}")
    
    application_data = {
        "application_id": str(application.application_id),
        "applicant_id": str(application.applicant_id),
        "applicant_name": application.applicant.real_name if application.applicant else None,
        "recipient_id": str(application.recipient_id) if application.recipient_id else None,
        "recipient_name": application.recipient.real_name if application.recipient else None,
        "gift_items": application.gift_items,
        "total_amount": float(application.total_amount),
        "planned_pickup_date": application.planned_pickup_date,
        "purpose_type": application.purpose_type,
        "related_visit_id": str(application.related_visit_id) if application.related_visit_id else None,
        "application_status": application.application_status,
        "application_date": application.application_date,
        "approver_id": str(application.approver_id) if application.approver_id else None,
        "approver_name": application.approver.real_name if application.approver else None,
        "approval_date": application.approval_date,
        "rejection_reason": application.rejection_reason,
        "created_at": application.created_at,
        "updated_at": application.updated_at
    }
    
    return DataResponse(
        success=True,
        data={"gift_application": application_data},
        message="Gift application updated successfully",
        code=200
    )