/* ledger 记账本 前端逻辑
   账单列表 / 分类筛选 / 月度收支统计 / 添加与编辑账单 */

const API = {
  bills: '/api/bills',
  categories: '/api/categories',
  summaryMonths: '/api/summary/months',
  summaryCategories: '/api/summary/categories',
};

const FALLBACK_CATEGORIES = {
  income: ['工资', '理财', '兼职', '红包', '其他'],
  expense: ['餐饮', '交通', '购物', '娱乐', '医疗', '住房', '其他'],
};

const els = {
  filterMonth: document.querySelector('#filter-month'),
  filterCategory: document.querySelector('#filter-category'),
  filterType: document.querySelector('#filter-type'),
  btnReset: document.querySelector('#btn-reset'),
  btnAdd: document.querySelector('#btn-add'),
  statIncome: document.querySelector('#stat-income'),
  statExpense: document.querySelector('#stat-expense'),
  statBalance: document.querySelector('#stat-balance'),
  statCount: document.querySelector('#stat-count'),
  listHint: document.querySelector('#list-hint'),
  billBody: document.querySelector('#bill-table tbody'),
  billEmpty: document.querySelector('#bill-empty'),
  monthBody: document.querySelector('#month-table tbody'),
  monthEmpty: document.querySelector('#month-empty'),
  categoryBody: document.querySelector('#category-table tbody'),
  categoryEmpty: document.querySelector('#category-empty'),
  modalMask: document.querySelector('#modal-mask'),
  form: document.querySelector('#bill-form'),
  formTitle: document.querySelector('#form-title'),
  formType: document.querySelector('#form-type'),
  formCategory: document.querySelector('#form-category'),
  formAmount: document.querySelector('#form-amount'),
  formDate: document.querySelector('#form-date'),
  formNote: document.querySelector('#form-note'),
  formError: document.querySelector('#form-error'),
  btnCancel: document.querySelector('#btn-cancel'),
  toast: document.querySelector('#toast'),
};

const state = {
  categories: FALLBACK_CATEGORIES,
  bills: [],
  months: [],
  editingId: null,
  toastTimer: null,
};

/* ---------- 工具 ---------- */

function money(n) {
  return `¥${Number(n || 0).toFixed(2)}`;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
  ));
}

function todayStr() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

async function request(url, options = {}) {
  const res = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...options });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `请求失败（HTTP ${res.status}）`);
  return data;
}

