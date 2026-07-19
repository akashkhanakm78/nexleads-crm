import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, FlatList, TextInput, ActivityIndicator, RefreshControl } from 'react-native';
import { useAuth, BACKEND_URL } from '../../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';

interface Meeting {
  id: string;
  title: string;
  description: string | null;
  startTime: string;
  endTime: string;
  lead: { title: string } | null;
}

export default function MeetingsScreen() {
  const { fetchWithAuth } = useAuth();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');

  const loadMeetings = async () => {
    try {
      const res = await fetchWithAuth(`${BACKEND_URL}/api/meetings`);
      if (res.ok) {
        setMeetings(await res.json());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadMeetings();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    loadMeetings();
  };

  const filtered = meetings.filter(m =>
    m.title.toLowerCase().includes(search.toLowerCase()) ||
    (m.lead?.title && m.lead.title.toLowerCase().includes(search.toLowerCase()))
  );

  const formatTime = (isoString: string) => {
    const d = new Date(isoString);
    return `${d.toLocaleDateString()} at ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  };

  return (
    <View style={styles.container}>
      {/* Search Header */}
      <View style={styles.header}>
        <TextInput
          placeholder="Search meetings by title or lead..."
          value={search}
          onChangeText={setSearch}
          style={styles.searchInput}
        />
      </View>

      {/* Meetings List */}
      {loading ? (
        <ActivityIndicator size="large" color="#2563eb" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={['#2563eb']} />}
          renderItem={({ item }) => (
            <View style={styles.meetingCard}>
              <Text style={styles.meetingTitle}>{item.title}</Text>
              {item.lead && (
                <View style={styles.leadRow}>
                  <Ionicons name="link-outline" size={14} color="#64748b" />
                  <Text style={styles.leadTitle}>{item.lead.title}</Text>
                </View>
              )}
              <Text style={styles.meetingTime}>Start: {formatTime(item.startTime)}</Text>
              <Text style={styles.meetingTime}>End: {formatTime(item.endTime)}</Text>
              {item.description && (
                <Text style={styles.meetingDesc}>{item.description}</Text>
              )}
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  searchInput: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 10,
    backgroundColor: '#f8fafc',
  },
  meetingCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 12,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  meetingTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  leadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
  },
  leadTitle: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
  },
  meetingTime: {
    fontSize: 12,
    color: '#334155',
    marginTop: 6,
    fontWeight: '500',
  },
  meetingDesc: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 8,
  },
});
