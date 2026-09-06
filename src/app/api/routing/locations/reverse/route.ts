import { NextResponse } from 'next/server';
import { RoutePlannerError } from '@/features/route-planner/application/route-planner-gateway';
import { executeAuthenticatedRoutePlannerMutation } from '@/features/route-planner/server/execute-authenticated-route-planner-request';
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams;
  const lat = Number(q.get('lat'));
  const lng = Number(q.get('lng'));
  if (
    !q.has('lat') ||
    !q.has('lng') ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    Math.abs(lat) > 90 ||
    Math.abs(lng) > 180
  )
    return NextResponse.json({ message: 'Selecione um ponto válido no mapa.' }, { status: 400 });
  try {
    const result = await executeAuthenticatedRoutePlannerMutation((gateway) =>
      gateway.reverseLocation(lat, lng),
    );
    return NextResponse.json(result, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof RoutePlannerError
            ? error.message
            : 'Não foi possível identificar o local.',
      },
      {
        status:
          error instanceof RoutePlannerError && error.code === 'unauthorized'
            ? 401
            : error instanceof RoutePlannerError && error.code === 'forbidden'
              ? 403
              : 502,
      },
    );
  }
}
