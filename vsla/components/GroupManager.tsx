'use client';

import { useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { useAuth } from '@workos-inc/authkit-nextjs/components';

/**
 * Example component showing how to create and manage groups
 * This demonstrates permanent data persistence with Convex
 */
export function GroupManager() {
  const { user } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    maxMembers: 50,
  });

  // Get current user data
  const userData = useQuery(api.myFunctions.getCurrentUser, {
    email: user?.email || '',
  });

  // Get all groups for current user
  const groups = useQuery(api.myFunctions.getUserGroups, {
    userId: userData?.id || '',
  });

  // Mutations for creating and managing data
  const createGroup = useMutation(api.myFunctions.createGroup);
  const createLoan = useMutation(api.myFunctions.createLoan);
  const createSavings = useMutation(api.myFunctions.createSavings);

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!userData?.id) {
      alert('User data not loaded');
      return;
    }

    try {
      await createGroup({
        name: formData.name,
        groupAdminId: userData.id,
        description: formData.description,
        maxMembers: formData.maxMembers,
      });

      // Reset form
      setFormData({ name: '', description: '', maxMembers: 50 });
      setShowForm(false);
      alert('Group created successfully! Data is permanently saved.');
    } catch (error) {
      console.error('Failed to create group:', error);
      alert('Failed to create group');
    }
  };

  if (userData === undefined || groups === undefined) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-4">Group Management</h2>

        {!showForm ? (
          <button
            onClick={() => setShowForm(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
          >
            Create New Group
          </button>
        ) : (
          <form onSubmit={handleCreateGroup} className="bg-white rounded-lg shadow p-6 max-w-md">
            <h3 className="text-xl font-bold mb-4">Create New Group</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Group Name</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                  placeholder="e.g., Community Savings Group"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                  placeholder="Describe the group's purpose"
                  rows={3}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Max Members</label>
                <input
                  type="number"
                  value={formData.maxMembers}
                  onChange={(e) => setFormData({ ...formData, maxMembers: parseInt(e.target.value) })}
                  className="w-full border rounded px-3 py-2"
                  min="1"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  className="flex-1 bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700"
                >
                  Create Group
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700"
                >
                  Cancel
                </button>
              </div>

              <p className="text-sm text-green-600">
                ✓ Data will be permanently saved to Convex database
              </p>
            </div>
          </form>
        )}
      </div>

      <div>
        <h3 className="text-xl font-bold mb-4">Your Groups ({groups?.length || 0})</h3>
        {groups && groups.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {groups.map((group) => (
              <GroupCard key={group.id} group={group} />
            ))}
          </div>
        ) : (
          <p className="text-gray-600">No groups yet. Create one to get started!</p>
        )}
      </div>
    </div>
  );
}

function GroupCard({ group }: { group: any }) {
  const [showLoans, setShowLoans] = useState(false);
  const loans = useQuery(api.myFunctions.getGroupLoans, {
    groupId: group.id,
  });

  const savings = useQuery(api.myFunctions.getGroupSavings, {
    groupId: group.id,
  });

  const totalLoaned = loans?.reduce((sum, loan) => sum + (loan.totalOwed || 0), 0) || 0;
  const totalSaved = savings?.reduce((sum, saving) => sum + (saving.amount || 0), 0) || 0;

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h4 className="text-lg font-bold">{group.name}</h4>
      <p className="text-sm text-gray-600 mb-4">{group.description}</p>

      <div className="space-y-2 mb-4">
        <div className="flex justify-between text-sm">
          <span>Max Members:</span>
          <span className="font-semibold">{group.maxMembers}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span>Total Loaned:</span>
          <span className="font-semibold text-red-600">${totalLoaned.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span>Total Savings:</span>
          <span className="font-semibold text-green-600">${totalSaved.toFixed(2)}</span>
        </div>
      </div>

      <button
        onClick={() => setShowLoans(!showLoans)}
        className="w-full bg-blue-500 text-white px-3 py-2 rounded-md text-sm hover:bg-blue-600"
      >
        {showLoans ? 'Hide' : 'View'} Transactions
      </button>

      {showLoans && (
        <div className="mt-4 space-y-2 border-t pt-4">
          <p className="text-sm font-semibold">Loans ({loans?.length || 0})</p>
          {loans && loans.length > 0 ? (
            loans.map((loan) => (
              <div key={loan.id} className="text-xs bg-red-50 p-2 rounded">
                <div className="flex justify-between">
                  <span>${loan.amount}</span>
                  <span className="text-red-600">{loan.status}</span>
                </div>
              </div>
            ))
          ) : (
            <p className="text-xs text-gray-500">No loans yet</p>
          )}

          <p className="text-sm font-semibold mt-3">Savings ({savings?.length || 0})</p>
          {savings && savings.length > 0 ? (
            savings.map((saving) => (
              <div key={saving.id} className="text-xs bg-green-50 p-2 rounded">
                <div className="flex justify-between">
                  <span>${saving.amount}</span>
                  <span className="text-green-600">{saving.week}</span>
                </div>
              </div>
            ))
          ) : (
            <p className="text-xs text-gray-500">No savings yet</p>
          )}
        </div>
      )}
    </div>
  );
}
