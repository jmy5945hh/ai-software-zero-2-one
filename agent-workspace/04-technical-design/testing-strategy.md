# 测试策略

**文档版本**: v1.0
**创建时间**: 2026-01-08
**负责人**: 技术负责人
**关联文档**: development-plan.md, backend-setup-guide.md, frontend-setup-guide.md

---

## 文档说明

本文档定义"招财银行北京分行运营门户系统"的完整测试策略,包括测试金字塔、测试工具选择、覆盖率要求、测试数据管理、CI/CD集成和性能测试策略,确保系统质量。

---

## 1. 测试金字塔

### 1.1 测试分层策略

```
        /\
       /  \        E2E Tests (10%)
      /____\       - 关键业务流程
     /      \      - 用户旅程
    /        \     - 跨模块集成
   /__________\    ---------------------
  /            \   Integration Tests (30%)
 /  Unit Tests  \  - API集成测试
/________________\ - 数据库集成测试
                  - 第三方服务集成

  Unit Tests (60%)
  - 组件单元测试
  - Service层测试
  - 工具函数测试
  - 数据模型测试
```

### 1.2 测试分层说明

#### 1.2.1 单元测试 (Unit Tests)

**目标**: 验证最小可测试单元(函数、类、组件)的正确性

**覆盖范围**:
- 前端: React组件、Hooks、工具函数、状态管理
- 后端: Service层、工具函数、数据模型、业务逻辑

**特点**:
- 运行速度快(毫秒级)
- 隔离性强(不依赖外部服务)
- 可重复执行(无状态)

**覆盖率要求**: ≥ 70%

---

#### 1.2.2 集成测试 (Integration Tests)

**目标**: 验证多个模块协作的正确性

**覆盖范围**:
- 前端: 页面级集成测试、组件集成测试
- 后端: API端点测试、数据库集成测试、第三方服务集成测试

**特点**:
- 运行速度中等(秒级)
- 涉及真实数据库和外部服务
- 测试模块间协作

**覆盖率要求**: 覆盖所有API端点和关键业务流程

---

#### 1.2.3 端到端测试 (E2E Tests)

**目标**: 验证完整用户场景和业务流程

**覆盖范围**:
- 用户登录流程
- 拜访记录CRUD流程
- 礼品申请审批流程
- 数据大屏展示流程

**特点**:
- 运行速度较慢(分钟级)
- 模拟真实用户操作
- 覆盖关键业务路径

**覆盖率要求**: 覆盖核心用户旅程和关键业务流程

---

## 2. 前端测试策略

### 2.1 前端测试工具栈

#### 2.1.1 核心测试框架

```json
{
  "devDependencies": {
    "vitest": "^1.0.0",
    "@testing-library/react": "^14.1.2",
    "@testing-library/jest-dom": "^6.1.5",
    "@testing-library/user-event": "^14.5.1",
    "jsdom": "^23.0.1",
    "@vitest/ui": "^1.0.0",
    "playwright": "^1.40.0",
    "@playwright/test": "^1.40.0"
  }
}
```

#### 2.1.2 工具说明

- **Vitest**: 单元测试框架(替代Jest,与Vite深度集成)
- **Testing Library**: React组件测试库
- **jsdom**: DOM环境模拟
- **Playwright**: E2E测试框架
- **@vitest/ui**: 测试可视化界面

---

### 2.2 前端单元测试

#### 2.2.1 组件测试示例

```typescript
// src/components/__tests__/LoginForm.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoginForm } from '../LoginForm';

describe('LoginForm', () => {
  it('should render login form', () => {
    render(<LoginForm onSubmit={vi.fn()} />);
    expect(screen.getByLabelText('账号')).toBeInTheDocument();
    expect(screen.getByLabelText('密码')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '登录' })).toBeInTheDocument();
  });

  it('should show validation errors for empty fields', async () => {
    render(<LoginForm onSubmit={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: '登录' }));
    expect(screen.getByText('请输入账号')).toBeInTheDocument();
    expect(screen.getByText('请输入密码')).toBeInTheDocument();
  });

  it('should call onSubmit with form data', async () => {
    const handleSubmit = vi.fn();
    render(<LoginForm onSubmit={handleSubmit} />);
    await userEvent.type(screen.getByLabelText('账号'), 'testuser');
    await userEvent.type(screen.getByLabelText('密码'), 'password123');
    await userEvent.click(screen.getByRole('button', { name: '登录' }));
    await waitFor(() => {
      expect(handleSubmit).toHaveBeenCalledWith({
        username: 'testuser',
        password: 'password123',
      });
    });
  });
});
```

