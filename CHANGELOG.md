# Changelog

All notable changes to this project will be documented in this file. See [commit-and-tag-version](https://github.com/absolute-version/commit-and-tag-version) for commit guidelines.

## [8.5.0](https://github.com/skyasu2/openmanager-ai/compare/v8.4.0...v8.5.0) (2026-02-26)


### Features

* **chat:** add RAG toggle + ChatGPT-style "+" popover for tool options ([6b8a9c5](https://github.com/skyasu2/openmanager-ai/commit/6b8a9c59670b80206366866408d1fc367c231740))


### Bug Fixes

* **a11y:** resolve Biome aria warnings — remove unsupported aria-label on header/footer, div→main ([ab32864](https://github.com/skyasu2/openmanager-ai/commit/ab3286453513054346a166d5086ff61ae8b0be09))
* **ai:** TypeScript compilation error in supervisor routes regarding securityWarning property ([87f4880](https://github.com/skyasu2/openmanager-ai/commit/87f48808d3588927c29a9ebd40159663db25cf26))
* **auth:** unify login provider copy and record login UX QA run ([a4568b6](https://github.com/skyasu2/openmanager-ai/commit/a4568b62e8061d428eeb01b04554c6f5eb307583))
* **chat:** prevent raw JSON payload display in streaming AI responses ([de11d32](https://github.com/skyasu2/openmanager-ai/commit/de11d3272cafe921fb60a01c6e5db71dd0b06cf0))
* **vision:** constrain routing to image-only analysis ([af45ea4](https://github.com/skyasu2/openmanager-ai/commit/af45ea490321cfde95b0d95af16e8ff75218a791))

## [8.4.0](https://github.com/skyasu2/openmanager-ai/compare/v8.3.4...v8.4.0) (2026-02-26)


### Features

* **ai-engine:** ReAct prompt overhaul + analyst-tools split + quality improvements ([e23a847](https://github.com/skyasu2/openmanager-ai/commit/e23a847a915f3e7c11d43957ccd850aa39ea97bd))
* **ai:** use structured assistant response metadata ([a095242](https://github.com/skyasu2/openmanager-ai/commit/a0952423c09bc869e315371553bee4b22a079d7c))
* **otel-data:** causal incident scenarios + jitter clamping for 24h realistic data ([0aa9f67](https://github.com/skyasu2/openmanager-ai/commit/0aa9f67423c449f124276ed6d530d01caecb29e4))
* **otel-data:** causality-based 24h incident scenarios with metric-log reconciliation ([2261479](https://github.com/skyasu2/openmanager-ai/commit/226147928855b035fab3b73c836699192d7b03b3))
* **ui:** add ai response summary collapse and mobile alert-first dashboard ([30d2e66](https://github.com/skyasu2/openmanager-ai/commit/30d2e66adbca3b547828fa8caf01544e803a8a96))
* **ui:** improve avatar initials and ai chat restore flow ([91e0bcb](https://github.com/skyasu2/openmanager-ai/commit/91e0bcb8c5a3dc3d229a71c305d3eb93cc4f71fb))


### Bug Fixes

* **ai-engine:** harden stream metadata wait and stabilize stream tests ([63dc476](https://github.com/skyasu2/openmanager-ai/commit/63dc4760798aec3501496eb8ea70cd28ecd6cd4a))
* **ai-engine:** saturation model + reporter Korean quality + MD copy ([#171](https://github.com/skyasu2/openmanager-ai/issues/171)) ([aa5b311](https://github.com/skyasu2/openmanager-ai/commit/aa5b311ddcccd9ab7eefe6af4d5a13af8d7ee59e))
* **ai:** normalize JSON responses + device-adaptive AI + OTel dedupe ([65751e6](https://github.com/skyasu2/openmanager-ai/commit/65751e69a27f8d2e2b4f37a1a7525010bf1d2ebc))
* **e2e:** resolve 3 code review findings + improve test reliability ([29a4dc2](https://github.com/skyasu2/openmanager-ai/commit/29a4dc23c931866d93b4057a21c6e0ba3a6978bd))
* **otel-data:** sync timeseries directly from hourly files for 100% alignment ([dab8a20](https://github.com/skyasu2/openmanager-ai/commit/dab8a20740822d9f9c11ce6e2fcbf7cc692c2aaa))
* production quality improvements (P1/P2) ([9106dbc](https://github.com/skyasu2/openmanager-ai/commit/9106dbce4d62ca55e79ea2d416190355935e0053))
* resolve 3 QA findings (envLabel, MD copy, slot timing) ([b9ebc14](https://github.com/skyasu2/openmanager-ai/commit/b9ebc1444184036424835a5549b189feb411b252))
* resolve 4 code quality warnings and add stream utility tests ([5272d7b](https://github.com/skyasu2/openmanager-ai/commit/5272d7b2e1e81b87b3fb323860c4e1b64b46d455))
* **storybook:** add missing mock configs and fix authLoading state ([a87880d](https://github.com/skyasu2/openmanager-ai/commit/a87880d171949597b43e58e8fe6766232ee5f07a))
* **storybook:** remove type re-exports from sb.mock()-ed modules ([4856a5a](https://github.com/skyasu2/openmanager-ai/commit/4856a5aa52a2485007aea468305d42fb7286b8d5))
* **storybook:** resolve AuthState ReferenceError in Dashboard stories ([441c79c](https://github.com/skyasu2/openmanager-ai/commit/441c79c6e5abaf5ce597c288a2c59237e815c1e9))
* **test:** update ImprovedServerCard tests for semantic button refactor ([72dc645](https://github.com/skyasu2/openmanager-ai/commit/72dc645acec6ee713facdccfd0e7a27485ce6fbb))
* **ui:** enable long-response collapse in sidebar chat ([bad8a4c](https://github.com/skyasu2/openmanager-ai/commit/bad8a4c06ccb053f0a8e8592dc30bc8c047c2017))
* **ui:** polish ai assistant mobile and message readability ([e42f8b5](https://github.com/skyasu2/openmanager-ai/commit/e42f8b518f79938ee06fedb4e32b8031d06d6410))
* **vision:** tighten vision routing and add structured output fallback ([2b626b1](https://github.com/skyasu2/openmanager-ai/commit/2b626b1c345126d13bc35a683ef25876952b9569))

## [8.3.4](https://github.com/skyasu2/openmanager-ai/compare/v8.3.3...v8.3.4) (2026-02-24)


### Features

* add Claude-Codex-Gemini 3-way orchestration agents ([db16391](https://github.com/skyasu2/openmanager-ai/commit/db16391ea67650eca4a786e6d00f2f2b76b76c4a))
* **ai-chat:** add message queue for streaming + review fixes ([d1b8b1c](https://github.com/skyasu2/openmanager-ai/commit/d1b8b1c53a151afb21b5a20da467cd981308d00f))
* **ai-engine:** 3-way fallback with Mistral as Advisor primary ([bb568d7](https://github.com/skyasu2/openmanager-ai/commit/bb568d7ed4995acfdee3ff7cfa2172f39fdd825d))
* **ai-engine:** add topology RAG periodic sync ([6d6d296](https://github.com/skyasu2/openmanager-ai/commit/6d6d2963abf27479065af1efee01b3738d48687d))
* **ai-engine:** architecture evaluation + deploy prep (P0/P1) ([300a29f](https://github.com/skyasu2/openmanager-ai/commit/300a29f02e4a34542566fc0c36e718a4e4fd7a04))
* **ai-engine:** hybrid cache layer + session memory + response quality metrics ([bebb050](https://github.com/skyasu2/openmanager-ai/commit/bebb050faf01ef2d5724e196739e8666f30da1bc))
* **e2e:** add AI chat test + optimize alerts-logs (27→6 tests) ([f0f3e06](https://github.com/skyasu2/openmanager-ai/commit/f0f3e060aae3033a1647dc3487c1e39a90a0b0f6))


### Bug Fixes

* **ai-engine:** handle Cerebras llama-3.3-70b deprecation with provider retry ([65b9868](https://github.com/skyasu2/openmanager-ai/commit/65b98680c52ce54945e4ed73c3bc8da1d367f613))
* **ai-engine:** resolve Analyst Agent empty response with summarization fallback ([8298319](https://github.com/skyasu2/openmanager-ai/commit/8298319d178a2cda7888b780ecc19a2caf394ec7))
* **ai-engine:** route topology queries through RAG advisor path ([8dd5a53](https://github.com/skyasu2/openmanager-ai/commit/8dd5a5343d6ffc7542d93e23c2596980f80c7724))
* **landing:** sync architecture diagrams and feature cards with actual AI engine ([3feca0f](https://github.com/skyasu2/openmanager-ai/commit/3feca0f1efeea48466df11a5f47be84f578536c5))
* **qa:** accessibility + version fix, add 5 Storybook stories ([d98b98f](https://github.com/skyasu2/openmanager-ai/commit/d98b98fdfd1ead32094e20fd7f95cf57ccc809c2))
* resolve 16 code review issues across frontend and backend (P0-P2) ([7c98780](https://github.com/skyasu2/openmanager-ai/commit/7c98780858ec5dce29790bf1592ba26e61cc1681))

## [8.3.3](https://github.com/skyasu2/openmanager-ai/compare/v8.3.2...v8.3.3) (2026-02-23)


### Bug Fixes

* **ai-engine:** add explicit types for TS7006 strict mode compliance ([aee4f17](https://github.com/skyasu2/openmanager-ai/commit/aee4f1742d7b9e2d4c7da3b27250fd002a682619))
* **auth:** allow guest PIN users to access AI assistant ([fcf3202](https://github.com/skyasu2/openmanager-ai/commit/fcf3202fa3789c0ccad895b05fabd38a5001333b))
* **auth:** resolve guest login cookie deletion and sessionId mismatch ([5d95381](https://github.com/skyasu2/openmanager-ai/commit/5d95381066386e5a2ab6293e0282d5b76759139d))
* **data:** correct landing page tech versions and rename ai-assistant-pro ([3ea88e6](https://github.com/skyasu2/openmanager-ai/commit/3ea88e67d198cabbbe247c52f08267eb4f5d0a5e))
* **observability:** add warmup telemetry and first-query latency tracking ([c9de419](https://github.com/skyasu2/openmanager-ai/commit/c9de4196d0cd88fe3f1cc19498b272d7ad1e0f80))
* **test:** add root vitest.config.ts and sync aliases from tsconfig ([be1a3af](https://github.com/skyasu2/openmanager-ai/commit/be1a3afca023d3abe6796972f058759a32aefbd1))
* **warmup:** await Cloud Run response and trigger warmup at login ([f2f1b2d](https://github.com/skyasu2/openmanager-ai/commit/f2f1b2dba291953bc1650a23963a25aa351aba68))

## [8.3.2](https://github.com/skyasu2/openmanager-ai/compare/v8.3.1...v8.3.2) (2026-02-22)


### Bug Fixes

* **ci:** use npm install for AI Engine tests to handle peer dep resolution ([e95dc64](https://github.com/skyasu2/openmanager-ai/commit/e95dc644e4bf56c9e91b55ec038b043d9299af18))
* **deps:** regenerate AI Engine lockfile to include GCP logging transitive deps ([1114682](https://github.com/skyasu2/openmanager-ai/commit/1114682641365460e73c2d9e676fa4061e4c38d4))
* **deps:** restore AI Engine lockfile from release baseline and re-resolve ([c7bdced](https://github.com/skyasu2/openmanager-ai/commit/c7bdcedea2387ac173a70f0b2c9345424dab2d48))
* **test,ci:** stabilize E2E critical suite and Cloud Run peer deps ([2eefd45](https://github.com/skyasu2/openmanager-ai/commit/2eefd45c962a0bca29d3c0e6b53d6f33fbbbe0e4))
* **test:** mock isTavilyAvailable in supervisor-routing tests ([66e5a88](https://github.com/skyasu2/openmanager-ai/commit/66e5a88e0d64c7b53d24d84e0b368314d481ee2f))

## [8.3.1](https://github.com/skyasu2/openmanager-ai/compare/v8.3.0...v8.3.1) (2026-02-22)


### Features

* **security,observability:** strengthen proxy auth, GCP logging, and test coverage ([ed5745e](https://github.com/skyasu2/openmanager-ai/commit/ed5745ea4f42c4bae0a9a0954cb587628c5ca919))


### Bug Fixes

* **license:** add GPL-3.0 project header, package metadata, and OCI label ([1866f8b](https://github.com/skyasu2/openmanager-ai/commit/1866f8b5d9a25b5765d4d3db38c2d7534471a95b))
* **test:** resolve 8 Cloud Run test timeouts with vi.hoisted and extended timeout ([71c0595](https://github.com/skyasu2/openmanager-ai/commit/71c0595fa9b8866048b4db3f0e5ed3aa1ecb4546))

## [8.3.0](https://github.com/skyasu2/openmanager-ai/compare/v8.2.0...v8.3.0) (2026-02-22)


### Features

* **auth:** add HMAC-signed guest session proof to prevent cookie forgery ([dfa86e8](https://github.com/skyasu2/openmanager-ai/commit/dfa86e81a3d459079b66ad95e615d9bc24e11600))
* **hooks:** add prepare-commit-msg hook for AI co-author auto-tagging ([325a1d5](https://github.com/skyasu2/openmanager-ai/commit/325a1d59ead911c168f6474856cea2320d38bac7))
* **security:** add GPL v3 license and guest PIN brute-force protection ([3905ef2](https://github.com/skyasu2/openmanager-ai/commit/3905ef295f5d72e17beda696340a82788b6c26d8))


### Bug Fixes

* **ui:** unify AI gradient animation across logo, text, and button ([d94bcce](https://github.com/skyasu2/openmanager-ai/commit/d94bcce0cbca62d6259111efd8f6d726d3b001a1))

## [8.2.0](https://github.com/skyasu2/openmanager-ai/compare/v8.1.0...v8.2.0) (2026-02-22)


### Features

* [COST] optimize AI route timeout budgets and align Vercel limits ([4b9aca0](https://github.com/skyasu2/openmanager-ai/commit/4b9aca0f00c0e3df06f56785b2d2235dbebd81dc))
* add 5 page-level Storybook stories with mock infrastructure ([06033e9](https://github.com/skyasu2/openmanager-ai/commit/06033e974f33f051b233b85a62494e48438762cb))
* add incident search, Storybook v10 setup, login dark theme, and stability fixes ([a8e0206](https://github.com/skyasu2/openmanager-ai/commit/a8e0206f1d802d803ca43546666a8cf0a4e1f4d5))
* **auth,observability:** add email magic link login, runtime log level control, and dead code cleanup ([fc9c555](https://github.com/skyasu2/openmanager-ai/commit/fc9c555e627c0e4f99cf1850b39eb9fcaa06fc28))
* budget-aware proxy timeout and retry for free-tier safety ([4c90e0c](https://github.com/skyasu2/openmanager-ai/commit/4c90e0c7193b4c881e98d66262c0e60e5285484f))
* **cache:** add semantic-lite query normalization for AI cache ([6770110](https://github.com/skyasu2/openmanager-ai/commit/677011015c22839e2496fc34f2c04f6d9301e11e))
* **cold-start-ux:** add streaming warmup indicator and improve cold start error handling ([11346d2](https://github.com/skyasu2/openmanager-ai/commit/11346d2c61594619001e4d2d0bcaa50792f2c328))
* **config:** add server-data-polling SSOT module ([bf3415c](https://github.com/skyasu2/openmanager-ai/commit/bf3415ced883355bfdc0fe611f724f6859a7899c))
* **landing:** add Storybook to vibe-coding diagram and detail cards ([6fa3f55](https://github.com/skyasu2/openmanager-ai/commit/6fa3f55817736c85da2351dc4349b3bb59201045))
* **mcp:** add Storybook MCP support for Codex with auto/on/off mode ([9fcd74f](https://github.com/skyasu2/openmanager-ai/commit/9fcd74f6166900293c959af92c25203cff012080))
* **release:** add publish.sh for automated GitHub Release creation ([1ef8a10](https://github.com/skyasu2/openmanager-ai/commit/1ef8a10958dc4397c904c13614d14e04a216199e))
* replace Log Explorer with OTel 24h data and remove Incident Explorer ([51ac2c5](https://github.com/skyasu2/openmanager-ai/commit/51ac2c59764632fdccbc8a78e8ce7a1be5c06f66))
* **storybook:** add 27 component stories to reach ~42% coverage ([b60e4ed](https://github.com/skyasu2/openmanager-ai/commit/b60e4edaa6217154e8fe6a9649f50845fe99994a))
* **storybook:** add email login stories, AIDebugPanel story, fix stale mock ([b4a5726](https://github.com/skyasu2/openmanager-ai/commit/b4a57264613e224b9462cfe426fa564ae6c1c312))
* **storybook:** add ErrorMessage stories for all error types ([c9eb305](https://github.com/skyasu2/openmanager-ai/commit/c9eb30503c7f4c115c37c04d95514889a67f7769))
* **storybook:** add play function interactions and argTypes controls ([8139c83](https://github.com/skyasu2/openmanager-ai/commit/8139c83af0061e5fa5ca0a68de39b24badc5a7fc))
* **storybook:** add Tier 1 UI component stories for 9 core primitives ([99d10c8](https://github.com/skyasu2/openmanager-ai/commit/99d10c85da2d4af67947f894b56ed58ab56b08b1))
* **storybook:** add Tier 2 stories for UI primitives and shared components ([cd9ad5d](https://github.com/skyasu2/openmanager-ai/commit/cd9ad5d73b6bdd4943e431456270433795445e79))
* **storybook:** add Tier 3 dashboard and AI sidebar stories ([ffca496](https://github.com/skyasu2/openmanager-ai/commit/ffca496a9aa8cf14c1c63ff4feb4bddb574f6db0))
* **test:** complete Cloud Run E2E contract and fix doc consistency ([5c087ae](https://github.com/skyasu2/openmanager-ai/commit/5c087ae2159175b5bd622c80e6c4f723f35dad42))


### Bug Fixes

* address P2 code review issues across 6 files ([2fa19ae](https://github.com/skyasu2/openmanager-ai/commit/2fa19ae79d01a4aa690866bb1e7e49aa6670e0fc))
* **ai-stream:** recover finalAnswer text in streaming mode + add Playwright MCP E2E guide ([dc14fbe](https://github.com/skyasu2/openmanager-ai/commit/dc14fbea1a6759593010332bf3e499aeb5439018))
* apply 3rd code review fixes (P0-P2, 10 items across 11 files) ([e70d199](https://github.com/skyasu2/openmanager-ai/commit/e70d199ca92a53eedb5b81731d88607f4117f7e6))
* apply 4th code review fixes (P0-P2, 14 items across 14 files) ([b3ddcbf](https://github.com/skyasu2/openmanager-ai/commit/b3ddcbf70cafe893d151e48bad89fed24838fe4a))
* apply 5th code review fixes (P0-P2, 8 items across 8 files) ([06fdca0](https://github.com/skyasu2/openmanager-ai/commit/06fdca00e2d1f4cac9d1e7cdc3f66c3d26b7e527))
* apply 7th code review fixes (P1 5, P2 4 across 9 files) ([9bfb180](https://github.com/skyasu2/openmanager-ai/commit/9bfb1802a1a9474d9bcafba60fb9b4b53433ad0e))
* apply 9th code review fixes (P1 5, P2 6 across 10 files) ([6bb05e9](https://github.com/skyasu2/openmanager-ai/commit/6bb05e9b54e93030a4f94ad21f0b6216edf7f62f))
* **cache:** add endpoint isolation to Redis AI cache keys ([749da0d](https://github.com/skyasu2/openmanager-ai/commit/749da0dae264fb1929830946559d7d9152b5bcd2))
* **cold-start:** fix wake-up HTTP method, preemptive warmup state, and remove dead code ([5498d6f](https://github.com/skyasu2/openmanager-ai/commit/5498d6f425d582385aef98b673e0a3198bec13ed))
* correct stability alert metric field name and HTTP 404 for missing servers ([a3a6104](https://github.com/skyasu2/openmanager-ai/commit/a3a61040c916f869579ccf9ef683e5d538e5a175))
* delete orphaned store tests and reorder login buttons ([4a681d8](https://github.com/skyasu2/openmanager-ai/commit/4a681d83d6e968329f835b3eed6583661524862f))
* **e2e:** separate NLQ to manual track and fix review feedback ([fa305bd](https://github.com/skyasu2/openmanager-ai/commit/fa305bd3fd119b03383ee474a587c485230b622d))
* **frontend:** reduce polling and harden AI stop flow ([e449508](https://github.com/skyasu2/openmanager-ai/commit/e449508bc096bacc4f59c8fa5ef55ddd81efa3c9))
* guard web search against Tavily unavailability and relax 429 rate limit ([d3fb9c2](https://github.com/skyasu2/openmanager-ai/commit/d3fb9c20ff7052cd2363040bc1f8a9fc0cbc3fa9))
* handle 204 no-body response in AIDebugPanel and consolidate auth logging ([eeb4cbf](https://github.com/skyasu2/openmanager-ai/commit/eeb4cbf79112a200006cc0babd18fa98f3a71f43))
* **landing:** improve Storybook description for non-developers ([b78ab2e](https://github.com/skyasu2/openmanager-ai/commit/b78ab2e1f04a476553122991022bffdfcffd3a55))
* **performance:** throttle dashboard render warning logs ([128db36](https://github.com/skyasu2/openmanager-ai/commit/128db36da59e80d92fd15289d2c7a87b1ef27f8a))
* **promql:** retry label cache load after transient catalog miss ([e535b11](https://github.com/skyasu2/openmanager-ai/commit/e535b11dc729529df1736e09c386e755d4ff7ed9))
* **release:** enable release reminder in pre-push and add weekly freshness check ([88e157d](https://github.com/skyasu2/openmanager-ai/commit/88e157d5faf4c8a38d2f9f0c90b46d574e58293a))
* remove unused guest IP range check and apply Biome formatting ([bbefa67](https://github.com/skyasu2/openmanager-ai/commit/bbefa67657740d4305ec3f9a245edf6d83e148b1))
* remove unused import in card stories ([dc805d6](https://github.com/skyasu2/openmanager-ai/commit/dc805d67d6706209e74febf12df25de149bdbbb3))
* reset labelsCachePromise on rejection + remove orphaned JSDoc ([70e0f7d](https://github.com/skyasu2/openmanager-ai/commit/70e0f7d42c327d34e2e69e5a6def433506036b95))
* **review:** apply P2 code review fixes (warmup, test setup, debug panel) ([e22cc0f](https://github.com/skyasu2/openmanager-ai/commit/e22cc0f2ec2ff956d8268ecb4237e2e26ecdd1f8))
* **review:** harden unified api and ai redirect handling ([19a4c43](https://github.com/skyasu2/openmanager-ai/commit/19a4c439f302aa7d491ba0a4b1b81a77dd3d2699))
* **security:** timing-safe auth for debug endpoints and harden rate limiting ([b54d1c2](https://github.com/skyasu2/openmanager-ai/commit/b54d1c2fb3d1982f4b68c52afedcf0dc53fd6489))
* **storybook:** use matching error patterns in ColdStartErrorBanner stories ([c8935a7](https://github.com/skyasu2/openmanager-ai/commit/c8935a77ce2ae14e65bce9eb01b9d9d15734c329))
* **storybook:** use screen instead of canvas for portal component assertions ([9d955d8](https://github.com/skyasu2/openmanager-ai/commit/9d955d8643a3b7d012e91e0c85060bbd5a9e94a5))
* **test:** stabilize monitoring report error state and modal escape close ([1b87361](https://github.com/skyasu2/openmanager-ai/commit/1b87361123803d15dc53c1584434e3d6c48ef13b))
* **time:** make rotating timestamp logic timezone-stable in KST ([f05cee1](https://github.com/skyasu2/openmanager-ai/commit/f05cee1791dd6003869056234047ee01fdc6ad6e))
* **ui:** maximize architecture modal viewport and trim header space ([b46ceba](https://github.com/skyasu2/openmanager-ai/commit/b46ceba3535cfb486838416a6da747c57268307e))
* **ui:** restore logo gradient icon and add "AI" text with matching gradient ([92a3acb](https://github.com/skyasu2/openmanager-ai/commit/92a3acb107f03bbae3a3b43ba0c01d8260a417a7))

## [8.1.0](https://github.com/skyasu2/openmanager-ai/compare/v8.0.0...v8.1.0) (2026-02-18)


### Features

* **ai-engine:** add docker preflight gate before deploy ([18182d3](https://github.com/skyasu2/openmanager-ai/commit/18182d35dbb50bd55e65deea5b7d9df5010c1d88))
* **ai:** add claude-codex-gemini bridge and pair chat ([0c48d08](https://github.com/skyasu2/openmanager-ai/commit/0c48d0881ed3d4cf518aa2e25a698995483d9843))
* **ai:** consolidate embedding and QA hardening [COST] ([62c31f6](https://github.com/skyasu2/openmanager-ai/commit/62c31f694ccbfac540733de331f68039305dd406))
* **ai:** harden bridge orchestration and update dev setup docs ([1a1fa16](https://github.com/skyasu2/openmanager-ai/commit/1a1fa16081c178746ae67bbc430095cf8c1105fb))
* **api:** add database health check and sentry tunnel endpoints ([13580c9](https://github.com/skyasu2/openmanager-ai/commit/13580c94114c21c4456ea192c42c67e6d15b4f9f))
* **dashboard:** refactor empty state, upgrade ReactFlow design, add model config error banner ([d968c7b](https://github.com/skyasu2/openmanager-ai/commit/d968c7bf8c603795267ab64ca7c7d6ca18cba3b7)), closes [#60a5](https://github.com/skyasu2/openmanager-ai/issues/60a5)
* **data:** externalize otel runtime dataset and async loading ([a9fc5d1](https://github.com/skyasu2/openmanager-ai/commit/a9fc5d1a07f93a87c8fdc7b038021577d4a3fd4a))
* **grafana:** add OTLP export script and dashboard config ([fa79f2f](https://github.com/skyasu2/openmanager-ai/commit/fa79f2fc58f5daf971ce5ea1300d7520eafef710))
* **mobile:** apply mobile web standards (WCAG, HIG, Material Design) ([60399b7](https://github.com/skyasu2/openmanager-ai/commit/60399b7f6eb80ce04dab5f56a39b06f3264b1377))
* **skills:** add /push slash command for quick git push ([6729aef](https://github.com/skyasu2/openmanager-ai/commit/6729aef6fc621d5461faf69c28eef0c1fa1d0f73))
* **skills:** add github-deploy skill using GitHub MCP ([61dd3af](https://github.com/skyasu2/openmanager-ai/commit/61dd3af6c8e7f9b4c3e3ea9308b17eb263bf4022))
* **skills:** add security-audit, playwright-triage, observability-check skills ([bde07ad](https://github.com/skyasu2/openmanager-ai/commit/bde07ada2b91f03481473978a14eca4771892ad4))
* **test:** add cloud deploy essential smoke script ([6d257c2](https://github.com/skyasu2/openmanager-ai/commit/6d257c2d73f02d50a8e10cd35a388353f276c866))
* **ui:** improve login switching and profile menu controls ([9975e83](https://github.com/skyasu2/openmanager-ai/commit/9975e833e094d1b3c9f5617995bfe5e4fa09d00a))
* **ui:** improve mobile responsive layout for ServerCard and LogExplorer ([8335320](https://github.com/skyasu2/openmanager-ai/commit/833532082586c28d1f26ffa1a7fbc3e05c013c71))


### Bug Fixes

* **a11y:** use div[role=status] instead of redundant aria-live, block root PNGs ([54f89ab](https://github.com/skyasu2/openmanager-ai/commit/54f89ab84ce94cd6e15d6fcb5e52aa8ef5943d58))
* **ai-engine:** add Vision Agent empty response fallback and min token guard ([84fb8a2](https://github.com/skyasu2/openmanager-ai/commit/84fb8a2bb6e0b66f62e032e73b3bf6f714cc6b6d))
* **ai-engine:** handle NoOutputGeneratedError with graceful fallback ([5009f6a](https://github.com/skyasu2/openmanager-ai/commit/5009f6a0516e40bd49f6d81a42e516323285dc3a))
* **ai-engine:** harden cloud-run docker preflight asset sync ([dc9f450](https://github.com/skyasu2/openmanager-ai/commit/dc9f45050c92f0570cde83b4b191f0aa2f85d137))
* **ai-engine:** harden vision openrouter empty-response handling ([1745d60](https://github.com/skyasu2/openmanager-ai/commit/1745d60c12419cb7a609bd12e1397981c3ed3312))
* **ai-engine:** recover from reporter limits and empty streams ([7c0494f](https://github.com/skyasu2/openmanager-ai/commit/7c0494f660086fc00f38160e97c4c9b0738631b6))
* **ai-engine:** sync lockfile for docker preflight ci ([72da97f](https://github.com/skyasu2/openmanager-ai/commit/72da97fd33bfbd54d68294285a0b4420880b2da2))
* **ai-engine:** timer leak, batch limit, Tavily sequential failover ([6ed02b2](https://github.com/skyasu2/openmanager-ai/commit/6ed02b2fb361f5ed77e1b74224f1648ccf7398e7))
* **ai-stream:** stabilize resume ownership and redirect transition ([aa6943e](https://github.com/skyasu2/openmanager-ai/commit/aa6943e2b00fbde9450e0fb1b3605d84da923944))
* **ai:** correct AIWorkspace fullscreen route path ([e52a848](https://github.com/skyasu2/openmanager-ai/commit/e52a84878129a541307811925954752a9d696570))
* **ai:** harden gemini bridge auth flow in wsl ([c715539](https://github.com/skyasu2/openmanager-ai/commit/c71553911a0323ca7e23e57f86b54f83574cd443))
* **ai:** ignore initial resume-probe fetch errors before first query ([2dd90df](https://github.com/skyasu2/openmanager-ai/commit/2dd90df67135789d19adfe607d2b863442c6b04a))
* **bootstrap:** downgrade Cloud Run health check error to warn level ([4c11a22](https://github.com/skyasu2/openmanager-ai/commit/4c11a22c40b1483b2351f5271b51fdc8b25a4f38))
* **ci:** organize server action imports ([6fc7730](https://github.com/skyasu2/openmanager-ai/commit/6fc773004bfd275b4b327c23a5c79062fac0b2a4))
* **cloud-run:** always re-sync otel data in docker-preflight when source is newer ([c789a42](https://github.com/skyasu2/openmanager-ai/commit/c789a42174c17eaec3e1072b10096894ca07cce5))
* **dashboard:** stabilize ai sidebar close behavior across breakpoints ([1240ee6](https://github.com/skyasu2/openmanager-ai/commit/1240ee64aca74de0a84fb40f7ed744eee362795c))
* **dashboard:** switch to direct otel metric transform ([f21307b](https://github.com/skyasu2/openmanager-ai/commit/f21307b8bb2aba259ddbbee5a18941c4f7a482c7))
* **dashboard:** use hourly syslog data in modal logs ([3798329](https://github.com/skyasu2/openmanager-ai/commit/37983294a90682c27eefdec11a090e3b76c7a9a4))
* **data:** OTel data quality improvements and metric pipeline fixes ([98e08ba](https://github.com/skyasu2/openmanager-ai/commit/98e08bafebca67134208440457182bcaada2d3a2))
* **deploy:** remove platform-specific optionalDependencies causing Vercel build failure ([8772766](https://github.com/skyasu2/openmanager-ai/commit/877276635741635ac2e1304c7ba87e4e13841dd6))
* **e2e:** add rate limit error detection and test:vercel:ai script ([8e9f5d9](https://github.com/skyasu2/openmanager-ai/commit/8e9f5d9f64fd9e45fc133efc8013915144706d82))
* **e2e:** stabilize E2E selectors and fix rate limit message bug ([9c6d0c9](https://github.com/skyasu2/openmanager-ai/commit/9c6d0c9b42a801a91cf55abd981506a9d15e7fc5))
* **frontend:** tighten system-start auth flow and bootstrap recovery ([a741eb1](https://github.com/skyasu2/openmanager-ai/commit/a741eb109113725878913bbbf9586012eab49119))
* **incident-report:** harden retry, fallback, and cache handling ([da27667](https://github.com/skyasu2/openmanager-ai/commit/da2766703740b89ce1e6363f8cc5c1b9e77456b5))
* **landing:** remove redundant text and improve vibe coding card legibility ([cf470bf](https://github.com/skyasu2/openmanager-ai/commit/cf470bfdeab80615f5226c926bd302544e5a6605))
* **logging:** downgrade useSystemStatus fetch error to debug level ([56b10c2](https://github.com/skyasu2/openmanager-ai/commit/56b10c205acf13ab2ec04985745f2c9402cbb0b8))
* **metrics:** adapt OTelHourlyFile format and propagate async across call chain ([322cf4a](https://github.com/skyasu2/openmanager-ai/commit/322cf4a4e868b55d31b7da8b004e845bff7adf86))
* **metrics:** align OTel datapoint indexing with slot resolution ([861df0e](https://github.com/skyasu2/openmanager-ai/commit/861df0e7a6d28ccd19c331ad6a87a2d4b2d9c810))
* **monitoring:** restore network bytes contract and route integration tests ([948cb2e](https://github.com/skyasu2/openmanager-ai/commit/948cb2eac210b1c16c3b029af6b969dd97b7b5f5))
* **observability:** add upstream timeout to sentry tunnel ([8df64a8](https://github.com/skyasu2/openmanager-ai/commit/8df64a89057ca1073efd8a9b6790bc7aee66f438))
* **qa:** align api contracts and expand dashboard critical tests ([49d9ff6](https://github.com/skyasu2/openmanager-ai/commit/49d9ff6aae0610655dd9de292178ff31efc638be))
* remove dangling npm scripts and clear agent state on new session ([0ad2df4](https://github.com/skyasu2/openmanager-ai/commit/0ad2df4dc8a0d02b029128c5d6984aa6764a4619))
* remove dead CentralizedDataManager, update WBS/TODO accuracy ([385a29b](https://github.com/skyasu2/openmanager-ai/commit/385a29b0960ea66c98afe361db85c6410ff2a581))
* remove dead vector-db mock and update skill versions to v8.0.0 ([fa5fb6e](https://github.com/skyasu2/openmanager-ai/commit/fa5fb6e28ad1a0db9894329ec53939f2d8a691fa))
* remove remaining "OpenManager Vibe" references in public/, tests/, docs/ ([b4f6025](https://github.com/skyasu2/openmanager-ai/commit/b4f6025a456ee016f20958d8e2fcb71b003eca46))
* remove scenario metadata and fix role-based log generation bugs ([36c0c4e](https://github.com/skyasu2/openmanager-ai/commit/36c0c4ea07f2f090ab88f6aca9c14ea84ce84baf))
* resolve code review findings — OTel data, dead vector-db code, docs ([5db08d7](https://github.com/skyasu2/openmanager-ai/commit/5db08d7985887816e549bacdd187d0db4a1a458b))
* resolve server type/location/uptime "unknown" by linking OTel resource catalog ([399b3c4](https://github.com/skyasu2/openmanager-ai/commit/399b3c48c4ce1c94f78acd287b71f3458783bcb7))
* resolve TS/lint errors and improve docs-as-code pipeline ([ec51e21](https://github.com/skyasu2/openmanager-ai/commit/ec51e21fa392c1977948b5d1eb9f50e44b581aca))
* **security:** add open redirect prevention and robust error handling ([d67f051](https://github.com/skyasu2/openmanager-ai/commit/d67f0517ec6af5899b6d6ea89eef6429ebe9c78c))
* **security:** Cloud Run hardening, AI hook fixes, and WBS update ([84fde3c](https://github.com/skyasu2/openmanager-ai/commit/84fde3ccd094bcc06d9cee4d9555c5d214f0d6fb))
* **skills:** add git fetch after PAT push to sync tracking ref ([066d63c](https://github.com/skyasu2/openmanager-ai/commit/066d63c0d341934667ef26608716f355ea6d21cf))
* **stability:** apply review-driven hardening across stream and metrics ([6a49d2e](https://github.com/skyasu2/openmanager-ai/commit/6a49d2e1227b5486cab2ac49ef79affe320a08e9))
* stabilize AI error dismiss flow and apply pending infra updates ([e46924c](https://github.com/skyasu2/openmanager-ai/commit/e46924c3ea652e0b270977dbf2ce663b45056be7))
* **ui:** improve accessibility and mobile performance ([39dcbe5](https://github.com/skyasu2/openmanager-ai/commit/39dcbe51170b110620a3e2d0cbe596912463a804))
* **ui:** prevent vertical text wrapping in mobile system status section ([2f3bc36](https://github.com/skyasu2/openmanager-ai/commit/2f3bc36bad1d4ba7f77e9ce3245ca5626ace81b9))
* **ui:** resolve QA issues - guest redirect, console noise, mobile layout ([0f4f751](https://github.com/skyasu2/openmanager-ai/commit/0f4f7517d9358028e005fd8e2bdf7bfbb13ec982))
* update hourly-data JSON files (hours 00-05) ([cb0f67a](https://github.com/skyasu2/openmanager-ai/commit/cb0f67a76514e15d291f6eafb031a0ef75e5bd21))
* update hourly-data JSON files (hours 06-11) ([e1f68ed](https://github.com/skyasu2/openmanager-ai/commit/e1f68ed3065b18a5c9e7502bbecdb283baffb231))
* update hourly-data JSON files (hours 12-17) ([eaed7bf](https://github.com/skyasu2/openmanager-ai/commit/eaed7bf4ce37f52e40e5beefb3b7b9caeffe73c9))
* update hourly-data JSON files (hours 18-23) ([84b70f4](https://github.com/skyasu2/openmanager-ai/commit/84b70f4f5bec4013ad9a0a74fae1d7f57a3c781a))
* update pipeline-helpers, sync-hourly-data, loki-log-generator, LogsTab ([4eb501a](https://github.com/skyasu2/openmanager-ai/commit/4eb501a304c0eb0d2d300abc3432961176abaef3))
* update server-data-logs, types, test, and loki-log-generator ([fa32d08](https://github.com/skyasu2/openmanager-ai/commit/fa32d084c1f581a3ccbe8b4718d89487d777a777))

## [8.0.0](https://github.com/skyasu2/openmanager-ai/compare/v7.1.4...v8.0.0) (2026-02-12)


### ⚠ BREAKING CHANGES

* **project:** openmanager-vibe-v5 → openmanager-ai 리네이밍
  - GitHub: skyasu2/openmanager-ai
  - Vercel: openmanager-ai.vercel.app
  - OTel service name: openmanager-ai

### [7.1.4](https://github.com/skyasu2/openmanager-ai/compare/v7.1.3...v7.1.4) (2026-02-06)


### Features

* **data:** add server-services-map for automatic service inference ([3ce9458](https://github.com/skyasu2/openmanager-ai/commit/3ce94584a3b709d0becff2565798766b5a08614d))
* **data:** add uPlot and Prometheus Format to tech stack ([#132](https://github.com/skyasu2/openmanager-ai/issues/132)) ([63dc093](https://github.com/skyasu2/openmanager-ai/commit/63dc0935ed27907b0ae89e4b461001278dc6e117))

### [7.1.3](https://github.com/skyasu2/openmanager-ai/compare/v7.1.2...v7.1.3) (2026-02-06)


### Features

* **metrics:** add uPlot charts, PromQL engine, and pre-compute pipeline ([a6407ab](https://github.com/skyasu2/openmanager-ai/commit/a6407ab0c1457751f287cba312f0c0bcfff560ce))
* **metrics:** convert hourly-data to Prometheus format and add monitoring pipeline ([f5f3645](https://github.com/skyasu2/openmanager-ai/commit/f5f36454a73cb0ae92944ce28b7f5b4503e91ee9))
* **prometheus:** unify thresholds and extend AI context with metrics ([5571ef3](https://github.com/skyasu2/openmanager-ai/commit/5571ef36504afaa5467846434bc5c69f60bdcc58))


### Bug Fixes

* **api:** update JSDoc and add uptime calculation from bootTimeSeconds ([0e11284](https://github.com/skyasu2/openmanager-ai/commit/0e11284cc5166742e1b0f5e5e41a959c5346c44e))
* **dashboard:** prevent N+1 API calls by setting initialDataUpdatedAt ([b9aad02](https://github.com/skyasu2/openmanager-ai/commit/b9aad0204236b502458a9e4001d95e09fd86ee53))
* **dashboard:** resolve 3 QA issues - API 404, hydration mismatch, summary filter ([b0a5e42](https://github.com/skyasu2/openmanager-ai/commit/b0a5e42d1032e240b1b4cc494b27432b31cc0e63)), closes [#419](https://github.com/skyasu2/openmanager-ai/issues/419)
* **hydration:** resolve React Error [#419](https://github.com/skyasu2/openmanager-ai/issues/419) by fixing suppressHydrationWarning placement and locale consistency ([b8bc1aa](https://github.com/skyasu2/openmanager-ai/commit/b8bc1aab134fe94e27ccce019cc3677299d1c482))
* **logging:** replace console.warn with structured logger calls ([2099274](https://github.com/skyasu2/openmanager-ai/commit/20992748d8fbfc4701b3f38ca475a6b46fe441c5))
* **metrics:** add os/systemInfo/networkInfo to non-realtime API path ([27cd44b](https://github.com/skyasu2/openmanager-ai/commit/27cd44b30c2d2e47389e45b8aae7064decb3f3b0))
* **metrics:** correct KST timestamp ISO format and clarify threshold logic ([554184c](https://github.com/skyasu2/openmanager-ai/commit/554184c379652d080c0512c40a3f8c5d661515a2))
* **metrics:** use Prometheus data instead of hardcoded values in data pipeline ([1fccdf2](https://github.com/skyasu2/openmanager-ai/commit/1fccdf2983367a8581dda5df5fbb474a976ce680))
* **monitoring:** resolve 11 data pipeline, API, and UI issues from deep analysis ([cd068a9](https://github.com/skyasu2/openmanager-ai/commit/cd068a96e658433c3ce112f8488ad6a0eec47a40))
* **review:** replace stale file reads with real-time validation in /review command ([6e138c9](https://github.com/skyasu2/openmanager-ai/commit/6e138c9aa1d8316ec29966bf3eab6c01e4938d24))
* **test:** add 16 missing lucide-react icon stubs and fix assertions ([e7b6855](https://github.com/skyasu2/openmanager-ai/commit/e7b68555d6f73096b89d9d52b19cf4489feec091))
* **test:** resolve WSL worker timeout with fork pool and module stubs ([16beb31](https://github.com/skyasu2/openmanager-ai/commit/16beb31c3ce3132b1d214b8041baf88da1808319))
* **types:** update InputEvent type for @types/react 19.2.10 compatibility ([a3d1c83](https://github.com/skyasu2/openmanager-ai/commit/a3d1c835385a0fdb6f151e9b185f4e220793e7e5))

### [7.1.2](https://github.com/skyasu2/openmanager-ai/compare/v7.1.1...v7.1.2) (2026-02-03)


### Features

* **ai-sidebar:** integrate Cloud Run status with system start/stop ([05af7c6](https://github.com/skyasu2/openmanager-ai/commit/05af7c6872dd2ac3dce4140f54462699e0c91377))
* **ai:** add cache query normalization and complexity weights externalization ([9ae7581](https://github.com/skyasu2/openmanager-ai/commit/9ae758142b5f2115dc5a72fd0731bac1c2f372e0))
* **ai:** add configurable settings and streaming retry with observability ([2af1b5e](https://github.com/skyasu2/openmanager-ai/commit/2af1b5e0a3c895ecaa179895bc7a22eccfadea15))
* **ai:** expose RAG source URLs as clickable links in AnalysisBasisBadge ([f8061fb](https://github.com/skyasu2/openmanager-ai/commit/f8061fbf937fabe7aa66d9e730a80211f0d42a67))
* **ai:** inject server context into AI supervisor for targeted analysis ([b34acfa](https://github.com/skyasu2/openmanager-ai/commit/b34acfa89cbb54f50033c1121a35bbc6e365df73))
* **observability:** add trace ID upstream extraction and retry jitter ([bf66387](https://github.com/skyasu2/openmanager-ai/commit/bf663876a0877e0e28b2dbfe035d15b30e342fc4))


### Bug Fixes

* add securityCheck to stream/v2 route (prompt injection bypass) ([5e8ca21](https://github.com/skyasu2/openmanager-ai/commit/5e8ca218d4053a6b16c1d44397a2ef7919fd598e))
* **ai-engine:** force searchWeb tool call when web search toggle is ON ([e219389](https://github.com/skyasu2/openmanager-ai/commit/e219389e0aa56059da455ed15a94bac5c0f5509e))
* **ai-engine:** unify console→logger + remove Sentry from Cloud Run ([4537bc7](https://github.com/skyasu2/openmanager-ai/commit/4537bc70d1aac0a40d69026b96f159d57c190dd6))
* **ai:** add web search ragSources to streaming mode and fix data- prefix ([6e8bc36](https://github.com/skyasu2/openmanager-ai/commit/6e8bc36179b324b6d841251b4f5b49526242d31c))
* **ai:** correct onFeedback type, wire handleNewSession, enforce web search toggle ([db9abb1](https://github.com/skyasu2/openmanager-ai/commit/db9abb156c6a5bd38d6a533bd1d402f33842e750))
* **ai:** increase session token prefix length and collapse web sources by default ([25ee256](https://github.com/skyasu2/openmanager-ai/commit/25ee256c7a9b0ffe5d47f66b4ba8d19d3cfadd52))
* **ai:** preserve server context on compression and remove duplicate name field ([c2adac2](https://github.com/skyasu2/openmanager-ai/commit/c2adac2731f31b441316a56f1a9d69ec54f56d61))
* **ai:** prevent duplicate user messages on cold start retry ([b5c4a97](https://github.com/skyasu2/openmanager-ai/commit/b5c4a9763f5c0ab7786ed1405b6c10656bef98c8))
* **ai:** prevent re-clarification loop on clarified queries ([f48cc94](https://github.com/skyasu2/openmanager-ai/commit/f48cc943bc138e073d1fc0f8ba04173b32a3a07d))
* **ai:** prevent re-clarification on Cold Start auto-retry ([71cfc3d](https://github.com/skyasu2/openmanager-ai/commit/71cfc3dcfde7d3c2ff57901d2feacf59926c52d1))
* **ai:** reduce client async query timeout from 120s to 15s ([16fc11b](https://github.com/skyasu2/openmanager-ai/commit/16fc11b56b9047fa4189527800343149000d2174))
* **ai:** unify onFeedback type chain to Promise<boolean> across all components ([5ff936f](https://github.com/skyasu2/openmanager-ai/commit/5ff936f54e40958784a89bc41a76d09a02430a29))
* **ai:** use Resolvable function for webSearchEnabled in transport body ([0f8df50](https://github.com/skyasu2/openmanager-ai/commit/0f8df5089f6c442ee6515bad8f469da4fb417243))
* avoid SWC _ref compilation bug in SystemContextPanel ([f192ed6](https://github.com/skyasu2/openmanager-ai/commit/f192ed602bb95803c9291ad4e4feefcdf986815c))
* block medium-risk prompt injection and add system prompt leak detection ([9af05f7](https://github.com/skyasu2/openmanager-ai/commit/9af05f7f56750c5f8ebde9524379feba2682ac1e))
* guard crypto.randomUUID for SSR (React [#419](https://github.com/skyasu2/openmanager-ai/issues/419)) ([7a09dfa](https://github.com/skyasu2/openmanager-ai/commit/7a09dfada85ad4c340cc30c723971962c1a7148e))
* migrate AutoResizeTextarea to React 19 ref-as-prop pattern ([84a0a71](https://github.com/skyasu2/openmanager-ai/commit/84a0a711b13b0937667dd54e211a72dd93c92141))
* replace unsafe ref cast with proper ref synchronization in AutoResizeTextarea ([eb86938](https://github.com/skyasu2/openmanager-ai/commit/eb869385a2dc36a4206e3078133ec38eebfd719b))
* **security:** reduce prompt guard false positives and bind userId to sessionId ([f59419e](https://github.com/skyasu2/openmanager-ai/commit/f59419e17fd93fbe06d77378f5ac8e874d96c07f))
* **tavily:** add monthly quota tracking, unify timeout, improve cache key ([a4af5ca](https://github.com/skyasu2/openmanager-ai/commit/a4af5caec7bc8b8028858982136ef03771533090))
* **test:** adjust coverage thresholds to realistic levels (10%) ([0629efb](https://github.com/skyasu2/openmanager-ai/commit/0629efb9bb0b5c9c31aab9aa55694778b2125d93))
* **test:** resolve test failures in AIWorkspace, ReactFlowDiagram, retry, and vercel-optimization ([7aa5469](https://github.com/skyasu2/openmanager-ai/commit/7aa5469b0a7ac3c70a3d23c806811d577571ddd0))
* **warmup:** unify CloudRunStatusIndicator to use triggerAIWarmup with cooldown ([62c7648](https://github.com/skyasu2/openmanager-ai/commit/62c76489f02bae50393462d0f32ed4788f4cb5ff))

### [7.1.1](https://github.com/skyasu2/openmanager-ai/compare/v7.1.0...v7.1.1) (2026-02-01)


### ⚠ BREAKING CHANGES

* **code-review:** Remove Codex/Gemini rotation, use Claude Code exclusively

- Update ai-review-core.sh: Remove Codex/Gemini functions, keep only Claude
- Update ai-review-utils.sh: Simplify AI selection (always claude)
- Update auto-ai-review.sh: Bump to v10.0.0
- Update commit-commands skill: Claude Code review documentation
- Update ai-tools.md: Remove Codex/Gemini CLI tools

Benefits:
- No external AI dependencies
- Consistent review quality
- Simpler maintenance

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>

### Features

* **ai-chat:** add mixed paste support for image+text clipboard content ([0120f9c](https://github.com/skyasu2/openmanager-ai/commit/0120f9c52a3b7f76553fc5f9d31cc9dbdebb8ff8))
* **ai-engine:** add dailyTrend to getServerMetrics and expand Korean internal keywords ([5acc370](https://github.com/skyasu2/openmanager-ai/commit/5acc370798745778e7d62db1c6bfa9d673fd1ab4))
* **ai-engine:** add ragSources to API response and web citation fallback ([859d556](https://github.com/skyasu2/openmanager-ai/commit/859d5564eab9d1af7fa2bc09f8cd3a1483b025df))
* **ai-engine:** add Vision Agent with AgentFactory pattern ([2696897](https://github.com/skyasu2/openmanager-ai/commit/2696897e2f8ccaab67d500ae7e0a843dea9159df))
* **ai-engine:** add Vision Agent with Gemini Flash-Lite ([1ba6fcf](https://github.com/skyasu2/openmanager-ai/commit/1ba6fcf51d7d370bdde449916893a127e52fd5f8))
* **ai-engine:** enrich RAG context with thresholds, server roles, and 24h trend summaries ([6a678df](https://github.com/skyasu2/openmanager-ai/commit/6a678dfdc62fd82be11c8cc180bd19e408144898))
* **ai-engine:** expand RAG usage to Analyst and NLQ agents ([a1ba863](https://github.com/skyasu2/openmanager-ai/commit/a1ba8632e85c7892742f9484a55248117f80b25e))
* **ai-engine:** integrate 24h trend into LLM context and add KB seed docs ([25c51e2](https://github.com/skyasu2/openmanager-ai/commit/25c51e2ab38b951ea0bc0342fe57f05cdf6f0972))
* **ai-sidebar:** add web search toggle with Globe icon ([a25e407](https://github.com/skyasu2/openmanager-ai/commit/a25e4079774b15443f2063b3481cd0a3e56a2e6f))
* **ai:** add multimodal support with Vision Agent and file attachments ([57294b5](https://github.com/skyasu2/openmanager-ai/commit/57294b591aa47d3cd5d41043566b4357ca76b51f))
* **ai:** display RAG source metadata in analysis basis panel ([34e8dcb](https://github.com/skyasu2/openmanager-ai/commit/34e8dcb1d206f4741a4ac71eeed59ceeeffffb3a))
* **code-review:** add REVIEW_MODE option for Claude Code review ([d625347](https://github.com/skyasu2/openmanager-ai/commit/d625347100ee6ae9bdab949272290beae80b4d1f))
* **landing:** rebrand Hero to OpenManager AI and add rationale to feature cards ([e57e293](https://github.com/skyasu2/openmanager-ai/commit/e57e29315a0f3bd66b1f82411c07ce33d53039e5))
* **observability:** add quantitative evaluation scores and human feedback loop to Langfuse ([54f85ab](https://github.com/skyasu2/openmanager-ai/commit/54f85ab542eb474007878da2f0ffcdb06e6b44dd))
* **security:** add comprehensive secret detection to pre-commit ([7e8ac08](https://github.com/skyasu2/openmanager-ai/commit/7e8ac0828b5e46023c30fce878e5b95912c0d947))
* **security:** add prompt injection guard to Cloud Run AI Engine ([d72c783](https://github.com/skyasu2/openmanager-ai/commit/d72c783db8b95776b4b75a8d89cdd17a38ce8e60))
* **skills:** add observability-check skill for Langfuse/Sentry monitoring ([563bfdb](https://github.com/skyasu2/openmanager-ai/commit/563bfdb0d3f39ec7778c42c7c6373862bcf9c2ef))


### Bug Fixes

* **ai-chat:** preserve file attachments on retry ([4eca5da](https://github.com/skyasu2/openmanager-ai/commit/4eca5dad2931dde9d00195bb3bfed6ea02a876be))
* **ai-engine:** add images/files schema support for multimodal file attachments ([ed86b03](https://github.com/skyasu2/openmanager-ai/commit/ed86b03314b49409b437c50aac7f739d24937bcb))
* **ai-engine:** add ragSources to SupervisorResponse type ([4c1c9e8](https://github.com/skyasu2/openmanager-ai/commit/4c1c9e894498c112877116cb6cd37446a1e7470b))
* **ai-engine:** address Codex review feedback for BaseAgent ([6d68187](https://github.com/skyasu2/openmanager-ai/commit/6d6818720532f1b5c1ff413971c4cbd6c472f294))
* **ai-engine:** address follow-up Codex review edge cases ([fd7e96f](https://github.com/skyasu2/openmanager-ai/commit/fd7e96fac291c8868ef9cf55b7fa7c5e9bc130c5))
* **ai-engine:** align Tavily timeout/retry settings across RAG paths ([9b7f956](https://github.com/skyasu2/openmanager-ai/commit/9b7f956559404f77a32be4ad9af7862730ac88e8))
* **ai-engine:** apply enableWebSearch filter in single-agent path ([985dbf8](https://github.com/skyasu2/openmanager-ai/commit/985dbf8bc62cef41c0f6cae8c51ffc6b9bb3ddf5))
* **ai-engine:** apply same type guard to run() for consistency ([6d3894f](https://github.com/skyasu2/openmanager-ai/commit/6d3894f2e3cd6536befa4fb3db93235fbf8e10fe))
* **ai-engine:** default fastMode to true for searchKnowledgeBase ([db71db1](https://github.com/skyasu2/openmanager-ai/commit/db71db1d344cdd02dc68a8601c8ad58cd3c312b5))
* **ai-engine:** enforce mandatory tool usage in Advisor and Analyst instructions ([30f270c](https://github.com/skyasu2/openmanager-ai/commit/30f270c1c556b40576d3b4ba74df8a83eaaeb95b))
* **ai-engine:** extract ragSources in forced routing path ([9a73740](https://github.com/skyasu2/openmanager-ai/commit/9a737405a079a7172397307e439a7306b456c0f9))
* **ai-engine:** improve Tavily web search response quality ([c8d4066](https://github.com/skyasu2/openmanager-ai/commit/c8d40662e3e3eafd87705d10565e0a8e0b43ab3e))
* **ai-engine:** pass enableWebSearch from route to orchestrator ([401a9c0](https://github.com/skyasu2/openmanager-ai/commit/401a9c0e24faa5d5b323fc2c500a2d3e4b481c16))
* **ai-engine:** prevent RAG similarCases from being overwritten in optimizeReport ([a7432bb](https://github.com/skyasu2/openmanager-ai/commit/a7432bb631357ac87321e5392fc8ddce3c717bc1))
* **ai-engine:** propagate enableWebSearch through supervisor to multi-agent ([9db3a11](https://github.com/skyasu2/openmanager-ai/commit/9db3a111c554e3eb7fbde0561693417c81194a21))
* **ai-engine:** raise Tavily web search threshold from 0.4 to 0.6 ([634b28c](https://github.com/skyasu2/openmanager-ai/commit/634b28cf19d900aea9dab175b6b155735475b5cb))
* **ai-engine:** regenerate package-lock.json for @ai-sdk/google ([fc5cb1a](https://github.com/skyasu2/openmanager-ai/commit/fc5cb1abde554b4032904b02bbe8db930a5900d2))
* **ai-engine:** remove manual RAG call from Reporter and add stepMs timeout ([369001a](https://github.com/skyasu2/openmanager-ai/commit/369001af7b248489ff38fba93488ee4ed93c364c))
* **ai-engine:** use 'output' instead of 'result' for AI SDK v6 toolResult extraction ([cf36969](https://github.com/skyasu2/openmanager-ai/commit/cf369697ea42618e0a3f83983c504c60d9e13706))
* **ai-sidebar:** add cursor-pointer to web search and file attach buttons ([e4a0fcd](https://github.com/skyasu2/openmanager-ai/commit/e4a0fcd323e2769ad23b8b95c259f63d3d00c023))
* **ai-sidebar:** async feedback handling and message metadata cleanup ([46ee7e9](https://github.com/skyasu2/openmanager-ai/commit/46ee7e90ffad39280ac78b2b625bff075dedc87d))
* **ai:** resolve multimodal file attachment critical bugs ([971b022](https://github.com/skyasu2/openmanager-ai/commit/971b022ae798edee56bb38eaf860b9d74f1a8144))
* **ai:** resolve P0 multimodal side effects ([6ce1562](https://github.com/skyasu2/openmanager-ai/commit/6ce1562543669ef4a43c5abe86c0b1a704ab43e1))
* **ai:** resolve RAG timeout causing fallback cache and circuit breaker lockout ([1061e11](https://github.com/skyasu2/openmanager-ai/commit/1061e11535db4cfe989772d86ad9824d645fc417))
* **ai:** skip clarification when server product name or percentage is present ([95de479](https://github.com/skyasu2/openmanager-ai/commit/95de479e4890756da578ceb33c9a29b45a63546d))
* **ai:** update clarification comments and add product names to METRIC_PATTERNS ([ab85e48](https://github.com/skyasu2/openmanager-ai/commit/ab85e48ee9a0ec7061cadd017f92b279eb8dbf94))
* **chat:** clear previous session chat history on system boot ([a4c8dc2](https://github.com/skyasu2/openmanager-ai/commit/a4c8dc27738471a4541f2c644efe47eee7851540))
* **cloud-run:** add multimodal support to single-agent streaming ([12947d3](https://github.com/skyasu2/openmanager-ai/commit/12947d3bc61a2b64281e0a9aea157781bc50822d))
* **cloud-run:** route image requests to Vision Agent (Gemini) ([c7d362c](https://github.com/skyasu2/openmanager-ai/commit/c7d362c3b7c4825e256e2d6fd3a3f2ebae38d2ae))
* **cloud-run:** unify Vision Agent model ID to gemini-2.5-flash ([afb693e](https://github.com/skyasu2/openmanager-ai/commit/afb693e309f1a24bbb90e3eee502893b96976450))
* **cloud-run:** use gemini-2.5-flash for Vision Agent ([6e2b312](https://github.com/skyasu2/openmanager-ai/commit/6e2b312d6876a88b2d90c0ad8314be7b55677789))
* **config:** sync AI_ENGINE_VERSIONS.master to v7.1.0 ([651db4b](https://github.com/skyasu2/openmanager-ai/commit/651db4b122e5621635f90c3a03ec69a96df97c2f))
* **deps:** pin ai@6.0.39, remove zod from optimizePackageImports, patch lodash ([ba5b595](https://github.com/skyasu2/openmanager-ai/commit/ba5b5957927a9c58ea39459272e373dac40398be))
* **deps:** rollback ai@6.0.57 → 6.0.39 to fix Zod bundling crash ([f3e8515](https://github.com/skyasu2/openmanager-ai/commit/f3e8515cde3f00659e15d90152a42cce7b80b9dc))
* **e2e:** fix ai-streaming-handoff tests for production selectors ([055d7f4](https://github.com/skyasu2/openmanager-ai/commit/055d7f41bdbecb5e02d00615691e0b6621c44fb1))
* **hooks:** resolve race condition in useHealthCheck and stale closure in useChatActions ([f336da1](https://github.com/skyasu2/openmanager-ai/commit/f336da199e13a7cee6704f00b89a9706920740fa))
* **langfuse:** persist eventCount to Redis for free tier protection across restarts ([610c640](https://github.com/skyasu2/openmanager-ai/commit/610c6407b0f054bf939624ab011aeaccdd2554fd))
* **login:** remove isClient hydration guard to fix E2E 48 failures ([c6be63e](https://github.com/skyasu2/openmanager-ai/commit/c6be63e636f043c4be8ba10493ade6af4ae9037f))
* **schema:** export filePartSchema and add trim validation ([417c9b1](https://github.com/skyasu2/openmanager-ai/commit/417c9b109dfdb35061fe78a5a1a52abbf479616c))
* **security:** block medium risk prompt injection attempts ([f64ffba](https://github.com/skyasu2/openmanager-ai/commit/f64ffba22288c080d12a023c12a03e4d25d71366))
* **security:** harden AI engine CORS, debug auth, and logging hygiene ([e15d7ac](https://github.com/skyasu2/openmanager-ai/commit/e15d7ac210f0a41f3f53840feaf8fbd7cdfd1e80))
* **security:** harden feedback route input validation and error handling ([baa5b8e](https://github.com/skyasu2/openmanager-ai/commit/baa5b8e145bf001336812f28cd41dca836252da6))
* **settings:** remove outputStyle/FORCE_COLOR blocking prompt suggestions ([48f31c2](https://github.com/skyasu2/openmanager-ai/commit/48f31c2f64c4af316b05b55e99ffcdcc49ab8591))
* **skills:** add executable permissions to scripts ([7e12247](https://github.com/skyasu2/openmanager-ai/commit/7e12247e4a6a6f509bd5895bbfb44c94c0347b13))
* **skills:** use modular scripts in commit-commands workflow ([ba7674c](https://github.com/skyasu2/openmanager-ai/commit/ba7674ccb7b82e925fa076f795ff95257d55a83b))
* **ui:** move header center content breakpoint from md to lg ([d612d27](https://github.com/skyasu2/openmanager-ai/commit/d612d277fac09d06e26940106a76e98543a9fab8))
* **ui:** prevent mobile header overlap between logo and AI button ([fa4f101](https://github.com/skyasu2/openmanager-ai/commit/fa4f1018027dae9cf0d41b7133578f31cc136342))
* **vercel:** apply Free Tier maxDuration limits inline ([38f7f6b](https://github.com/skyasu2/openmanager-ai/commit/38f7f6be6de124cfd1d73328bf8166b7a626ea0e))
* **warmup:** correct cooldown comment (60s → 5min) ([29fb5fa](https://github.com/skyasu2/openmanager-ai/commit/29fb5fa73974b2e49ac4c1f18bd0943c9f186291))
* **zod:** isolate Zod v4 to server-only, prevent client bundle crash ([d6985e5](https://github.com/skyasu2/openmanager-ai/commit/d6985e530c8b2dcc69559b103d31279066172034))


* **code-review:** switch to Claude Code-only review system ([85c4712](https://github.com/skyasu2/openmanager-ai/commit/85c4712c3c2c4fafb4124df4545edaf44596ebcf))

## [7.1.0](https://github.com/skyasu2/openmanager-ai/compare/v7.0.2...v7.1.0) (2026-01-26)


### Features

* **ci:** add Dependabot auto-merge for patch updates ([22ff3b3](https://github.com/skyasu2/openmanager-ai/commit/22ff3b35f921cef9394dacc2c15fe8ab1f97c536))


### Bug Fixes

* **ai-engine:** add graceful stream abort on timeout (P0) ([d036d95](https://github.com/skyasu2/openmanager-ai/commit/d036d95b90dd298271377011dd6750648c19a534))
* **ai-engine:** use AbortController for proper stream cancellation ([f3665af](https://github.com/skyasu2/openmanager-ai/commit/f3665af7ed8a84fc8d345ba8398bc62576df4c47))
* apply AI code review critical fixes ([e4f8939](https://github.com/skyasu2/openmanager-ai/commit/e4f8939cde0efc5c8715e3033c526478accac7c8))

### [7.0.2](https://github.com/skyasu2/openmanager-ai/compare/v7.0.1...v7.0.2) (2026-01-26)


### ⚠ BREAKING CHANGES

* **jobs:** Supabase ai_jobs table no longer used

Architecture changes:
- Remove Supabase dependency for Job Queue
- Redis as single source of truth (SSOT)
- Delete /api/ai/jobs/:id/progress endpoint (unused)
- Add migration script for ai_jobs table cleanup

Redis key structure:
- job:{jobId} → Job data (24h TTL)
- job:progress:{jobId} → Progress info (10min TTL)
- job:list:{sessionId} → Job ID list (1h TTL)

Benefits:
- Simplified architecture (single data store)
- No synchronization issues between Supabase/Redis
- Faster response times (~5ms vs ~50ms)

Files changed:
- src/app/api/ai/jobs/route.ts (Redis create/list)
- src/app/api/ai/jobs/[id]/route.ts (Redis get/delete)
- src/app/api/ai/jobs/[id]/progress/route.ts (deleted)
- sql/migrations/006_drop_ai_jobs_table.sql (cleanup)
- docs/status.md (architecture update)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>

### Bug Fixes

* **version:** sync hardcoded version to 7.0.1 ([571748b](https://github.com/skyasu2/openmanager-ai/commit/571748bd94f36f4723acec74efe2ad6bee308ce1))


* **jobs:** migrate Job Queue from Supabase to Redis Only ([05700cf](https://github.com/skyasu2/openmanager-ai/commit/05700cfd463a75b370748804599d175a81ee0a8d))

### [7.0.1](https://github.com/skyasu2/openmanager-ai/compare/v7.0.0...v7.0.1) (2026-01-26)


### Features

* **ai-engine:** implement advanced RAG pipeline improvements ([a1f3914](https://github.com/skyasu2/openmanager-ai/commit/a1f39140d71d847801b01eb5360733e0433c1422))
* **ai-engine:** implement multi-agent context sharing and timeout centralization ([0473889](https://github.com/skyasu2/openmanager-ai/commit/047388966e6516ce0a408072c231a7f498815baa))
* **circuit-breaker:** add Redis distributed state store ([a6ef871](https://github.com/skyasu2/openmanager-ai/commit/a6ef871f10e83413bd7f1c6effa6a78a92011bdd))
* **devops:** add Vercel environment variable sync automation ([d4ca813](https://github.com/skyasu2/openmanager-ai/commit/d4ca813d9841ce643e0dd0ef085640f90171e33e))


### Bug Fixes

* **ai-chat:** add message sanitization before AI SDK sendMessage ([4a8ea63](https://github.com/skyasu2/openmanager-ai/commit/4a8ea630d084112d9cf30369fcca6bb35a56e85b))
* **ai-chat:** add null check for message parts in useChat hook ([a377606](https://github.com/skyasu2/openmanager-ai/commit/a377606ac4c83b48266f56b1b6c0b79cc4bce243))
* **ai-chat:** add null checks for message parts in useAIChatCore and useHybridAIQuery ([66c240f](https://github.com/skyasu2/openmanager-ai/commit/66c240fd50f0d85314df8ce6755ed7c007a4d6de))
* **ai-chat:** add null checks in message-normalizer.ts ([27ea203](https://github.com/skyasu2/openmanager-ai/commit/27ea20383c32e25806034548ed18a4efe76fea0b))
* **ai-chat:** add useEffect to proactively sanitize messages ([b88d043](https://github.com/skyasu2/openmanager-ai/commit/b88d043080747581e65ba932456b4b1a8ba76009))
* **ai-chat:** correct sendMessage format for AI SDK v6 ([da012ac](https://github.com/skyasu2/openmanager-ai/commit/da012ac18a4c62a5d495ba4c266ead6bb2887118))
* **ai-chat:** disable resume option to fix clarification flow error ([4ee6ffd](https://github.com/skyasu2/openmanager-ai/commit/4ee6ffdccae2fd992f4e5433d973c3faf0dff40e))
* **ai-chat:** filter out empty content messages from localStorage ([7b47fa9](https://github.com/skyasu2/openmanager-ai/commit/7b47fa989732def4d160172151e5a84edba9c085))
* **ai-chat:** pre-sanitize messages before sendMessage to prevent AI SDK internal error ([1984b74](https://github.com/skyasu2/openmanager-ai/commit/1984b74658ca071209f1b51cd03014be71309c42))
* **ai-chat:** use flushSync for message sanitization before sendMessage ([5a909ed](https://github.com/skyasu2/openmanager-ai/commit/5a909ed81136c215d8ece2aa1305b6cc565a70cd))
* **ai-chat:** use SanitizingChatTransport for message serialization ([9a6beda](https://github.com/skyasu2/openmanager-ai/commit/9a6bedabaaede8fd84adbbf994bb9ba29d2f6bc0))
* **ai-chat:** use setTimeout(0) to ensure state sync before sendMessage ([34b2022](https://github.com/skyasu2/openmanager-ai/commit/34b202271bd67315157f3cabbf88c676b951fe44))
* **ai-engine:** add UIMessageStream protocol compliance ([0aed63b](https://github.com/skyasu2/openmanager-ai/commit/0aed63bce9eef0330bf2c5c04edeaecfd681dcd3))
* **ai-sdk:** apply CODEX R3 review improvements ([c0efe02](https://github.com/skyasu2/openmanager-ai/commit/c0efe0261454a57fc8aa3ff9a78770bdc55b7cd2))
* **ai-stream:** add required x-vercel-ai-ui-message-stream header for AI SDK v6 ([aa50517](https://github.com/skyasu2/openmanager-ai/commit/aa5051767ad00a1780d91f8de8301dc30d23d28b))
* **ai:** apply AI SDK best practice for stream resume URL ([62d43fb](https://github.com/skyasu2/openmanager-ai/commit/62d43fb60a058fe6c388ed242b06f5c8d145e87c))
* **ai:** apply CODEX code review findings ([3a53a2f](https://github.com/skyasu2/openmanager-ai/commit/3a53a2ff058b98860d40db31ac729ec5e02566b8))
* **ai:** P0-P1 round 2 fixes - listener tracking, abort signal, logging ([0b922d7](https://github.com/skyasu2/openmanager-ai/commit/0b922d7c6156985a49f9e2e48b9542a1fda304a8))
* **ai:** P0-P2 code quality improvements from comprehensive analysis ([6902c41](https://github.com/skyasu2/openmanager-ai/commit/6902c41599e0b9504dfe0c91c086cb1057e6ad9e))
* **hooks:** address AI code review findings ([b27d879](https://github.com/skyasu2/openmanager-ai/commit/b27d879193743adfc5bf01ec96abb4eeea5a8737))
* **hooks:** resolve type mismatch in useChatHistory with BaseMessage ([b44249c](https://github.com/skyasu2/openmanager-ai/commit/b44249c8ff191ac26af8c9c3994b506e188efd3e))
* **incident-report:** correct system summary data in failure reports ([f3ca177](https://github.com/skyasu2/openmanager-ai/commit/f3ca1774da326fcd544c544d617f50deccbd2ba5))
* **orchestrator:** align extractAnomalies/extractMetrics with context-store types ([c3d46d6](https://github.com/skyasu2/openmanager-ai/commit/c3d46d6b4854ca243ad7af492dc10b8c148bfd68))
* **stream-v2:** correct Cloud Run URL environment variable name ([4de92a5](https://github.com/skyasu2/openmanager-ai/commit/4de92a505b65268d934014ea89b44869e4badd8d))
* **supervisor:** add recordModelUsage to multi-agent mode ([7e40414](https://github.com/skyasu2/openmanager-ai/commit/7e40414781812e45e4e83ef21ddcafdf5dc28313))

## [7.0.0](https://github.com/skyasu2/openmanager-ai/compare/v6.1.0...v7.0.0) (2026-01-24)


### ⚠ BREAKING CHANGES

* **supervisor:** v1 stream endpoint removed

- Delete /api/ai/supervisor/stream (v1) - 508 lines removed
- Switch default to v2 with UIMessageStream + Resumable
- Remove useNativeProtocol option (always v2 now)
- Remove TextStreamChatTransport import
- Simplify useHybridAIQuery hook (always use resume: true)
- Update MSW mock to v2 endpoint

v2 benefits:
- AI SDK v6 native UIMessageStream protocol
- Resumable streams via Redis (survives refreshes)
- Built-in useChat + resume support
- Structured data events (handoffs, tool calls)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>

### Features

* **ai-sdk:** add UIMessageStream native protocol support (v2) ([d85025a](https://github.com/skyasu2/openmanager-ai/commit/d85025a3ecd1812d26b97b3ecf728aa8eceb07d6))
* **stream-v2:** add resumable stream support with AI SDK v6 best practices ([da38977](https://github.com/skyasu2/openmanager-ai/commit/da389778493f4f6443c05f6886f14fd6bcb895f1))
* **stream-v2:** implement Upstash-compatible resumable stream ([96a24a3](https://github.com/skyasu2/openmanager-ai/commit/96a24a37acb7da163c2fdf1e98529d9b36b9d663))


### Bug Fixes

* **ai-cache:** apply CODEX review - preserve cache HIT observability ([18f243d](https://github.com/skyasu2/openmanager-ai/commit/18f243d1f6ddab0d5338c516dc4ae0625ef90753))
* **ai-engine:** address code review findings ([0af200f](https://github.com/skyasu2/openmanager-ai/commit/0af200f652b28cd40333c0367ded61dac4007fc7))
* **ai-hooks:** P0-P1 memory leak and error handling improvements ([64a4573](https://github.com/skyasu2/openmanager-ai/commit/64a45731130b9ac1ccb438b45690a6d1f866b23a))
* **ai:** P1/P2 code quality improvements from analysis ([8890fd0](https://github.com/skyasu2/openmanager-ai/commit/8890fd0dd98e9b1be53cf81797ca3af0febbb35c))
* **critical:** P0+P1 AI code quality improvements ([66d15e0](https://github.com/skyasu2/openmanager-ai/commit/66d15e036277f299555e84a1ae346e8ba16dcf5d))
* **orchestrator:** extract finalAnswer result to prevent empty responses ([055d321](https://github.com/skyasu2/openmanager-ai/commit/055d321ba82a7c48b2a29cdc30367c194c95a05a))
* **stream-v2:** apply CODEX security review fixes ([59e11c6](https://github.com/skyasu2/openmanager-ai/commit/59e11c6504f1166e488b0d9f8535288acb690f01))
* **stream-v2:** remove resumable-stream dependency (redis incompatible) ([4bdfad0](https://github.com/skyasu2/openmanager-ai/commit/4bdfad0b3c208232eb273e5f1015715c526c80d7))
* **supervisor:** apply AI SDK v6 best practices from CODEX review ([101a65c](https://github.com/skyasu2/openmanager-ai/commit/101a65cfa038a68470e56304eb5de1d12de19711))
* **supervisor:** apply CODEX review improvements for AI SDK v6 compliance ([17beb28](https://github.com/skyasu2/openmanager-ai/commit/17beb28d434edf52de349a00f3dacf35432c6a79))


* **supervisor:** remove deprecated v1 stream endpoint ([633aec3](https://github.com/skyasu2/openmanager-ai/commit/633aec3fe2b489ef8448aa90428c4404f08b9925))

## [6.1.0](https://github.com/skyasu2/openmanager-ai/compare/v6.0.1...v6.1.0) (2026-01-24)


### Features

* **ai-engine:** migrate to AI SDK v6 native pattern ([21cbe4b](https://github.com/skyasu2/openmanager-ai/commit/21cbe4bf752356b0666ec194529aa678bf21b303))


### Bug Fixes

* **test:** restore global fetch stub after each test ([0a5eeba](https://github.com/skyasu2/openmanager-ai/commit/0a5eeba6d32b9c9fdc1b09ce181061ef0fd87a5d))

### [6.0.1](https://github.com/skyasu2/openmanager-ai/compare/v6.0.0...v6.0.1) (2026-01-23)


### Bug Fixes

* address AI code review findings ([4db29d3](https://github.com/skyasu2/openmanager-ai/commit/4db29d37e58e3497fef933ca8b09e08561c851cd))
* **e2e:** add data-testid attributes and handle clarification dialog ([bf8d100](https://github.com/skyasu2/openmanager-ai/commit/bf8d100a7c6e3cb0727f88302a84bdde3a8735b6))
* **e2e:** add data-testid to AIWorkspace MessageComponent ([1faa6a5](https://github.com/skyasu2/openmanager-ai/commit/1faa6a59fcdc687a4cbec50954f173e2e663ca1e))
* **e2e:** improve AI test selectors and status code handling ([7098323](https://github.com/skyasu2/openmanager-ai/commit/7098323c217ae2ffee8a75f1879cb3b4820228fa))
* **e2e:** improve test selectors for cross-version compatibility ([c6d67e5](https://github.com/skyasu2/openmanager-ai/commit/c6d67e5bde925cd32bb3393f94590eeac1f6581a))
* remove platform-specific lightningcss dependency ([62e87cd](https://github.com/skyasu2/openmanager-ai/commit/62e87cdef504c683317bf16c7ecf78f1d4dbcb61))
* **ux:** extend system start countdown to 5s for Cloud Run cold start ([0d5c6be](https://github.com/skyasu2/openmanager-ai/commit/0d5c6be075dab3222891b1d2c941206a75b0bd1f))

## [6.0.0](https://github.com/skyasu2/openmanager-ai/compare/v5.88.2...v6.0.0) (2026-01-23)


### ⚠ BREAKING CHANGES

* **sentry:** Removed deprecated Sentry config files

- Consolidate server/edge Sentry init into instrumentation.ts
- Create instrumentation-client.ts for client-side Sentry
- Add onRouterTransitionStart for navigation tracking
- Add onRequestError for server-side error capturing
- Delete deprecated sentry.*.config.ts files
- Delete src/instrumentation.ts (merged to root)
- Add migration plan document for reference

Fixes local dev 500 error caused by Sentry SSR initialization

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>

### Features

* **agents:** add conditional web search policy (min 1, max 3) ([8f73b9a](https://github.com/skyasu2/openmanager-ai/commit/8f73b9a925a54f0484b13c9f92461acdbc051f80))
* **ai-engine:** add getServerByGroup tool for NLQ type queries ([580bb53](https://github.com/skyasu2/openmanager-ai/commit/580bb539277ebfd6c9b24a2ef02c9831de570f6c))
* **ai-engine:** add getServerByGroupAdvanced tool and expand typeMap ([e129474](https://github.com/skyasu2/openmanager-ai/commit/e1294745c982802ff5d4697a0120c32904410920))
* **ai-engine:** add Sentry error monitoring ([2e8bcb5](https://github.com/skyasu2/openmanager-ai/commit/2e8bcb524dbe37f0d8e7a2e95ebf83cde00c8f15))
* **ai:** add Resumable Streams and Timeout Monitoring ([b61cff8](https://github.com/skyasu2/openmanager-ai/commit/b61cff833ac858f0dc98705194cccc11db2b113a))
* **ai:** improve response quality within free tier ([cf5a1a4](https://github.com/skyasu2/openmanager-ai/commit/cf5a1a4770afa46974ff3c35cd733e833b18fef9))
* **cold-start:** implement 3-layer AI engine warm-up strategy ([d523ad3](https://github.com/skyasu2/openmanager-ai/commit/d523ad397c580481dbd6c651caee0c0db41606bd))
* **debug:** add Sentry test endpoint for integration verification ([78cca01](https://github.com/skyasu2/openmanager-ai/commit/78cca013768f8102b886918496d2fcce8beab70d))
* **diagram:** add Radix Tooltip and improve UX for architecture diagrams ([ce65405](https://github.com/skyasu2/openmanager-ai/commit/ce65405e2716006aa2f97bbb4930e250f15c4689))
* **ui:** add Cold Start error banner with auto-retry countdown ([1d25f79](https://github.com/skyasu2/openmanager-ai/commit/1d25f796cafd8b5628ceac32f5a8740221a3f8bf))


### Bug Fixes

* **a11y:** add button type to improve accessibility (P3 batch 1) ([ae5e7ce](https://github.com/skyasu2/openmanager-ai/commit/ae5e7cefd3f9ebd0658f4a8918e69b96cf9e7ae1))
* **a11y:** add button types and SVG accessibility to P1 files ([fd954e6](https://github.com/skyasu2/openmanager-ai/commit/fd954e61e511ea61e7b87efb6a5673a1f1bed125))
* **a11y:** add type="button" to 18 buttons (batch 3) ([b0bcbb8](https://github.com/skyasu2/openmanager-ai/commit/b0bcbb897718709d96a29b02979e7814abb56e5d))
* **a11y:** add type="button" to 29 buttons (batch 2) ([834fac8](https://github.com/skyasu2/openmanager-ai/commit/834fac88dee1c23cd58e9b6d829b058252512666))
* **a11y:** add type="button" to SystemControlPanel (5 buttons) ([2f3d06b](https://github.com/skyasu2/openmanager-ai/commit/2f3d06b3f9c4919ab876b50b5545ad60f76bca3c))
* **a11y:** complete SVG accessibility improvements (P2) ([933c263](https://github.com/skyasu2/openmanager-ai/commit/933c2634d2dec3b541aaaaec2f954a318309e82a))
* **a11y:** improve SVG and button accessibility across components ([082b629](https://github.com/skyasu2/openmanager-ai/commit/082b629e070e432657da86646c2653dab7f1265e))
* **ai-engine:** address AI code review findings ([8e9ca75](https://github.com/skyasu2/openmanager-ai/commit/8e9ca759d1d0ce0fa50c62a63178fb47d7987979))
* **ai-engine:** improve getServerByGroup filtering and add disambiguation options ([620195b](https://github.com/skyasu2/openmanager-ai/commit/620195b494df62f274335f34aa07956cbffc54b7))
* **ai-engine:** properly regenerate package-lock.json with @sentry/node ([2d197d9](https://github.com/skyasu2/openmanager-ai/commit/2d197d93b370de9ee1fedad1ec479f4ac04c1010))
* **ai-engine:** regenerate package-lock.json for npm ci ([d2d93e0](https://github.com/skyasu2/openmanager-ai/commit/d2d93e0315e4acfbf6c1ff9402b59b61eea1b56e))
* **ai-engine:** use dynamic version from package.json instead of hardcoded values ([ec82364](https://github.com/skyasu2/openmanager-ai/commit/ec8236408e76ed023c32df270ede8b9e574bad5a))
* **ai:** add 45s hard timeout and lower Job Queue threshold ([a278fd2](https://github.com/skyasu2/openmanager-ai/commit/a278fd2ab28871f733462fb6bbdc9786353c28c7))
* **ai:** address Codex review feedback for stream error handling ([d916246](https://github.com/skyasu2/openmanager-ai/commit/d9162466dd4129df530c7289f4a2d29d39dca84e))
* **ai:** detect stream errors to trigger ColdStartErrorBanner ([ed41aba](https://github.com/skyasu2/openmanager-ai/commit/ed41aba75865fd6007dad5d5e66e52f7bb6b9373))
* **ai:** lower complexity threshold 25→19 for report queries ([1f490a3](https://github.com/skyasu2/openmanager-ai/commit/1f490a3d90e586dd66becb1a1cd6fb6df807e8da))
* **ai:** lower complexity threshold 30→25 for report queries ([14d381a](https://github.com/skyasu2/openmanager-ai/commit/14d381a7efd50dccc1b5213bf7f2d9e8535591cc))
* **ai:** resolve ColdStartErrorBanner side effects ([341a970](https://github.com/skyasu2/openmanager-ai/commit/341a97047e0e2df75003d42798591de370ebcba1))
* **ai:** root cause fix for Stream timeout errors ([fc3eedf](https://github.com/skyasu2/openmanager-ai/commit/fc3eedff805f64a6b4b1a2fb896f25690b10da5c))
* **api:** remove backwards compatibility layer for server status ([559613b](https://github.com/skyasu2/openmanager-ai/commit/559613b69011c19c5e146f5df10dcae868483dd8))
* **api:** resolve 404 error in server modal metrics by fixing JSON parsing ([34138ed](https://github.com/skyasu2/openmanager-ai/commit/34138ed7bd934c64a56ea91bdfdb1fbe76ea07a9))
* **config:** update stale comment referencing deleted AIErrorHandler ([ed48c0d](https://github.com/skyasu2/openmanager-ai/commit/ed48c0d01302dde2aceb9d84dd3a580577f20a7c))
* **data:** correct 286 status values in hourly-data JSONs ([3429666](https://github.com/skyasu2/openmanager-ai/commit/3429666c8edb4fa84779fc6fd3000210128506ca))
* **data:** correct status values in hourly-data JSONs ([8ec505a](https://github.com/skyasu2/openmanager-ai/commit/8ec505a7ece3e3bb0e92cd607ee99392db67a7b6))
* **diagram:** address AI code review findings ([ad11adf](https://github.com/skyasu2/openmanager-ai/commit/ad11adf9d17c98c4c3b272424563f31b4c18431b))
* **security:** change guestMode default to RESTRICTED & update docs ([1dbb974](https://github.com/skyasu2/openmanager-ai/commit/1dbb9746313b3fa214f6d982f2c0b348aff7f3be))
* **sentry:** add ensureSentryInitialized for serverless env ([a1b5db9](https://github.com/skyasu2/openmanager-ai/commit/a1b5db9d2043d39a2cba3ac7d6cf0ed480a7f097))
* **sentry:** add fallback DSN for Vercel deployment ([b0815fd](https://github.com/skyasu2/openmanager-ai/commit/b0815fdc3a06440c9efae14185e5b8171b1d99bc))
* **sentry:** add manual tunnel API route for Next.js 16 compatibility ([7349a52](https://github.com/skyasu2/openmanager-ai/commit/7349a52a7b1adc700d32d53d13f67a1c90b4fdbf))
* **sentry:** add SDK initialization to instrumentation.ts ([a4393da](https://github.com/skyasu2/openmanager-ai/commit/a4393da93a1beb652d81ba572538634b7433b60f))
* **sentry:** change tunnel route path and add explicit tunnel config ([1d51501](https://github.com/skyasu2/openmanager-ai/commit/1d515015337d78c7f2848fd5eb0472cd6890c20b))
* **sentry:** correct org/project names and add CSP domains ([22de3b0](https://github.com/skyasu2/openmanager-ai/commit/22de3b0e45282db3dedef76f5395fbb7b8a761b6))
* **sentry:** migrate to Next.js 16 instrumentation pattern ([6e46a02](https://github.com/skyasu2/openmanager-ai/commit/6e46a020f139f19901fc98f08fe2b6e91627f2bb))
* **test:** remove useAIEngine tests for deleted hook ([4cb5cfd](https://github.com/skyasu2/openmanager-ai/commit/4cb5cfd95ed65f18787ea4562a3c1dbe9398d6d7))
* **test:** resolve 33 failing tests across 4 test files ([0b4968e](https://github.com/skyasu2/openmanager-ai/commit/0b4968e3c4ac3a094539146bd8d6bc0ad1d9ba64))
* **test:** use vi.spyOn for window.dispatchEvent in auth-store tests ([8936840](https://github.com/skyasu2/openmanager-ai/commit/8936840cd8a4b1b5633eecf8ca066bb600d1b3a6))
* trigger Vercel redeploy to fix chunk cache issue ([1707f3a](https://github.com/skyasu2/openmanager-ai/commit/1707f3ac190bcb82eeb10080a2dd3aac9b878101))
* **ui:** change '시스템 정지' to '시스템 대기' for better UX ([6883325](https://github.com/skyasu2/openmanager-ai/commit/6883325691bee675f6a842899a514f34ce426a07))

### [5.88.2](https://github.com/skyasu2/openmanager-ai/compare/v5.88.1...v5.88.2) (2026-01-19)


### Features

* **data:** add dynamic date calculation for 24h cycling metrics ([167909a](https://github.com/skyasu2/openmanager-ai/commit/167909a468903a1b66967d687fcc83e1ee5bcced))

### [5.88.1](https://github.com/skyasu2/openmanager-ai/compare/v5.88.0...v5.88.1) (2026-01-18)


### Bug Fixes

* **sync:** unify thresholds and timezone between Vercel and Cloud Run ([e66455d](https://github.com/skyasu2/openmanager-ai/commit/e66455dce477016733ada05e096710850e3091d9))

## [5.88.0](https://github.com/skyasu2/openmanager-ai/compare/v5.87.0...v5.88.0) (2026-01-18)


### Features

* **a11y:** add focus trapping and ARIA labels to modal components ([1b0fd53](https://github.com/skyasu2/openmanager-ai/commit/1b0fd53b60741c5c7470f31ac2b54fdb0f3aa5c9))
* add architecture diagrams to landing page feature cards ([a18e325](https://github.com/skyasu2/openmanager-ai/commit/a18e3258c137b1695657dcd36d77e2065e302571))
* **ai:** add real-time agent status streaming and handoff visualization ([13c7735](https://github.com/skyasu2/openmanager-ai/commit/13c77352f56ca115fa95108d38a6e3742f8d508f))
* **auth:** add Google OAuth support alongside GitHub ([62922d0](https://github.com/skyasu2/openmanager-ai/commit/62922d0548892b954d0e36b0c69e7ed4a3c22c52))
* **chart:** add start/end value labels to MiniLineChart ([c143fd6](https://github.com/skyasu2/openmanager-ai/commit/c143fd63a80cb2852b6e69bd338e8fbb166fe08d))
* **code-review:** add verification status for delete-only commits (v7.4.0) ([93d0996](https://github.com/skyasu2/openmanager-ai/commit/93d0996087b5c6a4e6613109b2575f2d14e59ec8))
* **dashboard:** improve chart visualization and card layout ([65840db](https://github.com/skyasu2/openmanager-ai/commit/65840db4673e247ea76cd9cfec618cd1b6eefaed))
* **diagram:** add P2 improvements - error boundary and keyboard a11y ([a3d3781](https://github.com/skyasu2/openmanager-ai/commit/a3d37813c2148db42b2dabb5d97065aec5a816cd))
* **diagram:** add swimlane backgrounds and hover tooltips ([9dd2bea](https://github.com/skyasu2/openmanager-ai/commit/9dd2beab127e1d494376b8f23d8eb3c10f004b14))
* **diagram:** implement dagre.js auto-layout with dynamic sizing for large node layers ([1ba15ea](https://github.com/skyasu2/openmanager-ai/commit/1ba15eae0a293b8a9ffbca349b2738ef949737f3))
* implement React Flow for interactive architecture diagrams ([6501af8](https://github.com/skyasu2/openmanager-ai/commit/6501af8f28a864d1a0836c8198f47cfd270676d5))
* improve architecture diagrams and Google OAuth UI ([9272ff9](https://github.com/skyasu2/openmanager-ai/commit/9272ff9dd7fadce185d234029b658bdcaf10ea83))
* **modal:** conditional sizing - architecture large, detail compact ([9ad12f7](https://github.com/skyasu2/openmanager-ai/commit/9ad12f7602925c86b747745a05ef21e9e3b4bc6f))
* **modal:** implement Split Screen layout for architecture diagrams ([21f112b](https://github.com/skyasu2/openmanager-ai/commit/21f112b29ca8217b71e45b804094ed93e296311f))
* **modal:** responsive architecture modal sizing ([e52ba06](https://github.com/skyasu2/openmanager-ai/commit/e52ba06da6343d5f59922540cb9ecd4b7d56844d))
* **monitoring:** add Sentry error tracking (free tier optimized) ([4ff184d](https://github.com/skyasu2/openmanager-ai/commit/4ff184d7e3256ff58aacd234fee2e0bd491b2f03))
* **privacy:** add minimal privacy policy page for OAuth compliance ([a3d9b39](https://github.com/skyasu2/openmanager-ai/commit/a3d9b398ecebf11bd3f0482f1f06c2561cc25092))
* **ReactFlowDiagram:** add hover feedback and document unused fields ([4f5cfb8](https://github.com/skyasu2/openmanager-ai/commit/4f5cfb8e35b220ad0caf5a4259d04620d0bfa27a))
* **ReactFlowDiagram:** unified sidebar design with gradient fix ([18b9ac8](https://github.com/skyasu2/openmanager-ai/commit/18b9ac842bef9d0772baf728ec96e7b16cc489d5))
* **skill:** add commit-commands skill with AI code review ([9e04dae](https://github.com/skyasu2/openmanager-ai/commit/9e04dae43f9a48c6633d42e6439d1ee07c3e7234))
* **ui:** add error boundaries and improve component stability ([c0a7bb8](https://github.com/skyasu2/openmanager-ai/commit/c0a7bb854a5d1dddd59b93aed8842902d0051002))
* **ui:** add v2 version link button to vibe coding history ([285da1f](https://github.com/skyasu2/openmanager-ai/commit/285da1f58271619da9515588243881a224201a46))
* **ui:** enhance architecture modal and diagram visibility ([a5df0a0](https://github.com/skyasu2/openmanager-ai/commit/a5df0a0e462638a64c158e2699cb7c2c45e4f315))
* **ui:** enhance feature card hover feedback ([e4bc073](https://github.com/skyasu2/openmanager-ai/commit/e4bc0731dc6a2e1d471879f18b8175aac03cc3b4))


### Bug Fixes

* **a11y:** complete HTML nesting fix and add warmup cooldown ([5b90841](https://github.com/skyasu2/openmanager-ai/commit/5b90841143b41ebde6de5924ab639c7ac06c61ae))
* **a11y:** resolve HTML button nesting and add AI warmup ([a2d94d3](https://github.com/skyasu2/openmanager-ai/commit/a2d94d3b6ee6b4efc4059147d41a5bf25df3e450))
* **ai-review:** add false positive prevention rules v7.2.0 ([0b380a8](https://github.com/skyasu2/openmanager-ai/commit/0b380a89d1d4bd305723597ab73a9b2c68ae8d61))
* **ai-review:** refine false positive rules v7.2.1 ([268d6fe](https://github.com/skyasu2/openmanager-ai/commit/268d6fee5af4450f94f94b8ac0a639eb44675a45))
* **ai:** ensure consistent quality scoring in reporter-pipeline ([fefd592](https://github.com/skyasu2/openmanager-ai/commit/fefd592664eeedb0fe2c9058ddb8770e9e0947c4))
* **ai:** side effect fixes and best practice improvements ([5a47a7d](https://github.com/skyasu2/openmanager-ai/commit/5a47a7dbe6233d9685e445a9ce70b33885ec23da))
* **api:** escape SQL LIKE wildcards in incident report search ([4d14b2c](https://github.com/skyasu2/openmanager-ai/commit/4d14b2c05ca299a3a508ca07d693506ca5a97c9e))
* **api:** resolve CentralizedDataManager schema mismatch and realtime check ([38f01c5](https://github.com/skyasu2/openmanager-ai/commit/38f01c59509aaf7ae6e0d8d70734d936dec78770))
* **auth:** eliminate screen flickering on landing page ([6d5ccb0](https://github.com/skyasu2/openmanager-ai/commit/6d5ccb05ce7bb436a5f9d73719c44e0eb809a003))
* **cloud-run:** sync precomputed-states.json with hourly-data SSOT ([7bf09b4](https://github.com/skyasu2/openmanager-ai/commit/7bf09b473f311306fce6963fa9ce55c6d002dee3))
* **code-review:** improve report quality (v7.4.0) ([f2fd939](https://github.com/skyasu2/openmanager-ai/commit/f2fd93932ba7b7ca3c6df1f7727a1dc61a78d351))
* **code-review:** resolve side effects in v7.4.0 (v9.1.0) ([e8b66fb](https://github.com/skyasu2/openmanager-ai/commit/e8b66fbcd0f1a49807586cdc4e3ea6828fd27c19))
* **config:** remove TTY-disabling env vars for prompt suggestions ([e602ee3](https://github.com/skyasu2/openmanager-ai/commit/e602ee38a3762139ac1669ffacdfdaab1a4a2456))
* **dashboard:** resolve system status and network display issues ([e432d4a](https://github.com/skyasu2/openmanager-ai/commit/e432d4a434104281f6c32e25db295d50d7261d76))
* **data:** sync tech stack data with actual project dependencies ([62fdebc](https://github.com/skyasu2/openmanager-ai/commit/62fdebc823a4b9ddc9a6af6dd7595314067cc223))
* **diagram:** add dev warning for invalid edge connections ([075fd23](https://github.com/skyasu2/openmanager-ai/commit/075fd237e4a9e207d3f0c55344a9dd00f514ed28))
* **diagram:** add setTimeout cleanup on unmount ([92d2d4f](https://github.com/skyasu2/openmanager-ai/commit/92d2d4fb31a153fc928a6d2119e7bb759798410c))
* **diagram:** correct layer positioning for Codex/Gemini CLI nodes ([9a07f7c](https://github.com/skyasu2/openmanager-ai/commit/9a07f7c5331de221fd590aed1d6a9de2c24390d9))
* **diagram:** correct swimlane alignment and shadow class ([0c94b98](https://github.com/skyasu2/openmanager-ai/commit/0c94b980f883780454877dfee73dc08092244e72))
* **diagram:** correct swimlane background positioning for fitView ([1193df9](https://github.com/skyasu2/openmanager-ai/commit/1193df9bf77f12cf7828248856faa1fdcd418a95))
* **diagram:** ensure consistent scale when switching to architecture view ([11c3d8a](https://github.com/skyasu2/openmanager-ai/commit/11c3d8a082156454a0d6e3162c1d9d1bd7d56e12))
* **diagram:** ensure useEffect returns value on all paths ([24a8dfb](https://github.com/skyasu2/openmanager-ai/commit/24a8dfbbdc5ccdfd7695da6cbe019258c6a76ccc))
* **diagram:** increase node spacing to prevent overlap ([62addc3](https://github.com/skyasu2/openmanager-ai/commit/62addc318d9663bdd3a53cd774f716a52cea676b))
* **diagram:** increase NODE_GAP from 50 to 70 for better node spacing ([4f43ded](https://github.com/skyasu2/openmanager-ai/commit/4f43ded919224bef573a2f4301df59c0548fefd0))
* **diagram:** optimize ReactFlow for laptop screens ([26f1d28](https://github.com/skyasu2/openmanager-ai/commit/26f1d289f0eed3dfe25f4911760f03803824a562))
* **diagram:** Tailwind v4 consistency and remove unused variable ([61bf4e5](https://github.com/skyasu2/openmanager-ai/commit/61bf4e528a49581dd3ed940fdbaa27483c5fb96a))
* **diagram:** unify swimlane background width across layers ([44009b5](https://github.com/skyasu2/openmanager-ai/commit/44009b585e0812517fa8b091104e456d2e6d0f11))
* **hook:** restore auto AI review in post-commit v3.0.0 ([afef699](https://github.com/skyasu2/openmanager-ai/commit/afef6999886994959fdb8ca4e27875d3789d233c))
* **hydration:** add suppressHydrationWarning for envLabel ([0e0d0b3](https://github.com/skyasu2/openmanager-ai/commit/0e0d0b3d702c2aadba8b1d128f67b885fcb5f4bd)), closes [#418](https://github.com/skyasu2/openmanager-ai/issues/418)
* **images:** add GitHub/Google avatar domains to remotePatterns ([b6da343](https://github.com/skyasu2/openmanager-ai/commit/b6da343d22c83272713882234ef9c1740c76ee05))
* **markdown:** add clipboard copy error handling ([5790247](https://github.com/skyasu2/openmanager-ai/commit/5790247e2fbc4ce314e7d167ebfc44c443a5f821))
* **markdown:** prevent hydration error from invalid HTML nesting ([8301f8b](https://github.com/skyasu2/openmanager-ai/commit/8301f8b3df75c9aa4c4525205e11e007be6e8191)), closes [#418](https://github.com/skyasu2/openmanager-ai/issues/418)
* **metrics:** align chart interval with actual data source (10min) ([126d821](https://github.com/skyasu2/openmanager-ai/commit/126d82148334c672abdeae4461dfd68a32a2c6f8))
* **modal:** resolve architecture diagram cutoff on laptop screens ([c0b62be](https://github.com/skyasu2/openmanager-ai/commit/c0b62be75394509d1e50de1dfc619ea4207ea9c4))
* **modal:** resolve flickering by removing duplicate handlers and conditional rendering ([ed7f095](https://github.com/skyasu2/openmanager-ai/commit/ed7f095acc7ad60946ae65c9417bd0d53e2e707c))
* **ReactFlowDiagram:** prevent text overflow and fix label centering ([632cb73](https://github.com/skyasu2/openmanager-ai/commit/632cb739a74a4ea8311bba46e242316b91d5da6f))
* **review:** implement AI review action workflow v3.0.0 ([6733eda](https://github.com/skyasu2/openmanager-ai/commit/6733eda4b753c26f88791c161e870bd9a9936525))
* **side-effect:** add AbortController to IncidentHistoryPage fetchReports ([e0d6f9f](https://github.com/skyasu2/openmanager-ai/commit/e0d6f9fe0c2339072526adc9bbc9d0aa52c272ab))
* **side-effect:** clear debounce timer in clearFilters to prevent race condition ([68428d7](https://github.com/skyasu2/openmanager-ai/commit/68428d71d2e0ba6dba321ba0571ae4ea46facc90))
* **side-effect:** memoize formatDate and getStatusBadge in IncidentHistoryPage ([13c595d](https://github.com/skyasu2/openmanager-ai/commit/13c595d01e0ac1974650f184cdf5da48aae3f8c2))
* **sync:** unify thresholds and timezone between Vercel and Cloud Run ([bc73d15](https://github.com/skyasu2/openmanager-ai/commit/bc73d15dff53c7923c6a56c554086906885627ce))
* **ui:** remove mount/init delays to prevent page flickering ([8b880d4](https://github.com/skyasu2/openmanager-ai/commit/8b880d47ebac3f672973de88ec7e9b0eb45d32d1))
* update code review paths to reports/ai-review ([7379689](https://github.com/skyasu2/openmanager-ai/commit/737968960aecac12c101a9b2364960d53357b7d3))
* **useSystemStatus:** add services comparison to isStatusEqual ([880d5d0](https://github.com/skyasu2/openmanager-ai/commit/880d5d0f297a54ca6ba9b976bc34ae6eb38f0125))
* **ux:** move performance stats popup to left side to prevent overlap with AI assistant ([99a299f](https://github.com/skyasu2/openmanager-ai/commit/99a299fb529791c9b01a84a9f2d6db55b23974b8))
* **ux:** reduce flickering with unified state updates and skeleton loading ([b8e82f2](https://github.com/skyasu2/openmanager-ai/commit/b8e82f2ba0a4a97e2c28ce7f98ee9bbbb2880538))

## [5.87.0](https://github.com/skyasu2/openmanager-ai/compare/v5.86.1...v5.87.0) (2026-01-12)


### Features

* **ai-sidebar:** add drag-to-resize functionality ([c470e9b](https://github.com/skyasu2/openmanager-ai/commit/c470e9b0a03da8010d0be53e693c80dfc9cd330e))
* **dashboard:** add SessionCountdown timer and optimize health checks ([b468cea](https://github.com/skyasu2/openmanager-ai/commit/b468ceac43ebe244a73d16c80c55d578027a90c0))
* **incident-report:** add history UI, SLA widget, and timeline visualization ([6f723a5](https://github.com/skyasu2/openmanager-ai/commit/6f723a54b6e26ac54d774961511e2d34eefca892))
* **metrics:** add TimeSeriesChart with prediction and anomaly detection ([38f8068](https://github.com/skyasu2/openmanager-ai/commit/38f806876619a50925922e658ce147d18908d302))
* **ui:** add dashboard navigation and improve button UX ([3050773](https://github.com/skyasu2/openmanager-ai/commit/3050773cb6ebe6add24dca7aac5123f76e57b659))


### Bug Fixes

* **a11y:** add aria-label to dashboard navigation button ([6f38476](https://github.com/skyasu2/openmanager-ai/commit/6f384761f7f79918c650d1f2eccacdc3fc502177))
* **ai-engine:** update hardcoded version to 5.86.1 ([cd55d05](https://github.com/skyasu2/openmanager-ai/commit/cd55d05cdd0355a92bdcff082525c474ab10ac4d))
* **lint:** apply optional chain and remove unused error variable ([0cb2a86](https://github.com/skyasu2/openmanager-ai/commit/0cb2a8608b18519030ef5fc257e152dc448b16a1))
* **security:** restore RESTRICTED as default guest mode ([ed03498](https://github.com/skyasu2/openmanager-ai/commit/ed034985a4ceb6d709525fca6ab59a8b4f8b5e6b))
* **test:** improve fetch mock with proper Response-like object ([7fafed4](https://github.com/skyasu2/openmanager-ai/commit/7fafed4ed912535290969485ef478738960fd8f3))
* **types:** restore AIMetadata type used by RAG and auth modules ([13c0e7d](https://github.com/skyasu2/openmanager-ai/commit/13c0e7d96acafa99ee133c3f1e279e1935fc9faf))
* **types:** update AIMetadata.timestamp to allow Date type ([214d2cf](https://github.com/skyasu2/openmanager-ai/commit/214d2cf9db556b929c6a64207c28efa36234c8bb))
* **ui:** improve AI sidebar UX with cleaner layout ([11acec9](https://github.com/skyasu2/openmanager-ai/commit/11acec9cff5f6463f03ab5c3578381cf06c4786b))

### [5.86.1](https://github.com/skyasu2/openmanager-ai/compare/v5.86.0...v5.86.1) (2026-01-11)


### Features

* **ai-engine:** enhance TrendPredictor with threshold breach & recovery predictions ([9c1b7dd](https://github.com/skyasu2/openmanager-ai/commit/9c1b7dddd16cd56ce4ba3c4ae0aae7d7ffb4bf47))
* **auth:** enable AI access for guest mode testing ([ccf4600](https://github.com/skyasu2/openmanager-ai/commit/ccf46002759b89e375796fa39c8f09ce9c0ea0be))


### Bug Fixes

* **ci:** add debug logging for keep-alive workflow ([7927602](https://github.com/skyasu2/openmanager-ai/commit/7927602b9aba2f3633328bece0832ba23c4c6e79))

## [5.86.0](https://github.com/skyasu2/openmanager-ai/compare/v5.85.0...v5.86.0) (2026-01-11)


### Features

* **ai-sidebar:** add new chat button and fix PWA icons ([5a0a819](https://github.com/skyasu2/openmanager-ai/commit/5a0a8197f0f438b8bb6e85e03891e9d819832da3))
* **auth:** require login for AI assistant feature ([d5eece8](https://github.com/skyasu2/openmanager-ai/commit/d5eece8a189cbbc1975416f9938017cac59c9eb5))
* **security:** add XML prompt structure and circuit breaker forceOpen ([aa2cdb5](https://github.com/skyasu2/openmanager-ai/commit/aa2cdb56824c39adedd133a1755f35319ad8d126))


### Bug Fixes

* **cloud-run:** sync version to 5.85.0 in server.ts and logger.ts ([6a3bf47](https://github.com/skyasu2/openmanager-ai/commit/6a3bf47aabf13d35bc45b689e4c761b3dc4325cf))
* **e2e:** use data-testid for fullscreen button selectors ([6426f8b](https://github.com/skyasu2/openmanager-ai/commit/6426f8b1070b66e4a4e76c9e66b4e9109e65e661))
* **scripts:** reduce false positives in doc-test-validator ([d15bff8](https://github.com/skyasu2/openmanager-ai/commit/d15bff80b6b188074ebe33f15f6ba352d7c5ec55))
* **security:** resolve DDoS vulnerability and prompt injection, clean up stores ([4957ae5](https://github.com/skyasu2/openmanager-ai/commit/4957ae5fc42c5356c003f835d7400fce9da53a2a))
* **security:** resolve getRandomValues TypedArray bug and update API test ([beb8274](https://github.com/skyasu2/openmanager-ai/commit/beb827488a01731cfb6764681c16d6dc6fa3792d))
* **test:** improve integration test reliability per code review ([d495d8c](https://github.com/skyasu2/openmanager-ai/commit/d495d8c35b440c3420b7c31e1f859ca2dd765fc7))
* **test:** make checkRandomEvent test deterministic ([02e4965](https://github.com/skyasu2/openmanager-ai/commit/02e49657fe65727948f1f890dfa44275bf9a92cc))
* **test:** resolve logger mock issues and improve test stability ([217ed5e](https://github.com/skyasu2/openmanager-ai/commit/217ed5e36cd78d86a310dc933569b844d2696d9a))

## [5.85.0](https://github.com/skyasu2/openmanager-ai/compare/v5.84.3...v5.85.0) (2026-01-10)


### Features

* **ai:** add dashboard warmup for Cold Start prevention ([0254aa7](https://github.com/skyasu2/openmanager-ai/commit/0254aa77e710c972ad26ba7cab73e3194916a999))
* **logging:** add Pino logger to Cloud Run AI Engine ([971c123](https://github.com/skyasu2/openmanager-ai/commit/971c123fc924f95a2e841769b7ca331a239bb04b))


### Bug Fixes

* **ai:** improve Zod schema flexibility for AI SDK v5 parts ([b065904](https://github.com/skyasu2/openmanager-ai/commit/b0659041969d5c34aec2bfe52a790e2e4cc93502))
* **schemas:** improve AI SDK compatibility and validation ([4617eff](https://github.com/skyasu2/openmanager-ai/commit/4617effd466e163d46cada7a4e0b238aeae6016a))

### [5.84.3](https://github.com/skyasu2/openmanager-ai/compare/v5.84.2...v5.84.3) (2026-01-10)


### ⚠ BREAKING CHANGES

* Directory structure reorganized

## Directory Changes
- src/domains/ → src/components/, src/hooks/, src/types/, src/utils/
- src/modules/ → src/services/, src/hooks/, src/types/
- src/core/ → src/lib/core/
- src/interfaces/ → src/lib/interfaces/
- src/mock/, src/mocks/ → src/__mocks__/
- src/adapters/ → src/services/adapters/
- src/presentation/ → deleted (re-export only)

## Env File Consolidation
- Created .env (baseline, no secrets)
- Updated .env.example (comprehensive template)
- Deleted redundant: .env.local.template, .env.test.example,
  .env.vercel.production, .env.vercel-production

## Documentation Updates
- Updated module-structure.md (new architecture)
- Updated system-architecture-current.md
- Updated msw-guide.md

## Validation
- TypeScript: passed
- Lint: 748 files, no errors
- Tests: 92 passed
- Build: successful

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>

### Features

* **logging:** migrate console statements to Pino logger ([82bc157](https://github.com/skyasu2/openmanager-ai/commit/82bc157f9f0f7cc3b2ecef5e6175881d7b59a449))


### Bug Fixes

* **docs:** align Analyst Agent description with feature table ([7cf8a69](https://github.com/skyasu2/openmanager-ai/commit/7cf8a69667d93d10584f9c5a8906d33264297d72))
* remove unused logger imports and biome-ignore comments ([a275da8](https://github.com/skyasu2/openmanager-ai/commit/a275da8c0b33b6423cec4d0ceb7ba8c1b7de7b02))
* **types:** remove any types from polyfills and development-only ([1be267a](https://github.com/skyasu2/openmanager-ai/commit/1be267aa9ce88df291d9aa1e2f268590eb8ca65a))
* **types:** remove any types from seed-logs and recharts declarations ([ab178ec](https://github.com/skyasu2/openmanager-ai/commit/ab178ecb4f7b9f67eaff5c807ce2030e1ae3d8c1))
* update import path documentation and README ([526b29a](https://github.com/skyasu2/openmanager-ai/commit/526b29a8d5ccc9a20fd46995029ddeff1e66866b))


* migrate DDD to Next.js standard structure ([23f7e2d](https://github.com/skyasu2/openmanager-ai/commit/23f7e2d771202748425728d9f51afbeec556f566))

### [5.84.2](https://github.com/skyasu2/openmanager-ai/compare/v5.84.1...v5.84.2) (2026-01-09)


### ⚠ BREAKING CHANGES

* **ai-review:** Qwen removed from AI code review rotation

Reason for removal:
- Average execution time: 201 seconds (2.3x slower than Gemini's 89s)
- Failure rate: 13.3% (12 failures out of 90 runs in 2025-12)
- Simplifies maintenance with codex ↔ gemini 1:1 rotation

Changes:
- ai-review-core.sh: Remove try_qwen_review function, simplify fallback
- ai-review-utils.sh: Update select_primary_ai for 2-AI rotation
- auto-ai-review.sh: Update to v7.0.0, change from 3-AI to 2-AI
- ai-tools.md: Update CLI tools documentation
- Deprecate: qwen-wrapper.sh → qwen-wrapper.sh.deprecated
- Archive: QWEN.md → docs/archived/QWEN.md.deprecated
- Update: .vscode/ai-context.json, ai-settings.json, .claude-project.json

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>

### Features

* **ai:** add context compression for token efficiency ([7fcb679](https://github.com/skyasu2/openmanager-ai/commit/7fcb6797f01baca5300c80986f7e6b45e8c00b44))
* **ai:** add response caching to supervisor API ([390bf06](https://github.com/skyasu2/openmanager-ai/commit/390bf06b3afdfd38243e5c92cb99d6fa022326d0))
* **cloud-run:** migrate to Artifact Registry and optimize Docker ([d1763bd](https://github.com/skyasu2/openmanager-ai/commit/d1763bd008fc219e33e6a878428b282987545f5c))
* **components:** add barrel exports for ui, shared, ai directories ([41aa056](https://github.com/skyasu2/openmanager-ai/commit/41aa0562f591cc53fa3b37557e6573d1ffda6703))
* **nlp:** add typo tolerance and English patterns to supervisor ([f638e8d](https://github.com/skyasu2/openmanager-ai/commit/f638e8d493a9a6c6c02930ff199b10bfea595022))
* **nlp:** enhance intent classification regex patterns ([e0b64b2](https://github.com/skyasu2/openmanager-ai/commit/e0b64b2eb561d89bc86f244457aca46b37fbf63c))
* **streaming:** implement real-time SSE streaming for AI chat ([3450788](https://github.com/skyasu2/openmanager-ai/commit/345078884abc6d9c40775bafd7725711825c94fc))
* **ui:** add typewriter effect for AI responses ([76c845d](https://github.com/skyasu2/openmanager-ai/commit/76c845d28b9b6501114b3d84ed779b5b8f4aff76))


### Bug Fixes

* **ai-engine:** sync server version to 5.84.1 ([5347ce0](https://github.com/skyasu2/openmanager-ai/commit/5347ce0fc65439aa6ab4f8079fc8343e812c57dc))
* **chat:** clear input immediately and add auto-scroll ([de45182](https://github.com/skyasu2/openmanager-ai/commit/de4518238513af969c623f9ca7e5b51c255a16e5))
* **cloud-run:** remove HTTP/2 option causing protocol errors ([5a3bbea](https://github.com/skyasu2/openmanager-ai/commit/5a3bbeac0e10f9ebd0cdeada93824edb73188043))
* frontend quality improvements ([d490db8](https://github.com/skyasu2/openmanager-ai/commit/d490db8fc0d98ca5a817f567022f07e3ee593028))
* **lint:** disable noConsole rule and fix a11y warning ([f02c2b1](https://github.com/skyasu2/openmanager-ai/commit/f02c2b18e78e240969fa2d7c3cc105e7c09af4dd))
* **mocks:** add database and health mock handlers for unified API ([d4d28ca](https://github.com/skyasu2/openmanager-ai/commit/d4d28cac8bb2a2c83d033a3e4cff0fcbcc028648))
* **mocks:** improve mock handlers with error handling and simple health check ([b9231fd](https://github.com/skyasu2/openmanager-ai/commit/b9231fdb184dd84d57607f9cf8c8c046d43add21))
* **nlp:** add infrastructure context gating to reduce false positives ([ee585d3](https://github.com/skyasu2/openmanager-ai/commit/ee585d3884a14818fec13f61012ad759bb91d65f))
* **streaming:** address AI code review findings ([8829c55](https://github.com/skyasu2/openmanager-ai/commit/8829c55fe4234f190202000d08ec334e2abf3368))
* **test:** update orchestrator handoffs count to 5 ([9cf9f26](https://github.com/skyasu2/openmanager-ai/commit/9cf9f268109c93eedf3292d08a0acefa40f8713d))


* **ai-review:** remove Qwen from 3-AI to 2-AI system ([95860ef](https://github.com/skyasu2/openmanager-ai/commit/95860ef21fedee0231151eefd1c932000c127e88))

### [5.84.1](https://github.com/skyasu2/openmanager-ai/compare/v5.84.0...v5.84.1) (2026-01-07)


### Features

* **cloud-run:** add Langfuse secret to deploy and config-parser ([0c5a1fc](https://github.com/skyasu2/openmanager-ai/commit/0c5a1fc3edefe02455bfd710a30ef5949f74ea4a))
* **observability:** add Langfuse free tier protection and traces API ([b55fad2](https://github.com/skyasu2/openmanager-ai/commit/b55fad2d36092518a286b6765261bed4d18f6995))
* **skills:** add cloud-run-deploy skill for AI Engine deployment ([6757dbe](https://github.com/skyasu2/openmanager-ai/commit/6757dbec874de485d086cb8b844ecb29731a1417))


### Bug Fixes

* **data:** update sync script to use _pattern field ([b32f3dd](https://github.com/skyasu2/openmanager-ai/commit/b32f3dda949e2d090e6bf98ac8ef67a09d507f46))
* **docker:** remove BuildKit-specific syntax for Cloud Build compatibility ([987b90e](https://github.com/skyasu2/openmanager-ai/commit/987b90e69ff0c572318aeb0237eb42973d7c0316))
* **versioning:** fix docs version updater for English patterns ([4d52fae](https://github.com/skyasu2/openmanager-ai/commit/4d52fae3030446564efe53e8f5437d40c70cb665))

## [5.84.0](https://github.com/skyasu2/openmanager-ai/compare/v5.83.14...v5.84.0) (2026-01-06)


### Features

* **a11y:** add focus-visible styles for keyboard navigation ([b2f9e3c](https://github.com/skyasu2/openmanager-ai/commit/b2f9e3cdc8875606961f0ca77162f4073788aadd))
* **ai-engine:** add adaptive thresholds with temporal pattern learning ([7022dd4](https://github.com/skyasu2/openmanager-ai/commit/7022dd4d123625e1a38c6d8b586844607758bdf2))
* **ai-engine:** add comprehensive incident report tools ([2cfb65f](https://github.com/skyasu2/openmanager-ai/commit/2cfb65fdd02e9313fb141c2ad343824d856b6fa0))
* **ai-engine:** add forced routing and export checkThresholds ([d0c8c96](https://github.com/skyasu2/openmanager-ai/commit/d0c8c963314843761f7f58831a52cfda0305798b))
* **ai-engine:** add metric-based log generation for AI analysis ([cfc8026](https://github.com/skyasu2/openmanager-ai/commit/cfc8026e65ef23303ba3ade1aee244d41bc08f3e))
* **ai-engine:** add OpenRouter as Advisor/Verifier fallback ([9d06ad1](https://github.com/skyasu2/openmanager-ai/commit/9d06ad179c25c5d1b5b07ab461d1d49f2d46936e))
* **ai-engine:** add Provider Toggle API and OpenRouter fallback ([024c797](https://github.com/skyasu2/openmanager-ai/commit/024c79796c2f46098faf0db5bf6ef2ef3f3f9a15))
* **ai-engine:** add Summarizer Agent using OpenRouter free tier ([6bb4fba](https://github.com/skyasu2/openmanager-ai/commit/6bb4fba7860c4e7a2d7a2645456b726898d7594c))
* **ai-engine:** add Tavily web search best practices ([abe5280](https://github.com/skyasu2/openmanager-ai/commit/abe5280efa4d6a50ca22549bfe3f3ab4370825d9))
* **ai-engine:** Add Tavily web search tool + whitespace validation ([2333742](https://github.com/skyasu2/openmanager-ai/commit/23337429ad4178bcaacfebde3b501d93f56c6698))
* **ai-engine:** add UnifiedAnomalyEngine with streaming support ([c8330a7](https://github.com/skyasu2/openmanager-ai/commit/c8330a7b0754edcab71e29b595fb24a1d92a0b31))
* **ai-engine:** Cloud Run AI Engine 업데이트 (Mistral 1024d embedding) ([9f3b086](https://github.com/skyasu2/openmanager-ai/commit/9f3b0862afc39a37b37c95a805fa8d8ff4c94ce4))
* **ai-engine:** implement Isolation Forest hybrid anomaly detection ([6f19da6](https://github.com/skyasu2/openmanager-ai/commit/6f19da6a1db9cfc1e6a92324bbde0599f9e776da))
* **ai-engine:** RAG Incident Injection 및 Agent 통합 ([ca9d9a9](https://github.com/skyasu2/openmanager-ai/commit/ca9d9a9347f7436a8daafc1020b35d30861633e2))
* **ai-sdk:** add response schemas and input examples for tools ([b05831e](https://github.com/skyasu2/openmanager-ai/commit/b05831e68c0efbe2bb7265034e1d532be81f3663))
* **ai-sidebar:** add analysis basis transparency section ([917888f](https://github.com/skyasu2/openmanager-ai/commit/917888f3f857f558660c52fa50bfd0ff03e22df9))
* **ai-sidebar:** enhance UX with error handling, gestures and history ([e47bcb5](https://github.com/skyasu2/openmanager-ai/commit/e47bcb58dee586ac29bc5ac4e714030fd5f622b8))
* **ai:** add clarification dialog for ambiguous queries ([dcd5665](https://github.com/skyasu2/openmanager-ai/commit/dcd5665a918b07afa53e880c450b47cf9f5e1d6c))
* **ai:** add server-side query classification API ([e6f13f9](https://github.com/skyasu2/openmanager-ai/commit/e6f13f9c686234087cedb82a8da885dd2ce7cd3a))
* **ai:** add summary-first response principle to supervisor prompt ([110e7ff](https://github.com/skyasu2/openmanager-ai/commit/110e7ff238d7e6e00ed3c155be043136b545865e))
* **ai:** implement pre-emptive fallback and quota tracking ([94acaa6](https://github.com/skyasu2/openmanager-ai/commit/94acaa65d3f6efc08b3cbe6ea27d7b9efa6af05e))
* **auth:** add server-side OAuth callback handler ([02da0bb](https://github.com/skyasu2/openmanager-ai/commit/02da0bb66fea771321ef3766c568c3ac191f5afd))
* **dashboard:** Premium UI 업그레이드 및 한국어화 ([8abdfee](https://github.com/skyasu2/openmanager-ai/commit/8abdfee64686588e5279372d61a8b38673ceae56))
* **dashboard:** 서버카드 실제 API 연동 + 접근성 개선 ([6872809](https://github.com/skyasu2/openmanager-ai/commit/6872809f53180b9627a9a706997309cd3b2ccc70))
* **data:** implement progressive failure phases for realistic AI analysis ([a93f5df](https://github.com/skyasu2/openmanager-ai/commit/a93f5df00a64e6abd81d704e38e2846c5a5204e6))
* **data:** implement seeded random for deterministic data generation ([311d964](https://github.com/skyasu2/openmanager-ai/commit/311d9644fad1818ba3fcd03276454d312dc20636))
* **data:** unify Dashboard/AI Engine data to 10-min intervals with logs ([d9b81a9](https://github.com/skyasu2/openmanager-ai/commit/d9b81a98085f9a39831115c8321cca84ecae12af))
* **incident-report:** add response caching with 1-hour TTL ([6151d98](https://github.com/skyasu2/openmanager-ai/commit/6151d98e62d204ae901776f2c6cc7106f5c64fb3))
* **incident-report:** implement structured JSON output with tool-based data ([0b16545](https://github.com/skyasu2/openmanager-ai/commit/0b1654500dfc2ae8e623bd139b4945da721a3d2c))
* **logs:** add Supabase persistent server logs storage ([c51f69d](https://github.com/skyasu2/openmanager-ai/commit/c51f69deed01c6eb8e7fb433fb08d926f1375ae9))
* **logs:** implement scenario-based log generation (zero DB cost) ([1298903](https://github.com/skyasu2/openmanager-ai/commit/1298903869e3671fc08cc7827c7154fa4c13039f))
* **mcp:** replace Figma with Sequential Thinking MCP ([8d3aa53](https://github.com/skyasu2/openmanager-ai/commit/8d3aa53b31fb75e1ce6cabf3e479c377d8941db4))
* **metrics:** add 'sync' mode for 10-minute aligned updates ([f0077c4](https://github.com/skyasu2/openmanager-ai/commit/f0077c46bfc69176c767d2474e235967385db09b))
* **modal:** 데이터 투명성 개선 - 추정값/자동생성 명시 ([c6dd9b3](https://github.com/skyasu2/openmanager-ai/commit/c6dd9b3de113b5faca291804de3db660404efff2))
* **rag:** command_vectors 1024d Mistral 시드 스크립트 추가 ([4cb1cd4](https://github.com/skyasu2/openmanager-ai/commit/4cb1cd412236b6776e79f8f7409866d1fe7850c6))
* **rag:** 누락된 RPC 함수 추가 및 마이그레이션 가이드 ([c468914](https://github.com/skyasu2/openmanager-ai/commit/c46891480478a819e74a9125c7538c91e2737e49))
* **runtime:** add environment detection utilities, fix MetricsProvider ([2915234](https://github.com/skyasu2/openmanager-ai/commit/2915234a79205cc1f70c3640670eda90386221f5))
* **seo:** add comprehensive SEO metadata and OpenGraph support ([35b6ed5](https://github.com/skyasu2/openmanager-ai/commit/35b6ed50dd7594b4c21378735208d37c7129d327))
* **ui:** enhance anomaly detection visualization with threshold bands ([a9ef7ee](https://github.com/skyasu2/openmanager-ai/commit/a9ef7ee34b72c10a3c63125881c5e069414c26a1))
* **ui:** improve server card UX with unified chart colors and labels ([912b0fb](https://github.com/skyasu2/openmanager-ai/commit/912b0fb218e5e3c12a54bf7a5a033a92e740759f))
* 문서 관리 도구 도입 (markdownlint, doctoc) ([415cb71](https://github.com/skyasu2/openmanager-ai/commit/415cb71bfc8c0540662d42358b5d7e1c736d25c1))


### Bug Fixes

* **ai-agents:** add bilingual language guidelines (KR/EN) ([6d0d26e](https://github.com/skyasu2/openmanager-ai/commit/6d0d26e31e26a3ad8f2e482d9aa5cd22cda6a359))
* **ai-agents:** enforce Korean-only responses without Chinese characters ([465c888](https://github.com/skyasu2/openmanager-ai/commit/465c888a4f5f45ac40c7fa37ad28509eaa8c2d94))
* **ai-engine:** add German 'Lösung' to text sanitizer ([7496f7a](https://github.com/skyasu2/openmanager-ai/commit/7496f7a3b31cc101047c8eb40694ba81dc73107a))
* **ai-engine:** add missing network metric to incident timeline ([c57037e](https://github.com/skyasu2/openmanager-ai/commit/c57037e51bb73e1dc28605bcb26daea5339dd8aa))
* **ai-engine:** add text sanitizer for foreign character removal in LLM responses ([3808ff7](https://github.com/skyasu2/openmanager-ai/commit/3808ff703b126e3056320414e1d9144066624eb8))
* **ai-engine:** add Thai, Arabic, Turkish character removal ([64211e1](https://github.com/skyasu2/openmanager-ai/commit/64211e12c8eeda6404625ea89a595375ccfab8f6))
* **ai-engine:** AI 리뷰 지적사항 개선 ([2602f09](https://github.com/skyasu2/openmanager-ai/commit/2602f09b51022b9542c0c1a1b746c73d1012adaa))
* **ai-engine:** cleanup timeout timer in Promise.race ([1a3da49](https://github.com/skyasu2/openmanager-ai/commit/1a3da495d34b678191682cb4fafac342d2bd5c45))
* **ai-engine:** enforce server monitoring context and improve agent routing ([0ae1a01](https://github.com/skyasu2/openmanager-ai/commit/0ae1a0155762f266b845a7c20b6c31b7a79a556b))
* **ai-engine:** expand foreign language mappings in text sanitizer ([4b8ce6b](https://github.com/skyasu2/openmanager-ai/commit/4b8ce6bcae4cf819791ae83b38ff00eddb0c1930))
* **ai-engine:** Mistral API key validation bug ([73ed8dd](https://github.com/skyasu2/openmanager-ai/commit/73ed8dd1fe77bd32f517937112c3e928fd2999e8))
* **ai-engine:** use stable stringify for cache keys ([7cfb77a](https://github.com/skyasu2/openmanager-ai/commit/7cfb77a5eddba62044a74a8d6abdcf74922a2ec6))
* **ai-sdk:** add globalSummary for time range aggregation queries ([6c36e59](https://github.com/skyasu2/openmanager-ai/commit/6c36e59647e8c98ba2bf94ef1708d3dbb0051286))
* **ai-sdk:** improve tool routing with clear usage hints ([97ef422](https://github.com/skyasu2/openmanager-ai/commit/97ef422cff19d491b218bfe275bde01365bb1d17))
* **ai-sdk:** resolve time range query response issue ([b8558c5](https://github.com/skyasu2/openmanager-ai/commit/b8558c5c3311ece00a2da39f1d05c34fe5b0e3ba))
* **ai-sidebar:** address code review issues from CODEX ([e6b6431](https://github.com/skyasu2/openmanager-ai/commit/e6b6431d024da33b6acb9343a395739ec03a6301))
* **ai:** add optional chaining for trendPrediction.summary access ([87fdbbe](https://github.com/skyasu2/openmanager-ai/commit/87fdbbe21f3a838e76fde8d5422bbcf306ee124a))
* **ai:** clarification dialog working correctly ([ab59aee](https://github.com/skyasu2/openmanager-ai/commit/ab59aee6d2e0838078ba6d740ad4b71056817d31))
* **ai:** expand clarification trigger keywords ([56e3d4d](https://github.com/skyasu2/openmanager-ai/commit/56e3d4df6521ef808bb4a6b1e365b123edda64c9))
* **ai:** improve clarification dialog precision and skip functionality ([12a953d](https://github.com/skyasu2/openmanager-ai/commit/12a953d6cc3fe6f873e78cc0cf5ee8302ec32544))
* **ai:** prevent duplicate user message in streaming mode ([7d09693](https://github.com/skyasu2/openmanager-ai/commit/7d09693eaa6e2bb59646debf24d2c12a016f8427))
* **ai:** prevent Object.entries crash on undefined results ([4b7b231](https://github.com/skyasu2/openmanager-ai/commit/4b7b231f93010570588413364096428e436725ba))
* **ai:** simplify TextStreamChatTransport config ([e37e8bb](https://github.com/skyasu2/openmanager-ai/commit/e37e8bb9a123c0ecbcd6f8b78b62bb81f76ac4cf))
* **ai:** skip empty user messages in extractLastUserQuery ([0c02be3](https://github.com/skyasu2/openmanager-ai/commit/0c02be33d9d8262a2d35266fa8d348ee1aa9b798))
* **ai:** sync thresholds between Dashboard and Cloud Run AI ([e70c98a](https://github.com/skyasu2/openmanager-ai/commit/e70c98a8fd1543c5ce06e5f4dba1a3bf097409c5))
* **ai:** use generateText + JSON parsing for Groq compatibility ([5b1e9ae](https://github.com/skyasu2/openmanager-ai/commit/5b1e9ae5c93016bde59ef180965a2f6dfd654978))
* **ai:** use llama-3.3-70b for structured output support ([d59c09a](https://github.com/skyasu2/openmanager-ai/commit/d59c09a2917f844b6356e73fe9f14d35cd0356c2))
* **ai:** use TextStreamChatTransport for non-chunked responses ([aceae58](https://github.com/skyasu2/openmanager-ai/commit/aceae58d6642c825b7cf83d40678f15e97c4272b))
* **api:** convert supervisor response to Data Stream Protocol format ([2521efb](https://github.com/skyasu2/openmanager-ai/commit/2521efbf61181e8c1a3e83e5cb6b8fa5fbecb090))
* **api:** use dynamic version in health endpoint ([477d52b](https://github.com/skyasu2/openmanager-ai/commit/477d52b685ff41938daca5c8be0ee3900c9d8f71))
* **auth:** add implicit flow token handling for Google OAuth ([76cd1ba](https://github.com/skyasu2/openmanager-ai/commit/76cd1ba1c96c59ae67d13c9119c6cefb678a5f9b))
* **auth:** add tilde to PKCE code_verifier validation regex ([0a4c24a](https://github.com/skyasu2/openmanager-ai/commit/0a4c24a49a75d5d3f80c5a331e64c1b3ee1d9f60))
* **auth:** completely disable PKCE validation to fix Google OAuth ([eda288c](https://github.com/skyasu2/openmanager-ai/commit/eda288cc54918a76b94bb81dcc2ff3432788d13f))
* **auth:** disable detectSessionInUrl and use manual setSession ([30f3d8b](https://github.com/skyasu2/openmanager-ai/commit/30f3d8b2da72d07c6284ea7cb28f105b68251be0))
* **auth:** disable PKCE code_verifier deletion for debugging ([193d11e](https://github.com/skyasu2/openmanager-ai/commit/193d11e492e91a3d9c388d55f42fdae8d2866752))
* **auth:** enable Supabase auto session detection for implicit flow ([2191afd](https://github.com/skyasu2/openmanager-ai/commit/2191afddb106ad0b9d02c0120375628274e928f9))
* **auth:** implement proper PKCE flow with debugging ([0994727](https://github.com/skyasu2/openmanager-ai/commit/0994727691e5e09ce8c0b8d5682833cb84f6e96c))
* **auth:** implement server-side PKCE callback handler ([9c96d54](https://github.com/skyasu2/openmanager-ai/commit/9c96d540f5fae3e9acd04cc375e3481472c3cceb))
* **auth:** React Hydration 에러 [#418](https://github.com/skyasu2/openmanager-ai/issues/418) 수정 + Google OAuth 설정 ([36d5dda](https://github.com/skyasu2/openmanager-ai/commit/36d5ddaf801555326161bbb0be136ee5b1a67cea))
* **auth:** remove conflicting page.tsx, keep only route.ts ([16d01ca](https://github.com/skyasu2/openmanager-ai/commit/16d01cadee9b9fa6b51a84f84afd79a61a988fa6))
* **auth:** revert to createClient for proper PKCE localStorage support ([36fa3b7](https://github.com/skyasu2/openmanager-ai/commit/36fa3b76b547bc452dcaf64660820f58010ab6a9))
* **auth:** switch from PKCE to implicit flow for OAuth ([1c547b4](https://github.com/skyasu2/openmanager-ai/commit/1c547b43fb79db02bd51457c7b887855d5791347))
* **auth:** switch to implicit flow to bypass PKCE storage issue ([9faafd0](https://github.com/skyasu2/openmanager-ai/commit/9faafd0611eb6d8d82100f3167ca11409cdaf3c9))
* **auth:** trim environment variables to remove invalid characters ([de57f92](https://github.com/skyasu2/openmanager-ai/commit/de57f923d5f62fe0f35c5f23692868d3e7cd9aa5))
* **auth:** use client-side PKCE code exchange ([e7a8c72](https://github.com/skyasu2/openmanager-ai/commit/e7a8c72301201385e2e40a835c32f448b7a1316c))
* **auto-report:** add error handling and unified fallback response ([b36419b](https://github.com/skyasu2/openmanager-ai/commit/b36419bb2e7d2577655fd6d153d357d5978bb74f))
* **cloud-run:** correct anomaly data type handling in incident-report ([b15daa5](https://github.com/skyasu2/openmanager-ai/commit/b15daa583805deb401e8f6cdcab5bf2ac902d0ce))
* **dashboard:** AI 코드리뷰 지적사항 개선 ([a168fd3](https://github.com/skyasu2/openmanager-ai/commit/a168fd385ccc94532ebbf0d0aaf69ce99effa198))
* **data:** add error handling to SSOT sync script ([3574769](https://github.com/skyasu2/openmanager-ai/commit/3574769b0d5ab6d09b80ce9096613822351ea190))
* **data:** hide scenario information from AI context and responses ([0f8ea29](https://github.com/skyasu2/openmanager-ai/commit/0f8ea297c848357176c5b7db8cd99ea19500965a))
* **data:** implement SSOT sync for Dashboard and AI Engine data consistency ([6e1cc09](https://github.com/skyasu2/openmanager-ai/commit/6e1cc093e3139e602b55562dbed825feb2b88c27))
* **data:** replace generatedAt with static version for idempotent sync ([5ca89fa](https://github.com/skyasu2/openmanager-ai/commit/5ca89fa7ee875ff31ca6b2ad89a124986e2ad77e))
* **data:** unify UnifiedServerDataSource with MetricsProvider ([20bebe7](https://github.com/skyasu2/openmanager-ai/commit/20bebe764a3ae6be0c12ef1cb7a92d8ab6ecc24d))
* **e2e:** update guest test selectors for refactored dashboard ([4c52a67](https://github.com/skyasu2/openmanager-ai/commit/4c52a676a3cbd56c9578a79b02d9eb804f357173))
* **e2e:** 테스트를 현재 동작에 맞게 업데이트 ([d60641a](https://github.com/skyasu2/openmanager-ai/commit/d60641aa5fcc628eedc3fdb16f6f14e1eed0f751))
* **landing:** clarify Cloud Platform card to emphasize architecture design ([5ecf918](https://github.com/skyasu2/openmanager-ai/commit/5ecf9183473797c2f10ba39d7123f1296e2501b8))
* **landing:** improve AI Assistant card description for clarity ([c1ed76b](https://github.com/skyasu2/openmanager-ai/commit/c1ed76b729b8920d91c5917c942b33a08b7c0ef5))
* **modal:** remove unused imports and variables ([a270b8f](https://github.com/skyasu2/openmanager-ai/commit/a270b8fe10c869068c45db9a5c0ef3e307280710))
* **modal:** resolve server card modal flickering issue ([33b0e62](https://github.com/skyasu2/openmanager-ai/commit/33b0e6245c39c501ac1815e3482812ad20288baf))
* **modal:** 그래프 검은색 렌더링 문제 해결 + 접근성 개선 ([5f5ee9f](https://github.com/skyasu2/openmanager-ai/commit/5f5ee9fdf71c988bfd68bbd8a4fd4f5f552c0668))
* **og:** add error handling and query parameter support ([bbea63b](https://github.com/skyasu2/openmanager-ai/commit/bbea63b2cc99790abd1bfe917c828e990de6300e))
* **ServerCard:** resolve nested button hydration error ([e91cce1](https://github.com/skyasu2/openmanager-ai/commit/e91cce1b637fc24448a34d16f3e15062a00ee7b7))
* **test:** add @tavily/core mock to prevent network calls ([2a85240](https://github.com/skyasu2/openmanager-ai/commit/2a85240404376e5022daf6ff7c482e1d454edcd1))
* **test:** align test expectations with recent UI and code changes ([32405a8](https://github.com/skyasu2/openmanager-ai/commit/32405a892af5461a10bce4a0288608cdb5b1ba93))
* **types:** improve type safety in getFallbackServers and add unit tests ([fe8936c](https://github.com/skyasu2/openmanager-ai/commit/fe8936cde504cafef777ac972881a80f8bf89f78))
* **types:** normalize loadbalancer to load-balancer for SSOT compliance ([243dc16](https://github.com/skyasu2/openmanager-ai/commit/243dc1670b08c509c271a27697d4e2c40ac7addd))
* **ui:** add suppressHydrationWarning to OpenManagerLogo ([a24be5d](https://github.com/skyasu2/openmanager-ai/commit/a24be5d3c8a752cbd633b5055ed5fa42601e12d6)), closes [#418](https://github.com/skyasu2/openmanager-ai/issues/418)
* **ui:** add text color to chat input textarea ([06a52b1](https://github.com/skyasu2/openmanager-ai/commit/06a52b102077c864f2c22ae3c286de4d3952ed5d))
* **ui:** hide scenario terminology from user-facing UI ([1d5205c](https://github.com/skyasu2/openmanager-ai/commit/1d5205c78e67197e16c21b036866cfd6af980042))
* **ui:** resolve React hydration error [#418](https://github.com/skyasu2/openmanager-ai/issues/418) and improve accessibility ([7c3daa8](https://github.com/skyasu2/openmanager-ai/commit/7c3daa80664a0e07063e11bf122e1e53f6560f97))
* **ui:** use dynamic version from env instead of hardcoded value ([b6bb434](https://github.com/skyasu2/openmanager-ai/commit/b6bb4345eebed18a4777df56406529224ee8bd4b))

### [5.83.14](https://github.com/skyasu2/openmanager-ai/compare/v5.83.13...v5.83.14) (2025-12-30)

### [5.83.13](https://github.com/skyasu2/openmanager-ai/compare/v5.83.12...v5.83.13) (2025-12-30)


### Features

* **ai-engine:** @ai-sdk-tools/agents 기반 멀티-에이전트 시스템 구현 ([e59a54a](https://github.com/skyasu2/openmanager-ai/commit/e59a54a211b78f784aa4c5e6da92184ea9f105a9))
* **ai-engine:** GraphRAG + Redis L2 + Approval PostgreSQL 영속화 ([0a0780a](https://github.com/skyasu2/openmanager-ai/commit/0a0780a37407253bc7d40dd6ab62604a17f09ba2))
* **ai-engine:** Langfuse Observability + Circuit Breaker 통합 ([0829bad](https://github.com/skyasu2/openmanager-ai/commit/0829bad59ac288c657166fd42ae872e17185a1bd))
* **ai-engine:** Phase 5.2 Agent Dependency System 구현 ([b1edb94](https://github.com/skyasu2/openmanager-ai/commit/b1edb945ffe5a16a119b838d16c57831df64c0b2))
* **ai-engine:** Phase 5.7 하이브리드 Verifier 검증 전략 구현 ([5ffa688](https://github.com/skyasu2/openmanager-ai/commit/5ffa688fbe3c5bb836f6b66f056bd352f96de85c))
* **ai-engine:** Precomputed State 최적화 구현 ([8ebe914](https://github.com/skyasu2/openmanager-ai/commit/8ebe914c08afa5a75903ea4ae4dc02ea6aa7393e))
* **ai-engine:** RCA + Capacity Agent 구현 완료 ([eed068d](https://github.com/skyasu2/openmanager-ai/commit/eed068dfb0d88bc7c561172c4f63d2adfc40ca9f))
* **ai-engine:** Reporter/Analyst Agent 개선 - Groq 모델 + 실제 데이터 도구 ([d5e6bba](https://github.com/skyasu2/openmanager-ai/commit/d5e6bbac3f9e431720a80cdad28c43650030741f))
* **ai-engine:** Supervisor 프롬프트 의존성 규칙 강화 ([9f38344](https://github.com/skyasu2/openmanager-ai/commit/9f3834484db661bf70a8468969b5ef44f3caa82c))
* **ai-workspace:** ChatGPT 스타일 풀페이지 UI 개선 ([757f0ff](https://github.com/skyasu2/openmanager-ai/commit/757f0ff59581e6db783ae9fd891dac84d91e6da9))
* **ai:** AI 어시스턴트 엔진 안정성 및 보안 개선 ([6243478](https://github.com/skyasu2/openmanager-ai/commit/6243478be4c931560b1e82841473027a41fddab2))
* **ai:** AI 엔진 안정성 개선 - Phase 1~3 완료 ([b1260bb](https://github.com/skyasu2/openmanager-ai/commit/b1260bb80f801c7648c1871af910676544641f7d))
* **ai:** Async Job Queue + SSE 실시간 알림 시스템 구현 ([4a7f479](https://github.com/skyasu2/openmanager-ai/commit/4a7f47941e014a57f2daae1605daf77f2f8147a3))
* **ai:** Circuit Breaker Fallback 및 캐싱 적용 완료 ([f475037](https://github.com/skyasu2/openmanager-ai/commit/f47503754fe5aacbdd86436830bf929f7a46abb4))
* **ai:** Last Keeper Mode - Mistral 최후의 보루 구현 ([60e7318](https://github.com/skyasu2/openmanager-ai/commit/60e7318cf09c05960ae5622adda1fd4e1ba8a81c))
* **ai:** NLQ Agent Cerebras PoC - Rate Limit 분산 ([a201851](https://github.com/skyasu2/openmanager-ai/commit/a201851fadbf4fa464a234ffb7ce9117466b9d1d))
* **ai:** NLQ Agent SubGraph 아키텍처 + Mistral 마이그레이션 ([3d8a1ee](https://github.com/skyasu2/openmanager-ai/commit/3d8a1ee06dbb48b5562fb375d5f9edd2fbfff632))
* **ai:** Phase 1 Token Optimization - Reporter/Analyst 압축 ([530fbcd](https://github.com/skyasu2/openmanager-ai/commit/530fbcd9d9dbb1c252021bfc7109b9fd09f50b0e))
* **ai:** Phase 2 역할 분리 - Shared Context Store 구현 ([1a0895b](https://github.com/skyasu2/openmanager-ai/commit/1a0895ba9d683523b6021aa746cb67739b099ff4))
* **ai:** Supervisor Cerebras fallback 추가 ([6b958db](https://github.com/skyasu2/openmanager-ai/commit/6b958dbf117d7cd554761d2551f1ab399b14770d))
* **ai:** Supervisor Primary를 Cerebras로 전환 ([0ae7089](https://github.com/skyasu2/openmanager-ai/commit/0ae7089b56db7746c711dae981680cac7cafeac6))
* **ai:** Triple-Provider 최적화 + Web Search Tool 추가 ([21f7ccf](https://github.com/skyasu2/openmanager-ai/commit/21f7ccfb29814c00cb280a624ca9cb61783dcd47))
* **analyst:** 전체 서버 종합 분석 기능 구현 ([5c37633](https://github.com/skyasu2/openmanager-ai/commit/5c376337109fa89e4e214a6c1bfd876a4d48c0f5))
* **data:** 15개 서버 데이터 일관성 동기화 ([f160e15](https://github.com/skyasu2/openmanager-ai/commit/f160e156db312f836922f72251934015d7ff446d))
* **deploy:** 배포 후 자동 스토리지 정리 기능 추가 ([e007f2d](https://github.com/skyasu2/openmanager-ai/commit/e007f2d3fdbd9770d5652d0fc20083871f79d56f))
* **jobs:** triggerWorker 타임아웃 + after() 로깅 개선 ([2025558](https://github.com/skyasu2/openmanager-ai/commit/202555806eef4eabc4649f471864b689858918bf))
* **rag:** 프로젝트 특화 RAG 지식베이스 개선 ([6e5ad85](https://github.com/skyasu2/openmanager-ai/commit/6e5ad852284aea7047d2a2ce1e6512a474331d2f))
* **redis:** Upstash Redis 통합 - Rate Limiting, AI Cache, Circuit Breaker ([4482ea7](https://github.com/skyasu2/openmanager-ai/commit/4482ea71d0b712dce94e3171a9e39f7e477b33c9))
* **review:** 코드 리뷰 이슈 트래커 추가 ([e2af3b7](https://github.com/skyasu2/openmanager-ai/commit/e2af3b77e74a992587980998a3a7a33eb6034c95))


### Bug Fixes

* **a11y:** 서버 카드 접근성 개선 - Color Contrast ([dbd46f4](https://github.com/skyasu2/openmanager-ai/commit/dbd46f4ab8d4016e49cd975ff2be11ab4bcebe4f))
* **agents:** Graceful degradation - API 키 없을 때 서버 시작 실패 방지 ([3abc610](https://github.com/skyasu2/openmanager-ai/commit/3abc610298a2135c3e4a7e099c2cd5a3acc64ef4))
* AI Assistant 모달 tech-stacks 데이터 Triple-Provider 반영 ([054cb38](https://github.com/skyasu2/openmanager-ai/commit/054cb381b6eb6edd7ee081b8a26e8694aa4df9c1))
* **ai-engine:** Reporter 프롬프트 DuckDuckGo → Tavily 수정 ([a076e70](https://github.com/skyasu2/openmanager-ai/commit/a076e708506640d90f51578c786a4d8b63db6cdb))
* **ai-engine:** use MemorySaver on Cloud Run to fix PostgreSQL timeout ([3290fad](https://github.com/skyasu2/openmanager-ai/commit/3290fadd1b4e09ca6795bff277dda78aa426203a))
* **ai-review:** AI 리뷰 지적사항 개선 ([a39a727](https://github.com/skyasu2/openmanager-ai/commit/a39a72700adac9cc7c6c9f0f5a590fd9486086ef))
* **ai:** Cloud Run dynamic import에 .js 확장자 추가 ([6bc2663](https://github.com/skyasu2/openmanager-ai/commit/6bc26636a9cacb8bf2b5bc2ad1955b0724e932a3))
* **ai:** Cloud Run Upstash Redis 연결 수정 ([422580a](https://github.com/skyasu2/openmanager-ai/commit/422580a98d4bf391ff8c904df765890e3c6bf08d))
* **ai:** getUpstashConfig()에 KV_CONFIG 우선 참조 추가 ([8c11ecd](https://github.com/skyasu2/openmanager-ai/commit/8c11ecd775b78254094e3ccdc412d4ca75ac6cc4))
* **ai:** Rate Limit 시 즉시 failover - maxRetries:0 + withFallbacks ([93691ce](https://github.com/skyasu2/openmanager-ai/commit/93691cefbbfe3c2204a7e59d1881d7ff7a48718f))
* **ai:** Supervisor Groq rate limit 시 Mistral fallback 구현 ([0df4cd7](https://github.com/skyasu2/openmanager-ai/commit/0df4cd7e51a0a36996560d671d3bf16d2eb4c571))
* **ai:** Supervisor를 Groq로 변경 - LangGraph handoff 호환성 ([17399eb](https://github.com/skyasu2/openmanager-ai/commit/17399eb929e28a756ba05ae8c6c883bd71343be6))
* **ai:** Tool calling 오류 감지 및 Groq 폴백 추가 ([0737e2b](https://github.com/skyasu2/openmanager-ai/commit/0737e2b0f8967878d05d83d464bc9c1679edb167))
* **ai:** withFallbacks 제거 - 기존 executeSupervisor failover 로직 사용 ([d67da2f](https://github.com/skyasu2/openmanager-ai/commit/d67da2f32a9256a60e3067815dd98febc7460020))
* **api:** incident-report API에서 supabaseAdmin 사용 ([50e18a0](https://github.com/skyasu2/openmanager-ai/commit/50e18a0fa10e8181083bdc7a7b08da3bb1a6852f))
* **auto-report:** API 응답 구조 수정 및 다운로드 기능 구현 ([a0c7077](https://github.com/skyasu2/openmanager-ai/commit/a0c7077d4a6b9f96166e7af8fec8ab8489e77c27))
* **auto-report:** null-safe 다운로드 처리 ([2bad307](https://github.com/skyasu2/openmanager-ai/commit/2bad307dddb7ef5e088cba8e2a19d2622c630478))
* **chart:** EnhancedServerCard 그래프 색상 통일 ([cf9c1e8](https://github.com/skyasu2/openmanager-ai/commit/cf9c1e82ece9a8b4af1b792023e5098aecffa7f1)), closes [#10b981](https://github.com/skyasu2/openmanager-ai/issues/10b981)
* **chat:** 키보드 입력 UX 개선 ([aa6e271](https://github.com/skyasu2/openmanager-ai/commit/aa6e27129afe9efebf2d50f46801747e8c769ea6))
* **dashboard:** DashboardHeader 미사용 props 제거 ([595d560](https://github.com/skyasu2/openmanager-ai/commit/595d560ee37fe638b572fa4af12790e8ba2780c1))
* **deploy:** CEREBRAS_API_KEY secret 추가 ([f21bca4](https://github.com/skyasu2/openmanager-ai/commit/f21bca4ff2261933d5ba009d9f4bc297ca0631c3))
* **deploy:** 에러 처리 개선 및 cleanup 로직 강화 ([6b9d110](https://github.com/skyasu2/openmanager-ai/commit/6b9d11031b9e4ffa43d01d826c4398f2a06e916b))
* **deps:** package-lock.json 동기화 (redis 의존성) ([9d8640c](https://github.com/skyasu2/openmanager-ai/commit/9d8640ca2db54b4da76f9f258877188066715edf))
* **docker:** BuildKit mount syntax 제거 - Cloud Build 호환성 ([9675d6c](https://github.com/skyasu2/openmanager-ai/commit/9675d6ca49a264c58541763afc2dccb7c246f335))
* **docker:** npm ci → npm install (Cloud Build 호환성) ([0f2e326](https://github.com/skyasu2/openmanager-ai/commit/0f2e326465d74cf9649f70819c70d58393bb6843))
* **EnhancedAIChat:** Bot, FileText import 누락 수정 ([479ffd9](https://github.com/skyasu2/openmanager-ai/commit/479ffd909687e506e21d21325b32471a6c7fa85c))
* **env:** CLOUD_RUN_API_SECRET 환경 변수명 통일 ([a5d41e7](https://github.com/skyasu2/openmanager-ai/commit/a5d41e7b17487892454dc1db9412c3cb4dd91c55))
* **gitignore:** token-usage-tracker.ts 예외 추가 ([5a855a2](https://github.com/skyasu2/openmanager-ai/commit/5a855a2665f4a20e9dcd0be9b8e3c15af91a44f1))
* **jobs:** Add response status validation to triggerWorker ([704d10b](https://github.com/skyasu2/openmanager-ai/commit/704d10ba1a4e797c32f60b7237ff74905f38f053))
* **jobs:** Job Queue SSE 진행률 표시 문제 해결 ([01cdfcf](https://github.com/skyasu2/openmanager-ai/commit/01cdfcf338572fe2da46083e8e5342a0b2f38fae))
* **jobs:** Redis 에러 핸들링 Graceful Degradation 적용 ([66203c2](https://github.com/skyasu2/openmanager-ai/commit/66203c289d2b5213059076db01a87ccec8b38379))
* **lint:** DashboardHeader 미사용 파라미터 prefix 추가 ([06a2505](https://github.com/skyasu2/openmanager-ai/commit/06a25052ab7fdfb197edef8dadfb978e87acf41f))
* **model-provider:** config-parser의 중앙집중식 API 키 getter 사용 ([6be2b99](https://github.com/skyasu2/openmanager-ai/commit/6be2b99e543a73d5d54e952ba48e428557e6598c))
* **monitoring:** add safe access to overallResult in MonitoringResults ([d7a945b](https://github.com/skyasu2/openmanager-ai/commit/d7a945bb16b6220e5f5eef7193ee2bc8a5297854))
* **review:** 이슈 트래커 개선 - AI 리뷰 섹션만 스캔 ([59d2388](https://github.com/skyasu2/openmanager-ai/commit/59d2388f406ed11001bf842a5f8420306fec2cf7))
* **supervisor:** Cloud Run JSON 응답 처리 - 스트리밍 파서 대신 JSON 직접 처리 ([6a8fcca](https://github.com/skyasu2/openmanager-ai/commit/6a8fcca7f8d6a9863c290a38ee2ed9a2a07086f6))
* **supervisor:** 미사용 import 제거 (extractTextFromHybridMessage) ([4a338d7](https://github.com/skyasu2/openmanager-ai/commit/4a338d74778ddc75865dc72d47475077a65715cb))
* **SystemContextPanel:** AI Provider 목록을 실제 구현과 일치시킴 ([a72cff5](https://github.com/skyasu2/openmanager-ai/commit/a72cff58ec3cc13a735aaa239053e0d311222697))
* **SystemContextPanel:** AI 리뷰 이슈 수정 ([185b16c](https://github.com/skyasu2/openmanager-ai/commit/185b16cfc5d794915a002befde1736b0b2380e53))
* **ui:** AI Fullscreen 모바일 반응형 + Footer 가독성 개선 ([218d3a5](https://github.com/skyasu2/openmanager-ai/commit/218d3a5134c0ed30e7f0e5dccfc1300deab6c5fc))
* **ui:** Tablet UX 토글 버튼 수정 + AI 점검 보고서 추가 ([6e3abe2](https://github.com/skyasu2/openmanager-ai/commit/6e3abe230d218ba0adb46e7211df91624b116936))
* **useHybridAIQuery:** Streaming 모드에서 메시지 중복 추가 버그 수정 ([5adc685](https://github.com/skyasu2/openmanager-ai/commit/5adc68535921dc66bdbd40f815e68c029fe7e4f5))

### [5.83.12](https://github.com/skyasu2/openmanager-ai/compare/v5.83.11...v5.83.12) (2025-12-25)


### ⚠ BREAKING CHANGES

* **ai:** Replace deprecated packages with scoped v4 packages

- langfuse → @langfuse/core@4.5.1
- langfuse-langchain → @langfuse/langchain@4.5.1
- Add @opentelemetry/api@1.9.0 peer dependency

Benefits:
- Native @langchain/core >=0.3.0 support (no more peer conflicts)
- Remove --legacy-peer-deps workaround from Dockerfile
- Proper TypeScript type support

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>

### Bug Fixes

* **ai:** add --legacy-peer-deps and LangFuse secrets to Cloud Run deployment ([ccd6552](https://github.com/skyasu2/openmanager-ai/commit/ccd6552ae5d6b14ddf9208829a0875d3ffcce377))
* **typescript:** resolve implicit any types and Biome warnings ([8acc37a](https://github.com/skyasu2/openmanager-ai/commit/8acc37a64ff44cb1e718da35bba359351485e1fe))


* **ai:** migrate to @langfuse/langchain v4 (best practice) ([0b5f93a](https://github.com/skyasu2/openmanager-ai/commit/0b5f93a18f0c490af9181002615934ead2185e5e))

### [5.83.11](https://github.com/skyasu2/openmanager-ai/compare/v5.83.10...v5.83.11) (2025-12-24)


### ⚠ BREAKING CHANGES

* **ai:** Rust ML service removed entirely

## Removed
- `cloud-run/rust-inference/` - Entire Rust ML service (dead code)
- `src/lib/rust-ml-client.ts` - Vercel-side Rust client
- `cloud-run/ai-engine/src/lib/rust-ml-client.ts` - AI Engine client
- `src/lib/ai/monitoring/` - Duplicate TypeScript ML on Vercel
- `src/scripts/generate-rust-data.ts` - Data generation script
- `clusterLogPatternsTool` from analyst-agent.ts (unused tool)

## Updated
- `cloud-run/docker-compose.yml` - Removed rust-inference service
- Documentation updated to reflect TypeScript-only ML stack
- Fixed time window comments: 26h → 6h (actual implementation)

## ML Stack (TypeScript only)
- Location: `cloud-run/ai-engine/src/lib/ai/monitoring/`
- SimpleAnomalyDetector: 6-hour moving average + 2σ
- TrendPredictor: Linear regression

Total: -2,870 lines of dead code removed

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>

### Features

* **ai:** add Promptfoo QA testing and LangFuse observability ([c3acb13](https://github.com/skyasu2/openmanager-ai/commit/c3acb135db7d5cc651f37279dea59e374fe2780c))


### Bug Fixes

* **ai:** integrate LangFuse callbacks with LangGraph supervisor ([7ce8fe9](https://github.com/skyasu2/openmanager-ai/commit/7ce8fe9ac59282e5a445e854bef1c44d422e8f4d))
* **ai:** restore analyst-agent tools after accidental truncation ([d13bbae](https://github.com/skyasu2/openmanager-ai/commit/d13bbaeca721eaad335cf7d4600820d0c7158d1c))
* **ai:** restore Data Stream Protocol for AI chat responses ([d1400f3](https://github.com/skyasu2/openmanager-ai/commit/d1400f3c250e1877e5c6981449f93ed0bfb35be8))
* **ai:** use TextStreamChatTransport for plain text streaming ([afaea36](https://github.com/skyasu2/openmanager-ai/commit/afaea36381c496d563a2c3292e4c66f59ac90d56))
* **lint:** resolve 9 lint issues in AI assistant code ([8746849](https://github.com/skyasu2/openmanager-ai/commit/874684932e5ea8ad75082e325fd5df996cea2da8))
* **supabase:** rename timestamp to recorded_at in get_metrics_window function ([c348f1b](https://github.com/skyasu2/openmanager-ai/commit/c348f1bbe05dd5a6bf8388e016a4ab0afba0e0e5))


* **ai:** remove Rust ML service and consolidate TypeScript ML ([d151dc8](https://github.com/skyasu2/openmanager-ai/commit/d151dc8fb37b85e5e3a71246c6b9fb18ff2509f7))

### [5.83.10](https://github.com/skyasu2/openmanager-ai/compare/v5.83.9...v5.83.10) (2025-12-23)


### Features

* **ai-engine:** implement 4 architecture improvements ([f82c1f9](https://github.com/skyasu2/openmanager-ai/commit/f82c1f911ad42ceae0de06d03d8b6ba146a64558))
* **ai-engine:** implement context compression system (Phase 1-3) ([6be161e](https://github.com/skyasu2/openmanager-ai/commit/6be161e9954ab0e3e19480f624476ce94cfb56de))
* **ai:** integrate context compression and sync anomaly detection ([9efb620](https://github.com/skyasu2/openmanager-ai/commit/9efb6202d6cba6fa107e486d2f844bca41d7cfd9))
* **ai:** optimize engine with Gemini 2.5 Flash-Lite, quotas, and architecture docs ([363e210](https://github.com/skyasu2/openmanager-ai/commit/363e2109f61f656ad58accfe9cfaf31f471523f7))
* **db:** add ai_jobs table migration for async job queue ([38b3496](https://github.com/skyasu2/openmanager-ai/commit/38b34968a1c75af21dd61cfaab3885f1bb571544))
* **hooks:** add WSL Limited Mode for pre-push validation ([ef085e2](https://github.com/skyasu2/openmanager-ai/commit/ef085e242a1ac0b7dc43d8e953f2899e0cf2bce0))
* **scripts:** add cumulative review for unreviewed commits (v6.12.0) ([bc1fdf4](https://github.com/skyasu2/openmanager-ai/commit/bc1fdf4281d10c8ae736138ed9c11331b86118d6))
* **scripts:** add human review tracker and change validation storage ([4813150](https://github.com/skyasu2/openmanager-ai/commit/481315048c46d22e8051dcb7a0d3e4d26bfc3b54))


### Bug Fixes

* **ai-engine:** address Codex review issues in context compression ([5af96d2](https://github.com/skyasu2/openmanager-ai/commit/5af96d2ca2d4305742c6b992617e4e2aaa42f484))
* **ai-engine:** use HumanMessage for Groq API compatibility ([5764c06](https://github.com/skyasu2/openmanager-ai/commit/5764c06a1501c333258db3d84005806aef2606be))
* **ai:** revert to DefaultChatTransport to fix protocol parsing ([e3ab409](https://github.com/skyasu2/openmanager-ai/commit/e3ab40967dd76684b7d509178650e5375f14c5d0))
* **ai:** TypeScript errors in stream parser and transport import ([8292442](https://github.com/skyasu2/openmanager-ai/commit/82924425063d015bfa1eff292c20cc652d403e84))
* **hooks:** swap WSL/Windows limited mode logic ([e842656](https://github.com/skyasu2/openmanager-ai/commit/e842656dfcdac4f365080652ef030f2efdf65f62))
* **scripts:** improve unreviewed commit detection in auto-ai-review (v6.13.0) ([b771a09](https://github.com/skyasu2/openmanager-ai/commit/b771a0993a2bc81c5da2a02ce14e0f5efee792d6))
* **skills:** update validation paths and script versions ([8a69c4e](https://github.com/skyasu2/openmanager-ai/commit/8a69c4e146baf64309b374a3cde4bd2909aec099))
* **stream:** add 'd:' and 'e:' prefix handling to Data Stream parser ([0358600](https://github.com/skyasu2/openmanager-ai/commit/0358600a437f4bd5f5c1c5b1bb0d8260bcf23242))
* **tooling:** add cross-platform Biome wrapper for WSL/Windows ([3ee4d59](https://github.com/skyasu2/openmanager-ai/commit/3ee4d59c4221bd8c21e25a58ea03fefc3e1d24f8))
* **ui:** revert ai transport to default ([e187efe](https://github.com/skyasu2/openmanager-ai/commit/e187efe82c13e2012b2d6010eff325c91b186c12))

### [5.83.9](https://github.com/skyasu2/openmanager-ai/compare/v5.83.8...v5.83.9) (2025-12-22)


### Features

* **api:** unified-stream 호환 프록시 및 마이그레이션 가이드 추가 ([0fb5346](https://github.com/skyasu2/openmanager-ai/commit/0fb5346bfc62e6364ec07af933acf5c2f0123d35))


### Bug Fixes

* **api:** Codex 리뷰 반영 - maxDuration 재수출 및 H1 일관성 수정 ([b63c392](https://github.com/skyasu2/openmanager-ai/commit/b63c3924ec593b7caaae775c9ec719daa6cef777))
* **cloud-run:** 환경변수 일관성 개선 및 시크릿 마운트 수정 ([88d3ad2](https://github.com/skyasu2/openmanager-ai/commit/88d3ad2c55732256e827926ee96b86d07b521cb0))
* **test:** MetricsProvider 테스트 개선 (Codex 리뷰 반영) ([c244487](https://github.com/skyasu2/openmanager-ai/commit/c24448758d3a45fc726892686964542fa7656612))

### [5.83.8](https://github.com/skyasu2/openmanager-ai/compare/v5.83.7...v5.83.8) (2025-12-21)


### Features

* **ai-ui:** add ChatGPT-style UX features to AI chat ([8fa0731](https://github.com/skyasu2/openmanager-ai/commit/8fa073190f0c3134b85422db91d57c936db397fa))
* **auth:** add Google OAuth login support ([b724c8b](https://github.com/skyasu2/openmanager-ai/commit/b724c8b7fbc8aa06ddeb0fbe403af6e7513f8fbb))
* **dashboard:** UI/UX 대대적 최적화 - 공간 효율성 향상 ([0bc85fe](https://github.com/skyasu2/openmanager-ai/commit/0bc85fee56ddba9e870c669a44793fd4f4b0ae28))
* **login:** 로그인 페이지 다크 슬레이트 디자인 적용 ([0488c82](https://github.com/skyasu2/openmanager-ai/commit/0488c82e6350e88f47d9d045ec103ee8e409c395))
* **rate-limit:** Cloud Run 무료 티어 최적화를 위한 일일 제한 추가 ([863cf20](https://github.com/skyasu2/openmanager-ai/commit/863cf201fe353cb27acb91ff536a84dcb9502a87))
* **rust-inference:** add feedback analysis API endpoints ([7ca161c](https://github.com/skyasu2/openmanager-ai/commit/7ca161c0438c5e781927d7147629c5c61311e37b))


### Bug Fixes

* **ai-tools:** nvm prefix 충돌 해소 로직 추가 ([2f9fca9](https://github.com/skyasu2/openmanager-ai/commit/2f9fca97671dd9fbe9f32bb691e723bab7d52e07))
* **dashboard:** Hydration 불일치 및 접근성 이슈 수정 ([1ac78ba](https://github.com/skyasu2/openmanager-ai/commit/1ac78baa818b351baf0e5735f6a7409365214c0b))
* **deps:** Biome Linux 전용 패키지를 devDependencies에서 제거 ([078923e](https://github.com/skyasu2/openmanager-ai/commit/078923ebcf47f92710b4b8ef627826ed7f4b6a5b))
* **EnhancedServerCard:** compact 모드 차트 레이아웃 개선 (4열→2열) ([f196c54](https://github.com/skyasu2/openmanager-ai/commit/f196c5406953573d9fd12f990d83ccef29ffbf7e))
* **modal:** 서버 상세 모달 콘텐츠 렌더링 버그 수정 ([8d7925f](https://github.com/skyasu2/openmanager-ai/commit/8d7925f0427e1248e59f6bd5575ed60778b3327f))
* **scripts:** 삭제된 subagent 스크립트 참조 제거 ([e076b16](https://github.com/skyasu2/openmanager-ai/commit/e076b16842f074ced36cbc1283c88f916c0e7ff0))
* **security:** improve API key masking in test scripts ([ac75cd6](https://github.com/skyasu2/openmanager-ai/commit/ac75cd6a50ebf9b81ca474d4a1f3841dde41bb3f))
* **security:** 테스트 파일 및 가짜 키 패턴 제외 ([578bae0](https://github.com/skyasu2/openmanager-ai/commit/578bae0ab5c4422f75daa9f2135ab6387bf39fde))
* **tests:** clean up failing tests and reorganize scripts ([156a9ce](https://github.com/skyasu2/openmanager-ai/commit/156a9ce2c23506252c736c0aea76f99d6a4c21bd))
* **test:** 테스트 키 길이 수정 및 스냅샷 업데이트 ([d3e10cc](https://github.com/skyasu2/openmanager-ai/commit/d3e10ccc6213f4d82d327ed41d14dffdc79c7ed5))
* **useSystemStart:** React 렌더링 규칙 준수하여 router.push 분리 ([77e98a1](https://github.com/skyasu2/openmanager-ai/commit/77e98a14fcea850bac74fa669f4eff3cab4d6f7b))

### [5.83.7](https://github.com/skyasu2/openmanager-ai/compare/v5.83.6...v5.83.7) (2025-12-19)


### Features

* **auth:** allow unauthenticated access to main page with login button ([fe72adc](https://github.com/skyasu2/openmanager-ai/commit/fe72adc5de130250156c183040795a8cb3360b00))
* **cloud-run:** add embedding and generate services to AI Engine ([21f37d1](https://github.com/skyasu2/openmanager-ai/commit/21f37d1ffdc9b4cef3a203f8a53a6414cd675f21))
* **proxy:** add automatic local Docker detection for development ([1fff5f8](https://github.com/skyasu2/openmanager-ai/commit/1fff5f8f799f2befac4af39a165f2bf23a53f0f1))
* **proxy:** improve local Docker priority in development mode ([819201e](https://github.com/skyasu2/openmanager-ai/commit/819201e4182cf103633347c91bfb2c72b1b21434))


### Bug Fixes

* **bootstrap:** prevent infinite polling loop in SystemBootstrap ([d427469](https://github.com/skyasu2/openmanager-ai/commit/d42746979481eebac1783f11d84b69bee2f32cd2))
* **dashboard:** correct invalid Tailwind CSS class w-22 to w-20 ([aa37bf5](https://github.com/skyasu2/openmanager-ai/commit/aa37bf583ea731896ccbc7cf1f3837c5afff11f7))
* **e2e:** update routing paths from /main to / in tests ([0adb64e](https://github.com/skyasu2/openmanager-ai/commit/0adb64e9b4ace26c0d3e422c7364fc5bae3f0815))
* **hydration:** resolve SSR/client HTML mismatch issues ([a6d5a61](https://github.com/skyasu2/openmanager-ai/commit/a6d5a61168b313fb98d6af19d0bab1f4fc54cc18))
* **routing:** update remaining /main references to / across codebase ([98eaa70](https://github.com/skyasu2/openmanager-ai/commit/98eaa707b4f0f6cb8c3000576b0291cdfe931f11))

### [5.83.6](https://github.com/skyasu2/openmanager-ai/compare/v5.83.5...v5.83.6) (2025-12-19)


### Features

* **docs:** generate Mermaid diagrams with mmdc CLI ([fedf33b](https://github.com/skyasu2/openmanager-ai/commit/fedf33bf8d43e81214c1b279d56ade83db28fe3f))
* implement Knowledge Externalization (Phase 1) ([638332c](https://github.com/skyasu2/openmanager-ai/commit/638332cb28981fa515de4564c05d271eacb68133))
* **rules:** implement Supabase integration (Phase 2) ([5faecd4](https://github.com/skyasu2/openmanager-ai/commit/5faecd4bb03978984f6e0963979694cc345ede6b))
* **skills:** add mermaid-diagram skill for architecture visualization ([142e263](https://github.com/skyasu2/openmanager-ai/commit/142e2634da729e0b4ee5d78dc3c0f2c48506924c))


### Bug Fixes

* **ai:** improve Reporter model type safety and add fallback ([e627c22](https://github.com/skyasu2/openmanager-ai/commit/e627c224c8296359eced78e5a00a9764ecdfc351))
* **docs:** correct broken documentation links ([e63e141](https://github.com/skyasu2/openmanager-ai/commit/e63e141bff2e77c9dd8fce77f39f1b2a8b4bd9e2))
* **e2e:** add waitFor to server card loading in guest test ([0ccaddc](https://github.com/skyasu2/openmanager-ai/commit/0ccaddc898460a443f3f4623a4fcc7b5f5ce1b95))
* **paths:** update remaining path references from docs reorganization ([69c0bb6](https://github.com/skyasu2/openmanager-ai/commit/69c0bb63bfaae8d3964351964c4325a18c83a355))
* remove unused imports and deprecated method ([1d1e7f6](https://github.com/skyasu2/openmanager-ai/commit/1d1e7f6d93e69a6a297a212a529dddf58eddc218))

### [5.83.5](https://github.com/skyasu2/openmanager-ai/compare/v5.83.4...v5.83.5) (2025-12-19)


### Features

* **auth:** add auth strategy utility for environment-based auth method ([51b41d4](https://github.com/skyasu2/openmanager-ai/commit/51b41d4a0e17057c45eb8a19f51a6e10544183bd))
* **claude-code:** add /review command and update skills ([ad41eef](https://github.com/skyasu2/openmanager-ai/commit/ad41eef17a9dbd7d2256fdd9efac24f6561de72d))
* **review:** add doc/test validation to AI review pipeline ([caaa2ab](https://github.com/skyasu2/openmanager-ai/commit/caaa2ab101d81bbbced0b6b9087f13604476bcf8)), closes [#5](https://github.com/skyasu2/openmanager-ai/issues/5)


### Bug Fixes

* **ai:** update Gemini models to 2.5 series for 2025 free tier ([72205ba](https://github.com/skyasu2/openmanager-ai/commit/72205ba6fd35ac2a6a221bb516f14856a8ba2393))
* **lint:** remove unused variables in dashboard-server-cards.spec.ts ([8c77dd3](https://github.com/skyasu2/openmanager-ai/commit/8c77dd382fab5537d7ccc6c9910d2c96f50fd090))
* **scripts:** update path reference to reports/planning ([d3c24eb](https://github.com/skyasu2/openmanager-ai/commit/d3c24eb91a0ce5df73a090ddf4c601bbcecc7a64))
* **skill:** improve playwright-triage script robustness ([b2257bc](https://github.com/skyasu2/openmanager-ai/commit/b2257bc6bf5978a51469e36266a593d818a73962))

### [5.83.4](https://github.com/skyasu2/openmanager-ai/compare/v5.83.3...v5.83.4) (2025-12-18)


### Features

* **rag:** add BM25 text search for hybrid Vector + Text + Graph RAG ([7f44d34](https://github.com/skyasu2/openmanager-ai/commit/7f44d34bc88048a5a54d4442f1d70179d0e1cf92))


### Bug Fixes

* **auth:** consume sessionStorage redirect target in OAuth callback ([67a7681](https://github.com/skyasu2/openmanager-ai/commit/67a7681c245e833f2dd26d982bb142e3d599347b))
* **auth:** enhance PKCE error handling and add RAG table compatibility ([b93482f](https://github.com/skyasu2/openmanager-ai/commit/b93482f18235686fe30b7f4d9ac94205c38a16ff))
* **auth:** resolve OAuth fetch error and guest login cookie issues ([b4e1286](https://github.com/skyasu2/openmanager-ai/commit/b4e1286da8d6b1c9c3af48f7c13b9d11814a5a01))
* **dashboard:** add SVG mini charts to compact mode server cards ([29281ab](https://github.com/skyasu2/openmanager-ai/commit/29281ab74bf7229684409a9c64dc838572276d25))
* **migration:** sync BM25 text search with deployed DB fixes ([a9e19d1](https://github.com/skyasu2/openmanager-ai/commit/a9e19d1b31ac3795ca70c8a8d8dabb94e8541085))
* **migration:** sync BM25 text search with deployed DB fixes ([d2c5888](https://github.com/skyasu2/openmanager-ai/commit/d2c5888648be4830c90d8f1f82a297bd8e66b90b))
* resolve code review issues from AI review ([6f917d5](https://github.com/skyasu2/openmanager-ai/commit/6f917d5c561ff216f0a57439261cef58a25ff4a0))

### [5.83.3](https://github.com/skyasu2/openmanager-ai/compare/v5.83.2...v5.83.3) (2025-12-17)


### Features

* **code-interpreter:** add browser-based Python execution ([24ce68c](https://github.com/skyasu2/openmanager-ai/commit/24ce68c34508fe9ccf653876d3a4cf98506f74f1))
* **rag:** implement GraphRAG hybrid search with knowledge graph ([c96e4dd](https://github.com/skyasu2/openmanager-ai/commit/c96e4dd785b80d439016c34698ddd511a10a819f))

### [5.83.2](https://github.com/skyasu2/openmanager-ai/compare/v5.83.1...v5.83.2) (2025-12-17)


### Features

* **ai:** add Circuit Breaker event system and AI management UI ([252b9c7](https://github.com/skyasu2/openmanager-ai/commit/252b9c7e435ad0864aa0d0de189d2663f2f3c757))
* improve metrics hook UX and add log analysis to NLQ agent ([e2ddebf](https://github.com/skyasu2/openmanager-ai/commit/e2ddebfd5a90bc23b54706631fa9ad3fdf0346cc))
* **review:** add small change filter to AI code review ([5005e8b](https://github.com/skyasu2/openmanager-ai/commit/5005e8b4b97378669268663a21d0b1c309648c09))


### Bug Fixes

* **cloud-run:** restore getPatternInsights helper function ([fcbd39c](https://github.com/skyasu2/openmanager-ai/commit/fcbd39c0c68fe94b486aaa558315dbfcf7ffa23e))
* **inspection:** resolve all issues from 2025-12-18 inspection ([bc04204](https://github.com/skyasu2/openmanager-ai/commit/bc04204f59631003465fba76bd0dfe20caad891d))

### [5.83.1](https://github.com/skyasu2/openmanager-ai/compare/v5.83.0...v5.83.1) (2025-12-17)


### Bug Fixes

* apply AI code review improvements ([e76e7f5](https://github.com/skyasu2/openmanager-ai/commit/e76e7f577338b7523bad1125a3da30ae19bf281e))
* remove duplicate .versionrc causing config conflict ([3432de2](https://github.com/skyasu2/openmanager-ai/commit/3432de254adf97289c14b61f6470e094f481d5bf))

## [5.83.0](https://github.com/skyasu2/openmanager-ai/compare/v5.82.0...v5.83.0) (2025-12-17)


### Features

* Add Jules CLI wrapper and Cloud Run AI engine deployment ([01fce0b](https://github.com/skyasu2/openmanager-ai/commit/01fce0b4f621fa296eab0314f43ecb2a280ff4f6))
* **ai:** add Cloud Run status indicator with warmup support ([57829ec](https://github.com/skyasu2/openmanager-ai/commit/57829ec6c1bcb55c5c350030f53fd5b48c464ec5))
* **ai:** Migrate AI engine to Google Cloud Run and update related docs ([b44f7f2](https://github.com/skyasu2/openmanager-ai/commit/b44f7f23be21d46718e4ff005d1df87dc5418401))
* **cloud-run:** add Rust ML inference service for LangGraph support ([6d3605d](https://github.com/skyasu2/openmanager-ai/commit/6d3605da9e39b3f950b0813e840fb085fdce1107))
* **hitl:** add shared types and approval-store tests ([ba95d33](https://github.com/skyasu2/openmanager-ai/commit/ba95d3357a6929af2f5894d365ff2192324ad078))
* **hitl:** implement SSE-based Human-in-the-Loop approval system ([194702a](https://github.com/skyasu2/openmanager-ai/commit/194702a1adf4c28dc9cd4434f066c28214ca816b))
* implement zero-internal-traffic architecture with supabase rag ([c46c091](https://github.com/skyasu2/openmanager-ai/commit/c46c0918b5ae76d4077e98b64e651f40abb22440))
* **infra:** migrate AI Engine to Cloud Run & integrate with Vercel ([0b23e9f](https://github.com/skyasu2/openmanager-ai/commit/0b23e9f9c3f5a0ccffe91a87c27ab703ef340c1d))
* **langgraph:** implement A2A communication patterns for multi-agent system ([cfe8df9](https://github.com/skyasu2/openmanager-ai/commit/cfe8df9f804fff7f3a0ef411fd1729a9ac3caf85))
* **langgraph:** integrate Rust ML service with TypeScript fallback ([584d9bd](https://github.com/skyasu2/openmanager-ai/commit/584d9bd68bfea4fa84f6c279d44298aaba4b69e2))
* optimize AI supervisor route and guest mode config ([3502bc3](https://github.com/skyasu2/openmanager-ai/commit/3502bc39210138ef8001b0c563b76a1041dbccde))
* **rag:** implement P1 knowledge base RAG for reporter agent ([0365bba](https://github.com/skyasu2/openmanager-ai/commit/0365bba6eea81cf887aab66538a7fa300f1ac872))
* **rust-ml:** add clustering endpoint and docker-compose setup ([8971708](https://github.com/skyasu2/openmanager-ai/commit/8971708367fd5e3b1694678b138ddbcb2432d5e1))
* **rust-ml:** deploy clustering endpoint to Cloud Run ([55e5011](https://github.com/skyasu2/openmanager-ai/commit/55e501124daab4d63e9d933784e059e86101f135))
* **session:** add session message limit (20) for free tier protection ([91743cc](https://github.com/skyasu2/openmanager-ai/commit/91743cc693335c0ef512b5a102e5a2e904e102c3))


### Bug Fixes

* **ai:** change streaming Content-Type to text/event-stream for AI SDK compatibility ([c1f4353](https://github.com/skyasu2/openmanager-ai/commit/c1f4353000b554f4b1e6e7f6a13ed109feefa819))
* **ai:** fix Accept header check for AI SDK v5 DefaultChatTransport ([be1a72d](https://github.com/skyasu2/openmanager-ai/commit/be1a72d5f3b4ff7b04de6301d0f998835e96c9f8))
* **ai:** implement AI SDK v5 Data Stream Protocol for streaming responses ([4cfe126](https://github.com/skyasu2/openmanager-ai/commit/4cfe1267da7042d77cde653b95c3b074818812c8))
* **ai:** implement AI SDK v5 Data Stream Protocol for streaming responses ([d68fa1c](https://github.com/skyasu2/openmanager-ai/commit/d68fa1cc703d611dafbb87a467cb74098ed14387))
* **ai:** Resolve remaining issues from AI engine migration ([3802f0d](https://github.com/skyasu2/openmanager-ai/commit/3802f0d513d2019519e507001dcc0980f4c7b182))
* **ai:** support AI SDK v5 UIMessage format in unified-stream API ([d18023c](https://github.com/skyasu2/openmanager-ai/commit/d18023cfb859c93fcb7c324b819f09c7763f9a29))
* **ai:** use GEMINI_API_KEY_PRIMARY for Vercel production compatibility ([dcc7546](https://github.com/skyasu2/openmanager-ai/commit/dcc75464440c644a2298d81fb23d5ac77343166c))
* Apply Biome lint fixes and line ending normalization ([4d11f56](https://github.com/skyasu2/openmanager-ai/commit/4d11f56ff3471b3dce6889aa6419171cc9a559d6))
* Clean up unused imports ([c4549c5](https://github.com/skyasu2/openmanager-ai/commit/c4549c58d99372f16e805edd210c8f717b6e1e48))
* Correct component props for MonitoringWorkflow and MonitoringResults ([fce6a72](https://github.com/skyasu2/openmanager-ai/commit/fce6a7215af24ee0d27dc8453309159eabf2574f))
* Correct IntelligentAnalysisRequest property name ([2472aa2](https://github.com/skyasu2/openmanager-ai/commit/2472aa251deeede2dde5d433e717bf816b73a838))
* **hitl:** resolve session ID mismatch between Frontend and Cloud Run ([cea5e01](https://github.com/skyasu2/openmanager-ai/commit/cea5e01d8e37138867a0647888a89d269cac8307))
* **langgraph:** add finish message on streaming error for AI SDK v5 protocol compliance ([4f159d4](https://github.com/skyasu2/openmanager-ai/commit/4f159d4a15c7aa191ec27fb1d0940e4e013da16d))
* **langgraph:** change supervisor model from Groq to Gemini ([2997cf3](https://github.com/skyasu2/openmanager-ai/commit/2997cf3853177040ffdbe20a7d417f7ef20f24ff))
* **langgraph:** support POSTGRES_URL_NON_POOLING for Vercel PostgreSQL ([a126390](https://github.com/skyasu2/openmanager-ai/commit/a126390116d9123360f84982210c838a64459c7d))
* **rag:** add error handling for Supabase client init (Codex review) ([405daac](https://github.com/skyasu2/openmanager-ai/commit/405daacfcc8d089176995bf79fb5e8ce9a0c8e78))
* Remove unused imports in AnalysisTab ([05752b6](https://github.com/skyasu2/openmanager-ai/commit/05752b63951d28640657d72613874a1f1ad9919e))
* Remove unused variables in AnalysisTab ([9ddb2aa](https://github.com/skyasu2/openmanager-ai/commit/9ddb2aabf6e71050c247736bf00659a58dbafbd0))
* Replace MonitoringWorkflow with simple button ([6accc48](https://github.com/skyasu2/openmanager-ai/commit/6accc4894cab8cd38acd3bb867c31cea343adfc9))
* Resolve TypeScript and lint warnings ([732d058](https://github.com/skyasu2/openmanager-ai/commit/732d0580a00a5a3c176e237a6b4d05b1218e23c4))
* resolve TypeScript build errors for Gemini 2.5 migration ([3ec952e](https://github.com/skyasu2/openmanager-ai/commit/3ec952e86f2fa651f87e1167daf1988c163b56f2))
* **rust-ml:** use get_mut for safe array access (Qwen review) ([33f86a8](https://github.com/skyasu2/openmanager-ai/commit/33f86a81f937772b84a82be7ab048afd2167cb22))
* Use correct IntelligentAnalysisRequest interface ([986a01e](https://github.com/skyasu2/openmanager-ai/commit/986a01e6a8b1bc135157b98fc6d68475acff449a))
* **vercel:** use absolute path for cloud-run ignore ([b5ceabc](https://github.com/skyasu2/openmanager-ai/commit/b5ceabc13a248661d4928b7f6b1eeda26ffa5831))
* **version:** sync API version to 5.82.0 and Next.js 16.0.10 ([7b72a9f](https://github.com/skyasu2/openmanager-ai/commit/7b72a9ff218c3ba31ce53af9519f89df1d137611))

## [5.82.0](https://github.com/skyasu2/openmanager-ai/compare/v5.81.0...v5.82.0) (2025-12-14)


### 🚀 Features

* **code-review:** add semantic version recommendation to AI review reports ([dcede29](https://github.com/skyasu2/openmanager-ai/commit/dcede290d5b7286892d8ae07b05e832d376e9b94))


### 📚 Documentation

* complete script consolidation Phase 3-4 (72% reduction) ([93cf1c0](https://github.com/skyasu2/openmanager-ai/commit/93cf1c0be52c3dd113b0e5b6b041a9507aab2449))


### 🐛 Bug Fixes

* **code-review:** add word boundary and colon to BREAKING pattern (v6.9.3) ([c66fc15](https://github.com/skyasu2/openmanager-ai/commit/c66fc154a32c81da1e1057a7b6ede1f7fbb7f11c))
* **code-review:** correct BREAKING change detection pattern (v6.9.2) ([84d2cf2](https://github.com/skyasu2/openmanager-ai/commit/84d2cf26d0d4a231658586426ca611221ae24428))


### ♻️ Refactoring

* **code-review:** remove version recommendation, add to CLAUDE.md (v7.2.0) ([1dad3ee](https://github.com/skyasu2/openmanager-ai/commit/1dad3eea53412f537265476f7dbe4838d3d29454))
* **code-review:** simplify version recommendation to one-line (v7.1.0) ([d2b9f80](https://github.com/skyasu2/openmanager-ai/commit/d2b9f80901822941ad5fddadee5ac9b152bc512e))

## [5.81.0](https://github.com/skyasu2/openmanager-ai/compare/v5.80.0...v5.81.0) (2025-12-14)


### 👷 CI/CD

* GitHub Actions를 Biome으로 마이그레이션 ([aa58862](https://github.com/skyasu2/openmanager-ai/commit/aa588626b1699a4fa96da9c20b9e687ce78d2363))
* Rollup binary 이슈 및 Lint 타임아웃 개선 ([d4fe99c](https://github.com/skyasu2/openmanager-ai/commit/d4fe99cc7029187f89dd1529eade415ae5b28838))


### ⚡ Performance

* **cache:** SWR 비활성화 - Vercel Function 호출 최적화 ([7eeaffa](https://github.com/skyasu2/openmanager-ai/commit/7eeaffa00f6d283b90e73cdc73fd58dcb4a965fd))
* **dashboard:** change EnhancedServerCard update interval to 5 minutes ([4d4304d](https://github.com/skyasu2/openmanager-ai/commit/4d4304dfbe6dbdb562db829cd375d46bf892e8a9))
* **health:** AI Health Check 최적화 (SSE 5분 주기 + 60초 캐싱) ([1963cc3](https://github.com/skyasu2/openmanager-ai/commit/1963cc3b0f9e3ef452783a1c768f794374eca735))
* **hooks:** optimize QUICK_PUSH mode to skip Biome lint ([e57bab8](https://github.com/skyasu2/openmanager-ai/commit/e57bab8c69db3d319dbdfbf904329a1f80076cd4))
* **hooks:** remove 5s wait in doc-validation & optimize pre-push ([78a83c0](https://github.com/skyasu2/openmanager-ai/commit/78a83c0c958a7e3533dce6006221ddf86924fcec))
* **hooks:** useResponsivePageSize에 debounce 적용 (150ms) ([c53d930](https://github.com/skyasu2/openmanager-ai/commit/c53d930c24863c7e0e3a1401c103698fdbcb3d9c))
* **lint:** optimize ESLint/lint-staged for WSL2 performance ([2236546](https://github.com/skyasu2/openmanager-ai/commit/2236546a10dbcfdfea91799d592cdad24eab00f7))
* Phase 4.1 bundle optimization complete - all pages < 500KB ([64f2e96](https://github.com/skyasu2/openmanager-ai/commit/64f2e96d149a40b6d5d425db39ab3e05fc012c70))
* prevent GuestMode excessive console logging ([e4f00e1](https://github.com/skyasu2/openmanager-ai/commit/e4f00e1b25eca6dcc50813a4d661f44483cfb95c))


### ✅ Testing

* **ai:** update AI engine tests for v4.0 UNIFIED mode ([eff9b94](https://github.com/skyasu2/openmanager-ai/commit/eff9b940bfd8d28a548575b3fe8e6f716c4c6f6c))
* **api:** update core-endpoints integration test ([f29380a](https://github.com/skyasu2/openmanager-ai/commit/f29380aac72aac0e1661574c3f7386112b4725a3))
* **components:** update component unit tests for React 19 ([2a1d2c2](https://github.com/skyasu2/openmanager-ai/commit/2a1d2c2e537912195ab221bd06a89c930c06b454))
* **e2e:** add comprehensive dashboard E2E tests (4 phases) ([763951f](https://github.com/skyasu2/openmanager-ai/commit/763951fe8548efeee840fb5a22f3aeef605b7d66))
* **e2e:** add Feature Cards comprehensive E2E tests ([5bca5e1](https://github.com/skyasu2/openmanager-ai/commit/5bca5e174f512aedd43ba2225a8c1fd060343cdf))
* **e2e:** add system-boot and error-boundary test suites ([cc42a42](https://github.com/skyasu2/openmanager-ai/commit/cc42a423e8908be1aed04047aad9f16e665acb0f))
* **e2e:** AI 사이드바 종합 검증 테스트 추가 ([e6b5b60](https://github.com/skyasu2/openmanager-ai/commit/e6b5b608b7b0f33349014ea2078550609d3b74e9))
* **e2e:** fix E2E test assertions and selectors ([eb5fa50](https://github.com/skyasu2/openmanager-ai/commit/eb5fa506f2deb77db36cf03556736a1ae6cd989c))
* **e2e:** fix Feature Cards test alignment with rendered data ([4333c05](https://github.com/skyasu2/openmanager-ai/commit/4333c05dcc5b0f53310556117176211022226b1e))
* **hooks/services:** update unit tests for state management refactor ([2b5b9c1](https://github.com/skyasu2/openmanager-ai/commit/2b5b9c13603a813bca4db1f442646ed6f890bb2b))
* **integration:** update integration tests for LangGraph API ([e23a69e](https://github.com/skyasu2/openmanager-ai/commit/e23a69e6ecf0d0f592bef41d5eadc137827f2ab8))
* reorganize and clean up test files ([a1e955d](https://github.com/skyasu2/openmanager-ai/commit/a1e955dd281540a099f9512711a39b756cef3930))
* update AI component test mocks ([6df0214](https://github.com/skyasu2/openmanager-ai/commit/6df0214d3c6c33dba90d9adfbc5d74264966c19e))
* update and reorganize unit tests ([790b4cd](https://github.com/skyasu2/openmanager-ai/commit/790b4cd8700a34665d16b651c0bd5e1a59207f18))
* **v4.0:** useAIEngine Hook 테스트 완전 재작성 (UNIFIED 전용) ([b2a1e44](https://github.com/skyasu2/openmanager-ai/commit/b2a1e44bb5309838144f181ffb81a7c0ada977c7))


### ♻️ Refactoring

* **agents:** optimize subagents for project stack (11→9) ([7e5a6d6](https://github.com/skyasu2/openmanager-ai/commit/7e5a6d6898b7fa537023c4fab59deffb5036088a))
* **ai-review:** v5.0.0 모듈화 구조로 리팩토링 (Codex 8/10→10/10) ([b1ddf56](https://github.com/skyasu2/openmanager-ai/commit/b1ddf56ef235a9e0721c256770d1d51c063818f3))
* **ai:** AI insights API 및 미사용 컴포넌트 정리 ([87aaab3](https://github.com/skyasu2/openmanager-ai/commit/87aaab3d1c230f95c9488da30ecfdf467434f121))
* **ai:** AIWorkspace v3.0.0 Unified Streaming + 레거시 정리 ([6ca2b12](https://github.com/skyasu2/openmanager-ai/commit/6ca2b127757b249e323ca3436e8ff946d7049cc2))
* **ai:** AIWorkspace 전체 리팩토링 완료 ([3bd07f6](https://github.com/skyasu2/openmanager-ai/commit/3bd07f66f5ef6e1a38bfa33e1ddda25dc05c9bb2)), closes [#1e1e1](https://github.com/skyasu2/openmanager-ai/issues/1e1e1)
* **ai:** archive deprecated AISidebarV3 component ([0c3ef3d](https://github.com/skyasu2/openmanager-ai/commit/0c3ef3db8216bec8b8e78b957255a2bf5f3befa0))
* **ai:** enhance interaction logging + biome fixes ([257c657](https://github.com/skyasu2/openmanager-ai/commit/257c6575450258e9f2d0022e4c592fda13fa5f17))
* **ai:** IntelligentMonitoringPage 컴포넌트 분할 및 최적화 ([96d591d](https://github.com/skyasu2/openmanager-ai/commit/96d591d5cc57b229f55f2e28dee8e877351db092))
* **ai:** optimize ai engine and gcp integration ([9fd88df](https://github.com/skyasu2/openmanager-ai/commit/9fd88df6b71bc001897c29dc4f01fe4867aa3203))
* **ai:** remove legacy AI services and routing engine ([63b4261](https://github.com/skyasu2/openmanager-ai/commit/63b42614a0795b41038ed82f29c6ce78e957099a))
* **api:** remove legacy ai apis (phase 21.1) ([f76ed20](https://github.com/skyasu2/openmanager-ai/commit/f76ed201d13c3827736f5079f149d3554f16ac8c))
* **api:** remove legacy ai apis (phase 21.1) ([4c0518f](https://github.com/skyasu2/openmanager-ai/commit/4c0518f2b662b9dfda7d496f5caf6fbb40b9bd6e))
* **api:** remove unused ServerStatus import and SupabaseServer interface ([bc6ee1a](https://github.com/skyasu2/openmanager-ai/commit/bc6ee1af103db18743eb85d3486cb572dfa72abc))
* **archive:** Remove archive reference to ensure independence ([a9ec6f0](https://github.com/skyasu2/openmanager-ai/commit/a9ec6f0fd65af6823be66636f70dffe368ff47cf))
* **biome:** enforce noExplicitAny in src/, fix all lint errors ([d122a79](https://github.com/skyasu2/openmanager-ai/commit/d122a794420c27732b8f44536a74a017f166f6a2))
* **biome:** resolve 9 actionable warnings (17→8) ([60f5a39](https://github.com/skyasu2/openmanager-ai/commit/60f5a39b61f71f467382defe631afac71316d930))
* **boot:** 순수 타이머 기반 로딩으로 단순화 ([2fb84a8](https://github.com/skyasu2/openmanager-ai/commit/2fb84a8392f74f0f97995471b5bab7711e3d1932))
* **ci:** Gemini AI 리뷰 제안 반영 - 성능 및 가독성 개선 ([4488247](https://github.com/skyasu2/openmanager-ai/commit/44882473d999edb14c13f4bf273d3eb3c4c22c3d))
* clean up code and update documentation ([dc1b875](https://github.com/skyasu2/openmanager-ai/commit/dc1b8756652592a7c929d7acd189318375f4793e))
* cleanup legacy code and redundant types ([421854c](https://github.com/skyasu2/openmanager-ai/commit/421854c2bd72dfb449c6bf72fa80280fa67d0ece))
* cleanup packages, remove eslint, and sync docs ([2d8c8bb](https://github.com/skyasu2/openmanager-ai/commit/2d8c8bb54881179bc0e371f727f67937263ae474))
* **cleanup:** delete 21 unused component/hook files (~4700 lines) ([6d0e826](https://github.com/skyasu2/openmanager-ai/commit/6d0e8264bb0a73a46ea2b3806bf259fb844d0d9f))
* **cleanup:** remove 15 unused AI components and duplicate pages ([071b206](https://github.com/skyasu2/openmanager-ai/commit/071b206dda05662650ddfc91a0c863947493eff5))
* **cleanup:** 레거시 메트릭 생성 스크립트 아카이브 ([a146669](https://github.com/skyasu2/openmanager-ai/commit/a146669dc18cab641ef3af6c7679b6b937cb165b))
* **cleanup:** 코드 품질 개선 (import 정리, ESLint 수정, 테스트 개선) ([5909ee2](https://github.com/skyasu2/openmanager-ai/commit/5909ee2e457b3ef693b7f538feb6dd0e666bb555))
* **code-review:** simplify fallback to 1-retry + deferred compensation ([149b621](https://github.com/skyasu2/openmanager-ai/commit/149b62197bc52dd925df757ffc68156d75643473))
* **code-review:** v6.9.2 - handle_review_success() 헬퍼 함수 추출 ([d0c5d0b](https://github.com/skyasu2/openmanager-ai/commit/d0c5d0b8d7223d13e0e3676c1347c4911a7a811b))
* **components:** extract FullScreenLayout from auth components ([90d02f3](https://github.com/skyasu2/openmanager-ai/commit/90d02f380cc098ed7065b7e4d497b3920adf7229))
* **dashboard:** DashboardClient 유틸리티 분리 및 디버그 코드 정리 ([bfab300](https://github.com/skyasu2/openmanager-ai/commit/bfab30096b9dbd2144be617293921c084f26f5ef))
* **dashboard:** simplify server components, remove over-engineering ([c3fa843](https://github.com/skyasu2/openmanager-ai/commit/c3fa8434881bcbe0de7921c31e4d051675d9f063))
* **dashboard:** 정적 분석 기반 대시보드 코드 개선 ([dfa27df](https://github.com/skyasu2/openmanager-ai/commit/dfa27dfd7bf2a11946fcd40bee4093adf52e0b44))
* **data:** UnifiedServerDataSource 대폭 단순화 (scenario-loader 전용) ([4cbd049](https://github.com/skyasu2/openmanager-ai/commit/4cbd049c80ff1e159c4952a18e16ca3cf8fbb96d))
* **docs:** archive 12 analysis/report files (500+ lines) ([3fd2674](https://github.com/skyasu2/openmanager-ai/commit/3fd267447e44be99847f5f8ac4862b9df1051133))
* **docs:** archive large reports + remove 9 more duplicates ([5e8ca29](https://github.com/skyasu2/openmanager-ai/commit/5e8ca29512329a30d49225acbacbd9a275918e7e))
* **docs:** consolidate GCP docs to platforms/gcp/ ([1d832ee](https://github.com/skyasu2/openmanager-ai/commit/1d832ee16b5eb114079024121677d22f7e57ab89))
* **docs:** move legacy reports to archive (27 files) ([f8b536e](https://github.com/skyasu2/openmanager-ai/commit/f8b536e7e61920c4f1a5abafa68df78265300d98))
* **docs:** remove 5 duplicate files ([f9c8792](https://github.com/skyasu2/openmanager-ai/commit/f9c879220fa1ae2a68d9d5fdb33a407db636cea6))
* **docs:** remove duplicate folders (Phase 5 cleanup) ([9df84dc](https://github.com/skyasu2/openmanager-ai/commit/9df84dccdace9fb3c1e4e0d5e22cd66320e802a3))
* **docs:** WSL \ubcf5\uc6d0 \uac00\uc774\ub4dc \uac1c\uc120 - \ucf54\ub4dc \ub9ac\ubdf0 \uc81c\uc548 \ubc18\uc601 ([f5934b3](https://github.com/skyasu2/openmanager-ai/commit/f5934b31e6d4e55b0fc6bf38437684ddd953e734))
* **docs:** WSL 복원 가이드 최종 개선 - Gemini 추가 제안 100% 반영 ([362e97f](https://github.com/skyasu2/openmanager-ai/commit/362e97f2e17373557e5a4322c66765996ad31add))
* **e2e:** extract security helpers and use test.skip pattern ([cd95877](https://github.com/skyasu2/openmanager-ai/commit/cd95877d12600f7fc2ad9e8c1bdb11c2cb5313d7))
* **error:** consolidate ServerCardErrorBoundary to single source ([f2b0188](https://github.com/skyasu2/openmanager-ai/commit/f2b0188600a0916ea09ca9f07d5243255ba9ed6c))
* **frontend:** improve CSP config and clean up CSS ([d0cb782](https://github.com/skyasu2/openmanager-ai/commit/d0cb782d3f94bdb8912bea7478d552b34074e3ed))
* GCP Functions 통합 + Tailwind gradient 문법 수정 ([f9700a6](https://github.com/skyasu2/openmanager-ai/commit/f9700a6348421dc7cc2bdf7820023375c16ba7d5))
* **hooks:** remove fake subagent checks (not actual Claude AI) ([5e3155e](https://github.com/skyasu2/openmanager-ai/commit/5e3155e7eb5a74d39c3e3d78da88a0eef90b3a80))
* **lint:** move ESLint from pre-push to post-commit only ([21c517c](https://github.com/skyasu2/openmanager-ai/commit/21c517c2705d2e347c00c4625cf1df3882c445c0))
* **login:** simplify button UI and restore cursor-pointer ([4487a96](https://github.com/skyasu2/openmanager-ai/commit/4487a96897f45cf8e9a67c76dfe309f6378a1021))
* **main:** 메인 페이지 리팩토링 - 568줄 → 300줄 (47% 감소) ([0ebb7f8](https://github.com/skyasu2/openmanager-ai/commit/0ebb7f83ce368fa055e0671ca724b6a4f39480f0))
* **mcp:** implement SSOT for MCP server configuration ([e5f8139](https://github.com/skyasu2/openmanager-ai/commit/e5f8139d053e38f117170fe2b4b2a76ef0d4aff8))
* **metrics:** 5분 갱신 주기 적용 + 구버전 문서 정리 ([a55f99c](https://github.com/skyasu2/openmanager-ai/commit/a55f99c3017b87c6b8df4678850f633536fcf00d))
* migrate middleware.ts to proxy.ts (Next.js 16) ([9ec880e](https://github.com/skyasu2/openmanager-ai/commit/9ec880e02bf0bba3406723e8b9bf155fd6fb0c58))
* **migrations:** reorganize pgvector migration files ([6f2c5c5](https://github.com/skyasu2/openmanager-ai/commit/6f2c5c51c8555876921a1d6c8ad5cf7ea4f6f29d))
* modularize supabase-rag-engine.ts ([808b2c6](https://github.com/skyasu2/openmanager-ai/commit/808b2c6cc3f0118042afaa0bb535d42b7acd6660))
* **rag:** add searchWithContext method to SupabaseRAGEngine ([b8b8d61](https://github.com/skyasu2/openmanager-ai/commit/b8b8d61ddce94eead7dd93917c8d0b33967c4741))
* remove GCP Functions client code and mock handlers ([32a9ea6](https://github.com/skyasu2/openmanager-ai/commit/32a9ea6df2e473b95c5b4efe711751f3bc56731a))
* remove legacy code and unused files ([c990b14](https://github.com/skyasu2/openmanager-ai/commit/c990b140c0a55d514fe8a8e3137d59fdb2aca722))
* simplify Dashboard and ServerModal, remove over-engineering ([eb8996a](https://github.com/skyasu2/openmanager-ai/commit/eb8996ac338e84cce4b5b0cefec72d23b21df371))
* **skills:** align Claude Code skills with tech stack upgrade ([4731019](https://github.com/skyasu2/openmanager-ai/commit/473101938c7880ed4b98eaab153057345f97af3d))
* split useServerDashboard.ts into types, utils, and hooks ([25d99a0](https://github.com/skyasu2/openmanager-ai/commit/25d99a05759f13f77a34c0ca2c9182774eda9116))
* **store:** simplify state management architecture ([e626d65](https://github.com/skyasu2/openmanager-ai/commit/e626d65e9b1177255db66e72a208d7ce06c21758))
* streamline state management and component imports ([1b17fbe](https://github.com/skyasu2/openmanager-ai/commit/1b17fbe1bb9fc2d8ac75a9f98bece676b3ce0052))
* **subagents:** optimize 8 subagent configs with best practices ([44bc935](https://github.com/skyasu2/openmanager-ai/commit/44bc93517703288f7c0b57b17a7b8292ff256ef5))
* **test:** improve AI engine test type safety (Gemini review fixes) ([014f53c](https://github.com/skyasu2/openmanager-ai/commit/014f53c9feb83c9e5e81838bc9c61f1363648124))
* **test:** openAiSidebar 에러 메시지 개선 (Qwen 리뷰 반영) ([7b7afd4](https://github.com/skyasu2/openmanager-ai/commit/7b7afd415f11c14c22bb4b2efd6129f5b4b36bff))
* **test:** openAiSidebar 에러 메시지 완전 개선 (Claude 리뷰 반영) ([01e9122](https://github.com/skyasu2/openmanager-ai/commit/01e9122862bfcfa4f66cb840cd9264c804f14917))
* **types:** extract shared types for AI Query API responses (Codex 8/10→10/10) ([8bbdd8e](https://github.com/skyasu2/openmanager-ai/commit/8bbdd8e15af1303592031e0802cb1114c6c73762))
* **ui:** GitHub 로그인 메뉴 description 제거 ([1205384](https://github.com/skyasu2/openmanager-ai/commit/1205384fefa6d0c58cd96d68cae2ba808cdf92e4))
* **utils:** 유틸리티 함수 중복 제거 및 구조 개선 ([5554db6](https://github.com/skyasu2/openmanager-ai/commit/5554db665869d19d72b53221438b76f6be4d050c))
* **validators:** use Zod v4 coerce API for paginationQuerySchema ([6dceaff](https://github.com/skyasu2/openmanager-ai/commit/6dceaff0034d9b00b6f721d5a6c6153aa05eb23f))
* **workflow:** separate validation into background post-commit ([22462dd](https://github.com/skyasu2/openmanager-ai/commit/22462dd7749543f85c54b95b7edc53abb87dd5d4))
* 대규모 코드 정리 및 문서 자동화 시스템 구축 ([799e3a1](https://github.com/skyasu2/openmanager-ai/commit/799e3a1b483992490ae38a3ea89cc91f370d667f))
* 타입 정리 및 불필요한 import 제거 ([28075a9](https://github.com/skyasu2/openmanager-ai/commit/28075a9f67f326ccad1c502121c9c39474f45b7a))


### 🐛 Bug Fixes

* **a11y:** improve LoginClient accessibility for WCAG 2.1 AA compliance ([3cdb97e](https://github.com/skyasu2/openmanager-ai/commit/3cdb97e6ef056247e210de9daab5c17936f91cac))
* **a11y:** restore keyboard focus visibility and debugging context ([375f571](https://github.com/skyasu2/openmanager-ai/commit/375f571224bfaedf220041fe7fdfc34212996a50))
* add defensive null guards for services and log.source ([74b8c87](https://github.com/skyasu2/openmanager-ai/commit/74b8c876cb75a6c42125e072bb513815b0a03261))
* add shebang to pre-push hook ([55f402f](https://github.com/skyasu2/openmanager-ai/commit/55f402f387edf370f25c5a95c78435002faf7c43))
* **ai-review:** AI_ENGINE 변수 전파 버그 수정 (v5.0.1) ([b273be7](https://github.com/skyasu2/openmanager-ai/commit/b273be7a4116458371afac73a40e927d65b36771))
* **ai-review:** wrapper 스크립트 실행 시 bash 명시적 사용 ([f8e33d8](https://github.com/skyasu2/openmanager-ai/commit/f8e33d871c5cbcc6900e596e7a147012e9d8ba0a))
* **ai:** AISidebarV4 useChat import 경고 완전 해결 ([9e06008](https://github.com/skyasu2/openmanager-ai/commit/9e060082266e87f4bec9aa4cd9b23360ce68c826))
* **ai:** Zod v4 + pdf-parse v3 compatibility updates ([cb56d82](https://github.com/skyasu2/openmanager-ai/commit/cb56d82fc6b7080e27df3bf81b9cea578360aa4c))
* **api:** apply Zod v4 ESM import pattern ([1b1b4bd](https://github.com/skyasu2/openmanager-ai/commit/1b1b4bd7c933c634f9f69c5d5b997ec268986046))
* **api:** migrate dashboard API from /servers/all to /servers-unified ([cff3bb0](https://github.com/skyasu2/openmanager-ai/commit/cff3bb0c3b7f4e124ca580b0642297a7c00e0d1f))
* **api:** update raw-metrics path to use hourly-data folder ([c5e5c0d](https://github.com/skyasu2/openmanager-ai/commit/c5e5c0db8a59e5740407ad136fd4d2da6ef29ed8))
* **auth:** apply getSupabase() pattern to auth-state-manager.ts ([bd9266c](https://github.com/skyasu2/openmanager-ai/commit/bd9266c67083bd0ce6a40fb09d818b8b52e26021))
* **auth:** enhance security with JWT validation and secure guest IDs ([7ec222d](https://github.com/skyasu2/openmanager-ai/commit/7ec222d48993894493cb2174bf90b7830ec3b509))
* **auth:** remove server-only imports from client-side auth files ([24daf1e](https://github.com/skyasu2/openmanager-ai/commit/24daf1ebcccb31b66b1c8c1bdcd63b55f27ff7f4))
* **auth:** resolve GitHub OAuth PKCE session creation failure ([5753af5](https://github.com/skyasu2/openmanager-ai/commit/5753af5d81f83c328a4880ab03249a04d1970598))
* **auth:** suppress expected 'Auth session missing' warnings in guest mode ([1af1b82](https://github.com/skyasu2/openmanager-ai/commit/1af1b82e8138778e016486dd26062037aa20c012))
* **auth:** 세션 만료 기간 30일 → 7일로 변경 ([7a024d5](https://github.com/skyasu2/openmanager-ai/commit/7a024d59faf6936c473603eee4f0216fe38a8749))
* **biome:** resolve circular dependency in useAutoLogout ([8ad5d59](https://github.com/skyasu2/openmanager-ai/commit/8ad5d5960691c0e297e0f8552e9bc4e5678a3984))
* **biome:** support both Windows and WSL environments ([f5cd501](https://github.com/skyasu2/openmanager-ai/commit/f5cd501f2d2106f04b44309fe9701a2bda173218))
* **build:** remove node: protocol to support Vercel deployment ([d130591](https://github.com/skyasu2/openmanager-ai/commit/d13059138e9c096e0fbc167e30ef19e563d74e98))
* **build:** revert node: protocol to fix Vercel client bundling ([c82e85d](https://github.com/skyasu2/openmanager-ai/commit/c82e85d22a4484ea238c688fd554ca7cc946acd9))
* **build:** Vercel 배포 수정 - generate:server-data 스크립트 제거 ([d0826bb](https://github.com/skyasu2/openmanager-ai/commit/d0826bb24a75b30bea88ddc1abb1134886144e23))
* **cache:** add hardcoded production URL fallback for Vercel serverless ([db184f3](https://github.com/skyasu2/openmanager-ai/commit/db184f3e8fd8fe301e2c22c94bab0a0957f0b39f))
* **cache:** always use production URL for static file access ([7b64fdd](https://github.com/skyasu2/openmanager-ai/commit/7b64fdd8ed72cfe129ba049b0902490e360bd02d))
* **charts:** resolve ResponsiveContainer -1 width/height warnings ([9cc09c6](https://github.com/skyasu2/openmanager-ai/commit/9cc09c614e3daf5df48b8cf8b5aa7f226a5616e9))
* **ci:** use optimized lint:ci command to prevent OOM ([ddc9725](https://github.com/skyasu2/openmanager-ai/commit/ddc97250dc67839fad1403ca3c33d78c999fac9a))
* **cloud-run:** fix package versions and add package-lock.json ([845f183](https://github.com/skyasu2/openmanager-ai/commit/845f18378533a4afe1454cc48607fce2dd381d00))
* **cloud-run:** handle trailing newline in env vars with .trim() ([250e7a5](https://github.com/skyasu2/openmanager-ai/commit/250e7a51bb26b66b330aa2575424cc22774f984e))
* **cloud-run:** read env vars dynamically for serverless ([4e2c3bb](https://github.com/skyasu2/openmanager-ai/commit/4e2c3bbc76722faf77e814fd1126a2d46954864e))
* **cloud-run:** update @langchain/core to ^0.3.79 for peer dependency compatibility ([5891a39](https://github.com/skyasu2/openmanager-ai/commit/5891a3977b513a88e246862cf72657902639a92c))
* **code-review:** v6.3.0 - 1:1:1 균등분배 보장 + Rate Limit 감지 ([89617d0](https://github.com/skyasu2/openmanager-ai/commit/89617d00e4613cef61021840cd610b8f98c1386d))
* **code-review:** v6.4.0 - 초기 상태 버그 수정 + Rate Limit 통합 ([3813d35](https://github.com/skyasu2/openmanager-ai/commit/3813d35c9428d3b940dd977edba78eeb746471a4))
* **code-review:** v6.9.1 - set_last_ai 버그 수정 ([afc9569](https://github.com/skyasu2/openmanager-ai/commit/afc9569c73e25368a81288d0cc5b0823556c23a5))
* **config:** align Cloud Run AI endpoint and feature flags ([e317b1a](https://github.com/skyasu2/openmanager-ai/commit/e317b1a2dcfac368ab22007b091ba7e2a8c3f3b8))
* **config:** apply Zod v4 ESM safe integer pattern ([29176b3](https://github.com/skyasu2/openmanager-ai/commit/29176b3238416da9a89585981bc09068982947b9))
* correct OpenStack to Open Source in feature cards ([820bbd7](https://github.com/skyasu2/openmanager-ai/commit/820bbd7d9d0fb94ce5abc45801ddda942c7a0a58))
* **critical:** resolve AI code review findings (3 bugs) ([59e7075](https://github.com/skyasu2/openmanager-ai/commit/59e707599a73a29daa28b02cb8b8c3c4d1da0a4a))
* **css:** resolve Tailwind v4 padding utilities not applying ([2726f29](https://github.com/skyasu2/openmanager-ai/commit/2726f29c16bb48b528df565ea846afefa384e63b))
* **dashboard:** prevent DashboardContent render log spam ([89eee14](https://github.com/skyasu2/openmanager-ai/commit/89eee14f33eaa6037f254735312fc7d1b27e793c))
* **dashboard:** remove unused 1-second interval causing graph flicker ([9ef7583](https://github.com/skyasu2/openmanager-ai/commit/9ef7583710fa85bfd04ffde235ea26e8f673f975))
* **dashboard:** resolve API over-calling causing ERR_INSUFFICIENT_RESOURCES ([31b4825](https://github.com/skyasu2/openmanager-ai/commit/31b4825eee15540dfd87f6c588556aedb9992f5e))
* **data:** add client-side API fallback for UnifiedServerDataSource ([de55f31](https://github.com/skyasu2/openmanager-ai/commit/de55f316c19daaafbe9661ef2af356ded753e4e5))
* **data:** remove stage4 from history and update current tech stack ([5c101dd](https://github.com/skyasu2/openmanager-ai/commit/5c101ddd2d77f6208b5d5229fc3ccb1e8db627a5))
* **deps:** regenerate lockfile with --legacy-peer-deps ([0ab2b7b](https://github.com/skyasu2/openmanager-ai/commit/0ab2b7b2629fb467c6956bbab10a53f2e098dc19))
* **deps:** regenerate package-lock.json for Vercel compatibility ([4676714](https://github.com/skyasu2/openmanager-ai/commit/4676714d50dd43594dfdf41e60d081a041361ede))
* **deps:** Zod v4 호환성 수정 ([582ef3e](https://github.com/skyasu2/openmanager-ai/commit/582ef3e3a01ef431ece71f8668f63298bb3f5e50))
* **dev:** enable Windows IDE access to WSL dev server ([d13da2e](https://github.com/skyasu2/openmanager-ai/commit/d13da2efe455b9582a9dccfd479fec5fcb9434f7))
* **docs:** correct MCP path references and remove stale directory ([b98ec22](https://github.com/skyasu2/openmanager-ai/commit/b98ec2286ed5b429780dcf82ce5d151e6710649e))
* **docs:** correct relative path links in environment/tools/ ([18b2bf1](https://github.com/skyasu2/openmanager-ai/commit/18b2bf15c1b9742c3235697146edbb5dfed21fa8))
* **docs:** correct YAML frontmatter and broken links ([4b1848f](https://github.com/skyasu2/openmanager-ai/commit/4b1848f4af4076e292d5ffad5127a805c8407a05))
* **docs:** correct YAML frontmatter and broken links ([2de9b80](https://github.com/skyasu2/openmanager-ai/commit/2de9b803acc2c0eb7412a4d07cb34b63c834f2c1))
* **docs:** unify ENDPOINT env var format (remove /process suffix) ([b752e99](https://github.com/skyasu2/openmanager-ai/commit/b752e99f5046142e3845cd85ccca8b78dc1ac98f))
* **docs:** update validation rules per project standards ([6e14e4e](https://github.com/skyasu2/openmanager-ai/commit/6e14e4e669627d9543978ad7e3c9da2f4f1e1117))
* **e2e:** resolve local E2E test failures with production build mode ([a790c8c](https://github.com/skyasu2/openmanager-ai/commit/a790c8c9b1d42a77855078d6af0d513051c2a9cf))
* **e2e:** stabilize local dev server E2E testing for Next.js 15 ([915b893](https://github.com/skyasu2/openmanager-ai/commit/915b893feebb3087cb7ba9422cbd65e71b43ab37))
* **file-cache:** use fetch API for Vercel serverless environment ([524cc9e](https://github.com/skyasu2/openmanager-ai/commit/524cc9e4d0da8358dab28f3508b6cb1a753fbf5d))
* **gcp:** 레거시 Cloud Functions URL 완전 제거 ([a0ad79c](https://github.com/skyasu2/openmanager-ai/commit/a0ad79cfaf43307602be5677a9bbcc4e773bd402))
* **gitignore:** use root-scoped patterns per Codex review ([d1e6da2](https://github.com/skyasu2/openmanager-ai/commit/d1e6da2b9c7ca90a10e1a9b4babdcd4bdd9d82d3))
* **health:** improve database connection check resilience ([6fdc7b9](https://github.com/skyasu2/openmanager-ai/commit/6fdc7b929cd4244cf6d64fce97124d596fd34106))
* **health:** use auth session check instead of RPC for database connectivity ([594d1c5](https://github.com/skyasu2/openmanager-ai/commit/594d1c5b05fefb2cffa3d6dad75d575483136143))
* **hooks:** improve POSIX compatibility and reduce log noise ([d8ced7b](https://github.com/skyasu2/openmanager-ai/commit/d8ced7b33e1e578d78cbbffde3ed77615c789ed9))
* **import:** UnifiedServerDataSource import 경로 @ alias로 복원 및 타입 명시 ([0540243](https://github.com/skyasu2/openmanager-ai/commit/05402430fe30f2f71ced38d2594ad0425db2d47d))
* **import:** UnifiedServerDataSource import 경로 @ alias로 복원 및 타입 명시 ([f6fcbca](https://github.com/skyasu2/openmanager-ai/commit/f6fcbcafa128596a3501656ec36138c3ba0bc982))
* improve CSP safety and fix UI/CSS issues ([bc5588d](https://github.com/skyasu2/openmanager-ai/commit/bc5588d00809ae598609dcbed612f6dd35fa74bc))
* **lint:** AIChatInterface Biome 오류 수정 ([db94579](https://github.com/skyasu2/openmanager-ai/commit/db9457926aa2eae22a369fa4e942bf43c5ea28cb))
* **lint:** ESLint no-floating-promises 에러 수정 (DashboardClient) ([845b02c](https://github.com/skyasu2/openmanager-ai/commit/845b02c9523c5af20f62b105ebc96ba4a60e0ee6))
* **lint:** route.ts noExplicitAny 오류 수정 ([1cad056](https://github.com/skyasu2/openmanager-ai/commit/1cad056f31d394ec053f731c4a137f33b7732794))
* **login:** restore Sparkles gradient icon on login page ([9e7dae2](https://github.com/skyasu2/openmanager-ai/commit/9e7dae28df055259c639a7203358e311b5284b65))
* **main:** 게스트 모드 시스템 시작 접근 허용 ([28809ff](https://github.com/skyasu2/openmanager-ai/commit/28809ff62472878ad767bdfc771f3c09103de379))
* post-upgrade maintenance fixes ([bc7e5d7](https://github.com/skyasu2/openmanager-ai/commit/bc7e5d7adf2c6af4d31bec8a5fd053832ee9c425))
* **rag:** apply code review feedback - type safety & warning log ([95515c8](https://github.com/skyasu2/openmanager-ai/commit/95515c81a5c2eef2128c4be036dc9f5ff6cd6ab1))
* **rag:** Phase 3.1-3.2 캐시 안정성 개선 ([9d43661](https://github.com/skyasu2/openmanager-ai/commit/9d43661d0fad94f6edae47ef41b97e7828b755df))
* Remove side-effects from admin mode removal ([b20615e](https://github.com/skyasu2/openmanager-ai/commit/b20615e6765a95f8c880835a6c428ed170eb44f8))
* remove unused imports (lint) ([1d2090d](https://github.com/skyasu2/openmanager-ai/commit/1d2090d85f147702a56f9f3ac12e0551562278f1))
* resolve all Biome lint warnings (49→0) ([fdf70e7](https://github.com/skyasu2/openmanager-ai/commit/fdf70e76ff2c47f93ce1993f39cc69502fd19acc))
* resolve Biome lint warnings ([cf2bc03](https://github.com/skyasu2/openmanager-ai/commit/cf2bc039c32d13b2afe8c0118585559934480e2b))
* resolve broken script references from cleanup commit ([75a9855](https://github.com/skyasu2/openmanager-ai/commit/75a9855aae2cd4376f862dc4fbe31d59d0ca2a6a))
* resolve Gemini logging regression and improve output capture ([81de64e](https://github.com/skyasu2/openmanager-ai/commit/81de64eb30a841123ac7da8e9b9480ace0611984))
* restore GCP Functions details in feature cards (Python/OpenStack) ([d188ea7](https://github.com/skyasu2/openmanager-ai/commit/d188ea7e048659ee99179d816ae99753f7ad36f1))
* **review:** Gemini wrapper v3.1.0 - 쿼리 이스케이핑 버그 수정 ([1d4982e](https://github.com/skyasu2/openmanager-ai/commit/1d4982e44f3bbdde88b578a8d7da39fad61f64b7))
* **review:** Gemini wrapper 일관성 + 버전 동기화 + 경로 주석 ([b30d330](https://github.com/skyasu2/openmanager-ai/commit/b30d330a6670f4f30a92f4867b9e269037264158))
* **review:** Gemini wrapper 일관성 + 버전 동기화 + 경로 주석 ([56b94ae](https://github.com/skyasu2/openmanager-ai/commit/56b94ae4f38b8227c28031604df6713760a78ea3))
* **security:** add API auth, PII filter, and optimize Cloud Run config ([6d60527](https://github.com/skyasu2/openmanager-ai/commit/6d605276a4cbe0e105032621412233b1da8f1eb0))
* **security:** address AI review feedback - improve type safety ([b43bf5c](https://github.com/skyasu2/openmanager-ai/commit/b43bf5cbde638e920cd0fefd2c56f1b18befe20d))
* **security:** address AI review feedback - session security hardening ([b53724a](https://github.com/skyasu2/openmanager-ai/commit/b53724ae5d153be0221975c64a06ef021bc6a4bb))
* **security:** correct Buffer encoding from utf8 to hex ([3a800f4](https://github.com/skyasu2/openmanager-ai/commit/3a800f419da0963c0746af4dac967ea56d35dfc7))
* **security:** patch 4 vulnerabilities (HIGH+MODERATE) ([94fbe73](https://github.com/skyasu2/openmanager-ai/commit/94fbe7399bbe5223d3bbb80a1fb4406fe1d967d6))
* **security:** Shell Injection 방어 및 CI/CD 호환성 개선 ([76238c8](https://github.com/skyasu2/openmanager-ai/commit/76238c8ed002a9cd56b2a021bb1f98903f6ca29a))
* **security:** update Next.js 15.5.5 → 15.5.7 (CVE-2025-66478) ([a595b13](https://github.com/skyasu2/openmanager-ai/commit/a595b13ca1ebc0e89bd869b5f221579b91498ad8))
* **supabase:** SSR 안전성 개선 - 모듈 최상위 클라이언트 초기화 수정 ([229254c](https://github.com/skyasu2/openmanager-ai/commit/229254c1d7fce509daa49aea36b0ba1732be4eeb))
* **test:** add guest login flow to Feature Cards E2E tests ([04cd741](https://github.com/skyasu2/openmanager-ai/commit/04cd74148cbddf5706d5e111bff084d98aa46bea))
* **test:** AI 사이드바 E2E 테스트 안정성 개선 (Codex 리뷰 반영) ([f6b7f4c](https://github.com/skyasu2/openmanager-ai/commit/f6b7f4c5bf0368596d1f2554d3edd2118ff73135))
* **test:** E2E 테스트 /system-boot 로딩 페이지 대기 로직 추가 ([57b3e92](https://github.com/skyasu2/openmanager-ai/commit/57b3e92af3eccf10da3b3750eeb237abe1d17b0b))
* **test:** E2E 테스트 navigation 레이스 컨디션 수정 (Promise.all 패턴) ([1cdb666](https://github.com/skyasu2/openmanager-ai/commit/1cdb666fec73f773a4aa3c9210f6cedb1216a39d))
* **test:** E2E 테스트 timeout 값 표준화 (Vercel Cold Start 대응) ([f04047f](https://github.com/skyasu2/openmanager-ai/commit/f04047f558085bad3657f630fc0e95e1cb53c572))
* **test:** E2E 테스트 대시보드 접근 개선 ([4d79117](https://github.com/skyasu2/openmanager-ai/commit/4d791174cf2b72ca45b5802a7619ac4961f06d4b))
* **test:** E2E 테스트 시스템 초기화 대기 로직 추가 ([d23e043](https://github.com/skyasu2/openmanager-ai/commit/d23e043b0ca5dd817cd04cbfc4689d4163229725))
* **test:** E2E 테스트 안정성 개선 - Gemini 리뷰 Critical 이슈 수정 ([6ffd096](https://github.com/skyasu2/openmanager-ai/commit/6ffd096ca9c22c3060e09b9ad396438667d3f460))
* **test:** E2E 테스트 파일 경로 수정 ([0d59947](https://github.com/skyasu2/openmanager-ai/commit/0d59947f6eeb208e9a0541773080a5f50d510f9d))
* **test:** formatPercentage 테스트 기대값 수정 ([523dac0](https://github.com/skyasu2/openmanager-ai/commit/523dac00303e351d99b0a2a93b8b6b684cb7263e))
* **test:** improve Dashboard E2E test stability (Codex review fixes) ([6c27536](https://github.com/skyasu2/openmanager-ai/commit/6c275367621ff0b35560cb616b1284ce517dc0e9))
* **test:** openAiSidebar 헬퍼 함수 개선 - 이미 열린 사이드바 처리 ([174f01c](https://github.com/skyasu2/openmanager-ai/commit/174f01cf89ec8d5eed8b51f580ac7ae3ee7838d4))
* **tests:** repair orphaned test files importing non-existent modules ([655cd35](https://github.com/skyasu2/openmanager-ai/commit/655cd35c1cc3fb831d818c1c5399a4a1c226d86a))
* **test:** 테스트 개선 및 import 경로 수정 ([bfbe666](https://github.com/skyasu2/openmanager-ai/commit/bfbe666ab9d31e5d8b0a4d8a8c9637945cf014cf))
* **types:** AISidebarContent 타입 에러 수정 (undefined 처리 + aiAnalysis 타입 추가) ([70c2bef](https://github.com/skyasu2/openmanager-ai/commit/70c2bef4b5965f2cdc22ddd12b61b4d06fd4350a))
* **types:** EnhancedServerMetrics 타입 정의 보완 및 ESLint 수정 (24+4개 오류 해결) ([7d12ed9](https://github.com/skyasu2/openmanager-ai/commit/7d12ed9a32387fbcc24a1be3bbca7b25a0adfb9f))
* **types:** TypeScript 컴파일 오류 수정 (5개 오류 해결) ([fd575ec](https://github.com/skyasu2/openmanager-ai/commit/fd575ec713d1a44e55dca3b642545292a27474cc))
* **types:** TypeScript 타입 에러 최종 수정 (AISidebarContent + IntelligentMonitoringService) ([57a5888](https://github.com/skyasu2/openmanager-ai/commit/57a58887276127f24e7f004798234d6f20c019fd))
* **ui:** 10개 핵심 컴포넌트 애니메이션 클래스 활성화 ([3973ce1](https://github.com/skyasu2/openmanager-ai/commit/3973ce1670829d1a8506c75e19a464ef44e63880))
* **ui:** 4개 컴포넌트 애니메이션 클래스 활성화 ([afdae8e](https://github.com/skyasu2/openmanager-ai/commit/afdae8e803fb717302717660aa8b245c681d8a7d))
* **ui:** AI 사이드바 E2E 테스트 지원을 위한 data-testid 추가 ([9ae4bc1](https://github.com/skyasu2/openmanager-ai/commit/9ae4bc1395853c3129223714598f4017abeab034))
* **ui:** apply dark background for Dark Glassmorphism visibility ([316d37b](https://github.com/skyasu2/openmanager-ai/commit/316d37b801ca68b548c401804df58072387b6380))
* **ui:** correct AI icon gradient colors - pink → purple → cyan ([d3f0407](https://github.com/skyasu2/openmanager-ai/commit/d3f040739b75dc46d39602c1cac299637bdb84ca)), closes [#ec4899](https://github.com/skyasu2/openmanager-ai/issues/ec4899) [#a855f7](https://github.com/skyasu2/openmanager-ai/issues/a855f7) [#22d3](https://github.com/skyasu2/openmanager-ai/issues/22d3)
* **ui:** enable disabled Tailwind CSS animations ([70cf480](https://github.com/skyasu2/openmanager-ai/commit/70cf480b32b5e3d328635d40a9e5d7c50913ba8f))
* **ui:** improve gradient cross-browser compatibility and prevent ID collisions ([bc2c626](https://github.com/skyasu2/openmanager-ai/commit/bc2c626ef2279b3e0ddf92d906667b32372d93dd))
* **ui:** improve login page layout and visual hierarchy ([ef0fcfe](https://github.com/skyasu2/openmanager-ai/commit/ef0fcfe3f17956645037d9d28b2d41382d045e19))
* **ui:** improve login page layout and visual hierarchy ([7445bda](https://github.com/skyasu2/openmanager-ai/commit/7445bdae195e853c41fecf7a370fd416c1d9f149))
* **ui:** ImprovedServerCard에 누락된 아이콘 import 추가 ([0a195df](https://github.com/skyasu2/openmanager-ai/commit/0a195df9b357169a507cb1e7beb3155fca111803))
* **ui:** remove 'AI 독립 모드' text from main page logo ([6132272](https://github.com/skyasu2/openmanager-ai/commit/613227215e2ec061260fa96d1f16e0fdc816c720))
* **ui:** remove background ServerIcon causing gray box artifacts ([699e362](https://github.com/skyasu2/openmanager-ai/commit/699e3624c954cfe6c95ebe88a749361128f27b54))
* **ui:** SystemBootClient 로딩 애니메이션 활성화 ([9a30dbf](https://github.com/skyasu2/openmanager-ai/commit/9a30dbf7b1025f71fb1003641ca75b3f56e591e5))
* **ui:** update version display from v5.44.3 to v5.80.0 ([ebc09e8](https://github.com/skyasu2/openmanager-ai/commit/ebc09e8e2d54acf7c3338e521c3c87e27c0e899e))
* **ui:** 로딩 애니메이션 활성화 및 loading.tsx 추가 ([f298dea](https://github.com/skyasu2/openmanager-ai/commit/f298deaf70cffda214042b6ba5304566944b67ec))
* update document refs and MCP server config after archive cleanup ([b25e566](https://github.com/skyasu2/openmanager-ai/commit/b25e5665cb0bc012ac3a30b359813491a381a850))
* **utils:** formatPercentage decimals 일관성 수정 ([bf9d906](https://github.com/skyasu2/openmanager-ai/commit/bf9d906ac0cade24a8b5a4de32e860fd81812145))
* **wrappers:** Codex/Qwen v3.1.0 - stdout/stderr 분리 + 견고성 향상 ([08fb6c4](https://github.com/skyasu2/openmanager-ai/commit/08fb6c4c97ced0038e00b249f5f0e24f0f76c6c6))
* **wrapper:** stdout/stderr 분리로 파이프라인 호환성 향상 ([03e73e2](https://github.com/skyasu2/openmanager-ai/commit/03e73e2561136511317d15399d1c1e31cdb7fa08))
* **wrappers:** v3.1.0 로그 메시지 → v3.3.0 일괄 수정 ([c87a65d](https://github.com/skyasu2/openmanager-ai/commit/c87a65d4f0764626c195a4c8b00fc4a4b766c608))
* **wrappers:** v3.2.0 - temp_stdout unbound variable 버그 수정 ([30dfbe8](https://github.com/skyasu2/openmanager-ai/commit/30dfbe8f7be6bd7940cd5a8107b32ecb839a1469))
* **wrappers:** v3.3.0 NUL bytes 제거 및 버전/컨텍스트 일관성 수정 ([8ec3487](https://github.com/skyasu2/openmanager-ai/commit/8ec3487ef05e2bbd7a6475e93b25b810ce17df55))
* **zod:** resolve Zod v4 ESM module bundling issues ([db330cf](https://github.com/skyasu2/openmanager-ai/commit/db330cfd24d3555c33ce2f5074b0060ad5afb8d7))


### 🚀 Features

* /api/ai/query 엔드포인트 추가 (AISidebarContent 버그 수정) ([f172223](https://github.com/skyasu2/openmanager-ai/commit/f172223fba038f485098fdc59eac1f34bf8591cc))
* add Cloud Run LangGraph multi-agent backend ([9237e17](https://github.com/skyasu2/openmanager-ai/commit/9237e171e3091cd5689309f66553287267777455))
* Add route protection middleware with dev bypass ([753b39e](https://github.com/skyasu2/openmanager-ai/commit/753b39eb43401d7e77c37c040e5154dfc8a88093))
* AI 리뷰에 문서/테스트 검증 경고 연동 ([898de63](https://github.com/skyasu2/openmanager-ai/commit/898de639881d0f5f84c4bb3a44c74f158f175b17))
* **ai-review:** restore 3-AI rotation with Claude CLI fix (v6.7.0) ([4d9a933](https://github.com/skyasu2/openmanager-ai/commit/4d9a93349b29e62c46c31e06e7cd4678d1245c9c))
* **ai-review:** 순서 기반 AI 선택 + Qwen 최종 폴백 (v6.0.0/v6.1.0) ([7fbef55](https://github.com/skyasu2/openmanager-ai/commit/7fbef55fb25b601f0f7df7b6a1d9a7acbddd3659))
* **ai-sidebar:** connect ML Learning Center to API + cleanup ([50eedac](https://github.com/skyasu2/openmanager-ai/commit/50eedaca43848a7ce70e54bffed5ed2fde4a2d3d))
* **ai-wrappers:** v3.3.0 comprehensive reviewer context ([be25f28](https://github.com/skyasu2/openmanager-ai/commit/be25f28aa30dfa776828d71064fa8f8926873bb3))
* **ai:** add insights API and database migrations ([c6779ba](https://github.com/skyasu2/openmanager-ai/commit/c6779ba0888d668d52e8121f4a9f40fe30a40e4b))
* **ai:** add validation-analysis skill and auto-review system ([6343f93](https://github.com/skyasu2/openmanager-ai/commit/6343f93a3c0091f3081fc9e01a622e050592d38e))
* **ai:** AI 어시스턴트 전체화면 모드 + Biome lint 수정 ([b9c702c](https://github.com/skyasu2/openmanager-ai/commit/b9c702c84364afc17bb829dbac017a3477b1c1c0))
* **ai:** Gemini 2.5 Flash 업그레이드 + Groq 폴백 시스템 추가 ([32f90cf](https://github.com/skyasu2/openmanager-ai/commit/32f90cfce1a387a112e747dfc0a2ebd3963e1fee))
* **ai:** Gemini 3 Pro로 코드 리뷰 모델 업그레이드 ([6f6b466](https://github.com/skyasu2/openmanager-ai/commit/6f6b466cc762924e89188f83acabbd7fd8b8a82b))
* **ai:** integrate SmartRoutingEngine with /api/ai/query ([b52798b](https://github.com/skyasu2/openmanager-ai/commit/b52798b4d6cc815d45a1749a66e92ac0f4db5086))
* **ai:** integrate Vercel AI SDK for real-time thinking process and update docs ([54f28a8](https://github.com/skyasu2/openmanager-ai/commit/54f28a8fe55458143872f7057bba93294e0b9fbb))
* **ai:** integrate Vercel AI SDK streaming and complete Phase 1-2 documentation ([8cfc5a1](https://github.com/skyasu2/openmanager-ai/commit/8cfc5a14187498326e255ba2290603294b610df6))
* **ai:** migrate to LangGraph unified-stream API ([5e77013](https://github.com/skyasu2/openmanager-ai/commit/5e77013a6dd5c4f465c0a3cef63d37382d127a50))
* **ai:** SmartRoutingEngine 통합 + 문서 버전 관리 표준 ([33d9725](https://github.com/skyasu2/openmanager-ai/commit/33d97256445a76d798e8005c480dda8f3fba4626))
* **ai:** unified-ai-processor v3.3.0 - Quart async + batch API ([180356c](https://github.com/skyasu2/openmanager-ai/commit/180356cc1abad7d7877f1e5bdabc57156d7bb1cc))
* **analyst-agent:** integrate anomaly detection & trend prediction tools ([d22ba01](https://github.com/skyasu2/openmanager-ai/commit/d22ba01f50b32f01c203c26fd25a52ff64756e68))
* **animations:** GPU-accelerated animation system (Day 1/3 - 120fps target) ([f74e0b2](https://github.com/skyasu2/openmanager-ai/commit/f74e0b26f017845edef7d913f8e464aad1615ea0))
* **auth:** 30일 세션 만료 기능 추가 ([6f195ba](https://github.com/skyasu2/openmanager-ai/commit/6f195badf4f195f013397260ead60b1f6c9e13b1))
* **auth:** add controlled mode props to GitHubLoginButton ([dc36a89](https://github.com/skyasu2/openmanager-ai/commit/dc36a89d5363ee8a514e6f9512f6e5e2f9d7a487))
* **auth:** enable full guest permissions during development ([eb85407](https://github.com/skyasu2/openmanager-ai/commit/eb85407973e68b59023f47f72a5e335fe35174dc))
* **auth:** enable guest full access mode for AI API ([95a4e85](https://github.com/skyasu2/openmanager-ai/commit/95a4e85ea861300bc2e614021e47e35ba8b663b3))
* **biome:** Biome v2.3.8 전체 적용 + pre-commit 일시 비활성화 ([aac3d26](https://github.com/skyasu2/openmanager-ai/commit/aac3d26188563c31d79ed8627b890fe489c9a566))
* **biome:** Biome 설정 v2.3.8로 마이그레이션 완료 ([db59567](https://github.com/skyasu2/openmanager-ai/commit/db59567143420a491995aea04a971ecb675346f6))
* **biome:** Biome 완전 마이그레이션 및 pre-commit 활성화 ([d4ab729](https://github.com/skyasu2/openmanager-ai/commit/d4ab72939f7604a7ed86bbd0bd0e62dca472f26c))
* **cache:** 캐싱 전략 표준화 - TTL 계층화 및 SWR 프리셋 적용 ([dddd513](https://github.com/skyasu2/openmanager-ai/commit/dddd513fd73f4d5996612d91ef7e45cfa730c6e9))
* **ci:** add automated linting workflow ([c1d7443](https://github.com/skyasu2/openmanager-ai/commit/c1d744370f0cee38907a85bbf66a14b6d31f815b))
* **ci:** add weekly branch & PR cleanup automation ([8181667](https://github.com/skyasu2/openmanager-ai/commit/8181667d98dd859d11d1b539c9293e59e6d843e8))
* **cloud-run:** add Google AI API key round-robin rotation ([ba0fd8c](https://github.com/skyasu2/openmanager-ai/commit/ba0fd8c5aff2eaa697430b25be21351c80aab7cf))
* **cloud-run:** integrate Cloud Run AI backend with Vercel proxy ([5c56d2a](https://github.com/skyasu2/openmanager-ai/commit/5c56d2aaa018ab4467e950136d90f7d9a723a5ae))
* **code-review:** v6.9.0 - 3-AI 1:1:1 rotation with mutual fallback ([887a9b2](https://github.com/skyasu2/openmanager-ai/commit/887a9b250a16c7b55acec85c26c4c04f0d0ea8eb))
* **dashboard:** restore EnhancedServerCard v5.0 with Framer Motion ([f7d2b8e](https://github.com/skyasu2/openmanager-ai/commit/f7d2b8e18fef7518bc300df3a445b2eae0b7ef6f))
* **data:** add 24h rotating JSON data system for dashboard ([ef11bad](https://github.com/skyasu2/openmanager-ai/commit/ef11badea40457445b35060bebaa2c7023e88369))
* **deps:** complete Zod v4 migration (Phase 3) ([57c97be](https://github.com/skyasu2/openmanager-ai/commit/57c97beec53e0ff779f1960d220d1eb53b6df43d))
* **deps:** Phase 1-4 패키지 대규모 업그레이드 완료 ([bc69a6e](https://github.com/skyasu2/openmanager-ai/commit/bc69a6e88edff12e086cf1621f991de433019831))
* **dev:** 포트 관리 자동화 및 Playwright 설정 개선 ([80a4490](https://github.com/skyasu2/openmanager-ai/commit/80a4490faedcd444f3f3fd900cd0d7f15c97dbce))
* **dev:** 포트 관리 자동화 스크립트 추가 ([201e9c7](https://github.com/skyasu2/openmanager-ai/commit/201e9c712bc5ddb546bd28b19837f25d65b67b82))
* **docs:** add architecture and security docs to core/ ([b28e0d0](https://github.com/skyasu2/openmanager-ai/commit/b28e0d05dd7403abe035c2cc91b60d9f387c7054))
* **docs:** add documentation validation tools ([95f4174](https://github.com/skyasu2/openmanager-ai/commit/95f4174c15f0e9455fa51d05a4b5b10685aea55f))
* **gcp:** Cloud Functions → Cloud Run 마이그레이션 완료 ([0a86ae2](https://github.com/skyasu2/openmanager-ai/commit/0a86ae21d2024410979f027e5426418676c815b2))
* **gcp:** maximize free tier utilization ([03f37b2](https://github.com/skyasu2/openmanager-ai/commit/03f37b215494fc8064a9b58e0b64b2432177fbb2))
* **hitl:** implement natural language approval UX ([5172a2e](https://github.com/skyasu2/openmanager-ai/commit/5172a2e3082a49bf1807da3a80783e681d53b392))
* **hooks:** add Claude Code Hooks for AI workflow automation ([c898b51](https://github.com/skyasu2/openmanager-ai/commit/c898b5103c452e64c6267eea136818fbd3aa5cec))
* **hooks:** integrate isSystemStarted into server query hooks ([9d45799](https://github.com/skyasu2/openmanager-ai/commit/9d45799f99da09c88831e23b288777550c0ea36e))
* **infra:** add Cloud Run deployment for LangGraph agents ([057cc27](https://github.com/skyasu2/openmanager-ai/commit/057cc2717b7813395cfe3571e1c6945a4cd09731))
* **infra:** PM2 프로세스 관리 시스템 구현 (WSL Best Practice Item 3+4) ([d1ce69f](https://github.com/skyasu2/openmanager-ai/commit/d1ce69f60b6347778aa8207f639075776a3cbbd9))
* **langgraph:** add Human-in-the-Loop approval and parallel execution ([c375d44](https://github.com/skyasu2/openmanager-ai/commit/c375d44911312372ca821cbf6cf04c89260d1ec7))
* **langgraph:** add multi-agent StateGraph architecture ([bf92f54](https://github.com/skyasu2/openmanager-ai/commit/bf92f5429b106e92391c5548b36f0590250e6329))
* **langgraph:** implement A2A delegation & Return-to-Supervisor patterns ([bf657bf](https://github.com/skyasu2/openmanager-ai/commit/bf657bf495b174a345bb5927700072b45eb6adc5))
* **login:** improve accessibility and UX ([3a0704c](https://github.com/skyasu2/openmanager-ai/commit/3a0704c3d754c3770718e1a3728c601eb6af8a89))
* **logo:** unify OpenManagerLogo across all pages with click navigation ([21cdefa](https://github.com/skyasu2/openmanager-ai/commit/21cdefa45186a5ebc0b4fd61a394730e924a0169))
* **mcp:** Brave Search MCP 추가 및 filesystem 제거 ([b9ed861](https://github.com/skyasu2/openmanager-ai/commit/b9ed861fcb7b13b6b99fe26019c763520c9ec51a))
* **nlp:** spaCy 영어 NLP 지원 추가 + enhanced-korean-nlp 경량화 ([79a090a](https://github.com/skyasu2/openmanager-ai/commit/79a090abac54a7a93495de05d00f5cde49f7286b))
* **profile:** 게스트 사용자에게 시스템 관리 메뉴 통합 ([d522845](https://github.com/skyasu2/openmanager-ai/commit/d522845d67093589e094be8c1d93d960a6522537))
* **rag:** extend searchKnowledgeBase tool with intent-based optimization ([20a8240](https://github.com/skyasu2/openmanager-ai/commit/20a8240be64555b9de57a1d0f326ad377e30220e))
* **rag:** Phase 3 - Intent 기반 캐시 TTL + 24시간 로테이션 ([7b66212](https://github.com/skyasu2/openmanager-ai/commit/7b66212fb77d3eaec3dc5cdf465afb1388aef89d))
* refactor system boot, improve ai sidebar ux, and cleanup code ([7b86458](https://github.com/skyasu2/openmanager-ai/commit/7b86458f6b4b650e39dd26a770c68be731ac7f7a))
* refactor useServerDashboard hook and unify design consistency ([6a19f96](https://github.com/skyasu2/openmanager-ai/commit/6a19f96d2d4b39ecd76b228f65b0031ecd2971a5))
* **review:** 3-AI 순번 (codex→gemini→claude) + 즉시 Qwen 폴백 ([76a33d6](https://github.com/skyasu2/openmanager-ai/commit/76a33d6e7b8e7e1f0c01baec1e202dcbb165a674))
* **security:** AI 통합 스트리밍 API 인증 적용 ([bdf2786](https://github.com/skyasu2/openmanager-ai/commit/bdf27866369c52c10c5158ac4861f693f21bee7b))
* **security:** 나머지 AI API 인증 적용 (raw-metrics, rag/benchmark) - 최종 ([fa33bae](https://github.com/skyasu2/openmanager-ai/commit/fa33baebc646f96539e5840a93d54eb3961c6e9f))
* **security:** 서버 API 인증 미들웨어 적용 + withAuth 제네릭 타입 지원 ([a2db623](https://github.com/skyasu2/openmanager-ai/commit/a2db6238292ad13315637d41f2ee258ab4550622))
* **security:** 주요 AI API 인증 미들웨어 적용 (3개) ([6ad1e38](https://github.com/skyasu2/openmanager-ai/commit/6ad1e38d56c849bfa40af42b41984fca371ce29e))
* **test:** AI 사이드바 E2E 테스트 Suite 추가 (7개 시나리오) ([55fc8cc](https://github.com/skyasu2/openmanager-ai/commit/55fc8cc81fa1f81dfb4422b4c0e162e763b2dae7))
* **test:** E2E 테스트 API 인증 바이패스 및 안정성 개선 ([e44aa57](https://github.com/skyasu2/openmanager-ai/commit/e44aa578497d881c82a443b93761284ad73785ad))
* **ui:** add AI icon gradient to login page with enhanced blue spectrum ([aa19cdc](https://github.com/skyasu2/openmanager-ai/commit/aa19cdcea71a866e70a5e460528371553b09386e))
* **ui:** add AI Insight Badge and enhance Bento Grid layout ([97288c5](https://github.com/skyasu2/openmanager-ai/commit/97288c5b697312f3e3e8b15c5bbc62abff7acba8))
* **ui:** apply Dark Glassmorphism to ServerCard and ServerModal ([602c2e7](https://github.com/skyasu2/openmanager-ai/commit/602c2e75f84418f833948d644a58fd45f845c40e)), closes [#0F1115](https://github.com/skyasu2/openmanager-ai/issues/0F1115)
* **ui:** apply White Mode Glassmorphism to server cards ([b71d867](https://github.com/skyasu2/openmanager-ai/commit/b71d8675dd37203f628e83c64fa074d4f273a18b))
* **ui:** refine login page with diagonal gradient and depth effects ([295ea00](https://github.com/skyasu2/openmanager-ai/commit/295ea000cc8512cd2f220bb8ae90fe8fba291747))
* **ui:** replace guest restriction alert with styled modal dialog ([507628d](https://github.com/skyasu2/openmanager-ai/commit/507628d3f05f5f70314876976833b8027a3400ba))
* **ui:** 서버 카드 그래프를 라인 차트로 통합 + Dark Glass 일관성 ([63763ca](https://github.com/skyasu2/openmanager-ai/commit/63763cafedf2b84679617509518f3c134be112f4))
* update feature cards and secure dev apis (phase 21.2) ([532138c](https://github.com/skyasu2/openmanager-ai/commit/532138c5bd604811aa611df3b563bc59ec7641dd))
* update tech stack details in feature cards (Recharts 3.x, TanStack Query, NextAuth) ([e7eaf71](https://github.com/skyasu2/openmanager-ai/commit/e7eaf719aa67d1bb6d612e304663a613c5fbc147))
* **workflow:** add 5min timeout and auto-summary for Claude Code ([ae641bc](https://github.com/skyasu2/openmanager-ai/commit/ae641bcda11b9a14fadf86beeb3925c2a95bff62))


### 📚 Documentation

* add AI tool comparison analysis and update review system ([3e91c9e](https://github.com/skyasu2/openmanager-ai/commit/3e91c9efb2aebf8327150f3091016fa2cc26692f))
* add code quality and security roadmaps ([1b84ec3](https://github.com/skyasu2/openmanager-ai/commit/1b84ec362cd5b57771accfc2a683933f21a1dceb))
* add documentation management principles to README ([bb1462a](https://github.com/skyasu2/openmanager-ai/commit/bb1462ae7715a6085f384a3836bca337b1fed3e7))
* add environment-specific MCP configurations ([0027868](https://github.com/skyasu2/openmanager-ai/commit/00278680176bd2c8556b11fa87d6d7eb81d45edf))
* Add production security restoration checklist to TODO ([93d67a2](https://github.com/skyasu2/openmanager-ai/commit/93d67a22d03207f130e180df727a3bdc0cdb1f3b))
* add WSL development environment guidelines ([dfaff00](https://github.com/skyasu2/openmanager-ai/commit/dfaff007a39ea6952c56c3b392b3faf24a6af002))
* AI 메모리 파일 및 문서 정리 ([81baf9e](https://github.com/skyasu2/openmanager-ai/commit/81baf9e9708a24394da9170acd6526802209800e))
* AI 코드 리뷰 시스템 v6.4.0 문서 동기화 ([c098245](https://github.com/skyasu2/openmanager-ai/commit/c098245a0da771a512164be6b11f2f04d593f23a))
* **ai:** sync AI tool version references ([da5eff0](https://github.com/skyasu2/openmanager-ai/commit/da5eff02a79a876d0ef78c80b385fdcb2918897a))
* **ai:** update registry-core.yaml with LangGraph architecture ([dfa9fb2](https://github.com/skyasu2/openmanager-ai/commit/dfa9fb2b3ebbe21c9d2557b816e3a50f099ae3de))
* **ai:** update subagents guide to 9 active agents ([857ebd1](https://github.com/skyasu2/openmanager-ai/commit/857ebd1eb82bc5d2fc472f88cc841e5fb33f3cf5))
* **analysis:** 서버 카드 디자인 분석 보고서 작성 (v1.0 → v3.1 비교) ([0927390](https://github.com/skyasu2/openmanager-ai/commit/0927390ac3d2e476198af0571f3448c4d278e577))
* **architecture:** 대시보드 아키텍처 다이어그램 추가 + 포맷팅 ([a07f8ae](https://github.com/skyasu2/openmanager-ai/commit/a07f8ae4822f8b793a3632b615f66216fe1a5b3c))
* **architecture:** 레거시 데이터 정리 및 난개발 방지 시스템 구축 ([5c1dbcb](https://github.com/skyasu2/openmanager-ai/commit/5c1dbcb62a606be733c3a9d65395d7f62964261c))
* archive completed planning documents ([e059b9b](https://github.com/skyasu2/openmanager-ai/commit/e059b9bac9010e388193d15ef999b698f0e1be97))
* archive completed UI/UX improvements and refactoring tasks ([1ba55d7](https://github.com/skyasu2/openmanager-ai/commit/1ba55d7528876ae8143494465caf9cfa4387d2ac))
* archive outdated v5.71.0 architecture docs + fix testing README ([3bec146](https://github.com/skyasu2/openmanager-ai/commit/3bec146666e2371994ccc05aed54516d00066102))
* **archive:** clean up 42 outdated archive documents ([0da036f](https://github.com/skyasu2/openmanager-ai/commit/0da036f15be863039d7214e3f8935a236d286b2c))
* **archive:** remove 42 outdated archive documents ([8fa4b83](https://github.com/skyasu2/openmanager-ai/commit/8fa4b83caa6e60a13c6e11f93b2da08d0680d151))
* **arch:** update ai-sidebar architecture diagram ([48b3886](https://github.com/skyasu2/openmanager-ai/commit/48b38867c282ff487fcc8a557854a3f160100269))
* **arch:** update dashboard architecture diagram per live inspection ([7d99eed](https://github.com/skyasu2/openmanager-ai/commit/7d99eed9db3d2e98d3ba2d040fd33680b3ef142f))
* **arch:** update version to v5.80.0 and add version API test ([de4f9d3](https://github.com/skyasu2/openmanager-ai/commit/de4f9d3403076eaf07032de4e48e146f8689d167))
* clarify ENDPOINT differences between services ([f964b6c](https://github.com/skyasu2/openmanager-ai/commit/f964b6ce5e369596ba5556c1b85d5215e364690a))
* **CLAUDE.md:** add autonomous subagent usage principles ([c11ba84](https://github.com/skyasu2/openmanager-ai/commit/c11ba84707ddd8bff7f5a65661213688970f68ff))
* clean up miscellaneous documentation ([fcc57a5](https://github.com/skyasu2/openmanager-ai/commit/fcc57a50762654830088839972afc2fcd82a7d6b))
* consolidate duplicate test:vercel:e2e entries in DEVELOPMENT.md ([b930ba2](https://github.com/skyasu2/openmanager-ai/commit/b930ba2971ab2bb19f5e4b9cc286b95511682c26))
* **core:** restructure architecture with design folder content ([dd013bf](https://github.com/skyasu2/openmanager-ai/commit/dd013bf9a04a3a1c561c74e66e230266f0c407c1))
* **data:** update Vibe Coding evolution & GCP Cloud Run migration ([dd9ca11](https://github.com/skyasu2/openmanager-ai/commit/dd9ca1133078642f3c161e997f9b087b035f9925))
* **development:** reorganize development documentation ([b034e45](https://github.com/skyasu2/openmanager-ai/commit/b034e4510a84e1c00b1a4e9147db7e05acfe1d05))
* **environment:** consolidate to development folder ([48a679f](https://github.com/skyasu2/openmanager-ai/commit/48a679f267c68cf11ea30ac4c957f73fcfc4a8f8))
* **environment:** WSL 재설치 복원 가이드 추가 ([c7397df](https://github.com/skyasu2/openmanager-ai/commit/c7397df92f643e75d628b9c16096b7433c5ad11f))
* **feature-cards:** Vibe Coding 카드 내용 현행화 ([19c1527](https://github.com/skyasu2/openmanager-ai/commit/19c15272906717b2beb17cea30887cb1b1951691))
* fix additional broken document path references ([363c61a](https://github.com/skyasu2/openmanager-ai/commit/363c61a1242ff3153c18c3e0eb8ac059480c98a7))
* fix broken document path references after reorganization ([305418f](https://github.com/skyasu2/openmanager-ai/commit/305418f10283aeb3675e59ad4a3b9f33dfe287a3))
* fix broken links after architecture docs reorganization ([fac4dfe](https://github.com/skyasu2/openmanager-ai/commit/fac4dfefcd233d6ec16cdac970d27f5c33945a0b))
* fix path errors and remove 7 duplicate/obsolete files ([af35f22](https://github.com/skyasu2/openmanager-ai/commit/af35f2209a1eb4e59e129542c93ca7fdf71d2335))
* integrate AI docs into core/ and development/ structure ([644bb57](https://github.com/skyasu2/openmanager-ai/commit/644bb577ec502f3ed5835d7fffa6e5b5a2a3da7c))
* major-version-upgrade-plan.md 완료 상태 업데이트 ([ca35d4f](https://github.com/skyasu2/openmanager-ai/commit/ca35d4fff0bab0a3ba3cef028f955c798b461b7d))
* MCP 12/12 상태 동기화 및 테스트 문서 현행화 ([fcca959](https://github.com/skyasu2/openmanager-ai/commit/fcca959867e3fe75bbc87ae0b670fe40afb05af4))
* MCP 서버 12/12 업데이트 - filesystem 제거, brave-search 추가 ([d575c03](https://github.com/skyasu2/openmanager-ai/commit/d575c036f2fbe61625b41fd60539d6d1635ab0bd))
* **mcp:** sync server configurations with .mcp.json ([eca2fae](https://github.com/skyasu2/openmanager-ai/commit/eca2fae701e869ea8f253b7c5fa7968f68fbd1cb))
* **mock:** Mock 시스템 현황 문서화 (README 추가) ([f0a0735](https://github.com/skyasu2/openmanager-ai/commit/f0a0735f7b620f05e167dc9928fd6f05f942df2a))
* **mock:** Mock 시스템 현황 문서화 및 역할 명확화 ([5f768ec](https://github.com/skyasu2/openmanager-ai/commit/5f768ec72be5342e15290999285ca70757b81196))
* organize development AI docs by tool type ([e106caa](https://github.com/skyasu2/openmanager-ai/commit/e106caa379e2b30e1f2449e5d094a22c37aa4c77))
* **performance:** GPU animation validation guide (Day 3/3 - 120fps verification) ([4502bca](https://github.com/skyasu2/openmanager-ai/commit/4502bca5b52ec7e6bb803cb9daf5013d029298aa))
* Phase 1-4 패키지 업그레이드 문서 동기화 ([0b1924c](https://github.com/skyasu2/openmanager-ai/commit/0b1924c41594d2f584a27b6859fa3d584ccb5e39))
* Phase 4 재구조화 완료 - core vs environment 분리 ([fd125c9](https://github.com/skyasu2/openmanager-ai/commit/fd125c981ecd7cd4fe9048f6a69cc9f07d6a73a1))
* **planning:** cleanup - archive completed reviews ([f140f4d](https://github.com/skyasu2/openmanager-ai/commit/f140f4dfca6a085d0f349742bd59c2bbf301cf49))
* **planning:** update improvement plan with completed phases ([171a1d1](https://github.com/skyasu2/openmanager-ai/commit/171a1d106de71cbea71103d175c11db501681f09))
* **readme:** modernize README with professional focus ([66664ff](https://github.com/skyasu2/openmanager-ai/commit/66664ffcbba10b194eae64b376d33e183dd8e6b8))
* remove deprecated ml-analytics-engine from Docker docs ([3a0e14b](https://github.com/skyasu2/openmanager-ai/commit/3a0e14b058e2dba2e24636beadf1a141a3f8e252))
* remove design folder (merged into architecture) ([cee4aac](https://github.com/skyasu2/openmanager-ai/commit/cee4aac4e4b7a03034e4bd243a9f296d4015e8f6))
* reorganize analysis files to archive directory ([97ec426](https://github.com/skyasu2/openmanager-ai/commit/97ec426d4cc05619a6acd4a185a904035aa7a3a2))
* reorganize architecture docs - move review to analysis, delete outdated ([6ca425f](https://github.com/skyasu2/openmanager-ai/commit/6ca425fab44a862721dfb5cef69136bdf5869369))
* reorganize documentation structure (JBGE principle) ([a9b10b1](https://github.com/skyasu2/openmanager-ai/commit/a9b10b1527c639a9ad421faf1698d3ee4e626071))
* **schemas:** add Zod v4 migration comments ([e62a555](https://github.com/skyasu2/openmanager-ai/commit/e62a555173c794865c32a853e2e8654a7fb8e271))
* **security:** improve GitHub OAuth documentation based on AI review ([993fd34](https://github.com/skyasu2/openmanager-ai/commit/993fd34d0732cfe541f6ee2c6291818f50f969c0))
* **status:** add measurement methodology and timestamp (Codex 8/10→10/10) ([5ee3bcb](https://github.com/skyasu2/openmanager-ai/commit/5ee3bcb366fb227826e4aa141f8b4faf21f4d8c3))
* **status:** sync codebase metrics with actual measurements ([7747c7b](https://github.com/skyasu2/openmanager-ai/commit/7747c7bb0d768a4485bdd23d662de180422acf5c))
* **status:** update E2E test count for Feature Cards ([545493c](https://github.com/skyasu2/openmanager-ai/commit/545493cc32cfa5a613073394eba05f2bc5316534))
* sync DOCKER_ECOSYSTEM.md with actual docker-compose state ([1e6cdfa](https://github.com/skyasu2/openmanager-ai/commit/1e6cdfab4b4cd73cb5d209c034a543eaf9f07686))
* sync documentation with v5.80.0 current state ([e5e7553](https://github.com/skyasu2/openmanager-ai/commit/e5e7553276573b2a4acf84e1ef95e84c894260b1))
* synchronize MCP configuration with CLAUDE.md ([ead1ede](https://github.com/skyasu2/openmanager-ai/commit/ead1ede86fec1f3f5d7e3481f0918c5c68149946))
* **tech-stacks:** Vibe Coding 모달 데이터 현행화 ([547ed46](https://github.com/skyasu2/openmanager-ai/commit/547ed46ec615acce49c24e44069dd153d6fe2405))
* TODO 정리 및 완료 작업 아카이브 ([6ff9d14](https://github.com/skyasu2/openmanager-ai/commit/6ff9d14330801f3352d97d75ee94fea6e824248b))
* update AI configuration and agent definitions ([dfb017f](https://github.com/skyasu2/openmanager-ai/commit/dfb017fed4b8b88af48a6b8788726fda03455107))
* update AI system documentation and fix ESLint errors ([7ce645c](https://github.com/skyasu2/openmanager-ai/commit/7ce645c024ba590629b64afa6f10ac53233f8fff))
* update CHANGELOG with 21 missing commits ([4403efe](https://github.com/skyasu2/openmanager-ai/commit/4403efe0ab03c73b6b099d0b005e8a0d8294d1ca))
* update CLAUDE.md references ([8207c6c](https://github.com/skyasu2/openmanager-ai/commit/8207c6ccac2a0f88cafc290f403a3351ca4a8142))
* update documentation for Cloud Run LangGraph architecture ([1bccace](https://github.com/skyasu2/openmanager-ai/commit/1bccacea9c9d6fee2b58da22e2eab02e5d41e79a))
* update GitHub OAuth & Guest authentication documentation ([506e176](https://github.com/skyasu2/openmanager-ai/commit/506e176baee905c489a84ce7198cc73b99279673))
* update improvement-plan.md with accurate phase statuses ([6b6b564](https://github.com/skyasu2/openmanager-ai/commit/6b6b564ad5700fd277512d2938e479e3ede45b9a))
* update improvement-plan.md with Phase 2.2 completion status ([1a35591](https://github.com/skyasu2/openmanager-ai/commit/1a35591a080a029f702d827e459b0b2639b5638b))
* update improvement-plan.md with Phase 3 completion status ([e0ca65d](https://github.com/skyasu2/openmanager-ai/commit/e0ca65d027fc9c8bf4acd0555f8bc00b401f6b58))
* update improvement-plan.md with Phase 3.1 completion status ([782d9af](https://github.com/skyasu2/openmanager-ai/commit/782d9af2a929c41f3c8f80f03ecade758d38237e))
* update references to deleted npm scripts ([655b58a](https://github.com/skyasu2/openmanager-ai/commit/655b58a23c6a3b98070a48f55633adc1f0809288))
* update script consolidation plan to v2.0.0 ([a9d7ea7](https://github.com/skyasu2/openmanager-ai/commit/a9d7ea77c0aeeda1c632a66452b1202d4035ed4e))
* update statistics after Phase 5 cleanup (311→300 files) ([cc9657b](https://github.com/skyasu2/openmanager-ai/commit/cc9657b47c6616f15b1db91bcfd77547b7f073e4))
* v5.80.0 post-upgrade maintenance 기록 업데이트 ([df33697](https://github.com/skyasu2/openmanager-ai/commit/df33697d36921c1d5696d2bde478650239ee40f4))
* 문서 정리 및 스크립트 참조 업데이트 ([9acca2f](https://github.com/skyasu2/openmanager-ai/commit/9acca2f6e16cc9ac81422c0f40e8d3f9afdbe6ba))
* 작업 계획서 정리 - 완료된 계획 아카이브 + TODO.md 통합 ([6a05857](https://github.com/skyasu2/openmanager-ai/commit/6a058575f1d11ea513cd6c0092ad87c4644c4cfb))


---

> 이전 버전 기록 (v5.80.0 이전)은 [reports/history/changelog/](./reports/history/changelog/)를 참조하세요.
