// /api/servers → /api/servers-unified?action=list 로 위임
// @deprecated /api/servers-unified 직접 사용 권장
export { GET } from '../servers-unified/route';

export const dynamic = 'force-dynamic';
