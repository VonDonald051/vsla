'use client';

import { Authenticated, Unauthenticated, useMutation, useQuery } from 'convex/react';
import { api } from '../convex/_generated/api';
import { useAuth } from '@workos-inc/authkit-nextjs/components';
import { useEffect } from 'react';
import type { User } from '@workos-inc/node';
import { GroupManager } from '@/components/GroupManager';

export default function Home() {
  const { user, signOut } = useAuth();
  const upsertUser = useMutation(api.myFunctions.upsertCurrentUser);

  useEffect(() => {
    if (user) {
      upsertUser({}).catch((error) => {
        console.error('Failed to upsert user:', error);
      });
    }
  }, [user, upsertUser]);

  return (
    <>
      <header className="sticky top-0 z-10 bg-slate-950 text-white px-6 py-4 shadow-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-emerald-300">VSLA</p>
            <h1 className="text-xl font-bold">Village Savings & Loan Association</h1>
          </div>
          {user && <UserMenu user={user} onSignOut={signOut} />}
        </div>
      </header>

      <main className="mx-auto max-w-6xl p-6 md:p-8">
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
    <div className="mx-auto flex max-w-xl flex-col gap-8 py-20 text-center">
      <div>
        <p className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-emerald-600">
          Welcome back
        </p>
        <h2 className="text-4xl font-bold text-slate-900">Manage your VSLA with confidence</h2>
      </div>

      <p className="text-lg text-slate-600">
        Track group savings, record loans, monitor contributions, and keep your members aligned.
      </p>

      <div className="grid gap-4 md:grid-cols-2">
        <a href="/sign-in" className="block">
          <button className="w-full rounded-xl bg-slate-900 px-5 py-3 text-base font-semibold text-white transition hover:bg-slate-700">
            Sign In
          </button>
        </a>
        <a href="/sign-up" className="block">
          <button className="w-full rounded-xl bg-emerald-600 px-5 py-3 text-base font-semibold text-white transition hover:bg-emerald-500">
            Sign Up
          </button>
        </a>
      </div>
    </div>
  );
}

function Dashboard() {
  const { user } = useAuth();
  const userData = useQuery(api.myFunctions.getCurrentUser, {});

  const groups = useQuery(api.myFunctions.getUserGroups, userData ? {} : 'skip');

  if (userData === undefined || groups === undefined) {
    return <div className="py-16 text-center text-slate-600">Loading dashboard...</div>;
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-emerald-600">Overview</p>
          <h2 className="text-3xl font-bold text-slate-900">
            Welcome back, {userData?.firstName || 'Member'}
          </h2>
        </div>
        <p className="text-sm text-slate-600">
          Your VSLA operations are stored in Convex and synced in real time.
        </p>
      </div>

      <GroupManager />
    </div>
  );
}

function UserMenu({ user, onSignOut }: { user: User; onSignOut: () => void }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-slate-200">{user.email}</span>
      <button
        onClick={() => onSignOut()}
        className="rounded-lg bg-white px-3 py-2 text-sm font-medium text-slate-900 transition hover:bg-slate-200"
      >
        Sign Out
      </button>
    </div>
  );
}