#### 2.2.2 Hooks测试示例

```typescript
// src/hooks/__tests__/useAuth.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useAuth } from '../useAuth';
import * as api from '@/services/auth';

vi.mock('@/services/auth');

describe('useAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should login successfully', async () => {
    const mockResponse = {
      data: {
        access_token: 'test-token',
        user: {
          user_id: 'TEST001',
          username: 'testuser',
          name: '测试用户',
          role: 'CUSTOMER_MANAGER',
        },
      },
    };
    vi.mocked(api.login).mockResolvedValue(mockResponse);

    const { result } = renderHook(() => useAuth());
    await act(async () => {
      await result.current.login('testuser', 'password123');
    });

    await waitFor(() => {
      expect(result.current.user).toEqual(mockResponse.data.user);
      expect(result.current.token).toEqual(mockResponse.data.access_token);
    });
  });
});
```

#### 2.2.3 工具函数测试示例

```typescript
// src/utils/__tests__/format.test.ts
import { describe, it, expect } from 'vitest';
import { formatDate, formatCurrency } from '../format';

describe('formatDate', () => {
  it('should format date string correctly', () => {
    expect(formatDate('2026-01-08')).toBe('2026年01月08日');
  });

  it('should handle invalid date', () => {
    expect(formatDate('invalid')).toBe('-');
  });
});

describe('formatCurrency', () => {
  it('should format number to currency', () => {
    expect(formatCurrency(1234.56)).toBe('¥1,234.56');
  });

  it('should handle zero', () => {
    expect(formatCurrency(0)).toBe('¥0.00');
  });
});
```

---

### 2.3 前端集成测试

#### 2.3.1 页面级测试示例

```typescript
// src/pages/__tests__/VisitRecords.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { VisitRecords } from '../VisitRecords';
import * as api from '@/services/visits';

vi.mock('@/services/visits');

const mockVisits = [
  {
    visit_id: 'V001',
    customer_name: '张三',
    visit_date: '2026-01-08',
    visit_type: '上门拜访',
    content: '介绍理财产品',
    creator_name: '李四',
  },
];

describe('VisitRecords Page', () => {
  it('should render visit records list', async () => {
    vi.mocked(api.getVisitRecords).mockResolvedValue({ data: { list: mockVisits, total: 1 } });
    render(
      <BrowserRouter>
        <VisitRecords />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('张三')).toBeInTheDocument();
      expect(screen.getByText('2026-01-08')).toBeInTheDocument();
      expect(screen.getByText('上门拜访')).toBeInTheDocument();
    });
  });
});
```

---

### 2.4 前端E2E测试

#### 2.4.1 Playwright配置

```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
  },
});
```

#### 2.4.2 E2E测试示例

```typescript
// tests/e2e/login.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Login Flow', () => {
  test('should login successfully with valid credentials', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="username"]', 'testuser');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL('/');
    await expect(page.locator('text=欢迎回来')).toBeVisible();
  });

  test('should show error with invalid credentials', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="username"]', 'wronguser');
    await page.fill('input[name="password"]', 'wrongpass');
    await page.click('button[type="submit"]');

    await expect(page.locator('text=账号或密码错误')).toBeVisible();
  });
});
```

