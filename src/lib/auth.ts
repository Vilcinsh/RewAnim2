import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { findUserByCredentials } from './users';
import { authConfig } from './auth.config';

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        username: { label: 'Username', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      authorize(credentials) {
        if (!credentials?.username || !credentials?.password) return null;
        const user = findUserByCredentials(
          credentials.username as string,
          credentials.password as string
        );
        if (!user) return null;
        return {
          id: String(user.id),
          name: user.username,
          role: user.role,
        };
      },
    }),
  ],
});
