import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, FlatList, TextInput, TouchableOpacity, Modal, ActivityIndicator, Alert, ScrollView, Linking, RefreshControl } from 'react-native';
import { useAuth, BACKEND_URL } from '../../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as XLSX from 'xlsx';

interface Contact {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  status: string;
  remarks: string | null;
  company: { id: string; name: string };
}

interface Company {
  id: string;
  name: string;
}

export default function ContactsScreen() {
  const { fetchWithAuth, addSocketListener } = useAuth();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Search & Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [companyFilter, setCompanyFilter] = useState('ALL');

  // Pagination / Slicing
  const [page, setPage] = useState(1);
  const pageSize = 15;

  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);

  // Form Fields
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [companySearch, setCompanySearch] = useState('');
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [isCompanyDropdownOpen, setIsCompanyDropdownOpen] = useState(false);
  const [status, setStatus] = useState('No action');
  const [remarks, setRemarks] = useState('');

  // Bulk Import
  const [isImportPreviewOpen, setIsImportPreviewOpen] = useState(false);
  const [parsedContacts, setParsedContacts] = useState<{ company_name: string; phone: string }[]>([]);
  const [isImporting, setIsImporting] = useState(false);

  const loadData = async () => {
    try {
      const contactsRes = await fetchWithAuth(`${BACKEND_URL}/api/contacts`);
      const companiesRes = await fetchWithAuth(`${BACKEND_URL}/api/companies`);
      if (contactsRes.ok && companiesRes.ok) {
        setContacts(await contactsRes.json());
        setCompanies(await companiesRes.json());
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
    loadData();
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const removeListener = addSocketListener((msg) => {
      if (msg.type === 'CONTACTS_UPDATE') {
        loadData();
      }
    });
    return removeListener;
  }, []);

  const handleAddContact = async () => {
    const companyInput = selectedCompany ? selectedCompany.id : companySearch;
    if (!phone || !companyInput) {
      Alert.alert('Error', 'Phone and Company are required');
      return;
    }

    try {
      const res = await fetchWithAuth(`${BACKEND_URL}/api/contacts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: firstName || undefined,
          lastName: lastName || undefined,
          email: email || undefined,
          phone,
          companyId: companyInput,
          status,
          remarks: remarks || undefined
        })
      });

      if (res.ok) {
        setIsModalOpen(false);
        setStep(1);
        setFirstName('');
        setLastName('');
        setEmail('');
        setPhone('');
        setCompanySearch('');
        setSelectedCompany(null);
        setStatus('No action');
        setRemarks('');
        loadData();
      } else {
        Alert.alert('Failed', 'Could not create contact');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleTriggerCall = async (contact: Contact) => {
    try {
      if (contact.phone) {
        Linking.openURL(`tel:${contact.phone}`).catch(() => {
          Alert.alert('Error', 'Unable to initiate call on this device.');
        });
      }
      const res = await fetchWithAuth(`${BACKEND_URL}/api/contacts/${contact.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'Calling',
          remarks: contact.remarks || 'Initiated outbound call action'
        })
      });
      if (res.ok) {
        loadData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleImportExcel = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-excel'
        ]
      });
      if (result.canceled || !result.assets || result.assets.length === 0) return;

      const fileUri = result.assets[0].uri;
      const base64 = await FileSystem.readAsStringAsync(fileUri, {
        encoding: 'base64'
      });

      const wb = XLSX.read(base64, { type: 'base64' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data: any[] = XLSX.utils.sheet_to_json(ws);

      const contactsToUpload = data
        .map(row => ({
          company_name: String(row.company_name || row['company_name'] || row.Company || row.company || '').trim(),
          phone: String(row.phone || row['phone'] || row.Phone || row.Number || row.number || '').trim()
        }))
        .filter(c => c.company_name && c.phone);

      if (contactsToUpload.length === 0) {
        Alert.alert('No valid contacts found', 'Verify headers include company_name and phone.');
        return;
      }

      setParsedContacts(contactsToUpload);
      setIsImportPreviewOpen(true);
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to read file.');
    }
  };

  const handleConfirmImport = async () => {
    setIsImporting(true);
    try {
      const res = await fetchWithAuth(`${BACKEND_URL}/api/contacts/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contacts: parsedContacts })
      });

      if (res.ok) {
        Alert.alert('Success', 'Successfully imported contacts!');
        setIsImportPreviewOpen(false);
        setParsedContacts([]);
        loadData();
      } else {
        Alert.alert('Failed', 'Bulk import failed');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsImporting(false);
    }
  };

  const filtered = contacts.filter(c => {
    const fullName = `${c.firstName || ''} ${c.lastName || ''}`.toLowerCase();
    const matchesSearch = fullName.includes(search.toLowerCase()) || (c.phone && c.phone.includes(search));
    const matchesStatus = statusFilter === 'ALL' || c.status === statusFilter;
    const matchesCompany = companyFilter === 'ALL' || c.company?.id === companyFilter;
    return matchesSearch && matchesStatus && matchesCompany;
  });

  const totalPages = Math.ceil(filtered.length / pageSize);
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, companyFilter]);

  const getStatusColor = (s: string) => {
    switch (s) {
      case 'No action': return '#64748b';
      case 'Ignore': return '#ef4444';
      case 'Not Answer': return '#f59e0b';
      case 'Calling': return '#3b82f6';
      default: return '#10b981';
    }
  };

  const matchingCompanies = companies.filter(c =>
    c.name.toLowerCase().includes(companySearch.toLowerCase())
  );

  return (
    <View style={styles.container}>
      {/* Search and Filters Header */}
      <View style={styles.header}>
        <TextInput
          placeholder="Search by name or number..."
          value={search}
          onChangeText={setSearch}
          style={styles.searchInput}
        />
        <View style={styles.buttonRow}>
          <TouchableOpacity style={styles.actionBtn} onPress={handleImportExcel}>
            <Ionicons name="document-text-outline" size={16} color="#10b981" />
            <Text style={[styles.actionBtnTxt, { color: '#10b981' }]}>Import Excel</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#2563eb' }]} onPress={() => setIsModalOpen(true)}>
            <Ionicons name="person-add-outline" size={16} color="#fff" />
            <Text style={[styles.actionBtnTxt, { color: '#fff' }]}>Add Contact</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Contacts List */}
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
          renderItem={({ item }) => {
            const name = [item.firstName, item.lastName].filter(Boolean).join(' ') || item.company?.name;
            return (
              <View style={styles.contactCard}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.contactName}>{name}</Text>
                  <Text style={styles.contactCompany}>{item.company?.name || 'Independent'}</Text>
                  <Text style={styles.contactPhone}>{item.phone}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '15' }]}>
                    <Text style={[styles.statusBadgeTxt, { color: getStatusColor(item.status) }]}>{item.status}</Text>
                  </View>
                </View>
                <TouchableOpacity style={styles.callBtn} onPress={() => handleTriggerCall(item)}>
                  <Ionicons name="call" size={18} color="#fff" />
                </TouchableOpacity>
              </View>
            );
          }}
        />
      )}

      {/* 2-Step modal */}
      <Modal visible={isModalOpen} animationType="slide">
        <View style={styles.modalContainer}>
          <Text style={styles.modalTitle}>Create Contact (Step {step} of 2)</Text>
          {step === 1 ? (
            <ScrollView style={{ flex: 1, width: '100%' }}>
              <Text style={styles.label}>Phone Number *</Text>
              <TextInput style={styles.input} placeholder="+91..." value={phone} onChangeText={setPhone} keyboardType="phone-pad" />

              <Text style={styles.label}>Company *</Text>
              <TextInput
                style={styles.input}
                placeholder="Search/type company..."
                value={selectedCompany ? selectedCompany.name : companySearch}
                onChangeText={txt => {
                  setSelectedCompany(null);
                  setCompanySearch(txt);
                  setIsCompanyDropdownOpen(true);
                }}
              />

              {isCompanyDropdownOpen && companySearch.length > 0 && (
                <View style={styles.dropdown}>
                  {matchingCompanies.map(c => (
                    <TouchableOpacity
                      key={c.id}
                      style={styles.dropdownItem}
                      onPress={() => {
                        setSelectedCompany(c);
                        setIsCompanyDropdownOpen(false);
                      }}
                    >
                      <Text>{c.name}</Text>
                    </TouchableOpacity>
                  ))}
                  {!companies.some(c => c.name.toLowerCase() === companySearch.toLowerCase()) && (
                    <TouchableOpacity
                      style={styles.dropdownItem}
                      onPress={() => setIsCompanyDropdownOpen(false)}
                    >
                      <Text style={{ color: '#2563eb' }}>Create new company: "{companySearch}"</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}

              <Text style={styles.label}>First Name</Text>
              <TextInput style={styles.input} placeholder="Optional" value={firstName} onChangeText={setFirstName} />
              <Text style={styles.label}>Last Name</Text>
              <TextInput style={styles.input} placeholder="Optional" value={lastName} onChangeText={setLastName} />
              <Text style={styles.label}>Email</Text>
              <TextInput style={styles.input} placeholder="Optional" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />

              <View style={styles.modalBtnRow}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setIsModalOpen(false)}>
                  <Text>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.nextBtn} onPress={() => setStep(2)}>
                  <Text style={{ color: '#fff', fontWeight: 'bold' }}>Next</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          ) : (
            <View style={{ width: '100%' }}>
              <Text style={styles.label}>Calling Status</Text>
              <TextInput style={styles.input} value={status} onChangeText={setStatus} placeholder="No action, Calling, Won, etc." />

              <Text style={styles.label}>Remarks</Text>
              <TextInput style={[styles.input, { height: 100 }]} multiline placeholder="Log initial thoughts..." value={remarks} onChangeText={setRemarks} />

              <View style={styles.modalBtnRow}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setStep(1)}>
                  <Text>Back</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.nextBtn} onPress={handleAddContact}>
                  <Text style={{ color: '#fff', fontWeight: 'bold' }}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </Modal>

      {/* Import Preview Modal */}
      <Modal visible={isImportPreviewOpen} animationType="fade">
        <View style={styles.modalContainer}>
          <Text style={styles.modalTitle}>Excel Import Preview ({parsedContacts.length} Rows)</Text>
          <ScrollView style={{ flex: 1, width: '100%', marginVertical: 10 }}>
            {parsedContacts.map((c, i) => (
              <View key={i} style={styles.previewRow}>
                <Text style={{ fontWeight: 'bold' }}>{c.company_name}</Text>
                <Text style={{ color: '#64748b' }}>{c.phone}</Text>
              </View>
            ))}
          </ScrollView>
          <View style={styles.modalBtnRow}>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setIsImportPreviewOpen(false)}>
              <Text>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.nextBtn, { backgroundColor: '#10b981' }]} onPress={handleConfirmImport} disabled={isImporting}>
              {isImporting ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: 'bold' }}>Upload</Text>}
            </TouchableOpacity>
          </View>
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
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  actionBtnTxt: {
    marginLeft: 6,
    fontSize: 12,
    fontWeight: 'bold',
  },
  contactCard: {
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
  contactName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  contactCompany: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
    fontWeight: '600',
  },
  contactPhone: {
    fontSize: 12,
    color: '#334155',
    marginTop: 4,
    fontWeight: 'bold',
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 99,
    marginTop: 8,
  },
  statusBadgeTxt: {
    fontSize: 9,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  callBtn: {
    backgroundColor: '#2563eb',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  modalContainer: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
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
    width: '100%',
    backgroundColor: '#f8fafc',
  },
  dropdown: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    width: '100%',
    maxHeight: 120,
  },
  dropdownItem: {
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  modalBtnRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 24,
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
  nextBtn: {
    flex: 1,
    backgroundColor: '#2563eb',
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  previewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
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
