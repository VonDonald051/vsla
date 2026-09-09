# VSLA

Production source lives in [`vsla/`](./vsla). It is a Next.js application with
WorkOS authentication and a Convex backend for real-time data.

## Production deployment

Connect this GitHub repository to a Vercel project and keep the repository
root as the project root; `vercel.json` installs and builds `vsla/`.

Set these values in Vercel for **Production**, **Preview**, and **Development**:

| Variable | Source |
| --- | --- |
| `NEXT_PUBLIC_CONVEX_URL` | Convex deployment settings |
| `WORKOS_CLIENT_ID` | WorkOS application settings |
| `WORKOS_API_KEY` | WorkOS secret key |
| `WORKOS_COOKIE_PASSWORD` | A newly generated 32+ character secret |
| `NEXT_PUBLIC_WORKOS_REDIRECT_URI` | The matching Vercel URL plus `/callback` |
| `CONVEX_DEPLOY_KEY` | Convex production or preview deploy key (CI deployment only) |

Set `WORKOS_CLIENT_ID` in the corresponding Convex deployment environment too.
Configure WorkOS redirect URLs and CORS origins for the production Vercel URL
and each preview URL. Never commit `.env.local` or deployment keys.

Run the production check locally with:

```sh
cd vsla
npm ci
npm run build
```