function currentQuery() {
  const params = new URLSearchParams();
  if (els.filterMonth.value) params.set('month', els.filterMonth.value);
  if (els.filterCategory.value) params.set('category', els.filterCategory.value);
  if (els.filterType.value) params.set('type', els.filterType.value);
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

function safeRefresh() {
  return refresh().catch((err) => toast(err.message, true));
}

/* ---------- 数据加载 ---------- */

async function refresh() {
  const month = els.filterMonth.value;
  const [billsData, monthsData, catSummary] = await Promise.all([
    request(`${API.bills}${currentQuery()}`),
    request(API.summaryMonths),
    request(`${API.summaryCategories}${month ? `?month=${encodeURIComponent(month)}` : ''}`),
  ]);
  state.bills = billsData.bills;
  state.months = monthsData.months;
  renderMonthOptions();
  renderBills();
  renderStats();
  renderMonthTable();
  renderCategoryTable(catSummary.categories);
}

/* ---------- 渲染 ---------- */

function renderMonthOptions() {
  const selected = els.filterMonth.value;
  els.filterMonth.innerHTML = ['<option value="">全部月份</option>']
    .concat(state.months.map((m) => `<option value="${m.month}">${m.month}</option>`))
    .join('');
  els.filterMonth.value = selected;
}

function renderBills() {
  els.billBody.innerHTML = state.bills.map((b) => `
    <tr>
      <td>${escapeHtml(b.date)}</td>
      <td><span class="badge ${b.type}">${b.type === 'income' ? '收入' : '支出'}</span></td>
      <td>${escapeHtml(b.category)}</td>
      <td class="num amount ${b.type}">${b.type === 'income' ? '+' : '-'}${money(b.amount)}</td>
      <td><div class="note-cell">${escapeHtml(b.note) || '<span class="muted">—</span>'}</div></td>
      <td class="ops">
        <button type="button" class="link-btn" data-action="edit" data-id="${b.id}">编辑</button>
        <button type="button" class="link-btn danger" data-action="delete" data-id="${b.id}">删除</button>
      </td>
    </tr>`).join('');
  els.billEmpty.classList.toggle('hidden', state.bills.length > 0);
}

function renderStats() {
  let income = 0;
  let expense = 0;
  for (const b of state.bills) {
    if (b.type === 'income') income += b.amount;
    else expense += b.amount;
  }
  const balance = income - expense;
  els.statIncome.textContent = money(income);
  els.statExpense.textContent = money(expense);
  els.statBalance.textContent = money(balance);
  els.statBalance.classList.toggle('income', balance > 0);
  els.statBalance.classList.toggle('expense', balance < 0);
  els.statCount.textContent = String(state.bills.length);
  els.listHint.textContent = `共 ${state.bills.length} 笔`;
}

function renderMonthTable() {
  els.monthEmpty.classList.toggle('hidden', state.months.length > 0);
  els.monthBody.innerHTML = state.months.map((m) => `
    <tr class="clickable" data-month="${m.month}" title="点击筛选该月账单">
      <td>${m.month}</td>
      <td class="num income-text">${money(m.income)}</td>
      <td class="num expense-text">${money(m.expense)}</td>
      <td class="num">${money(m.balance)}</td>
      <td class="num">${m.count}</td>
    </tr>`).join('');
}

function renderCategoryTable(categories) {
  els.categoryEmpty.classList.toggle('hidden', categories.length > 0);
  els.categoryBody.innerHTML = categories.map((c) => `
    <tr>
      <td>${escapeHtml(c.category)}</td>
      <td class="num income-text">${c.income ? money(c.income) : '—'}</td>
      <td class="num expense-text">${c.expense ? money(c.expense) : '—'}</td>
      <td class="num">${c.count}</td>
    </tr>`).join('');
}

/* ---------- 添加 / 编辑弹窗 ---------- */

function fillFormCategories(type, selected = '') {
  const list = state.categories[type] || [];
  els.formCategory.innerHTML = list
    .map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`)
    .join('');
  if (selected && list.includes(selected)) els.formCategory.value = selected;
}

function openModal(bill = null) {
  state.editingId = bill ? bill.id : null;
  els.formTitle.textContent = bill ? '编辑账单' : '记一笔';
  els.formType.value = bill ? bill.type : 'expense';
  fillFormCategories(els.formType.value, bill ? bill.category : '');
  els.formAmount.value = bill ? bill.amount : '';
  els.formDate.value = bill ? bill.date : todayStr();
  els.formNote.value = bill ? bill.note : '';
  hideFormError();
  els.modalMask.classList.remove('hidden');
  els.formAmount.focus();
}

function closeModal() {
  els.modalMask.classList.add('hidden');
  state.editingId = null;
  els.form.reset();
}

function showFormError(message) {
  els.formError.textContent = message;
  els.formError.classList.remove('hidden');
}

function hideFormError() {
  els.formError.classList.add('hidden');
}

async function onFormSubmit(event) {
  event.preventDefault();
  const editing = state.editingId;
  const payload = {
    type: els.formType.value,
    category: els.formCategory.value,
    amount: els.formAmount.value,
    date: els.formDate.value,
    note: els.formNote.value.trim(),
  };
  if (!payload.category) return showFormError('请选择分类');
  if (payload.amount === '' || Number.isNaN(Number(payload.amount)) || Number(payload.amount) < 0) {
    return showFormError('请输入正确的金额');
  }
  if (!payload.date) return showFormError('请选择日期');
  try {
    if (editing) {
      await request(`${API.bills}/${editing}`, { method: 'PUT', body: JSON.stringify(payload) });
      toast('账单已更新');
    } else {
      await request(API.bills, { method: 'POST', body: JSON.stringify(payload) });
      toast('记账成功');
    }
    closeModal();
    await safeRefresh();
  } catch (err) {
    showFormError(err.message);
  }
}

/* ---------- 删除 ---------- */

async function onTableAction(event) {
  const btn = event.target.closest('button[data-action]');
  if (!btn) return;
  const id = Number(btn.dataset.id);
  if (btn.dataset.action === 'edit') {
    const bill = state.bills.find((b) => b.id === id);
    if (bill) openModal(bill);
    return;
  }
  if (btn.dataset.action === 'delete') {
    const bill = state.bills.find((b) => b.id === id);
    if (!window.confirm(`确定删除这笔「${bill ? bill.category : ''}」账单吗？`)) return;
    try {
      await request(`${API.bills}/${id}`, { method: 'DELETE' });
      toast('账单已删除');
      await safeRefresh();
    } catch (err) {
      toast(err.message, true);
    }
  }
}

/* ---------- 提示 ---------- */

function toast(message, isError = false) {
  els.toast.textContent = message;
  els.toast.classList.toggle('error', isError);
  els.toast.classList.remove('hidden');
  clearTimeout(state.toastTimer);
  state.toastTimer = setTimeout(() => els.toast.classList.add('hidden'), 2200);
}

/* ---------- 初始化 ---------- */

function renderCategoryFilter() {
  const all = [...new Set([...state.categories.expense, ...state.categories.income])];
  els.filterCategory.innerHTML = ['<option value="">全部分类</option>']
    .concat(all.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`))
    .join('');
}

function bindEvents() {
  els.btnAdd.addEventListener('click', () => openModal());
  els.btnCancel.addEventListener('click', closeModal);
  els.modalMask.addEventListener('click', (e) => {
    if (e.target === els.modalMask) closeModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !els.modalMask.classList.contains('hidden')) closeModal();
  });
  els.formType.addEventListener('change', () => fillFormCategories(els.formType.value));
  els.form.addEventListener('submit', onFormSubmit);
  els.billBody.addEventListener('click', onTableAction);
  els.monthBody.addEventListener('click', (e) => {
    const tr = e.target.closest('tr[data-month]');
    if (!tr) return;
    els.filterMonth.value = tr.dataset.month;
    safeRefresh();
  });
  for (const el of [els.filterMonth, els.filterCategory, els.filterType]) {
    el.addEventListener('change', safeRefresh);
  }
  els.btnReset.addEventListener('click', () => {
    els.filterMonth.value = '';
    els.filterCategory.value = '';
    els.filterType.value = '';
    safeRefresh();
  });
}

async function init() {
  try {
    state.categories = await request(API.categories);
  } catch {
    state.categories = FALLBACK_CATEGORIES;
  }
  renderCategoryFilter();
  bindEvents();
  await safeRefresh();
}

init();
