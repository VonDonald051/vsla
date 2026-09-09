import { handleAuth } from '@workos-inc/authkit-nextjs';

/**
 * This callback handles the WorkOS authentication response
 * It saves the user to Convex database for permanent persistence.
 * The default AuthKit callback redirects to the configured return path.
 */
export const GET = handleAuth({
  returnPathname: '/',
});
