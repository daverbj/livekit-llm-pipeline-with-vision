// Test script to simulate session completion flow
const WebSocket = require('ws');

async function testSessionCompletion() {
  try {
    console.log('🧪 Testing session completion flow...');
    
    // First get auth token
    const loginResponse = await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'testuser@dhaman.co',
        password: 'harry123'
      })
    });
    
    if (!loginResponse.ok) {
      throw new Error(`Login failed: ${loginResponse.status}`);
    }
    
    const loginData = await loginResponse.json();
    const userToken = loginData.token;
    const projectId = 'cmcqgqv530003c7uckcqfqijd'; // Hubspot project
    
    console.log('✅ Login successful');
    
    // Create WebSocket connection with proper parameters
    const sessionId = `test_completion_${Date.now()}`;
    const wsUrl = `ws://localhost:8000/ws/${sessionId}?` + new URLSearchParams({
      collection_name: 'hubspot',
      project_description: 'Hubspot related tutorial',
      project_id: projectId,
      user_token: userToken
    });
    
    console.log('🔌 Connecting to WebSocket:', wsUrl);
    
    const ws = new WebSocket(wsUrl);
    
    ws.on('open', () => {
      console.log('✅ WebSocket connected');
      
      // Send start Gemini message
      setTimeout(() => {
        console.log('🚀 Starting Gemini session');
        ws.send(JSON.stringify({ type: 'start_gemini' }));
      }, 1000);
      
      // Close connection after 5 seconds to trigger session completion
      setTimeout(() => {
        console.log('🛑 Closing connection to trigger session completion');
        ws.close();
      }, 5000);
    });
    
    ws.on('message', (data) => {
      const message = JSON.parse(data);
      console.log('📨 Received message:', message.type, message.message || '');
    });
    
    ws.on('close', () => {
      console.log('🔌 WebSocket closed');
      
      // Check session status after a short delay
      setTimeout(async () => {
        try {
          const sessionResponse = await fetch(`http://localhost:3000/api/sessions?limit=1&offset=0`, {
            headers: { 'Authorization': `Bearer ${userToken}` }
          });
          
          if (sessionResponse.ok) {
            const sessions = await sessionResponse.json();
            const latestSession = sessions.sessions[0];
            
            if (latestSession && latestSession.sessionId === sessionId) {
              console.log('✅ Session found in database:');
              console.log(`   Status: ${latestSession.status}`);
              console.log(`   Duration: ${latestSession.durationSeconds}s`);
              console.log(`   Total Tokens: ${latestSession.totalTokens}`);
              
              if (latestSession.status === 'COMPLETED') {
                console.log('🎉 SUCCESS: Session completion update worked!');
              } else {
                console.log('⚠️  Session still ACTIVE - completion update may have failed');
              }
            } else {
              console.log('❌ Session not found in database');
            }
          } else {
            console.log('❌ Failed to fetch sessions:', sessionResponse.status);
          }
        } catch (error) {
          console.error('❌ Error checking session status:', error);
        }
      }, 2000);
    });
    
    ws.on('error', (error) => {
      console.error('❌ WebSocket error:', error);
    });
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Note: This requires node-fetch and ws packages
// For now, let's use this as a reference for manual testing
console.log('This test script shows the expected flow.');
console.log('Test by opening the Electron app and checking the session completion.');
