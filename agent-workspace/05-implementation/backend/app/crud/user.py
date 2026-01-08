"""用户 CRUD 操作"""
from sqlalchemy.orm import Session
from typing import Optional
from app.models.user import User


def get_user_by_username(db: Session, username: str) -> Optional[User]:
    """
    根据用户名获取用户

    Args:
        db: 数据库会话
        username: 用户名

    Returns:
        Optional[User]: 用户对象或 None
    """
    return db.query(User).filter(User.username == username).first()


def get_user_by_id(db: Session, user_id: str) -> Optional[User]:
    """
    根据用户ID获取用户

    Args:
        db: 数据库会话
        user_id: 用户ID

    Returns:
        Optional[User]: 用户对象或 None
    """
    return db.query(User).filter(User.user_id == user_id).first()


def update_user(db: Session, user: User, **kwargs) -> User:
    """
    更新用户信息

    Args:
        db: 数据库会话
        user: 用户对象
        **kwargs: 要更新的字段

    Returns:
        User: 更新后的用户对象
    """
    for key, value in kwargs.items():
        if hasattr(user, key) and value is not None:
            setattr(user, key, value)

    db.commit()
    db.refresh(user)
    return user


def update_last_login(db: Session, user: User, login_time: str) -> None:
    """
    更新用户最后登录时间

    Args:
        db: 数据库会话
        user: 用户对象
        login_time: 登录时间
    """
    user.last_login_time = login_time
    db.commit()
