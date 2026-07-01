/**
 * Billing Demo Component V1.1
 * 
 * Demo component showing how to use the billing API.
 * This component can be used as a reference for implementing
 * billing features in the actual application.
 */

import React, { useState } from 'react';
import { billingAPI, useBilling, BillingError } from '../lib/billing-api';

export function BillingDemo() {
  const [code, setCode] = useState('');
  const [tenantId, setTenantId] = useState('');
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const { loading, activateSubscription, getStatus, checkRateLimit } = useBilling();

  const handleActivate = async () => {
    setError(null);
    setResult(null);

    try {
      const response = await activateSubscription({
        code,
        tenant_id: tenantId,
        idempotency_key: crypto.randomUUID(),
      });

      setResult(response);
    } catch (err) {
      const billingError = err as BillingError;
      setError(`${billingError.code}: ${billingError.message}`);
    }
  };

  const handleCheckStatus = async () => {
    setError(null);
    setResult(null);

    try {
      const status = await getStatus(tenantId);
      setResult(status);
    } catch (err) {
      const billingError = err as BillingError;
      setError(`${billingError.code}: ${billingError.message}`);
    }
  };

  const handleCheckRateLimit = async () => {
    setError(null);
    setResult(null);

    try {
      const limit = await checkRateLimit(tenantId);
      setResult(limit);
    } catch (err) {
      const billingError = err as BillingError;
      setError(`${billingError.code}: ${billingError.message}`);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <h1 className="text-3xl font-bold mb-6 text-gray-800">
        Billing System V1.1 Demo
      </h1>

      {/* Input Section */}
      <div className="space-y-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Voucher Code
          </label>
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="e.g., BASIC-2026-001"
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Tenant ID
          </label>
          <input
            type="text"
            value={tenantId}
            onChange={(e) => setTenantId(e.target.value)}
            placeholder="e.g., tenant-123"
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-3 mb-6">
        <button
          onClick={handleActivate}
          disabled={loading || !code || !tenantId}
          className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Activating...' : 'Activate Subscription'}
        </button>

        <button
          onClick={handleCheckStatus}
          disabled={loading || !tenantId}
          className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Checking...' : 'Check Status'}
        </button>

        <button
          onClick={handleCheckRateLimit}
          disabled={loading || !tenantId}
          className="px-6 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Checking...' : 'Check Rate Limit'}
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
          <p className="text-red-800 font-medium">Error:</p>
          <p className="text-red-600">{error}</p>
        </div>
      )}

      {/* Result Display */}
      {result && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-md">
          <p className="text-green-800 font-medium mb-2">Result:</p>
          <pre className="text-sm text-green-700 overflow-auto">
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}

      {/* Info Section */}
      <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-md">
        <h2 className="text-lg font-semibold text-blue-900 mb-2">
          Test Voucher Codes
        </h2>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• BASIC-2026-001 (Basic plan, 30 days)</li>
          <li>• STANDARD-2026-001 (Standard plan, 30 days)</li>
          <li>• PREMIUM-2026-001 (Premium plan, 30 days)</li>
          <li>• TRIAL-7DAYS-001 (Basic plan, 7 days trial)</li>
          <li>• YEARLY-001 (Basic plan, 365 days)</li>
        </ul>
      </div>

      {/* Usage Example */}
      <div className="mt-6 p-4 bg-gray-50 border border-gray-200 rounded-md">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">
          Usage Example
        </h2>
        <pre className="text-sm text-gray-700 overflow-auto">
{`import { useBilling } from '../lib/billing-api';

function MyComponent() {
  const { activateSubscription, getStatus } = useBilling();

  const handleActivate = async () => {
    try {
      const result = await activateSubscription({
        code: 'BASIC-2026-001',
        tenant_id: 'tenant-123',
        idempotency_key: crypto.randomUUID()
      });
      console.log('Activated:', result);
    } catch (error) {
      console.error('Failed:', error);
    }
  };

  return <button onClick={handleActivate}>Activate</button>;
}`}
        </pre>
      </div>
    </div>
  );
}

export default BillingDemo;