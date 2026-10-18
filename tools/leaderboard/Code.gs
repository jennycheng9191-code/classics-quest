// 讀經闖關排行榜後台。
// 貼到 Apps Script（試算表的「擴充功能 → Apps Script」或 script.google.com 都可以），
// 先執行一次 setup，再部署成網頁應用程式（執行身分：我；存取權：所有人）。
// 成績存在「排行榜」工作表，有人亂取名字，直接刪掉那一列即可。
const SHEET = '排行榜';
const HEAD = ['經典', '年級', '名字', '星數', '用時(毫秒)', '用時', '更新時間'];
const PER_STAGE = { k: 5, low: 8, high: 10 }; // 每關題數，用來擋不合理的成績
const MAX_NAME = 12;
const TOP = 10;

// 從試算表「擴充功能 → Apps Script」建的專案會直接用那份試算表；
// 從 script.google.com 另外建的專案沒有綁試算表，第一次執行時自動建一份並記住
function book_() {
  const bound = SpreadsheetApp.getActiveSpreadsheet();
  if (bound) return bound;
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('SHEET_ID');
  if (id) return SpreadsheetApp.openById(id);
  const ss = SpreadsheetApp.create('讀經闖關排行榜');
  props.setProperty('SHEET_ID', ss.getId());
  return ss;
}

// 第一次貼好程式後，選這個函式按「執行」：完成授權、建好工作表，並在下方記錄印出試算表網址
function setup() {
  sheet_();
  Logger.log('排行榜試算表：' + book_().getUrl());
}

function sheet_() {
  const ss = book_();
  let sh = ss.getSheetByName(SHEET);
  if (!sh) {
    sh = ss.insertSheet(SHEET);
    sh.appendRow(HEAD);
    sh.setFrozenRows(1);
  }
  return sh;
}

function rows_() {
  const sh = sheet_();
  const n = sh.getLastRow();
  if (n < 2) return [];
  return sh.getRange(2, 1, n - 1, HEAD.length).getValues().map(function (r, i) {
    return { row: i + 2, book: String(r[0]), grade: String(r[1]), name: String(r[2]), stars: Number(r[3]), ms: Number(r[4]) };
  });
}

// 星數高的在前；同星數，時間短的在前
function rank_(a, b) {
  return b.stars - a.stars || a.ms - b.ms;
}

function top_(book, grade) {
  return rows_()
    .filter(function (r) { return r.book === book && r.grade === grade && r.name; })
    .sort(rank_)
    .slice(0, TOP)
    .map(function (r) { return { name: r.name, stars: r.stars, ms: r.ms }; });
}

function out_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

function clock_(ms) {
  const s = Math.round(ms / 1000);
  return Math.floor(s / 60) + '分' + ('0' + (s % 60)).slice(-2) + '秒';
}

function doGet(e) {
  const p = e.parameter || {};
  return out_({ ok: true, top: top_(String(p.book || ''), String(p.grade || '')) });
}

function doPost(e) {
  let d;
  try {
    d = JSON.parse(e.postData.contents);
  } catch (err) {
    return out_({ ok: false, error: 'bad json' });
  }
  const book = String(d.book || '').slice(0, 40);
  const grade = String(d.grade || '');
  let name = String(d.name || '').trim().replace(/\s+/g, ' ').slice(0, MAX_NAME);
  const stages = Math.round(Number(d.stages));
  const stars = Math.round(Number(d.stars));
  const ms = Math.round(Number(d.ms));
  // 擋不合理的成績：每關 1～3 星、每題至少 1 秒
  const okGrade = Object.prototype.hasOwnProperty.call(PER_STAGE, grade);
  if (!name || !book || !okGrade || !(stages >= 1 && stages <= 100) ||
      !(stars >= stages && stars <= stages * 3) || !(ms >= stages * PER_STAGE[grade] * 1000)) {
    return out_({ ok: false, error: 'invalid' });
  }
  // 名字以 = + - @ 開頭時試算表會當成公式，前面加 ' 讓它保持文字
  const cellName = /^[=+\-@]/.test(name) ? "'" + name : name;

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sh = sheet_();
    const mine = rows_().filter(function (r) { return r.book === book && r.grade === grade && r.name === name; });
    const values = [book, grade, cellName, stars, ms, clock_(ms), new Date()];
    let updated = true;
    if (mine.length === 0) {
      sh.appendRow(values);
    } else {
      const old = mine.sort(rank_)[0];
      if (rank_({ stars: stars, ms: ms }, old) < 0) sh.getRange(old.row, 1, 1, HEAD.length).setValues([values]);
      else updated = false;
    }
    return out_({ ok: true, updated: updated, top: top_(book, grade) });
  } finally {
    lock.releaseLock();
  }
}
