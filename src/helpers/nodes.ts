import { Node } from "@babel/types";

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
      return true;
    default:
      return false;
  }
};

export const hasBodyBlockStatement = (node: Node) => {
  switch (node.type) {
    case "CatchClause":
    case "FunctionDeclaration":
    case "FunctionExpression":
    case "ObjectMethod":
    case "TryStatement":
    case "ArrowFunctionExpression":
    case "ClassMethod":
    case "ClassPrivateMethod":
    case "DeclareModule":
    case "DoExpression":
      return true;
    default:
      return false;
  }
};
