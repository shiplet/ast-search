# ast-search

A (somewhat) limited-case search tool meant to facilitate large-scale refactors.

Searches files for a given function or property name, and then determines whether those functions or properties contain a given expression or value.

## Example

For example, say you have a large number of VueJS single-file-components with `setup` functions that might be improperly accessing the `this.` instance of the file:

```
<script>
...
export default {
    setup() {
        const store = useStore();
        const dynamicTestValue = computed(() => {
            return this.testValue
        })
    },
    computed: {
        testValue: 0
    }
}
</script>
```

If you have hundreds of component files, this would be especially difficult (if not impossible) to find with a regular expression because it would require both searching across multiple lines and knowing the lexical scope of the `setup` function, which would vary widely across each file.

## Usage

`ast-search` leverages [ acornjs ](https://github.com/acornjs/acorn) to construct an Abstract Syntax Tree of each JavaScript file it parses, and then searches relevant paths for both the given top-level function or property as well as the desired search term.

For example, say the above VueJS SFC is a file at `src/components/TestValue.vue`. To search this file and determine whether the `setup` function has a `this.` expression, you'd do the following:

```bash
$ ast-search -f ./src/components/TestValue.vue --fn setup -e ThisExpression
```

If it finds the expression in the function, it echoes the file path:

```bash
$ ast-search -f ./src/components/TestValue.vue --fn setup -e ThisExpression
./src/components/TestValue.vue
```

## Arguments

| Flag               | Definition                                                                                         |
| ------------------ | -------------------------------------------------------------------------------------------------- |
| `-f, --file`       | the file path to search, relative or absolute                                                      |
| `--function, fn`   | the function to search; can be any variation of a function declaration or expression               |
| `-p, --property`   | the property to search; expected to be a property on an object                                     |
| `-m, --multiple`   | used for searching function calls, of which a single file may contain several                      |
| `-e, --expression` | the type of expression to search for; must be a valid `acornjs` JavaScript expression (list below) |
| `-d, --debug`      | output the full Abstract Syntax Tree to a file called `output.json`                                |

### Supported Expressions

| Expression Name          | Reference                                             | Common Operators              |
| ------------------------ | ----------------------------------------------------- | ----------------------------- |
| ArrayExpression          | begins an array expression                            | `[]`                          |
| ArrowFunctionExpression  | begins an arrow function in any lexical context       | `() =>`                       |
| AssignmentExpression     | equals operator                                       | `=`                           |
| AwaitExpression          | asynchronous promise resolver                         | `await`                       |
| BinaryExpression         | any left + right side operation                       | `1 + 1`                       |
| CallExpression           | function calls                                        | `fn()`                        |
| ChainExpression          | chained property or method accessors                  | `store.state.someFn()`        |
| ConditionalExpression    | ternary expression                                    | `x ? y : z`                   |
| FunctionExpression       | named, non-assigned functions                         | `fn() {}`                     |
| ImportExpression         | import statements                                     | `import x from 'y'`           |
| LogicalExpression        | evaluates to a boolean, e.g. if statement expressions | `if (x > y)`                  |
| MemberExpression         | object member accessor                                | `this.theMember`              |
| NewExpression            | `new` constructor declaration                         | `const x = new Item()`        |
| ObjectExpression         | an object as referenced by its brackets               | `{}`                          |
| ParenthesizedExpression  | an expression wrapped in parens                       | `const foo = (bar)`           |
| SequenceExpression       | deconstructor expressions                             | `({...(a,b),c})`              |
| TaggedTemplateExpression | backtick expressions                                  | <pre>`${test}`</pre>          |
| ThisExpression           | this accessors                                        | `this.someItem`               |
| UnaryExpression          | standalone statements                                 | ` return x + 1` (the `x + 1`) |
| UpdateExpression         | increments, decrements                                | `x++` or `--y`                |
| YieldExpression          | yield statements in iterators                         | `yield x`                     |

## Support

Currently only supports VueJS's Single File Components.
