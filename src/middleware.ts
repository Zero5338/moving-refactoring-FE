export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg)$).*)',
  ],
};

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyToken } from './lib/server/auth/jwt';
import {
  checkProfileRegisterPath,
  handleTokenRefresh,
  checkAuthPath,
  checkVisitorAllowedPath,
} from './lib/server/auth/utils';
import { PROTECT } from './lib/server/auth/constants';
import { CustomJWTPayload } from './lib/server/auth/types';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // [디버깅 로그] 현재 접근하려는 경로 확인
  // console.log(`[Middleware] 접근 경로: ${pathname}`);

  const isVisitorAllowedPath = checkVisitorAllowedPath(pathname);
  const isApiPath = pathname.startsWith('/api');
  let response = NextResponse.next();

  if (isVisitorAllowedPath || isApiPath) return response;

  const isAuthPath = checkAuthPath(pathname);
  const isProfileRegisterPath = checkProfileRegisterPath(pathname);

  // 쿠키 가져오기
  const token = request.cookies.get('accessToken')?.value;
  const reToken = request.cookies.get('refreshToken')?.value;

  // [디버깅 로그] 쿠키 상태 확인 (토큰이 있긴 한가?)
  // console.log(`[Middleware] AccessToken 존재: ${!!token}, RefreshToken 존재: ${!!reToken}`);

  let verifiedAccessToken = null;
  if (token) {
    try {
      verifiedAccessToken = await verifyToken<CustomJWTPayload>(token);
      // [디버깅 로그] 토큰 검증 성공 여부
      // console.log('[Middleware] 토큰 검증 성공:', !!verifiedAccessToken);
    } catch (e) {
      console.error('[Middleware] 토큰 검증 에러:', e);
    }
  }

  const loginUrl = new URL('/select-role', request.url);
  loginUrl.searchParams.set('warn', 'login');

  // 1. 토큰이 아예 없거나 검증 실패 시 -> 로그인 페이지로
  if (!verifiedAccessToken && !reToken && !isAuthPath) {
    console.log('[Middleware] 🚨 토큰 없음/검증실패 -> 로그인 이동');
    return NextResponse.redirect(loginUrl);
  }

  let currentUserData: CustomJWTPayload | null =
    verifiedAccessToken?.payload || null;

  // 2. 토큰 만료 시 리프레쉬 시도
  if (!verifiedAccessToken && reToken) {
    try {
      console.log('[Middleware] 🔄 토큰 리프레쉬 시도...');
      const refreshResult = await handleTokenRefresh(reToken);
      response = refreshResult.response;
      currentUserData = refreshResult.refreshedToken;
    } catch (error) {
      console.error('[Middleware] ❌ 리프레쉬 실패:', error);
      const redirectResponse = NextResponse.redirect(loginUrl);
      redirectResponse.cookies.delete('refreshToken');
      return redirectResponse;
    }
  }

  const roleId = currentUserData?.roleId;
  const type = currentUserData?.type;

  // [디버깅 로그] 유저 정보 확인 (여기서 roleId가 없으면 프로필 등록으로 보냄)
  // console.log(`[Middleware] 유저 정보: Type=${type}, RoleID=${roleId}`);

  // 3. 프로필(roleId)이 없을 때 -> 프로필 등록 페이지로 이동
  // (단, 이미 등록 페이지거나 로그인 페이지면 통과)
  if (!roleId && !isAuthPath && !isProfileRegisterPath) {
    console.log('[Middleware] ⚠️ 프로필 없음 -> 등록 페이지 이동');

    // 👇 혹시 userType이 없으면 기본값으로 customer 설정 (에러 방지)
    const urlPath = `/${type === 'mover' ? 'mover' : 'user'}/profile/register`;

    const redirectUrl = new URL(urlPath, request.url);
    redirectUrl.searchParams.set('warn', 'profileRegister');
    return NextResponse.redirect(redirectUrl);
  }

  const protectType = type === 'customer' ? PROTECT.CUSTOMER : PROTECT.MOVER;
  const authUserProtected = protectType.some((path) =>
    pathname.startsWith(path),
  );

  if (currentUserData && (authUserProtected || isAuthPath)) {
    const redirectUrl = new URL('/', request.url);
    redirectUrl.searchParams.set('warn', 'noAccess');
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}
