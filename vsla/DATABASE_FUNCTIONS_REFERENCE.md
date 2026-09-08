# VSLA Database Functions - Quick Reference

## User Management

### Save User (Automatic on Login)
```typescript
const upsertUser = useMutation(api.myFunctions.upsertUserFromWorkOS);

upsertUser({
  workosId: user.id,
  email: user.email,
  firstName: user.firstName,
  lastName: user.lastName,
  profilePicture: user.profilePictureUrl,
});
// ✓ User is now permanently saved
```

### Get Current User
```typescript
const user = useQuery(api.myFunctions.getCurrentUser, {
  email: userEmail,
});
// Returns: { id, email, firstName, lastName, profilePic, ... }
```

### Get User by ID
```typescript
const user = useQuery(api.myFunctions.getUserById, {
  userId: 'uuid-here',
});
```

---

## Group Management

### Create Group
```typescript
const createGroup = useMutation(api.myFunctions.createGroup);

const groupId = await createGroup({
  name: 'Community Savings Circle',
  groupAdminId: currentUserId,
  description: 'Weekly savings group',
  maxMembers: 50,
});
// ✓ Group created and saved permanently
```

### Get All User's Groups
```typescript
const groups = useQuery(api.myFunctions.getUserGroups, {
  userId: currentUserId,
});
// Returns: [{ id, name, description, maxMembers, ... }, ...]
```

### Get Group Details
```typescript
const group = useQuery(api.myFunctions.getGroupById, {
  groupId: 'group-id-here',
});
// Returns: { id, name, groupAdminId, maxMembers, description, ... }
```

---

## Loan Management

### Create Loan
```typescript
const createLoan = useMutation(api.myFunctions.createLoan);

const loanId = await createLoan({
  userId: borrowerId,
  groupId: groupId,
  type: 'personal',              // or 'business', 'emergency', etc.
  amount: 5000,                  // loan amount
  profit: 500,                   // interest/profit
  dueDate: '2025-01-15',         // YYYY-MM-DD format
  dailyPenaltyRate: 0.01,        // 1% per day late penalty
  itemName: 'Motorcycle',        // optional
  requestedByRole: 'member',     // who's requesting
});
// ✓ Loan recorded, totalOwed = amount + profit = 5500
```

### Get All Group Loans
```typescript
const loans = useQuery(api.myFunctions.getGroupLoans, {
  groupId: groupId,
});
// Returns: [{ id, userId, amount, profit, totalOwed, status, ... }, ...]
// status: 'pending' | 'approved' | 'rejected' | 'paid'
```

### Update Loan Status
```typescript
const updateLoan = useMutation(api.myFunctions.updateLoanStatus);

await updateLoan({
  loanId: loanId,
  status: 'approved',           // or 'rejected', 'paid'
  approvedBy: adminUserId,      // admin who approved
});
// ✓ Loan status updated and saved
```

---

## Savings Management

### Record Savings
```typescript
const createSavings = useMutation(api.myFunctions.createSavings);

const savingId = await createSavings({
  userId: savingMemberId,
  groupId: groupId,
  amount: 500,
  type: 'weekly',                // or 'monthly', 'special'
  week: 'Week 1 January 2025',
});
// ✓ Savings recorded permanently
```

### Get All Group Savings
```typescript
const savings = useQuery(api.myFunctions.getGroupSavings, {
  groupId: groupId,
});
// Returns: [{ id, userId, amount, type, week, ... }, ...]

// Calculate total group savings:
const total = savings?.reduce((sum, s) => sum + s.amount, 0) || 0;
```

---

## Fine Management

### Record Fine
```typescript
const createFine = useMutation(api.myFunctions.createFine);

const fineId = await createFine({
  userId: memberId,
  groupId: groupId,
  amount: 100,
  reason: 'Missed meeting - absent without notice',
});
// ✓ Fine recorded permanently
// status defaults to 'unpaid'
```

### Get All Group Fines
```typescript
const fines = useQuery(api.myFunctions.getGroupFines, {
  groupId: groupId,
});
// Returns: [{ id, userId, amount, reason, status, ... }, ...]
// status: 'unpaid' | 'paid'

// Total unpaid fines:
const unpaid = fines
  ?.filter(f => f.status === 'unpaid')
  .reduce((sum, f) => sum + f.amount, 0) || 0;
```

---

## Chat & Messages

### Send Message
```typescript
const sendMessage = useMutation(api.myFunctions.sendMessage);

const messageId = await sendMessage({
  groupId: groupId,
  senderId: currentUserId,
  senderName: 'John Doe',
  message: 'Next meeting is on Friday at 2 PM',
});
// ✓ Message saved permanently
```

