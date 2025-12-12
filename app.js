
// Sham Expenses (PWA) - main JS
const STORAGE_KEY = "sham_expenses_v1";
let store = loadStore();
let currentMonth = getMonthKey(new Date());

function getMonthKey(date){
  const y=date.getFullYear(), m=(date.getMonth()+1).toString().padStart(2,'0');
  return `${y}-${m}`;
}

function loadStore(){
  const raw = localStorage.getItem(STORAGE_KEY);
  if(!raw){
    const s = {version:1, months:{}, settings:{theme:'purple', currency:'IQD', warningThreshold:20000}};
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    return s;
  }
  try{ return JSON.parse(raw); } catch(e){
    localStorage.setItem(STORAGE_KEY+"_bak", raw);
    const s = {version:1, months:{}, settings:{theme:'purple', currency:'IQD', warningThreshold:20000}};
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    return s;
  }
}
function saveStore(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(store)); }

// ensure month structure
function ensureMonth(key){
  if(!store.months[key]){
    store.months[key] = {
      totalMoney:0, extraIncome:0,
      budgets:{
        shopping:{name:"التسوق المنزلي", allocated:0, spent:0},
        savings:{name:"الادخار", allocated:0, spent:0},
        emergency:{name:"الطوارئ", allocated:0, spent:0},
        personal:{name:"المصروف الشخصي", allocated:0, spent:0},
        others:{name:"احتياجات أخرى", allocated:0, spent:0}
      },
      categoriesOrder:["shopping","savings","emergency","personal","others"],
      expenses:[]
    };
    saveStore();
  }
}

// format IQD
function formatIQD(n){ return Number(n||0).toLocaleString('en-US') + " د.ع"; }

// render month selector
function renderMonthSelector(){
  const sel = document.getElementById('monthSelect');
  sel.innerHTML='';
  const today = new Date();
  for(let i=0;i<24;i++){
    const d = new Date(today.getFullYear(), today.getMonth()-i,1);
    const key = getMonthKey(d);
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = d.toLocaleString(document.documentElement.lang || 'ar', {month:'long', year:'numeric'});
    sel.appendChild(opt);
  }
  sel.value = currentMonth;
  sel.onchange = ()=>{
    currentMonth = sel.value;
    renderAll();
  };
}

// add new category
function addNewCategoryUI(){
  const name = document.getElementById('newCategoryInput').value.trim();
  if(!name) return alert('ادخل اسم الفئة');
  const key = 'cat_'+Date.now();
  ensureMonth(currentMonth);
  const m = store.months[currentMonth];
  m.budgets[key] = {name, allocated:0, spent:0};
  m.categoriesOrder.push(key);
  saveStore();
  document.getElementById('newCategoryInput').value='';
  renderAll();
}