```typescript
// tests/e2e/gift-requisition.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Gift Requisition Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Login first
    await page.goto('/login');
    await page.fill('input[name="username"]', 'customer_manager');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/');
  });

  test('should create gift requisition successfully', async ({ page }) => {
    await page.goto('/gift-applications');
    await page.click('text=新建申请');

    // Fill form
    await page.fill('input[name="customer_name"]', '测试客户');
    await page.fill('textarea[name="reason"]', '客户维护礼品');
    await page.click('text=添加礼品');
    await page.selectOption('select[name="gift_id"]', 'G001');
    await page.fill('input[name="quantity"]', '10');

    // Submit
    await page.click('button:has-text("提交申请")');

    // Verify success
    await expect(page.locator('text=申请提交成功')).toBeVisible();
  });

  test('should approve gift requisition', async ({ page }) => {
    // Login as approver
    await page.goto('/login');
    await page.fill('input[name="username"]', 'approver');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/');

    await page.goto('/gift-approvals');
    await page.click('text=待审批', { first: true });
    await page.click('button:has-text("通过")');
    await page.fill('textarea[name="approval_remark"]', '同意');
    await page.click('button:has-text("确认")');

    await expect(page.locator('text=审批成功')).toBeVisible();
  });
});
```

---

## 3. 后端测试策略

### 3.1 后端测试工具栈

#### 3.1.1 核心测试框架

```txt
pytest==7.4.3
pytest-asyncio==0.21.1
pytest-cov==4.1.0
httpx==0.25.2
faker==20.1.0
freezegun==1.4.0
```

#### 3.1.2 工具说明

- **pytest**: 单元测试框架
- **pytest-asyncio**: 异步测试支持
- **pytest-cov**: 代码覆盖率
- **httpx**: HTTP客户端(用于测试FastAPI)
- **faker**: 测试数据生成
- **freezegun**: 时间模拟

---

### 3.2 后端单元测试

#### 3.2.1 Service层测试示例

```python
# tests/services/test_auth_service.py
import pytest
from sqlalchemy.orm import Session
from services.auth_service import AuthService
from models.user import User
from core.security import get_password_hash
from schemas.auth import LoginRequest

def test_authenticate_success(db_session: Session):
    """测试登录成功"""
    # 创建测试用户
    user = User(
        user_id="TEST001",
        username="testuser",
        password_hash=get_password_hash("password123"),
        name="测试用户",
        role="CUSTOMER_MANAGER"
    )
    db_session.add(user)
    db_session.commit()

    # 测试认证
    auth_service = AuthService()
    form = LoginRequest(username="testuser", password="password123")
    result = auth_service.authenticate(db_session, form)

    assert result is not None
    assert result.username == "testuser"
    assert result.user_id == "TEST001"

def test_authenticate_wrong_password(db_session: Session):
    """测试密码错误"""
    user = User(
        user_id="TEST001",
        username="testuser",
        password_hash=get_password_hash("password123"),
        name="测试用户",
        role="CUSTOMER_MANAGER"
    )
    db_session.add(user)
    db_session.commit()

    auth_service = AuthService()
    form = LoginRequest(username="testuser", password="wrongpass")
    result = auth_service.authenticate(db_session, form)

    assert result is None

def test_authenticate_user_not_found(db_session: Session):
    """测试用户不存在"""
    auth_service = AuthService()
    form = LoginRequest(username="nonexistent", password="password123")
    result = auth_service.authenticate(db_session, form)

    assert result is None
```

#### 3.2.2 工具函数测试示例

```python
# tests/utils/test_validators.py
import pytest
from utils.validators import validate_phone, validate_id_card

def test_validate_phone_valid():
    """测试有效手机号"""
    assert validate_phone("13800138000") == True
    assert validate_phone("15912345678") == True

def test_validate_phone_invalid():
    """测试无效手机号"""
    assert validate_phone("12345678901") == False
    assert validate_phone("1380013800") == False
    assert validate_phone("abc12345678") == False

def test_validate_id_card_valid():
    """测试有效身份证"""
    assert validate_id_card("110101199001011234") == True

def test_validate_id_card_invalid():
    """测试无效身份证"""
    assert validate_id_card("1234567890") == False
    assert validate_id_card("abcdefghijklmnopqr") == False
```

---

### 3.3 后端集成测试

