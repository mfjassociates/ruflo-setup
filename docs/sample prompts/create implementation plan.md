# How to create an implementation plan
The best way to do that is to ask me to do that for you using a prompt similar to:

create docs/implement-vector-deduplication.md

Feature: deduplicate posts in the vector store before indexing
- if a post with the same profile_id was indexed within the last 24h and cosine
similarity > 0.95, skip insertion
- add a `isDuplicate(post)` method to RuVectorStore
- add tests covering the 24h window and the similarity threshold
- do not modify IndexedDB persistence logic

include: files to create/modify, test cases to write, edge cases to handle
