import type { OpenAPIV3 } from 'openapi-types';
import type { IRRoute, IRSchema } from './ir';

export function assembleOpenAPI(
  routes: IRRoute[],
  config: { info: OpenAPIV3.InfoObject; servers?: OpenAPIV3.ServerObject[]; securitySchemes?: Record<string, any> }
): OpenAPIV3.Document {
  const doc: OpenAPIV3.Document = {
    openapi: '3.0.3',
    info: config.info,
    paths: {},
    components: {
      schemas: {}
    }
  };

  if (config.servers && config.servers.length > 0) {
    doc.servers = config.servers;
  }

  if (config.securitySchemes) {
    doc.components = doc.components || {};
    doc.components.securitySchemes = config.securitySchemes as any;
  }

  for (const route of routes) {
    const pathItem = doc.paths[route.path] || {};
    const method = route.method.toLowerCase() as OpenAPIV3.HttpMethods;

    const operation: OpenAPIV3.OperationObject = {
      responses: {}
    };

    if (route.operationId) operation.operationId = route.operationId;
    if (route.summary) operation.summary = route.summary;
    if (route.description) operation.description = route.description;
    if (route.tags) operation.tags = route.tags;
    if (route.security) operation.security = route.security;
    if (route.deprecated) operation.deprecated = true;

    // Parameters
    const parameters: OpenAPIV3.ParameterObject[] = [];

    if (route.pathParams.length > 0) {
      for (const param of route.pathParams) {
        parameters.push({
          name: param,
          in: 'path',
          required: true,
          schema: { type: 'string' }
        });
      }
    }

    const appendParameters = (irSchema: IRSchema, inLocation: 'query' | 'header') => {
      const schema = resolveSchema(irSchema, doc) as any;
      let actualSchema = schema;
      if (schema.$ref) {
         const name = schema.$ref.split('/').pop()!;
         actualSchema = doc.components!.schemas![name];
      }
      if (actualSchema && typeof actualSchema === 'object' && actualSchema.properties) {
        for (const [name, propSchema] of Object.entries(actualSchema.properties as any)) {
          parameters.push({
            name,
            in: inLocation,
            schema: propSchema as any,
            required: actualSchema.required?.includes(name) || false
          });
        }
      }
    };

    if (route.querySchema) {
      appendParameters(route.querySchema, 'query');
    }

    if (route.headerSchema) {
      appendParameters(route.headerSchema, 'header');
    }

    if (parameters.length > 0) {
      operation.parameters = parameters;
    }

    // Request Body
    if (route.requestBody) {
      const contentType = route.requestBodyType === 'form' ? 'multipart/form-data' : 'application/json';
      operation.requestBody = {
        content: {
          [contentType]: {
            schema: resolveSchema(route.requestBody, doc) as any
          }
        },
        required: true
      };
    }

    // Responses
    for (const response of route.responses) {
      const statusStr = String(response.statusCode);
      const resObj: OpenAPIV3.ResponseObject = {
        description: response.description || 'Response'
      };

      if (response.schema) {
        resObj.content = {
          'application/json': {
            schema: resolveSchema(response.schema, doc) as any
          }
        };
      }

      operation.responses[statusStr] = resObj;
    }

    // Ensure at least one response
    if (Object.keys(operation.responses).length === 0) {
      operation.responses['200'] = { description: 'OK' };
    }

    // Auto-document 400 Bad Request for validation errors
    if (route.requestBody || route.querySchema || route.headerSchema) {
       if (!operation.responses['400']) {
          operation.responses['400'] = {
             description: 'Bad Request (Validation Error)',
             content: {
                'application/json': {
                   schema: {
                      type: 'object',
                      properties: {
                         success: { type: 'boolean', enum: [false] },
                         error: {
                            type: 'object',
                            properties: {
                               issues: {
                                  type: 'array',
                                  items: {
                                     type: 'object',
                                     properties: {
                                        code: { type: 'string' },
                                        message: { type: 'string' },
                                        path: { type: 'array', items: { type: 'string' } }
                                     }
                                  }
                               },
                               name: { type: 'string', enum: ['ZodError'] }
                            }
                         }
                      }
                   }
                }
             }
          };
       }
    }

    if (route.openapiOverride) {
      Object.assign(operation, route.openapiOverride);
    }

    pathItem[method] = operation;
    doc.paths[route.path] = pathItem;
  }

  return doc;
}

function resolveSchema(irSchema: IRSchema, doc: OpenAPIV3.Document): OpenAPIV3.ReferenceObject | OpenAPIV3.SchemaObject {
  if (irSchema.isAnonymous || !irSchema.name) {
    return irSchema.jsonSchema as OpenAPIV3.SchemaObject;
  }

  const baseName = irSchema.name;
  let finalName = baseName;
  let counter = 2;
  
  while (doc.components!.schemas![finalName]) {
     const existingSchema = doc.components!.schemas![finalName];
     if (JSON.stringify(existingSchema) === JSON.stringify(irSchema.jsonSchema)) {
        break; // Identical schemas can share the same reference
     }
     finalName = `${baseName}_${counter}`;
     counter++;
  }

  if (!doc.components!.schemas![finalName]) {
    doc.components!.schemas![finalName] = irSchema.jsonSchema as OpenAPIV3.SchemaObject;
  }

  return {
    $ref: `#/components/schemas/${finalName}`
  };
}
