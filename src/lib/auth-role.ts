export type ServerRole = 'owner' | 'guest';

export interface RoleLookupResponse {
  isAdmin: boolean;
  role: ServerRole;
  sourceDocumentsAvailable: boolean;
}

export interface UnauthorizedRoleLookupResult {
  status: 401;
  body: { error: 'Unauthorized' };
}

export function roleLookupResponse(isAdmin: boolean, sourceDocumentsAvailable = false): RoleLookupResponse {
  return {
    isAdmin,
    role: isAdmin ? 'owner' : 'guest',
    sourceDocumentsAvailable,
  };
}

export function unauthorizedRoleLookupResult(): UnauthorizedRoleLookupResult {
  return { status: 401, body: { error: 'Unauthorized' } };
}
