import { betterAuth } from 'better-auth'
import { oneTap, organization } from 'better-auth/plugins'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { eq } from 'drizzle-orm'

import { db } from '~/lib/db'
import * as schema from '~/lib/db/schema'
import { getAppUrl, getTrustedOrigins } from '~/lib/get-app-url'

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema,
  }),

  baseURL: getAppUrl(),
  secret: process.env.BETTER_AUTH_SECRET,
  trustedOrigins: getTrustedOrigins(),

  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,

    // TODO: integrate Resend to send password reset emails in production.
    sendResetPassword: async ({ user, url }) => {
      if (process.env.NODE_ENV === 'development') {
        console.log(`[auth] Password reset for ${user.email}: ${url}`)
      }
    },

    // Security: revoke sessions on password reset.
    revokeSessionsOnPasswordReset: true,
  },

  emailVerification: {
    sendOnSignUp: true,
    sendVerificationEmail: async ({ user, url }) => {
      // TODO: integrate Resend to send verification emails
      if (process.env.NODE_ENV === 'development') {
        console.log(`[auth] Verification email for ${user.email}: ${url}`)
      }
    },
  },

  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    },
  },

  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ['google'],
    },
  },

  user: {
    deleteUser: {
      enabled: true,
      // For now: require password OR a fresh session to delete.
      // Optionally, in production you can also enable email verification flow.
    },
  },

  plugins: [
    oneTap(),
    organization({
      allowUserToCreateOrganization: true,
      creatorRole: 'owner',
      organizationLimit: 1,
      membershipLimit: 100,
      schema: {
        organization: {
          fields: {
            name: 'name',
            slug: 'slug',
          },
          additionalFields: {
            city: {
              type: 'string',
              required: false,
              input: true,
            },
            totalFractions: {
              type: 'string',
              required: false,
              input: true,
            },
            notes: {
              type: 'string',
              required: false,
              input: true,
            },
            language: {
              type: 'string',
              required: false,
              input: true,
              defaultValue: 'pt-PT',
            },
            timezone: {
              type: 'string',
              required: false,
              input: true,
              defaultValue: 'Europe/Lisbon',
            },
          },
        },
      },
    }),
  ],

  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // refresh every 24h
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5, // 5 minutes
    },
  },

  databaseHooks: {
    session: {
      create: {
        before: async (session) => {
          if (!session.activeOrganizationId) {
            const [membership] = await db
              .select({ organizationId: schema.member.organizationId })
              .from(schema.member)
              .where(eq(schema.member.userId, session.userId))
              .limit(1)

            if (membership) {
              return { data: { ...session, activeOrganizationId: membership.organizationId } }
            }
          }
          return { data: session }
        },
      },
    },
  },
})

export type Session = typeof auth.$Infer.Session
