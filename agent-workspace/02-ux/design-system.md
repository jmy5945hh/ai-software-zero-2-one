# 设计系统基础

**文档版本**: v1.0
**创建时间**: 2026-01-08
**关联文档**: interaction-spec.md
**负责人**: UX Designer

---

## 文档说明

本文档定义"招财银行北京分行运营门户系统"的 UI 设计规范基础，包括颜色、字体、间距、圆角、阴影等，基于 Ant Design 5.x 组件库，确保全系统的视觉一致性。

**设计原则**:
- 保持简洁、专业的视觉风格
- 符合金融行业的设计规范
- 确保良好的可读性和可访问性
- 基于 Ant Design 5.x 组件库

---

## 1. 颜色系统

### 1.1 主色（Primary Color）

主色用于主要按钮、链接、焦点状态等关键交互元素。

**主色 - 蓝色**:

| 颜色变量 | 色值 | 用途 |
| --- | --- | --- |
| --primary-color | #1890ff | 主要按钮、链接、图标 |
| --primary-hover | #40a9ff | 主要按钮悬停状态 |
| --primary-active | #096dd9 | 主要按钮点击状态 |
| --primary-bg | #e6f7ff | 主色背景（浅色） |

**使用场景**:
- 主要按钮: "提交"、"保存"、"确定"等
- 链接文字
- 导航菜单高亮
- 图标高亮
- 输入框焦点边框

---

### 1.2 辅色（Secondary Color）

辅色用于次要按钮、标签等。

**辅色 - 灰色**:

| 颜色变量 | 色值 | 用途 |
| --- | --- | --- |
| --secondary-color | #8c8c8c | 次要文字、图标 |
| --secondary-bg | #fafafa | 次要背景 |
| --border-color | #d9d9d9 | 边框、分割线 |

**使用场景**:
- 次要按钮: "取消"、"重置"等
- 占位符文字
- 边框、分割线
- 表格边框

---

### 1.3 语义色（Semantic Colors）

语义色用于传达成功、警告、错误、信息等状态。

**成功色 - 绿色**:

| 颜色变量 | 色值 | 用途 |
| --- | --- | --- |
| --success-color | #52c41a | 成功提示、成功状态 |
| --success-bg | #f6ffed | 成功背景 |
| --success-border | #b7eb8f | 成功边框 |

**使用场景**:
- 成功提示: "操作成功"
- 状态标签: "已通过"、"成功"
- 成功图标
- 表单校验通过

---

**警告色 - 黄色**:

| 颜色变量 | 色值 | 用途 |
| --- | --- | --- |
| --warning-color | #faad14 | 警告提示、警告状态 |
| --warning-bg | #fffbe6 | 警告背景 |
| --warning-border | #ffe58f | 警告边框 |

**使用场景**:
- 警告提示: "请确认是否继续"
- 状态标签: "待审批"、"警告"
- 警告图标

---

**错误色 - 红色**:

| 颜色变量 | 色值 | 用途 |
| --- | --- | --- |
| --error-color | #ff4d4f | 错误提示、错误状态 |
| --error-bg | #fff2f0 | 错误背景 |
| --error-border | #ffccc7 | 错误边框 |

**使用场景**:
- 错误提示: "操作失败，请重试"
- 状态标签: "已驳回"、"失败"
- 错误图标
- 表单校验失败

---

**信息色 - 蓝色**:

| 颜色变量 | 色值 | 用途 |
| --- | --- | --- |
| --info-color | #1890ff | 信息提示 |
| --info-bg | #e6f7ff | 信息背景 |
| --info-border | #91d5ff | 信息边框 |

**使用场景**:
- 信息提示: "系统通知"
- 状态标签: "待审批"
- 信息图标

---

### 1.4 中性色（Neutral Colors）

中性色用于文字、背景、边框等。

**文字颜色**:

| 颜色变量 | 色值 | 用途 |
| --- | --- | --- |
| --text-primary | #262626 | 主要文字（标题、正文） |
| --text-secondary | #595959 | 次要文字（描述、说明） |
| --text-tertiary | #8c8c8c | 辅助文字（占位符、禁用） |
| --text-disabled | #bfbfbf | 禁用文字 |

**背景颜色**:

| 颜色变量 | 色值 | 用途 |
| --- | --- | --- |
| --bg-primary | #ffffff | 主要背景（白色） |
| --bg-secondary | #fafafa | 次要背景（浅灰色） |
| --bg-tertiary | #f5f5f5 | 第三背景（更浅灰色） |
| --bg-disabled | #f5f5f5 | 禁用背景 |

