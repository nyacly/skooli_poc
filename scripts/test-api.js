#!/usr/bin/env node

/**
 * Simple API test script
 * Run with: node scripts/test-api.js
 */

const baseUrl = process.env.API_URL || 'http://localhost:3000';

export async function testEndpoint(method, path, body = null) {
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
    // Pass the configured options so that the correct HTTP method and body
    // are used during the request. Previously this function always performed
    // a GET request regardless of the supplied method.
    const response = await fetch(url, options);
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

export async function runTests() {
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
    first_name: 'Test',
    last_name: 'User'
  });

  await testEndpoint('POST', '/api/auth/signin', {
    email: 'test@example.com',
    password: 'testpass123'
  });
  
  console.log('✨ API tests completed!');
}

// Run tests if this file is executed directly (ESM equivalent of require.main)
if (import.meta.url === new URL(process.argv[1], 'file:').href) {
  runTests().catch(console.error);
}
