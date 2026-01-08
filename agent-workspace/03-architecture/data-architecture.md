# 数据架构设计

**文档版本**: v1.0
**创建时间**: 2026-01-08
**负责人**: 系统架构师
**关联文档**: data-concepts.md, business-rules.md, component-diagram.md

---

## 文档说明

本文档定义"招财银行北京分行运营门户系统"的数据架构设计，包括数据库选型、数据表设计、索引设计、关联关系和数据迁移策略。

---

## 1. 数据库选型

### 1.1 选型决策

**数据库**: MySQL 8.0+

**理由**:
1. **企业级标准**: 银行等金融行业首选数据库
2. **功能丰富**: JSON 支持、CTE（公共表表达式）、窗口函数
3. **性能优秀**: InnoDB 引擎，事务支持完善
4. **生态成熟**: 监控、备份、高可用方案成熟
5. **团队经验**: 团队对 MySQL 熟悉，学习成本低

### 1.2 数据库配置

```sql
-- 字符集
CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci

-- 时区
TIMEZONE = '+08:00'

-- 引擎
ENGINE = InnoDB
```

### 1.3 数据库连接配置

```python
# config.py
DATABASE_CONFIG = {
    "host": "127.0.0.1",
    "port": 3306,
    "database": "zero_one",
    "username": "root",
    "password": "99912345",
    "charset": "utf8mb4",
    "pool_size": 5,
    "max_overflow": 10,
    "pool_recycle": 3600,
}
```

---

## 2. 数据表设计

### 2.1 表命名规范

- 使用小写字母和下划线
- 表名使用复数形式（如 `users`, `customer_visits`）
- 关联表使用 `_` 连接（如 `gift_requisition_items`）

### 2.2 字段命名规范

- 使用小写字母和下划线
- 主键统一使用 `{table}_id`（如 `user_id`, `visit_id`）
- 外键使用 `{referenced_table}_id`（如 `create_by`）
- 时间字段统一使用 `{action}_time`（如 `create_time`, `update_time`）
- 布尔字段使用 `is_` 前缀（如 `is_active`）

### 2.3 通用字段规范

所有表包含以下通用字段：

```sql
-- 主键
id              VARCHAR(32) PRIMARY KEY COMMENT '主键ID',

-- 时间戳
create_time     DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
update_time     DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',

-- 软删除（可选）
is_deleted      TINYINT(1) DEFAULT 0 COMMENT '是否删除（0否 1是）',
```

---

## 3. 核心数据表

### 3.1 用户表 (users)

**用途**: 存储系统用户信息

```sql
CREATE TABLE users (
    user_id         VARCHAR(32) PRIMARY KEY COMMENT '用户ID',
    username        VARCHAR(50) NOT NULL UNIQUE COMMENT '登录账号',
    password_hash   VARCHAR(255) NOT NULL COMMENT '密码哈希',
    name            VARCHAR(50) NOT NULL COMMENT '用户姓名',
    role            ENUM('CUSTOMER_MANAGER', 'OPERATIONS', 'APPROVER', 'MANAGER') NOT NULL COMMENT '角色',
    department      VARCHAR(100) COMMENT '所属部门',
    status          ENUM('ACTIVE', 'INACTIVE', 'LOCKED') DEFAULT 'ACTIVE' COMMENT '用户状态',
    last_login_time DATETIME COMMENT '最后登录时间',
    create_time     DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_time     DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',

    INDEX idx_username (username),
    INDEX idx_role (role),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户表';
```

**字段说明**:
- `user_id`: 主键，使用 UUID 或雪花算法
- `username`: 登录账号，唯一索引
- `password_hash`: 密码哈希（使用 bcrypt 或 PBKDF2）
- `role`: 用户角色，枚举值
- `status`: 用户状态，在职/离职/禁用

**索引**:
- `idx_username`: 登录时查询
- `idx_role`: 按角色筛选
- `idx_status`: 按状态筛选

---

### 3.2 客户拜访记录表 (customer_visits)

**用途**: 存储客户拜访和营销记录