**边框颜色**:

| 颜色变量 | 色值 | 用途 |
| --- | --- | --- |
| --border-primary | #d9d9d9 | 主要边框 |
| --border-secondary | #f0f0f0 | 次要边框 |
| --border-disabled | #d9d9d9 | 禁用边框 |

---

### 1.5 颜色使用示例

**按钮颜色**:

```
主要按钮（Primary）:
  [提交]  (背景: #1890ff, 文字: #ffffff)

次要按钮（Default）:
  [取消]  (背景: #ffffff, 文字: #000000, 边框: #d9d9d9)

危险按钮（Danger）:
  [删除]  (背景: #ff4d4f, 文字: #ffffff)
```

**状态标签颜色**:

```
成功:  [已通过]  (背景: #f6ffed, 文字: #52c41a, 边框: #b7eb8f)
警告:  [待审批]  (背景: #fffbe6, 文字: #faad14, 边框: #ffe58f)
错误:  [已驳回]  (背景: #fff2f0, 文字: #ff4d4f, 边框: #ffccc7)
信息:  [处理中]  (背景: #e6f7ff, 文字: #1890ff, 边框: #91d5ff)
```

---

## 2. 字体系统

### 2.1 字体家族

**主字体**:
- 英文: `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial`
- 中文: `'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', '微软雅黑'`

**代码字体**:
- `'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace`

---

### 2.2 字号

| 字号变量 | 大小 | 字重 | 行高 | 用途 |
| --- | --- | --- | --- | --- |
| --font-size-xl | 24px | 500 | 1.35 | 一级标题 |
| --font-size-lg | 20px | 500 | 1.4 | 二级标题 |
| --font-size-md | 16px | 500 | 1.5 | 三级标题、重要文字 |
| --font-size-base | 14px | 400 | 1.5 | 正文、默认文字 |
| --font-size-sm | 12px | 400 | 1.5 | 辅助文字、说明文字 |

---

### 2.3 字重

| 字重变量 | 数值 | 用途 |
| --- | --- | --- |
| --font-weight-light | 300 | 轻量文字（较少使用） |
| --font-weight-normal | 400 | 正常文字（正文） |
| --font-weight-medium | 500 | 中等文字（标题、强调） |
| --font-weight-semibold | 600 | 半粗文字（较少使用） |
| --font-weight-bold | 700 | 粗体文字（较少使用） |

---

### 2.4 行高

| 行高变量 | 数值 | 用途 |
| --- | --- | --- |
| --line-height-tight | 1.25 | 标题行高 |
| --line-height-base | 1.5 | 正文行高 |
| --line-height-loose | 1.75 | 列表、描述行高 |

---

### 2.5 字体使用示例

**标题层级**:

```
一级标题 (24px, 500):
  招财银行北京分行运营门户系统

二级标题 (20px, 500):
  拜访记录列表

三级标题 (16px, 500):
  客户拜访详情

正文 (14px, 400):
  这是正文内容，用于描述和说明。

辅助文字 (12px, 400):
  这是辅助说明文字，用于补充信息。
```

---

## 3. 间距系统

### 3.1 基础间距单位

使用 4px 作为基础间距单位，所有间距为 4px 的倍数。

| 间距变量 | 数值 | 用途 |
| --- | --- | --- |
| --spacing-xs | 4px | 极小间距（图标与文字） |
| --spacing-sm | 8px | 小间距（表单字段间距） |
| --spacing-md | 16px | 中等间距（卡片内边距） |
| --spacing-lg | 24px | 大间距（模块间距） |
| --spacing-xl | 32px | 超大间距（页面外边距） |

---

### 3.2 间距使用示例

**表单间距**:

```
表单字段间距: 8px (--spacing-sm)
表单组间距: 24px (--spacing-lg)
```

**卡片间距**:

```
卡片内边距: 16px (--spacing-md)
卡片外边距: 24px (--spacing-lg)
```

**列表间距**:

```
列表项内边距: 12px (3 * 4px)
列表项间距: 0px (无边框)
```

---

## 4. 圆角系统

### 4.1 圆角大小

| 圆角变量 | 数值 | 用途 |
| --- | --- | --- |
| --border-radius-sm | 2px | 小圆角（按钮、输入框） |
| --border-radius-base | 4px | 基础圆角（卡片、弹窗） |
| --border-radius-lg | 8px | 大圆角（标签、徽章） |

---

### 4.2 圆角使用示例

