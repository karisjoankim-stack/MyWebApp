import re

filepath = '/Users/kariskim/Desktop/MyWebApp/frontend/src/pages/LandingPage.jsx'
with open(filepath, 'r') as f:
    content = f.read()

# Remove PREVIEW_SNIPPETS
content = re.sub(r'const PREVIEW_SNIPPETS = \[.*?\];\n\n', '', content, flags=re.DOTALL)

# Update LandingPage component state and useEffect
new_state_effect = """export default function LandingPage() {
  const navigate = useNavigate();
  const [recentCode, setRecentCode] = useState('Loading...');

  useEffect(() => {
    fetch('http://localhost:3002/api/recent-code')
      .then(res => res.json())
      .then(data => setRecentCode(data.code))
      .catch(err => setRecentCode('# Failed to load recent code'));
  }, []);"""

content = re.sub(r'export default function LandingPage\(\) \{\n  const navigate = useNavigate\(\);\n  const \[snippetIndex, setSnippetIndex\] = useState\(0\);\n\n  useEffect\(\(\) => \{\n    const interval = setInterval\(\(\) => \{\n      setSnippetIndex\(\(prev\) => \(prev \+ 1\) % PREVIEW_SNIPPETS\.length\);\n    \}, 4500\);\n    return \(\) => clearInterval\(interval\);\n  \}, \[\]\);\n\n  const currentSnippet = PREVIEW_SNIPPETS\[snippetIndex\];', new_state_effect, content)

# Update the rendering part
old_render = """<span className="preview-title">{currentSnippet.title}</span>
          </div>
          <div className="code-preview-body">
            {currentSnippet.code}
          </div>"""

new_render = """<span className="preview-title">latest_run.py</span>
          </div>
          <div className="code-preview-body">
            <pre style={{ margin: 0, padding: 0, background: 'transparent', color: 'inherit', fontFamily: 'inherit', whiteSpace: 'pre-wrap', fontSize: '0.85rem' }}>
              <code>{recentCode}</code>
            </pre>
          </div>"""

content = content.replace(old_render, new_render)

with open(filepath, 'w') as f:
    f.write(content)
print("Done")