```sql
CREATE TABLE customer_visits (
    visit_id            VARCHAR(32) PRIMARY KEY COMMENT '拜访记录ID',
    customer_id         VARCHAR(50) NOT NULL COMMENT '客户ID',
    company_name        VARCHAR(200) NOT NULL COMMENT '企业名称',
    planned_date        DATE NOT NULL COMMENT '计划拜访日期',
    actual_date         DATE COMMENT '实际拜访日期',
    visit_method        ENUM('ON_SITE', 'PHONE', 'VIDEO', 'EMAIL', 'OTHER') NOT NULL COMMENT '拜访方式',
    interested_products JSON COMMENT '意向理财产品列表',
    participants        JSON COMMENT '参与人员列表（用户ID数组）',
    status              ENUM('NEW', 'IN_PROGRESS', 'SUCCESS', 'FAILED', 'CANCELLED') NOT NULL DEFAULT 'NEW' COMMENT '拜访状态',
    notes               TEXT COMMENT '备注信息',
    create_by           VARCHAR(32) NOT NULL COMMENT '创建人（用户ID）',
    create_time         DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_time         DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',

    FOREIGN KEY (create_by) REFERENCES users(user_id),
    INDEX idx_customer_id (customer_id),
    INDEX idx_planned_date (planned_date),
    INDEX idx_actual_date (actual_date),
    INDEX idx_status (status),
    INDEX idx_create_by (create_by)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='客户拜访记录表';
```

**字段说明**:
- `visit_id`: 主键
- `customer_id`: 客户ID（待确认来源）
- `visit_method`: 拜访方式枚举（现场/电话/视频/邮件/其他）
- `interested_products`: JSON 数组，存储意向理财产品
- `participants`: JSON 数组，存储参与人员的用户ID
- `status`: 拜访状态（新建/进行中/成功/失败/已取消）

**索引**:
- `idx_customer_id`: 按客户查询
- `idx_planned_date`: 按计划日期查询
- `idx_actual_date`: 按实际日期查询
- `idx_status`: 按状态筛选
- `idx_create_by`: 按创建人查询

**待确认事项**:
- `customer_id` 的数据来源和格式
- `visit_method` 的枚举值定义
- `status` 的枚举值定义和流转规则
- `interested_products` 的数据结构

---

### 3.3 礼品表 (gifts)

**用途**: 存储礼品基础信息

```sql
CREATE TABLE gifts (
    gift_id             VARCHAR(32) PRIMARY KEY COMMENT '礼品ID',
    gift_name           VARCHAR(200) NOT NULL COMMENT '礼品名称',
    gift_category       VARCHAR(50) NOT NULL COMMENT '礼品分类',
    unit_price          DECIMAL(10, 2) NOT NULL COMMENT '单价（元）',
    stock_quantity      INT DEFAULT 0 COMMENT '库存数量',
    description         TEXT COMMENT '礼品描述',
    status              ENUM('ACTIVE', 'INACTIVE') DEFAULT 'ACTIVE' COMMENT '状态',
    create_time         DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_time         DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',

    INDEX idx_category (gift_category),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='礼品表';
```

**字段说明**:
- `gift_id`: 主键
- `gift_category`: 礼品分类（待确认分类维度）
- `unit_price`: 单价，精确到分
- `stock_quantity`: 库存数量（可选，待确认是否需要）

**索引**:
- `idx_category`: 按分类筛选
- `idx_status`: 按状态筛选

**待确认事项**:
- `gift_category` 的分类维度（如"实物"/"服务"，或"电子产品"/"日用品"）
- `stock_quantity` 是否需要（库存管理是否纳入本次范围）

---

### 3.4 礼品领用申请表 (gift_requisitions)

**用途**: 存储礼品领用申请和审批记录

