export type ServerRole = 'owner' | 'guest';

export interface RoleLookupResponse {
  isAdmin: boolean;
  role: ServerRole;
}

export interface UnauthorizedRoleLookupResult {
  status: 401;
  body: { error: 'Unauthorized' };
}

export function roleLookupResponse(isAdmin: boolean): RoleLookupResponse {
  return {
    isAdmin,
    role: isAdmin ? 'owner' : 'guest',
  };
}

export function unauthorizedRoleLookupResult(): UnauthorizedRoleLookupResult {
  return { status: 401, body: { error: 'Unauthorized' } };
}
