# 招财银行北京分行运营门户 - 数据模型设计

## 1. 概述

本文档定义了招财银行北京分行运营门户系统的数据库模型，包括实体关系、字段定义、约束条件和索引策略。所有模型均使用SQLAlchemy 2.x ORM进行定义。

## 2. 数据库配置

- **数据库类型**: MySQL 8.0+
- **字符集**: utf8mb4
- **排序规则**: utf8mb4_unicode_ci

## 3. 核心数据模型

### 3.1 用户实体 (User)

| 字段名 | 类型 | 约束 | 描述 |
|--------|------|------|------|
| user_id | UUID | PRIMARY KEY, NOT NULL | 用户唯一标识 |
| username | VARCHAR(50) | UNIQUE, NOT NULL | 用户名 |
| password_hash | VARCHAR(255) | NOT NULL | 密码哈希值 |
| real_name | VARCHAR(100) | NOT NULL | 真实姓名 |
| department | VARCHAR(100) | | 所属部门 |
| role | ENUM('customer_manager', 'operations_staff', 'approver', 'branch_manager') | NOT NULL | 用户角色 |
| email | VARCHAR(100) | | 邮箱地址 |
| phone | VARCHAR(20) | | 电话号码 |
| status | ENUM('active', 'inactive') | DEFAULT 'active', NOT NULL | 账户状态 |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP, NOT NULL | 创建时间 |
| updated_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, NOT NULL | 更新时间 |

**索引**:
- `idx_username`: username字段索引
- `idx_role`: role字段索引
- `idx_status`: status字段索引

**约束**:
- 用户名唯一性约束
- 角色值域约束
- 账户状态值域约束

### 3.2 客户拜访记录实体 (CustomerVisit)

| 字段名 | 类型 | 约束 | 描述 |
|--------|------|------|------|
| visit_id | UUID | PRIMARY KEY, NOT NULL | 拜访记录唯一标识 |
| customer_id | VARCHAR(50) | NOT NULL | 客户ID |
| customer_name | VARCHAR(200) | NOT NULL | 企业名称 |
| planned_date | DATE | NOT NULL | 计划拜访日期 |
| actual_date | DATE | | 实际拜访日期 |
| visit_method | ENUM('phone', 'face_to_face', 'video') | NOT NULL | 拜访方式 |
| products_interested | JSON | | 意向理财产品（JSON格式存储多选值） |
| participants | JSON | | 参与人员（JSON格式存储多选值） |
| status | ENUM('pending', 'completed', 'cancelled') | DEFAULT 'pending', NOT NULL | 状态 |
| visit_notes | TEXT | | 拜访备注 |
| creator_id | UUID | FOREIGN KEY, NOT NULL | 创建人ID |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP, NOT NULL | 创建时间 |
| updated_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, NOT NULL | 更新时间 |

**索引**:
- `idx_customer_id`: customer_id字段索引
- `idx_planned_date`: planned_date字段索引
- `idx_status`: status字段索引
- `idx_creator_id`: creator_id字段索引

**约束**:
- 计划拜访日期不能早于创建日期
- 实际拜访日期不能早于计划拜访日期（如果已设置）
- 客户ID格式验证

### 3.3 营销礼品申请实体 (GiftApplication)

| 字段名 | 类型 | 约束 | 描述 |
|--------|------|------|------|
| application_id | UUID | PRIMARY KEY, NOT NULL | 申请唯一标识 |
| applicant_id | UUID | FOREIGN KEY, NOT NULL | 申请人ID |
| recipient_id | UUID | FOREIGN KEY | 领用人ID（可选） |
| gift_items | JSON | NOT NULL | 礼品列表（JSON格式存储礼品信息） |
| total_amount | DECIMAL(10,2) | NOT NULL | 总金额 |
| planned_pickup_date | DATE | NOT NULL | 计划领用日期 |
| purpose_type | ENUM('customer_maintenance', 'marketing_activity', 'other') | NOT NULL | 目的类型 |
| related_visit_id | UUID | FOREIGN KEY | 关联客户拜访记录ID（可选） |
| application_status | ENUM('pending', 'approved', 'rejected', 'cancelled') | DEFAULT 'pending', NOT NULL | 申请状态 |
| application_date | DATE | DEFAULT CURRENT_DATE, NOT NULL | 申请日期 |
| approver_id | UUID | FOREIGN KEY | 审批人ID |
| approval_date | TIMESTAMP | | 审批日期 |
| rejection_reason | TEXT | | 驳回原因 |
| creator_id | UUID | FOREIGN KEY, NOT NULL | 创建人ID |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP, NOT NULL | 创建时间 |
| updated_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, NOT NULL | 更新时间 |