#### 3.3.1 API端点测试示例

```python
# tests/api/test_auth_api.py
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from main import app
from models.base import Base
from models.user import User
from core.security import get_password_hash

# 测试数据库
SQLALCHEMY_DATABASE_URL = "sqlite:///./test.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture
def db_session():
    """创建测试数据库会话"""
    Base.metadata.create_all(bind=engine)
    session = TestingSessionLocal()
    yield session
    session.close()
    Base.metadata.drop_all(bind=engine)

@pytest.fixture
def client(db_session):
    """创建测试客户端"""
    def override_get_db():
        try:
            yield db_session
        finally:
            db_session.close()

    app.dependency_overrides[get_db] = override_get_db
    yield TestClient(app)

def test_login_success(client, db_session):
    """测试登录成功"""
    # 创建测试用户
    user = User(
        user_id="TEST001",
        username="testuser",
        password_hash=get_password_hash("password123"),
        name="测试用户",
        role="CUSTOMER_MANAGER"
    )
    db_session.add(user)
    db_session.commit()

    # 测试登录
    response = client.post("/api/v1/auth/login", json={
        "username": "testuser",
        "password": "password123"
    })

    assert response.status_code == 200
    data = response.json()
    assert data["code"] == 0
    assert "access_token" in data["data"]
    assert data["data"]["user"]["username"] == "testuser"

def test_login_wrong_password(client, db_session):
    """测试密码错误"""
    user = User(
        user_id="TEST001",
        username="testuser",
        password_hash=get_password_hash("password123"),
        name="测试用户",
        role="CUSTOMER_MANAGER"
    )
    db_session.add(user)
    db_session.commit()

    response = client.post("/api/v1/auth/login", json={
        "username": "testuser",
        "password": "wrongpass"
    })

    assert response.status_code == 401
    data = response.json()
    assert data["code"] == 401
    assert "账号或密码错误" in data["message"]

def test_login_user_not_found(client):
    """测试用户不存在"""
    response = client.post("/api/v1/auth/login", json={
        "username": "nonexistent",
        "password": "password123"
    })

    assert response.status_code == 401
```

#### 3.3.2 数据库集成测试示例

```python
# tests/test_database.py
import pytest
from sqlalchemy.orm import Session
from models.user import User
from models.customer_visit import CustomerVisit
from schemas.visit import VisitCreate

def test_create_visit(db_session: Session):
    """测试创建拜访记录"""
    # 创建测试用户
    user = User(
        user_id="TEST001",
        username="testuser",
        password_hash="hash",
        name="测试用户",
        role="CUSTOMER_MANAGER"
    )
    db_session.add(user)
    db_session.commit()

    # 创建拜访记录
    visit = CustomerVisit(
        visit_id="V001",
        customer_name="张三",
        visit_date="2026-01-08",
        visit_type="上门拜访",
        content="介绍理财产品",
        creator_id="TEST001"
    )
    db_session.add(visit)
    db_session.commit()

    # 验证
    retrieved = db_session.query(CustomerVisit).filter_by(visit_id="V001").first()
    assert retrieved is not None
    assert retrieved.customer_name == "张三"
    assert retrieved.creator_id == "TEST001"

def test_visit_permission_check(db_session: Session):
    """测试权限检查"""
    # 创建两个用户
    user1 = User(
        user_id="TEST001",
        username="user1",
        password_hash="hash",
        name="用户1",
        role="CUSTOMER_MANAGER"
    )
    user2 = User(
        user_id="TEST002",
        username="user2",
        password_hash="hash",
        name="用户2",
        role="CUSTOMER_MANAGER"
    )
    db_session.add_all([user1, user2])
    db_session.commit()

    # user1创建拜访记录
    visit = CustomerVisit(
        visit_id="V001",
        customer_name="张三",
        visit_date="2026-01-08",
        visit_type="上门拜访",
        content="介绍理财产品",
        creator_id="TEST001"
    )
    db_session.add(visit)
    db_session.commit()

    # user1可以查看
    visit1 = db_session.query(CustomerVisit).filter_by(
        visit_id="V001",
        creator_id="TEST001"
    ).first()
    assert visit1 is not None

    # user2不能查看user1的记录
    visit2 = db_session.query(CustomerVisit).filter_by(
        visit_id="V001",
        creator_id="TEST002"
    ).first()
    assert visit2 is None
```

