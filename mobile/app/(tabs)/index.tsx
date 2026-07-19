import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, ActivityIndicator, TouchableOpacity, RefreshControl } from 'react-native';
import { useAuth, BACKEND_URL } from '../../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';

interface AnalyticsData {
  cards: {
    totalLeads: number;
    newLeads: number;
    activeDeals: number;
    conversionRate: number;
    monthlyRevenue: number;
    todaysFollowups: number;
  };
}

interface TaskItem {
  id: string;
  title: string;
  isDone: boolean;
  dueDate: string;
}

export default function DashboardScreen() {
  const { fetchWithAuth, user, addSocketListener } = useAuth();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchDashboardData = async () => {
    try {
      const analyticsRes = await fetchWithAuth(`${BACKEND_URL}/api/analytics`);
      const tasksRes = await fetchWithAuth(`${BACKEND_URL}/api/tasks`);
      if (analyticsRes.ok && tasksRes.ok) {
        setData(await analyticsRes.json());
        setTasks(await tasksRes.json());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  useEffect(() => {
    const removeListener = addSocketListener(() => {
      // Reload stats and task lists on any sync event
      fetchDashboardData();
    });
    return removeListener;
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchDashboardData();
  };

  const handleToggleTask = async (id: string) => {
    try {
      const res = await fetchWithAuth(`${BACKEND_URL}/api/tasks/${id}/toggle`, {
        method: 'POST',
      });
      if (res.ok) {
        // Toggle local state
        setTasks(prev =>
          prev.map(t => (t.id === id ? { ...t, isDone: !t.isDone } : t))
        );
        // Refresh analytics in background
        const analyticsRes = await fetchWithAuth(`${BACKEND_URL}/api/analytics`);
        if (analyticsRes.ok) {
          setData(await analyticsRes.json());
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  const completedTasks = tasks.filter(t => t.isDone).length;
  const totalTasks = tasks.length;
  const progressPercent = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={['#2563eb']} />}
    >
      <View style={styles.header}>
        <Text style={styles.welcome}>Welcome back,</Text>
        <Text style={styles.username}>{user?.name || 'Partner'}</Text>
      </View>

      {/* Stats Grid */}
      <View style={styles.grid}>
        <View style={[styles.card, styles.shadow]}>
          <View style={styles.cardHeader}>
            <Ionicons name="funnel-outline" size={16} color="#2563eb" />
            <Text style={styles.cardLabel}>Total Leads</Text>
          </View>
          <Text style={styles.cardVal}>{data?.cards.totalLeads ?? 0}</Text>
        </View>

        <View style={[styles.card, styles.shadow]}>
          <View style={styles.cardHeader}>
            <Ionicons name="git-pull-request-outline" size={16} color="#f59e0b" />
            <Text style={styles.cardLabel}>Active Deals</Text>
          </View>
          <Text style={styles.cardVal}>{data?.cards.activeDeals ?? 0}</Text>
        </View>

        <View style={[styles.card, styles.shadow]}>
          <View style={styles.cardHeader}>
            <Ionicons name="pie-chart-outline" size={16} color="#10b981" />
            <Text style={styles.cardLabel}>Conv. Rate</Text>
          </View>
          <Text style={styles.cardVal}>{data?.cards.conversionRate ?? 0}%</Text>
        </View>

        <View style={[styles.card, styles.shadow]}>
          <View style={styles.cardHeader}>
            <Ionicons name="wallet-outline" size={16} color="#8b5cf6" />
            <Text style={styles.cardLabel}>Monthly Rev</Text>
          </View>
          <Text style={styles.cardVal}>₹{data?.cards.monthlyRevenue?.toLocaleString() ?? 0}</Text>
        </View>
      </View>

      {/* Today's Checklist */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Action Items Checklist</Text>
          <Text style={styles.progressText}>
            {completedTasks}/{totalTasks} Done
          </Text>
        </View>

        {/* Progress Bar */}
        <View style={styles.progressBarBg}>
          <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
        </View>

        <View style={styles.tasksList}>
          {tasks.length === 0 ? (
            <Text style={styles.emptyText}>All caught up! No tasks left for today.</Text>
          ) : (
            tasks.map(task => (
              <TouchableOpacity
                key={task.id}
                style={styles.taskItem}
                onPress={() => handleToggleTask(task.id)}
              >
                <Ionicons
                  name={task.isDone ? 'checkbox' : 'square-outline'}
                  size={20}
                  color={task.isDone ? '#2563eb' : '#cbd5e1'}
                />
                <Text style={[styles.taskTitle, task.isDone && styles.taskDone]}>
                  {task.title}
                </Text>
              </TouchableOpacity>
            ))
          )}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
    padding: 16,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    marginBottom: 20,
  },
  welcome: {
    fontSize: 14,
    color: '#64748b',
  },
  username: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  card: {
    backgroundColor: '#fff',
    width: '48%',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  shadow: {
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardLabel: {
    fontSize: 10,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    color: '#64748b',
    marginLeft: 6,
    letterSpacing: 0.5,
  },
  cardVal: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 40,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#0f172a',
    flex: 1,
  },
  progressText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#64748b',
  },
  progressBarBg: {
    height: 6,
    backgroundColor: '#f1f5f9',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 16,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#2563eb',
    borderRadius: 3,
  },
  tasksList: {
    marginTop: 8,
  },
  taskItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  taskTitle: {
    fontSize: 13,
    color: '#334155',
    marginLeft: 10,
    fontWeight: '500',
    flex: 1,
  },
  taskDone: {
    textDecorationLine: 'line-through',
    color: '#94a3b8',
  },
  emptyText: {
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'center',
    paddingVertical: 12,
    fontWeight: '500',
  },
});
