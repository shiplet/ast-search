const arrowFunction = () => {};
function standardFunction() {}
let varFunction = function () {};
let x = "blue";

const objectExample = {
  a: "this is a",
  b: {
    value: "this is b",
  },
  c: function innerPropFunction() {
    const yellow = {
      ay: "blue",
      by: "yellow",
      cy() {
        return {
          dx: {
            ez: () => {
              return {
                b: "test",
              };
            },
          },
        };
      },
    };
    console.log("this is c");
    console.log(yellow);
  },
  ez: {
    another: "test",
  },
  d() {
    console.log("this is d");
  },
  e: () => {
    console.log("this is e");
  },
  f: arrowFunction,
  g: standardFunction,
  h: varFunction,
};
