import { useEffect, useState } from 'react';

export function useRealtimeStats() {
  const [stats, setStats] = useState({ backendStatus: 'offline' });
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    let interval: NodeJS.Timeout;

    const fetchStats = async () => {
      try {
        const response = await fetch('/api/analytics/realtime');
        if (response.ok) {
          const data = await response.json();
          setStats(data);
          setConnected(true);
        }
      } catch (error) {
        console.error('Failed to fetch realtime stats:', error);
        setConnected(false);
      }
    };

    // Initial fetch
    fetchStats();

    // Update every 5 seconds
    interval = setInterval(fetchStats, 5000);

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, []);

  return { stats, connected };
}
