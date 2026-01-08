"""认证 API 路由"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.schemas.auth import (
    LoginRequest,
    LoginResponse,
    UserResponse,
    UserUpdateRequest,
    PasswordUpdateRequest,
)
from app.schemas.common import ApiResponse
from app.services.auth_service import AuthService
from app.crud.user import update_user

router = APIRouter()


@router.post("/login", response_model=ApiResponse[LoginResponse], summary="用户登录")
async def login(form: LoginRequest, db: Session = Depends(get_db)):
    """
    用户登录接口

    - **username**: 登录账号
    - **password**: 登录密码
    """
    # 用户认证
    user = AuthService.authenticate(db, form)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
        )

    # 登录成功
    login_data = AuthService.login(db, user)

    return ApiResponse(data=login_data)


@router.get("/me", response_model=ApiResponse[UserResponse], summary="获取当前用户信息")
async def get_me(current_user: User = Depends(get_current_user)):
    """
    获取当前登录用户信息

    需要在请求头中携带 JWT Token:
    - Authorization: Bearer <token>
    """
    return ApiResponse(data=current_user)


@router.put("/me", response_model=ApiResponse[UserResponse], summary="更新当前用户信息")
async def update_me(
    form: UserUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    更新当前登录用户信息

    - **name**: 用户姓名
    - **department**: 所属部门
    """
    # 更新用户信息
    update_data = form.dict(exclude_unset=True)
    updated_user = update_user(db, current_user, **update_data)

    return ApiResponse(data=updated_user)


@router.put("/me/password", response_model=ApiResponse, summary="修改密码")
async def update_password(
    form: PasswordUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    修改当前登录用户密码

    - **old_password**: 旧密码
    - **new_password**: 新密码(至少8位)
    """
    # 修改密码
    success = AuthService.update_password(db, current_user, form.old_password, form.new_password)

    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Old password is incorrect",
        )

    return ApiResponse(message="Password updated successfully")
