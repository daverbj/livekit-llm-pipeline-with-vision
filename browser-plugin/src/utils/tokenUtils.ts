// Token generation utility for LiveKit
// This is a simplified version for browser extensions
// In production, tokens should be generated server-side

interface TokenClaims {
  iss: string
  sub: string
  iat: number
  exp: number
  video: {
    room: string
    roomJoin: boolean
    canPublish: boolean
    canPublishData: boolean
    canSubscribe: boolean
  }
}

// Simple HMAC-SHA256 implementation for browser
// Note: In production, use a proper JWT library or server-side generation
async function createHmacSignature(data: string, secret: string): Promise<string> {
  const encoder = new TextEncoder()
  const keyData = encoder.encode(secret)
  const messageData = encoder.encode(data)
  
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData)
  return btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
}

export async function generateLiveKitToken(
  apiKey: string,
  apiSecret: string,
  roomName: string,
  participantIdentity: string,
  participantName?: string,
  ttlMinutes: number = 15
): Promise<string> {
  console.log('Generating token with:', { apiKey, roomName, participantIdentity, participantName })
  
  const header = {
    alg: 'HS256',
    typ: 'JWT'
  }
  
  const now = Math.floor(Date.now() / 1000)
  const claims: TokenClaims = {
    iss: apiKey,
    sub: participantIdentity,
    iat: now,
    exp: now + (ttlMinutes * 60),
    video: {
      room: roomName,
      roomJoin: true,
      canPublish: true,
      canPublishData: true,
      canSubscribe: true
    }
  }

  // Add participant name if provided
  if (participantName) {
    (claims as any).name = participantName
  }

  console.log('Token claims:', claims)

  // Base64 URL encode header and payload
  const encodedHeader = btoa(JSON.stringify(header))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
  
  const encodedPayload = btoa(JSON.stringify(claims))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')

  // Create signature
  const dataToSign = `${encodedHeader}.${encodedPayload}`
  const signature = await createHmacSignature(dataToSign, apiSecret)

  const token = `${encodedHeader}.${encodedPayload}.${signature}`
  console.log('Generated token:', token)
  
  return token
}

// Utility to decode and validate token (for debugging)
export function decodeToken(token: string): any {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) {
      throw new Error('Invalid token format')
    }

    const payload = parts[1]
    // Add padding if needed
    const paddedPayload = payload + '='.repeat((4 - payload.length % 4) % 4)
    const decodedPayload = atob(paddedPayload.replace(/-/g, '+').replace(/_/g, '/'))
    
    return JSON.parse(decodedPayload)
  } catch (error) {
    console.error('Failed to decode token:', error)
    return null
  }
}

// Check if token is expired
export function isTokenExpired(token: string): boolean {
  const decoded = decodeToken(token)
  if (!decoded || !decoded.exp) {
    return true
  }
  
  const now = Math.floor(Date.now() / 1000)
  return now >= decoded.exp
}
