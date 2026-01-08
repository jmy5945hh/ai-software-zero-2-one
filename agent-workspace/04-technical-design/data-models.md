# 数据模型详细设计

**文档版本**: v1.0
**创建时间**: 2026-01-08
**负责人**: 技术负责人
**关联文档**: data-architecture.md, business-rules.md, data-concepts.md

---

## 文档说明

本文档基于 data-architecture.md 中的数据架构设计,提供详细的表结构定义、字段约束、索引设计和数据字典,可直接用于数据库创建和 ORM 模型生成。

---

## 1. 用户表 (users)

### 1.1 表结构

```sql
CREATE TABLE users (
    user_id         VARCHAR(32) PRIMARY KEY COMMENT '用户ID',
    username        VARCHAR(50) NOT NULL UNIQUE COMMENT '登录账号',
    password_hash   VARCHAR(255) NOT NULL COMMENT '密码哈希(bcrypt)',
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

### 1.2 字段详细说明

| 字段名 | 类型 | 长度 | 必填 | 默认值 | 约束 | 说明 |
| --- | --- | --- | --- | --- | --- | --- |
| user_id | VARCHAR | 32 | 是 | - | PRIMARY KEY | 用户唯一标识,使用UUID或雪花算法生成 |
| username | VARCHAR | 50 | 是 | - | UNIQUE | 登录账号,全局唯一 |
| password_hash | VARCHAR | 255 | 是 | - | NOT NULL | 密码哈希值,使用bcrypt加密 |
| name | VARCHAR | 50 | 是 | - | NOT NULL | 用户姓名 |
| role | ENUM | - | 是 | - | NOT NULL | 用户角色,4个枚举值之一 |
| department | VARCHAR | 100 | 否 | NULL | - | 所属部门 |
| status | ENUM | - | 是 | ACTIVE | NOT NULL | 用户状态,默认为在职 |
| last_login_time | DATETIME | - | 否 | NULL | - | 最后登录时间 |
| create_time | DATETIME | - | 是 | CURRENT_TIMESTAMP | NOT NULL | 创建时间,自动设置 |
| update_time | DATETIME | - | 是 | CURRENT_TIMESTAMP | NOT NULL | 更新时间,自动更新 |

### 1.3 索引设计

| 索引名 | 字段 | 类型 | 理由 |
| --- | --- | --- | --- |
| PRIMARY | user_id | 主键 | 主键索引 |
| idx_username | username | UNIQUE | 登录时查询,保证唯一性 |
| idx_role | role | INDEX | 按角色筛选用户 |
| idx_status | status | INDEX | 按状态筛选用户 |

### 1.4 数据字典

**角色 (role)**:
- `CUSTOMER_MANAGER`: 客户经理
- `OPERATIONS`: 运营人员
- `APPROVER`: 审批人员
- `MANAGER`: 分行管理者

**状态 (status)**:
- `ACTIVE`: 在职
- `INACTIVE`: 离职
- `LOCKED`: 禁用

---

## 2. 客户拜访记录表 (customer_visits)

### 2.1 表结构

```sql
CREATE TABLE customer_visits (
    visit_id            VARCHAR(32) PRIMARY KEY COMMENT '拜访记录ID',
    customer_id         VARCHAR(50) NOT NULL COMMENT '客户ID',
    company_name        VARCHAR(200) NOT NULL COMMENT '企业名称',
    planned_date        DATE NOT NULL COMMENT '计划拜访日期',
    actual_date         DATE COMMENT '实际拜访日期',
    visit_method        ENUM('ON_SITE', 'PHONE', 'VIDEO', 'EMAIL', 'OTHER') NOT NULL COMMENT '拜访方式',
    interested_products JSON COMMENT '意向理财产品列表(JSON数组)',
    participants        JSON COMMENT '参与人员列表(JSON数组,存储用户ID)',
    status              ENUM('NEW', 'IN_PROGRESS', 'SUCCESS', 'FAILED', 'CANCELLED') NOT NULL DEFAULT 'NEW' COMMENT '拜访状态',
    notes               TEXT COMMENT '备注信息',
    create_by           VARCHAR(32) NOT NULL COMMENT '创建人(用户ID)',
    create_time         DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_time         DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',

    FOREIGN KEY (create_by) REFERENCES users(user_id) ON DELETE RESTRICT,
    INDEX idx_customer_id (customer_id),
    INDEX idx_planned_date (planned_date),
    INDEX idx_actual_date (actual_date),
    INDEX idx_status (status),
    INDEX idx_create_by (create_by)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='客户拜访记录表';
```

### 2.2 字段详细说明

| 字段名 | 类型 | 长度 | 必填 | 默认值 | 约束 | 说明 |
| --- | --- | --- | --- | --- | --- | --- |
| visit_id | VARCHAR | 32 | 是 | - | PRIMARY KEY | 拜访记录唯一标识 |
| customer_id | VARCHAR | 50 | 是 | - | NOT NULL | 客户ID(待确认来源) |
| company_name | VARCHAR | 200 | 是 | - | NOT NULL | 企业名称 |
| planned_date | DATE | - | 是 | - | NOT NULL | 计划拜访日期 |
| actual_date | DATE | - | 否 | NULL | - | 实际拜访日期 |
| visit_method | ENUM | - | 是 | - | NOT NULL | 拜访方式,5个枚举值之一 |
| interested_products | JSON | - | 否 | NULL | - | 意向理财产品列表,存储JSON数组 |
| participants | JSON | - | 否 | NULL | - | 参与人员列表,存储用户ID数组 |
| status | ENUM | - | 是 | NEW | NOT NULL | 拜访状态,默认为"新建" |
| notes | TEXT | - | 否 | NULL | - | 备注信息 |
| create_by | VARCHAR | 32 | 是 | - | NOT NULL, FOREIGN KEY | 创建人ID,关联users表 |
| create_time | DATETIME | - | 是 | CURRENT_TIMESTAMP | NOT NULL | 创建时间 |
| update_time | DATETIME | - | 是 | CURRENT_TIMESTAMP | NOT NULL | 更新时间 |

### 2.3 索引设计

| 索引名 | 字段 | 类型 | 理由 |
| --- | --- | --- | --- |
| PRIMARY | visit_id | 主键 | 主键索引 |
| idx_customer_id | customer_id | INDEX | 按客户查询拜访记录 |
| idx_planned_date | planned_date | INDEX | 按计划日期查询 |
| idx_actual_date | actual_date | INDEX | 按实际日期查询 |
| idx_status | status | INDEX | 按状态筛选 |
| idx_create_by | create_by | INDEX | 按创建人查询 |

### 2.4 数据字典

**拜访方式 (visit_method)**:
- `ON_SITE`: 现场
- `PHONE`: 电话
- `VIDEO`: 视频
- `EMAIL`: 邮件
- `OTHER`: 其他

**拜访状态 (status)**:
- `NEW`: 新建
- `IN_PROGRESS`: 进行中
- `SUCCESS`: 成功
- `FAILED`: 失败
- `CANCELLED`: 已取消

**JSON 字段示例**:
```json
// interested_products
["理财产品A", "理财产品B", "理财产品C"]

// participants
["USER001", "USER002", "USER003"]
```

---

## 3. 礼品表 (gifts)

### 3.1 表结构

```sql
CREATE TABLE gifts (
    gift_id             VARCHAR(32) PRIMARY KEY COMMENT '礼品ID',
    gift_name           VARCHAR(200) NOT NULL COMMENT '礼品名称',
    gift_category       VARCHAR(50) NOT NULL COMMENT '礼品分类',
    unit_price          DECIMAL(10, 2) NOT NULL COMMENT '单价(元)',
    stock_quantity      INT DEFAULT 0 COMMENT '库存数量',
    description         TEXT COMMENT '礼品描述',
    status              ENUM('ACTIVE', 'INACTIVE') DEFAULT 'ACTIVE' COMMENT '状态',
    create_time         DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_time         DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',

    INDEX idx_category (gift_category),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='礼品表';
```

### 3.2 字段详细说明

| 字段名 | 类型 | 长度/精度 | 必填 | 默认值 | 约束 | 说明 |
| --- | --- | --- | --- | --- | --- | --- |
| gift_id | VARCHAR | 32 | 是 | - | PRIMARY KEY | 礼品唯一标识 |
| gift_name | VARCHAR | 200 | 是 | - | NOT NULL | 礼品名称 |
| gift_category | VARCHAR | 50 | 是 | - | NOT NULL | 礼品分类(待确认分类维度) |
| unit_price | DECIMAL | (10, 2) | 是 | - | NOT NULL | 单价,精确到分 |
| stock_quantity | INT | - | 是 | 0 | NOT NULL | 库存数量(可选功能) |
| description | TEXT | - | 否 | NULL | - | 礼品描述 |
| status | ENUM | - | 是 | ACTIVE | NOT NULL | 状态 |
| create_time | DATETIME | - | 是 | CURRENT_TIMESTAMP | NOT NULL | 创建时间 |
| update_time | DATETIME | - | 是 | CURRENT_TIMESTAMP | NOT NULL | 更新时间 |

### 3.3 索引设计

| 索引名 | 字段 | 类型 | 理由 |
| --- | --- | --- | --- |
| PRIMARY | gift_id | 主键 | 主键索引 |
| idx_category | gift_category | INDEX | 按分类筛选 |
| idx_status | status | INDEX | 按状态筛选 |

### 3.4 数据字典

**礼品分类 (gift_category)** - 待确认:
- 建议分类: "电子产品", "日用品", "食品", "办公用品"
- 或: "实物", "服务", "虚拟"

**状态 (status)**:
- `ACTIVE`: 启用
- `INACTIVE`: 禁用

---

## 4. 礼品领用申请表 (gift_requisitions)

### 4.1 表结构

```sql
CREATE TABLE gift_requisitions (
    requisition_id      VARCHAR(32) PRIMARY KEY COMMENT '申请单ID',
    applicant           VARCHAR(32) NOT NULL COMMENT '申请人(用户ID)',
    recipient           VARCHAR(32) NOT NULL COMMENT '领用人(用户ID)',
    total_amount        DECIMAL(10, 2) NOT NULL COMMENT '总金额(元)',
    planned_date        DATE NOT NULL COMMENT '计划领用日期',
    purpose_type        ENUM('CUSTOMER_VISIT', 'HOLIDAY', 'MARKETING', 'OTHER') NOT NULL COMMENT '目的类型',
    related_visit_id    VARCHAR(32) COMMENT '关联客户拜访记录ID',
    approval_status     ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING' COMMENT '审批状态',
    rejection_reason    TEXT COMMENT '驳回原因',
    approver            VARCHAR(32) COMMENT '审批人(用户ID)',
    approval_time       DATETIME COMMENT '审批时间',
    create_time         DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_time         DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',

    FOREIGN KEY (applicant) REFERENCES users(user_id) ON DELETE RESTRICT,
    FOREIGN KEY (recipient) REFERENCES users(user_id) ON DELETE RESTRICT,
    FOREIGN KEY (approver) REFERENCES users(user_id) ON DELETE SET NULL,
    INDEX idx_applicant (applicant),
    INDEX idx_approval_status (approval_status),
    INDEX idx_planned_date (planned_date),
    INDEX idx_purpose_type (purpose_type),
    INDEX idx_approver (approver)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='礼品领用申请表';
```

### 4.2 字段详细说明

| 字段名 | 类型 | 长度/精度 | 必填 | 默认值 | 约束 | 说明 |
| --- | --- | --- | --- | --- | --- | --- |
| requisition_id | VARCHAR | 32 | 是 | - | PRIMARY KEY | 申请单唯一标识 |
| applicant | VARCHAR | 32 | 是 | - | NOT NULL, FOREIGN KEY | 申请人ID,关联users表 |
| recipient | VARCHAR | 32 | 是 | - | NOT NULL, FOREIGN KEY | 领用人ID,关联users表 |
| total_amount | DECIMAL | (10, 2) | 是 | - | NOT NULL | 总金额,自动计算 |
| planned_date | DATE | - | 是 | - | NOT NULL | 计划领用日期 |
| purpose_type | ENUM | - | 是 | - | NOT NULL | 目的类型,4个枚举值之一 |
| related_visit_id | VARCHAR | 32 | 否 | NULL | - | 关联拜访记录ID(可选) |
| approval_status | ENUM | - | 是 | PENDING | NOT NULL | 审批状态,默认为"待审批" |
| rejection_reason | TEXT | - | 否 | NULL | - | 驳回原因(审批状态为"已驳回"时必填) |
| approver | VARCHAR | 32 | 否 | NULL | FOREIGN KEY | 审批人ID,关联users表 |
| approval_time | DATETIME | - | 否 | NULL | - | 审批时间 |
| create_time | DATETIME | - | 是 | CURRENT_TIMESTAMP | NOT NULL | 创建时间 |
| update_time | DATETIME | - | 是 | CURRENT_TIMESTAMP | NOT NULL | 更新时间 |

### 4.3 索引设计

| 索引名 | 字段 | 类型 | 理由 |
| --- | --- | --- | --- |
| PRIMARY | requisition_id | 主键 | 主键索引 |
| idx_applicant | applicant | INDEX | 按申请人查询 |
| idx_approval_status | approval_status | INDEX | 按审批状态筛选 |
| idx_planned_date | planned_date | INDEX | 按计划日期查询 |
| idx_purpose_type | purpose_type | INDEX | 按目的类型筛选 |
| idx_approver | approver | INDEX | 按审批人查询 |

### 4.4 数据字典

**目的类型 (purpose_type)**:
- `CUSTOMER_VISIT`: 客户拜访
- `HOLIDAY`: 节日慰问
- `MARKETING`: 营销活动
- `OTHER`: 其他

**审批状态 (approval_status)**:
- `PENDING`: 待审批
- `APPROVED`: 已通过
- `REJECTED`: 已驳回

**状态流转规则**:
- `PENDING` → `APPROVED` (审批通过)
- `PENDING` → `REJECTED` (审批驳回)
- `APPROVED` / `REJECTED` 不可变更

---

## 5. 礼品申请明细表 (gift_requisition_items)

### 5.1 表结构

```sql
CREATE TABLE gift_requisition_items (
    item_id             VARCHAR(32) PRIMARY KEY COMMENT '明细项ID',
    requisition_id      VARCHAR(32) NOT NULL COMMENT '申请单ID',
    gift_id             VARCHAR(32) NOT NULL COMMENT '礼品ID',
    quantity            INT NOT NULL COMMENT '数量',
    unit_price          DECIMAL(10, 2) NOT NULL COMMENT '单价(元)',
    subtotal            DECIMAL(10, 2) NOT NULL COMMENT '小计(元)',
    create_time         DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',

    FOREIGN KEY (requisition_id) REFERENCES gift_requisitions(requisition_id) ON DELETE CASCADE,
    FOREIGN KEY (gift_id) REFERENCES gifts(gift_id) ON DELETE RESTRICT,
    INDEX idx_requisition_id (requisition_id),
    INDEX idx_gift_id (gift_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='礼品申请明细表';
```

### 5.2 字段详细说明

| 字段名 | 类型 | 长度/精度 | 必填 | 默认值 | 约束 | 说明 |
| --- | --- | --- | --- | --- | --- | --- |
| item_id | VARCHAR | 32 | 是 | - | PRIMARY KEY | 明细项唯一标识 |
| requisition_id | VARCHAR | 32 | 是 | - | NOT NULL, FOREIGN KEY | 申请单ID,关联gift_requisitions表 |
| gift_id | VARCHAR | 32 | 是 | - | NOT NULL, FOREIGN KEY | 礼品ID,关联gifts表 |
| quantity | INT | - | 是 | - | NOT NULL | 数量 |
| unit_price | DECIMAL | (10, 2) | 是 | - | NOT NULL | 单价(快照,防止价格变动) |
| subtotal | DECIMAL | (10, 2) | 是 | - | NOT NULL | 小计(quantity * unit_price) |
| create_time | DATETIME | - | 是 | CURRENT_TIMESTAMP | NOT NULL | 创建时间 |

### 5.3 索引设计

| 索引名 | 字段 | 类型 | 理由 |
| --- | --- | --- | --- |
| PRIMARY | item_id | 主键 | 主键索引 |
| idx_requisition_id | requisition_id | INDEX | 查询申请单的所有明细 |
| idx_gift_id | gift_id | INDEX | 按礼品查询 |

### 5.4 外键约束

- `requisition_id`: 关联 `gift_requisitions(requisition_id)`, `ON DELETE CASCADE` (删除申请单时自动删除明细)
- `gift_id`: 关联 `gifts(gift_id)`, `ON DELETE RESTRICT` (礼品被使用时不可删除)

---

## 6. 轮播图表 (carousels)

### 6.1 表结构

```sql
CREATE TABLE carousels (
    carousel_id         VARCHAR(32) PRIMARY KEY COMMENT '轮播图ID',
    title               VARCHAR(200) NOT NULL COMMENT '标题',
    description         TEXT COMMENT '描述',
    image_url           VARCHAR(500) NOT NULL COMMENT '图片URL',
    link_url            VARCHAR(500) COMMENT '跳转链接',
    sort_order          INT DEFAULT 0 COMMENT '排序序号(数字越小越靠前)',
    status              ENUM('ACTIVE', 'INACTIVE') DEFAULT 'ACTIVE' COMMENT '状态',
    create_by           VARCHAR(32) NOT NULL COMMENT '创建人(用户ID)',
    create_time         DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_time         DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',

    FOREIGN KEY (create_by) REFERENCES users(user_id) ON DELETE RESTRICT,
    INDEX idx_status (status),
    INDEX idx_sort_order (sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='轮播图表';
```

### 6.2 字段详细说明

| 字段名 | 类型 | 长度 | 必填 | 默认值 | 约束 | 说明 |
| --- | --- | --- | --- | --- | --- | --- |
| carousel_id | VARCHAR | 32 | 是 | - | PRIMARY KEY | 轮播图唯一标识 |
| title | VARCHAR | 200 | 是 | - | NOT NULL | 标题 |
| description | TEXT | - | 否 | NULL | - | 描述 |
| image_url | VARCHAR | 500 | 是 | - | NOT NULL | 图片URL(相对路径或绝对路径) |
| link_url | VARCHAR | 500 | 否 | NULL | - | 点击跳转链接(可选) |
| sort_order | INT | - | 是 | 0 | NOT NULL | 排序序号,数字越小越靠前 |
| status | ENUM | - | 是 | ACTIVE | NOT NULL | 状态 |
| create_by | VARCHAR | 32 | 是 | - | NOT NULL, FOREIGN KEY | 创建人ID |
| create_time | DATETIME | - | 是 | CURRENT_TIMESTAMP | NOT NULL | 创建时间 |
| update_time | DATETIME | - | 是 | CURRENT_TIMESTAMP | NOT NULL | 更新时间 |

### 6.3 索引设计

| 索引名 | 字段 | 类型 | 理由 |
| --- | --- | --- | --- |
| PRIMARY | carousel_id | 主键 | 主键索引 |
| idx_status | status | INDEX | 查询启用的轮播图 |
| idx_sort_order | sort_order | INDEX | 排序查询 |

---

## 7. 新闻表 (news)

### 7.1 表结构

```sql
CREATE TABLE news (
    news_id             VARCHAR(32) PRIMARY KEY COMMENT '新闻ID',
    title               VARCHAR(200) NOT NULL COMMENT '新闻标题',
    summary             VARCHAR(500) NOT NULL COMMENT '新闻摘要',
    content             TEXT NOT NULL COMMENT '新闻正文内容',
    publish_time        DATETIME COMMENT '发布时间',
    status              ENUM('DRAFT', 'PUBLISHED', 'WITHDRAWN') DEFAULT 'DRAFT' COMMENT '状态',
    create_by           VARCHAR(32) NOT NULL COMMENT '创建人(用户ID)',
    create_time         DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_time         DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',

    FOREIGN KEY (create_by) REFERENCES users(user_id) ON DELETE RESTRICT,
    INDEX idx_status (status),
    INDEX idx_publish_time (publish_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='新闻表';
```

### 7.2 字段详细说明

| 字段名 | 类型 | 长度 | 必填 | 默认值 | 约束 | 说明 |
| --- | --- | --- | --- | --- | --- | --- |
| news_id | VARCHAR | 32 | 是 | - | PRIMARY KEY | 新闻唯一标识 |
| title | VARCHAR | 200 | 是 | - | NOT NULL | 新闻标题 |
| summary | VARCHAR | 500 | 是 | - | NOT NULL | 新闻摘要,列表页展示 |
| content | TEXT | - | 是 | - | NOT NULL | 新闻正文,支持富文本 |
| publish_time | DATETIME | - | 否 | NULL | - | 发布时间 |
| status | ENUM | - | 是 | DRAFT | NOT NULL | 状态,默认为"草稿" |
| create_by | VARCHAR | 32 | 是 | - | NOT NULL, FOREIGN KEY | 创建人ID |
| create_time | DATETIME | - | 是 | CURRENT_TIMESTAMP | NOT NULL | 创建时间 |
| update_time | DATETIME | - | 是 | CURRENT_TIMESTAMP | NOT NULL | 更新时间 |

### 7.3 索引设计

| 索引名 | 字段 | 类型 | 理由 |
| --- | --- | --- | --- |
| PRIMARY | news_id | 主键 | 主键索引 |
| idx_status | status | INDEX | 查询已发布的新闻 |
| idx_publish_time | publish_time | INDEX | 按发布时间排序 |

### 7.4 数据字典

**状态 (status)**:
- `DRAFT`: 草稿
- `PUBLISHED`: 已发布
- `WITHDRAWN`: 已撤回

---

## 8. 系统配置表 (system_configs)

### 8.1 表结构

```sql
CREATE TABLE system_configs (
    config_key         VARCHAR(100) PRIMARY KEY COMMENT '配置项键名',
    config_value       TEXT NOT NULL COMMENT '配置项值(JSON字符串)',
    description        VARCHAR(500) COMMENT '配置项描述',
    create_time        DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_time        DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='系统配置表';
```

### 8.2 字段详细说明

| 字段名 | 类型 | 长度 | 必填 | 默认值 | 约束 | 说明 |
| --- | --- | --- | --- | --- | --- | --- |
| config_key | VARCHAR | 100 | 是 | - | PRIMARY KEY | 配置项键名,如"session.timeout" |
| config_value | TEXT | - | 是 | - | NOT NULL | 配置项值,通常为JSON字符串 |
| description | VARCHAR | 500 | 否 | NULL | - | 配置项描述 |
| create_time | DATETIME | - | 是 | CURRENT_TIMESTAMP | NOT NULL | 创建时间 |
| update_time | DATETIME | - | 是 | CURRENT_TIMESTAMP | NOT NULL | 更新时间 |

### 8.3 示例配置

| config_key | config_value | description |
| --- | --- | --- |
| session.timeout | "7200" | 会话超时时间(秒) |
| password.min_length | "8" | 密码最小长度 |
| password.max_attempts | "5" | 密码最大尝试次数 |
| ai.max_history | "10" | AI对话历史最大条数 |

---

## 9. 数据迁移脚本

### 9.1 初始化脚本

**使用 Alembic 生成迁移脚本**:

```bash
# 生成迁移脚本
alembic revision --autogenerate -m "初始化数据库表"

# 执行迁移
alembic upgrade head

# 回滚迁移
alembic downgrade -1
```

### 9.2 初始数据脚本

**初始配置数据**:
```sql
-- 插入系统配置
INSERT INTO system_configs (config_key, config_value, description) VALUES
('session.timeout', '7200', '会话超时时间(秒)'),
('password.min_length', '8', '密码最小长度'),
('password.max_attempts', '5', '密码最大尝试次数'),
('ai.max_history', '10', 'AI对话历史最大条数');
```

**初始测试用户** (开发环境):
```sql
-- 插入测试用户
INSERT INTO users (user_id, username, password_hash, name, role, status) VALUES
('USER001', 'manager001', '$2b$12$...', '张三(管理者)', 'MANAGER', 'ACTIVE'),
('USER002', 'operations001', '$2b$12$...', '李四(运营)', 'OPERATIONS', 'ACTIVE'),
('USER003', 'approver001', '$2b$12$...', '王五(审批)', 'APPROVER', 'ACTIVE'),
('USER004', 'cm001', '$2b$12$...', '赵六(客户经理)', 'CUSTOMER_MANAGER', 'ACTIVE');
```

---

## 10. 数据完整性约束

### 10.1 外键约束汇总

| 表 | 字段 | 关联表 | 关联字段 | 级联规则 |
| --- | --- | --- | --- | --- |
| customer_visits | create_by | users | user_id | RESTRICT |
| gift_requisitions | applicant | users | user_id | RESTRICT |
| gift_requisitions | recipient | users | user_id | RESTRICT |
| gift_requisitions | approver | users | user_id | SET NULL |
| gift_requisition_items | requisition_id | gift_requisitions | requisition_id | CASCADE |
| gift_requisition_items | gift_id | gifts | gift_id | RESTRICT |
| carousels | create_by | users | user_id | RESTRICT |
| news | create_by | users | user_id | RESTRICT |

### 10.2 级联规则说明

- **CASCADE**: 删除主表记录时,自动删除从表记录
- **RESTRICT**: 删除主表记录时,如果有从表记录则禁止删除
- **SET NULL**: 删除主表记录时,从表记录的外键字段设为NULL

---

## 11. 待确认事项

1. **客户ID (customer_id)**: 数据来源和格式规范
2. **拜访方式枚举值**: 是否需要调整(如添加微信、短信)
3. **拜访状态枚举值**: 是否需要调整,状态流转规则
4. **意向理财产品**: 是否需要理财产品主数据表
5. **礼品分类维度**: 具体分类方案
6. **库存管理**: 是否需要管理礼品库存数量
7. **新闻附件**: 是否需要支持新闻附件(图片、PDF)

---

## 12. ORM 模型示例 (SQLAlchemy)

### 12.1 User 模型

```python
from sqlalchemy import Column, String, Enum as SQLEnum, DateTime
from sqlalchemy.dialects.mysql import ENUM
from sqlalchemy.orm import relationship
from models.base import Base

class User(Base):
    __tablename__ = "users"

    user_id = Column(String(32), primary_key=True, comment="用户ID")
    username = Column(String(50), unique=True, nullable=False, comment="登录账号")
    password_hash = Column(String(255), nullable=False, comment="密码哈希")
    name = Column(String(50), nullable=False, comment="用户姓名")
    role = Column(ENUM("CUSTOMER_MANAGER", "OPERATIONS", "APPROVER", "MANAGER", name="user_role"), nullable=False, comment="角色")
    department = Column(String(100), comment="所属部门")
    status = Column(ENUM("ACTIVE", "INACTIVE", "LOCKED", name="user_status"), default="ACTIVE", nullable=False, comment="用户状态")
    last_login_time = Column(DateTime, comment="最后登录时间")
    create_time = Column(DateTime, default=datetime.now, nullable=False, comment="创建时间")
    update_time = Column(DateTime, default=datetime.now, onupdate=datetime.now, nullable=False, comment="更新时间")

    # 关系
    visits_created = relationship("CustomerVisit", back_populates="creator")
    gift_applications = relationship("GiftRequisition", foreign_keys="GiftRequisition.applicant", back_populates="applicant_user")
```

---

**文档变更记录**:
- v1.0 (2026-01-08): 初始版本,定义数据模型详细设计
