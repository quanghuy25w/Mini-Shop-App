const fs = require('fs');

const str = 'Biáº¿n lÆ°u trá»¯ lá»‹ch sá»­ cÃ¡c bÆ°á»›c Ä‘á»ƒ rollback khi cáº§n';
const cp1252 = {
  0x20AC: 0x80, 0x81: 0x81, 0x201A: 0x82, 0x0192: 0x83, 0x201E: 0x84, 0x2026: 0x85, 0x2020: 0x86, 0x2021: 0x87,
  0x02C6: 0x88, 0x2030: 0x89, 0x0160: 0x8A, 0x2039: 0x8B, 0x0152: 0x8C, 0x8D: 0x8D, 0x017D: 0x8E, 0x8F: 0x8F,
  0x90: 0x90, 0x2018: 0x91, 0x2019: 0x92, 0x201C: 0x93, 0x201D: 0x94, 0x2022: 0x95, 0x2013: 0x96,
  0x2014: 0x97, 0x02DC: 0x98, 0x2122: 0x99, 0x0161: 0x9A, 0x203A: 0x9B, 0x0153: 0x9C, 0x9D: 0x9D, 0x017E: 0x9E,
  0x0178: 0x9F
};
const cp1252Chars = '\\x80-\\xFF' + 
  '\\u20AC\\u201A\\u0192\\u201E\\u2026\\u2020\\u2021\\u02C6\\u2030\\u0160\\u2039\\u0152\\u017D' +
  '\\u2018\\u2019\\u201C\\u201D\\u2022\\u2013\\u2014\\u02DC\\u2122\\u0161\\u203A\\u0153\\u017E\\u0178';
const regex2Byte = new RegExp(`[ÃÄÅÆ][${cp1252Chars}]`, 'g');
const regex3Byte = new RegExp(`á[º»][${cp1252Chars}]`, 'g');

function decodeCp1252Str(str) {
  let bytes = [];
  for (let i = 0; i < str.length; i++) {
    let code = str.charCodeAt(i);
    if (code >= 0 && code <= 0xFF) {
      bytes.push(code);
    } else if (cp1252[code] !== undefined) {
      bytes.push(cp1252[code]);
    } else {
      let b = Buffer.from(str.charAt(i), 'utf8');
      for (let j = 0; j < b.length; j++) bytes.push(b[j]);
    }
  }
  return Buffer.from(bytes).toString('utf8');
}

let res = str;
res = res.replace(regex3Byte, match => decodeCp1252Str(match));
res = res.replace(regex2Byte, match => decodeCp1252Str(match));
console.log(res);

const content = fs.readFileSync('src/hooks/useCart.js', 'utf8');
let fixed = content.split('\n').map(l => {
  let r = l;
  r = r.replace(regex3Byte, match => decodeCp1252Str(match));
  r = r.replace(regex2Byte, match => decodeCp1252Str(match));
  return r;
}).join('\n');
console.log(fixed.includes('rollback khi cần'));
