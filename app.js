'use strict';

const $ = s => document.querySelector(s);

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
}[c]));

/* VERI ANAHTARI - DEGISTIRME */
const KEY = 'begencheke_pwa_data_v1';

let data;

try {
  data = JSON.parse(localStorage.getItem(KEY));
} catch (e) {}

if (!data || typeof data !== 'object') data = {};

for (const k of ['notes', 'money', 'debts', 'clients']) {
  if (!Array.isArray(data[k])) data[k] = [];
}

data.pin ??= '';
if (!Array.isArray(data.folders)) data.folders = [];

function persist() {
  localStorage.setItem(KEY, JSON.stringify(data));
}

const id = () =>
  Date.now().toString(36) +
  Math.random().toString(36).slice(2, 7);

const now = () => new Date().toLocaleString('ru-RU');

const symbols = {
  USD: '$',
  EUR: '€',
  TMT: 'TMT'
};

const fmt = (n, c) =>
  `${Number(n || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })} ${symbols[c] || c}`;

let section = 'notes';
let search = '';
let editing = null;
let saveTimer = null;

let selectionMode = false;
const selectedNotes = new Set();

const sections = [
  ['notes', 'Все заметки'],
  ['money', 'Доходы / расходы'],
  ['debts', 'Долги'],
  ['clients', 'Клиенты'],
  ['cash', 'Касса'],
  ['reports', 'Отчёты'],
  ['settings', 'Настройки']
];

/* SVG IKONLAR */

const icons = {
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  search: '<circle cx="10.8" cy="10.8" r="6.5"/><path d="m16 16 4.5 4.5"/>',
  notes: '<rect x="5" y="3" width="15" height="18" rx="2"/><path d="M9 3v18M12 8h5M12 12h5M12 16h4"/>',
  money: '<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18"/><circle cx="12" cy="14.5" r="2"/>',
  debts: '<path d="M5 3h14v18l-3-2-4 2-4-2-3 2zM9 8h6M9 12h6"/>',
  clients: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',
  cash: '<rect x="3" y="6" width="18" height="15" rx="2"/><path d="M3 10h18M7 3h12"/><circle cx="15" cy="15.5" r="1.5"/>',
  reports: '<path d="M4 20V11M10 20V5M16 20v-9M22 20V8"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M10 2h4l.6 2.3 2 .9 2.1-1.1 2.8 2.8-1.1 2.1.9 2L24 11v3l-2.7.6-.9-2 1.1-2.1-2.8-2.8-2.1 1.1-2 .9L14 24h-4l-.6-2.7-2-.9-2.1 1.1-2.8-2.8 1.1-2.1-.9-2 1.1-2.1L0 14v-3l2.7-.6.9-2-1.1-2.1 2.8-2.8 2.1 1.1 2-.9z" transform="translate(1 1) scale(.91)"/>',
  move: '<path d="M3 7V5a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM8 14h9m-3-3 3 3-3 3"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  share: '<path d="M12 16V3m-5 5 5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/>',
  delete: '<path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14M10 11v6M14 11v6"/>',
  more: '<circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/>',
  add: '<path d="m5 19 4-.8L20 7a2.1 2.1 0 0 0-3-3L6 15zM14 7l3 3-3 3"/>',
  plus: '<path d="M12 5v14M5 12h14"/>'
};

function svg(name) {
  return `<svg xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.8"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true">${icons[name] || ''}</svg>`;
}

$('#menu').innerHTML = svg('menu');
$('#search').innerHTML = svg('search');

for (const [selector, icon] of [
  ['#actionMove', 'move'],
  ['#actionLock', 'lock'],
  ['#actionShare', 'share'],
  ['#actionDelete', 'delete'],
  ['#actionMore', 'more']
]) {
  $(selector).querySelector('.actionIcon').innerHTML = svg(icon);
}

/* YAN MENU */

function drawer(open) {
  document.body.classList.toggle('drawerOpen', open);
}

$('#menu').onclick = () => drawer(true);
$('#shade').onclick = () => drawer(false);
$('#closeDrawer').onclick = () => drawer(false);

/* SAMSUNG NOTES BASLIK */

