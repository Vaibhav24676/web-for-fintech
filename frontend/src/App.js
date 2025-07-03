import React, { useState, useEffect } from 'react';
import './App.css';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const App = () => {
  const [currentTab, setCurrentTab] = useState('data-collection');
  const [customerData, setCustomerData] = useState(null);
  const [consents, setConsents] = useState([]);
  const [partners, setPartners] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [currentCustomerId, setCurrentCustomerId] = useState(null);
  const [notification, setNotification] = useState({ message: '', type: '' });
  const [complianceData, setComplianceData] = useState({
    gdpr: null,
    rbi: null,
    dpdpa: null
  });

  // Customer Data Collection Form
  const [formData, setFormData] = useState({
    full_name: '',
    aadhaar_number: '',
    pan_number: '',
    mobile_number: '',
    email: '',
    address: '',
    district: '',
    state: '',
    pin_code: ''
  });

  // Consent Form
  const [consentForm, setConsentForm] = useState({
    partner_id: '',
    partner_name: '',
    data_types: [],
    purpose: '',
    duration_days: 30
  });

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification({ message: '', type: '' }), 5000);
  };

  const fetchPartners = async () => {
    try {
      const response = await axios.get(`${API}/partners`);
      setPartners(response.data);
    } catch (error) {
      console.error('Error fetching partners:', error);
    }
  };

  const fetchConsents = async (customerId) => {
    try {
      const response = await axios.get(`${API}/consents/${customerId}`);
      setConsents(response.data);
    } catch (error) {
      console.error('Error fetching consents:', error);
    }
  };

  const fetchAuditLogs = async (customerId) => {
    try {
      const response = await axios.get(`${API}/audit-log/${customerId}`);
      setAuditLogs(response.data);
    } catch (error) {
      console.error('Error fetching audit logs:', error);
    }
  };

  const fetchCustomerData = async (customerId) => {
    try {
      const response = await axios.get(`${API}/user-data/${customerId}`);
      setCustomerData(response.data);
    } catch (error) {
      console.error('Error fetching customer data:', error);
    }
  };

  const fetchComplianceData = async (customerId) => {
    try {
      const [gdprResponse, rbiResponse, dpdpaResponse] = await Promise.all([
        axios.get(`${API}/compliance/gdpr-status/${customerId}`),
        axios.get(`${API}/compliance/rbi-status/${customerId}`),
        axios.get(`${API}/compliance/dpdpa-status/${customerId}`)
      ]);
      
      setComplianceData({
        gdpr: gdprResponse.data,
        rbi: rbiResponse.data,
        dpdpa: dpdpaResponse.data
      });
    } catch (error) {
      console.error('Error fetching compliance data:', error);
    }
  };

  const handleFileComplaint = async () => {
    if (!currentCustomerId) {
      showNotification('Please submit customer data first', 'error');
      return;
    }
    
    const complaint = {
      customer_id: currentCustomerId,
      type: 'data_protection',
      category: 'general',
      description: 'General data protection inquiry',
      severity: 'medium',
      contact_method: 'email'
    };
    
    try {
      const response = await axios.post(`${API}/compliance/file-complaint`, complaint);
      showNotification(`Complaint filed successfully! Reference: ${response.data.reference_number}`);
    } catch (error) {
      showNotification('Error filing complaint', 'error');
      console.error('Error:', error);
    }
  };

  const handleViewPrivacyNotice = async () => {
    try {
      const response = await axios.post(`${API}/compliance/privacy-notice`);
      const privacyData = response.data;
      
      // Create a detailed privacy notice popup
      const notice = `
PRIVACY NOTICE - ${privacyData.data_controller.name}

DATA PROCESSING PURPOSES:
${privacyData.data_processing.purposes.map(p => `• ${p}`).join('\n')}

YOUR RIGHTS:
${privacyData.customer_rights.dpdpa.map(r => `• ${r}`).join('\n')}

DATA SECURITY:
• ${privacyData.security_measures.encryption}
• ${privacyData.security_measures.access_controls}
• ${privacyData.security_measures.monitoring}

CONTACT:
Data Protection Officer: ${privacyData.data_controller.dpo_contact}

Last Updated: ${new Date(privacyData.last_updated).toLocaleDateString()}
Version: ${privacyData.version}
      `;
      
      alert(notice);
    } catch (error) {
      showNotification('Error loading privacy notice', 'error');
      console.error('Error:', error);
    }
  };

  useEffect(() => {
    fetchPartners();
  }, []);

  useEffect(() => {
    if (currentCustomerId) {
      fetchConsents(currentCustomerId);
      fetchAuditLogs(currentCustomerId);
      fetchCustomerData(currentCustomerId);
      fetchComplianceData(currentCustomerId);
    }
  }, [currentCustomerId]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmitCustomerData = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post(`${API}/submit-customer-data`, formData);
      setCurrentCustomerId(response.data.id);
      showNotification('Customer data submitted successfully!');
      setCurrentTab('consent-management');
    } catch (error) {
      showNotification('Error submitting customer data', 'error');
      console.error('Error:', error);
    }
  };

  const handleConsentInputChange = (e) => {
    const { name, value } = e.target;
    if (name === 'partner_id') {
      const selectedPartner = partners.find(p => p.id === value);
      setConsentForm(prev => ({ 
        ...prev, 
        partner_id: value,
        partner_name: selectedPartner?.name || ''
      }));
    } else {
      setConsentForm(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleDataTypeToggle = (dataType) => {
    setConsentForm(prev => ({
      ...prev,
      data_types: prev.data_types.includes(dataType)
        ? prev.data_types.filter(dt => dt !== dataType)
        : [...prev.data_types, dataType]
    }));
  };

  const handleSubmitConsent = async (e) => {
    e.preventDefault();
    if (!currentCustomerId) {
      showNotification('Please submit customer data first', 'error');
      return;
    }
    
    try {
      await axios.post(`${API}/consents`, {
        ...consentForm,
        customer_id: currentCustomerId
      });
      showNotification('Consent granted successfully!');
      setConsentForm({
        partner_id: '',
        partner_name: '',
        data_types: [],
        purpose: '',
        duration_days: 30
      });
      fetchConsents(currentCustomerId);
    } catch (error) {
      showNotification('Error granting consent', 'error');
      console.error('Error:', error);
    }
  };

  const handleRevokeConsent = async (consentId) => {
    try {
      await axios.patch(`${API}/consents/${consentId}/revoke`);
      showNotification('Consent revoked successfully!');
      fetchConsents(currentCustomerId);
    } catch (error) {
      showNotification('Error revoking consent', 'error');
      console.error('Error:', error);
    }
  };

  const handleExportData = async () => {
    if (!currentCustomerId) {
      showNotification('No customer data to export', 'error');
      return;
    }
    
    try {
      const response = await axios.get(`${API}/export-data/${currentCustomerId}`);
      const blob = new Blob([JSON.stringify(response.data, null, 2)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `customer_data_${currentCustomerId}.json`;
      a.click();
      showNotification('Data exported successfully!');
    } catch (error) {
      showNotification('Error exporting data', 'error');
      console.error('Error:', error);
    }
  };

  const handleDeleteData = async () => {
    if (!currentCustomerId) {
      showNotification('No customer data to delete', 'error');
      return;
    }
    
    if (window.confirm('Are you sure you want to delete all your data? This action cannot be undone.')) {
      try {
        await axios.delete(`${API}/delete-data/${currentCustomerId}`);
        showNotification('Data deleted successfully!');
        setCurrentCustomerId(null);
        setCustomerData(null);
        setConsents([]);
        setAuditLogs([]);
        setCurrentTab('data-collection');
      } catch (error) {
        showNotification('Error deleting data', 'error');
        console.error('Error:', error);
      }
    }
  };

  const maskAadhaar = (aadhaar) => {
    return aadhaar ? `XXXX-XXXX-${aadhaar.slice(-4)}` : '';
  };

  const maskPAN = (pan) => {
    return pan ? `${pan.slice(0, 3)}XXXXXX${pan.slice(-1)}` : '';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="h-10 w-10 bg-indigo-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-lg">🏦</span>
                </div>
              </div>
              <div className="ml-4">
                <h1 className="text-2xl font-bold text-gray-900">Customer Data Portal</h1>
                <p className="text-sm text-gray-600">Secure Banking Data Management</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-sm text-gray-600">
                {currentCustomerId ? `Customer ID: ${currentCustomerId.slice(0, 8)}...` : 'No Customer'}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Notification */}
      {notification.message && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-2 rounded-lg shadow-lg ${
          notification.type === 'error' ? 'bg-red-500' : 'bg-green-500'
        } text-white`}>
          {notification.message}
        </div>
      )}

      {/* Navigation */}
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            {[
              { id: 'data-collection', label: 'Data Collection', icon: '📝' },
              { id: 'consent-management', label: 'Consent Management', icon: '🔐' },
              { id: 'compliance', label: 'Compliance Center', icon: '⚖️' },
              { id: 'activity-log', label: 'Activity Log', icon: '📊' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setCurrentTab(tab.id)}
                className={`flex items-center px-4 py-4 text-sm font-medium border-b-2 ${
                  currentTab === tab.id
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Data Collection Tab */}
        {currentTab === 'data-collection' && (
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Customer Data Collection</h2>
            <form onSubmit={handleSubmitCustomerData} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Full Name</label>
                  <input
                    type="text"
                    name="full_name"
                    value={formData.full_name}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Aadhaar Number</label>
                  <input
                    type="text"
                    name="aadhaar_number"
                    value={formData.aadhaar_number}
                    onChange={handleInputChange}
                    required
                    placeholder="XXXX-XXXX-XXXX"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">PAN Number</label>
                  <input
                    type="text"
                    name="pan_number"
                    value={formData.pan_number}
                    onChange={handleInputChange}
                    required
                    placeholder="ABCDE1234F"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Mobile Number</label>
                  <input
                    type="tel"
                    name="mobile_number"
                    value={formData.mobile_number}
                    onChange={handleInputChange}
                    required
                    placeholder="9876543210"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">District</label>
                  <input
                    type="text"
                    name="district"
                    value={formData.district}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">State</label>
                  <input
                    type="text"
                    name="state"
                    value={formData.state}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">PIN Code</label>
                  <input
                    type="text"
                    name="pin_code"
                    value={formData.pin_code}
                    onChange={handleInputChange}
                    required
                    placeholder="110001"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Address</label>
                <textarea
                  name="address"
                  value={formData.address}
                  onChange={handleInputChange}
                  required
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <button
                  type="submit"
                  className="w-full bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  Submit Customer Data
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Consent Management Tab */}
        {currentTab === 'consent-management' && (
          <div className="space-y-6">
            {/* Consent Form */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Grant New Consent</h2>
              <form onSubmit={handleSubmitConsent} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Partner</label>
                  <select
                    name="partner_id"
                    value={consentForm.partner_id}
                    onChange={handleConsentInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Select a partner</option>
                    {partners.map(partner => (
                      <option key={partner.id} value={partner.id}>
                        {partner.name} - {partner.description}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Data Types to Share</label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {['full_name', 'aadhaar_number', 'pan_number', 'mobile_number', 'email', 'address'].map(dataType => (
                      <label key={dataType} className="flex items-center">
                        <input
                          type="checkbox"
                          checked={consentForm.data_types.includes(dataType)}
                          onChange={() => handleDataTypeToggle(dataType)}
                          className="mr-2"
                        />
                        <span className="text-sm text-gray-700">{dataType.replace('_', ' ').toUpperCase()}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Purpose</label>
                  <input
                    type="text"
                    name="purpose"
                    value={consentForm.purpose}
                    onChange={handleConsentInputChange}
                    required
                    placeholder="e.g., Loan processing, Credit card application"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Duration (Days)</label>
                  <input
                    type="number"
                    name="duration_days"
                    value={consentForm.duration_days}
                    onChange={handleConsentInputChange}
                    required
                    min="1"
                    max="365"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  Grant Consent
                </button>
              </form>
            </div>

            {/* Active Consents */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Active Consents</h2>
              <div className="space-y-4">
                {consents.filter(consent => consent.is_active).map(consent => (
                  <div key={consent.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-semibold text-gray-900">{consent.partner_name}</h3>
                        <p className="text-sm text-gray-600">Purpose: {consent.purpose}</p>
                        <p className="text-sm text-gray-600">Data Types: {consent.data_types.join(', ')}</p>
                        <p className="text-sm text-gray-600">
                          Expires: {new Date(consent.expires_at).toLocaleDateString()}
                        </p>
                      </div>
                      <button
                        onClick={() => handleRevokeConsent(consent.id)}
                        className="bg-red-600 text-white px-3 py-1 rounded-md hover:bg-red-700 text-sm"
                      >
                        Revoke
                      </button>
                    </div>
                  </div>
                ))}
                {consents.filter(consent => consent.is_active).length === 0 && (
                  <p className="text-gray-500 text-center py-8">No active consents</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Compliance Center Tab */}
        {currentTab === 'compliance' && (
          <div className="space-y-6">
            {/* Compliance Overview */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Compliance Center</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center">
                    <div className="h-8 w-8 bg-green-100 rounded-full flex items-center justify-center">
                      <span className="text-green-600 font-semibold">✓</span>
                    </div>
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-green-800">GDPR Compliant</h3>
                      <p className="text-xs text-green-600">European Data Protection</p>
                    </div>
                  </div>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center">
                    <div className="h-8 w-8 bg-blue-100 rounded-full flex items-center justify-center">
                      <span className="text-blue-600 font-semibold">✓</span>
                    </div>
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-blue-800">RBI Guidelines</h3>
                      <p className="text-xs text-blue-600">Banking Regulations</p>
                    </div>
                  </div>
                </div>
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <div className="flex items-center">
                    <div className="h-8 w-8 bg-purple-100 rounded-full flex items-center justify-center">
                      <span className="text-purple-600 font-semibold">✓</span>
                    </div>
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-purple-800">DPDPA 2023</h3>
                      <p className="text-xs text-purple-600">Indian Data Protection</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* GDPR Rights */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
                🇪🇺 GDPR Rights & Controls
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="border border-gray-200 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 mb-2">Right to Access</h4>
                  <p className="text-sm text-gray-600 mb-3">Request a copy of your personal data</p>
                  <button
                    onClick={handleExportData}
                    className="w-full bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 text-sm"
                  >
                    Download Data Copy
                  </button>
                </div>
                <div className="border border-gray-200 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 mb-2">Right to Rectification</h4>
                  <p className="text-sm text-gray-600 mb-3">Correct inaccurate personal data</p>
                  <button
                    onClick={() => setCurrentTab('data-collection')}
                    className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 text-sm"
                  >
                    Update Data
                  </button>
                </div>
                <div className="border border-gray-200 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 mb-2">Right to Erasure</h4>
                  <p className="text-sm text-gray-600 mb-3">Delete your personal data</p>
                  <button
                    onClick={handleDeleteData}
                    className="w-full bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700 text-sm"
                  >
                    Delete All Data
                  </button>
                </div>
                <div className="border border-gray-200 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 mb-2">Right to Portability</h4>
                  <p className="text-sm text-gray-600 mb-3">Transfer data to another service</p>
                  <button
                    onClick={handleExportData}
                    className="w-full bg-purple-600 text-white py-2 px-4 rounded-md hover:bg-purple-700 text-sm"
                  >
                    Export for Transfer
                  </button>
                </div>
                <div className="border border-gray-200 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 mb-2">Right to Object</h4>
                  <p className="text-sm text-gray-600 mb-3">Object to data processing</p>
                  <button
                    onClick={() => setCurrentTab('consent-management')}
                    className="w-full bg-orange-600 text-white py-2 px-4 rounded-md hover:bg-orange-700 text-sm"
                  >
                    Manage Consents
                  </button>
                </div>
                <div className="border border-gray-200 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 mb-2">Right to Be Informed</h4>
                  <p className="text-sm text-gray-600 mb-3">View privacy notice</p>
                  <button
                    onClick={handleViewPrivacyNotice}
                    className="w-full bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700 text-sm"
                  >
                    View Privacy Notice
                  </button>
                </div>
              </div>
            </div>

            {/* RBI Compliance */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
                🏛️ RBI Banking Compliance
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-semibold text-gray-900 mb-3">KYC Compliance Status</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center p-2 bg-green-50 rounded">
                      <span className="text-sm">Customer Due Diligence (CDD)</span>
                      <span className="text-green-600 text-sm font-medium">✓ Complete</span>
                    </div>
                    <div className="flex justify-between items-center p-2 bg-green-50 rounded">
                      <span className="text-sm">Aadhaar Verification</span>
                      <span className="text-green-600 text-sm font-medium">✓ Verified</span>
                    </div>
                    <div className="flex justify-between items-center p-2 bg-green-50 rounded">
                      <span className="text-sm">PAN Verification</span>
                      <span className="text-green-600 text-sm font-medium">✓ Verified</span>
                    </div>
                    <div className="flex justify-between items-center p-2 bg-yellow-50 rounded">
                      <span className="text-sm">Risk Assessment</span>
                      <span className="text-yellow-600 text-sm font-medium">⚠ Low Risk</span>
                    </div>
                  </div>
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900 mb-3">Data Localization</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center p-2 bg-blue-50 rounded">
                      <span className="text-sm">Data Storage Location</span>
                      <span className="text-blue-600 text-sm font-medium">🇮🇳 India</span>
                    </div>
                    <div className="flex justify-between items-center p-2 bg-blue-50 rounded">
                      <span className="text-sm">Cross-border Transfer</span>
                      <span className="text-blue-600 text-sm font-medium">✓ Compliant</span>
                    </div>
                    <div className="flex justify-between items-center p-2 bg-blue-50 rounded">
                      <span className="text-sm">Encryption Standard</span>
                      <span className="text-blue-600 text-sm font-medium">AES-256</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                <h5 className="font-medium text-gray-900 mb-2">Transaction Monitoring</h5>
                <p className="text-sm text-gray-600">
                  Your transactions are monitored for suspicious activities as per RBI AML guidelines. 
                  Any unusual patterns are flagged for review to ensure financial system integrity.
                </p>
              </div>
            </div>

            {/* DPDPA 2023 Compliance */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
                🇮🇳 DPDPA 2023 - Digital Personal Data Protection
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-semibold text-gray-900 mb-3">Data Principal Rights</h4>
                  <div className="space-y-3">
                    <div className="border-l-4 border-green-500 pl-4">
                      <h5 className="font-medium text-gray-900">Right to Information</h5>
                      <p className="text-sm text-gray-600">You have been informed about data processing purposes</p>
                    </div>
                    <div className="border-l-4 border-blue-500 pl-4">
                      <h5 className="font-medium text-gray-900">Right to Correction</h5>
                      <p className="text-sm text-gray-600">You can correct inaccurate personal data</p>
                    </div>
                    <div className="border-l-4 border-purple-500 pl-4">
                      <h5 className="font-medium text-gray-900">Right to Erasure</h5>
                      <p className="text-sm text-gray-600">You can request deletion of personal data</p>
                    </div>
                    <div className="border-l-4 border-orange-500 pl-4">
                      <h5 className="font-medium text-gray-900">Right to Grievance Redressal</h5>
                      <p className="text-sm text-gray-600">You can file complaints about data processing</p>
                    </div>
                  </div>
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900 mb-3">Consent Management</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center p-2 bg-green-50 rounded">
                      <span className="text-sm">Consent Validity</span>
                      <span className="text-green-600 text-sm font-medium">✓ Valid</span>
                    </div>
                    <div className="flex justify-between items-center p-2 bg-green-50 rounded">
                      <span className="text-sm">Consent Specificity</span>
                      <span className="text-green-600 text-sm font-medium">✓ Granular</span>
                    </div>
                    <div className="flex justify-between items-center p-2 bg-green-50 rounded">
                      <span className="text-sm">Consent Withdrawal</span>
                      <span className="text-green-600 text-sm font-medium">✓ Available</span>
                    </div>
                    <div className="flex justify-between items-center p-2 bg-blue-50 rounded">
                      <span className="text-sm">Data Processing Lawfulness</span>
                      <span className="text-blue-600 text-sm font-medium">✓ Compliant</span>
                    </div>
                  </div>
                  <div className="mt-4">
                    <button
                      onClick={() => setCurrentTab('consent-management')}
                      className="w-full bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700 text-sm"
                    >
                      Review Consent Settings
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Data Processing Transparency */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-4">📊 Data Processing Transparency</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="border border-gray-200 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 mb-3">Processing Purposes</h4>
                  <ul className="text-sm text-gray-600 space-y-1">
                    <li>• Account opening and KYC verification</li>
                    <li>• Risk assessment and fraud prevention</li>
                    <li>• Regulatory compliance reporting</li>
                    <li>• Customer service and support</li>
                    <li>• Product recommendations</li>
                  </ul>
                </div>
                <div className="border border-gray-200 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 mb-3">Data Categories</h4>
                  <ul className="text-sm text-gray-600 space-y-1">
                    <li>• Identity data (Name, Aadhaar, PAN)</li>
                    <li>• Contact data (Phone, Email, Address)</li>
                    <li>• Financial data (Transaction history)</li>
                    <li>• Behavioral data (App usage patterns)</li>
                    <li>• Consent preferences</li>
                  </ul>
                </div>
                <div className="border border-gray-200 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 mb-3">Retention Periods</h4>
                  <ul className="text-sm text-gray-600 space-y-1">
                    <li>• KYC documents: 8 years post closure</li>
                    <li>• Transaction records: 10 years</li>
                    <li>• Consent logs: Duration of relationship</li>
                    <li>• Audit trails: 7 years</li>
                    <li>• Marketing preferences: Until withdrawn</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Regulatory Reporting */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-4">📋 Regulatory Reporting Status</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-semibold text-gray-900 mb-3">RBI Reporting</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center p-2 bg-green-50 rounded">
                      <span className="text-sm">CRILC Reporting</span>
                      <span className="text-green-600 text-sm font-medium">✓ Submitted</span>
                    </div>
                    <div className="flex justify-between items-center p-2 bg-green-50 rounded">
                      <span className="text-sm">AML/CFT Compliance</span>
                      <span className="text-green-600 text-sm font-medium">✓ Compliant</span>
                    </div>
                    <div className="flex justify-between items-center p-2 bg-blue-50 rounded">
                      <span className="text-sm">Suspicious Transaction Monitoring</span>
                      <span className="text-blue-600 text-sm font-medium">🔍 Active</span>
                    </div>
                  </div>
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900 mb-3">Data Protection Authority</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center p-2 bg-purple-50 rounded">
                      <span className="text-sm">DPDPA Compliance</span>
                      <span className="text-purple-600 text-sm font-medium">✓ Registered</span>
                    </div>
                    <div className="flex justify-between items-center p-2 bg-purple-50 rounded">
                      <span className="text-sm">Data Breach Protocols</span>
                      <span className="text-purple-600 text-sm font-medium">✓ Established</span>
                    </div>
                    <div className="flex justify-between items-center p-2 bg-yellow-50 rounded">
                      <span className="text-sm">Privacy Impact Assessments</span>
                      <span className="text-yellow-600 text-sm font-medium">📋 Regular</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Grievance Redressal */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-4">🛡️ Grievance Redressal & Support</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="border border-gray-200 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 mb-3">Data Protection Officer</h4>
                  <div className="space-y-2 text-sm text-gray-600">
                    <p><strong>Email:</strong> dpo@bank.com</p>
                    <p><strong>Phone:</strong> 1800-XXX-XXXX</p>
                    <p><strong>Address:</strong> Data Protection Office, Bank Headquarters</p>
                    <p><strong>Response Time:</strong> 30 days (as per DPDPA)</p>
                  </div>
                  <button className="mt-3 w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 text-sm">
                    File Complaint
                  </button>
                </div>
                <div className="border border-gray-200 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 mb-3">Regulatory Escalation</h4>
                  <div className="space-y-2 text-sm text-gray-600">
                    <p><strong>RBI Ombudsman:</strong> rbiombudsman@rbi.org.in</p>
                    <p><strong>Data Protection Board:</strong> grievances@dpb.gov.in</p>
                    <p><strong>Consumer Forum:</strong> consumeraffairs.gov.in</p>
                    <p><strong>Cyber Crime Cell:</strong> cybercrime.gov.in</p>
                  </div>
                  <button className="mt-3 w-full bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700 text-sm">
                    Escalate to Regulator
                  </button>
                </div>
              </div>
            </div>

            {/* Data Inventory */}
            {customerData && (
              <div className="bg-white rounded-lg shadow-lg p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-6">🗄️ Your Data Inventory</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-3">Personal Information</h3>
                    <div className="space-y-2">
                      <p className="text-sm"><strong>Name:</strong> {customerData.full_name}</p>
                      <p className="text-sm"><strong>Email:</strong> {customerData.email}</p>
                      <p className="text-sm"><strong>Aadhaar:</strong> {maskAadhaar(customerData.aadhaar_number)}</p>
                      <p className="text-sm"><strong>PAN:</strong> {maskPAN(customerData.pan_number)}</p>
                    </div>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-3">Location Information</h3>
                    <div className="space-y-2">
                      <p className="text-sm"><strong>District:</strong> {customerData.district}</p>
                      <p className="text-sm"><strong>State:</strong> {customerData.state}</p>
                      <p className="text-sm"><strong>PIN:</strong> {customerData.pin_code}</p>
                    </div>
                  </div>
                </div>
                <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                  <h4 className="font-medium text-blue-900 mb-2">Data Security Notice</h4>
                  <p className="text-sm text-blue-800">
                    Your sensitive data is encrypted using AES-256 encryption with customer-specific keys. 
                    All data transfers are logged in an immutable blockchain for audit purposes. 
                    Your data is processed only with your explicit consent and for specified purposes.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Activity Log Tab */}
        {currentTab === 'activity-log' && (
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Activity Log</h2>
            <div className="space-y-4">
              {auditLogs.map(log => (
                <div key={log.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-semibold text-gray-900">{log.action.replace('_', ' ').toUpperCase()}</h3>
                      <p className="text-sm text-gray-600">
                        {new Date(log.timestamp).toLocaleString()}
                      </p>
                      <p className="text-sm text-gray-600 mt-2">
                        {JSON.stringify(log.details, null, 2)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
              {auditLogs.length === 0 && (
                <p className="text-gray-500 text-center py-8">No activity logs</p>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;