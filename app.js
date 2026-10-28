'use strict';

const $ = s => document.querySelector(s);

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
}[c]));

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
data.folders ??= [];

const persist = () => {
  localStorage.setItem(KEY, JSON.stringify(data));
};

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
let selectedNotes = new Set();
let currentFolder = 'all';

const sections = [
  ['notes', '▣', 'Все заметки'],
  ['money', '$', 'Доходы / расходы'],
  ['debts', '▤', 'Долги'],
  ['clients', '♙', 'Клиенты'],
  ['cash', '▣', 'Касса'],
  ['reports', '▥', 'Отчёты'],
  ['settings', '⚙', 'Настройки']
];

function drawer(open) {
  document.body.classList.toggle('drawerOpen', open);
}

$('#menu').onclick = () => drawer(true);
$('#shade').onclick = () => drawer(false);
$('#closeDrawer').onclick = () => drawer(false);

function go(s) {
  exitSelection(false);

  section = s;
  drawer(false);
  search = '';

  $('#heading').textContent =
    sections.find(x => x[0] === s)?.[2] || s;

  $('#fab').style.display =
    ['notes', 'money', 'debts', 'clients'].includes(s)
      ? 'block'
      : 'none';

  $('#fab').textContent = s === 'notes' ? '✎' : '+';

  $('#nav').innerHTML = sections.map(([k, i, t]) =>
    `<button class="${k === s ? 'active' : ''}" data-section="${k}">
      ${i} &nbsp;${t}
    </button>`
  ).join('');

  $('#nav').querySelectorAll('button').forEach(b => {
    b.onclick = () => go(b.dataset.section);
  });

  render();
}

function card(title, detail, remove) {
  let el = document.createElement('div');
  el.className = 'card fade';

  el.innerHTML = `
    <strong>${esc(title)}</strong>
    <div class="small">${esc(detail)}</div>
    ${remove ? '<button class="delete">Удалить</button>' : ''}
  `;

  if (remove) {
    el.querySelector('button').onclick = () => {
      if (confirm('Удалить запись?')) {
        data[remove.table] =
          data[remove.table].filter(x => x.id !== remove.id);

        persist();
        render();
      }
    };
  }

  return el;
}

// ======================================
// SAMSUNG NOTES TARZI SECIM SISTEMI
// ======================================

function enterSelection(noteId) {
  if (section !== 'notes') return;

  selectionMode = true;
  selectedNotes.add(noteId);

  document.body.classList.add('selectionMode');

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

  $('#selectionCount').textContent =
    `${count} выбрано`;

  document.body.classList.toggle(
    'selectionMode',
    selectionMode
  );

  $('#actionMove').disabled = count === 0;
  $('#actionLock').disabled = count === 0;
  $('#actionShare').disabled = count === 0;
  $('#actionDelete').disabled = count === 0;
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

  updateSelection();
  render();
}

$('#selectionCancel').onclick = () => exitSelection();

function selectedRecords() {
  return data.notes.filter(n => selectedNotes.has(n.id));
}

// ======================================
// KLASOR SISTEMI
// ======================================

function folderName(n) {
  return n.folder || 'Без папки';
}

function renderFolderBar(container) {
  const wrap = document.createElement('div');

  wrap.style.cssText = `
    display:flex;
    gap:8px;
    overflow-x:auto;
    padding:4px 0 16px;
    scrollbar-width:none;
  `;

  const names = [
    ['all', 'Все'],
    ['none', 'Без папки'],
    ...data.folders.map(f => [f, f])
  ];

  names.forEach(([value, label]) => {
    const b = document.createElement('button');

    b.textContent = label;

    b.style.cssText = `
      flex-shrink:0;
      padding:9px 14px;
      border-radius:20px;
      background:${currentFolder === value ? '#238bdf' : '#242b3c'};
      color:white;
      font-size:13px;
    `;

    b.onclick = () => {
      currentFolder = value;
      exitSelection(false);
      render();
    };

    wrap.append(b);
  });

  container.append(wrap);
}

// ======================================
// NOT KARTLARI
// ======================================

