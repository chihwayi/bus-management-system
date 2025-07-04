import { useEffect, useState } from 'react';
import apiService from '../services/api';
import { TodayStats, RecentBoarding } from '../types';

export const useBoardingStats = (conductorId?: string) => {
  const [todayStats, setTodayStats] = useState<TodayStats | null>(null);
  const [recentBoardings, setRecentBoardings] = useState<RecentBoarding[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Move fetchStats to outer scope so it can be used by both useEffect and refreshStats
  const fetchStats = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [statsResponse, boardingsResponse] = await Promise.all([
        apiService.getConductorTodayStats(),
        apiService.getRecentBoardings()
      ]);

      if (statsResponse.success) {
        setTodayStats(statsResponse.data ?? null);
      } else {
        console.warn('Failed to fetch today stats:', statsResponse.error);
      }

      if (boardingsResponse.success && (boardingsResponse.data as any)?.boardings) {
        // Extract the boardings array from the nested response
        const boardings = (boardingsResponse.data as any).boardings;
        setRecentBoardings(Array.isArray(boardings) ? boardings : []);
      } else {
        console.warn('Failed to fetch recent boardings:', boardingsResponse.error || 'No boardings data');
        setRecentBoardings([]);
      }
    } catch (err) {
      setError('Failed to load boarding stats');
      console.error('Boarding stats error:', err);
      setRecentBoardings([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!conductorId) {
      setLoading(false);
      return;
    }

    fetchStats();

    // Refresh every 5 minutes
    const interval = setInterval(fetchStats, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [conductorId]);
  // Expose a manual refresh function
  const refreshStats = () => {
    if (conductorId) {
      // Call fetchStats directly
      fetchStats();
    }
  };

  return { 
    todayStats, 
    recentBoardings,
    loading, 
    error,
    refreshStats 
  };
};
