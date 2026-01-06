from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer
from sqlalchemy.orm import Session
from typing import Any
from datetime import timedelta
from core.security import authenticate_user, create_access_token, get_password_hash
from core.config import settings
from db.session import get_db
from schemas import User, LoginRequest, LoginResponse, BaseResponse
from models import User as UserModel
import logging

logger = logging.getLogger("zhaocai_portal")

router = APIRouter()

@router.post("/login", response_model=LoginResponse)
async def login(
    login_request: LoginRequest,
    db: Session = Depends(get_db)
) -> Any:
    """
    User login endpoint
    """
    user = authenticate_user(db, login_request.username, login_request.password)
    
    if not user:
        logger.warning(f"Failed login attempt for username: {login_request.username}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if user.status != "active":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Inactive user account",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token_expires = timedelta(minutes=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": str(user.user_id)}, expires_delta=access_token_expires
    )
    
    logger.info(f"Successful login for user: {user.username} (ID: {user.user_id})")
    
    return LoginResponse(
        success=True,
        data={
            "access_token": access_token,
            "token_type": "bearer",
            "user": {
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
        },
        message="Login successful",
        code=200
    )


@router.post("/logout", response_model=BaseResponse)
async def logout() -> Any:
    """
    User logout endpoint
    """
    # In a real implementation, you might want to add the token to a blacklist
    # For now, we just return a success response
    return BaseResponse(
        success=True,
        message="Logout successful",
        code=200
    )