### Get Group Chat History
```typescript
const messages = useQuery(api.myFunctions.getGroupMessages, {
  groupId: groupId,
});
// Returns: [{ id, groupId, senderId, senderName, message, ... }, ...]
// Sorted by creation time (oldest first)
```

---

## Common Patterns

### Calculate Group Statistics
```typescript
async function getGroupStats(groupId: string) {
  const loans = useQuery(api.myFunctions.getGroupLoans, { groupId });
  const savings = useQuery(api.myFunctions.getGroupSavings, { groupId });
  const fines = useQuery(api.myFunctions.getGroupFines, { groupId });

  const stats = {
    totalLoaned: loans?.reduce((s, l) => s + l.totalOwed, 0) || 0,
    pendingLoans: loans?.filter(l => l.status === 'pending').length || 0,
    totalSaved: savings?.reduce((s, sv) => s + sv.amount, 0) || 0,
    totalFines: fines?.reduce((s, f) => s + f.amount, 0) || 0,
    unpaidFines: fines?.filter(f => f.status === 'unpaid').reduce((s, f) => s + f.amount, 0) || 0,
  };

  return stats;
}
```

### Get User's Financial Summary
```typescript
function UserFinancialSummary({ userId }: { userId: string }) {
  const loans = useQuery(api.myFunctions.getUserLoans, { userId });
  const savings = useQuery(api.myFunctions.getUserSavings, { userId });

  const totalBorrowed = loans?.reduce((s, l) => s + l.amount, 0) || 0;
  const totalOwed = loans?.reduce((s, l) => s + l.totalOwed, 0) || 0;
  const totalSaved = savings?.reduce((s, sv) => s + sv.amount, 0) || 0;

  return (
    <div>
      <p>Borrowed: ${totalBorrowed}</p>
      <p>Still Owe: ${totalOwed}</p>
      <p>Saved: ${totalSaved}</p>
    </div>
  );
}
```

### Complete Loan Flow
```typescript
async function completeLoanFlow(groupId, borrowerId, loanAmount) {
  // Step 1: Create loan
  const loan = await createLoan({
    userId: borrowerId,
    groupId,
    type: 'personal',
    amount: loanAmount,
    profit: loanAmount * 0.1, // 10% interest
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    dailyPenaltyRate: 0.01,
  });

  // Step 2: Admin approves
  await updateLoanStatus({
    loanId: loan,
    status: 'approved',
    approvedBy: adminId,
  });

  // Step 3: Send notification
  await sendMessage({
    groupId,
    senderId: adminId,
    senderName: 'Admin',
    message: `Loan of $${loanAmount} approved for member`,
  });

  return loan;
}
```

---

## Data Types

### User
```typescript
{
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  profilePic?: string;
  role: 'member' | 'admin';
  createdAt: string;  // ISO timestamp
  updatedAt: string;
}
```

### Group
```typescript
{
  id: string;
  name: string;
  groupAdminId: string;
  maxMembers: number;
  description?: string;
  createdAt: string;
  updatedAt: string;
}
```

### Loan
```typescript
{
  id: string;
  userId: string;
  groupId: string;
  type: string;
  amount: number;
  profit: number;
  totalOwed: number;
  dueDate: string;
  status: 'pending' | 'approved' | 'rejected' | 'paid';
  dailyPenaltyRate: number;
  createdAt: string;
  approvedBy?: string;
  approvedAt?: string;
}
```

### Savings
```typescript
{
  id: string;
  userId: string;
  groupId: string;
  amount: number;
  type: string;
  week: string;
  createdAt: string;
  updatedAt: string;
}
```

### Message
```typescript
{
  id: string;
  groupId: string;
  senderId: string;
  senderName: string;
  message: string;
  createdAt: string;
}
```

---

## Notes

- All data is **automatically saved** to Convex database
- **No manual database setup** needed - just use mutations
- Data persists **forever** - not tied to sessions
- All functions are **production-ready**
- Use `useQuery` for reading, `useMutation` for writing
- Wrap components in `<Authenticated>` tag if they need login

---

## Getting Help

Error: "Function not found"?
→ Make sure `convex/myFunctions.ts` is deployed

Error: "User not authenticated"?
→ User needs to login first with WorkOS

Data not showing?
→ Check Convex dashboard: https://dashboard.convex.dev

Lost data after logout?
→ That's normal - logout clears session but database is permanent
→ Login again → data loads from database
