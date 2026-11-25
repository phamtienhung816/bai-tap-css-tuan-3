'use strict';

const pad = (n) => String(n).padStart(2, '0');

/** Ngày địa phương dạng YYYY-MM-DD (không dùng toISOString vì bị lệch múi giờ). */
function toDateStr(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function addDays(dateStr, n) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return toDateStr(new Date(y, m - 1, d + n));
}

function toTimestamp(d = new Date()) {
  return `${toDateStr(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/** Bỏ dấu tiếng Việt + viết thường: "Họp nhóm" -> "hop nhom". */
function normalize(str = '') {
  return String(str)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase()
    .trim();
}

module.exports = { toDateStr, addDays, toTimestamp, normalize };
