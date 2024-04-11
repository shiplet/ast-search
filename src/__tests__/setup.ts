import { createFsFromVolume, Volume } from "memfs";

export const vueSFCThisInSetup = "/vueSFCThisInSetup.vue";
export const VueSFCThisInSetup: string = `
<template>
<h1>This is a test</h1>
</template>
<script>
export default {
    data() {
        return {
            item: "blue",
            test: {
                testFn() {
                    console.log("blue")
                }
            }
        }
    },
    setup() {
        const x = () => console.log("blue");
        x();
        return {
            test: this.item
        }
    }
}
</script>
<style>
h1 {
    text-decoration: underline;
}
</style>
`;

export const exportFilename = "/defaultExport.js";
export const DefaultExport: string = `
export default {
    data() {
        return {
            item: 'test'
        }
    },
    setup() {
        console.log(this.item);
    }
}
`;

export const volume = Volume.fromJSON({
  [vueSFCThisInSetup]: VueSFCThisInSetup,
  [exportFilename]: DefaultExport,
});
export const fsMock = createFsFromVolume(volume);
