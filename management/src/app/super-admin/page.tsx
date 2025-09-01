'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getAuthToken } from '@/lib/auth-client';
import SuperAdminLayout from '@/components/SuperAdminLayout';
import SuperAdminProtectedRoute from '@/components/SuperAdminProtectedRoute';
import { 
  Building, 
  Users, 
  Search,
  Ban,
  CheckCircle,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Plus,
  Coins,
  TrendingUp,
  Activity
} from 'lucide-react';

interface TenantData {
  id: string;
  name: string;
  domain?: string;
  isBlocked: boolean;
  createdAt: string;
  _count: {
    users: number;
    projects: number;
  };
  tokenUsage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
}

interface TenantsResponse {
  tenants: TenantData[];
  pagination: {
    page: number;
    limit: number;
    totalTenants: number;
    totalPages: number;
  };
}

export default function SuperAdminDashboard() {
  const { user } = useAuth();
  const [tenants, setTenants] = useState<TenantData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [blockedFilter, setBlockedFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<any>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);

  const fetchTenants = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '10',
        ...(search && { search }),
        ...(blockedFilter && { blocked: blockedFilter }),
      });

      const response = await fetch(`/api/super-admin/tenants?${params}`, {
        headers: {
          'Authorization': `Bearer ${getAuthToken()}`
        }
      });
      
      if (!response.ok) {
        if (response.status === 403) {
          throw new Error('Access denied. Super Admin privileges required.');
        }
        throw new Error(`Failed to fetch tenants: ${response.status}`);
      }
      
      const data: TenantsResponse = await response.json();
      setTenants(data.tenants);
      setPagination(data.pagination);
    } catch (error) {
      console.error('Error fetching tenants:', error);
      setError(error instanceof Error ? error.message : 'Failed to fetch tenants');
    } finally {
      setLoading(false);
    }
  };

  const handleTenantAction = async (tenantId: string, action: string) => {
    setActionLoading(tenantId);
    try {
      const response = await fetch('/api/super-admin/tenants', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getAuthToken()}`
        },
        body: JSON.stringify({ tenantId, action })
      });

      if (!response.ok) {
        throw new Error('Failed to update tenant');
      }

      const result = await response.json();
      
      // Update the tenant in the local state
      setTenants(tenants.map(t => 
        t.id === tenantId 
          ? { ...t, isBlocked: result.tenant.isBlocked }
          : t
      ));
    } catch (error) {
      console.error('Error updating tenant:', error);
      alert('Failed to update tenant. Please try again.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCreateTenant = async (tenantData: any) => {
    setCreateLoading(true);
    try {
      const response = await fetch('/api/super-admin/tenants/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getAuthToken()}`
        },
        body: JSON.stringify(tenantData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create tenant');
      }

      const result = await response.json();
      
      // Refresh the tenant list
      await fetchTenants();
      
      // Close modal and show success
      setShowCreateModal(false);
      alert(`Tenant "${result.tenant.name}" created successfully with admin user "${result.adminUser.username}"`);
    } catch (error) {
      console.error('Error creating tenant:', error);
      alert(error instanceof Error ? error.message : 'Failed to create tenant. Please try again.');
    } finally {
      setCreateLoading(false);
    }
  };

  useEffect(() => {
    fetchTenants();
  }, [page, search, blockedFilter]);

  useEffect(() => {
    document.title = 'Super Admin Dashboard';
  }, []);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [search, blockedFilter]);

  if (error) {
    return (
      <SuperAdminLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <div className="flex items-center">
              <AlertCircle className="w-6 h-6 text-red-600 mr-3" />
              <div>
                <h3 className="text-lg font-medium text-red-800">Error Loading Tenants</h3>
                <p className="text-red-700 mt-1">{error}</p>
                <button
                  onClick={fetchTenants}
                  className="mt-3 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
                >
                  Try Again
                </button>
              </div>
            </div>
          </div>
        </div>
      </SuperAdminLayout>
    );
  }

  return (
    <SuperAdminProtectedRoute>
      <SuperAdminLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center">
                <Building className="w-8 h-8 mr-3 text-purple-600" />
                Tenant Management
              </h1>
              <p className="text-gray-600 mt-1">Manage all tenants in the system</p>
            </div>
            
            <button 
              onClick={() => setShowCreateModal(true)}
              className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors flex items-center"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Tenant
            </button>
          </div>
          
          {/* Summary Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 mt-6">
            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
              <div className="flex items-center">
                <div className="bg-purple-50 p-2 rounded-full mr-3">
                  <Building className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Tenants</p>
                  <p className="text-2xl font-bold text-gray-900">{pagination?.totalTenants || 0}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
              <div className="flex items-center">
                <div className="bg-green-50 p-2 rounded-full mr-3">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Active</p>
                  <p className="text-2xl font-bold text-gray-900">{tenants.filter(t => !t.isBlocked).length}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
              <div className="flex items-center">
                <div className="bg-red-50 p-2 rounded-full mr-3">
                  <Ban className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Blocked</p>
                  <p className="text-2xl font-bold text-gray-900">{tenants.filter(t => t.isBlocked).length}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
              <div className="flex items-center">
                <div className="bg-yellow-50 p-2 rounded-full mr-3">
                  <Coins className="w-5 h-5 text-yellow-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Tokens</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {tenants.reduce((acc, t) => acc + t.tokenUsage.totalTokens, 0).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
            
            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
              <div className="flex items-center">
                <div className="bg-green-50 p-2 rounded-full mr-3">
                  <TrendingUp className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Input Tokens</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {tenants.reduce((acc, t) => acc + t.tokenUsage.inputTokens, 0).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
            
            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
              <div className="flex items-center">
                <div className="bg-purple-50 p-2 rounded-full mr-3">
                  <Activity className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Output Tokens</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {tenants.reduce((acc, t) => acc + t.tokenUsage.outputTokens, 0).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search tenants..."
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-purple-500 focus:border-purple-500"
              />
            </div>

            <select
              value={blockedFilter}
              onChange={(e) => setBlockedFilter(e.target.value)}
              className="block w-full px-3 py-2 border border-gray-300 rounded-md leading-5 bg-white focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500"
            >
              <option value="">All Status</option>
              <option value="false">Active Only</option>
              <option value="true">Blocked Only</option>
            </select>
            
            <div className="flex items-center justify-end">
              <div className="text-sm text-gray-500">
                {pagination && (
                  <span>
                    Showing {((pagination.page - 1) * pagination.limit) + 1}-{Math.min(pagination.page * pagination.limit, pagination.totalTenants)} of {pagination.totalTenants}
                  </span>
                )}
              </div>
            </div>

            <button 
              onClick={() => setShowCreateModal(true)}
              className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors flex items-center justify-center"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Tenant
            </button>
          </div>
        </div>

        {/* Tenants Table */}
        <div className="bg-white shadow-sm border border-gray-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tenant
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Domain
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Users
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Projects
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Token Usage
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {loading ? (
                  Array.from({ length: 5 }).map((_, index) => (
                    <tr key={index}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="animate-pulse bg-gray-200 h-4 rounded w-24"></div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="animate-pulse bg-gray-200 h-4 rounded w-32"></div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="animate-pulse bg-gray-200 h-4 rounded w-8"></div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="animate-pulse bg-gray-200 h-4 rounded w-8"></div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="animate-pulse bg-gray-200 h-4 rounded w-24"></div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="animate-pulse bg-gray-200 h-4 rounded w-16"></div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="animate-pulse bg-gray-200 h-4 rounded w-20"></div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="animate-pulse bg-gray-200 h-8 rounded w-20 ml-auto"></div>
                      </td>
                    </tr>
                  ))
                ) : tenants.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                      <Building className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                      <p className="text-lg font-medium">No tenants found</p>
                      <p className="text-sm">Create your first tenant to get started.</p>
                    </td>
                  </tr>
                ) : (
                  tenants.map((tenant) => (
                    <tr key={tenant.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="bg-purple-50 p-2 rounded-full mr-3">
                            <Building className="w-5 h-5 text-purple-600" />
                          </div>
                          <div>
                            <div className="text-sm font-medium text-gray-900">{tenant.name}</div>
                            <div className="text-sm text-gray-500">ID: {tenant.id.slice(0, 8)}...</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{tenant.domain || '-'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{tenant._count.users}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{tenant._count.projects}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="space-y-1">
                          <div className="text-sm font-medium text-gray-900 flex items-center">
                            <Coins className="w-4 h-4 mr-1 text-yellow-600" />
                            {tenant.tokenUsage.totalTokens.toLocaleString()}
                          </div>
                          <div className="text-xs text-gray-500 flex items-center space-x-3">
                            <span className="flex items-center">
                              <TrendingUp className="w-3 h-3 mr-1 text-green-600" />
                              {tenant.tokenUsage.inputTokens.toLocaleString()}
                            </span>
                            <span className="flex items-center">
                              <Activity className="w-3 h-3 mr-1 text-purple-600" />
                              {tenant.tokenUsage.outputTokens.toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {tenant.isBlocked ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                            <Ban className="w-3 h-3 mr-1" />
                            Blocked
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Active
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(tenant.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => handleTenantAction(tenant.id, tenant.isBlocked ? 'unblock' : 'block')}
                          disabled={actionLoading === tenant.id}
                          className={`inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded ${
                            tenant.isBlocked
                              ? 'text-green-700 bg-green-100 hover:bg-green-200'
                              : 'text-red-700 bg-red-100 hover:bg-red-200'
                          } transition-colors disabled:opacity-50`}
                        >
                          {actionLoading === tenant.id ? (
                            <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-current"></div>
                          ) : tenant.isBlocked ? (
                            <>
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Unblock
                            </>
                          ) : (
                            <>
                              <Ban className="w-3 h-3 mr-1" />
                              Block
                            </>
                          )}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
              <div className="flex-1 flex justify-between sm:hidden">
                <button
                  onClick={() => setPage(page - 1)}
                  disabled={page <= 1}
                  className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage(page + 1)}
                  disabled={page >= pagination.totalPages}
                  className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
              <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-gray-700">
                    Showing page <span className="font-medium">{pagination.page}</span> of{' '}
                    <span className="font-medium">{pagination.totalPages}</span>
                  </p>
                </div>
                <div>
                  <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                    <button
                      onClick={() => setPage(page - 1)}
                      disabled={page <= 1}
                      className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => setPage(page + 1)}
                      disabled={page >= pagination.totalPages}
                      className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </button>
                  </nav>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Create Tenant Modal */}
      {showCreateModal && (
        <CreateTenantModal
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreateTenant}
          loading={createLoading}
        />
      )}
    </SuperAdminLayout>
    </SuperAdminProtectedRoute>
  );
}

// Create Tenant Modal Component
function CreateTenantModal({ 
  onClose, 
  onCreate, 
  loading 
}: { 
  onClose: () => void; 
  onCreate: (data: any) => void;
  loading: boolean;
}) {
  const [formData, setFormData] = useState({
    tenantName: '',
    tenantDomain: '',
    adminUsername: '',
    adminEmail: '',
    adminPassword: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onCreate(formData);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center z-50">
      <div className="bg-white p-8 rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-medium text-gray-900">Create New Tenant</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            disabled={loading}
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tenant Name *
            </label>
            <input
              type="text"
              name="tenantName"
              value={formData.tenantName}
              onChange={handleChange}
              required
              disabled={loading}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500 disabled:bg-gray-100"
              placeholder="Enter tenant name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Domain (Optional)
            </label>
            <input
              type="text"
              name="tenantDomain"
              value={formData.tenantDomain}
              onChange={handleChange}
              disabled={loading}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500 disabled:bg-gray-100"
              placeholder="example.com"
            />
          </div>

          <div className="border-t pt-4">
            <h4 className="text-sm font-medium text-gray-900 mb-3">Admin User Details</h4>
            
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Admin Username *
                </label>
                <input
                  type="text"
                  name="adminUsername"
                  value={formData.adminUsername}
                  onChange={handleChange}
                  required
                  disabled={loading}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500 disabled:bg-gray-100"
                  placeholder="Enter admin username"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Admin Email *
                </label>
                <input
                  type="email"
                  name="adminEmail"
                  value={formData.adminEmail}
                  onChange={handleChange}
                  required
                  disabled={loading}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500 disabled:bg-gray-100"
                  placeholder="admin@example.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Admin Password *
                </label>
                <input
                  type="password"
                  name="adminPassword"
                  value={formData.adminPassword}
                  onChange={handleChange}
                  required
                  disabled={loading}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500 disabled:bg-gray-100"
                  placeholder="Enter admin password"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !formData.tenantName || !formData.adminUsername || !formData.adminEmail || !formData.adminPassword}
              className="px-4 py-2 bg-purple-600 text-white rounded-md text-sm font-medium hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Creating...
                </>
              ) : (
                'Create Tenant'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}