const largeHeader = $('#largeNotesHeader');
const smallTitle = $('#heading');
const largeCount = $('#largeNotesCount');

function noteCountText(count) {
  const lastTwo = count % 100;
  const last = count % 10;

  if (lastTwo >= 11 && lastTwo <= 14) {
    return `${count} заметок`;
  }

  if (last === 1) {
    return `${count} заметка`;
  }

  if (last >= 2 && last <= 4) {
    return `${count} заметки`;
  }

  return `${count} заметок`;
}

function updateNoteCount() {
  largeCount.textContent = noteCountText(data.notes.length);
}

function updateHeader() {
  const isNotes = section === 'notes';

  document.body.classList.toggle('notesPage', isNotes);

  if (!isNotes) {
    largeHeader.style.display = 'none';
    smallTitle.style.opacity = '1';
    return;
  }

  largeHeader.style.display = '';

  /*
   * Buyuk baslik normal sayfa akisi icinde kalir.
   * Kaydirildikca kendiliginden yukari gider.
   * Bosluk olusturan translateY kullanilmaz.
   */
  largeHeader.style.transform = '';
  largeHeader.style.opacity = '1';

  const progress = Math.min(
    Math.max(window.scrollY / 105, 0),
    1
  );

  smallTitle.style.opacity = String(progress);
}

let headerTicking = false;

window.addEventListener('scroll', () => {
  if (headerTicking) return;

  headerTicking = true;

  requestAnimationFrame(() => {
    headerTicking = false;
    updateHeader();
  });
}, { passive: true });

/* BOLUM DEGISTIRME */

function go(s) {
  exitSelection(false);

  section = s;
  search = '';

  drawer(false);

  smallTitle.textContent =
    sections.find(x => x[0] === s)?.[1] || s;

  const canAdd = ['notes', 'money', 'debts', 'clients'].includes(s);

  $('#fab').style.display = canAdd ? 'flex' : 'none';
  $('#fab').innerHTML = svg(s === 'notes' ? 'add' : 'plus');

  $('#nav').innerHTML = sections.map(([key, label]) => `
    <button
      type="button"
      class="${key === s ? 'active' : ''}"
      data-section="${key}"
    >
      ${svg(key)}
      <span>${esc(label)}</span>
    </button>
  `).join('');

  $('#nav').querySelectorAll('button').forEach(button => {
    button.onclick = () => go(button.dataset.section);
  });

  window.scrollTo(0, 0);

  render();
  updateHeader();
}

/* GENEL KART */

function card(title, detail, remove) {
  const el = document.createElement('div');
  el.className = 'card fade';

  el.innerHTML = `
    <strong>${esc(title)}</strong>
    <div class="small">${esc(detail)}</div>
    ${remove ? '<button class="delete">Удалить</button>' : ''}
  `;

  if (remove) {
    el.querySelector('.delete').onclick = () => {
      if (!confirm('Удалить запись?')) return;

      data[remove.table] =
        data[remove.table].filter(x => x.id !== remove.id);

      persist();
      render();
    };
  }

  return el;
}

/* COKLU SECIM */

function enterSelection(noteId) {
  if (section !== 'notes') return;

  selectionMode = true;
  selectedNotes.add(noteId);

  updateSelection();
  render();
}

function exitSelection(shouldRender = true) {
  selectionMode = false;
  selectedNotes.clear();

  document.body.classList.remove('selectionMode');

  if (shouldRender && section === 'notes') {
    render();
  }
}

function updateSelection() {
  const count = selectedNotes.size;

  document.body.classList.toggle(
    'selectionMode',
    selectionMode
  );

  $('#selectionCount').textContent = `${count} выбрано`;

  for (const selector of [
    '#actionMove',
    '#actionLock',
    '#actionShare',
    '#actionDelete',
    '#actionMore'
  ]) {
    $(selector).disabled = count === 0;
  }
}

function toggleSelection(noteId) {
  if (selectedNotes.has(noteId)) {
    selectedNotes.delete(noteId);
  } else {
    selectedNotes.add(noteId);
  }

  if (!selectedNotes.size) {
    exitSelection();
    return;
  }

  render();
}

