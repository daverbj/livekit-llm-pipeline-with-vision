const fs = require('fs');
const path = require('path');

async function testTokenUsageAPI() {
  try {
    // First, we need to get an admin token
    console.log('🔑 Getting admin token...');
    
    const loginResponse = await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'admin@quantimedx.com',
        password: 'admin123'
      })
    });

    if (!loginResponse.ok) {
      const errorText = await loginResponse.text();
      console.error('❌ Login failed:', loginResponse.status, errorText);
      return;
    }

    const loginData = await loginResponse.json();
    const token = loginData.token;
    console.log('✅ Admin login successful');

    // Test the token usage API
    console.log('📊 Testing token usage API...');
    
    const tokenUsageResponse = await fetch('http://localhost:3000/api/admin/token-usage', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!tokenUsageResponse.ok) {
      const errorText = await tokenUsageResponse.text();
      console.error('❌ Token usage API failed:', tokenUsageResponse.status, errorText);
      return;
    }

    const tokenUsageData = await tokenUsageResponse.json();
    
    console.log('\n🎯 Token Usage API Response:');
    console.log(JSON.stringify(tokenUsageData, null, 2));
    
    console.log('\n📈 User Token Summary:');
    tokenUsageData.users.forEach(user => {
      console.log(`👤 ${user.email} (${user.role}):`);
      console.log(`   Sessions: ${user.sessionCount}`);
      console.log(`   Total Tokens: ${user.tokenUsage.total.totalTokens}`);
      console.log(`   Input Tokens: ${user.tokenUsage.total.inputTokens}`);
      console.log(`   Output Tokens: ${user.tokenUsage.total.outputTokens}`);
      console.log('');
    });

  } catch (error) {
    console.error('💥 Error:', error);
  }
}

testTokenUsageAPI();
