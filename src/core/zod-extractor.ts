import { Node, SyntaxKind, TypeChecker, CallExpression, PropertyAccessExpression, Identifier } from 'ts-morph';

export function extractZodSchema(node: Node, typeChecker: TypeChecker): any {
  if (Node.isIdentifier(node)) {
    // It's a reference to a schema. Find its declaration.
    const symbol = node.getSymbol() || typeChecker.getSymbolAtLocation(node);
    if (symbol) {
      const decl = symbol.getDeclarations()[0];
      if (decl && Node.isVariableDeclaration(decl)) {
        const initializer = decl.getInitializer();
        if (initializer) {
          return extractZodSchema(initializer, typeChecker);
        }
      }
    }
  }

  if (Node.isCallExpression(node)) {
    const expr = node.getExpression();
    let propName = '';
    
    if (Node.isPropertyAccessExpression(expr)) {
      propName = expr.getName();
    } else if (Node.isIdentifier(expr)) {
      propName = expr.getText();
    }

    // z.string() -> { type: 'string' }
    if (propName === 'string') {
      return { type: 'string' };
    }
    if (propName === 'number') {
      return { type: 'number' };
    }
    if (propName === 'boolean') {
      return { type: 'boolean' };
    }
    if (propName === 'any') {
      return {};
    }
    if (propName === 'object') {
      const args = node.getArguments();
      if (args.length > 0 && Node.isObjectLiteralExpression(args[0])) {
        const properties: Record<string, any> = {};
        const required: string[] = [];
        
        args[0].getProperties().forEach(prop => {
          if (Node.isPropertyAssignment(prop)) {
            const name = prop.getName();
            const init = prop.getInitializer();
            if (init && name) {
              const parsed = extractZodSchema(init, typeChecker);
              // Handle optional
              if (isZodMethod(init, 'optional')) {
                 properties[name] = parsed;
              } else {
                 properties[name] = parsed;
                 required.push(name);
              }
            }
          }
        });
        
        const result: any = { type: 'object', properties };
        if (required.length > 0) result.required = required;
        return result;
      }
    }
    if (propName === 'array') {
      const args = node.getArguments();
      if (args.length > 0) {
        return { type: 'array', items: extractZodSchema(args[0], typeChecker) };
      }
    }
    if (propName === 'literal') {
      const args = node.getArguments();
      if (args.length > 0) {
        // We evaluate literal safely using AST
        const text = args[0].getText();
        let value: any = text;
        if (text.startsWith("'") || text.startsWith('"')) {
          value = text.slice(1, -1);
        } else if (text === 'true') {
          value = true;
        } else if (text === 'false') {
          value = false;
        } else if (!isNaN(Number(text))) {
          value = Number(text);
        }
        return { enum: [value] };
      }
    }
    if (propName === 'union') {
      const args = node.getArguments();
      if (args.length > 0 && Node.isArrayLiteralExpression(args[0])) {
        return { anyOf: args[0].getElements().map(el => extractZodSchema(el, typeChecker)) };
      }
    }
    if (propName === 'enum') {
      const args = node.getArguments();
      if (args.length > 0 && Node.isArrayLiteralExpression(args[0])) {
        return { enum: args[0].getElements().map(el => el.getText().replace(/['"]/g, '')) };
      }
    }

    // Chained methods like z.string().optional()
    if (Node.isPropertyAccessExpression(expr)) {
      const baseSchema = extractZodSchema(expr.getExpression(), typeChecker);
      if (propName === 'optional') {
        return baseSchema; // In JSON Schema, optional is handled at object level, but we can flag it
      }
      if (propName === 'nullable') {
        return { ...baseSchema, type: [baseSchema.type, 'null'].flat() };
      }
      if (propName === 'extend' || propName === 'merge') {
        const args = node.getArguments();
        if (args.length > 0) {
          const extension = extractZodSchema(args[0], typeChecker);
          return {
            type: 'object',
            allOf: [baseSchema, extension]
          };
        }
      }
      if (propName === 'pick') {
        // simplistic pick
        const args = node.getArguments();
        if (args.length > 0 && Node.isObjectLiteralExpression(args[0])) {
          const picked: string[] = [];
          args[0].getProperties().forEach(p => {
             if (Node.isPropertyAssignment(p) || Node.isShorthandPropertyAssignment(p)) {
               picked.push(p.getName());
             }
          });
          const pickedProps: any = {};
          picked.forEach(p => {
            if (baseSchema.properties && baseSchema.properties[p]) {
              pickedProps[p] = baseSchema.properties[p];
            }
          });
          return { type: 'object', properties: pickedProps, required: baseSchema.required?.filter((r: string) => picked.includes(r)) };
        }
      }
      if (propName === 'omit') {
        const args = node.getArguments();
        if (args.length > 0 && Node.isObjectLiteralExpression(args[0])) {
          const omitted: string[] = [];
          args[0].getProperties().forEach(p => {
             if (Node.isPropertyAssignment(p) || Node.isShorthandPropertyAssignment(p)) {
               omitted.push(p.getName());
             }
          });
          const remainingProps: any = { ...baseSchema.properties };
          omitted.forEach(o => delete remainingProps[o]);
          return { type: 'object', properties: remainingProps, required: baseSchema.required?.filter((r: string) => !omitted.includes(r)) };
        }
      }
      return baseSchema; // Ignore unknown chained methods for now
    }
  }

  // Fallback
  return { type: 'object' };
}

function isZodMethod(node: Node, methodName: string): boolean {
  if (Node.isCallExpression(node)) {
    const expr = node.getExpression();
    if (Node.isPropertyAccessExpression(expr)) {
      if (expr.getName() === methodName) return true;
      return isZodMethod(expr.getExpression(), methodName);
    }
  }
  return false;
}