**按钮圆角**:

```
主要按钮: border-radius: 2px (--border-radius-sm)
次要按钮: border-radius: 2px (--border-radius-sm)
```

**卡片圆角**:

```
卡片: border-radius: 4px (--border-radius-base)
弹窗: border-radius: 4px (--border-radius-base)
```

**标签圆角**:

```
状态标签: border-radius: 8px (--border-radius-lg)
```

---

## 5. 阴影系统

### 5.1 阴影级别

| 阴影变量 | 数值 | 用途 |
| --- | --- | --- |
| --shadow-sm | 0 1px 2px rgba(0, 0, 0, 0.03) | 小阴影（按钮悬停） |
| --shadow-base | 0 1px 4px rgba(0, 0, 0, 0.08) | 基础阴影（卡片） |
| --shadow-lg | 0 4px 12px rgba(0, 0, 0, 0.15) | 大阴影（弹窗、下拉菜单） |

---

### 5.2 阴影使用示例

**卡片阴影**:

```
正常状态: box-shadow: none
悬停状态: box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08) (--shadow-base)
```

**按钮阴影**:

```
正常状态: box-shadow: none
悬停状态: box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03) (--shadow-sm)
```

**弹窗阴影**:

```
弹窗: box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15) (--shadow-lg)
```

---

## 6. 组件样式规范

### 6.1 按钮

**主要按钮（Primary Button）**:

```
背景: #1890ff (--primary-color)
文字: #ffffff
边框: none
圆角: 2px (--border-radius-sm)
高度: 32px
内边距: 4px 16px
字号: 14px (--font-size-base)
字重: 500 (--font-weight-medium)
```

**交互状态**:
- 悬停: 背景 #40a9ff (--primary-hover)
- 点击: 背景 #096dd9 (--primary-active)
- 禁用: 背景 #d9d9d9, 文字 #bfbfbf, 光标 not-allowed

---

**次要按钮（Default Button）**:

```
背景: #ffffff
文字: #000000
边框: 1px solid #d9d9d9 (--border-primary)
圆角: 2px (--border-radius-sm)
高度: 32px
内边距: 4px 16px
字号: 14px (--font-size-base)
字重: 400 (--font-weight-normal)
```

**交互状态**:
- 悬停: 边框 #40a9ff, 文字 #40a9ff
- 点击: 边框 #096dd9, 文字 #096dd9
- 禁用: 边框 #d9d9d9, 文字 #bfbfbf, 光标 not-allowed

---

**危险按钮（Danger Button）**:

```
背景: #ff4d4f (--error-color)
文字: #ffffff
边框: none
圆角: 2px (--border-radius-sm)
高度: 32px
内边距: 4px 16px
字号: 14px (--font-size-base)
字重: 500 (--font-weight-medium)
```

**交互状态**:
- 悬停: 背景 #ff7875
- 点击: 背景 #d9363e
- 禁用: 背景 #d9d9d9, 文字 #bfbfbf, 光标 not-allowed

---

### 6.2 输入框

**文本输入框**:

```
背景: #ffffff
边框: 1px solid #d9d9d9 (--border-primary)
圆角: 2px (--border-radius-sm)
高度: 32px
内边距: 4px 12px
字号: 14px (--font-size-base)
字重: 400 (--font-weight-normal)
占位符颜色: #bfbfbf (--text-tertiary)
```

**交互状态**:
- 悬停: 边框 #40a9ff
- 焦点: 边框 #1890ff (--primary-color), 阴影 0 0 0 2px rgba(24, 144, 255, 0.2)
- 禁用: 背景 #f5f5f5, 边框 #d9d9d9, 光标 not-allowed
- 错误: 边框 #ff4d4f (--error-color)

---

### 6.3 下拉选择框

**单选下拉框**:

```
背景: #ffffff
边框: 1px solid #d9d9d9 (--border-primary)
圆角: 2px (--border-radius-sm)
高度: 32px
内边距: 4px 12px
字号: 14px (--font-size-base)
字重: 400 (--font-weight-normal)
```

**下拉菜单**:
- 背景: #ffffff
- 边框: 1px solid #f0f0f0
- 阴影: 0 4px 12px rgba(0, 0, 0, 0.15) (--shadow-lg)
- 圆角: 4px (--border-radius-base)
- 菜单项高度: 32px
- 菜单项内边距: 4px 12px
- 菜单项悬停: 背景 #f5f5f5

---

### 6.4 表格

**表格边框**:

