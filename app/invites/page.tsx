'use client';

import { useState, useEffect } from 'react';
import { useSession } from '@/lib/auth/client';
import { useRouter } from 'next/navigation';

interface Invite {
  id: number;
  code: string;
  email: string | null;
  used_by: string | null;
  created_by: string;
  used_at: string | null;
  created_at: string;
  expires_at: string;
}

interface ApiKey {
  id: string;
  name: string | null;
  prefix: string | null;
  createdAt: string;
}

export default function InvitesPage() {
  const { data: session, isPending } = useSession();
  const router = useRouter();
  
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [email, setEmail] = useState('');
  const [expiresInDays, setExpiresInDays] = useState(7);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [apiKeyName, setApiKeyName] = useState('');
  const [newApiKey, setNewApiKey] = useState('');
  const [creatingKey, setCreatingKey] = useState(false);
  const [keyError, setKeyError] = useState('');

  useEffect(() => {
    if (!isPending && !session) {
      router.push('/login');
    }
  }, [session, isPending, router]);

  useEffect(() => {
    if (session) {
      fetchInvites();
      fetchApiKeys();
    }
  }, [session]);

  const fetchInvites = async () => {
    try {
      const response = await fetch('/api/invites');
      if (response.ok) {
        const data = await response.json();
        setInvites(data);
      } else {
        setError('You do not have permission to view invites');
      }
    } catch (err) {
      setError('Failed to fetch invites');
    } finally {
      setLoading(false);
    }
  };

  const fetchApiKeys = async () => {
    try {
      const response = await fetch('/api/api-keys');
      if (response.ok) {
        const data = await response.json();
        setApiKeys(data);
      }
    } catch (err) {
      console.error('Failed to fetch API keys');
    }
  };

  const createInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setCreating(true);

    try {
      const response = await fetch('/api/invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email || null, expiresInDays }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(`Invite created! Share this URL: ${data.inviteUrl}`);
        setEmail('');
        fetchInvites();
      } else {
        setError(data.error || 'Failed to create invite');
      }
    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
      setCreating(false);
    }
  };

  const createApiKey = async (e: React.FormEvent) => {
    e.preventDefault();
    setKeyError('');
    setNewApiKey('');
    setCreatingKey(true);

    try {
      const response = await fetch('/api/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: apiKeyName || 'Generated API Key' }),
      });

      const data = await response.json();

      if (response.ok) {
        setNewApiKey(data.key);
        setApiKeyName('');
        fetchApiKeys();
      } else {
        setKeyError(data.error || 'Failed to create API key');
      }
    } catch (err) {
      setKeyError('An unexpected error occurred');
    } finally {
      setCreatingKey(false);
    }
  };

  const deleteApiKey = async (id: string) => {
    if (!confirm('Are you sure you want to delete this API key?')) return;
    try {
      const response = await fetch(`/api/api-keys?id=${id}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        fetchApiKeys();
      } else {
        alert('Failed to delete API key');
      }
    } catch (err) {
      alert('An unexpected error occurred');
    }
  };

  if (isPending || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <div className="min-h-screen p-4 sm:p-8 bg-gray-50">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900">Manage Settings</h1>
          <a
            href="/"
            className="w-full sm:w-auto text-center px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition"
          >
            Back to App
          </a>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Create Invite Form */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-semibold mb-4 text-gray-900">Create New Invite</h2>
            
            {error && (
              <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                {error}
              </div>
            )}

            {success && (
              <div className="mb-4 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded break-all">
                {success}
                <button
                  onClick={() => navigator.clipboard.writeText(success.split(': ')[1])}
                  className="ml-2 text-sm underline font-medium"
                >
                  Copy URL
                </button>
              </div>
            )}

            <form onSubmit={createInvite} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email (optional)
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="friend@example.com"
                />
                <p className="text-xs text-gray-500 mt-1">
                  If specified, only this email can use the invite
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Expires in (days)
                </label>
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={expiresInDays}
                  onChange={(e) => setExpiresInDays(parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <button
                type="submit"
                disabled={creating}
                className="w-full px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
              >
                {creating ? 'Creating...' : 'Create Invite'}
              </button>
            </form>
          </div>

          {/* Create API Key Form */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-semibold mb-4 text-gray-900">Generate API Key</h2>
            
            {keyError && (
              <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                {keyError}
              </div>
            )}

            {newApiKey && (
              <div className="mb-4 bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded break-all">
                <p className="font-bold text-sm mb-1">⚠️ Copy this key now! You will not be able to see it again.</p>
                <div className="font-mono bg-white p-2 border border-yellow-300 rounded flex justify-between items-center">
                  <span>{newApiKey}</span>
                  <button
                    onClick={() => navigator.clipboard.writeText(newApiKey)}
                    className="ml-2 text-sm bg-yellow-200 hover:bg-yellow-300 px-2 py-1 rounded transition"
                  >
                    Copy
                  </button>
                </div>
              </div>
            )}

            <form onSubmit={createApiKey} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Key Name
                </label>
                <input
                  type="text"
                  value={apiKeyName}
                  onChange={(e) => setApiKeyName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. GitHub Actions Cron"
                />
              </div>

              <button
                type="submit"
                disabled={creatingKey}
                className="w-full px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition disabled:opacity-50"
              >
                {creatingKey ? 'Generating...' : 'Generate Key'}
              </button>
            </form>
          </div>
        </div>

        {/* API Keys List */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
          <h2 className="text-2xl font-semibold mb-4 text-gray-900">Your API Keys</h2>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-gray-700">Name</th>
                  <th className="text-left py-3 px-4 text-gray-700">Prefix</th>
                  <th className="text-left py-3 px-4 text-gray-700">Created</th>
                  <th className="text-right py-3 px-4 text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {apiKeys.map((key) => (
                  <tr key={key.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4 font-medium">{key.name || 'Unnamed Key'}</td>
                    <td className="py-3 px-4 font-mono text-sm text-gray-500">{key.prefix || 'N/A'}</td>
                    <td className="py-3 px-4 text-sm">
                      {new Date(key.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => deleteApiKey(key.id)}
                        className="text-red-600 hover:text-red-800 text-sm font-medium"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {apiKeys.length === 0 && (
            <div className="text-center py-8 text-gray-500">No API keys generated yet</div>
          )}
        </div>

        {/* Invites List */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-2xl font-semibold mb-4 text-gray-900">All Invites</h2>
          
          {/* Mobile View: Cards */}
          <div className="md:hidden space-y-4">
            {invites.map((invite) => {
              const isExpired = new Date(invite.expires_at) < new Date();
              const isUsed = !!invite.used_by;

              return (
                <div key={invite.id} className="p-4 border border-gray-100 rounded-lg bg-gray-50 shadow-sm">
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-mono text-xs text-gray-500">
                      {invite.code.substring(0, 8)}...
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-medium ${
                        isUsed
                          ? 'bg-green-100 text-green-800'
                          : isExpired
                          ? 'bg-red-100 text-red-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}
                    >
                      {isUsed ? 'Used' : isExpired ? 'Expired' : 'Active'}
                    </span>
                  </div>
                  <div className="space-y-1">
                    <div className="text-sm font-medium text-gray-900 truncate">
                      {invite.email || 'Open to anyone'}
                    </div>
                    {isUsed && (
                      <div className="text-xs text-gray-600">
                        Used by: {invite.used_by}
                      </div>
                    )}
                    <div className="flex justify-between text-xs text-gray-500 pt-1">
                      <span>Created: {new Date(invite.created_at).toLocaleDateString()}</span>
                      <span>Expires: {new Date(invite.expires_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop View: Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-gray-700">Code</th>
                  <th className="text-left py-3 px-4 text-gray-700">Email</th>
                  <th className="text-left py-3 px-4 text-gray-700">Status</th>
                  <th className="text-left py-3 px-4 text-gray-700">Used By</th>
                  <th className="text-left py-3 px-4 text-gray-700">Created</th>
                  <th className="text-left py-3 px-4 text-gray-700">Expires</th>
                </tr>
              </thead>
              <tbody>
                {invites.map((invite) => {
                  const isExpired = new Date(invite.expires_at) < new Date();
                  const isUsed = !!invite.used_by;

                  return (
                    <tr key={invite.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4 font-mono text-sm">{invite.code.substring(0, 8)}...</td>
                      <td className="py-3 px-4">{invite.email || '-'}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-1 rounded text-sm ${
                            isUsed
                              ? 'bg-green-100 text-green-800'
                              : isExpired
                              ? 'bg-red-100 text-red-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}
                        >
                          {isUsed ? 'Used' : isExpired ? 'Expired' : 'Active'}
                        </span>
                      </td>
                      <td className="py-3 px-4">{invite.used_by || '-'}</td>
                      <td className="py-3 px-4 text-sm">
                        {new Date(invite.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4 text-sm">
                        {new Date(invite.expires_at).toLocaleDateString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {invites.length === 0 && (
            <div className="text-center py-8 text-gray-500">No invites yet</div>
          )}
        </div>
      </div>
    </div>
  );
}
