#!/usr/bin/env node

/**
 * Simple API test script
 * Run with: node scripts/test-api.js
 */

const baseUrl = process.env.API_URL || 'http://localhost:3000';

async function testEndpoint(method, path, body = null) {
  const url = `${baseUrl}${path}`;
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
  };
  
  if (body) {
    options.body = JSON.stringify(body);
  }
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    
    console.log(`✅ ${method} ${path}`);
    console.log(`   Status: ${response.status}`);
    console.log(`   Response:`, JSON.stringify(data, null, 2).substring(0, 200));
    console.log('');
    
    return { success: true, data, status: response.status };
  } catch (error) {
    console.log(`❌ ${method} ${path}`);
    console.log(`   Error: ${error.message}`);
    console.log('');
    
    return { success: false, error: error.message };
  }
}

async function runTests() {
  console.log('🧪 Testing Skooli API Endpoints');
  console.log('================================\n');
  
  // Test health endpoint
  await testEndpoint('GET', '/api/health');
  
  // Test main API endpoint
  await testEndpoint('GET', '/api');
  
  // Test products endpoints
  await testEndpoint('GET', '/api/products/categories');
  await testEndpoint('GET', '/api/products?page=1&limit=10');
  await testEndpoint('GET', '/api/products/featured');
  
  // Test auth endpoints (will fail without valid data but tests connectivity)
  await testEndpoint('POST', '/api/auth/signup', {
    email: 'test@example.com',
    password: 'testpass123',
    name: 'Test User'
  });
  
  console.log('✨ API tests completed!');
}

// Run tests if this file is executed directly
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = { testEndpoint, runTests };