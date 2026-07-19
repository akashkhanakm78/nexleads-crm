import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ActivityIndicator, Alert, ScrollView, Modal, TextInput, RefreshControl } from 'react-native';
import { useAuth, BACKEND_URL } from '../../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';

interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
}

export default function SettingsScreen() {
  const { fetchWithAuth, user: loggedUser, logout } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // User creation state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState('VIEWER');
  const [creating, setCreating] = useState(false);

  const loadUsers = async () => {
    try {
      const res = await fetchWithAuth(`${BACKEND_URL}/api/users`);
      if (res.ok) {
        setUsers(await res.json());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    loadUsers();
  };

  const handleRoleChange = async (userId: string, targetRole: string) => {
    try {
      // Optimistic update
      setUsers(prev =>
        prev.map(u => (u.id === userId ? { ...u, role: targetRole } : u))
      );

      const res = await fetchWithAuth(`${BACKEND_URL}/api/users/${userId}/role`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: targetRole })
      });

      if (!res.ok) {
        loadUsers();
        Alert.alert('Error', 'Failed to update user role.');
      }
    } catch (e) {
      console.error(e);
      loadUsers();
    }
  };

  const handleCreateUser = async () => {
    if (!newName || !newEmail || !newPassword) {
      Alert.alert('Error', 'Please fill in all user credentials.');
      return;
    }

    setCreating(true);
    try {
      const res = await fetchWithAuth(`${BACKEND_URL}/api/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName,
          email: newEmail,
          password: newPassword,
          role: newRole
        })
      });

      if (res.ok) {
        Alert.alert('Success', 'User created successfully!');
        setIsCreateModalOpen(false);
        setNewName('');
        setNewEmail('');
        setNewPassword('');
        setNewRole('VIEWER');
        loadUsers();
      } else {
        const err = await res.json();
        Alert.alert('Failed', err.error || 'Could not create user.');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setCreating(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out of the workspace?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: logout }
    ]);
  };

  const isAdmin = loggedUser?.role === 'ADMIN' || loggedUser?.role === 'SUPER_ADMIN';

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          colors={['#2563eb']}
          tintColor="#2563eb"
        />
      }
    >
      {/* Session details */}
      <View style={styles.card}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
          <Ionicons name="person-circle-outline" size={40} color="#2563eb" />
          <View style={{ marginLeft: 12 }}>
            <Text style={styles.profileName}>{loggedUser?.name || 'Workspace Member'}</Text>
            <Text style={styles.profileEmail}>{loggedUser?.email || '-'}</Text>
          </View>
        </View>
        <View style={styles.badgeRow}>
          <Text style={styles.badgeLabel}>Active Role:</Text>
          <Text style={styles.badgeVal}>{loggedUser?.role || 'VIEWER'}</Text>
        </View>

        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={18} color="#fff" />
          <Text style={styles.logoutBtnTxt}>Sign Out</Text>
        </TouchableOpacity>
      </View>

      {/* Workspace Team Header with Add User option */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Workspace Team Members</Text>
        {isAdmin && (
          <TouchableOpacity style={styles.createBtn} onPress={() => setIsCreateModalOpen(true)}>
            <Ionicons name="add-circle" size={18} color="#2563eb" />
            <Text style={styles.createBtnTxt}>Add User</Text>
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <ActivityIndicator size="small" color="#2563eb" style={{ marginTop: 20 }} />
      ) : (
        <View style={{ marginBottom: 40 }}>
          {users.map(u => (
            <View key={u.id} style={styles.userRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.userName}>{u.name}</Text>
                <Text style={styles.userEmail}>{u.email}</Text>
                <Text style={styles.userRole}>Role: {u.role}</Text>
              </View>

              {isAdmin && u.id !== loggedUser?.id && (
                <View style={styles.rolePickerRow}>
                  {['ADMIN', 'SALES_MANAGER', 'SALES_EXECUTIVE', 'VIEWER'].map(r => (
                    <TouchableOpacity
                      key={r}
                      style={[styles.roleMiniBtn, u.role === r && styles.roleMiniBtnActive]}
                      onPress={() => handleRoleChange(u.id, r)}
                    >
                      <Text style={[styles.roleMiniBtnTxt, u.role === r && styles.roleMiniBtnTxtActive]}>
                        {r.split('_')[0]}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          ))}
        </View>
      )}

      {/* Create User Modal */}
      <Modal visible={isCreateModalOpen} animationType="slide">
        <View style={styles.modalContainer}>
          <Text style={styles.modalTitle}>Create Workspace User</Text>
          <ScrollView style={{ width: '100%' }}>
            <Text style={styles.label}>Full Name *</Text>
            <TextInput style={styles.input} placeholder="e.g. Richard Hendricks" value={newName} onChangeText={setNewName} />

            <Text style={styles.label}>Email Address *</Text>
            <TextInput style={styles.input} placeholder="e.g. richard@piedpiper.com" value={newEmail} onChangeText={setNewEmail} keyboardType="email-address" autoCapitalize="none" />

            <Text style={styles.label}>Password *</Text>
            <TextInput style={styles.input} placeholder="e.g. Secret123" value={newPassword} onChangeText={setNewPassword} secureTextEntry />

            <Text style={styles.label}>Workspace Role *</Text>
            <View style={styles.roleSelectionRow}>
              {['ADMIN', 'SALES_MANAGER', 'SALES_EXECUTIVE', 'VIEWER'].map(r => (
                <TouchableOpacity
                  key={r}
                  style={[styles.roleTab, newRole === r && styles.roleTabActive]}
                  onPress={() => setNewRole(r)}
                >
                  <Text style={[styles.roleTabTxt, newRole === r && styles.roleTabTxtActive]}>
                    {r.replace('_', ' ')}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.btnRow}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setIsCreateModalOpen(false)} disabled={creating}>
                <Text>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleCreateUser} disabled={creating}>
                {creating ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: 'bold' }}>Create</Text>}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
    padding: 16,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 24,
  },
  profileName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  profileEmail: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 12,
  },
  badgeLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#64748b',
  },
  badgeVal: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#2563eb',
    marginLeft: 6,
  },
  logoutBtn: {
    backgroundColor: '#ef4444',
    borderRadius: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 18,
    gap: 6,
  },
  logoutBtnTxt: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 13,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  sectionTitle: {
    fontSize: 12,
    textTransform: 'uppercase',
    fontWeight: '700',
    color: '#64748b',
    letterSpacing: 0.5,
  },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  createBtnTxt: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#2563eb',
  },
  userRow: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 12,
  },
  userName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  userEmail: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  userRole: {
    fontSize: 11,
    color: '#3b82f6',
    fontWeight: '600',
    marginTop: 4,
  },
  rolePickerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 12,
    gap: 6,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 12,
  },
  roleMiniBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#f1f5f9',
  },
  roleMiniBtnActive: {
    backgroundColor: '#2563eb',
  },
  roleMiniBtnTxt: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#64748b',
  },
  roleMiniBtnTxtActive: {
    color: '#fff',
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
    textAlign: 'center',
  },
  label: {
    fontSize: 11,
    textTransform: 'uppercase',
    fontWeight: '700',
    color: '#64748b',
    marginBottom: 6,
    marginTop: 14,
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
  roleSelectionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  roleTab: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
  },
  roleTabActive: {
    backgroundColor: '#2563eb',
  },
  roleTabTxt: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#64748b',
    textTransform: 'capitalize',
  },
  roleTabTxtActive: {
    color: '#fff',
  },
  btnRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 28,
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
});
