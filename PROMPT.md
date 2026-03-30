Collaboratively design an opionionated DSL for the ast-search query.

Phase 1: Examine current ast-search implementation and work to define what an acceptable query looks like, and what its core features & syntax are.
Phase 2: Iteratively expand on that core syntax and featureset, starting from first principles and progressively increasing in complexity.
Phase 3: Integrate with current search runtime and enable passing queries as arguments, similar to how grep accepts regex.

When complete:
- I as a CLI user will be able to invoke `ast-search '{QUERY}'` at the root of a JS repo and will see all files with matching instances of the query expression
- Line-level matches will highlight the exact matched characters and include line numbers as prefixes to the output
- The search is exhaustive of all matching files in the repo