```sql
CREATE TABLE gift_requisitions (
    requisition_id      VARCHAR(32) PRIMARY KEY COMMENT '申请单ID',
    applicant           VARCHAR(32) NOT NULL COMMENT '申请人（用户ID）',
    recipient           VARCHAR(32) NOT NULL COMMENT '领用人（用户ID）',
    total_amount        DECIMAL(10, 2) NOT NULL COMMENT '总金额（元）',
    planned_date        DATE NOT NULL COMMENT '计划领用日期',
    purpose_type        ENUM('CUSTOMER_VISIT', 'HOLIDAY', 'MARKETING', 'OTHER') NOT NULL COMMENT '目的类型',
    related_visit_id    VARCHAR(32) COMMENT '关联客户拜访记录ID',
    approval_status     ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING' COMMENT '审批状态',
    rejection_reason    TEXT COMMENT '驳回原因',
    approver            VARCHAR(32) COMMENT '审批人（用户ID）',
    approval_time       DATETIME COMMENT '审批时间',
    create_time         DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_time         DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',

    FOREIGN KEY (applicant) REFERENCES users(user_id),
    FOREIGN KEY (recipient) REFERENCES users(user_id),
    FOREIGN KEY (approver) REFERENCES users(user_id),
    INDEX idx_applicant (applicant),
    INDEX idx_approval_status (approval_status),
    INDEX idx_planned_date (planned_date),
    INDEX idx_purpose_type (purpose_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='礼品领用申请表';
```

**字段说明**:
- `requisition_id`: 主键
- `applicant`: 申请人，外键关联 users 表
- `recipient`: 领用人，外键关联 users 表
- `total_amount`: 总金额，自动计算
- `purpose_type`: 目的类型（客户拜访/节日慰问/营销活动/其他）
- `approval_status`: 审批状态（待审批/已通过/已驳回）

**索引**:
- `idx_applicant`: 按申请人查询
- `idx_approval_status`: 按审批状态筛选
- `idx_planned_date`: 按计划日期查询
- `idx_purpose_type`: 按目的类型筛选

**待确认事项**:
- `purpose_type` 的枚举值定义

---

### 3.5 礼品申请明细表 (gift_requisition_items)

**用途**: 存储礼品申请的明细项（多对多关系）

```sql
CREATE TABLE gift_requisition_items (
    item_id             VARCHAR(32) PRIMARY KEY COMMENT '明细项ID',
    requisition_id      VARCHAR(32) NOT NULL COMMENT '申请单ID',
    gift_id             VARCHAR(32) NOT NULL COMMENT '礼品ID',
    quantity            INT NOT NULL COMMENT '数量',
    unit_price          DECIMAL(10, 2) NOT NULL COMMENT '单价（元）',
    subtotal            DECIMAL(10, 2) NOT NULL COMMENT '小计（元）',
    create_time         DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',

    FOREIGN KEY (requisition_id) REFERENCES gift_requisitions(requisition_id) ON DELETE CASCADE,
    FOREIGN KEY (gift_id) REFERENCES gifts(gift_id),
    INDEX idx_requisition_id (requisition_id),
    INDEX idx_gift_id (gift_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='礼品申请明细表';
```

**字段说明**:
- `item_id`: 主键
- `requisition_id`: 关联申请单，外键
- `gift_id`: 关联礼品，外键
- `quantity`: 数量
- `unit_price`: 单价（快照，防止礼品价格变动）
- `subtotal`: 小计（quantity * unit_price）

**索引**:
- `idx_requisition_id`: 查询申请单的所有明细
- `idx_gift_id`: 按礼品查询

**设计说明**:
- 采用独立表存储明细项，支持一个申请单包含多个礼品
- `unit_price` 使用快照，防止礼品基础价格变动影响历史记录

---

### 3.6 轮播图表 (carousels)

**用途**: 存储首页轮播图内容

```sql
CREATE TABLE carousels (
    carousel_id         VARCHAR(32) PRIMARY KEY COMMENT '轮播图ID',
    title               VARCHAR(200) NOT NULL COMMENT '标题',
    description         TEXT COMMENT '描述',
    image_url           VARCHAR(500) NOT NULL COMMENT '图片URL',
    link_url            VARCHAR(500) COMMENT '跳转链接',
    sort_order          INT DEFAULT 0 COMMENT '排序序号（数字越小越靠前）',
    status              ENUM('ACTIVE', 'INACTIVE') DEFAULT 'ACTIVE' COMMENT '状态',
    create_by           VARCHAR(32) NOT NULL COMMENT '创建人（用户ID）',
    create_time         DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_time         DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',

    FOREIGN KEY (create_by) REFERENCES users(user_id),
    INDEX idx_status (status),
    INDEX idx_sort_order (sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='轮播图表';
```