---

## 4. 测试数据管理

### 4.1 测试数据生成

#### 4.1.1 使用Faker生成测试数据

```python
# tests/conftest.py
import pytest
from faker import Faker
from models.user import User
from models.customer_visit import CustomerVisit
from core.security import get_password_hash

fake = Faker('zh_CN')

@pytest.fixture
def test_user(db_session: Session):
    """生成测试用户"""
    user = User(
        user_id=fake.uuid4()[:32],
        username=fake.user_name(),
        password_hash=get_password_hash("password123"),
        name=fake.name(),
        role="CUSTOMER_MANAGER"
    )
    db_session.add(user)
    db_session.commit()
    return user

@pytest.fixture
def test_visits(db_session: Session, test_user: User):
    """生成测试拜访记录"""
    visits = []
    for _ in range(10):
        visit = CustomerVisit(
            visit_id=fake.uuid4()[:32],
            customer_name=fake.name(),
            visit_date=fake.date_between(start_date='-30d', end_date='today'),
            visit_type=fake.random_element(['上门拜访', '电话沟通', '微信沟通']),
            content=fake.text(),
            creator_id=test_user.user_id
        )
        visits.append(visit)
        db_session.add(visit)
    db_session.commit()
    return visits
```

#### 4.1.2 前端测试数据

```typescript
// src/tests/mocks/data.ts
import { faker } from '@faker-js/faker/locale/zh_CN';

export const mockUsers = Array.from({ length: 10 }, () => ({
  user_id: faker.string.uuid(),
  username: faker.internet.userName(),
  name: faker.person.fullName(),
  role: faker.helpers.arrayElement(['CUSTOMER_MANAGER', 'OPERATIONS', 'APPROVER', 'MANAGER']),
}));

export const mockVisits = Array.from({ length: 20 }, () => ({
  visit_id: faker.string.uuid(),
  customer_name: faker.person.fullName(),
  visit_date: faker.date.past().toISOString().split('T')[0],
  visit_type: faker.helpers.arrayElement(['上门拜访', '电话沟通', '微信沟通']),
  content: faker.lorem.paragraph(),
  creator_name: faker.person.fullName(),
}));
```

---

### 4.2 测试数据隔离

#### 4.2.1 使用事务回滚

```python
# tests/conftest.py
import pytest
from sqlalchemy.orm import Session

@pytest.fixture
def db_session():
    """使用事务回滚隔离测试数据"""
    connection = engine.connect()
    transaction = connection.begin()
    session = Session(bind=connection)

    yield session

    session.close()
    transaction.rollback()
    connection.close()
```

#### 4.2.2 前端测试数据清理

```typescript
// src/tests/setup.ts
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
  localStorage.clear();
});
```

---

## 5. 覆盖率要求

### 5.1 覆盖率标准

| 测试类型 | 覆盖率要求 | 说明 |
| --- | --- | --- |
| 单元测试 | ≥ 70% | 核心业务逻辑≥ 90% |
| 集成测试 | 100% | 所有API端点必须覆盖 |
| E2E测试 | 关键流程 | 核心业务流程必须覆盖 |

### 5.2 分阶段覆盖率目标

#### 5.2.1 Phase 1 (核心基础功能)

- 单元测试覆盖率: ≥ 60%
- API集成测试: 100%
- E2E测试: 登录、拜访、礼品申请审批流程

#### 5.2.2 Phase 2 (扩展功能)

- 单元测试覆盖率: ≥ 70%
- API集成测试: 100%
- E2E测试: 新增首页、内容管理、数据大屏流程

#### 5.2.3 Phase 3 (增值功能)

- 单元测试覆盖率: ≥ 80%
- API集成测试: 100%
- E2E测试: 新增AI助理流程

---

### 5.3 覆盖率报告

