from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Any, Optional
from core.security import get_current_active_user, require_any_role, get_password_hash
from db.session import get_db
from schemas import User, UserCreate, UserUpdate, DataResponse, ListResponse, Pagination
from models import User as UserModel
import logging

logger = logging.getLogger("zhaocai_portal")

router = APIRouter()

@router.get("/me", response_model=DataResponse)
async def get_current_user_info(
    current_user: UserModel = Depends(get_current_active_user)
) -> Any:
    """
    Get current user information
    """
    user_data = {
        "user_id": str(current_user.user_id),
        "username": current_user.username,
        "real_name": current_user.real_name,
        "role": current_user.role,
        "email": current_user.email,
        "department": current_user.department,
        "phone": current_user.phone,
        "status": current_user.status,
        "created_at": current_user.created_at,
        "updated_at": current_user.updated_at
    }
    
    return DataResponse(
        success=True,
        data={"user": user_data},
        message="Get user info successful",
        code=200
    )


@router.get("/", response_model=ListResponse)
async def get_users_list(
    page: int = 1,
    size: int = 10,
    role: Optional[str] = None,
    status_param: Optional[str] = None,
    search: Optional[str] = None,
    current_user: UserModel = Depends(require_any_role("operations_staff", "branch_manager")),
    db: Session = Depends(get_db)
) -> Any:
    """
    Get users list (only for operations staff and branch managers)
    """
    # Build query
    query = db.query(UserModel)
    
    # Apply filters
    if role:
        query = query.filter(UserModel.role == role)
    if status_param:
        query = query.filter(UserModel.status == status_param)
    if search:
        query = query.filter(UserModel.username.contains(search) | 
                           UserModel.real_name.contains(search) |
                           UserModel.department.contains(search))
    
    # Calculate pagination
    total = query.count()
    total_pages = (total + size - 1) // size
    
    # Apply pagination
    users = query.offset((page - 1) * size).limit(size).all()
    
    # Format response
    users_data = []
    for user in users:
        user_data = {
            "user_id": str(user.user_id),
            "username": user.username,
            "real_name": user.real_name,
            "role": user.role,
            "email": user.email,
            "department": user.department,
            "phone": user.phone,
            "status": user.status,
            "created_at": user.created_at,
            "updated_at": user.updated_at
        }
        users_data.append(user_data)
    
    return ListResponse(
        success=True,
        data={
            "items": users_data,
            "pagination": {
                "page": page,
                "size": size,
                "total": total,
                "total_pages": total_pages
            }
        },
        message="Get users list successful",
        code=200
    )


@router.post("/", response_model=DataResponse)
async def create_user(
    user_create: UserCreate,
    current_user: UserModel = Depends(require_any_role("operations_staff", "branch_manager")),
    db: Session = Depends(get_db)
) -> Any:
    """
    Create a new user (only for operations staff and branch managers)
    """
    # Check if username already exists
    existing_user = db.query(UserModel).filter(UserModel.username == user_create.username).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already registered"
        )
    
    # Hash the password
    hashed_password = get_password_hash(user_create.password)
    
    # Create new user
    db_user = UserModel(
        username=user_create.username,
        password_hash=hashed_password,
        real_name=user_create.real_name,
        department=user_create.department,
        role=user_create.role,
        email=user_create.email,
        phone=user_create.phone,
        status="active"  # New users are active by default
    )
    
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    
    logger.info(f"New user created: {db_user.username} (ID: {db_user.user_id}) by {current_user.username}")
    
    user_data = {
        "user_id": str(db_user.user_id),
        "username": db_user.username,
        "real_name": db_user.real_name,
        "role": db_user.role,
        "email": db_user.email,
        "department": db_user.department,
        "phone": db_user.phone,
        "status": db_user.status,
        "created_at": db_user.created_at,
        "updated_at": db_user.updated_at
    }
    
    return DataResponse(
        success=True,
        data={"user": user_data},
        message="User created successfully",
        code=201
    )


@router.put("/{user_id}", response_model=DataResponse)
async def update_user(
    user_id: str,
    user_update: UserUpdate,
    current_user: UserModel = Depends(require_any_role("operations_staff", "branch_manager")),
    db: Session = Depends(get_db)
) -> Any:
    """
    Update user information (only for operations staff and branch managers)
    """
    # Find the user to update
    db_user = db.query(UserModel).filter(UserModel.user_id == user_id).first()
    if not db_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Update fields if provided
    if user_update.real_name is not None:
        db_user.real_name = user_update.real_name
    if user_update.department is not None:
        db_user.department = user_update.department
    if user_update.role is not None:
        db_user.role = user_update.role
    if user_update.email is not None:
        db_user.email = user_update.email
    if user_update.phone is not None:
        db_user.phone = user_update.phone
    if user_update.status is not None:
        db_user.status = user_update.status
    
    db.commit()
    db.refresh(db_user)
    
    logger.info(f"User updated: {db_user.username} (ID: {db_user.user_id}) by {current_user.username}")
    
    user_data = {
        "user_id": str(db_user.user_id),
        "username": db_user.username,
        "real_name": db_user.real_name,
        "role": db_user.role,
        "email": db_user.email,
        "department": db_user.department,
        "phone": db_user.phone,
        "status": db_user.status,
        "created_at": db_user.created_at,
        "updated_at": db_user.updated_at
    }
    
    return DataResponse(
        success=True,
        data={"user": user_data},
        message="User updated successfully",
        code=200
    )