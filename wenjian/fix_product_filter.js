const fs = require('fs');
const file = 'src/modules/order-management/OrderList.tsx';
let content = fs.readFileSync(file, 'utf8');

if (content.includes('productOptions.map')) {
  const newOptions = [
    '<option value="IDP">IDP</option>',
    '                <option value="IDP\uFF08\u52A0\u6025\uFF09">IDP\uFF08\u52A0\u6025\uFF09</option>',
    '                <option value="IDD\u56FD\u9645\u9A7E\u7167">IDD\u56FD\u9645\u9A7E\u7167</option>',
    '                <option value="IDD\u56FD\u9645\u9A7E\u7167\uFF08\u52A0\u6025\uFF09">IDD\u56FD\u9645\u9A7E\u7167\uFF08\u52A0\u6025\uFF09</option>',
  ].join('\n');

  content = content.replace(
    /\{productOptions\.map\(\(product\) => \(\s*<option key=\{product\} value=\{product\}>\s*\{product\}\s*<\/option>\s*\)\)\}/,
    newOptions
  );
  fs.writeFileSync(file, content, 'utf8');
  console.log('Done - product filter options replaced');
} else {
  console.log('productOptions.map not found in file - may have already been replaced');
}
