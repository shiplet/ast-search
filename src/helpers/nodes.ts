import { isBlockStatement, Node } from "@babel/types";

export const hasKeyedNode = (node: Node) => {
  switch (node.type) {
    case "ObjectMethod":
    case "ObjectProperty":
    case "ClassMethod":
    case "ClassProperty":
    case "ClassAccessorProperty":
    case "ObjectTypeProperty":
    case "ImportAttribute":
    case "TSDeclareMethod":
      return true;
    case "ClassPrivateProperty":
    case "ClassPrivateMethod":
      return true;
    case "TSPropertySignature":
    case "TSMethodSignature":
      return false;
  }
};

export const hasIdentifier = (node: Node) => {
  switch (node.type) {
    case "PrivateName":
    case "ClassImplements":
    case "DeclareClass":
    case "DeclareFunction":
    case "DeclareInterface":
    case "DeclareModule":
    case "DeclareTypeAlias":
    case "DeclareOpaqueType":
    case "DeclareVariable":
    case "GenericTypeAnnotation":
    case "InterfaceExtends":
    case "InterfaceDeclaration":
    case "ObjectTypeInternalSlot":
    case "OpaqueType":
    case "QualifiedTypeIdentifier":
    case "TypeAlias":
    case "EnumDeclaration":
    case "EnumBooleanMember":
    case "EnumNumberMember":
    case "EnumStringMember":
    case "EnumDefaultedMember":
    case "TSInterfaceDeclaration":
    case "TSTypeAliasDeclaration":
    case "TSEnumDeclaration":
    case "TSEnumMember":
    case "TSModuleDeclaration":
    case "TSImportEqualsDeclaration":
    case "TSNamespaceExportDeclaration":
    case "VariableDeclarator":
      return true;
    default:
      return false;
  }
};

export const hasBodyBlockStatement = (node: Node) => {
  if ("body" in node) {
    switch (node.type) {
      case "CatchClause":
      case "FunctionDeclaration":
      case "FunctionExpression":
      case "ObjectMethod":
      case "ClassMethod":
      case "ClassPrivateMethod":
      case "DeclareModule":
      case "DoExpression":
        return true;
      case "ArrowFunctionExpression":
        return !!isBlockStatement(node.body);
      default:
        return false;
    }
  }

  if ("block" in node) {
    return !!isBlockStatement(node.block);
  }

  return false;
};

export const hasDeclarations = (node: Node) => {
  if ("declarations" in node) {
    switch (node.type) {
      case "VariableDeclaration":
        return true;
      default:
        return false;
    }
  }
};

export const hasProperties = (node: Node) => {
  if ("properties" in node) {
    switch (node.type) {
      case "ObjectExpression":
      case "ObjectPattern":
      case "ObjectTypeAnnotation":
      case "RecordExpression":
        return true;
      default:
        return false;
    }
  }
};

const arrayifyNode = (node: Node) => {
  if (Array.isArray(node)) {
    return node;
  } else {
    return [node];
  }
};

export const getNodeBody = (node: Node) => {
  if ("argument" in node) {
    return arrayifyNode(node.argument as Node);
  }
  if ("arguments" in node) {
    return [...node.arguments, ...arrayifyNode(node.callee)];
  }
  if ("block" in node) {
    return arrayifyNode(node.block);
  }
  if ("body" in node) {
    return arrayifyNode(node.body as Node);
  }
  if ("declaration" in node) {
    return arrayifyNode(node.declaration as Node);
  }
  if ("declarations" in node) {
    return node.declarations;
  }
  if ("expression" in node) {
    return arrayifyNode(node.expression);
  }
  if ("init" in node) {
    return arrayifyNode(node.init as Node);
  }
  if ("object" in node) {
    if ("property" in node) {
      return [node.object, ...arrayifyNode(node.property as Node)];
    }
    return arrayifyNode(node.object as Node);
  }
  if ("properties" in node) {
    return node.properties;
  }
  if ("value" in node) {
    return arrayifyNode(node.value as Node);
  }
  return [];
};
