import { useEffect, useState, useRef } from 'react';

interface VideoProgressEvent {
  videoId: string;
  status: string;
  timestamp: string;
}

export function useVideoProgress(projectId: string, videoId: string) {
  const [status, setStatus] = useState<string>('');
  const [isConnected, setIsConnected] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!projectId || !videoId) return;

    // Only connect SSE for videos in processing states
    const processingStates = ['UPLOADED', 'EXTRACTING_AUDIO', 'TRANSCRIBING', 'GENERATING_STEPS', 'EMBEDDING'];
    
    const connectSSE = () => {
      const eventSource = new EventSource(
        `/api/projects/${projectId}/videos/${videoId}/progress`
      );

      eventSource.onopen = () => {
        setIsConnected(true);
      };

      eventSource.onmessage = (event) => {
        try {
          const data: VideoProgressEvent = JSON.parse(event.data);
          setStatus(data.status);

          // Close connection if video is in final state
          if (['COMPLETED', 'FAILED'].includes(data.status)) {
            eventSource.close();
            setIsConnected(false);
          }
        } catch (error) {
          console.error('Error parsing SSE data:', error);
        }
      };

      eventSource.onerror = (error) => {
        console.error('SSE error:', error);
        setIsConnected(false);
        eventSource.close();
      };

      eventSourceRef.current = eventSource;
    };

    connectSSE();

    // Cleanup
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        setIsConnected(false);
      }
    };
  }, [projectId, videoId]);

  // Manual cleanup function
  const disconnect = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      setIsConnected(false);
    }
  };

  return {
    status,
    isConnected,
    disconnect
  };
}
