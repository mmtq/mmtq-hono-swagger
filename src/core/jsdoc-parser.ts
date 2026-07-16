import { Node, JSDoc, JSDocTag } from 'ts-morph';

export interface JSDocHints {
  summary?: string;
  description?: string;
  tags?: string[];
  security?: any[];
  deprecated?: boolean;
  ignore?: boolean;
  override?: any;
}

export function extractJSDocHints(node: Node): JSDocHints {
  const hints: JSDocHints = {};
  
  // Find preceding JSDoc blocks
  let parent: Node | undefined = node;
  while (parent && !Node.isStatement(parent)) {
    parent = parent.getParent();
  }
  
  if (parent && Node.isJSDocable(parent)) {
    const jsDocs = parent.getJsDocs();
    if (jsDocs.length > 0) {
      const doc = jsDocs[jsDocs.length - 1]; // Use the most immediately preceding
      
      const description = doc.getDescription().trim();
      if (description) {
        hints.description = description;
      }
      
      doc.getTags().forEach(tag => {
        const tagName = tag.getTagName();
        const text = tag.getCommentText() || '';
        
        switch (tagName) {
          case 'summary':
            hints.summary = text.trim();
            break;
          case 'description':
            hints.description = text.trim();
            break;
          case 'tags':
            hints.tags = text.split(',').map(t => t.trim());
            break;
          case 'security':
            try {
               hints.security = hints.security || [];
               hints.security.push(JSON.parse(text));
            } catch (e) {
               // invalid json
            }
            break;
          case 'deprecated':
            hints.deprecated = true;
            break;
          case 'openapi-ignore':
            hints.ignore = true;
            break;
          case 'openapi-override':
            try {
              hints.override = JSON.parse(text);
            } catch (e) {
              // invalid json
            }
            break;
        }
      });
    }
  }
  
  return hints;
}
