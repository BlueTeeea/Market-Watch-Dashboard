# Market Watch Dashboard

一个运行在 Tampermonkey 上的油猴脚本，适用于 Charles Schwab 和 Interactive Brokers 网页平台。

它主要整合了：

- 美股市场总览
- 期权分析
- 个股研究
- AI 市场与个股分析
- 本地缓存、主题切换和中英文界面

## 项目简介

`Market Watch Dashboard` 可在以下网站中添加悬浮分析面板：

- `https://client.schwab.com/*`
- `https://ndcdyn.interactivebrokers.com/*`

面板主要分为四个标签页：

- `美股市场`
- `个股研究`
- `期权分析`
- `设置`

脚本会根据你打开的模块，从 Schwab、IBKR 以及可选的 AI 服务获取数据。

## 安装方法

1. 在浏览器中安装 [Tampermonkey](https://www.tampermonkey.net/)。
2. 安装发布版脚本：
  **[安装 Market Watch Dashboard](./dist/market-watch.user.js?raw=1)**
3. 在同一个浏览器配置中打开 Schwab 或 IBKR。
4. 点击页面上的悬浮分析按钮，打开面板。

## 建议的登录状态

为了让全部功能尽量稳定，建议你在同一个浏览器里同时保持以下登录状态：

- 已登录 Schwab：`client.schwab.com`
- 已登录 IBKR Portal：`ndcdyn.interactivebrokers.com`

原因如下：

- `美股市场` 和 `期权分析` 主要依赖 Schwab
- `个股研究` 中的大部分基本面和新闻研报依赖 IBKR
- AI 功能如果要真正生成结果，需要你自己的 OpenAI 或 Gemini API Key

## 脚本支持的主要功能

### 1. 美股市场

- 主要指数实时 ticker 栏
- 按地区或自选代码查看指数走势
- 市场日历与事件视图
- 突发新闻流与新闻正文加载
- 公司异动榜，支持排名、交易所、板块筛选
- AI 市场分析，支持可选联网搜索和引用

### 2. 个股研究

- 股票代码搜索与报价条
- 历史价格走势图
- 可用时启用实时模式 / 实时刷新
- IBKR 基本面标签页：
  - 概览
  - 公司概况
  - 社交情绪
  - 融券卖空
  - 财务报表
  - 关键比率
  - 评级
  - 分析师预测
  - 持股
  - 分红
  - 竞争对手
  - ESG
  - 投资主题
  - TipRanks / Trading Central / Estimize 入口
- IBKR 新闻研报分类：
  - 新闻
  - 研报
  - 评论
  - 新闻稿
  - 文件
  - 要点
  - 纪要
  - RSS
- AI 个股分析

### 3. 期权分析

- Schwab 股票代码搜索
- 行情与 mini chains 加载
- 按到期日加载完整期权链
- 关键价位：
  - call wall
  - put wall
  - max pain
  - gamma flip
- 分析指标：
  - net GEX
  - cumulative GEX
  - Greeks exposure
  - 成交量 / 持仓结构
  - implied move
  - put/call OI ratio
  - 自动化期权洞察
- 本地 IndexedDB 缓存
- 缓存预加载 / 导出 / 导入 / 刷新

### 4. 设置

- 浅色 / 深色 / 跟随系统
- 英文 / 中文切换
- OpenAI API Key
- Gemini API Key
- 缓存管理

## 模块 / 数据来源 / 登录要求对照表


| 模块                                             | 主要功能                                  | 主要数据来源                     | 需要登录 / 配置什么                                                                         |
| ---------------------------------------------- | ------------------------------------- | -------------------------- | ----------------------------------------------------------------------------------- |
| `美股市场 > Ticker 栏`                              | DJIA、Nasdaq、S&P 500、Russell 实时行情      | Schwab API                 | `Schwab`                                                                            |
| `美股市场 > 指数`                                    | 区域指数图、自选代码图                           | Schwab API                 | `Schwab`                                                                            |
| `美股市场 > 日历`                                    | 市场日历、事件、评级相关视图                        | Schwab + Schwab WallSt     | `Schwab`                                                                            |
| `美股市场 > 新闻`                                    | 新闻标题、正文、搜索                            | Schwab + Schwab WallSt     | `Schwab`                                                                            |
| `美股市场 > 公司异动`                                  | 按排名 / 交易所 / 板块查看异动                    | Schwab API                 | `Schwab`                                                                            |
| `美股市场 > AI 市场分析`                               | 基于当前市场面板数据生成 AI 摘要                    | 当前面板数据 + OpenAI 或 Gemini   | 市场数据需要 `Schwab`，AI 输出需要可选 `OpenAI API Key` 或 `Gemini API Key`                       |
| `个股研究 > 行情 / 价格图`                              | 股票报价、历史走势、部分实时更新                      | 主要来自 Schwab，实时流依赖页面上下文     | `Schwab`                                                                            |
| `个股研究 > 基本面`                                   | 概览、概况、财务、比率、评级、预测、持股、分红、竞争对手、ESG、主题   | IBKR Portal API            | `IBKR`                                                                              |
| `个股研究 > 社交情绪 / 融券卖空`                           | 情绪时间序列、借券 / 融券数据                      | IBKR Portal API            | `IBKR`                                                                              |
| `个股研究 > TipRanks / Trading Central / Estimize` | 第三方研究入口标签                             | IBKR Portal 路由             | `IBKR`                                                                              |
| `个股研究 > 新闻研报`                                  | 新闻流、分类、全文内容                           | IBKR News API              | `IBKR`                                                                              |
| `个股研究 > AI 个股分析`                               | 基于当前个股行情与新闻的 AI 报告                    | 当前个股面板数据 + OpenAI 或 Gemini | 报价图建议有 `Schwab`，若想带上新闻上下文建议也登录 `IBKR`，AI 输出需要可选 `OpenAI API Key` 或 `Gemini API Key` |
| `期权分析`                                         | 期权链、GEX、max pain、gamma flip、Greeks、洞察 | Schwab API                 | `Schwab`                                                                            |
| `设置 > 缓存`                                      | 刷新 / 清除 / 导出 / 导入缓存                   | 浏览器本地存储 + IndexedDB        | 不需要券商登录                                                                             |


## 每个模块分别需要登录什么网站

### 需要登录 Schwab 的部分

- `美股市场` 整个标签页
- `期权分析` 整个标签页
- `个股研究` 中的行情 / 价格图部分

### 需要登录 IBKR 的部分

- 个股基本面
- 个股社交情绪
- 个股融券卖空
- 个股新闻研报与全文
- IBKR 第三方研究入口标签

### 只有在你要使用 AI 时才需要配置 API Key

- `AI 市场分析`
- `AI 个股分析`

目前支持：

- OpenAI
- Google Gemini

## AI 配置方法

1. 打开面板。
2. 进入 `设置`。
3. 填入以下任意一个或两个：
  - OpenAI API Key
  - Gemini API Key
4. 点击 `保存`。

说明：

- API Key 只保存在你本地浏览器中
- 只会发送到对应的官方 API 端点
- AI 模块支持不开启联网搜索，也支持开启联网搜索和引用

## 重要说明

- 如果你是在 IBKR 页面上打开脚本，Schwab 相关模块仍然依赖同一浏览器里的 Schwab 登录会话。
- 如果 Schwab 会话过期，市场和期权请求可能失败，需要刷新并重新登录。
- 如果 IBKR 会话未激活，个股基本面和新闻页签会出现空白或报错。
- `AI 个股分析` 主要读取当前已加载的报价 / 图表上下文和个股新闻，不会把所有 Fundamentals 标签内容直接当作结构化输入。
- 期权链缓存保存在浏览器 IndexedDB 中。
- 主题、语言、最近股票代码、AI 设置也都保存在本地。

## 常见问题

### 面板能打开，但市场 / 期权数据加载失败

请检查：

- 是否已登录 Schwab
- Schwab 会话是否仍然有效
- Tampermonkey 是否对当前页面启用

### 个股基本面或个股新闻加载失败

请检查：

- 是否已登录 IBKR Portal
- IBKR 页面是否在同一个浏览器配置里打开

### AI 按钮能看到，但点了没有生成结果

请检查：

- 是否已在 `设置` 中保存至少一个 AI API Key
- 当前选择的模型是否和对应供应商匹配
- API Key 的额度或计费状态是否正常

## 许可证

[MIT](./LICENSE)