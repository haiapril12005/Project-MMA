// Chạy: npm run seed -> xuất products và reviews ở dạng JSON khi cần đối chiếu dữ liệu.
const fs = require('fs');
const path = require('path');
const seed = require('../src/data/seed');
const dir = path.join(__dirname, '..', 'seed');
fs.mkdirSync(dir, { recursive: true });
Object.entries(seed).forEach(([name, data]) => {
  fs.writeFileSync(path.join(dir, `${name}.json`), JSON.stringify(data, null, 2));
  console.log(`seed/${name}.json: ${data.length} bản ghi`);
});
