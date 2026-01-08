"""认证相关的 Pydantic 模型"""
from pydantic import BaseModel, Field, validator
from typing import Optional
from datetime import datetime


class UserRole:
    """用户角色枚举"""
    CUSTOMER_MANAGER = "CUSTOMER_MANAGER"
    OPERATIONS = "OPERATIONS"
    APPROVER = "APPROVER"
    MANAGER = "MANAGER"


class UserStatus:
    """用户状态枚举"""
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"
    LOCKED = "LOCKED"


class LoginRequest(BaseModel):
    """登录请求"""
    username: str = Field(..., min_length=1, max_length=50, description="登录账号")
    password: str = Field(..., min_length=1, max_length=100, description="登录密码")


class UserResponse(BaseModel):
    """用户响应"""
    user_id: str
    username: str
    name: str
    role: str
    department: Optional[str] = None
    status: str

    class Config:
        from_attributes = True


class LoginResponse(BaseModel):
    """登录响应"""
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class UserUpdateRequest(BaseModel):
    """用户信息更新请求"""
    name: Optional[str] = Field(None, min_length=1, max_length=50, description="用户姓名")
    department: Optional[str] = Field(None, max_length=100, description="所属部门")


class PasswordUpdateRequest(BaseModel):
    """密码更新请求"""
    old_password: str = Field(..., min_length=1, max_length=100, description="旧密码")
    new_password: str = Field(..., min_length=8, max_length=100, description="新密码")

    @validator("new_password")
    def validate_password(cls, v):
        """验证密码复杂度"""
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters long")
        return v
