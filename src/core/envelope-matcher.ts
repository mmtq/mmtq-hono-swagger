import { Node, TypeChecker } from 'ts-morph';
import { extractZodSchema } from './zod-extractor';
import type { IRSchema } from './ir';

/**
 * Attempts to structurally match an envelope factory like:
 * (data: T) => z.object({ status: z.literal('ok'), data })
 * and splices the provided schema into the hole.
 */
export function matchEnvelopeFactory(factoryNode: Node, innerSchema: IRSchema, typeChecker: TypeChecker): any {
  if (Node.isArrowFunction(factoryNode) || Node.isFunctionDeclaration(factoryNode) || Node.isFunctionExpression(factoryNode)) {
    const params = factoryNode.getParameters();
    if (params.length === 1) {
      const paramName = params[0].getName();
      const body = factoryNode.getBody();
      
      let returnExpr: Node | undefined;
      
      if (Node.isBlock(body)) {
        const returnStatement = body.getStatements().find(Node.isReturnStatement);
        if (returnStatement) {
          returnExpr = returnStatement.getExpression();
        }
      } else {
        returnExpr = body; // Arrow function with expression body
      }
      
      if (returnExpr) {
         const baseJsonSchema = extractZodSchema(returnExpr, typeChecker);
         // We now have the JSON Schema representation of the envelope, but it might have evaluated the 'data' parameter as an unknown identifier
         // Actually, extractZodSchema currently returns fallback { type: 'object' } for unknown identifiers.
         // Let's manually replace the param hole in the JSON Schema.
         
         // A more robust way is to inject the innerSchema JSON Schema directly.
         return spliceSchemaHole(baseJsonSchema, paramName, innerSchema.jsonSchema);
      }
    }
  }
  
  // If not structurally matched, return undefined
  return undefined;
}

function spliceSchemaHole(schema: any, paramName: string, innerSchema: any): any {
  if (!schema || typeof schema !== 'object') return schema;
  
  if (Array.isArray(schema)) {
    return schema.map(item => spliceSchemaHole(item, paramName, innerSchema));
  }
  
  const result: any = {};
  for (const [key, value] of Object.entries(schema)) {
    if (key === paramName && Object.keys(value as any).length === 0) {
       // It evaluated to {} in extractZodSchema because it was an identifier 'data'
       // Wait, extractZodSchema returns { type: 'object' } for fallback.
       // Actually, we can check if the key is the property name, but what if the property is named differently?
       // Let's do a naive splice: if a property has the same name as the param, replace it.
       // E.g. `data: data` -> property name 'data' matches param name 'data'.
       result[key] = innerSchema;
    } else {
       result[key] = spliceSchemaHole(value, paramName, innerSchema);
    }
  }
  
  return result;
}
