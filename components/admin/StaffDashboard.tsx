'use client';

import React, { useState, useEffect } from 'react';
import { AgreementCase, CaseStatus } from '@/types';
import { calculateTotalAgreementFee } from '@/lib/calculator';
import { supabase } from '@/lib/supabaseClient';
import {
  FileSpreadsheet,
  FileText,
  Eye,
  Download,
  Plus,
  RefreshCw,
  Search,
  Building,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  KeyRound,
  LogOut,
  Edit,
  Save,
  Check,
} from 'lucide-react';

export default function StaffDashboard() {
  // Staff Auth State
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [emailInput, setEmailInput] = useState<string>('');
  const [passwordInput, setPasswordInput] = useState<string>('');
  const [loginError, setLoginError] = useState<string>('');
  const [loginLoading, setLoginLoading] = useState<boolean>(false);

  // Cases state
  const [cases, setCases] = useState<AgreementCase[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Modals
  const [selectedCase, setSelectedCase] = useState<AgreementCase | null>(null);
  const [showEditModal, setShowEditModal] = useState<boolean>(false);
  const [showGrnModal, setShowGrnModal] = useState<boolean>(false);
  const [showAddModal, setShowAddModal] = useState<boolean>(false);

  // Edit Case Form State
  const [editCaseData, setEditCaseData] = useState<Partial<AgreementCase>>({});
  const [savingEdit, setSavingEdit] = useState<boolean>(false);

  // GRN Modal State
  const [grnInput, setGrnInput] = useState<string>('');
  const [prnInput, setPrnInput] = useState<string>('');
  const [igrPasswordInput, setIgrPasswordInput] = useState<string>('');
  const [receiptDateInput, setReceiptDateInput] = useState<string>('');
  const [savingGrn, setSavingGrn] = useState<boolean>(false);

  // Action feedback
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  // Quick Add State
  const [quickMobile, setQuickMobile] = useState('');
  const [quickLandlordName, setQuickLandlordName] = useState('');
  const [quickTenantName, setQuickTenantName] = useState('');
  const [quickRent, setQuickRent] = useState(5000);
  const [quickDeposit, setQuickDeposit] = useState(15000);
  const [quickFlat, setQuickFlat] = useState('Room No-1');
  const [quickBuilding, setQuickBuilding] = useState('Gajanan Pride Bldg');

  // Check Supabase session on mount
  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          setCurrentUser(session.user);
        }
      } catch (err) {
        console.warn('Session check notice:', err);
      } finally {
        setAuthLoading(false);
      }
    };

    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setCurrentUser(session?.user || null);
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  // Helper for authorized fetch
  const authFetch = async (url: string, options: RequestInit = {}) => {
    const { data: { session } } = await supabase.auth.getSession();
    const headers = new Headers(options.headers || {});
    if (session?.access_token) {
      headers.set('Authorization', `Bearer ${session.access_token}`);
    }
    return fetch(url, { ...options, headers });
  };

  const fetchCases = async () => {
    setLoading(true);
    try {
      const res = await authFetch('/api/agreements');
      const data = await res.json();
      if (data.success) {
        setCases(data.cases || []);
      } else if (res.status === 401) {
        setLoginError('Staff authorization required or email not on allow-list.');
      }
    } catch (err) {
      console.error('Failed to fetch cases', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser) {
      fetchCases();
    }
  }, [currentUser]);

  // Handle Staff Login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError('');

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: emailInput.trim(),
        password: passwordInput,
      });

      if (error) {
        setLoginError(error.message);
      } else if (data.user) {
        setCurrentUser(data.user);
      }
    } catch (err: any) {
      setLoginError(err?.message || 'Login failed.');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setCurrentUser(null);
    setCases([]);
  };

  // Re-sync specific case to Google Sheet
  const handleResyncSheet = async (tokenNumber: string) => {
    setActionNotice(`Syncing case ${tokenNumber} to Google Sheet...`);
    try {
      const res = await authFetch(`/api/cases/${tokenNumber}/sync`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setActionNotice(`✅ Case ${tokenNumber} synced to Google Sheet!`);
        fetchCases();
      } else {
        alert(data.error || 'Failed to sync to Google Sheet.');
      }
    } catch (err) {
      alert('Network error while syncing.');
    } finally {
      setTimeout(() => setActionNotice(null), 4000);
    }
  };

  // Open Edit Case Modal
  const handleOpenEdit = (item: AgreementCase) => {
    setSelectedCase(item);
    setEditCaseData({
      status: item.status,
      mobileNumber: item.mobileNumber,
      landlord: { ...item.landlord },
      tenants: item.tenants ? [...item.tenants] : [],
      witnesses: item.witnesses ? [...item.witnesses] : [],
      propertyDetails: { ...item.propertyDetails },
      financials: { ...item.financials },
    });
    setShowEditModal(true);
  };

  // Save Case Edits (PATCH)
  const handleSaveEdit = async () => {
    if (!selectedCase) return;
    setSavingEdit(true);

    try {
      const res = await authFetch(`/api/cases/${selectedCase.tokenNumber}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editCaseData),
      });

      const data = await res.json();
      if (data.success) {
        setShowEditModal(false);
        setActionNotice(`✅ Updated case ${selectedCase.tokenNumber} successfully!`);
        fetchCases();
      } else {
        alert(data.error || 'Failed to save case changes.');
      }
    } catch (err) {
      alert('Network error while saving changes.');
    } finally {
      setSavingEdit(false);
      setTimeout(() => setActionNotice(null), 4000);
    }
  };

  // Open GRN Modal
  const handleOpenGrn = (item: AgreementCase) => {
    setSelectedCase(item);
    setGrnInput(item.grnDetails?.grnNo || '');
    setPrnInput(item.grnDetails?.prnNo || '');
    setIgrPasswordInput(item.grnDetails?.igrPassword || '');
    setReceiptDateInput(item.grnDetails?.receiptDate || new Date().toISOString().split('T')[0]);
    setShowGrnModal(true);
  };

  // Save GRN Details
  const handleSaveGrn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCase) return;
    setSavingGrn(true);

    try {
      const res = await authFetch(`/api/cases/${selectedCase.tokenNumber}/grn`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grnNo: grnInput.trim(),
          prnNo: prnInput.trim(),
          igrPassword: igrPasswordInput.trim(),
          receiptDate: receiptDateInput.trim(),
        }),
      });

      const data = await res.json();
      if (data.success) {
        setShowGrnModal(false);
        setActionNotice(`✅ GRN saved & updated in Google Sheet for ${selectedCase.tokenNumber}!`);
        fetchCases();
      } else {
        alert(data.error || 'Failed to save GRN.');
      }
    } catch (err) {
      alert('Error updating GRN details.');
    } finally {
      setSavingGrn(false);
      setTimeout(() => setActionNotice(null), 4000);
    }
  };

  // Download DOCX Draft
  const handleDownloadDocx = async (caseData: AgreementCase) => {
    try {
      const res = await authFetch('/api/draft/docx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(caseData),
      });
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Rent_Agreement_${caseData.tokenNumber}.docx`;
      a.click();
    } catch (err) {
      alert('Error downloading Word agreement draft.');
    }
  };

  // Download Agency Excel Ledger (.xlsx)
  const handleDownloadExcel = async () => {
    try {
      const res = await authFetch('/api/export/excel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cases: filteredCases }),
      });
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Rent_Agreement_Ledger_${new Date().toISOString().split('T')[0]}.xlsx`;
      a.click();
    } catch (err) {
      alert('Error exporting Excel ledger.');
    }
  };

  // Export IGR JSON
  const handleExportIGR = async (caseData: AgreementCase) => {
    try {
      const res = await authFetch(`/api/cases/${caseData.tokenNumber}/igr-export`);
      const data = await res.json();
      if (data.success) {
        const blob = new Blob([JSON.stringify(data.igrPayload, null, 2)], {
          type: 'application/json',
        });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `IGR_Payload_${caseData.tokenNumber}.json`;
        a.click();
      } else {
        alert(data.error || 'Failed to export IGR JSON.');
      }
    } catch (err) {
      alert('Error exporting IGR JSON.');
    }
  };

  // Quick Add Case Submit
  const handleQuickAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const computedFee = calculateTotalAgreementFee(quickRent, quickDeposit, 11).totalAmount;

      const payload = {
        mobileNumber: quickMobile.slice(0, 10),
        landlord: {
          fullName: quickLandlordName || 'Landlord / Owner',
          aadhaar: '123456789012',
          nativeAddress: 'Pune',
        },
        tenants: [
          {
            fullName: quickTenantName || 'Tenant Name',
            aadhaar: '123456789012',
            nativeAddress: 'Pune',
          },
        ],
        witnesses: [
          { fullName: 'Witness 1', aadhaar: '123456789012', nativeAddress: 'Pune' },
          { fullName: 'Witness 2', aadhaar: '123456789012', nativeAddress: 'Pune' },
        ],
        propertyDetails: {
          propertyType: 'Flat',
          buildingName: quickBuilding,
          flatNo: quickFlat,
          floorNo: 'Ground Floor',
          surveyNo: 'Gat No-843/1',
          areaSqFt: '250',
          village: 'Wagholi',
          city: 'Pune',
          pincode: '412207',
        },
        financials: {
          rent: Number(quickRent),
          deposit: Number(quickDeposit),
          tenureMonths: 11,
          startDate: new Date().toISOString().split('T')[0],
          fee: computedFee,
        },
      };

      const res = await authFetch('/api/agreements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const resData = await res.json();
      if (resData.success) {
        setShowAddModal(false);
        setActionNotice(`✅ Added case ${resData.tokenNumber} successfully!`);
        fetchCases();
      } else {
        alert(resData.error || 'Failed to create case.');
      }
    } catch (err) {
      alert('Error adding quick case.');
    } finally {
      setTimeout(() => setActionNotice(null), 4000);
    }
  };

  const filteredCases = cases.filter((c) => {
    const matchesSearch =
      c.tokenNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.landlord?.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.mobileNumber?.includes(searchTerm);
    const matchesStatus = statusFilter === 'ALL' || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: CaseStatus) => {
    switch (status) {
      case 'Completed':
        return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      case 'Verification Required':
        return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'Draft Ready':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'Docs Uploaded':
        return 'bg-teal-100 text-teal-800 border-teal-300';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-300';
    }
  };

  // If loading session
  if (authLoading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center text-slate-500 text-xs font-semibold">
        Verifying staff session...
      </div>
    );
  }

  // If Not Authenticated: Render Login Card
  if (!currentUser) {
    return (
      <div className="max-w-md mx-auto px-4 py-16">
        <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-md space-y-6">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center mx-auto border border-emerald-100">
              <KeyRound className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-bold text-slate-900">Staff Portal Login</h2>
            <p className="text-xs text-slate-500">
              Enter allow-listed staff credentials to manage agreements, sync sheets, and export IGR tokens.
            </p>
          </div>

          {loginError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
              <span>{loginError}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4 text-xs">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Staff Email Address</label>
              <input
                type="email"
                required
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder="staff@agency.com"
                className="w-full glass-input px-3.5 py-2.5 rounded-xl text-xs"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Password</label>
              <input
                type="password"
                required
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="••••••••"
                className="w-full glass-input px-3.5 py-2.5 rounded-xl text-xs"
              />
            </div>

            <button
              type="submit"
              disabled={loginLoading}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition shadow-sm flex items-center justify-center gap-2"
            >
              {loginLoading ? 'Authenticating...' : 'Sign In to Staff Panel'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Staff Authenticated Dashboard View
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      {/* Toast Notice */}
      {actionNotice && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white text-xs font-bold px-4 py-2.5 rounded-full shadow-lg border border-slate-700 flex items-center gap-2">
          <span>{actionNotice}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
            <Building className="w-6 h-6 text-emerald-600" />
            Pune Agency Staff Dashboard
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Logged in as <span className="font-semibold text-slate-800">{currentUser.email}</span> (Allow-listed Staff)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <button
            onClick={handleDownloadExcel}
            className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition shadow-sm"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Export .xlsx (ExcelJS)
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Add New Case
          </button>
          <button
            onClick={handleLogout}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl flex items-center gap-1.5 transition border border-slate-200"
            title="Sign Out"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign Out
          </button>
        </div>
      </div>

      {/* Controls Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm mb-6 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Search Token, Owner, Mobile..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full glass-input pl-9 pr-4 py-2 rounded-xl text-xs"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto">
          <span className="text-xs text-slate-500 font-semibold mr-1">Status:</span>
          {['ALL', 'Docs Uploaded', 'AI Processing', 'Verification Required', 'Draft Ready', 'Completed'].map(
            (st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition border ${
                  statusFilter === st
                    ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                {st}
              </button>
            )
          )}
          <button
            onClick={fetchCases}
            className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg border border-slate-200 ml-1"
            title="Refresh cases"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Cases Queue Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
              <tr>
                <th className="p-4">Token Number</th>
                <th className="p-4">Owner (Landlord)</th>
                <th className="p-4">Tenants</th>
                <th className="p-4">Property</th>
                <th className="p-4">Rent / Deposit</th>
                <th className="p-4">Sheet Sync</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-800">
              {filteredCases.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-500">
                    No rent agreement cases found in queue.
                  </td>
                </tr>
              ) : (
                filteredCases.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/80 transition">
                    <td className="p-4 font-extrabold text-emerald-700 whitespace-nowrap">
                      {item.tokenNumber}
                    </td>

                    <td className="p-4">
                      <div className="font-bold text-slate-900">{item.landlord?.fullName || 'Owner Name'}</div>
                      <div className="text-[11px] text-slate-500">{item.mobileNumber}</div>
                    </td>

                    <td className="p-4">
                      <div className="font-semibold text-slate-800">
                        {item.tenants?.[0]?.fullName || 'Tenant Name'}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {item.tenants?.length || 1} Tenant(s)
                      </div>
                    </td>

                    <td className="p-4">
                      <div className="font-medium text-slate-800 truncate max-w-[180px]">
                        {item.propertyDetails?.flatNo ? `${item.propertyDetails.flatNo}, ` : ''}
                        {item.propertyDetails?.buildingName}
                      </div>
                      <div className="text-[11px] text-slate-500">{item.propertyDetails?.village || 'Pune'}</div>
                    </td>

                    <td className="p-4 whitespace-nowrap">
                      <div className="font-bold text-emerald-700">₹ {item.financials?.rent} /m</div>
                      <div className="text-[11px] text-slate-500">Dep: ₹ {item.financials?.deposit}</div>
                    </td>

                    <td className="p-4 whitespace-nowrap">
                      {item.syncedToSheets ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Synced
                        </span>
                      ) : (
                        <button
                          onClick={() => handleResyncSheet(item.tokenNumber)}
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 px-2 py-0.5 rounded-full border border-amber-200 transition"
                          title="Click to sync with Google Sheet"
                        >
                          <RefreshCw className="w-3 h-3 text-amber-600" /> Re-sync
                        </button>
                      )}
                    </td>

                    <td className="p-4 whitespace-nowrap">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${getStatusBadge(item.status)}`}>
                        {item.status}
                      </span>
                    </td>

                    <td className="p-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenEdit(item)}
                          className="px-2 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold rounded-lg flex items-center gap-1 border border-slate-200 transition"
                          title="Edit any field"
                        >
                          <Edit className="w-3.5 h-3.5 text-slate-600" />
                          Edit
                        </button>
                        <button
                          onClick={() => handleOpenGrn(item)}
                          className="px-2 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 font-semibold rounded-lg border border-amber-200 transition"
                          title="Enter GRN/PRN (updates yellow sheet cell)"
                        >
                          GRN/PRN
                        </button>
                        <button
                          onClick={() => handleExportIGR(item)}
                          className="p-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg border border-indigo-200 transition"
                          title="Export IGR JSON"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDownloadDocx(item)}
                          className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg border border-emerald-200 transition"
                          title="Download Word (.docx)"
                        >
                          <FileText className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* EDIT CASE MODAL */}
      {showEditModal && selectedCase && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white max-w-3xl w-full max-h-[90vh] rounded-2xl overflow-y-auto p-6 space-y-6 shadow-xl border border-slate-200">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Edit Case Details — {selectedCase.tokenNumber}
                </h3>
                <p className="text-xs text-slate-500">Staff can update any client, property, or lease values.</p>
              </div>
              <button onClick={() => setShowEditModal(false)} className="text-slate-400 text-xl font-bold">&times;</button>
            </div>

            <div className="space-y-4 text-xs">
              {/* Status & Mobile */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 uppercase text-[10px] mb-1">Status</label>
                  <select
                    value={editCaseData.status || selectedCase.status}
                    onChange={(e) => setEditCaseData({ ...editCaseData, status: e.target.value as CaseStatus })}
                    className="w-full glass-input px-3 py-2 rounded-xl"
                  >
                    <option value="Docs Uploaded">Docs Uploaded</option>
                    <option value="AI Processing">AI Processing</option>
                    <option value="Verification Required">Verification Required</option>
                    <option value="Draft Ready">Draft Ready</option>
                    <option value="Biometrics Scheduled">Biometrics Scheduled</option>
                    <option value="Completed">Completed</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 uppercase text-[10px] mb-1">Client Mobile</label>
                  <input
                    type="tel"
                    maxLength={10}
                    value={editCaseData.mobileNumber || ''}
                    onChange={(e) => setEditCaseData({ ...editCaseData, mobileNumber: e.target.value })}
                    className="w-full glass-input px-3 py-2 rounded-xl"
                  />
                </div>
              </div>

              {/* Landlord Section */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                <span className="font-bold text-emerald-800 uppercase text-xs block">Landlord Details</span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">Full Name</label>
                    <input
                      type="text"
                      value={editCaseData.landlord?.fullName || ''}
                      onChange={(e) =>
                        setEditCaseData({
                          ...editCaseData,
                          landlord: { ...editCaseData.landlord, fullName: e.target.value } as any,
                        })
                      }
                      className="w-full glass-input px-2.5 py-1.5 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">Aadhaar</label>
                    <input
                      type="text"
                      value={editCaseData.landlord?.aadhaar || ''}
                      onChange={(e) =>
                        setEditCaseData({
                          ...editCaseData,
                          landlord: { ...editCaseData.landlord, aadhaar: e.target.value } as any,
                        })
                      }
                      className="w-full glass-input px-2.5 py-1.5 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">PAN</label>
                    <input
                      type="text"
                      value={editCaseData.landlord?.pan || ''}
                      onChange={(e) =>
                        setEditCaseData({
                          ...editCaseData,
                          landlord: { ...editCaseData.landlord, pan: e.target.value.toUpperCase() } as any,
                        })
                      }
                      className="w-full glass-input px-2.5 py-1.5 rounded-lg"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">Address</label>
                  <input
                    type="text"
                    value={editCaseData.landlord?.nativeAddress || ''}
                    onChange={(e) =>
                      setEditCaseData({
                        ...editCaseData,
                        landlord: { ...editCaseData.landlord, nativeAddress: e.target.value } as any,
                      })
                    }
                    className="w-full glass-input px-2.5 py-1.5 rounded-lg"
                  />
                </div>
              </div>

              {/* Property Details */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                <span className="font-bold text-emerald-800 uppercase text-xs block">Property Details</span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">Building Name</label>
                    <input
                      type="text"
                      value={editCaseData.propertyDetails?.buildingName || ''}
                      onChange={(e) =>
                        setEditCaseData({
                          ...editCaseData,
                          propertyDetails: { ...editCaseData.propertyDetails, buildingName: e.target.value } as any,
                        })
                      }
                      className="w-full glass-input px-2.5 py-1.5 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">Flat No</label>
                    <input
                      type="text"
                      value={editCaseData.propertyDetails?.flatNo || ''}
                      onChange={(e) =>
                        setEditCaseData({
                          ...editCaseData,
                          propertyDetails: { ...editCaseData.propertyDetails, flatNo: e.target.value } as any,
                        })
                      }
                      className="w-full glass-input px-2.5 py-1.5 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">Area (Sq.Ft)</label>
                    <input
                      type="text"
                      value={editCaseData.propertyDetails?.areaSqFt || ''}
                      onChange={(e) =>
                        setEditCaseData({
                          ...editCaseData,
                          propertyDetails: { ...editCaseData.propertyDetails, areaSqFt: e.target.value } as any,
                        })
                      }
                      className="w-full glass-input px-2.5 py-1.5 rounded-lg"
                    />
                  </div>
                </div>
              </div>

              {/* Financials */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">Monthly Rent (₹)</label>
                  <input
                    type="number"
                    value={editCaseData.financials?.rent || 0}
                    onChange={(e) =>
                      setEditCaseData({
                        ...editCaseData,
                        financials: { ...editCaseData.financials, rent: Number(e.target.value) } as any,
                      })
                    }
                    className="w-full glass-input px-2.5 py-1.5 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">Deposit (₹)</label>
                  <input
                    type="number"
                    value={editCaseData.financials?.deposit || 0}
                    onChange={(e) =>
                      setEditCaseData({
                        ...editCaseData,
                        financials: { ...editCaseData.financials, deposit: Number(e.target.value) } as any,
                      })
                    }
                    className="w-full glass-input px-2.5 py-1.5 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">Tenure (Months)</label>
                  <input
                    type="number"
                    value={editCaseData.financials?.tenureMonths || 11}
                    onChange={(e) =>
                      setEditCaseData({
                        ...editCaseData,
                        financials: { ...editCaseData.financials, tenureMonths: Number(e.target.value) } as any,
                      })
                    }
                    className="w-full glass-input px-2.5 py-1.5 rounded-lg"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-semibold text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={savingEdit}
                onClick={handleSaveEdit}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow"
              >
                <Save className="w-4 h-4" />
                {savingEdit ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ENTER GRN/PRN MODAL */}
      {showGrnModal && selectedCase && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white max-w-md w-full rounded-2xl p-6 space-y-5 border border-slate-200 shadow-xl">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Enter Govt GRN / PRN</h3>
                <p className="text-[11px] text-slate-500">Case: {selectedCase.tokenNumber}</p>
              </div>
              <button onClick={() => setShowGrnModal(false)} className="text-slate-400 text-lg font-bold">&times;</button>
            </div>

            <p className="text-xs text-slate-600 bg-amber-50 p-3 rounded-xl border border-amber-200 leading-relaxed">
              Entering the government GRN/PRN here saves it to <strong>grn_details</strong> and immediately updates the yellow cell in your Google Sheet!
            </p>

            <form onSubmit={handleSaveGrn} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">GRN Number</label>
                <input
                  type="text"
                  value={grnInput}
                  onChange={(e) => setGrnInput(e.target.value)}
                  placeholder="e.g. 0726305705334"
                  className="w-full glass-input px-3 py-2 rounded-xl font-mono text-xs"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">PRN / Receipt Number</label>
                <input
                  type="text"
                  value={prnInput}
                  onChange={(e) => setPrnInput(e.target.value)}
                  placeholder="PRN or fee receipt number"
                  className="w-full glass-input px-3 py-2 rounded-xl font-mono text-xs"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">IGR Portal Password (Optional)</label>
                <input
                  type="text"
                  value={igrPasswordInput}
                  onChange={(e) => setIgrPasswordInput(e.target.value)}
                  placeholder="e.g. MH007372620202627P"
                  className="w-full glass-input px-3 py-2 rounded-xl font-mono text-xs"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Receipt Date</label>
                <input
                  type="date"
                  value={receiptDateInput}
                  onChange={(e) => setReceiptDateInput(e.target.value)}
                  className="w-full glass-input px-3 py-2 rounded-xl text-xs"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowGrnModal(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingGrn}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl shadow"
                >
                  {savingGrn ? 'Saving & Syncing...' : 'Save & Update Sheet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QUICK ADD MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white max-w-lg w-full rounded-2xl p-6 space-y-5 border border-slate-200 shadow-xl">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <h3 className="text-sm font-bold text-slate-900">Quick Desk Entry — New Agreement</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 text-lg font-bold">&times;</button>
            </div>

            <form onSubmit={handleQuickAdd} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Client Mobile Number</label>
                <input
                  type="text"
                  maxLength={10}
                  value={quickMobile}
                  onChange={(e) => setQuickMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  placeholder="Enter 10-digit Mobile"
                  className="w-full glass-input px-3 py-2 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Owner Name</label>
                  <input
                    type="text"
                    value={quickLandlordName}
                    onChange={(e) => setQuickLandlordName(e.target.value)}
                    placeholder="Enter Owner Name"
                    className="w-full glass-input px-3 py-2 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Tenant Name</label>
                  <input
                    type="text"
                    value={quickTenantName}
                    onChange={(e) => setQuickTenantName(e.target.value)}
                    placeholder="Enter Tenant Name"
                    className="w-full glass-input px-3 py-2 rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Monthly Rent (₹)</label>
                  <input
                    type="number"
                    value={quickRent}
                    onChange={(e) => setQuickRent(Number(e.target.value))}
                    className="w-full glass-input px-3 py-2 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Deposit (₹)</label>
                  <input
                    type="number"
                    value={quickDeposit}
                    onChange={(e) => setQuickDeposit(Number(e.target.value))}
                    className="w-full glass-input px-3 py-2 rounded-xl"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow"
                >
                  Create & Generate Token
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
