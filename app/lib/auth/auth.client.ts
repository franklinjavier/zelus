import { createAuthClient } from 'better-auth/react'
import { adminClient, organizationClient, oneTapClient } from 'better-auth/client/plugins'

export const authClient = createAuthClient({
  baseURL: typeof window !== 'undefined' ? window.location.origin : process.env.BETTER_AUTH_URL,
  plugins: [
    adminClient(),
    organizationClient(),
    oneTapClient({
      clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID,
      promptOptions: {
        fedCM: false,
      },
      additionalOptions: {
        use_fedcm_for_prompt: false,
      },
    }),
  ],
})

export const {
  signIn,
  signUp,
  signOut,
  useSession,
  organization,
  useActiveOrganization,
  useListOrganizations,
  admin,
} = authClient
