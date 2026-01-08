# 路由映射表

## 路由配置概览

所有业务路由都在 `src/router/index.tsx` 中配置，使用嵌套路由结构。

## 完整路由列表

### 公开路由

| 路由路径 | 组件 | 说明 |
|---------|------|------|
| `/login` | `Login` | 登录页面 |
| `*` | `Navigate to /` | 404 重定向 |

### 受保护路由（需要登录）

| 路由路径 | 组件 | 文件路径 | 权限要求 |
|---------|------|----------|---------|
| `/` | `Dashboard` | `src/pages/Dashboard/index.tsx` | 所有登录用户 |
| `/visits` | `VisitList` | `src/pages/Visits/List.tsx` | 所有登录用户 |
| `/visits/create` | `VisitForm` | `src/pages/Visits/Form.tsx` | 所有登录用户 |
| `/visits/:visitId` | `VisitDetail` | `src/pages/Visits/Detail.tsx` | 所有登录用户 |
| `/visits/edit/:visitId` | `VisitForm` | `src/pages/Visits/Form.tsx` | 所有登录用户 |
| `/gifts/requisitions` | `GiftRequisitionList` | `src/pages/Gifts/RequisitionList.tsx` | 所有登录用户 |
| `/gifts/requisitions/create` | `GiftRequisitionForm` | `src/pages/Gifts/RequisitionForm.tsx` | 所有登录用户 |
| `/gifts/requisitions/:id` | `GiftApproval` | `src/pages/Gifts/Approval.tsx` | 所有登录用户 |
| `/gifts/requisitions/:id/approve` | `GiftApproval` | `src/pages/Gifts/Approval.tsx` | APPROVER/MANAGER |
| `/gifts/ledger` | `GiftLedger` | `src/pages/Gifts/Ledger.tsx` | 所有登录用户 |

## 路由导航示例

### 编程式导航

```typescript
// 使用 useNavigate hook
import { useNavigate } from 'react-router-dom';

const navigate = useNavigate();

// 导航到拜访记录列表
navigate('/visits');

// 导航到新建拜访记录
navigate('/visits/create');

// 导航到拜访记录详情
navigate(`/visits/${visitId}`);

// 导航到编辑拜访记录
navigate(`/visits/edit/${visitId}`);

// 返回上一页
navigate(-1);

// 返回列表页
navigate('/visits');
```

### 声明式导航

```tsx
import { Link } from 'react-router-dom';

// 链接到拜访记录列表
<Link to="/visits">拜访记录</Link>

// 链接到拜访记录详情
<Link to={`/visits/${visitId}`}>查看详情</Link>

// 链接到新建拜访记录
<Link to="/visits/create">新建拜访</Link>
```

## 菜单配置

菜单配置在 `src/components/MainLayout.tsx` 中：

```typescript
const menuItems: MenuProps['items'] = [
  {
    key: '/',
    icon: <HomeOutlined />,
    label: '首页',
  },
  {
    key: '/visits',
    icon: <CalendarOutlined />,
    label: '拜访管理',
  },
  {
    key: '/gifts',
    icon: <GiftOutlined />,
    label: '礼品管理',
    children: [
      {
        key: '/gifts/requisitions',
        label: '礼品申请',
      },
      {
        key: '/gifts/ledger',
        label: '礼品台账',
      },
    ],
  },
];
```

## 路由守卫

所有受保护路由都通过 `AuthGuard` 组件包裹：

```typescript
{
  path: '/',
  element: (
    <AuthGuard>
      <MainLayout />
    </AuthGuard>
  ),
  children: [
    // 业务路由
  ],
}
```

AuthGuard 组件会检查：
1. 用户是否已登录
2. Token 是否有效
3. 如果未登录，自动重定向到登录页

## 权限控制

### 页面级权限

通过路由守卫实现，所有路由都需要登录后才能访问。

### 组件级权限

在组件内部使用 `useUserRole` hook 获取用户角色，然后控制显示：

```typescript
import { useUserRole } from '@/stores/authStore';
import { Role } from '@/types/auth';

const userRole = useUserRole();

// 判断是否有审批权限
const hasApprovalPermission = userRole === Role.APPROVER || userRole === Role.MANAGER;

// 条件渲染
{hasApprovalPermission && (
  <Button type="primary">审批</Button>
)}
```

### API 级权限

后端实现数据级权限控制，前端只需正确调用 API 即可。

## 路由参数说明

### 动态参数

| 参数名 | 说明 | 示例 |
|-------|------|------|
| `:visitId` | 拜访记录 ID | `/visits/abc123` |
| `:id` | 礼品申请 ID | `/gifts/requisitions/xyz789` |

### 获取参数

```typescript
import { useParams } from 'react-router-dom';

const { visitId } = useParams<{ visitId: string }>();
const { id } = useParams<{ id: string }>();
```

## 常见导航场景

### 1. 从列表到详情

```typescript
// 在列表组件中
<Button onClick={() => navigate(`/visits/${record.visit_id}`)}>
  查看详情
</Button>
```

### 2. 从详情返回列表

```typescript
// 在详情组件中
<Button onClick={() => navigate('/visits')}>
  返回列表
</Button>
```

### 3. 创建新记录

```typescript
// 从列表或导航菜单
<Button onClick={() => navigate('/visits/create')}>
  新建拜访记录
</Button>
```

### 4. 编辑记录

```typescript
// 在列表或详情页
<Button onClick={() => navigate(`/visits/edit/${visitId}`)}>
  编辑
</Button>
```

### 5. 保存后返回列表

```typescript
// 在表单提交成功后
const handleSubmit = async () => {
  // ... 提交逻辑
  message.success('保存成功');
  navigate('/visits'); // 返回列表
};
```

## 注意事项

1. **路由大小写敏感**: 所有路由路径使用小写
2. **嵌套路由**: 子路由通过 `Outlet` 渲染在 MainLayout 中
3. **重定向**: 未匹配的路由会重定向到首页
4. **Token 过期**: 401 错误会自动清除 Token 并跳转到登录页
5. **权限变更**: 角色权限变更后需要重新登录生效
