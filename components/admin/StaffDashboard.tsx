'use client';

import React, { useState, useEffect } from 'react';
import { AgreementCase, CaseStatus } from '@/types';
import { calculateTotalAgreementFee } from '@/lib/calculator';
import {
  FileSpreadsheet,
  FileText,
  Eye,
  Download,
  Plus,
  RefreshCw,
  Search,
  Building,
  ExternalLink
} from 'lucide-react';

export default function StaffDashboard() {
  const [cases, setCases] = useState<AgreementCase[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Modals
  const [selectedCase, setSelectedCase] = useState<AgreementCase | null>(null);
  const [showReviewModal, setShowReviewModal] = useState<boolean>(false);
  const [showAddModal, setShowAddModal] = useState<boolean>(false);

  // Quick Add Form State
  const [quickMobile, setQuickMobile] = useState('');
  const [quickLandlordName, setQuickLandlordName] = useState('');
  const [quickTenantName, setQuickTenantName] = useState('');
  const [quickRent, setQuickRent] = useState(5000);
  const [quickDeposit, setQuickDeposit] = useState(15000);
  const [quickFlat, setQuickFlat] = useState('Room No-1');
  const [quickBuilding, setQuickBuilding] = useState('Gajanan Pride Bldg');

  const fetchCases = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/agreements');
      const data = await res.json();
      if (data.success) {
        setCases(data.cases || []);
      }
    } catch (err) {
      console.error('Failed to fetch cases', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCases();
  }, []);

  // Filter cases
  const filteredCases = cases.filter((c) => {
    const matchesSearch =
      c.tokenNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.landlord?.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.mobileNumber.includes(searchTerm);
    const matchesStatus = statusFilter === 'ALL' || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Download DOCX Draft
  const handleDownloadDocx = async (caseData: AgreementCase) => {
    try {
      const res = await fetch('/api/draft/docx', {
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
      const res = await fetch('/api/export/excel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cases: filteredCases }),
      });
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Rent_Agreement_Agency_Ledger_${new Date().toISOString().split('T')[0]}.xlsx`;
      a.click();
    } catch (err) {
      alert('Error exporting agency Excel file.');
    }
  };

  // Export IGR JSON
  const handleExportIGR = async (caseData: AgreementCase) => {
    try {
      const res = await fetch('/api/export/igr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(caseData),
      });
      const data = await res.json();
      if (data.success) {
        const blob = new Blob([JSON.stringify(data.igrPayload, null, 2)], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `IGR_Payload_${caseData.tokenNumber}.json`;
        a.click();
      }
    } catch (err) {
      alert('Error exporting IGR JSON.');
    }
  };

  // Quick Add Form Submit
  const handleQuickAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const computedFee = calculateTotalAgreementFee(quickRent, quickDeposit, 11).totalAmount;

      const payload = {
        mobileNumber: quickMobile.slice(0, 10),
        landlord: { fullName: quickLandlordName || 'Landlord / Owner', aadhaar: '', nativeAddress: 'Pune' },
        tenants: [{ fullName: quickTenantName || 'Tenant Name', aadhaar: '', nativeAddress: 'Pune' }],
        witnesses: [
          { fullName: 'Witness 1', aadhaar: '', nativeAddress: 'Pune' },
          { fullName: 'Witness 2', aadhaar: '', nativeAddress: 'Pune' }
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
          pincode: '412207'
        },
        financials: {
          rent: Number(quickRent),
          deposit: Number(quickDeposit),
          tenureMonths: 11,
          startDate: new Date().toISOString().split('T')[0],
          fee: computedFee
        },
      };

      const res = await fetch('/api/agreements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const resData = await res.json();
      if (resData.success) {
        setShowAddModal(false);
        fetchCases();
      }
    } catch (err) {
      alert('Error adding quick case.');
    }
  };

  // Status badge styling in light mode
  const getStatusBadge = (status: CaseStatus) => {
    switch (status) {
      case 'Completed':
        return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      case 'Verification Required':
        return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'Draft Ready':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-300';
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
            <Building className="w-6 h-6 text-emerald-600" />
            Pune Agency Staff Dashboard
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Live Agreement Queue, Gemini OCR Data Verification & 12-Column Ledger Sync
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleDownloadExcel}
            className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-xl flex items-center gap-2 transition shadow-sm"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Export 12-Col Excel (.xlsx)
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center gap-2 transition shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Add New Case
          </button>
        </div>
      </div>

      {/* Controls Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm mb-6 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Search by Token, Owner, Mobile..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full glass-input pl-9 pr-4 py-2.5 rounded-xl text-xs"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto">
          <span className="text-xs text-slate-500 font-semibold mr-1">Status:</span>
          {['ALL', 'Docs Uploaded', 'AI Processing', 'Verification Required', 'Draft Ready', 'Completed'].map((st) => (
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
          ))}
          <button
            onClick={fetchCases}
            className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg border border-slate-200 ml-1"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Queue Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
              <tr>
                <th className="p-4">Token Number</th>
                <th className="p-4">Owner (Landlord)</th>
                <th className="p-4">Tenants</th>
                <th className="p-4">Property & Location</th>
                <th className="p-4">Rent / Deposit</th>
                <th className="p-4">Calculated Total Fee</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-800">
              {filteredCases.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-500">
                    No rent agreement cases found in queue. Click "+ Add New Case" to register.
                  </td>
                </tr>
              ) : (
                filteredCases.map((item) => {
                  const calculatedFee = item.financials?.fee || calculateTotalAgreementFee(item.financials?.rent || 0, item.financials?.deposit || 0, item.financials?.tenureMonths || 11).totalAmount;
                  return (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition">
                      <td className="p-4 font-extrabold text-emerald-700">{item.tokenNumber}</td>
                      <td className="p-4">
                        <div className="font-bold text-slate-900">{item.landlord?.fullName || 'Owner Name'}</div>
                        <div className="text-[11px] text-slate-500">{item.landlord?.aadhaar || 'N/A'}</div>
                      </td>
                      <td className="p-4">
                        <div className="font-semibold text-slate-800">
                          {item.tenants?.[0]?.fullName || 'Tenant Name'}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {item.tenants?.length || 1} Tenant(s) Registered
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="font-medium text-slate-800">
                          {item.propertyDetails?.flatNo}, {item.propertyDetails?.buildingName}
                        </div>
                        <div className="text-[11px] text-slate-500">{item.propertyDetails?.village || 'Wagholi, Pune'}</div>
                      </td>
                      <td className="p-4">
                        <div className="font-bold text-emerald-700">₹ {item.financials?.rent} /m</div>
                        <div className="text-[11px] text-slate-500">Deposit: ₹ {item.financials?.deposit}</div>
                      </td>
                      <td className="p-4">
                        <div className="font-bold text-slate-900 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200 inline-block">
                          ₹ {calculatedFee.toLocaleString('en-IN')}
                        </div>
                      </td>
                      <td className="p-4">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${getStatusBadge(item.status)}`}>
                          {item.status}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => {
                              setSelectedCase(item);
                              setShowReviewModal(true);
                            }}
                            className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold rounded-lg flex items-center gap-1 border border-slate-200 transition"
                          >
                            <Eye className="w-3.5 h-3.5 text-emerald-600" />
                            Review
                          </button>
                          <button
                            onClick={() => handleDownloadDocx(item)}
                            className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg border border-emerald-200 transition"
                            title="Download Word Draft (.docx)"
                          >
                            <FileText className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleExportIGR(item)}
                            className="p-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg border border-indigo-200 transition"
                            title="Export IGR JSON"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Review Side-by-Side Modal */}
      {showReviewModal && selectedCase && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white max-w-4xl w-full max-h-[90vh] rounded-2xl overflow-y-auto p-6 space-y-6 shadow-xl border border-slate-200">
            <div className="flex justify-between items-center border-b border-slate-200 pb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Review Extracted Data — {selectedCase.tokenNumber}
                </h3>
                <p className="text-xs text-slate-500">
                  Side-by-side verification of OCR text against uploaded document cards.
                </p>
              </div>
              <button onClick={() => setShowReviewModal(false)} className="text-slate-400 hover:text-slate-700 text-xl font-bold">&times;</button>
            </div>

            {/* Split View */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4 text-xs">
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                  <h4 className="font-bold text-emerald-800 uppercase tracking-wider text-[11px]">Owner Details</h4>
                  <div><span className="text-slate-500">Name:</span> {selectedCase.landlord?.fullName}</div>
                  <div><span className="text-slate-500">Aadhaar:</span> {selectedCase.landlord?.aadhaar}</div>
                  <div><span className="text-slate-500">PAN:</span> {selectedCase.landlord?.pan}</div>
                  <div><span className="text-slate-500">Address:</span> {selectedCase.landlord?.nativeAddress}</div>
                </div>

                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                  <h4 className="font-bold text-emerald-800 uppercase tracking-wider text-[11px]">Tenants Details</h4>
                  {selectedCase.tenants?.map((t, idx) => (
                    <div key={idx} className="border-b border-slate-200 pb-2 last:border-0">
                      <div><span className="text-slate-500">Tenant #{idx + 1}:</span> {t.fullName}</div>
                      <div><span className="text-slate-500">Aadhaar:</span> {t.aadhaar} | <span className="text-slate-500">PAN:</span> {t.pan}</div>
                      <div><span className="text-slate-500">Address:</span> {t.nativeAddress}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-slate-50 rounded-xl border border-slate-200 p-6 flex flex-col items-center justify-center text-center space-y-3">
                <FileText className="w-12 h-12 text-emerald-600" />
                <span className="text-xs font-bold text-slate-800">Document Scans Loaded</span>
                <p className="text-[11px] text-slate-500">
                  Landlord & Tenant Aadhaar, PAN, Witness Aadhaar (Front/Back) & Electricity bill processed by Gemini Vision OCR.
                </p>
                <div className="px-3 py-1 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-full text-[10px] font-bold">
                  Total Calculated Fee: ₹ {(selectedCase.financials?.fee || calculateTotalAgreementFee(selectedCase.financials?.rent || 0, selectedCase.financials?.deposit || 0, selectedCase.financials?.tenureMonths || 11).totalAmount).toLocaleString('en-IN')}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
              <button
                onClick={() => setShowReviewModal(false)}
                className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold"
              >
                Close
              </button>
              <button
                onClick={() => {
                  handleDownloadDocx(selectedCase);
                  setShowReviewModal(false);
                }}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow"
              >
                <Download className="w-4 h-4" />
                Download Agreement (.docx)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Add Case Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white max-w-lg w-full rounded-2xl p-6 space-y-5 border border-slate-200 shadow-xl">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <h3 className="text-sm font-bold text-slate-900">Quick Desk Entry — New Agreement</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 text-lg font-bold">&times;</button>
            </div>

            <form onSubmit={handleQuickAdd} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Client Mobile Number (Max 10 Digits)</label>
                <input
                  type="text"
                  maxLength={10}
                  value={quickMobile}
                  onChange={(e) => setQuickMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  placeholder="Enter Client Mobile Number"
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
