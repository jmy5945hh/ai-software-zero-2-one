"""认证服务"""
from sqlalchemy.orm import Session
from datetime import datetime
from typing import Optional

from app.models.user import User
from app.schemas.auth import LoginRequest
from app.core.security import verify_password, create_access_token, get_password_hash
from app.crud.user import get_user_by_username, update_last_login


class AuthService:
    """认证服务类"""

    @staticmethod
    def authenticate(db: Session, form: LoginRequest) -> Optional[User]:
        """
        用户认证

        Args:
            db: 数据库会话
            form: 登录表单

        Returns:
            Optional[User]: 认证成功返回用户对象,失败返回 None
        """
        user = get_user_by_username(db, form.username)

        # 用户不存在
        if not user:
            return None

        # 密码错误
        if not verify_password(form.password, user.password_hash):
            return None

        # 用户状态检查
        if user.status != "ACTIVE":
            return None

        return user

    @staticmethod
    def login(db: Session, user: User) -> dict:
        """
        用户登录

        Args:
            db: 数据库会话
            user: 用户对象

        Returns:
            dict: 包含 token 和用户信息
        """
        # 创建 JWT Token
        token_data = {
            "user_id": user.user_id,
            "username": user.username,
            "name": user.name,
            "role": user.role,
        }
        access_token = create_access_token(token_data)

        # 更新最后登录时间
        update_last_login(db, user, datetime.now().isoformat())

        return {
            "access_token": access_token,
            "token_type": "bearer",
            "user": user,
        }

    @staticmethod
    def update_password(db: Session, user: User, old_password: str, new_password: str) -> bool:
        """
        修改密码

        Args:
            db: 数据库会话
            user: 用户对象
            old_password: 旧密码
            new_password: 新密码

        Returns:
            bool: 是否成功
        """
        # 验证旧密码
        if not verify_password(old_password, user.password_hash):
            return False

        # 更新密码
        user.password_hash = get_password_hash(new_password)
        db.commit()
        return True
