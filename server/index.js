const express = require('express');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT) || 3003;
const DATA_FILE = path.join(__dirname, 'data.json');
const CLIENT_DIR = path.join(__dirname, '..', 'client');

const INCOME_CATEGORIES = ['工资', '理财', '兼职', '红包', '其他'];
const EXPENSE_CATEGORIES = ['餐饮', '交通', '购物', '娱乐', '医疗', '住房', '其他'];
const MONTH_RE = /^\d{4}-\d{2}$/;

function round2(n) {
  return Math.round(n * 100) / 100;
}

function loadBills() {
  try {
    const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function saveBills(bills) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(bills, null, 2) + '\n', 'utf8');
}

function nextId(bills) {
  return bills.reduce((max, b) => Math.max(max, Number(b.id) || 0), 0) + 1;
}

// 校验并规整请求体，返回 { bill } 或 { error }
function parseBill(body) {
  const type = body.type;
  const category = String(body.category || '').trim();
  const amount = Number(body.amount);
  const date = String(body.date || '').trim();
  const note = String(body.note || '').trim();

  if (type !== 'income' && type !== 'expense') return { error: 'type 必须是 income 或 expense' };
  if (!category) return { error: 'category 不能为空' };
  if (!Number.isFinite(amount) || amount < 0) return { error: 'amount 必须是不小于 0 的数字' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: 'date 必须是 YYYY-MM-DD 格式' };
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) {
    return { error: 'date 不是合法的日期' };
  }
  return { bill: { type, category, amount: round2(amount), date, note } };
}

const app = express();
app.use(express.json());
app.use(express.static(CLIENT_DIR));

// 账单列表，支持 ?month=YYYY-MM&category=分类&type=income|expense 筛选，按日期倒序
app.get('/api/bills', (req, res) => {
  const { month = '', category = '', type = '' } = req.query;
  if (month && !MONTH_RE.test(month)) return res.status(400).json({ error: 'month 参数必须是 YYYY-MM 格式' });
  let bills = loadBills();
  if (month) bills = bills.filter((b) => b.date.startsWith(month));
  if (category) bills = bills.filter((b) => b.category === category);
  if (type) bills = bills.filter((b) => b.type === type);
  bills = bills.slice().sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
  res.json({ total: bills.length, bills });
});

// 账单详情
app.get('/api/bills/:id', (req, res) => {
  const bill = loadBills().find((b) => b.id === Number(req.params.id));
  if (!bill) return res.status(404).json({ error: `账单 ${req.params.id} 不存在` });
  res.json(bill);
});

// 新增账单
app.post('/api/bills', (req, res) => {
  const { bill, error } = parseBill(req.body || {});
  if (error) return res.status(400).json({ error });
  const bills = loadBills();
  const created = { id: nextId(bills), ...bill };
  bills.push(created);
  saveBills(bills);
  res.status(201).json(created);
});

// 编辑账单
app.put('/api/bills/:id', (req, res) => {
  const bills = loadBills();
  const target = bills.find((b) => b.id === Number(req.params.id));
  if (!target) return res.status(404).json({ error: `账单 ${req.params.id} 不存在` });
  const { bill, error } = parseBill(req.body || {});
  if (error) return res.status(400).json({ error });
  Object.assign(target, bill);
  saveBills(bills);
  res.json(target);
});

// 删除账单
app.delete('/api/bills/:id', (req, res) => {
  const bills = loadBills();
  const index = bills.findIndex((b) => b.id === Number(req.params.id));
  if (index === -1) return res.status(404).json({ error: `账单 ${req.params.id} 不存在` });
  const [removed] = bills.splice(index, 1);
  saveBills(bills);
  res.json({ deleted: removed });
});

// 收入/支出可选分类（供前端下拉框使用）
app.get('/api/categories', (req, res) => {
  res.json({ income: INCOME_CATEGORIES, expense: EXPENSE_CATEGORIES });
});

// 分类汇总，支持 ?month=YYYY-MM&type=income|expense
app.get('/api/summary/categories', (req, res) => {
  const { month = '', type = '' } = req.query;
  if (month && !MONTH_RE.test(month)) return res.status(400).json({ error: 'month 参数必须是 YYYY-MM 格式' });
  let bills = loadBills();
  if (month) bills = bills.filter((b) => b.date.startsWith(month));
  if (type) bills = bills.filter((b) => b.type === type);
  const byCategory = new Map();
  for (const b of bills) {
    const item = byCategory.get(b.category) || { category: b.category, income: 0, expense: 0, count: 0 };
    if (b.type === 'income') item.income = round2(item.income + b.amount);
    else item.expense = round2(item.expense + b.amount);
    item.count += 1;
    byCategory.set(b.category, item);
  }
  const categories = [...byCategory.values()].sort((a, b) => b.income + b.expense - (a.income + a.expense));
  res.json({ total: categories.length, categories });
});

// 月度收支汇总：每个月的收入、支出、结余，按月份倒序
app.get('/api/summary/months', (req, res) => {
  const byMonth = new Map();
  for (const b of loadBills()) {
    const month = String(b.date).slice(0, 7);
    const item = byMonth.get(month) || { month, income: 0, expense: 0, count: 0 };
    if (b.type === 'income') item.income = round2(item.income + b.amount);
    else item.expense = round2(item.expense + b.amount);
    item.count += 1;
    byMonth.set(month, item);
  }
  const months = [...byMonth.values()]
    .map((m) => ({ ...m, balance: round2(m.income - m.expense) }))
    .sort((a, b) => b.month.localeCompare(a.month));
  res.json({ total: months.length, months });
});

app.use((req, res) => {
  res.status(404).json({ error: '接口或资源不存在' });
});

app.listen(PORT, () => {
  console.log(`ledger 记账本已启动: http://localhost:${PORT}`);
});
