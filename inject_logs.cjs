const fs = require('fs');
const content = fs.readFileSync('D:/Mini-Shop/src/api/orderApi.js', 'utf8');
const lines = content.split('\n');
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('let res;')) {
    lines.splice(i, 0, '        console.log(\"ABOUT TO POST ORDER\");');
    i++;
  }
  if (lines[i].includes('res = await axiosClient.post(')) {
    lines.splice(i+1, 0, '        console.log(\"POSTED ORDER SUCCESSFULLY\");');
    i++;
  }
  if (lines[i].includes('await internalUpdateStock')) {
    lines.splice(i, 0, '            console.log(\"ABOUT TO UPDATE STOCK FOR ITEM\", item.productId);');
    i++;
  }
  if (lines[i].includes('await inventoryApi.createTransaction')) {
    lines.splice(i, 0, '            console.log(\"ABOUT TO CREATE TX FOR ITEM\", item.productId);');
    i++;
  }
}
fs.writeFileSync('D:/Mini-Shop/src/api/orderApi.js', lines.join('\n'), 'utf8');
