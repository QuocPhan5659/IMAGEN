const fs = require('fs');

function replaceColors(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  content = content.replace(/blue-/g, 'purple-');
  content = content.replace(/yellow-/g, 'purple-');
  fs.writeFileSync(filePath, content);
}

replaceColors('index.html');
replaceColors('index.tsx');
console.log('Colors replaced');
