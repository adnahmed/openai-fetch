// Fix CommonJS imports by removing .js extensions
const fs = require('fs');
const path = require('path');

function fixImportsInFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  // Remove .js extensions from relative imports
  const fixedContent = content.replace(
    /from ['"](\.[^'"]*?)\.js['"]/g,
    "from '$1'"
  );
  fs.writeFileSync(filePath, fixedContent);
}

function processDirectory(dirPath) {
  const files = fs.readdirSync(dirPath);

  for (const file of files) {
    const fullPath = path.join(dirPath, file);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      processDirectory(fullPath);
    } else if (file.endsWith('.js')) {
      fixImportsInFile(fullPath);
    }
  }
}

// Process the CommonJS build directory (now dist root)
const distDir = path.join(process.cwd(), 'dist');
if (fs.existsSync(distDir)) {
  processDirectory(distDir);
  console.log('Fixed CommonJS imports in dist by removing .js extensions');
}
