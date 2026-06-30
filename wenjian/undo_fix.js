const fs = require('fs');
const path = 'src/modules/order-management/OrderList.tsx';
let content = fs.readFileSync(path, 'utf8');

// The current corrupted part starts after line 865 (the header end)
// We need to find the panel summary part and then the broken "type='date'" part.

const corruptionPattern = /(<div className="order-filter-panel__summary">[\s\S]*?<\/div>\s*<\/div>\s*<\/div>\s*)(type="date")/m;

const restoredBlock = `            <div className="order-filter-panel__summary">
              <span className="order-filter-panel__summary-main">{\`\\u5171 \${filteredOrders.length} \\u6761\\u7ed3\\u679c\`}</span>
              <span>{activeFilterCount > 0 ? \`\\u5df2\\u542f\\u7528 \${activeFilterCount} \\u9879\\u7b5b\\u9009\` : '\\u5f53\\u524d\\u672a\\u542f\\u7528\u7b5b\u9009\u6761\u4ef6'}</span>
            </div>
          </div>

          <div className="order-filter-grid">
            <div className="form-group order-filter-field">
              <label className="form-label">{'\\u9009\u62e9\u4ee3\u7406\u5546'}</label>
              <input
                className="form-input"
                value={filterAgent}
                onChange={(event) => setFilterAgent(event.target.value)}
                placeholder={'\\u8bf7\\u8f93\\u5165\\u4ee3\\u7406\\u5546\\u540d\u79f0'}
              />
            </div>

            <div className="form-group order-filter-field">
              <label className="form-label">{'\\u9009\\u62e9\u4ea7\u54c1'}</label>
              <select className="form-select" value={filterProduct} onChange={(event) => setFilterProduct(event.target.value)}>
                <option value="">{'\\u5168\\u90e8\u4ea7\u54c1'}</option>
                {productOptions.map((product) => (
                  <option key={product} value={product}>
                    {product}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group order-filter-field order-filter-field--span-2">
              <label className="form-label">{'\\u521b\u5efa\u65f6\u95f4'}</label>
              <div className="order-filter-range">
                <input
                  className="form-input"
                  type="date"`;

if (corruptionPattern.test(content)) {
    content = content.replace(corruptionPattern, restoredBlock);
    fs.writeFileSync(path, content, 'utf8');
    console.log('Successfully undid the corruption and restored original filter block.');
} else {
    console.log('Could not find corruption pattern. Checking if it matches a simpler anchor...');
    const simplePattern = /(<\/div>\s*<\/div>\s*)(type="date")/m;
    if (simplePattern.test(content)) {
        content = content.replace(simplePattern, restoredBlock); // Note: reconstructed from restoredBlock but careful with $1
        // Re-reading to be safe
         fs.writeFileSync(path, content, 'utf8');
         console.log('Restored via simple pattern.');
    } else {
         console.log('Undo failed: Could not find corruption point.');
    }
}
