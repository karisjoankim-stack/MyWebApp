const fs = require('fs');
const file = '/Users/kariskim/Desktop/MyWebApp/frontend/src/pages/RunnerPage.jsx';
let content = fs.readFileSync(file, 'utf8');

// Remove TEMPLATES array
content = content.replace(/const TEMPLATES = \[\s*\{[\s\S]*?\}\s*\];\s*/, '');

// Remove activeTemplate state
content = content.replace(/const \[activeTemplate, setActiveTemplate\] = useState\(null\);\n\s*/, '');

// Remove loadTemplate function
content = content.replace(/const loadTemplate = \([\s\S]*?};\n\s*/, '');

// Update drawer header and list
content = content.replace(/<span className="drawer-title">Script Templates<\/span>/, '<span className="drawer-title">Python Environment<\/span>');
content = content.replace(/<div className="template-list">[\s\S]*?<\/div>\s*\{\/\* Installed Python Libraries Status \*\/\}/, '{/* Installed Python Libraries Status */}');

fs.writeFileSync(file, content);
console.log('Done');