// render dashboard
function renderDashboard(){
  ensureMonth(currentMonth);
  const m = store.months[currentMonth];
  const totals = getMonthTotals(currentMonth);
  document.getElementById('totalMoneyDisplay').textContent = formatIQD(totals.totalMoney);
  document.getElementById('extraIncomeDisplay').textContent = formatIQD(m.extraIncome || 0);
  const container = document.getElementById('budgetsContainer');
  container.innerHTML='';
  m.categoriesOrder.forEach(key=>{
    const b = m.budgets[key];
    const alloc = Number(b.allocated||0);
    const spent = Number(b.spent||0);
    const remaining = alloc - spent;
    const percent = totals.totalMoney>0 ? ((alloc / totals.totalMoney)*100).toFixed(1) : '0.0';
    const div = document.createElement('div');
    div.className='budget-card card';
    div.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div>
          <strong>${escapeHtml(b.name)}</strong>
          <div class="small">${percent}% من المجموع</div>
        </div>
        <div class="right">
          <div class="kpi">${formatIQD(spent)} / ${formatIQD(alloc)}</div>
          <div class="small">متبقي: ${formatIQD(remaining)}</div>
        </div>
      </div>
      <div style="margin-top:8px;display:flex;gap:8px">
        <input class="input" type="number" id="alloc_${key}" placeholder="تعيين ميزانية" value="${alloc}">
        <button class="btn" onclick="setAllocation('${key}')">حفظ</button>
      </div>
    `;
    container.appendChild(div);
  });
}

// set allocation
function setAllocation(key){
  const el = document.getElementById('alloc_'+key);
  const val = Number(el.value) || 0;
  ensureMonth(currentMonth);
  const m = store.months[currentMonth];
  m.budgets[key].allocated = val;
  saveStore();
  renderAll();
}

// get month totals
function getMonthTotals(key){
  ensureMonth(key);
  const m = store.months[key];
  const allocatedSum = Object.values(m.budgets).reduce((s,b)=>s + Number(b.allocated||0), 0);
  const spentSum = Object.values(m.budgets).reduce((s,b)=>s + Number(b.spent||0), 0);
  const totalMoney = Number(m.totalMoney||0) + Number(m.extraIncome||0);
  const percentages = {};
  Object.keys(m.budgets).forEach(k=>{
    const alloc = Number(m.budgets[k].allocated||0);
    percentages[k] = totalMoney>0 ? (alloc/totalMoney*100) : 0;
  });
  return {allocatedSum, spentSum, totalMoney, percentages};
}

// add extra income
function handleAddExtra(){
  const v = Number(document.getElementById('extraAmount').value) || 0;
  if(v<=0) return alert('ادخل مبلغ صالح');
  ensureMonth(currentMonth);
  store.months[currentMonth].extraIncome = (store.months[currentMonth].extraIncome || 0) + v;
  saveStore();
  document.getElementById('extraAmount').value='';
  renderAll();
}

// add expense
function handleAddExpense(){
  const date = document.getElementById('expDate').value;
  const amount = Number(document.getElementById('expAmount').value) || 0;
  const category = document.getElementById('expCategory').value;
  const note = document.getElementById('expNote').value || '';
  if(!date || amount<=0 || !category) return alert('تأكد من تعبئة الحقول');
  ensureMonth(currentMonth);
  const m = store.months[currentMonth];
  const day = new Date(date).getDate();
  const spentSoFar = m.expenses.reduce((s,e)=>s + Number(e.amount), 0);
  const avgDaily = (day>0) ? (spentSoFar / day) : 0;
  const threshold = store.settings.warningThreshold || 20000;
  if(amount > avgDaily + threshold){
    if(!confirm(`تنبيه: المبلغ ${formatIQD(amount)} يتجاوز المعدل اليومي بفرق أكبر من ${formatIQD(threshold)}. المتابعة؟`)) return;
  }
  const id = 'e-'+Date.now();
  m.expenses.push({id, date, amount, category, note});
  if(!m.budgets[category]) {
    m.budgets[category] = {name:category, allocated:0, spent:0};
    m.categoriesOrder.push(category);
  }
  m.budgets[category].spent = (m.budgets[category].spent||0) + amount;
  saveStore();
  document.getElementById('expAmount').value='';
  document.getElementById('expNote').value='';
  renderAll();
}

// render categories in add form
function renderCategoryOptions(){
  ensureMonth(currentMonth);
  const sel = document.getElementById('expCategory');
  sel.innerHTML='';
  const m = store.months[currentMonth];
  m.categoriesOrder.forEach(k=>{
    const opt = document.createElement('option');
    opt.value = k;
    opt.textContent = m.budgets[k].name;
    sel.appendChild(opt);
  });
}

// render history
function renderHistory(){
  ensureMonth(currentMonth);
  const list = document.getElementById('historyList');
  list.innerHTML='';
  const m = store.months[currentMonth];
  const arr = m.expenses.slice().sort((a,b)=> new Date(b.date) - new Date(a.date));
  arr.forEach(e=>{
    const li = document.createElement('div');
    li.className='exp-item card';
    li.innerHTML = `
      <div>
        <div><strong>${m.budgets[e.category]?.name || e.category}</strong> <span class="small"> - ${new Date(e.date).toLocaleString()}</span></div>
        <div class="small">${escapeHtml(e.note||'')}</div>
      </div>
      <div class="right">
        <div>${formatIQD(e.amount)}</div>
        <div style="margin-top:6px">
          <button class="icon-btn" onclick="openEdit('${e.id}')">✏️</button>
          <button class="icon-btn" onclick="deleteExpense('${e.id}')">🗑️</button>
        </div>
      </div>
    `;
    list.appendChild(li);
  });
}

// open edit modal (prompt)
function openEdit(id){
  ensureMonth(currentMonth);
  const m = store.months[currentMonth];
  const e = m.expenses.find(x=>x.id===id);
  if(!e) return;
  const newAmount = prompt('المبلغ', e.amount);
  if(newAmount===null) return;
  const parsed = Number(newAmount);
  if(isNaN(parsed) || parsed<=0) return alert('قيمة غير صالحة');
  const newNote = prompt('الملاحظة', e.note) || '';
  const newCat = prompt('الفئة (اكتب اسم الفئة بالضبط أو اتركها كما هي)', m.budgets[e.category]?.name || e.category) || m.budgets[e.category]?.name || e.category;
  let newCatKey = e.category;
  const foundKey = Object.keys(m.budgets).find(k=>m.budgets[k].name === newCat);
  if(foundKey) newCatKey = foundKey;
  else {
    newCatKey = 'cat_'+Date.now();
    m.budgets[newCatKey] = {name:newCat, allocated:0, spent:0};
    m.categoriesOrder.push(newCatKey);
  }
  if(m.budgets[e.category]) m.budgets[e.category].spent = Math.max(0, (m.budgets[e.category].spent||0) - Number(e.amount));
  e.amount = parsed;
  e.note = newNote;
  e.category = newCatKey;
  m.budgets[newCatKey].spent = (m.budgets[newCatKey].spent||0) + parsed;
  saveStore();
  renderAll();
}

// delete expense
function deleteExpense(id){
  if(!confirm('هل تود حذف هذا المصروف؟')) return;
  ensureMonth(currentMonth);
  const m = store.months[currentMonth];
  const idx = m.expenses.findIndex(x=>x.id===id);
  if(idx===-1) return;
  const e = m.expenses[idx];
  if(m.budgets[e.category]) m.budgets[e.category].spent = Math.max(0, (m.budgets[e.category].spent||0) - Number(e.amount));
  m.expenses.splice(idx,1);
  saveStore();
  renderAll();
}

// render charts using Chart.js
let monthlyChartInstance=null;
function renderCharts(){
  ensureMonth(currentMonth);
  const m = store.months[currentMonth];
  const daily = {};
  m.expenses.forEach(e=>{
    const d = new Date(e.date);
    const day = d.getDate();
    daily[day] = (daily[day]||0) + Number(e.amount);
  });
  const parts = currentMonth.split('-');
  const daysInMonth = new Date(Number(parts[0]), Number(parts[1]), 0).getDate();
  const labels = [], data=[];
  for(let d=1; d<=daysInMonth; d++){
    labels.push(String(d));
    data.push(daily[d]||0);
  }
  const ctx = document.getElementById('monthlyChart').getContext('2d');
  if(monthlyChartInstance) {
    monthlyChartInstance.data.labels = labels;
    monthlyChartInstance.data.datasets[0].data = data;
    monthlyChartInstance.update();
  } else {
    monthlyChartInstance = new Chart(ctx, {
      type:'bar',
      data:{labels, datasets:[{label:'مصروف يومي (د.ع)', data, backgroundColor:getComputedStyle(document.documentElement).getPropertyValue('--accent1') || '#7c4dff'}]},
      options:{responsive:true, scales:{y:{beginAtZero:true}}}
    });
  }
  const catCtx = document.getElementById('catChart').getContext('2d');
  const catLabels = [], catData=[];
  m.categoriesOrder.forEach(k=>{
    catLabels.push(m.budgets[k].name);
    catData.push(Number(m.budgets[k].spent||0));
  });
  if(window.catChartInstance){
    window.catChartInstance.data.labels = catLabels;
    window.catChartInstance.data.datasets[0].data = catData;
    window.catChartInstance.update();
  } else {
    window.catChartInstance = new Chart(catCtx, {
      type:'pie',
      data:{labels:catLabels, datasets:[{data:catData, backgroundColor:catLabels.map((_,i)=>i%2? 'rgba(160,123,255,0.8)':'rgba(124,77,255,0.8)')} ]},
      options:{responsive:true}
    });
  }
}

// render all
function renderAll(){
  renderMonthSelector();
  renderDashboard();
  renderCategoryOptions();
  renderHistory();
  renderCharts();
}

// escape html
function escapeHtml(s){ return String(s).replace(/[&<>"']/g, function(m){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]; }); }

// print
function printReport(){ window.print(); }

// theme set
function setTheme(name){
  store.settings.theme = (name==='blackgold' ? 'blackgold' : 'purple');
  saveStore();
  if(store.settings.theme==='blackgold') document.documentElement.setAttribute('data-theme','blackgold'); else document.documentElement.removeAttribute('data-theme');
  // swap logo
  const logo = document.getElementById('logoImg');
  if(store.settings.theme==='blackgold') logo.src='icons/icon-blackgold-192.png'; else logo.src='icons/icon-purple-192.png';
  renderAll();
}

// init
document.addEventListener('DOMContentLoaded', ()=>{
  if(store.settings.theme==='blackgold') document.documentElement.setAttribute('data-theme','blackgold');
  ensureMonth(currentMonth);
  if('serviceWorker' in navigator){ navigator.serviceWorker.register('/service-worker.js').catch(()=>{}); }
  // set default date input to now
  const dt = new Date();
  const iso = dt.toISOString().slice(0,16);
  document.getElementById('expDate').value = iso;
  renderAll();
});
