import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, FlatList, TextInput, TouchableOpacity, ActivityIndicator, Alert, Modal, ScrollView, Linking, RefreshControl } from 'react-native';
import { useAuth, BACKEND_URL } from '../../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';

interface Lead {
  id: string;
  title: string;
  value: number | null;
  status: string;
  priority: string;
  company: { name: string } | null;
  contact: { phone: string | null; email: string | null } | null;
}

export default function LeadsScreen() {
  const { fetchWithAuth, addSocketListener } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Search & Filter
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  
  // Meeting Schedule inside Leads
  const [isMeetingModalOpen, setIsMeetingModalOpen] = useState(false);
  const [selectedLeadId, setSelectedLeadId] = useState('');
  const [meetingTitle, setMeetingTitle] = useState('');
  const [meetingStart, setMeetingStart] = useState('');
  const [meetingEnd, setMeetingEnd] = useState('');
  const [meetingDesc, setMeetingDesc] = useState('');

  const loadLeads = async () => {
    try {
      const res = await fetchWithAuth(`${BACKEND_URL}/api/leads`);
      if (res.ok) {
        setLeads(await res.json());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadLeads();
  };

  useEffect(() => {
    loadLeads();
  }, []);

  useEffect(() => {
    const removeListener = addSocketListener((msg) => {
      // Refresh leads when leads change OR when contact status changes (triggers lead promotion)
      if (msg.type === 'LEADS_UPDATE' || msg.type === 'CONTACTS_UPDATE') {
        loadLeads();
      }
    });
    return removeListener;
  }, []);

  const handleCall = async (leadId: string, phone: string) => {
    try {
      if (phone) {
        Linking.openURL(`tel:${phone}`).catch(() => {
          Alert.alert('Error', 'Unable to initiate call on this device.');
        });
      }
      await fetchWithAuth(`${BACKEND_URL}/api/leads/${leadId}/activities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'CALL',
          content: 'Initiated outbound call to contact.'
        })
      });
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreateMeeting = async () => {
    if (!meetingTitle || !meetingStart || !meetingEnd) {
      Alert.alert('Error', 'Please fill in all meeting fields.');
      return;
    }
    try {
      const res = await fetchWithAuth(`${BACKEND_URL}/api/meetings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: meetingTitle,
          description: meetingDesc || null,
          startTime: new Date(meetingStart).toISOString(),
          endTime: new Date(meetingEnd).toISOString(),
          leadId: selectedLeadId
        })
      });

      if (res.ok) {
        Alert.alert('Success', 'Meeting scheduled successfully!');
        setIsMeetingModalOpen(false);
        setMeetingTitle('');
        setMeetingStart('');
        setMeetingEnd('');
        setMeetingDesc('');
      } else {
        Alert.alert('Failed', 'Could not schedule meeting.');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const [page, setPage] = useState(1);
  const pageSize = 15;

  const filtered = leads.filter(l => {
    const matchesSearch = l.title.toLowerCase().includes(search.toLowerCase()) || 
      (l.company?.name && l.company.name.toLowerCase().includes(search.toLowerCase()));
    const matchesStatus = statusFilter === 'ALL' || l.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalPages = Math.ceil(filtered.length / pageSize);
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter]);

  const getPriorityColor = (p: string) => {
    switch (p) {
      case 'HIGH': return '#ef4444';
      case 'MEDIUM': return '#f59e0b';
      default: return '#64748b';
    }
  };

  return (
    <View style={styles.container}>
      {/* Search Header */}
      <View style={styles.header}>
        <TextInput
          placeholder="Search leads..."
          value={search}
          onChangeText={setSearch}
          style={styles.searchInput}
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
          {['ALL', 'NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST'].map(st => (
            <TouchableOpacity
              key={st}
              style={[styles.filterTab, statusFilter === st && styles.activeFilterTab]}
              onPress={() => setStatusFilter(st)}
            >
              <Text style={[styles.filterTabTxt, statusFilter === st && styles.activeFilterTabTxt]}>
                {st}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Leads list */}
      {loading ? (
        <ActivityIndicator size="large" color="#2563eb" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={paginated}
          keyExtractor={item => item.id}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={['#2563eb']}
              tintColor="#2563eb"
            />
          }
          ListFooterComponent={() => {
            if (totalPages <= 1) return <View style={{ height: 40 }} />;
            return (
              <View style={styles.paginationRow}>
                <Text style={styles.paginationText}>Page {page} of {totalPages}</Text>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <TouchableOpacity
                    disabled={page === 1}
                    onPress={() => setPage(p => Math.max(p - 1, 1))}
                    style={[styles.pageBtn, page === 1 && { opacity: 0.4 }]}
                  >
                    <Text style={styles.pageBtnTxt}>Prev</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    disabled={page === totalPages}
                    onPress={() => setPage(p => Math.min(p + 1, totalPages))}
                    style={[styles.pageBtn, page === totalPages && { opacity: 0.4 }]}
                  >
                    <Text style={styles.pageBtnTxt}>Next</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          }}
          renderItem={({ item }) => (
            <View style={styles.leadCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.leadTitle}>{item.title}</Text>
                <Text style={styles.leadComp}>{item.company?.name || 'Independent'}</Text>
                <Text style={styles.leadVal}>Value: ₹{item.value?.toLocaleString() || '-'}</Text>
                <View style={styles.badgeRow}>
                  <View style={[styles.badge, { backgroundColor: getPriorityColor(item.priority) + '15' }]}>
                    <Text style={[styles.badgeTxt, { color: getPriorityColor(item.priority) }]}>{item.priority}</Text>
                  </View>
                  <View style={[styles.badge, { backgroundColor: '#3b82f615' }]}>
                    <Text style={[styles.badgeTxt, { color: '#3b82f6' }]}>{item.status}</Text>
                  </View>
                </View>
              </View>

              <View style={styles.actionCol}>
                {item.contact?.phone && (
                  <TouchableOpacity style={[styles.circleBtn, { backgroundColor: '#2563eb' }]} onPress={() => handleCall(item.id, item.contact!.phone!)}>
                    <Ionicons name="call" size={16} color="#fff" />
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={[styles.circleBtn, { backgroundColor: '#10b981' }]}
                  onPress={() => {
                    setSelectedLeadId(item.id);
                    setMeetingTitle(`Sync: ${item.title}`);
                    setIsMeetingModalOpen(true);
                  }}
                >
                  <Ionicons name="calendar" size={16} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      )}

      {/* Schedule Meeting Modal */}
      <Modal visible={isMeetingModalOpen} animationType="slide">
        <View style={styles.modalContainer}>
          <Text style={styles.modalTitle}>Schedule Meeting</Text>
          <ScrollView style={{ width: '100%' }}>
            <Text style={styles.label}>Meeting Title</Text>
            <TextInput style={styles.input} value={meetingTitle} onChangeText={setMeetingTitle} />

            <Text style={styles.label}>Start Time (YYYY-MM-DD HH:MM)</Text>
            <TextInput style={styles.input} placeholder="e.g. 2026-07-20 10:00" value={meetingStart} onChangeText={setMeetingStart} />

            <Text style={styles.label}>End Time (YYYY-MM-DD HH:MM)</Text>
            <TextInput style={styles.input} placeholder="e.g. 2026-07-20 11:00" value={meetingEnd} onChangeText={setMeetingEnd} />

            <Text style={styles.label}>Description</Text>
            <TextInput style={[styles.input, { height: 80 }]} multiline value={meetingDesc} onChangeText={setMeetingDesc} />

            <View style={styles.btnRow}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setIsMeetingModalOpen(false)}>
                <Text>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleCreateMeeting}>
                <Text style={{ color: '#fff', fontWeight: 'bold' }}>Schedule</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>
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
    marginBottom: 10,
  },
  filterRow: {
    flexDirection: 'row',
  },
  filterTab: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    marginRight: 8,
  },
  activeFilterTab: {
    backgroundColor: '#2563eb',
  },
  filterTabTxt: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#64748b',
  },
  activeFilterTabTxt: {
    color: '#fff',
  },
  leadCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 12,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    flexDirection: 'row',
    alignItems: 'center',
  },
  leadTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  leadComp: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
    fontWeight: '600',
  },
  leadVal: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#0f172a',
    marginTop: 6,
  },
  badgeRow: {
    flexDirection: 'row',
    marginTop: 8,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 99,
    marginRight: 6,
  },
  badgeTxt: {
    fontSize: 9,
    fontWeight: 'bold',
  },
  actionCol: {
    justifyContent: 'center',
    gap: 8,
  },
  circleBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    flex: 1,
    padding: 24,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 20,
  },
  label: {
    fontSize: 11,
    textTransform: 'uppercase',
    fontWeight: '700',
    color: '#64748b',
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    backgroundColor: '#f8fafc',
    width: '100%',
  },
  btnRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 24,
    width: '100%',
  },
  cancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginRight: 12,
  },
  saveBtn: {
    flex: 1,
    backgroundColor: '#10b981',
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  paginationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    backgroundColor: '#fff',
    marginTop: 10,
    marginBottom: 30,
  },
  paginationText: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: 'bold',
  },
  pageBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
  },
  pageBtnTxt: {
    fontSize: 11,
    color: '#334155',
    fontWeight: 'bold',
  },
});