**索引**:
- `idx_applicant_id`: applicant_id字段索引
- `idx_application_status`: application_status字段索引
- `idx_application_date`: application_date字段索引
- `idx_approver_id`: approver_id字段索引

**约束**:
- 总金额必须大于0
- 计划领用日期不能早于当前日期
- 驳回时必须填写驳回原因
- 审批通过后不可再次审批

### 3.4 礼品台账实体 (GiftLedger)

| 字段名 | 类型 | 约束 | 描述 |
|--------|------|------|------|
| ledger_id | UUID | PRIMARY KEY, NOT NULL | 台账记录唯一标识 |
| gift_application_id | UUID | FOREIGN KEY, NOT NULL | 关联礼品申请ID |
| gift_type | VARCHAR(100) | NOT NULL | 礼品类型 |
| gift_name | VARCHAR(200) | NOT NULL | 礼品名称 |
| quantity | INTEGER | NOT NULL | 数量 |
| unit_price | DECIMAL(10,2) | NOT NULL | 单价 |
| total_price | DECIMAL(10,2) | NOT NULL | 总价 |
| pickup_date | DATE | | 实际领用日期 |
| pickup_person | VARCHAR(100) | | 领用人员 |
| purpose | TEXT | | 用途说明 |
| status | ENUM('picked_up', 'cancelled', 'pending') | DEFAULT 'pending', NOT NULL | 状态 |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP, NOT NULL | 创建时间 |
| updated_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, NOT NULL | 更新时间 |

**索引**:
- `idx_gift_application_id`: gift_application_id字段索引
- `idx_gift_type`: gift_type字段索引
- `idx_status`: status字段索引
- `idx_pickup_date`: pickup_date字段索引

**约束**:
- 数量必须大于0
- 单价和总价必须大于等于0
- 实际领用日期不能早于当前日期

### 3.5 首页轮播图实体 (HomepageCarousel)

| 字段名 | 类型 | 约束 | 描述 |
|--------|------|------|------|
| carousel_id | UUID | PRIMARY KEY, NOT NULL | 轮播图唯一标识 |
| title | VARCHAR(200) | NOT NULL | 标题 |
| image_url | VARCHAR(500) | NOT NULL | 图片URL |
| link_url | VARCHAR(500) | | 跳转链接 |
| sort_order | INTEGER | DEFAULT 0, NOT NULL | 排序序号 |
| is_active | BOOLEAN | DEFAULT TRUE, NOT NULL | 是否激活 |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP, NOT NULL | 创建时间 |
| updated_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, NOT NULL | 更新时间 |

**索引**:
- `idx_sort_order`: sort_order字段索引
- `idx_is_active`: is_active字段索引

**约束**:
- 排序序号不能为负数

### 3.6 新闻实体 (News)

| 字段名 | 类型 | 约束 | 描述 |
|--------|------|------|------|
| news_id | UUID | PRIMARY KEY, NOT NULL | 新闻唯一标识 |
| title | VARCHAR(200) | NOT NULL | 新闻标题 |
| content | LONGTEXT | NOT NULL | 新闻内容（富文本） |
| summary | VARCHAR(500) | | 新闻摘要 |
| author_id | UUID | FOREIGN KEY, NOT NULL | 作者ID |
| publish_date | TIMESTAMP | | 发布时间 |
| status | ENUM('draft', 'published', 'unpublished') | DEFAULT 'draft', NOT NULL | 状态 |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP, NOT NULL | 创建时间 |
| updated_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, NOT NULL | 更新时间 |

**索引**:
- `idx_author_id`: author_id字段索引
- `idx_status`: status字段索引
- `idx_publish_date`: publish_date字段索引

**约束**:
- 发布状态必须有发布时间

### 3.7 AI问答记录实体 (AIQuestion)

| 字段名 | 类型 | 约束 | 描述 |
|--------|------|------|------|
| question_id | UUID | PRIMARY KEY, NOT NULL | 问答记录唯一标识 |
| user_id | UUID | FOREIGN KEY, NOT NULL | 用户ID |
| question | TEXT | NOT NULL | 问题内容 |
| answer | TEXT | NOT NULL | 答案内容 |
| question_time | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP, NOT NULL | 提问时间 |
| session_id | VARCHAR(100) | NOT NULL | 会话ID |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP, NOT NULL | 创建时间 |