**字段说明**:
- `carousel_id`: 主键
- `image_url`: 图片URL（可存储相对路径）
- `link_url`: 点击跳转链接（可选）
- `sort_order`: 排序序号

**索引**:
- `idx_status`: 查询启用的轮播图
- `idx_sort_order`: 排序查询

---

### 3.7 新闻表 (news)

**用途**: 存储首页新闻公告

```sql
CREATE TABLE news (
    news_id             VARCHAR(32) PRIMARY KEY COMMENT '新闻ID',
    title               VARCHAR(200) NOT NULL COMMENT '新闻标题',
    summary             VARCHAR(500) NOT NULL COMMENT '新闻摘要',
    content             TEXT NOT NULL COMMENT '新闻正文',
    publish_time        DATETIME COMMENT '发布时间',
    status              ENUM('DRAFT', 'PUBLISHED', 'WITHDRAWN') DEFAULT 'DRAFT' COMMENT '状态',
    create_by           VARCHAR(32) NOT NULL COMMENT '创建人（用户ID）',
    create_time         DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_time         DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',

    FOREIGN KEY (create_by) REFERENCES users(user_id),
    INDEX idx_status (status),
    INDEX idx_publish_time (publish_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='新闻表';
```

**字段说明**:
- `news_id`: 主键
- `summary`: 新闻摘要，列表页展示
- `content`: 新闻正文，支持富文本
- `publish_time`: 发布时间
- `status`: 状态（草稿/已发布/已撤回）

**索引**:
- `idx_status`: 查询已发布的新闻
- `idx_publish_time`: 按发布时间排序

---

### 3.8 系统配置表 (system_configs)

**用途**: 存储系统全局配置参数

```sql
CREATE TABLE system_configs (
    config_key         VARCHAR(100) PRIMARY KEY COMMENT '配置项键名',
    config_value       TEXT NOT NULL COMMENT '配置项值',
    description        VARCHAR(500) COMMENT '配置项描述',
    create_time        DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_time        DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='系统配置表';
```

**字段说明**:
- `config_key`: 配置项键名（如 `session.timeout`, `password.min_length`）
- `config_value`: 配置项值（JSON 字符串）
- `description`: 配置项描述

**示例配置**:
```json
{
  "session.timeout": "7200",
  "password.min_length": "8",
  "password.max_attempts": "5",
  "ai.max_history": "10"
}
```

---

## 4. ER 图（实体关系图）

### 4.1 实体关系描述

```
用户 (users)
  ├── 1:N → 客户拜访记录 (customer_visits) [作为创建人]
  ├── 1:N → 礼品申请 (gift_requisitions) [作为申请人]
  ├── 1:N → 礼品申请 (gift_requisitions) [作为领用人]
  ├── 1:N → 礼品申请 (gift_requisitions) [作为审批人]
  ├── 1:N → 轮播图 (carousels) [作为创建人]
  └── 1:N → 新闻 (news) [作为创建人]

客户拜访记录 (customer_visits)
  └── 1:N → 礼品申请 (gift_requisitions) [关联拜访记录]

礼品 (gifts)
  └── 1:N → 礼品申请明细 (gift_requisition_items)

礼品申请 (gift_requisitions)
  └── 1:N → 礼品申请明细 (gift_requisition_items)
```

### 4.2 关系类型说明

| 关系 | 说明 |
| --- | --- |
| **1:N** | 一对多关系，如一个用户可创建多条拜访记录 |
| **N:M** | 多对多关系，如一个礼品申请包含多个礼品（通过明细表实现） |

### 4.3 外键约束设计

```sql
-- 礼品申请明细表
ALTER TABLE gift_requisition_items
ADD CONSTRAINT fk_requisition
FOREIGN KEY (requisition_id) REFERENCES gift_requisitions(requisition_id) ON DELETE CASCADE;

-- 用户外键
ALTER TABLE customer_visits
ADD CONSTRAINT fk_create_user
FOREIGN KEY (create_by) REFERENCES users(user_id) ON DELETE RESTRICT;

-- 其他外键类似...
```

**外键策略**:
- `ON DELETE CASCADE`: 删除主表记录时，自动删除从表记录（如礼品申请明细）
- `ON DELETE RESTRICT`: 删除主表记录时，如果有从表记录则禁止删除（如用户、拜访记录）