#### 5.3.1 后端覆盖率报告

```bash
# 运行测试并生成覆盖率报告
pytest --cov=. --cov-report=html --cov-report=term

# 查看报告
open htmlcov/index.html
```

#### 5.3.2 前端覆盖率报告

```typescript
// vite.config.ts
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json'],
      exclude: [
        'node_modules/',
        'src/tests/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/mockData',
      ],
    },
  },
});
```

```bash
# 运行测试并生成覆盖率报告
npm run test:coverage

# 查看报告
open coverage/index.html
```

---

## 6. CI/CD集成

### 6.1 GitHub Actions配置

#### 6.1.1 后端CI配置

```yaml
# .github/workflows/backend-test.yml
name: Backend Tests

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main, develop ]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      mysql:
        image: mysql:8.0
        env:
          MYSQL_ROOT_PASSWORD: test_password
          MYSQL_DATABASE: test_db
        options: >-
          --health-cmd="mysqladmin ping"
          --health-interval=10s
          --health-timeout=5s
          --health-retries=3
        ports:
          - 3306:3306

    steps:
    - uses: actions/checkout@v3

    - name: Set up Python
      uses: actions/setup-python@v4
      with:
        python-version: '3.10'

    - name: Install dependencies
      run: |
        pip install -r requirements.txt
        pip install pytest pytest-cov

    - name: Run tests
      run: |
        pytest --cov=. --cov-report=xml --cov-report=term

    - name: Upload coverage to Codecov
      uses: codecov/codecov-action@v3
      with:
        file: ./coverage.xml
```

#### 6.1.2 前端CI配置

```yaml
# .github/workflows/frontend-test.yml
name: Frontend Tests

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main, develop ]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
    - uses: actions/checkout@v3

    - name: Set up Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'

    - name: Install dependencies
      run: npm install

    - name: Run linter
      run: npm run lint

    - name: Run unit tests
      run: npm run test:unit -- --coverage

    - name: Run E2E tests
      run: npm run test:e2e

    - name: Upload coverage
      uses: codecov/codecov-action@v3
```

---

### 6.2 测试触发策略

#### 6.2.1 提交前测试(本地)

```bash
# 后端
pytest --cov=. --cov-fail-under=70

# 前端
npm run test:unit -- --run --coverage
```

#### 6.2.2 Pull Request测试

- 必须通过所有单元测试
- 覆盖率不能降低
- 必须通过E2E测试(关键流程)

#### 6.2.3 主分支合并测试

- 运行完整测试套件
- 生成测试报告
- 部署到Staging环境
- 执行集成测试

---

## 7. 性能测试

### 7.1 API性能测试

#### 7.1.1 使用Locust进行负载测试

```python
# locustfile.py
from locust import HttpUser, task, between

class WebsiteUser(HttpUser):
    wait_time = between(1, 3)

    def on_start(self):
        # 登录
        response = self.client.post("/api/v1/auth/login", json={
            "username": "testuser",
            "password": "password123"
        })
        self.token = response.json()["data"]["access_token"]

    @task(3)
    def get_visits(self):
        """获取拜访记录列表"""
        self.client.get("/api/v1/visits", headers={
            "Authorization": f"Bearer {self.token}"
        })

    @task(2)
    def get_dashboard(self):
        """获取数据大屏"""
        self.client.get("/api/v1/dashboard/overview", headers={
            "Authorization": f"Bearer {self.token}"
        })

    @task(1)
    def create_visit(self):
        """创建拜访记录"""
        self.client.post("/api/v1/visits", json={
            "customer_name": "测试客户",
            "visit_date": "2026-01-08",
            "visit_type": "上门拜访",
            "content": "测试内容"
        }, headers={
            "Authorization": f"Bearer {self.token}"
        })
```

#### 7.1.2 运行性能测试

```bash
# 安装Locust
pip install locust

# 运行测试
locust -f locustfile.py --host=http://localhost:8000

# 访问Web界面
# http://localhost:8089
```

---

### 7.2 性能测试指标

