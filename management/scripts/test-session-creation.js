const fetch = require('node-fetch');

async function testSessionCreation() {
  try {
    console.log('🔐 Testing login...');
    
    // First, login to get auth token
    const loginResponse = await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'testuser@dhaman.co',
        password: 'harry123'
      })
    });
    
    if (!loginResponse.ok) {
      const errorText = await loginResponse.text();
      console.error('❌ Login failed:', loginResponse.status, errorText);
      return;
    }
    
    const loginData = await loginResponse.json();
    console.log('✅ Login successful');
    console.log('🎫 Auth token:', loginData.token ? loginData.token.substring(0, 20) + '...' : 'No token');
    
    // Now test session creation
    console.log('\n📝 Testing session creation...');
    
    const sessionResponse = await fetch('http://localhost:3000/api/sessions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${loginData.token}`
      },
      body: JSON.stringify({
        sessionId: 'test_session_' + Date.now(),
        projectId: 'cmcqgqv530003c7uckcqfqijd' // The project ID from the logs
      })
    });
    
    console.log('📊 Session creation response status:', sessionResponse.status);
    
    if (sessionResponse.ok) {
      const sessionData = await sessionResponse.json();
      console.log('✅ Session created successfully:');
      console.log(JSON.stringify(sessionData, null, 2));
    } else {
      const errorText = await sessionResponse.text();
      console.error('❌ Session creation failed:', errorText);
    }
    
  } catch (error) {
    console.error('💥 Test failed:', error.message);
  }
}

testSessionCreation();
