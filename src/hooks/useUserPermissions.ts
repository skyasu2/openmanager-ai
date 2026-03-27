import { isGuestFullAccessEnabled } from '@/config/guestMode';
import { useAuth } from '@/hooks/useAuth';
import { useSession } from '@/hooks/useSupabaseSession';
import type { UserPermissions, UserType } from '@/types/permissions.types';

/**
 * 관리자 모드 제거 이후, 게스트와 GitHub 사용자가 동일한 권한을 갖도록 단순화된 훅.
 * 추후 게스트 제한을 두고 싶으면 ENV 기반 플래그만 조정하면 된다.
 */
export function useUserPermissions(): UserPermissions {
  const { data: session, status: sessionStatus } = useSession();
  const { user: guestUser, isLoading: isAuthLoading } = useAuth();

  const isGitHub = Boolean(session?.user);
  const isGuest = !isGitHub && Boolean(guestUser);

  const guestFullAccess = isGuestFullAccessEnabled();
  const guestHasSession = isGuest;
  const guestCanControlSystem = guestHasSession || guestFullAccess;
  const guestCanAccessDashboard = guestHasSession || guestFullAccess;
  const resolvedUser = session?.user ||
    guestUser || { name: '사용자', email: 'guest@example.com' };

  // 🔒 정확한 로딩 상태 및 사용자 유형 결정
  let userType: UserType = 'anonymous';

  if (sessionStatus === 'loading' || isAuthLoading) {
    userType = 'loading';
  } else if (isGitHub) {
    userType = 'github';
  } else if (isGuest) {
    userType = 'guest';
  } else {
    userType = 'anonymous';
  }

  const userName =
    resolvedUser.name ||
    resolvedUser.email?.split('@')[0] ||
    (isGitHub ? 'GitHub 사용자' : '게스트 사용자');
  const userAvatar =
    (resolvedUser as { avatar?: string }).avatar ||
    (session?.user as { image?: string })?.image ||
    undefined;

  return {
    canControlSystem: isGitHub || guestCanControlSystem,
    canAccessSettings: true,
    canToggleAdminMode: false,
    canLogout: Boolean(guestUser || session?.user),

    canAccessMainPage: true,
    canAccessDashboard: isGitHub || guestCanAccessDashboard,
    canAccessAdminPage: false,

    isGeneralUser: true,
    isAdmin: isGitHub || guestFullAccess,
    isGitHubAuthenticated: isGitHub,
    isPinAuthenticated: guestHasSession || guestFullAccess,

    canToggleAI: true,

    userType,
    userName,
    userAvatar,
  };
}