```
边框: 1px solid #f0f0f0 (--border-secondary)
```

**表格头部**:
- 背景: #fafafa (--bg-secondary)
- 文字: #262626 (--text-primary)
- 字重: 500 (--font-weight-medium)
- 字号: 14px (--font-size-base)
- 高度: 56px

**表格行**:
- 文字: #595959 (--text-secondary)
- 字号: 14px (--font-size-base)
- 高度: 64px
- 边框底部: 1px solid #f0f0f0

**表格行悬停**:
- 背景: #fafafa (--bg-secondary)

**表格行选中**:
- 背景: #e6f7ff (--primary-bg)

---

### 6.5 标签（Tag）

**状态标签**:

```
高度: 24px
内边距: 0 8px
圆角: 8px (--border-radius-lg)
字号: 12px (--font-size-sm)
字重: 500 (--font-weight-medium)
```

**状态标签颜色**:

| 状态 | 背景 | 文字 | 边框 |
| --- | --- | --- | --- |
| 成功 | #f6ffed | #52c41a | #b7eb8f |
| 警告 | #fffbe6 | #faad14 | #ffe58f |
| 错误 | #fff2f0 | #ff4d4f | #ffccc7 |
| 信息 | #e6f7ff | #1890ff | #91d5ff |

---

### 6.6 卡片（Card）

**卡片样式**:

```
背景: #ffffff
边框: 1px solid #f0f0f0 (--border-secondary)
圆角: 4px (--border-radius-base)
内边距: 24px (--spacing-lg)
阴影: none
```

**卡片悬停**:
- 阴影: 0 1px 4px rgba(0, 0, 0, 0.08) (--shadow-base)

---

### 6.7 弹窗（Modal）

**弹窗遮罩**:
- 背景: rgba(0, 0, 0, 0.45)

**弹窗内容**:
- 背景: #ffffff
- 圆角: 4px (--border-radius-base)
- 阴影: 0 4px 12px rgba(0, 0, 0, 0.15) (--shadow-lg)
- 内边距: 24px (--spacing-lg)

**弹窗头部**:
- 字号: 20px (--font-size-lg)
- 字重: 500 (--font-weight-medium)
- 颜色: #262626 (--text-primary)
- 下边框: 1px solid #f0f0f0
- 内边距: 16px 24px

---

### 6.8 消息提示（Message）

**消息提示样式**:

```
内边距: 10px 16px
圆角: 4px (--border-radius-base)
字号: 14px (--font-size-base)
字重: 400 (--font-weight-normal)
阴影: 0 4px 12px rgba(0, 0, 0, 0.15) (--shadow-lg)
```

**消息提示颜色**:

| 类型 | 背景 | 文字 | 图标 |
| --- | --- | --- | --- |
| 成功 | #f6ffed | #52c41a | ✓ |
| 警告 | #fffbe6 | #faad14 | ⚠ |
| 错误 | #fff2f0 | #ff4d4f | ✗ |
| 信息 | #e6f7ff | #1890ff | ℹ |

---

## 7. 图标系统

### 7.1 图标库

使用 Ant Design Icons 图标库，包含以下常用图标：

| 图标名称 | 用途 |
| --- | --- |
| Home | 首页 |
| User | 用户 |
| Setting | 设置 |
| Check | 成功、通过 |
| Close | 关闭、删除 |
| Search | 搜索 |
| Edit | 编辑 |
| Plus | 新增 |
| Minus | 减少 |
| ArrowUp | 上箭头 |
| ArrowDown | 下箭头 |
| ArrowLeft | 左箭头 |
| ArrowRight | 右箭头 |
| Loading | 加载中 |

---

### 7.2 图标大小

| 尺寸变量 | 数值 | 用途 |
| --- | --- | --- |
| --icon-size-xs | 12px | 极小图标（与辅助文字配合） |
| --icon-size-sm | 16px | 小图标（与正文配合） |
| --icon-size-base | 24px | 基础图标（默认） |
| --icon-size-lg | 32px | 大图标（标题图标） |

---

### 7.3 图标颜色

**单色图标**:
- 默认: #595959 (--text-secondary)
- 悬停: #1890ff (--primary-color)
- 激活: #1890ff (--primary-color)
- 禁用: #bfbfbf (--text-disabled)

**彩色图标**:
- 成功: #52c41a (--success-color)
- 警告: #faad14 (--warning-color)
- 错误: #ff4d4f (--error-color)
- 信息: #1890ff (--info-color)

---

## 8. 数据可视化

### 8.1 图表颜色

