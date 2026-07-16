import { Node, CallExpression, TypeChecker } from 'ts-morph';
import type { IRSchema } from '../../core/ir';
import { extractZodSchema } from '../../core/zod-extractor';

export interface ExtractedValidator {
  target: 'json' | 'query' | 'header' | 'param' | 'form' | 'cookie';
  schema: IRSchema;
}

export function extractValidator(callExpr: CallExpression, typeChecker: TypeChecker): ExtractedValidator | undefined {
  const expr = callExpr.getExpression();
  if (Node.isIdentifier(expr) && expr.getText() === 'zValidator') {
    const args = callExpr.getArguments();
    if (args.length >= 2) {
      const targetArg = args[0];
      const schemaArg = args[1];

      let target = '';
      if (Node.isStringLiteral(targetArg) || Node.isNoSubstitutionTemplateLiteral(targetArg)) {
        target = targetArg.getLiteralText();
      }

      if (!target) return undefined;

      const isAnonymous = !Node.isIdentifier(schemaArg);
      let name: string | undefined;

      if (Node.isIdentifier(schemaArg)) {
         name = schemaArg.getText();
      } else if (Node.isPropertyAccessExpression(schemaArg)) {
         name = schemaArg.getName();
      }

      const jsonSchema = extractZodSchema(schemaArg, typeChecker);

      return {
        target: target as any,
        schema: {
          name,
          jsonSchema,
          isAnonymous
        }
      };
    }
  }

  return undefined;
}