**索引**:
- `idx_user_id`: user_id字段索引
- `idx_session_id`: session_id字段索引
- `idx_question_time`: question_time字段索引

## 4. 实体关系图 (ERD)

```
User (1) ─────── (N) CustomerVisit (creator_id)
User (1) ─────── (N) GiftApplication (applicant_id)
User (1) ─────── (N) GiftApplication (approver_id)
User (1) ─────── (N) News (author_id)
User (1) ─────── (N) AIQuestion (user_id)

CustomerVisit (1) ─────── (N) GiftApplication (related_visit_id)
GiftApplication (1) ─────── (N) GiftLedger (gift_application_id)

User (1) ─────── (N) HomepageCarousel (created by context)
User (1) ─────── (N) GiftLedger (created by context)
```

## 5. 数据库模型实现 (SQLAlchemy 2.x)

### 5.1 基础模型类

```python
from sqlalchemy import Column, DateTime, String, func
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.dialects.mysql import UUID
import uuid

class Base(DeclarativeBase):
    """基础模型类"""
    pass

class BaseModel:
    """所有模型的基类"""
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    created_at = Column(DateTime, default=func.now(), nullable=False)
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now(), nullable=False)
```

### 5.2 用户模型

```python
from sqlalchemy import String, Text, Enum as SQLEnum
from sqlalchemy.orm import Mapped, mapped_column
from typing import Optional
import enum

class UserRole(str, enum.Enum):
    CUSTOMER_MANAGER = "customer_manager"
    OPERATIONS_STAFF = "operations_staff"
    APPROVER = "approver"
    BRANCH_MANAGER = "branch_manager"

class UserStatus(str, enum.Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"

class User(Base, BaseModel):
    __tablename__ = "users"
    
    username: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    real_name: Mapped[str] = mapped_column(String(100), nullable=False)
    department: Mapped[Optional[str]] = mapped_column(String(100))
    role: Mapped[UserRole] = mapped_column(SQLEnum(UserRole), nullable=False)
    email: Mapped[Optional[str]] = mapped_column(String(100))
    phone: Mapped[Optional[str]] = mapped_column(String(20))
    status: Mapped[UserStatus] = mapped_column(SQLEnum(UserStatus), default=UserStatus.ACTIVE, nullable=False)
```

### 5.3 客户拜访模型

```python
from sqlalchemy import Date, Text, JSON
from typing import Optional
import enum

class VisitMethod(str, enum.Enum):
    PHONE = "phone"
    FACE_TO_FACE = "face_to_face"
    VIDEO = "video"

class VisitStatus(str, enum.Enum):
    PENDING = "pending"
    COMPLETED = "completed"
    CANCELLED = "cancelled"

class CustomerVisit(Base, BaseModel):
    __tablename__ = "customer_visits"
    
    customer_id: Mapped[str] = mapped_column(String(50), nullable=False)
    customer_name: Mapped[str] = mapped_column(String(200), nullable=False)
    planned_date: Mapped[date] = mapped_column(Date, nullable=False)
    actual_date: Mapped[Optional[date]] = mapped_column(Date)
    visit_method: Mapped[VisitMethod] = mapped_column(SQLEnum(VisitMethod), nullable=False)
    products_interested: Mapped[Optional[dict]] = mapped_column(JSON)
    participants: Mapped[Optional[dict]] = mapped_column(JSON)
    status: Mapped[VisitStatus] = mapped_column(SQLEnum(VisitStatus), default=VisitStatus.PENDING, nullable=False)
    visit_notes: Mapped[Optional[str]] = mapped_column(Text)
    creator_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
```

### 5.4 礼品申请模型

