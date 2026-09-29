const cp1252Chars = '\\x80-\\xFF' + '\\u20AC\\u201A\\u0192\\u201E\\u2026\\u2020\\u2021\\u02C6\\u2030\\u0160\\u2039\\u0152\\u017D' + '\\u2018\\u2019\\u201C\\u201D\\u2022\\u2013\\u2014\\u02DC\\u2122\\u0161\\u203A\\u0153\\u017E\\u0178';
const regex2Byte = new RegExp(`[ÃÄÅÆ][${cp1252Chars}]`, 'g');
const regex3Byte = new RegExp(`á[º»][${cp1252Chars}]`, 'g');
const str = 'Biến lưu trữ lịch sử các bước để rollback khi cần\nSTAGE 1: Trừ tồn kho sản phẩm';
console.log('2byte:', str.match(regex2Byte));
console.log('3byte:', str.match(regex3Byte));
