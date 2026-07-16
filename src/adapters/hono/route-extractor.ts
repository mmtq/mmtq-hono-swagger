import { Node, CallExpression, Project, TypeChecker, SyntaxKind, SourceFile } from 'ts-morph';
import type { IRRoute, ValidationResult, FlaggedRoute, UnresolvedRoute } from '../../core/ir';
import { extractValidator } from './validator-extractor';
import { extractTypedResponse } from './typed-extractor';
import { extractJSDocHints } from '../../core/jsdoc-parser';

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete', 'options', 'head'];

export function extractRoutes(project: Project): ValidationResult {
  const result: ValidationResult = {
    resolved: [],
    flagged: [],
    unresolved: []
  };

  const typeChecker = project.getTypeChecker();

  for (const sourceFile of project.getSourceFiles()) {
    // Find all CallExpressions
    const callExpressions = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression);
    
    for (const callExpr of callExpressions) {
      processCallExpression(callExpr, sourceFile, typeChecker, result);
    }
  }

  return result;
}

function processCallExpression(
  callExpr: CallExpression, 
  sourceFile: SourceFile,
  typeChecker: TypeChecker,
  result: ValidationResult
) {
  const expr = callExpr.getExpression();
  if (!Node.isPropertyAccessExpression(expr)) return;

  const methodName = expr.getName();
  if (!HTTP_METHODS.includes(methodName)) {
    // Check if it's app.route()
    if (methodName === 'route') {
      // For v1, we can do simple path joining if we can trace the sub-router.
      // But actually, tracing `.route(prefix, app)` statically across files requires following imports.
      // We'll leave advanced route composition for v1.1 or flag it if dynamic.
      // A full implementation would find the referenced app and prepend the prefix to its routes.
    }
    return;
  }

  const args = callExpr.getArguments();
  if (args.length === 0) return;

  const pathNode = args[0];
  let path = '';

  if (Node.isStringLiteral(pathNode) || Node.isNoSubstitutionTemplateLiteral(pathNode)) {
    path = pathNode.getLiteralText();
  } else {
    // Dynamic path
    result.unresolved.push({
      method: methodName,
      path: 'unknown',
      sourceFile: sourceFile.getFilePath(),
      sourceLine: callExpr.getStartLineNumber(),
      reason: 'Dynamic route path'
    });
    return;
  }

  // JSDoc
  const hints = extractJSDocHints(callExpr);
  if (hints.ignore) return;

  const route: IRRoute = {
    method: methodName,
    path: normalizePath(path),
    pathParams: extractPathParams(path),
    responses: [],
    sourceFile: sourceFile.getFilePath(),
    sourceLine: callExpr.getStartLineNumber(),
    summary: hints.summary,
    description: hints.description,
    tags: hints.tags,
    security: hints.security,
    deprecated: hints.deprecated
  };

  // Find zValidator and typed calls within the arguments
  for (let i = 1; i < args.length; i++) {
    const handler = args[i];
    if (Node.isArrowFunction(handler) || Node.isFunctionExpression(handler) || Node.isIdentifier(handler)) {
      // Find typed() calls in handler body
      const typedResponses = extractTypedResponse(handler, typeChecker);
      if (typedResponses.length > 0) {
         route.responses.push(...typedResponses);
      }
    } else if (Node.isCallExpression(handler)) {
      // Might be zValidator()
      const validator = extractValidator(handler, typeChecker);
      if (validator) {
        if (validator.target === 'json') route.requestBody = validator.schema;
        else if (validator.target === 'query') route.querySchema = validator.schema;
        else if (validator.target === 'header') route.headerSchema = validator.schema;
        // params are handled by extracting from path, but we can also use validator schema if provided
      }
    }
  }
  
  if (hints.override) {
    // Merge override JSON
    Object.assign(route, hints.override);
  }

  result.resolved.push(route);
}

function normalizePath(p: string): string {
  // Convert Hono /:id to OpenAPI /{id}
  return p.replace(/:([a-zA-Z0-9_]+)/g, '{$1}');
}

function extractPathParams(p: string): string[] {
  const matches = p.match(/:([a-zA-Z0-9_]+)/g);
  return matches ? matches.map(m => m.slice(1)) : [];
}
