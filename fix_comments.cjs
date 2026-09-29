const fs = require('fs');
const path = require('path');

const cp1252 = { 0x20AC: 0x80, 0x81: 0x81, 0x201A: 0x82, 0x0192: 0x83, 0x201E: 0x84, 0x2026: 0x85, 0x2020: 0x86, 0x2021: 0x87, 0x02C6: 0x88, 0x2030: 0x89, 0x0160: 0x8A, 0x2039: 0x8B, 0x0152: 0x8C, 0x8D: 0x8D, 0x017D: 0x8E, 0x8F: 0x8F, 0x90: 0x90, 0x2018: 0x91, 0x2019: 0x92, 0x201C: 0x93, 0x201D: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97, 0x02DC: 0x98, 0x2122: 0x99, 0x0161: 0x9A, 0x203A: 0x9B, 0x0153: 0x9C, 0x9D: 0x9D, 0x017E: 0x9E, 0x0178: 0x9F };
const cp1252Chars = '\\x80-\\xFF' + '\\u20AC\\u201A\\u0192\\u201E\\u2026\\u2020\\u2021\\u02C6\\u2030\\u0160\\u2039\\u0152\\u017D' + '\\u2018\\u2019\\u201C\\u201D\\u2022\\u2013\\u2014\\u02DC\\u2122\\u0161\\u203A\\u0153\\u017E\\u0178';
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

function fixMojibake(text) {
  let res = text;
  res = res.replace(regex3Byte, match => decodeCp1252Str(match));
  res = res.replace(regex2Byte, match => decodeCp1252Str(match));
  return res;
}

function fixLine(line) {
  // If line is purely a comment
  const trimmed = line.trim();
  if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
    return fixMojibake(line);
  }
  
  // If line has an inline comment (like `const x = 1; // comment`)
  // Be careful with URLs like `http://`
  const commentIdx = line.indexOf('//');
  if (commentIdx !== -1) {
    const before = line.substring(0, commentIdx);
    const after = line.substring(commentIdx);
    if (!before.includes('http:') && !before.includes('https:')) {
      return before + fixMojibake(after);
    }
  }

  // If there's an HTML comment like <!-- comment -->
  const htmlCommentIdx = line.indexOf('<!--');
  if (htmlCommentIdx !== -1) {
    const htmlEndIdx = line.indexOf('-->', htmlCommentIdx);
    if (htmlEndIdx !== -1) {
      const before = line.substring(0, htmlCommentIdx);
      const comment = line.substring(htmlCommentIdx, htmlEndIdx + 3);
      const after = line.substring(htmlEndIdx + 3);
      return before + fixMojibake(comment) + after;
    } else {
      const before = line.substring(0, htmlCommentIdx);
      const after = line.substring(htmlCommentIdx);
      return before + fixMojibake(after);
    }
  }

  // JSX comments {/* comment */}
  const jsxCommentIdx = line.indexOf('{/*');
  if (jsxCommentIdx !== -1) {
    const jsxEndIdx = line.indexOf('*/}', jsxCommentIdx);
    if (jsxEndIdx !== -1) {
      const before = line.substring(0, jsxCommentIdx);
      const comment = line.substring(jsxCommentIdx, jsxEndIdx + 3);
      const after = line.substring(jsxEndIdx + 3);
      return before + fixMojibake(comment) + after;
    }
  }

  return line;
}

const excludeDirs = ['node_modules', 'dist', '.agents', '.git', 'coverage'];
const includeExts = ['.js', '.jsx', '.html'];

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      if (!excludeDirs.includes(file)) {
        results = results.concat(walk(filePath));
      }
    } else {
      if (includeExts.includes(path.extname(file))) {
        results.push(filePath);
      }
    }
  });
  return results;
}

const files = walk('.');
let fixedCount = 0;

files.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split(/\r?\n/);
  let changed = false;
  const fixedLines = lines.map(l => {
    const fixed = fixLine(l);
    if (fixed !== l) changed = true;
    return fixed;
  });
  
  if (changed) {
    // Preserve exact original line endings (assuming \n for simplicity, git will handle CRLF)
    const fixedContent = fixedLines.join('\n');
    fs.writeFileSync(file, fixedContent, 'utf8');
    console.log('Fixed comments in', file);
    fixedCount++;
  }
});

console.log('Total files fixed:', fixedCount);
