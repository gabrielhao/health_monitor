// Test script to verify environment variables
console.log('🔍 Testing Environment Variables...\n');

const required = [
  'COSMOS_DB_ENDPOINT',
  'COSMOS_DB_KEY',
  'OPENAI_EMBEDDING_ENDPOINT', 
  'OPENAI_API_KEY',
  'AzureWebJobsStorage'
];

let allSet = true;

required.forEach(key => {
  const value = process.env[key];
  if (value) {
    console.log(`✅ ${key}: ${value.substring(0, 20)}...`);
  } else {
    console.log(`❌ ${key}: NOT SET`);
    allSet = false;
  }
});

console.log(allSet ? '\n🎉 All environment variables are set!' : '\n⚠️  Some environment variables are missing'); 