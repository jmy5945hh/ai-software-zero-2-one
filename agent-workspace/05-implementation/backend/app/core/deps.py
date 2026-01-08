"""依赖注入模块"""
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from typing import List, Optional

from app.db.session import get_db
from app.core.security import verify_token
from app.models.user import User

security = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
) -> User:
    """
    获取当前登录用户

    Args:
        credentials: HTTP Bearer credentials
        db: 数据库会话

    Returns:
        User: 当前用户

    Raises:
        HTTPException: Token 无效或用户不存在
    """
    token = credentials.credentials

    payload = verify_token(token)
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )

    user_id: str = payload.get("user_id")
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
        )

    user = db.query(User).filter(User.user_id == user_id).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )

    # 检查用户状态
    if user.status != "ACTIVE":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is not active",
        )

    return user


def require_role(*roles: str):
    """
    角色权限检查装饰器工厂

    Args:
        *roles: 允许的角色列表

    Returns:
        依赖函数

    Example:
        @router.get("/admin")
        async def admin_endpoint(user: User = Depends(require_role("MANAGER", "APPROVER"))):
            ...
    """

    async def role_checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission denied. Required roles: {', '.join(roles)}",
            )
        return current_user

    return role_checker


def require_any_role(roles: List[str]):
    """
    要求任意一个角色的权限检查(替代写法)

    Args:
        roles: 允许的角色列表

    Returns:
        依赖函数
    """
    return require_role(*roles)