```python
from sqlalchemy import Date, DateTime, Text, JSON, DECIMAL
from typing import Optional
import enum

class GiftApplicationStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    CANCELLED = "cancelled"

class GiftPurposeType(str, enum.Enum):
    CUSTOMER_MAINTENANCE = "customer_maintenance"
    MARKETING_ACTIVITY = "marketing_activity"
    OTHER = "other"

class GiftApplication(Base, BaseModel):
    __tablename__ = "gift_applications"
    
    applicant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    recipient_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True))
    gift_items: Mapped[dict] = mapped_column(JSON, nullable=False)
    total_amount: Mapped[Decimal] = mapped_column(DECIMAL(10, 2), nullable=False)
    planned_pickup_date: Mapped[date] = mapped_column(Date, nullable=False)
    purpose_type: Mapped[GiftPurposeType] = mapped_column(SQLEnum(GiftPurposeType), nullable=False)
    related_visit_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True))
    application_status: Mapped[GiftApplicationStatus] = mapped_column(
        SQLEnum(GiftApplicationStatus), 
        default=GiftApplicationStatus.PENDING, 
        nullable=False
    )
    application_date: Mapped[date] = mapped_column(Date, default=date.today, nullable=False)
    approver_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True))
    approval_date: Mapped[Optional[datetime]] = mapped_column(DateTime)
    rejection_reason: Mapped[Optional[str]] = mapped_column(Text)
    creator_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
```

### 5.5 礼品台账模型

```python
from sqlalchemy import Date, DECIMAL
from typing import Optional
import enum

class GiftLedgerStatus(str, enum.Enum):
    PICKED_UP = "picked_up"
    CANCELLED = "cancelled"
    PENDING = "pending"

class GiftLedger(Base, BaseModel):
    __tablename__ = "gift_ledger"
    
    gift_application_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    gift_type: Mapped[str] = mapped_column(String(100), nullable=False)
    gift_name: Mapped[str] = mapped_column(String(200), nullable=False)
    quantity: Mapped[int] = mapped_column(nullable=False)
    unit_price: Mapped[Decimal] = mapped_column(DECIMAL(10, 2), nullable=False)
    total_price: Mapped[Decimal] = mapped_column(DECIMAL(10, 2), nullable=False)
    pickup_date: Mapped[Optional[date]] = mapped_column(Date)
    pickup_person: Mapped[Optional[str]] = mapped_column(String(100))
    purpose: Mapped[Optional[str]] = mapped_column(Text)
    status: Mapped[GiftLedgerStatus] = mapped_column(
        SQLEnum(GiftLedgerStatus), 
        default=GiftLedgerStatus.PENDING, 
        nullable=False
    )
```

### 5.6 首页轮播图模型

```python
from sqlalchemy import Boolean, Integer
from typing import Optional

class HomepageCarousel(Base, BaseModel):
    __tablename__ = "homepage_carousel"
    
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    image_url: Mapped[str] = mapped_column(String(500), nullable=False)
    link_url: Mapped[Optional[str]] = mapped_column(String(500))
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
```

### 5.7 新闻模型

```python
from sqlalchemy import DateTime
from typing import Optional
import enum

class NewsStatus(str, enum.Enum):
    DRAFT = "draft"
    PUBLISHED = "published"
    UNPUBLISHED = "unpublished"

class News(Base, BaseModel):
    __tablename__ = "news"
    
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    summary: Mapped[Optional[str]] = mapped_column(String(500))
    author_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    publish_date: Mapped[Optional[datetime]] = mapped_column(DateTime)
    status: Mapped[NewsStatus] = mapped_column(
        SQLEnum(NewsStatus), 
        default=NewsStatus.DRAFT, 
        nullable=False
    )
```

### 5.8 AI问答模型

```python
from sqlalchemy import Text
from typing import Optional

class AIQuestion(Base, BaseModel):
    __tablename__ = "ai_questions"
    
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    question: Mapped[str] = mapped_column(Text, nullable=False)
    answer: Mapped[str] = mapped_column(Text, nullable=False)
    question_time: Mapped[datetime] = mapped_column(DateTime, default=func.now(), nullable=False)
    session_id: Mapped[str] = mapped_column(String(100), nullable=False)
```

## 6. 数据库迁移策略

### 6.1 初始迁移
1. 创建基础表结构
2. 插入初始数据（如角色定义）
3. 创建索引

### 6.2 后续迁移
1. 版本化迁移脚本
2. 数据备份策略
3. 回滚机制

## 7. 性能优化建议

### 7.1 索引策略
- 为经常查询的字段创建索引
- 为外键字段创建索引
- 考虑复合索引以优化复杂查询

### 7.2 分区策略
- 对于大量数据的表（如AI问答记录），考虑按时间分区
- 客户拜访记录可按日期分区

### 7.3 缓存策略
- 对于频繁查询但不常变化的数据（如用户信息），使用Redis缓存
- 对于计算密集的统计查询，缓存结果