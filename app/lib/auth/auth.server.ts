import { betterAuth } from 'better-auth'
import { admin, captcha, oneTap, organization } from 'better-auth/plugins'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { eq } from 'drizzle-orm'

import { db } from '~/lib/db'
import * as schema from '~/lib/db/schema'
import { sendEmail } from '~/lib/email/client'
import { emailVerificationEmail } from '~/lib/email/templates/email-verification'
import { passwordResetEmail } from '~/lib/email/templates/password-reset'
import { getAppUrl, getTrustedOrigins } from '~/lib/misc/app-url'

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema,
  }),

  baseURL: getAppUrl(),
  secret: process.env.BETTER_AUTH_SECRET,
  trustedOrigins: getTrustedOrigins(),

  rateLimit: {
    enabled: true,
    storage: 'memory',
    window: 60,
    max: 10,
    customRules: {
      '/api/auth/sign-in/email': { window: 60, max: 5 },
      '/api/auth/sign-up/email': { window: 300, max: 3 },
      '/api/auth/forget-password': { window: 300, max: 3 },
    },
  },

  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,

    sendResetPassword: async ({ user, url }) => {
      const email = passwordResetEmail(user.name, url)
      await sendEmail({ to: user.email, ...email })
    },

    // Security: revoke sessions on password reset.
    revokeSessionsOnPasswordReset: true,
  },

  emailVerification: {
    sendOnSignUp: true,
    sendVerificationEmail: async ({ user, url }) => {
      const email = emailVerificationEmail(user.name, url)
      await sendEmail({ to: user.email, ...email })
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
    additionalFields: {
      phone: {
        type: 'string',
        required: false,
        input: true,
      },
    },
    deleteUser: {
      enabled: true,
      // For now: require password OR a fresh session to delete.
      // Optionally, in production you can also enable email verification flow.
    },
  },

  plugins: [
    admin({
      defaultRole: 'user',
      adminRoles: ['admin'],
    }),
    ...(process.env.NODE_ENV !== 'development'
      ? [
          captcha({
            provider: 'cloudflare-turnstile' as const,
            secretKey: process.env.TURNSTILE_SECRET_KEY!,
          }),
        ]
      : []),
    oneTap(),
    organization({
      allowUserToCreateOrganization: true,
      creatorRole: 'owner',
      organizationLimit: 10,
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
            inviteCode: {
              type: 'string',
              required: false,
              input: false,
            },
            inviteEnabled: {
              type: 'boolean',
              required: false,
              input: false,
              defaultValue: false,
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
