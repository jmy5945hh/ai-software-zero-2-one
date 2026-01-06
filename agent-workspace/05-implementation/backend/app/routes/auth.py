from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import timedelta

from app.database import get_db
from app.schemas.auth import LoginRequest, LoginResponse, UserInfo
from app.schemas.common import ErrorResponse
from app.utils.auth import authenticate_user, create_access_token, get_current_user
from app.config import settings
from app.models.user import SysUser

router = APIRouter()


@router.post("/login", response_model=LoginResponse, responses={401: {"model": ErrorResponse}})
async def login(
    login_request: LoginRequest,
    db: AsyncSession = Depends(get_db)
):
    """用户登录"""
    user = await authenticate_user(db, login_request.username, login_request.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username},
        expires_delta=access_token_expires
    )
    
    return LoginResponse(
        token=access_token,
        userInfo=UserInfo(
            id=user.id,
            username=user.username,
            realName=user.real_name,
            role=user.role,
            department=user.department
        )
    )


@router.post("/logout")
async def logout(current_user: SysUser = Depends(get_current_user)):
    """用户登出"""
    # JWT是无状态的，登出只需客户端删除token即可
    return {"message": "Logout successful"}


@router.post("/refresh")
async def refresh_token(current_user: SysUser = Depends(get_current_user)):
    """刷新令牌"""
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": current_user.username},
        expires_delta=access_token_expires
    )
    
    return {"token": access_token}