function selectedRecords() {
  return data.notes.filter(n => selectedNotes.has(n.id));
}

$('#selectionCancel').onclick = () => exitSelection();

/* NOT KARTLARI */

function createNoteCard(n) {
  const el = document.createElement('div');

  el.className = 'noteCard fade';

  if (selectedNotes.has(n.id)) {
    el.classList.add('selected');
  }

  const preview = n.locked
    ? '🔒 Заблокированная заметка'
    : (n.body || n.title || '');

  const title = n.locked
    ? '🔒 ' + (n.title || 'Без названия')
    : (n.title || 'Без названия');

  el.innerHTML = `
    <span class="noteCheck">
      ${selectedNotes.has(n.id) ? '✓' : ''}
    </span>

    <div class="notePreview">${esc(preview)}</div>
    <div class="noteLabel">${esc(title)}</div>
    <div class="noteDate">${esc(n.created)}</div>
  `;

  let pressTimer = null;
  let longPressed = false;
  let startX = 0;
  let startY = 0;

  function cancelPress() {
    clearTimeout(pressTimer);
    pressTimer = null;
  }

  el.addEventListener('pointerdown', e => {
    if (selectionMode) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;

    startX = e.clientX;
    startY = e.clientY;
    longPressed = false;

    cancelPress();

    pressTimer = setTimeout(() => {
      longPressed = true;

      if (navigator.vibrate) {
        navigator.vibrate(35);
      }

      enterSelection(n.id);
    }, 600);
  });

  el.addEventListener('pointermove', e => {
    if (
      Math.abs(e.clientX - startX) > 12 ||
      Math.abs(e.clientY - startY) > 12
    ) {
      cancelPress();
    }
  });

  el.addEventListener('pointerup', cancelPress);
  el.addEventListener('pointercancel', cancelPress);
  el.addEventListener('pointerleave', cancelPress);

  el.addEventListener('contextmenu', e => {
    e.preventDefault();
    cancelPress();

    if (!selectionMode) {
      longPressed = true;
      enterSelection(n.id);
    }
  });

  el.onclick = () => {
    if (longPressed) {
      longPressed = false;
      return;
    }

    if (selectionMode) {
      toggleSelection(n.id);
    } else {
      openNote(n.id);
    }
  };

  return el;
}

/* ANA EKRAN */