---

## 5. 索引设计

### 5.1 索引设计原则

1. **为 WHERE 子句创建索引**: 经常查询的字段
2. **为 JOIN 操作创建索引**: 外键字段
3. **为 ORDER BY 创建索引**: 排序字段
4. **避免过度索引**: 每个表索引不超过 5 个

### 5.2 索引汇总表

| 表名 | 索引名 | 索引字段 | 索引类型 | 用途 |
| --- | --- | --- | --- | --- |
| users | idx_username | username | UNIQUE | 登录查询 |
| users | idx_role | role | INDEX | 按角色筛选 |
| users | idx_status | status | INDEX | 按状态筛选 |
| customer_visits | idx_customer_id | customer_id | INDEX | 按客户查询 |
| customer_visits | idx_planned_date | planned_date | INDEX | 按计划日期查询 |
| customer_visits | idx_actual_date | actual_date | INDEX | 按实际日期查询 |
| customer_visits | idx_status | status | INDEX | 按状态筛选 |
| customer_visits | idx_create_by | create_by | INDEX | 按创建人查询 |
| gifts | idx_category | gift_category | INDEX | 按分类筛选 |
| gifts | idx_status | status | INDEX | 按状态筛选 |
| gift_requisitions | idx_applicant | applicant | INDEX | 按申请人查询 |
| gift_requisitions | idx_approval_status | approval_status | INDEX | 按审批状态筛选 |
| gift_requisitions | idx_planned_date | planned_date | INDEX | 按计划日期查询 |
| gift_requisitions | idx_purpose_type | purpose_type | INDEX | 按目的类型筛选 |
| gift_requisition_items | idx_requisition_id | requisition_id | INDEX | 查询申请明细 |
| carousels | idx_status | status | INDEX | 查询启用轮播图 |
| carousels | idx_sort_order | sort_order | INDEX | 排序 |
| news | idx_status | status | INDEX | 查询已发布新闻 |
| news | idx_publish_time | publish_time | INDEX | 按发布时间排序 |

---

## 6. 数据迁移策略

### 6.1 数据库迁移工具

使用 **Alembic** 作为数据库迁移工具。

**理由**:
1. 与 SQLAlchemy 深度集成
2. 自动生成迁移脚本
3. 支持版本控制和回滚
4. AI 友好，易于生成

### 6.2 迁移脚本结构

```python
# alembic/versions/
├── 001_initial_schema.py           # 初始化表结构
├── 002_add_user_indexes.py         # 添加用户表索引
├── 003_add_gift_table.py           # 添加礼品表
└── ...
```

### 6.3 迁移命令

```bash
# 生成迁移脚本
alembic revision --autogenerate -m "添加礼品表"

# 执行迁移
alembic upgrade head

# 回滚迁移
alembic downgrade -1

# 查看迁移历史
alembic history
```

### 6.4 数据迁移检查清单

- [ ] 所有表已创建
- [ ] 所有外键已添加
- [ ] 所有索引已创建
- [ ] 初始数据已导入（如系统配置、默认用户）
- [ ] 迁移脚本可回滚
- [ ] 备份原数据库

---

## 7. 数据备份与恢复策略

### 7.1 备份策略

#### 备份类型
1. **全量备份**: 每周一次，备份整个数据库
2. **增量备份**: 每天一次，备份变更数据
3. **日志备份**: 实时备份 binlog（可选）

#### 备份命令

```bash
# 全量备份
mysqldump -u root -p --single-transaction --routines --triggers \
  zero_one > backup_$(date +%Y%m%d).sql

# 增量备份（使用 binlog）
mysqlbinlog --start-datetime="2026-01-08 00:00:00" \
  --stop-datetime="2026-01-09 00:00:00" \
  mysql-bin.000001 > increment_20260108.sql
```

#### 备份保留策略
- 全量备份保留 1 个月
- 增量备份保留 1 周

### 7.2 恢复策略

```bash
# 恢复全量备份
mysql -u root -p zero_one < backup_20260108.sql

# 恢复增量备份
mysql -u root -p zero_one < increment_20260108.sql
```

### 7.3 灾难恢复计划

