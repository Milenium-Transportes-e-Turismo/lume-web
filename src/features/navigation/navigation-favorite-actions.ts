'use server';

import { getTenantApiConfig } from '@/env.server';
import { createCookieApiTokenStorage } from '@/features/auth/infrastructure';

export interface NavigationFavorite {
  readonly id: string;
  readonly navigationKey: string;
  readonly createdAt: string;
}

type Result =
  | { readonly success: true; readonly favorites: NavigationFavorite[] }
  | { readonly success: false; readonly message: string };

async function request(path: string, init?: RequestInit): Promise<Response> {
  const tokens = await createCookieApiTokenStorage().then((storage) => storage.get());
  if (!tokens) throw new Error('Sua sessão expirou.');
  const config = getTenantApiConfig();
  return fetch(`${config.baseUrl}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${tokens.accessToken}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    cache: 'no-store',
  });
}

function errorMessage(): string {
  return 'Não foi possível atualizar os favoritos.';
}

export async function listNavigationFavoritesAction(): Promise<Result> {
  try {
    const response = await request('/navigation/favorites');
    if (!response.ok) return { success: false, message: errorMessage() };
    return { success: true, favorites: (await response.json()) as NavigationFavorite[] };
  } catch {
    return { success: false, message: errorMessage() };
  }
}

export async function addNavigationFavoriteAction(navigationKey: string): Promise<Result> {
  try {
    const response = await request('/navigation/favorites', {
      method: 'POST',
      body: JSON.stringify({ navigationKey }),
    });
    if (!response.ok) return { success: false, message: errorMessage() };
    return listNavigationFavoritesAction();
  } catch {
    return { success: false, message: errorMessage() };
  }
}

export async function removeNavigationFavoriteAction(navigationKey: string): Promise<Result> {
  try {
    const response = await request('/navigation/favorites', {
      method: 'DELETE',
      body: JSON.stringify({ navigationKey }),
    });
    if (!response.ok) return { success: false, message: errorMessage() };
    return listNavigationFavoritesAction();
  } catch {
    return { success: false, message: errorMessage() };
  }
}
