# ledger 记账本

一个前后端完整的记账应用：原生 HTML/CSS/JS 前端 + Node/Express 后端，数据持久化在 `server/data.json` 文件中。

## 功能

- **账单列表**：按日期倒序展示全部账单
- **筛选**：按月份、分类、类型（收入/支出）组合筛选，可一键重置
- **统计**：当前筛选范围的收入/支出/结余卡片、月度收支统计表、分类汇总表
- **记账**：添加、编辑、删除账单（表单弹窗）

## 目录结构

```
ledger/
├── client/            # 前端（由 Express 静态托管）
│   ├── index.html
│   ├── style.css
│   └── app.js
├── server/
│   ├── index.js       # Express 服务与 REST API
│   └── data.json      # 数据存储（内置 20 条示例账单）
├── package.json
└── README.md
```

## 安装与启动

```bash
cd /data/home/zcode-projects/ledger
npm install
npm start
```

启动后访问 <http://localhost:3003>。后端固定使用端口 **3003**；如需临时更换，可用 `PORT=8080 npm start`。

## REST API

Base URL: `http://localhost:3003`

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/bills` | 账单列表，支持 `?month=2026-10&category=餐饮&type=expense` |
| GET | `/api/bills/:id` | 账单详情 |
| POST | `/api/bills` | 新增账单 |
| PUT | `/api/bills/:id` | 编辑账单 |
| DELETE | `/api/bills/:id` | 删除账单 |
| GET | `/api/categories` | 收入/支出可选分类 |
| GET | `/api/summary/categories` | 分类汇总，支持 `?month=&type=` |
| GET | `/api/summary/months` | 月度收支汇总（收入/支出/结余/笔数） |

账单字段：`type`（`income`/`expense`）、`category`（分类）、`amount`（金额）、`date`（`YYYY-MM-DD`）、`note`（备注，选填）。

### curl 示例

```bash
# 列出全部账单
curl http://localhost:3003/api/bills

# 新增一笔支出
curl -X POST http://localhost:3003/api/bills \
  -H 'Content-Type: application/json' \
  -d '{"type":"expense","category":"餐饮","amount":66.6,"date":"2026-10-25","note":"测试"}'

# 2026-10 分类汇总
curl 'http://localhost:3003/api/summary/categories?month=2026-10'

# 月度汇总
curl http://localhost:3003/api/summary/months
```

## 数据存储

所有账单保存在 `server/data.json`，每次增删改都会立即写回该文件，重启服务数据不丢失。项目内置 20 条 2026-09 与 2026-10 的示例账单；若删除该文件，服务会以空数据重新创建。