function createNoteCard(n) {
  const el = document.createElement('div');

  el.className = 'noteCard fade';

  if (selectedNotes.has(n.id)) {
    el.classList.add('selected');
  }

  const preview = n.locked
    ? '🔒 Заблокированная заметка'
    : (n.body || n.title);

  const title = n.locked
    ? '🔒 ' + (n.title || 'Без названия')
    : (n.title || 'Без названия');

  el.innerHTML = `
    <span class="noteCheck">
      ${selectedNotes.has(n.id) ? '✓' : ''}
    </span>

    <div class="notePreview">
      ${esc(preview)}
    </div>

    <div class="noteLabel">
      ${esc(title)}
    </div>

    <div class="noteDate">
      ${esc(n.created)}
    </div>
  `;

  let pressTimer = null;
  let longPressed = false;
  let startX = 0;
  let startY = 0;

  const cancelPress = () => {
    clearTimeout(pressTimer);
    pressTimer = null;
  };

  el.addEventListener('pointerdown', e => {
    if (selectionMode) return;

    if (e.pointerType === 'mouse' && e.button !== 0) {
      return;
    }

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

  el.onclick = e => {
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

// ======================================
// ANA EKRAN
// ======================================

function render() {
  const c = $('#content');
  c.replaceChildren();

  if (section === 'notes') {
    const sub = document.createElement('div');
    sub.className = 'sub';
    sub.textContent = 'Мои заметки';
    c.append(sub);

    renderFolderBar(c);

    const grid = document.createElement('div');
    grid.className = 'grid';
    grid.id = 'noteGrid';
    c.append(grid);

    let notes = data.notes.filter(n => {
      const matchesSearch =
        ((n.title || '') + ' ' + (n.locked ? '' : (n.body || '')))
          .toLowerCase()
          .includes(search.toLowerCase());

      const matchesFolder =
        currentFolder === 'all' ||
        (currentFolder === 'none' && !n.folder) ||
        n.folder === currentFolder;

      return matchesSearch && matchesFolder;
    }).slice().reverse();

    if (!notes.length) {
      const empty = document.createElement('p');
      empty.className = 'empty';
      empty.textContent = 'Заметок пока нет.';
      c.append(empty);
    }

    notes.forEach(n => {
      grid.append(createNoteCard(n));
    });

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
    c.innerHTML =
      '<div class="sub">' +
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

// ======================================
// ALT MENU - MOVE
// ======================================

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

// ======================================
// ALT MENU - LOCK
// ======================================

$('#actionLock').onclick = () => {
  if (!selectedNotes.size) return;

  if (!data.pin) {
    alert(
      'Сначала установите PIN в настройках.'
    );
    return;
  }

  const pin = prompt('Введите PIN');

  if (pin !== data.pin) {
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

// ======================================
// ALT MENU - SHARE
// ======================================

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

// ======================================
// ALT MENU - DELETE
// ======================================

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

  if (!confirm(`Удалить заметки (${count})?`)) {
    return;
  }

  data.notes = data.notes.filter(
    n => !selectedNotes.has(n.id)
  );

  persist();
  exitSelection();
};

// ======================================
// ALT MENU - MORE
// ======================================

$('#actionMore').onclick = () => {
  if (!selectionMode) return;

  const choice = prompt(
    'Дополнительные действия:\n' +
    '1 — Выбрать все\n' +
    '2 — Дублировать\n' +
    '3 — Отмена'
  );

  if (choice === '1') {
    const visible = data.notes.filter(n =>
      (currentFolder === 'all' ||
       (currentFolder === 'none' && !n.folder) ||
       n.folder === currentFolder) &&
      ((n.title || '') + ' ' +
       (n.locked ? '' : (n.body || '')))
        .toLowerCase()
        .includes(search.toLowerCase())
    );

    visible.forEach(n => selectedNotes.add(n.id));

    updateSelection();
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

// ======================================
// ARAMA
// ======================================

$('#search').onclick = () => {
  if (section !== 'notes') {
    go('notes');
  }

  const s = prompt('Поиск заметок', search);

  if (s !== null) {
    search = s;
    exitSelection(false);
    render();
  }
};

// ======================================
// YENI KAYIT
// ======================================

$('#fab').onclick = () => {
  if (section === 'notes') openNote();
  else if (section === 'money') form('money');
  else if (section === 'debts') form('debts');
  else if (section === 'clients') form('clients');
};

// ======================================
// NOT DUZENLEME
// ======================================

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
      folder: currentFolder !== 'all' &&
              currentFolder !== 'none'
        ? currentFolder
        : ''
    };

    data.notes.push(n);
    persist();
  }

  editing = n.id;

  $('#noteTitle').value = n.title;
  $('#noteBody').value = n.body;

  $('#editor').classList.add('open');

  setTimeout(() => {
    $('#noteTitle').focus({ preventScroll: true });
  }, 440);
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

// ======================================
// MODAL
// ======================================

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

// ======================================
// MUHASEBE FORMU
// ======================================

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

  modal(
    `
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
    `,
    f => {
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
    }
  );
}

// ======================================
// PIN
// ======================================

function pinForm() {
  modal(
    `
      <h2>Защита PIN</h2>

      <form>
        <input type="password"
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
    `,
    f => {
      data.pin = f.get('pin');

      persist();

      $('#modalWrap').classList.remove('open');

      alert('PIN сохранён');
    }
  );
}

// ======================================
// YEDEKLEME
// ======================================

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
  const f = e.target.files?.[0];

  if (!f) return;

  try {
    const d = JSON.parse(await f.text());

    if (!['notes', 'money', 'debts', 'clients']
      .every(k => Array.isArray(d[k]))) {
      throw Error();
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

    alert('Yedek yüklendi');
  } catch (e) {
    alert('Geçersiz yedek dosyası');
  }
}

// ======================================
// UYGULAMA PIN KONTROLU
// ======================================

function lock() {
  if (!data.pin) return;

  const p = prompt('BEGENCHEKE PIN');

  if (p !== data.pin) {
    $('#content').innerHTML =
      '<p class="empty">PIN yanlış. Yeniden deneyin.</p>';

    $('#fab').style.display = 'none';
    $('#menu').disabled = true;
    $('#search').disabled = true;
  }
}

// ======================================
// GERI TUSU
// ======================================

window.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
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
  }
});

// ======================================
// BASLAT
// ======================================

go('notes');
lock();

// ======================================
// OFFLINE
// ======================================

if (
  'serviceWorker' in navigator &&
  location.protocol.startsWith('http')
) {
  navigator.serviceWorker
    .register('./sw.js')
    .catch(() => {});
}
