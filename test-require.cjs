// Simple runtime smoke test for CommonJS require
const pkg = require('./dist');
console.log('Export keys:', Object.keys(pkg));
const { OpenAIClient } = pkg;
if (typeof OpenAIClient !== 'function') {
  console.error('OpenAIClient not exported correctly');
  process.exit(1);
}
console.log('OpenAIClient OK');