function render() {
  const c = $('#content');
  c.replaceChildren();

  if (section === 'notes') {
    updateNoteCount();

    const notes = data.notes.filter(n => {
      return (
        (n.title || '') + ' ' +
        (n.locked ? '' : (n.body || ''))
      ).toLowerCase().includes(search.toLowerCase());
    }).slice().reverse();

    if (!notes.length) {
      const empty = document.createElement('p');
      empty.className = 'empty';
      empty.textContent = search
        ? 'Ничего не найдено.'
        : 'Заметок пока нет.';
      c.append(empty);
    } else {
      const grid = document.createElement('div');
      grid.className = 'grid';
      grid.id = 'noteGrid';

      notes.forEach(n => {
        grid.append(createNoteCard(n));
      });

      c.append(grid);
    }

    updateSelection();
    return;
  }

  if (section === 'money') {
    c.innerHTML = '<div class="sub">Операции</div>';

    data.money.slice().reverse().forEach(n => {
      c.append(card(
        n.kind + ' ' + fmt(n.amount, n.currency),
        (n.description || '') + '\n' + n.created,
        { table: 'money', id: n.id }
      ));
    });

    return;
  }

  if (section === 'debts') {
    c.innerHTML = '<div class="sub">Долги</div>';

    data.debts.slice().reverse().forEach(n => {
      c.append(card(
        n.person + ' — ' + n.kind,
        fmt(n.amount, n.currency) +
          '\n' + (n.description || '') +
          '\n' + n.created,
        { table: 'debts', id: n.id }
      ));
    });

    return;
  }

  if (section === 'clients') {
    c.innerHTML = '<div class="sub">Клиенты</div>';

    data.clients.slice().reverse().forEach(n => {
      c.append(card(
        n.name,
        (n.phone || '') + '\n' + (n.details || ''),
        { table: 'clients', id: n.id }
      ));
    });

    return;
  }

  if (section === 'cash' || section === 'reports') {
    c.innerHTML = '<div class="sub">' +
      (section === 'cash' ? 'Касса' : 'Отчёты') +
      '</div>';

    for (const currency of ['USD', 'EUR', 'TMT']) {
      const inc = data.money
        .filter(x =>
          x.currency === currency &&
          x.kind === 'Доход'
        )
        .reduce((a, x) => a + Number(x.amount), 0);

      const exp = data.money
        .filter(x =>
          x.currency === currency &&
          x.kind === 'Расход'
        )
        .reduce((a, x) => a + Number(x.amount), 0);

      c.append(card(
        symbols[currency],
        `Доходы: ${fmt(inc, currency)}
Расходы: ${fmt(exp, currency)}
Баланс: ${fmt(inc - exp, currency)}`
      ));
    }

    if (section === 'reports') {
      c.append(card(
        'Сводка',
        `Заметок: ${data.notes.length}
Клиентов: ${data.clients.length}
Долгов: ${data.debts.length}
Валюты не суммируются.`
      ));
    }

    return;
  }

  if (section === 'settings') {
    c.innerHTML = `
      <div class="sub">Настройки</div>

      <button class="pill" id="pinBtn">
        🔐 Установить / изменить PIN
      </button>

      <button class="pill" id="exportBtn">
        📤 Экспорт резервной копии
      </button>

      <button class="pill" id="importBtn">
        📥 Импорт резервной копии
      </button>

      <input
        type="file"
        id="fileImport"
        accept="application/json"
        hidden
      >

      <p class="small">
        Резервная копия содержит личные данные
        в незашифрованном виде.
        Храните её в безопасном месте.
      </p>
    `;

    $('#pinBtn').onclick = pinForm;
    $('#exportBtn').onclick = backup;
    $('#importBtn').onclick = () => $('#fileImport').click();
    $('#fileImport').onchange = importBackup;
  }
}

/* SECILEN NOTLARI TASI */

$('#actionMove').onclick = () => {
  if (!selectedNotes.size) return;

  const folder = prompt(
    'Введите название папки:',
    selectedRecords()[0]?.folder || ''
  );

  if (folder === null) return;

  const name = folder.trim();

  if (name && !data.folders.includes(name)) {
    data.folders.push(name);
  }

  selectedRecords().forEach(n => {
    n.folder = name;
  });

  persist();
  exitSelection();

  alert('Заметки перемещены');
};

/* NOTLARI KILITLE */

$('#actionLock').onclick = () => {
  if (!selectedNotes.size) return;

  if (!data.pin) {
    alert('Сначала установите PIN в настройках.');
    return;
  }

  if (prompt('Введите PIN') !== data.pin) {
    alert('Неверный PIN');
    return;
  }

  const records = selectedRecords();
  const allLocked = records.every(n => n.locked);

  records.forEach(n => {
    n.locked = !allLocked;
  });

  persist();
  exitSelection();

  alert(allLocked
    ? 'Заметки разблокированы'
    : 'Заметки заблокированы'
  );
};

/* PAYLAS */

$('#actionShare').onclick = async () => {
  if (!selectedNotes.size) return;

  const records = selectedRecords();

  if (records.some(n => n.locked)) {
    if (!data.pin || prompt('Введите PIN') !== data.pin) {
      alert('Неверный PIN');
      return;
    }
  }

  const text = records.map(n =>
    `${n.title || 'Без названия'}\n\n${n.body || ''}`
  ).join('\n\n----------------\n\n');

  try {
    if (navigator.share) {
      await navigator.share({
        title: 'BEGENCHEKE',
        text
      });
    } else if (navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      alert('Текст скопирован');
    } else {
      prompt('Скопируйте текст:', text);
    }
  } catch (e) {
    if (e.name !== 'AbortError') {
      alert('Не удалось поделиться');
    }
  }
};

/* NOT SIL */