**折线图/条形图颜色**:

```
主色: #1890ff (--primary-color)
辅色: #13c2c2, #2fc25b, #facc14, #f04864, #8543e0
```

**饼图颜色**:

```
颜色1: #5b8ff9
颜色2: #5ad8a6
颜色3: #5d7092
颜色4: #f6bd16
颜色5: #e86452
```

---

### 8.2 图表样式

**图表文字**:
- 标题字号: 16px (--font-size-md)
- 轴标签字号: 12px (--font-size-sm)
- 图例字号: 12px (--font-size-sm)

**图表线条**:
- 网格线颜色: #f0f0f0 (--border-secondary)
- 坐标轴颜色: #d9d9d9 (--border-primary)

---

## 9. 可访问性

### 9.1 焦点可见性

**焦点边框**:
- 颜色: #1890ff (--primary-color)
- 宽度: 2px
- 样式: 实线
- 阴影: 0 0 0 2px rgba(24, 144, 255, 0.2)

---

### 9.2 颜色对比度

**文字与背景对比度**:
- 主要文字 (#262626) 与 白色背景 (#ffffff): 对比度 ≥ 14:1 ✓
- 次要文字 (#595959) 与 白色背景 (#ffffff): 对比度 ≥ 7:1 ✓
- 辅助文字 (#8c8c8c) 与 白色背景 (#ffffff): 对比度 ≥ 4.5:1 ✓

**链接与背景对比度**:
- 链接 (#1890ff) 与 白色背景 (#ffffff): 对比度 ≥ 4.5:1 ✓

---

### 9.3 色盲友好

**不仅依赖颜色传达信息**:
- 状态标签: 使用图标 + 颜色
- 表单校验: 使用图标 + 文字 + 颜色
- 数据图表: 使用不同图案 + 颜色

---

## 10. 响应式设计

**本系统仅支持 PC 端，无需响应式设计。**

**PC 端断点**（参考）:

| 断点变量 | 数值 | 说明 |
| --- | --- | --- |
| --screen-sm | 576px | 小屏幕（不适用） |
| --screen-md | 768px | 平板屏幕（不适用） |
| --screen-lg | 992px | 中等屏幕 |
| --screen-xl | 1200px | 大屏幕 |
| --screen-xxl | 1600px | 超大屏幕 |

---

## 11. Ant Design 组件使用建议

### 11.1 常用组件清单

| 组件名称 | 使用场景 | 说明 |
| --- | --- | --- |
| Button | 所有按钮 | 主要、次要、危险按钮 |
| Input | 文本输入 | 表单输入框 |
| Select | 下拉选择 | 单选、多选下拉框 |
| DatePicker | 日期选择 | 单日期、日期区间 |
| Table | 数据表格 | 列表展示 |
| Form | 表单容器 | 表单布局和校验 |
| Modal | 弹窗 | 确认对话框、详情弹窗 |
| Message | 消息提示 | 全局提示 |
| Tag | 标签 | 状态标签 |
| Card | 卡片 | 内容容器 |
| Menu | 导航菜单 | 左侧导航菜单 |
| Breadcrumb | 面包屑 | 面包屑导航 |
| Dropdown | 下拉菜单 | 用户菜单 |
| Avatar | 头像 | 用户头像 |
| Tooltip | 提示框 | 悬停提示 |
| Spin | 加载动画 | Loading 状态 |
| Empty | 空状态 | 无数据提示 |

---

### 11.2 组件自定义

**主题定制**（通过 ConfigProvider）:

```javascript
const theme = {
  token: {
    colorPrimary: '#1890ff',      // 主色
    colorSuccess: '#52c41a',      // 成功色
    colorWarning: '#faad14',      // 警告色
    colorError: '#ff4d4f',        // 错误色
    colorInfo: '#1890ff',         // 信息色
    fontSize: 14,                 // 基础字号
    borderRadius: 2,              // 圆角
  },
};
```

---

## 12. 待确认事项

1. **品牌色**: 是否需要使用招财银行的品牌色（当前使用 Ant Design 默认蓝色）
2. **Logo 尺寸**: Logo 的具体尺寸和格式（PNG/SVG）
3. **背景图片**: 是否需要登录页背景图片
4. **图表主题**: ECharts 图表是否需要自定义主题
5. **动画效果**: 是否需要自定义动画效果（当前使用 Ant Design 默认动画）

---

**文档变更记录**:
- v1.0 (2026-01-08): 初始版本，基于 Ant Design 5.x 定义设计系统基础
