const fs = require('fs');
const path = 'src/modules/order-management/OrderList.tsx';
let content = fs.readFileSync(path, 'utf8');

// Find the panel summary block that is followed by the broken date field
const pattern = /(<div className="order-filter-panel__summary">[\s\S]*?<\/div>\s*<\/div>\s*<\/div>\s*)(type="date")/m;

const replacement = `$1
          <div className="order-filter-grid">
            <div className="form-group order-filter-field">
              <label className="form-label">{'\\u9009\\u62e9\\u4ee3\\u7406\\u5546'}</label>
              <input
                className="form-input"
                value={filterAgent}
                onChange={(event) => setFilterAgent(event.target.value)}
                placeholder={'\\u8bf7\\u8f93\\u5165\\u4ee3\\u7406\\u5546\\u540d\\u79f0'}
              />
            </div>

            <div className="form-group order-filter-field">
              <label className="form-label">{'\\u9009\\u62e9\\u4ea7\\u54c1'}</label>
              <select className="form-select" value={filterProduct} onChange={(event) => setFilterProduct(event.target.value)}>
                <option value="">{'\\u5168\\u90e8\\u4ea7\\u54c1'}</option>
                {categoryFilter === 'idp' ? (
                  <>
                    <option value="IDP">IDP</option>
                    <option value="IDP（加急）">IDP（加急）</option>
                    <option value="IDD国际驾照">IDD国际驾照</option>
                    <option value="IDD国际驾照（加急）">IDD国际驾照（加急）</option>
                  </>
                ) : (
                  productOptions.map((product) => (
                    <option key={product} value={product}>
                      {product}
                    </option>
                  ))
                )}
              </select>
            </div>

            <div className="form-group order-filter-field order-filter-field--span-2">
              <label className="form-label">{'\\u521b\u5efa\\u65f6\u95f4'}</label>
              <div className="order-filter-range">
                <input
                  className="form-input"
                  $2`;

if (pattern.test(content)) {
    content = content.replace(pattern, replacement);
    fs.writeFileSync(path, content, 'utf8');
    console.log('Successfully restored and updated OrderList.tsx using regex');
} else {
    // Try even simpler pattern if that fails
    console.log('Regex failed, trying simpler pattern...');
    const simplePattern = /(<\/div>\s*<\/div>\s*)(type="date")/m;
     if (simplePattern.test(content)) {
        content = content.replace(simplePattern, replacement);
        fs.writeFileSync(path, content, 'utf8');
        console.log('Successfully restored using simple pattern');
    } else {
        console.log('Could not find any pattern to match');
    }
}