1. **RPO (恢复点目标)**: 最多丢失 1 天数据
2. **RTO (恢复时间目标)**: 4 小时内恢复服务
3. **演练频率**: 每季度演练一次恢复流程

---

## 8. 数据一致性保证

### 8.1 事务管理

```python
from sqlalchemy.orm import Session

def create_gift_requisition(db: Session, requisition: GiftCreate):
    try:
        with db.begin():
            # 创建申请单
            req = GiftRequisition(**requisition.dict())
            db.add(req)

            # 创建明细项
            for item in requisition.items:
                req_item = GiftRequisitionItem(
                    requisition_id=req.requisition_id,
                    **item.dict()
                )
                db.add(req_item)

            # 扣减库存（可选）
            for item in requisition.items:
                gift = db.query(Gift).filter_by(gift_id=item.gift_id).one()
                gift.stock_quantity -= item.quantity

            # 提交事务
            # 自动提交 with db.begin()
    except Exception as e:
        # 自动回滚
        raise e
```

### 8.2 并发控制

- **乐观锁**: 使用 `update_time` 字段检测并发修改
- **悲观锁**: 使用 `SELECT ... FOR UPDATE` 锁定记录（审批场景）

### 8.3 数据校验

- **数据库层**: 外键约束、NOT NULL 约束、枚举约束
- **应用层**: Pydantic 数据校验
- **业务层**: Service 层业务规则校验

---

## 9. 数据字典

### 9.1 枚举值定义

#### 用户角色 (users.role)

| 值 | 说明 | 权限范围 |
| --- | --- | --- |
| CUSTOMER_MANAGER | 客户经理 | 登记拜访记录、提交礼品申请、查看个人数据 |
| OPERATIONS | 运营人员 | 维护首页内容、查看运营数据、查看礼品台账 |
| APPROVER | 审批人员 | 审批礼品申请、查看审批历史 |
| MANAGER | 分行管理者 | 查看运营数据大屏、查看所有统计数据 |

#### 拜访方式 (customer_visits.visit_method)

| 值 | 说明 |
| --- | --- |
| ON_SITE | 现场 |
| PHONE | 电话 |
| VIDEO | 视频 |
| EMAIL | 邮件 |
| OTHER | 其他 |

**待确认**: 是否需要调整枚举值

#### 拜访状态 (customer_visits.status)

| 值 | 说明 |
| --- | --- |
| NEW | 新建 |
| IN_PROGRESS | 进行中 |
| SUCCESS | 成功 |
| FAILED | 失败 |
| CANCELLED | 已取消 |

**待确认**: 是否需要调整枚举值和流转规则

#### 审批状态 (gift_requisitions.approval_status)

| 值 | 说明 |
| --- | --- |
| PENDING | 待审批 |
| APPROVED | 已通过 |
| REJECTED | 已驳回 |

#### 目的类型 (gift_requisitions.purpose_type)

| 值 | 说明 |
| --- | --- |
| CUSTOMER_VISIT | 客户拜访 |
| HOLIDAY | 节日慰问 |
| MARKETING | 营销活动 |
| OTHER | 其他 |

**待确认**: 是否需要调整枚举值

---

## 10. 待确认事项

基于数据架构设计，以下事项需要与业务方确认：

1. **客户ID (customer_id)**:
   - 数据来源（是否需要客户主数据表）
   - 格式规范

2. **拜访方式 (visit_method)**:
   - 枚举值是否完整
   - 是否需要其他方式（如微信、短信）

3. **拜访状态 (status)**:
   - 枚举值是否完整
   - 状态流转规则

4. **意向理财产品 (interested_products)**:
   - 是否需要理财产品主数据表
   - JSON 数据结构定义

5. **礼品分类 (gift_category)**:
   - 分类维度定义（如"实物"/"服务"，或"电子产品"/"日用品"）

6. **目的类型 (purpose_type)**:
   - 枚举值是否完整

7. **库存管理**:
   - 是否需要管理礼品库存数量
   - 是否需要记录实际领用日期和数量

8. **AI 对话历史**:
   - 是否需要持久化存储对话历史
   - 存储位置（MySQL 或 Redis）

---

**文档变更记录**:
- v1.0 (2026-01-08): 初始版本，定义数据架构设计
