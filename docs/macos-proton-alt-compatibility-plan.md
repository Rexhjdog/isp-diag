# Steam Deck Compatibility Stack Research + macOS "CrossOver-like" Alternative (Without Wine Core)

## 1) What Steam Deck is actually using

Steam Deck (SteamOS) game compatibility for Windows titles is primarily driven by **Proton**, which is Valve’s distribution of:

- Wine user-space compatibility layers
- DXVK (Direct3D 9/10/11 → Vulkan)
- VKD3D-Proton (Direct3D 12 → Vulkan)
- Pressure Vessel / containerized runtime pieces
- Supplemental patches + Steam integration for controller, launch options, shader processing, anti-cheat integrations, and per-title fixes

So, if by “Steam frame” you mean Steam Deck’s runtime/compatibility stack, the core “emulation tool” is **Proton** (which itself is Wine-based, plus translation and runtime tech).

## 2) Why simply “port Proton to macOS” is not enough

A direct drop-in port of Proton to macOS runs into structural constraints:

1. Proton expects Linux behavior (syscalls, graphics stack assumptions, runtime/container assumptions).
2. Proton’s graphics translation is centered around **Vulkan**, while macOS is **Metal-first**.
3. Windows anti-cheat, kernel drivers, and launcher quirks require substantial per-title integration work.
4. Wine-derived components remain central in Proton; replacing Wine while retaining broad compatibility is a deep engineering effort.

## 3) The key design decision for your request

You asked for a CrossOver-like product **that does not use Wine** and instead uses “that emulation tool.” Since Proton itself includes Wine, the best interpretation is:

- Build a **new macOS compatibility platform** that is **not Wine-based at the core**.
- Target improved performance and reduced translation overhead, especially for D3D12-era games.

A realistic non-Wine path is to combine:

- **Hardware-assisted VM execution** (Apple Virtualization Framework + Hypervisor)
- **Paravirtualized graphics API forwarding** from a Windows guest to host Metal
- A custom graphics translation/runtime stack designed for low-overhead command streaming

Think of it as a **game-focused virtualization platform** rather than API reimplementation.

## 4) Proposed product architecture ("AstraBridge" codename)

### 4.1 High-level

- **Host app (macOS)**: launcher, bottle/profile manager, controller mapping, game library integration, shader cache manager.
- **Windows guest runtime** (minimal image): runs game binaries in near-native environment.
- **Bridge driver pair**:
  - Guest-side shim/driver captures D3D calls/commands.
  - Host-side service converts commands to Metal execution primitives.
- **I/O acceleration**: shared memory rings, zero-copy resource upload where possible, async pipeline compilation.

### 4.2 Core modules

1. **VM Orchestrator**
   - Start/stop snapshots
   - Per-game profiles (CPU topology, memory, scheduling)
   - Suspend/resume quick-launch

2. **Graphics Bridge (non-Wine)**
   - D3D11 and D3D12 interception in guest (driver-layer or runtime-layer)
   - Serialized command stream protocol to host
   - Host Metal backend with command queue reconstruction

3. **Shader Toolchain**
   - DXIL/SPIR-V ingestion (depending on capture layer)
   - Metal shader conversion + cache database
   - Pipeline state object pre-warming for stutter reduction

4. **Input/Audio Bridge**
   - Low-latency HID forwarding
   - XInput emulation behavior in guest
   - Spatial audio path mapping to CoreAudio

5. **Storage / Prefix Model**
   - App-managed game containers
   - File system mapping and save-sync hooks
   - Crash-safe snapshots and rollback

6. **Compatibility Intelligence Layer**
   - Per-title launch recipes
   - Auto patching toggles and known-good config distribution
   - Telemetry-driven heuristics (opt-in)

## 5) Performance strategy to narrow the D3D→Metal gap

### 5.1 Avoid expensive translation patterns

- Prefer **command list forwarding** over repeated high-level API re-materialization.
- Batch resource state transitions aggressively.
- Build a deterministic PSO cache key model that survives driver updates when possible.

### 5.2 Frame pacing

- Triple-buffer policy tuning per title.
- Async compilation fallback path with temporary lower-complexity shaders.
- Precompile hot pipelines on first launch and cache persistently.

### 5.3 Memory and streaming

- Use shared pages for transient upload buffers.
- Compression-aware texture streaming pipeline with background transcoding.
- Avoid CPU-GPU sync points in bridge protocol.

### 5.4 CPU scheduling

- Pin high-priority game threads appropriately in guest.
- Host-side QoS mapping to reduce stutter under system load.

## 6) Practical implementation roadmap (12–18 months)

### Phase 0 (0–6 weeks): feasibility spikes

- Validate VM startup + GPU path feasibility on Apple Silicon.
- Prototype D3D12 command capture in guest.
- Prototype host Metal command replay for a synthetic scene.

### Phase 1 (2–4 months): vertical slice

- One supported game from launch to in-game rendering.
- Input/audio pass-through.
- Baseline shader cache.

### Phase 2 (4–8 months): compatibility expansion

- Broaden D3D11/12 coverage.
- Per-title profile system.
- Installer/launcher integration and update channel.

### Phase 3 (8–12 months): productization

- UX polish, crash reporting, compatibility DB.
- Anti-cheat compatibility review matrix.
- Public beta with limited game whitelist.

## 7) Risks and mitigations

1. **Anti-cheat/kernel dependencies**
   - Mitigation: clearly badge unsupported titles; focus first on single-player/co-op non-kernel anti-cheat games.

2. **Graphics correctness debt**
   - Mitigation: conformance test farm + replay captures + automated frame diffing.

3. **Maintenance burden**
   - Mitigation: strict module boundaries and protocol versioning between guest/host.

4. **Licensing/compliance**
   - Mitigation: legal review before bundling proprietary components; SBOM and reproducible build pipeline.

## 8) MVP definition (what to ship first)

An MVP that can actually win users:

- Apple Silicon only (initially)
- D3D12-focused path + partial D3D11 fallback
- 10–20 curated game support list
- One-click game profile install
- Shader pre-warming + stutter diagnostics panel

## 9) What this means for your original ask

- The Steam Deck’s compatibility stack is **Proton**.
- A true “CrossOver-like but not Wine-based” product is feasible only as a **virtualization + graphics-bridge** platform, not a simple Proton transplant.
- The best shot at performance gains is minimizing translation overhead via a low-level bridge and aggressive shader/pipeline caching.

## 10) Immediate next steps to start building now

1. Build a tiny prototype repo with:
   - macOS host controller app
   - Windows guest test harness
   - shared-memory command ring proof-of-concept
2. Implement a minimal D3D12 draw-call forwarding demo.
3. Measure frame time variance and compile stutter on 2 benchmark scenes.
4. Decide protocol versioning before scaling API coverage.

---

If you want, the next deliverable can be a concrete **technical spec package** with:

- API/protocol definitions (guest↔host)
- process model and security boundaries
- shader cache schema
- milestone-by-milestone engineering staffing plan
