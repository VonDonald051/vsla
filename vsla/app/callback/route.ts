import { handleAuth } from '@workos-inc/authkit-nextjs';
import { redirect } from 'next/navigation';

/**
 * This callback handles the WorkOS authentication response
 * It saves the user to Convex database for permanent persistence
 */
export const GET = handleAuth(async (req, { user }) => {
  // User data is now in the session
  // Data will be persisted via the middleware check when user visits authenticated pages
  
  // Redirect to dashboard or home
  return redirect('/');
});