| API端点 | 目标响应时间 (P95) | 并发用户数 | 成功率要求 |
| --- | --- | --- | --- |
| POST /api/v1/auth/login | < 500ms | 100 | ≥ 99.9% |
| GET /api/v1/visits | < 300ms | 200 | ≥ 99.9% |
| POST /api/v1/visits | < 500ms | 50 | ≥ 99.9% |
| GET /api/v1/dashboard/* | < 1000ms | 50 | ≥ 99.5% |

---

## 8. 安全测试

### 8.1 安全测试清单

#### 8.1.1 认证测试

- [ ] SQL注入测试
- [ ] XSS攻击测试
- [ ] CSRF攻击测试
- [ ] 权限绕过测试
- [ ] 敏感数据泄露测试

#### 8.1.2 权限测试

- [ ] 数据级权限隔离测试
- [ ] 功能级权限控制测试
- [ ] 水平权限越界测试
- [ ] 垂直权限越界测试

#### 8.1.3 数据安全测试

- [ ] 密码存储加密验证
- [ ] Token传输安全验证
- [ ] 敏感数据脱敏验证

---

### 8.2 安全测试工具

```bash
# 安装OWASP ZAP
docker pull owasp/zap2docker-stable
docker run -u zap -p 8080:8080 owasp/zap2docker-stable zap-webswing.sh

# 运行安全扫描
zap-cli quick-scan --self-contained --start-options '-config api.disablekey=true' http://localhost:8000
```

---

## 9. 测试最佳实践

### 9.1 测试编写原则

#### 9.1.1 AAA模式

```python
def test_create_visit():
    # Arrange - 准备测试数据
    visit_data = {
        "customer_name": "张三",
        "visit_date": "2026-01-08",
        "visit_type": "上门拜访",
        "content": "介绍理财产品"
    }

    # Act - 执行被测试的操作
    response = client.post("/api/v1/visits", json=visit_data)

    # Assert - 验证结果
    assert response.status_code == 200
    assert response.json()["data"]["customer_name"] == "张三"
```

#### 9.1.2 测试命名规范

```python
# 良好的测试命名
def test_create_visit_with_valid_data_should_succeed():
    pass

def test_create_visit_with_missing_customer_name_should_fail():
    pass

def test_create_visit_with_invalid_date_should_fail():
    pass

# 避免模糊的命名
def test_visit():  # 不清晰
    pass
```

#### 9.1.3 一个测试只验证一件事

```python
# 好的做法
def test_create_visit_should_return_201():
    pass

def test_create_visit_should_set_creator_id():
    pass

# 不好的做法
def test_create_visit():  # 测试了多件事
    assert response.status_code == 201
    assert visit.creator_id == user.user_id
    assert visit.create_time is not None
    assert len(db.query(Visit).all()) == 1
```

---

### 9.2 测试数据管理

#### 9.2.1 使用工厂模式创建测试数据

```python
# tests/factories.py
import factory
from models.user import User
from models.customer_visit import CustomerVisit

class UserFactory(factory.alchemy.SQLAlchemyModelFactory):
    class Meta:
        model = User
        sqlalchemy_session = Session  # 需要传入session

    user_id = factory.Faker('uuid4')
    username = factory.Faker('user_name')
    password_hash = "hash"
    name = factory.Faker('name')
    role = "CUSTOMER_MANAGER"

class VisitFactory(factory.alchemy.SQLAlchemyModelFactory):
    class Meta:
        model = CustomerVisit
        sqlalchemy_session = Session

    visit_id = factory.Faker('uuid4')
    customer_name = factory.Faker('name')
    visit_date = factory.Faker('date')
    visit_type = "上门拜访"
    content = factory.Faker('text')
    creator = factory.SubFactory(UserFactory)
```

#### 9.2.2 使用测试夹具(Fixture)

```python
@pytest.fixture
def authenticated_client(client, db_session):
    """创建已认证的测试客户端"""
    user = UserFactory(role="CUSTOMER_MANAGER")
    db_session.add(user)
    db_session.commit()

    token = create_access_token({"user_id": user.user_id})
    client.headers["Authorization"] = f"Bearer {token}"
    return client
```

---

### 9.3 Mock使用原则

#### 9.3.1 何时使用Mock

**适合使用Mock的场景**:
- 外部API调用(如LLM API)
- 文件系统操作
- 发送邮件/短信
- 时间相关的操作

**不适合使用Mock的场景**:
- 数据库操作(应使用真实数据库)
- 业务逻辑测试(过度Mock会隐藏问题)

#### 9.3.2 Mock示例

```python
# tests/services/test_ai_service.py
from unittest.mock import Mock, patch
from services.ai_service import AIService

def test_ai_chat_success():
    """测试AI对话成功"""
    # Mock外部LLM API
    with patch('httpx.post') as mock_post:
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "choices": [{
                "message": {
                    "content": "这是AI的回答"
                }
            }]
        }
        mock_post.return_value = mock_response

        # 测试
        ai_service = AIService()
        response = ai_service.chat("你好")

        assert response == "这是AI的回答"
        mock_post.assert_called_once()
```

---

## 10. 测试文档

### 10.1 测试用例文档

```markdown
# 测试用例: 用户登录

## 用例ID: TC-AUTH-001
## 用例名称: 用户登录成功

### 前置条件
- 用户已注册
- 用户状态为ACTIVE

### 测试步骤
1. 打开登录页面
2. 输入正确的用户名和密码
3. 点击登录按钮

### 预期结果
- 登录成功
- 返回JWT Token
- 跳转到首页
- 显示用户信息

### 优先级
P0

### 自动化状态
已自动化
```

---

### 10.2 测试报告模板

```markdown
# 测试执行报告

## 测试概要
- 测试周期: 2026-01-01 ~ 2026-01-08
- 测试版本: v1.0.0
- 测试人员: QA团队

## 测试结果
| 模块 | 用例数 | 通过 | 失败 | 通过率 |
| --- | --- | --- | --- | --- |
| 认证模块 | 20 | 20 | 0 | 100% |
| 拜访管理 | 35 | 34 | 1 | 97.1% |
| 礼品管理 | 40 | 38 | 2 | 95% |
| **总计** | **95** | **92** | **3** | **96.8%** |

## 覆盖率
- 单元测试覆盖率: 75%
- 集成测试覆盖率: 100%
- E2E测试覆盖率: 关键流程100%

## 缺陷统计
| 严重程度 | 数量 |
| --- | --- |
| P0 | 0 |
| P1 | 1 |
| P2 | 2 |
| P3 | 5 |

## 遗留问题
1. AI助理在高并发下响应时间较长(P1)
2. 礼品台账导出功能偶尔失败(P2)

## 测试结论
系统质量良好,建议修复P1和P2问题后发布。
```

---

## 11. 持续改进

### 11.1 测试度量指标

#### 11.1.1 关键指标

- **测试覆盖率**: ≥ 70%
- **测试通过率**: ≥ 95%
- **缺陷密度**: < 1个/千行代码
- **缺陷修复率**: P0/P1: 100%, P2: ≥ 90%

#### 11.1.2 测试效率

- **自动化测试比例**: ≥ 80%
- **测试执行时间: 单元< 5分钟, 集成< 15分钟, E2E< 30分钟
- **测试维护成本: 测试代码/业务代码 < 1:2

---

### 11.2 测试优化策略

#### 11.2.1 减少测试执行时间

```python
# 并行执行测试
pytest -n auto  # 使用所有CPU核心

# 只运行修改相关的测试
pytest --only-failed  # 只运行失败的测试
```

```typescript
// 并行执行E2E测试
// playwright.config.ts
export default defineConfig({
  fullyParallel: true,
  workers: process.env.CI ? 1 : 4,
});
```

#### 11.2.2 提高测试稳定性

- 使用显式等待而非隐式等待
- 避免硬编码的时间延迟
- 使用测试数据隔离
- 添加重试机制处理网络抖动

---

**文档变更记录**:
- v1.0 (2026-01-08): 初始版本,定义测试策略
