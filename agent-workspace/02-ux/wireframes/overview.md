# 线框图概览 - 招财银行北京分行运营门户系统

## 1. 线框图目录

本系统包含以下主要页面的线框图设计：

### 1.1 登录与首页
- 登录页面 (login.md)
- 首页 (home.md)

### 1.2 客户拜访管理
- 拜访记录列表页 (customer-visit-list.md)
- 新增拜访记录页 (customer-visit-create.md)
- 编辑拜访记录页 (customer-visit-edit.md)

### 1.3 礼品申请管理
- 礼品申请列表页 (gift-application-list.md)
- 新增礼品申请页 (gift-application-create.md)
- 礼品申请详情页 (gift-application-detail.md)

### 1.4 礼品审批管理
- 待审批列表页 (gift-approval-pending.md)
- 已审批列表页 (gift-approval-approved.md)
- 审批详情页 (gift-approval-detail.md)

### 1.5 首页管理
- 轮播图管理页 (carousel-management.md)
- 新闻管理页 (news-management.md)
- 新闻编辑页 (news-edit.md)

### 1.6 运营数据大屏
- 数据大屏页 (operations-dashboard.md)

### 1.7 礼品台账
- 台账列表页 (gift-ledger-list.md)
- 统计分析页 (gift-statistics.md)

### 1.8 AI问答助理
- AI问答侧边栏 (ai-assistant.md)

## 2. 设计原则

### 2.1 一致性原则
- 所有页面保持统一的布局结构
- 使用相同的颜色、字体和间距规范
- 保持导航和操作元素的一致性

### 2.2 易用性原则
- 重要功能放置在显眼位置
- 操作流程简洁明了
- 提供清晰的反馈和提示信息

### 2.3 可访问性原则
- 确保足够的颜色对比度
- 提供键盘导航支持
- 为视觉元素提供文字说明

## 3. 线框图说明符号

### 3.1 组件标识
- [HEADER] - 页面头部区域
- [SIDEBAR] - 侧边栏导航区域
- [MAIN] - 主内容区域
- [FOOTER] - 页面底部区域
- [MODAL] - 弹窗组件

### 3.2 交互说明
- {CLICK} - 点击交互
- {HOVER} - 悬停交互
- {INPUT} - 输入交互
- {SELECT} - 选择交互

### 3.3 状态说明
- [NORMAL] - 正常状态
- [HOVER] - 悬停状态
- [ACTIVE] - 激活状态
- [DISABLED] - 禁用状态

## 4. 响应式设计考虑

所有线框图均考虑以下屏幕尺寸：
- 桌面端：1200px+ 宽度
- 平板端：768px-1199px 宽度
- 移动端：<768px 宽度

## 5. 用户角色权限说明

线框图中涉及的用户角色权限：
- 客户经理：可访问客户拜访、礼品申请、AI问答
- 运营人员：可访问首页管理、运营数据、礼品台账、AI问答
- 审批人员：可访问礼品审批、礼品台账、AI问答
- 分行管理者：可访问运营数据大屏、礼品台账、AI问答

## 6. 通用组件

### 6.1 表单组件
- 输入框 (Input)
- 文本域 (Textarea)
- 下拉选择 (Select)
- 日期选择器 (DatePicker)
- 多选框 (Checkbox)
- 单选框 (Radio)

### 6.2 数据展示组件
- 表格 (Table)
- 卡片 (Card)
- 标签 (Tag)
- 分页器 (Pagination)

### 6.3 操作组件
- 按钮 (Button)
- 面包屑 (Breadcrumb)
- 标签页 (Tabs)
- 模态框 (Modal)

## 7. 颜色规范（线框图中）

- 主色调：#1890FF (蓝色，用于主要按钮和链接)
- 成功色：#52C41A (绿色，用于成功状态)
- 警告色：#FAAD14 (橙色，用于警告状态)
- 错误色：#FF4D4F (红色，用于错误状态)
- 背景色：#F5F5F5 (浅灰，用于页面背景)
- 边框色：#D9D9D9 (灰色，用于边框)