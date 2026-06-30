const fs = require('fs');
const path = 'src/modules/order-management/OrderList.tsx';
let content = fs.readFileSync(path, 'utf8');

const anchorStart = '<div className="order-filter-panel">';
const anchorEnd = '<div className="form-group order-filter-field order-filter-field--keyword';

const cleanFilterSection = `        <div className="order-filter-panel">
          <div className="order-filter-panel__header">
            <div>
              <div className="order-filter-panel__title">{'\\u7b5b\\u9009\\u6761\\u4ef6'}</div>
            </div>
            <div className="order-filter-panel__summary">
              <span className="order-filter-panel__summary-main">{\`\\u5171 \${filteredOrders.length} \\u6761\\u7ed3\\u679c\`}</span>
              <span>{activeFilterCount > 0 ? \`\\u5df2\\u542f\\u7528 \${activeFilterCount} \\u9879\\u7b5b\\u9009\` : '\\u5f53\\u524d\\u672a\\u542f\\u7528\\u7b5b\\u9009\\u6761\\u4ef6'}</span>
            </div>
          </div>

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
              <label className="form-label">{'\\u521b\\u5efa\\u65f6\\u95f4'}</label>
              <div className="order-filter-range">
                <input
                  className="form-input"
                  type="date"
                  value={filterStartDate}
                  onChange={(event) => setFilterStartDate(event.target.value)}
                />
                <span className="order-filter-range__divider">{'\\u81f3'}</span>
                <input
                  className="form-input"
                  type="date"
                  value={filterEndDate}
                  onChange={(event) => setFilterEndDate(event.target.value)}
                />
              </div>
            </div>

            `;

// Find everything from <div className="order-filter-panel"> to the keyword filter field
const startIndex = content.indexOf(anchorStart);
const endIndex = content.indexOf(anchorEnd);

if (startIndex !== -1 && endIndex !== -1) {
    const newContent = content.substring(0, startIndex) + cleanFilterSection + content.substring(endIndex);
    fs.writeFileSync(path, newContent, 'utf8');
    console.log('Cleanup and update successful');
} else {
    console.log('Failed to find markers: ' + startIndex + ', ' + endIndex);
}
