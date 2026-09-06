import { Project, SyntaxKind } from 'ts-morph';
import path from 'path';

const project = new Project({
  tsConfigFilePath: 'apps/api/tsconfig.json'
});

const sourceFiles = project.getSourceFiles();

sourceFiles.forEach(file => {
  let changed = false;

  // Make all route handlers async
  file.getDescendantsOfKind(SyntaxKind.CallExpression).forEach(callExpr => {
    const expr = callExpr.getExpression();
    if (expr.getKind() === SyntaxKind.PropertyAccessExpression) {
      const propAccess = expr.asKind(SyntaxKind.PropertyAccessExpression);
      if (propAccess) {
        const text = propAccess.getText();
        
        // 1. Make routers async
        if (text.match(/Router\.(get|post|put|patch|delete)/) || text.match(/\w+Router\.(get|post|put|patch|delete)/)) {
          const args = callExpr.getArguments();
          const lastArg = args[args.length - 1];
          if (lastArg && (lastArg.getKind() === SyntaxKind.ArrowFunction || lastArg.getKind() === SyntaxKind.FunctionExpression)) {
            const func = lastArg.asKind(SyntaxKind.ArrowFunction) || lastArg.asKind(SyntaxKind.FunctionExpression);
            if (func && !func.isAsync()) {
              func.setIsAsync(true);
              changed = true;
            }
          }
        }
        
        // 2. Add await to repository and service calls
        if (text.match(/\w+(Repository|Service)\.\w+/) || text.match(/this\.(list|create|update|delete|findById|writeAll)/)) {
           // check if it's already awaited
           const parent = callExpr.getParent();
           if (parent && parent.getKind() !== SyntaxKind.AwaitExpression) {
             callExpr.replaceWithText(`await ${callExpr.getText()}`);
             changed = true;
           }
        }
      }
    }
  });

  // Make all functions containing 'await' async
  file.getDescendantsOfKind(SyntaxKind.FunctionDeclaration).forEach(func => {
    if (func.getDescendantsOfKind(SyntaxKind.AwaitExpression).length > 0 && !func.isAsync()) {
      func.setIsAsync(true);
      changed = true;
    }
  });
  file.getDescendantsOfKind(SyntaxKind.ArrowFunction).forEach(func => {
    if (func.getDescendantsOfKind(SyntaxKind.AwaitExpression).length > 0 && !func.isAsync()) {
      func.setIsAsync(true);
      changed = true;
    }
  });
  file.getDescendantsOfKind(SyntaxKind.MethodDeclaration).forEach(func => {
    if (func.getDescendantsOfKind(SyntaxKind.AwaitExpression).length > 0 && !func.isAsync()) {
      func.setIsAsync(true);
      changed = true;
    }
  });

  if (changed) {
    console.log(`Updated ${file.getFilePath()}`);
    file.saveSync();
  }
});
