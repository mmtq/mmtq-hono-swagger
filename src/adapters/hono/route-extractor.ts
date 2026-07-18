import { Node, CallExpression, Project, TypeChecker, SyntaxKind, SourceFile } from 'ts-morph';
import type { IRRoute, ValidationResult, FlaggedRoute, UnresolvedRoute } from '../../core/ir';
import { extractValidator } from './validator-extractor';
import { extractTypedResponse } from './typed-extractor';
import { extractJSDocHints } from '../../core/jsdoc-parser';

export interface Mount {
  prefix: string;
  appId: string;
  mountedAppId: string;
}

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete', 'options', 'head'];

export function extractRoutes(project: Project): ValidationResult {
  const result: ValidationResult = {
    resolved: [],
    flagged: [],
    unresolved: []
  };

  const mounts: Mount[] = [];
  const typeChecker = project.getTypeChecker();

  for (const sourceFile of project.getSourceFiles()) {
    // Find all CallExpressions
    const callExpressions = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression);

    for (const callExpr of callExpressions) {
      processCallExpression(callExpr, sourceFile, typeChecker, result, mounts);
    }
  }

  // Resolve mounts
  const routeMap = new Map<string, IRRoute[]>();
  for (const r of result.resolved) {
     if (r.appId) {
       if (!routeMap.has(r.appId)) routeMap.set(r.appId, []);
       routeMap.get(r.appId)!.push(r);
     }
  }

  let changed = true;
  let iterations = 0;
  while (changed && iterations < 10) {
    changed = false;
    iterations++;
    for (const mount of mounts) {
      const sourceRoutes = routeMap.get(mount.mountedAppId) || [];
      const targetRoutes = routeMap.get(mount.appId) || [];
      
      for (const sr of sourceRoutes) {
         let newPath = (mount.prefix + sr.path).replace(/\/+/g, '/');
         if (newPath.endsWith('/') && newPath.length > 1) {
            newPath = newPath.slice(0, -1);
         }
         const exists = targetRoutes.some(tr => tr.path === newPath && tr.method === sr.method && tr.sourceLine === sr.sourceLine);
         if (!exists) {
            const newRoute: IRRoute = {
               ...sr,
               path: normalizePath(newPath),
               pathParams: extractPathParams(newPath),
               appId: mount.appId
            };
            targetRoutes.push(newRoute);
            changed = true;
         }
      }
      if (changed) {
         routeMap.set(mount.appId, targetRoutes);
      }
    }
  }

  const mountedAppIds = new Set(mounts.map(m => m.mountedAppId));
  const finalRoutes: IRRoute[] = [];
  
  for (const [appId, routes] of routeMap.entries()) {
     if (!mountedAppIds.has(appId)) {
        finalRoutes.push(...routes);
     }
  }
  
  for (const r of result.resolved) {
     if (!r.appId) finalRoutes.push(r);
  }

  result.resolved = finalRoutes;
  return result;
}

