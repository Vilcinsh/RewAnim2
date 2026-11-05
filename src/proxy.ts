import NextAuth from 'next-auth';
import { authConfig } from '@/lib/auth.config';

// Next 16 renamed the `middleware` file convention to `proxy`. Redirects
// signed-out visitors to /login (see `authorized` in auth.config).
export default NextAuth(authConfig).auth;

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