$('#actionDelete').onclick = () => {
  if (!selectedNotes.size) return;

  const records = selectedRecords();

  if (records.some(n => n.locked)) {
    if (!data.pin || prompt('Введите PIN') !== data.pin) {
      alert('Неверный PIN');
      return;
    }
  }

  const count = selectedNotes.size;

  if (!confirm(`Удалить заметки (${count})?`)) return;

  data.notes = data.notes.filter(
    n => !selectedNotes.has(n.id)
  );

  persist();
  exitSelection();
};

/* DIGER ISLEMLER */

$('#actionMore').onclick = () => {
  if (!selectionMode) return;

  const choice = prompt(
    'Дополнительные действия:\n' +
    '1 — Выбрать все\n' +
    '2 — Дублировать\n' +
    '3 — Отмена'
  );

  if (choice === '1') {
    data.notes.filter(n => (
      (n.title || '') + ' ' +
      (n.locked ? '' : (n.body || ''))
    ).toLowerCase().includes(search.toLowerCase()))
      .forEach(n => selectedNotes.add(n.id));

    render();
  }

  if (choice === '2') {
    const records = selectedRecords();

    if (records.some(n => n.locked)) {
      if (!data.pin || prompt('Введите PIN') !== data.pin) {
        alert('Неверный PIN');
        return;
      }
    }

    records.forEach(n => {
      data.notes.push({
        ...n,
        id: id(),
        title: (n.title || 'Без названия') + ' (копия)',
        created: now()
      });
    });

    persist();
    exitSelection();
  }
};

/* ARAMA */

$('#search').onclick = () => {
  if (section !== 'notes') go('notes');

  const value = prompt('Поиск заметок', search);

  if (value !== null) {
    search = value;
    exitSelection(false);
    render();
  }
};

/* EKLEME DUGMESI */

$('#fab').onclick = () => {
  if (section === 'notes') openNote();
  else if (section === 'money') form('money');
  else if (section === 'debts') form('debts');
  else if (section === 'clients') form('clients');
};

/* NOT DUZENLEME */

function openNote(noteId) {
  let n = noteId
    ? data.notes.find(x => x.id === noteId)
    : null;

  if (n?.locked) {
    if (!data.pin || prompt('Введите PIN') !== data.pin) {
      alert('Неверный PIN');
      return;
    }
  }

  if (!n) {
    n = {
      id: id(),
      title: '',
      body: '',
      created: now(),
      folder: ''
    };

    data.notes.push(n);
    persist();
  }

  editing = n.id;

  $('#noteTitle').value = n.title || '';
  $('#noteBody').value = n.body || '';

  $('#editor').classList.add('open');

  setTimeout(() => {
    if ($('#editor').classList.contains('open')) {
      $('#noteTitle').focus({ preventScroll: true });
    }
  }, 380);
}

function saveNote() {
  if (!editing) return;

  const n = data.notes.find(x => x.id === editing);

  if (n) {
    n.title = $('#noteTitle').value;
    n.body = $('#noteBody').value;
    n.updated = now();
    persist();
  }
}

$('#noteTitle').oninput =
$('#noteBody').oninput = () => {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveNote, 250);
};

function closeNote() {
  clearTimeout(saveTimer);
  saveNote();

  editing = null;

  $('#editor').classList.remove('open');

  render();
}

$('#back').onclick = closeNote;
$('#save').onclick = closeNote;

/* MODAL */

function modal(html, onSubmit) {
  $('#modal').innerHTML = html;
  $('#modalWrap').classList.add('open');

  $('#modal').querySelector('.cancel').onclick = () => {
    $('#modalWrap').classList.remove('open');
  };

  $('#modal').querySelector('form').onsubmit = e => {
    e.preventDefault();
    onSubmit(new FormData(e.target));
  };
}

/* GELIR / GIDER / BORC / MUSTERI */