function processCallExpression(
  callExpr: CallExpression,
  sourceFile: SourceFile,
  typeChecker: TypeChecker,
  result: ValidationResult,
  mounts: Mount[]
) {
  const expr = callExpr.getExpression();
  if (!Node.isPropertyAccessExpression(expr)) return;

  const appNode = expr.getExpression();
  let appId = '';
  if (Node.isIdentifier(appNode)) {
    const sym = appNode.getSymbol() || typeChecker.getSymbolAtLocation(appNode);
    if (sym) {
       const decl = sym.getDeclarations()[0];
       if (decl) {
          appId = decl.getSourceFile().getFilePath() + '#' + decl.getStart();
       }
    }
  }

  const methodName = expr.getName();
  if (!HTTP_METHODS.includes(methodName)) {
    // Check if it's app.route()
    if (methodName === 'route') {
      const args = callExpr.getArguments();
      if (args.length >= 2) {
         const prefixNode = args[0];
         let prefix = '';
         if (Node.isStringLiteral(prefixNode) || Node.isNoSubstitutionTemplateLiteral(prefixNode)) {
           prefix = prefixNode.getLiteralText();
         }
         const subRouterNode = args[1];
         let mountedAppId = '';
         if (Node.isIdentifier(subRouterNode)) {
            const sym = subRouterNode.getSymbol() || typeChecker.getSymbolAtLocation(subRouterNode);
            if (sym) {
               const actualSym = sym.getAliasedSymbol() || sym;
               const decl = actualSym.getDeclarations()[0];
               if (decl) {
                  mountedAppId = decl.getSourceFile().getFilePath() + '#' + decl.getStart();
               }
            }
         }
         
         if (prefix && appId && mountedAppId) {
            mounts.push({ prefix, appId, mountedAppId });
         } else if (prefix && appId && !mountedAppId) {
            result.unresolved.push({
              method: 'route',
              path: prefix,
              sourceFile: sourceFile.getFilePath(),
              sourceLine: callExpr.getStartLineNumber(),
              reason: 'Dynamic sub-router mounting is not statically traceable'
            });
         }
      }
    }
    return;
  }

  const args = callExpr.getArguments();
  if (args.length === 0) return;

  const pathNode = args[0];
  let path = '';

  if (Node.isStringLiteral(pathNode) || Node.isNoSubstitutionTemplateLiteral(pathNode)) {
    path = pathNode.getLiteralText();
  } else if (Node.isIdentifier(pathNode)) {
    const symbol = pathNode.getSymbol() || typeChecker.getSymbolAtLocation(pathNode);
    if (symbol) {
      const decl = symbol.getDeclarations()[0];
      if (decl && Node.isVariableDeclaration(decl)) {
        const init = decl.getInitializer();
        if (init && (Node.isStringLiteral(init) || Node.isNoSubstitutionTemplateLiteral(init))) {
          path = init.getLiteralText();
        }
      }
    }
  } else if (Node.isTemplateExpression(pathNode)) {
     const head = pathNode.getHead().getLiteralText();
     let resolvedPath = head;
     let canResolve = true;
     for (const span of pathNode.getTemplateSpans()) {
       const spanExpr = span.getExpression();
       let spanVal = '';
       if (Node.isIdentifier(spanExpr)) {
          const symbol = spanExpr.getSymbol() || typeChecker.getSymbolAtLocation(spanExpr);
          if (symbol) {
            const decl = symbol.getDeclarations()[0];
            if (decl && Node.isVariableDeclaration(decl)) {
               const init = decl.getInitializer();
               if (init && (Node.isStringLiteral(init) || Node.isNoSubstitutionTemplateLiteral(init))) {
                  spanVal = init.getLiteralText();
               } else {
                  canResolve = false; break;
               }
            } else {
               canResolve = false; break;
            }
          } else {
             canResolve = false; break;
          }
       } else {
          canResolve = false; break;
       }
       resolvedPath += spanVal + span.getLiteral().getLiteralText();
     }
     if (canResolve) {
        path = resolvedPath;
     }
  }

  if (!path) {
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
    appId,
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
        if (validator.target === 'json') {
          route.requestBody = validator.schema;
          route.requestBodyType = 'json';
        }
        else if (validator.target === 'form') {
          route.requestBody = validator.schema;
          route.requestBodyType = 'form';
        }
        else if (validator.target === 'query') route.querySchema = validator.schema;
        else if (validator.target === 'header') route.headerSchema = validator.schema;
        // params are handled by extracting from path, but we can also use validator schema if provided
      }
    }
  }

  if (hints.override) {
    // Merge override JSON
    route.openapiOverride = hints.override;
  }

  result.resolved.push(route);
}

function normalizePath(p: string): string {
  // Convert Hono /:id to OpenAPI /{id}
  return p.replace(/:([a-zA-Z0-9_]+)/g, '{$1}');
}

function extractPathParams(p: string): string[] {
  const matches = p.match(/:([a-zA-Z0-9_]+)/g) || [];
  const matchesBraces = p.match(/{([a-zA-Z0-9_]+)}/g) || [];
  
  const params = [
    ...matches.map(m => m.slice(1)),
    ...matchesBraces.map(m => m.slice(1, -1))
  ];
  
  // Remove duplicates just in case
  return Array.from(new Set(params));
}
