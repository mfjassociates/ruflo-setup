# How to create ADR
There are 3 instances of when one creates an ADR document.  They depend on why they were created.  In almost all cases, you should be the diciding party.  The best way to do this is again asking me to create it by using one of the sample prompts below.

## You make the decision, ruflo documents it

The cleanest pattern. You've already decided (through experience, constraints, preference) and you want a record.
Here is an example prompt.
### Prompt
create docs/adr/ADR-007-indexeddb-over-chrome-storage.md                                                                                                            
                                                                        
I decided to use IndexedDB instead of chrome.storage.local for vector persistence.

Reasons: storage.local has a 10MB quota, IndexedDB supports structured data natively,
and vectors will grow unbounded as more posts are indexed.

Document this as an ADR with context, decision, and consequences.
### Why this works
Ruflo writes the prose, you supplied the reasoning. You own the decision.

## You set constraints, ruflo proposes, you approve
You know what you want but not how. Ruflo evaluates options and recommends one:
### Prompt
create docs/adr/ADR-008-embedding-strategy.md

I need to embed LinkedIn post text into fixed-dim vectors inside a Chrome MV3
service worker. No Node.js, no network calls, must be synchronous.
Evaluate options (hash projection, TF-IDF, ONNX wasm, API call) and recommend
the best fit. Document the trade-offs and the chosen approach.
### Why this works
Ruflo does the analysis. You read it and either approve or push back before any code is written. The decision is still yours — ruflo just did the legwork.
## Ruflo proposes during implementation, you ratify
Sometimes an agent hits a fork mid-implementation and makes a call. A good swarm documents it automatically:
### Prompt
if you make any non-obvious design decisions while implementing,
create or update an ADR in docs/adr/ before writing code
### Why this works
You review the ADR in the PR. If you disagree, you change it before merging. Ratifying it at review time is still a real decision.

## When each pattern fits

| Situation | Who decides | Prompt style |
|---|---|---|
| You already know what you want | You | Tell ruflo to document your reasoning |
| You know the goal, not the approach | Ruflo proposes, you approve | Ask ruflo to evaluate options and recommend |
| Routine implementation | Ruflo handles it | Instruct swarm to document decisions as it goes |
| Security, cost, or compliance | Always you | Never delegate — write it yourself or heavily review |
