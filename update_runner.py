import re

filepath = '/Users/kariskim/Desktop/MyWebApp/frontend/src/pages/RunnerPage.jsx'
with open(filepath, 'r') as f:
    content = f.read()

# Remove TEMPLATES array
content = re.sub(r'const TEMPLATES = \[.*?\];\n+', '', content, flags=re.DOTALL)

# Remove activeTemplate state
content = re.sub(r'  const \[activeTemplate, setActiveTemplate\] = useState\(null\);\n+', '', content)

# Remove loadTemplate function
content = re.sub(r'  const loadTemplate = \([\s\S]*?};\n+', '', content)

# Update drawer header and list
content = content.replace('<span className="drawer-title">Script Templates</span>', '<span className="drawer-title">Python Environment</span>')
content = re.sub(r'<div className="template-list">.*?</div>\s*\{/\* Installed Python Libraries Status \*/\}', '{/* Installed Python Libraries Status */}', content, flags=re.DOTALL)

with open(filepath, 'w') as f:
    f.write(content)
print("Done")
