import { NextResponse } from 'next/server';
import { RoutePlannerError } from '@/features/route-planner/application/route-planner-gateway';
import { executeAuthenticatedRoutePlannerMutation } from '@/features/route-planner/server/execute-authenticated-route-planner-request';

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get('q')?.trim() ?? '';
  if (query.length < 3 || query.length > 180) {
    return NextResponse.json({ message: 'Digite entre 3 e 180 caracteres.' }, { status: 400 });
  }
  try {
    const items = await executeAuthenticatedRoutePlannerMutation((gateway) =>
      gateway.searchLocations(query),
    );
    return NextResponse.json(items, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    const status =
      error instanceof RoutePlannerError
        ? error.code === 'unauthorized'
          ? 401
          : error.code === 'forbidden'
            ? 403
            : error.code === 'validation'
              ? 400
              : 502
        : 502;
    return NextResponse.json(
      {
        message:
          error instanceof RoutePlannerError ? error.message : 'Não foi possível buscar os locais.',
      },
      { status },
    );
  }
}
