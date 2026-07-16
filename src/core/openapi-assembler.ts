import type { OpenAPIV3 } from 'openapi-types';
import type { IRRoute, IRSchema } from './ir';

export function assembleOpenAPI(
  routes: IRRoute[],
  config: { info: OpenAPIV3.InfoObject; servers?: OpenAPIV3.ServerObject[] }
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

    if (route.querySchema) {
      const schema = resolveSchema(route.querySchema, doc) as OpenAPIV3.SchemaObject;
      if (schema && typeof schema === 'object' && schema.properties) {
        for (const [name, propSchema] of Object.entries(schema.properties as any)) {
          parameters.push({
            name,
            in: 'query',
            schema: propSchema as any,
            required: schema.required?.includes(name) || false
          });
        }
      }
    }

    if (route.headerSchema) {
      const schema = resolveSchema(route.headerSchema, doc) as OpenAPIV3.SchemaObject;
      if (schema && typeof schema === 'object' && schema.properties) {
        for (const [name, propSchema] of Object.entries(schema.properties as any)) {
          parameters.push({
            name,
            in: 'header',
            schema: propSchema as any,
            required: schema.required?.includes(name) || false
          });
        }
      }
    }

    if (parameters.length > 0) {
      operation.parameters = parameters;
    }

    // Request Body
    if (route.requestBody) {
      operation.requestBody = {
        content: {
          'application/json': {
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

    pathItem[method] = operation;
    doc.paths[route.path] = pathItem;
  }

  return doc;
}

function resolveSchema(irSchema: IRSchema, doc: OpenAPIV3.Document): OpenAPIV3.ReferenceObject | OpenAPIV3.SchemaObject {
  if (irSchema.isAnonymous || !irSchema.name) {
    return irSchema.jsonSchema as OpenAPIV3.SchemaObject;
  }

  // Named schema - add to components
  if (!doc.components!.schemas![irSchema.name]) {
    doc.components!.schemas![irSchema.name] = irSchema.jsonSchema as OpenAPIV3.SchemaObject;
  }

  return {
    $ref: `#/components/schemas/${irSchema.name}`
  };
}