function form(kind) {
  let fields = '';
  let title = '';

  const currency = `
    <select name="currency">
      <option value="USD">Доллар ($)</option>
      <option value="EUR">Евро (€)</option>
      <option value="TMT">Манат (TMT)</option>
    </select>
  `;

  if (kind === 'money') {
    title = 'Новая операция';

    fields = `
      <select name="kind">
        <option>Доход</option>
        <option>Расход</option>
      </select>

      <input name="amount"
        type="number"
        min="0.01"
        step="0.01"
        placeholder="Сумма"
        required>

      ${currency}

      <textarea name="description"
        placeholder="Описание"></textarea>
    `;
  } else if (kind === 'debts') {
    title = 'Новый долг';

    fields = `
      <input name="person"
        placeholder="Имя человека"
        required>

      <select name="kind">
        <option>Мне должны</option>
        <option>Я должен</option>
      </select>

      <input name="amount"
        type="number"
        min="0.01"
        step="0.01"
        placeholder="Сумма"
        required>

      ${currency}

      <textarea name="description"
        placeholder="Комментарий"></textarea>
    `;
  } else {
    title = 'Новый клиент';

    fields = `
      <input name="name"
        placeholder="Имя клиента"
        required>

      <input name="phone"
        placeholder="Телефон">

      <textarea name="details"
        placeholder="Заметка / счёт"></textarea>
    `;
  }

  modal(`
    <h2>${title}</h2>

    <form>
      ${fields}

      <div class="actions">
        <button type="button" class="cancel">
          Отмена
        </button>

        <button type="submit">
          Сохранить
        </button>
      </div>
    </form>
  `, f => {
    const obj = Object.fromEntries(f.entries());

    if ('amount' in obj) {
      obj.amount = Number(obj.amount);
    }

    obj.id = id();
    obj.created = now();

    data[kind].push(obj);

    persist();

    $('#modalWrap').classList.remove('open');
    render();
  });
}

/* PIN AYARLARI */

function pinForm() {
  modal(`
    <h2>Защита PIN</h2>

    <form>
      <input
        type="password"
        name="pin"
        inputmode="numeric"
        pattern="[0-9]{4,8}"
        placeholder="Новый PIN (4–8 цифр)"
        required>

      <div class="actions">
        <button type="button" class="cancel">
          Отмена
        </button>

        <button type="submit">
          Сохранить
        </button>
      </div>
    </form>
  `, f => {
    data.pin = f.get('pin');

    persist();

    $('#modalWrap').classList.remove('open');
    alert('PIN сохранён');
  });
}

/* YEDEKLEME */

function backup() {
  const blob = new Blob(
    [JSON.stringify(data, null, 2)],
    { type: 'application/json' }
  );

  const a = document.createElement('a');

  a.href = URL.createObjectURL(blob);
  a.download = 'BEGENCHEKE-backup.json';
  a.click();

  setTimeout(() => {
    URL.revokeObjectURL(a.href);
  }, 2000);
}

async function importBackup(e) {
  const file = e.target.files?.[0];

  if (!file) return;

  try {
    const d = JSON.parse(await file.text());

    if (!['notes', 'money', 'debts', 'clients']
      .every(k => Array.isArray(d[k]))) {
      throw Error('Invalid backup');
    }

    if (!confirm(
      'Mevcut kayıtlar değiştirilecek. Devam edilsin mi?'
    )) {
      return;
    }

    data = d;

    if (!Array.isArray(data.folders)) {
      data.folders = [];
    }

    data.pin ??= '';

    persist();
    exitSelection(false);
    render();
    updateNoteCount();

    alert('Yedek yüklendi');
  } catch (e) {
    alert('Geçersiz yedek dosyası');
  }
}

/* UYGULAMA PIN KONTROLU */

function lock() {
  if (!data.pin) return;

  const pin = prompt('BEGENCHEKE PIN');

  if (pin !== data.pin) {
    $('#content').innerHTML =
      '<p class="empty">PIN yanlış. Yeniden deneyin.</p>';

    $('#fab').style.display = 'none';
    $('#menu').disabled = true;
    $('#search').disabled = true;
  }
}

/* GERI TUSU */

window.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;

  if ($('#editor').classList.contains('open')) {
    closeNote();
  } else if (selectionMode) {
    exitSelection();
  } else if (
    document.body.classList.contains('drawerOpen')
  ) {
    drawer(false);
  } else {
    $('#modalWrap').classList.remove('open');
  }
});

/* BASLAT */

go('notes');
lock();

/* OFFLINE */

if (
  'serviceWorker' in navigator &&
  location.protocol.startsWith('http')
) {
  navigator.serviceWorker
    .register('./sw.js')
    .catch(() => {});
}
