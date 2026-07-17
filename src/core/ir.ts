import type { OpenAPIV3 } from 'openapi-types';

export interface IRRoute {
  method: string;
  path: string;
  pathParams: string[];
  operationId?: string;
  summary?: string;
  description?: string;
  tags?: string[];
  security?: any[];
  deprecated?: boolean;
  requestBody?: IRSchema;
  requestBodyType?: 'json' | 'form';
  querySchema?: IRSchema;
  headerSchema?: IRSchema;
  responses: IRResponse[];
  sourceFile: string;
  sourceLine: number;
  openapiOverride?: any;
}

export interface IRSchema {
  name?: string; // If undefined, it's an anonymous schema
  jsonSchema: any;
  zodExpression?: string; // Optional, useful for debugging
  isAnonymous: boolean;
}

export interface IRResponse {
  statusCode: number | string;
  schema?: IRSchema;
  description?: string;
}

export interface ValidationResult {
  resolved: IRRoute[];
  flagged: FlaggedRoute[];
  unresolved: UnresolvedRoute[];
}

export interface FlaggedRoute {
  route: IRRoute;
  reason: string;
}

export interface UnresolvedRoute {
  method: string;
  path: string;
  sourceFile: string;
  sourceLine: number;
  reason: string;
}
