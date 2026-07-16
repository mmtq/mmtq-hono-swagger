import { Node, SyntaxKind, TypeChecker } from 'ts-morph';
import type { IRResponse, IRSchema } from '../../core/ir';
import { extractZodSchema } from '../../core/zod-extractor';

export function extractTypedResponse(handlerNode: Node, typeChecker: TypeChecker): IRResponse[] {
  const responses: IRResponse[] = [];
  
  // Find all typed() calls within the handler
  const callExpressions = handlerNode.getDescendantsOfKind(SyntaxKind.CallExpression);
  
  for (const callExpr of callExpressions) {
    const expr = callExpr.getExpression();
    if (Node.isIdentifier(expr) && expr.getText() === 'typed') {
      const args = callExpr.getArguments();
      // typed(c, schema, data, status?)
      if (args.length >= 3) {
        const schemaArg = args[1];
        let statusArg = args[3];
        
        let statusCode: string | number = 200;
        if (statusArg && (Node.isNumericLiteral(statusArg) || Node.isStringLiteral(statusArg))) {
          statusCode = statusArg.getLiteralValue();
        }

        const isAnonymous = !Node.isIdentifier(schemaArg);
        let name: string | undefined;

        if (Node.isIdentifier(schemaArg)) {
           name = schemaArg.getText();
        } else if (Node.isPropertyAccessExpression(schemaArg)) {
           name = schemaArg.getName();
        }

        const jsonSchema = extractZodSchema(schemaArg, typeChecker);
        
        const schema: IRSchema = {
          name,
          jsonSchema,
          isAnonymous
        };

        responses.push({
          statusCode,
          schema,
          description: 'Successful response'
        });
      }
    }
  }

  return responses;
}
