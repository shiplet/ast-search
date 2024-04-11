#! /usr/bin/env node
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
define("search", ["require", "exports"], function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.searchPropertyForExp = exports.searchFnForExp = void 0;
    const NodeType = {
        ArrowFunctionExpression: "ArrowFunctionExpression",
        CallExpression: "CallExpression",
        ExportDefaultDeclaration: "ExportDefaultDeclaration",
        FunctionDeclaration: "FunctionDeclaration",
        FunctionExpression: "FunctionExpression",
        ObjectExpression: "ObjectExpression",
        Property: "Property",
        VariableDeclarator: "VariableDeclarator",
    };
    function searchFnForExp({ ast, fn, e, m, f }) {
        if (m) {
            const fNodes = depthFirstSearchMultiple(ast, fn, searchForFunctionLike);
            if (fNodes.length === 0)
                process.exit(0);
            const fileNames = new Set();
            for (const fNode of fNodes) {
                fileNames.add(searchForExpMultiple(fNode, e, f));
            }
            for (const fileName of fileNames) {
                fileName && console.log(fileName);
            }
        }
        else {
            const fnNode = depthFirstSearch(ast, fn, searchForFunctionLike);
            if (!fnNode)
                process.exit(0);
            searchForExp(fnNode, e, f);
        }
    }
    exports.searchFnForExp = searchFnForExp;
    function searchPropertyForExp({ ast, p, e, f }) {
        const propNode = breadthFirstSearch(ast, p, searchForProperty);
        if (!propNode)
            process.exit(0);
        searchForExp(propNode, e, f);
    }
    exports.searchPropertyForExp = searchPropertyForExp;
    function searchForExp(node, search, f) {
        if (breadthFirstSearch(node, search, searchForExpression))
            console.log(f);
    }
    function searchForExpMultiple(node, search, f) {
        if (breadthFirstSearch(node, search, searchForExpression))
            return f;
    }
    function breadthFirstSearch(ast, search, visitFn) {
        const bfsQueue = [ast];
        const visitedNodes = new Set();
        visitedNodes.add(bfsQueue[0]);
        while (bfsQueue.length > 0) {
            const currentNode = bfsQueue.pop();
            const fnNode = visitFn(currentNode, search);
            if (fnNode) {
                return fnNode;
            }
            currentNode.edges &&
                currentNode.edges.forEach((childNode) => {
                    if (!visitedNodes.has(childNode)) {
                        bfsQueue.unshift(childNode);
                        visitedNodes.add(childNode);
                    }
                });
        }
        return null;
    }
    function depthFirstSearch(ast, search, visitFn) {
        const dfsStack = [ast];
        const visitedNodes = new Set();
        visitedNodes.add(dfsStack[0]);
        while (dfsStack.length > 0) {
            const currentNode = dfsStack.pop();
            const expNode = visitFn(currentNode, search);
            if (expNode) {
                return expNode;
            }
            currentNode.edges &&
                currentNode.edges.forEach((childNode) => {
                    if (!visitedNodes.has(childNode)) {
                        dfsStack.push(childNode);
                        visitedNodes.add(childNode);
                    }
                });
        }
        return null;
    }
    function depthFirstSearchMultiple(ast, search, visitFn) {
        const dfsStack = [ast];
        const visitedNodes = new Set();
        const foundNodes = new Set();
        visitedNodes.add(dfsStack[0]);
        while (dfsStack.length > 0) {
            const currentNode = dfsStack.pop();
            const expNode = visitFn(currentNode, search);
            if (expNode) {
                foundNodes.add(expNode);
            }
            currentNode.edges &&
                currentNode.edges.forEach((childNode) => {
                    if (!visitedNodes.has(childNode)) {
                        dfsStack.push(childNode);
                        visitedNodes.add(childNode);
                    }
                });
        }
        return foundNodes;
    }
    function searchForExpression(node, exp) {
        if (node.type && node.type === exp) {
            return node;
        }
        visit(node);
        return null;
    }
    function searchForProperty(node, prop) {
        if (node.type === NodeType.Property && node.key.name === prop) {
            return node;
        }
        visit(node);
        return null;
    }
    function searchForFunctionLike(node, fn) {
        var _a, _b, _c;
        // method on an object
        if (node.type === NodeType.Property && node.method && node.key.name === fn) {
            return node;
        }
        // named variable assignment with standard or arrow expression
        else if (node.type === NodeType.VariableDeclarator &&
            (((_a = node.init) === null || _a === void 0 ? void 0 : _a.type) === NodeType.FunctionExpression ||
                ((_b = node.init) === null || _b === void 0 ? void 0 : _b.type) === NodeType.ArrowFunctionExpression) &&
            ((_c = node.id) === null || _c === void 0 ? void 0 : _c.name) === fn) {
            return node;
        }
        // named function declaration
        else if (node.type === NodeType.FunctionDeclaration && node.id.name === fn) {
            return node;
        }
        // inline arrow expressions
        else if (node.type === NodeType.CallExpression && node.callee.name === fn) {
            return node;
        }
        visit(node);
        return null;
    }
    function visit(node) {
        if (isNode(node)) {
            node.edges = [];
            for (const prop of Object.keys(node)) {
                if (prop !== "edges") {
                    if (isArray(node[prop])) {
                        node.edges.push(...node[prop]);
                    }
                    if (isNode(node[prop])) {
                        node.edges.push(node[prop]);
                    }
                }
            }
        }
        if (isObject(node)) {
            node.edges = [];
            for (const prop of node) {
                if (prop !== "edges") {
                    if (isArray(node[prop])) {
                        node.edges.push(...node[prop]);
                    }
                    if (isNode(node[prop])) {
                        node.edges.push(node[prop]);
                    }
                }
            }
        }
        if (isArray(node)) {
            for (const prop in node) {
                if (prop !== "edges") {
                    if (isNode(node[prop])) {
                        console.log(node[prop]);
                    }
                }
            }
        }
    }
    function isNode(item) {
        return (item === null || item === void 0 ? void 0 : item.constructor) && item.constructor.name === "Node";
    }
    function isArray(item) {
        return (item === null || item === void 0 ? void 0 : item.constructor) && item.constructor === Array;
    }
    function isObject(item) {
        return (item === null || item === void 0 ? void 0 : item.constructor) && item.constructor === Object;
    }
});
// const yargs = require("yargs/yargs");
// const { Parser } = require("acorn");
// const { open, writeFile } = require("node:fs/promises");
// const {searchFnForExp, searchPropertyForExp} = require("./search");
define("main", ["require", "exports", "yargs", "acorn", "node:fs/promises", "search"], function (require, exports, yargs_1, acorn_1, promises_1, search_js_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    yargs_1 = __importDefault(yargs_1);
    const y = (0, yargs_1.default)(process.argv.slice(2))
        .scriptName("ast-search")
        .usage("$0 <file> [<function> | <property>] <expression>")
        .option("file", {
        alias: "f",
        describe: "the file to search",
    })
        .option("function", {
        alias: "fn",
        describe: "the function body to search",
    })
        .option("property", {
        alias: "p",
        describe: "the property to search",
    })
        .option("expression", {
        alias: "e",
        describe: "the type of expression",
        choices: [
            "ArrayExpression",
            "ArrowFunctionExpression",
            "AssignmentExpression",
            "AwaitExpression",
            "BinaryExpression",
            "CallExpression",
            "ChainExpression",
            "ConditionalExpression",
            "FunctionExpression",
            "ImportExpression",
            "LogicalExpression",
            "MemberExpression",
            "NewExpression",
            "ObjectExpression",
            "ParenthesizedExpression",
            "SequenceExpression",
            "TaggedTemplateExpression",
            "ThisExpression",
            "UnaryExpression",
            "UpdateExpression",
            "YieldExpression",
        ],
    })
        .option("multiple", {
        alias: "m",
        describe: "search for multiple instances of function call in same file",
    })
        .option("debug", {
        alias: "d",
        describe: "output the setup node",
    })
        .demandOption(["file", "expression"], "Please provide values for all three arguments: file, function, and search")
        .check((argv) => {
        if ((argv.fn && !argv.p) || (!argv.fv && argv.p)) {
            return true;
        }
        else if (argv.fn && argv.p) {
            console.error("can only search within either a function or a property, but not both");
            process.exit(1);
        }
        else {
            console.error("must provide either a function or a property to search");
            process.exit(1);
        }
    })
        .help();
    const { f, fn, e, d, p, m } = y.argv;
    const fileContents = [];
    let append = false;
    /**
     * Top-level main async function
     */
    (() => __awaiter(void 0, void 0, void 0, function* () {
        var _a, e_1, _b, _c;
        const file = yield (0, promises_1.open)(f);
        try {
            for (var _d = true, _e = __asyncValues(file.readLines()), _f; _f = yield _e.next(), _a = _f.done, !_a; _d = true) {
                _c = _f.value;
                _d = false;
                const line = _c;
                if (line === "<script>") {
                    append = true;
                    continue;
                }
                if (line === "</script>") {
                    append = false;
                    break;
                }
                if (append) {
                    fileContents.push(line);
                }
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (!_d && !_a && (_b = _e.return)) yield _b.call(_e);
            }
            finally { if (e_1) throw e_1.error; }
        }
        const ast = acorn_1.Parser.parse(fileContents.join("\n"), {
            ecmaVersion: 2022,
            sourceType: "module",
        });
        if (d) {
            yield (0, promises_1.writeFile)("./output.json", JSON.stringify(ast, null, 2));
            process.exit(0);
        }
        if (fn)
            (0, search_js_1.searchFnForExp)({ ast, fn, e, m, f });
        if (p)
            (0, search_js_1.searchPropertyForExp)({ ast, p, e, f });
        yield file.close();
    }))();
});
