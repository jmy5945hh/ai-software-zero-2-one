from sqlalchemy.orm import Session
from typing import Optional
from models import User as UserModel
from schemas import UserCreate, UserUpdate
from core.security import get_password_hash
from uuid import UUID


class UserService:
    @staticmethod
    def get_user_by_id(db: Session, user_id: str) -> Optional[UserModel]:
        """
        Get user by ID
        """
        return db.query(UserModel).filter(UserModel.user_id == user_id).first()
    
    @staticmethod
    def get_user_by_username(db: Session, username: str) -> Optional[UserModel]:
        """
        Get user by username
        """
        return db.query(UserModel).filter(UserModel.username == username).first()
    
    @staticmethod
    def get_users(
        db: Session, 
        skip: int = 0, 
        limit: int = 100,
        role: Optional[str] = None,
        status: Optional[str] = None,
        search: Optional[str] = None
    ) -> tuple[list[UserModel], int]:
        """
        Get users with filters and pagination
        """
        query = db.query(UserModel)
        
        # Apply filters
        if role:
            query = query.filter(UserModel.role == role)
        if status:
            query = query.filter(UserModel.status == status)
        if search:
            query = query.filter(
                UserModel.username.contains(search) | 
                UserModel.real_name.contains(search) |
                UserModel.department.contains(search)
            )
        
        # Get total count
        total = query.count()
        
        # Apply pagination
        users = query.offset(skip).limit(limit).all()
        
        return users, total
    
    @staticmethod
    def create_user(db: Session, user_create: UserCreate) -> UserModel:
        """
        Create a new user
        """
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
        
        return db_user
    
    @staticmethod
    def update_user(db: Session, user_id: str, user_update: UserUpdate) -> Optional[UserModel]:
        """
        Update user information
        """
        db_user = db.query(UserModel).filter(UserModel.user_id == user_id).first()
        if not db_user:
            return None
        
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
        
        return db_user