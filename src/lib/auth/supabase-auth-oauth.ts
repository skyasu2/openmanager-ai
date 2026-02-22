'use client';

import type { AuthError } from '@supabase/supabase-js';
import { logger } from '@/lib/logging';
import { validateRedirectUrl } from '@/lib/security/secure-cookies';
import { getSupabase } from '../supabase/client';

type OAuthProvider = 'github' | 'google';

type OAuthSignInResult = {
  data: unknown | null;
  error: AuthError | Error | unknown;
};

const getClient = () => getSupabase();

function getOAuthRedirectUrl(): string {
  const origin = window.location.origin;
  const redirectUrl = `${origin}/auth/callback`;

  if (!validateRedirectUrl(redirectUrl)) {
    throw new Error(
      `보안상 허용되지 않은 리다이렉트 URL입니다: ${redirectUrl}`
    );
  }

  logger.info('🔗 OAuth 리다이렉트 URL:', redirectUrl);
  logger.info('🌍 현재 환경:', {
    origin,
    isVercel: origin.includes('vercel.app'),
    isLocal: origin.includes('localhost'),
    redirectUrl,
    supabaseConfigured: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
  });

  return redirectUrl;
}

function validateSupabaseEnv(): void {
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL.includes('test')
  ) {
    throw new Error('Supabase URL이 올바르게 설정되지 않았습니다.');
  }

  if (!supabaseKey || supabaseKey.includes('test')) {
    throw new Error(
      'Supabase Publishable/Anon Key가 올바르게 설정되지 않았습니다.'
    );
  }
}

export async function signInWithOAuthProvider(
  provider: OAuthProvider
): Promise<OAuthSignInResult> {
  const providerName = provider === 'github' ? 'GitHub' : 'Google';

  try {
    const redirectUrl = getOAuthRedirectUrl();
    validateSupabaseEnv();

    const options =
      provider === 'github'
        ? {
            redirectTo: redirectUrl,
            scopes: 'read:user user:email',
            skipBrowserRedirect: false,
          }
        : {
            redirectTo: redirectUrl,
            scopes: 'email profile openid',
            queryParams: {
              access_type: 'offline',
              prompt: 'consent',
            },
            skipBrowserRedirect: false,
          };

    if (provider === 'github') {
      logger.info('⚠️ 필요한 설정:');
      logger.info('  Supabase Redirect URLs:', redirectUrl);
      logger.info(
        '  GitHub OAuth Callback:',
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/callback`
      );
    }

    const { data, error } = await getClient().auth.signInWithOAuth({
      provider,
      options,
    });

    if (error) {
      logger.error(`❌ ${providerName} OAuth 로그인 실패:`, error);
      logger.error('🔧 디버깅 정보:', {
        provider,
        errorCode: error.code,
        errorMessage: error.message,
        supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
        redirectUrl,
      });
      throw error;
    }

    logger.info(`✅ ${providerName} OAuth 로그인 요청 성공`);
    return { data, error: null };
  } catch (error) {
    logger.error(`❌ ${providerName} OAuth 로그인 에러:`, error);
    return { data: null, error };
  }
}

export async function signInWithEmailMagicLink(
  email: string
): Promise<OAuthSignInResult> {
  try {
    const redirectUrl = getOAuthRedirectUrl();
    validateSupabaseEnv();

    logger.info(`📧 Email Magic Link 전송 시작: ${email}`);

    const { data, error } = await getClient().auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: redirectUrl,
      },
    });

    if (error) {
      logger.error('❌ Email Magic Link 전송 실패:', error);
      throw error;
    }

    logger.info('✅ Email Magic Link 전송 완료');
    return { data, error: null };
  } catch (error) {
    logger.error('❌ Email Magic Link 통신 에러:', error);
    return { data: null, error };
  }
}
