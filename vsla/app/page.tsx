'use client';

import { Authenticated, Unauthenticated, useMutation, useQuery } from 'convex/react';
import { api } from '../convex/_generated/api';
import Link from 'next/link';
import { useAuth } from '@workos-inc/authkit-nextjs/components';
import { useEffect } from 'react';
import type { User } from '@workos-inc/node';

export default function Home() {
  const { user, signOut } = useAuth();
  const upsertUser = useMutation(api.myFunctions.upsertUserFromWorkOS);

  // Persist user data to Convex database when authenticated
  useEffect(() => {
    if (user && user.email) {
      upsertUser({
        workosId: user.id || '',
        email: user.email,
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        profilePicture: user.profilePictureUrl || undefined,
      }).catch((error) => {
        console.error('Failed to upsert user:', error);
      });
    }
  }, [user, upsertUser]);

  return (
    <>
      <header className="sticky top-0 z-10 bg-background p-4 border-b-2 border-slate-200 dark:border-slate-800 flex flex-row justify-between items-center">
        <h1>VSLA - Village Savings & Loan Association</h1>
        {user && <UserMenu user={user} onSignOut={signOut} />}
      </header>
      <main className="p-8 flex flex-col gap-8">
        <Authenticated>
          <Dashboard />
        </Authenticated>
        <Unauthenticated>
          <SignInForm />
        </Unauthenticated>
      </main>
    </>
  );
}

function SignInForm() {
  return (
    <div className="flex flex-col gap-8 w-96 mx-auto py-16">
      <div className="text-center">
        <h2 className="text-3xl font-bold mb-4">Welcome to VSLA</h2>
        <p className="text-gray-600 mb-8">Village Savings & Loan Association Management System</p>
        <p className="mb-8">Log in to manage your groups, loans, and savings</p>
      </div>
      <div className="flex gap-4">
        <a href="/sign-in" className="flex-1">
          <button className="w-full bg-blue-600 text-white px-4 py-3 rounded-md hover:bg-blue-700">
            Sign In
          </button>
        </a>
        <a href="/sign-up" className="flex-1">
          <button className="w-full bg-green-600 text-white px-4 py-3 rounded-md hover:bg-green-700">
            Sign Up
          </button>
        </a>
      </div>
    </div>
  );
}

function Dashboard() {
  const { user } = useAuth();
  const userData = useQuery(api.myFunctions.getCurrentUser, {
    email: user?.email || '',
  });
  
  const groups = useQuery(api.myFunctions.getUserGroups, {
    userId: userData?.id || '',
  });

  if (userData === undefined || groups === undefined) {
    return <div className="text-center py-8">Loading...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h2 className="text-2xl font-bold">Welcome, {userData?.firstName || 'User'}!</h2>
        <p className="text-gray-600">Your data is permanently saved in the database</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <Card title="My Groups" count={groups?.length || 0} />
        <Card title="Account Status" value="Active" />
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-xl font-bold mb-4">Your Groups</h3>
        {groups && groups.length > 0 ? (
          <div className="space-y-4">
            {groups.map((group) => (
              <div key={group.id} className="border rounded p-4">
                <h4 className="font-semibold">{group.name}</h4>
                <p className="text-sm text-gray-600">{group.description}</p>
                <p className="text-sm mt-2">Max Members: {group.maxMembers}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-600">No groups yet. Create one to get started!</p>
        )}
      </div>
    </div>
  );
}

function Card({ title, count, value }: { title: string; count?: number; value?: string }) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <p className="text-gray-600 text-sm">{title}</p>
      <p className="text-3xl font-bold">{count !== undefined ? count : value}</p>
    </div>
  );
}

function UserMenu({ user, onSignOut }: { user: User; onSignOut: () => void }) {
  return (
    <div className="flex items-center gap-4">
      <span className="text-sm">{user.email}</span>
      <button
        onClick={() => onSignOut()}
        className="bg-red-600 text-white px-3 py-2 rounded-md text-sm hover:bg-red-700"
      >
        Sign Out
      </button>
    </div>
  );
}
