document.addEventListener('DOMContentLoaded', () => {
    // -----------------------------------------------------------------
    // Navigation / Tabs Controller
    // -----------------------------------------------------------------
    const navItems = document.querySelectorAll('.nav-item');
    const tabPanels = document.querySelectorAll('.tab-panel');
    const currentTabTitle = document.getElementById('current-tab-title');
    const currentTabDesc = document.getElementById('current-tab-desc');

    const tabMetadata = {
        'arena-sim': {
            title: 'Arena Allocator Visualizer',
            desc: 'Simulate bump allocation and dynamic alignment padding in real time.'
        },
        'pool-sim': {
            title: 'Pool Allocator Visualizer',
            desc: 'Simulate memory reuse and intrusive free list operations with zero metadata overhead.'
        },
        'benchmarks': {
            title: 'Performance Benchmark Dashboard',
            desc: 'Execute real-time microbenchmarks comparing custom allocators directly inside the browser.'
        },
        'code-view': {
            title: 'C++ Source Code Explorer',
            desc: 'Browse actual production C++ files and header files from the workspace.'
        },
        'sandbox': {
            title: 'C++ Code Sandbox',
            desc: 'Paste custom C++ allocator code, parse it, and simulate allocations visually step-by-step.'
        }
    };

    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const targetTab = item.dataset.tab;
            
            // Toggle active classes in nav
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');

            // Toggle active panels
            tabPanels.forEach(panel => {
                panel.classList.remove('active');
                if (panel.id === `${targetTab}-panel`) {
                    panel.classList.add('active');
                }
            });

            // Update title/description
            currentTabTitle.textContent = tabMetadata[targetTab].title;
            currentTabDesc.textContent = tabMetadata[targetTab].desc;

            // Trigger code view fetch if opening code explorer
            if (targetTab === 'code-view') {
                loadSelectedFile();
            }
        });
    });

    // -----------------------------------------------------------------
    // Arena Simulator Implementation
    // -----------------------------------------------------------------
    class ArenaSimulator {
        constructor(size = 256) {
            this.size = size;
            this.bumpPtr = 0;
            this.allocations = []; // Array of { id, start, size, alignment, padding }
            this.allocationCount = 0;
        }

        allocate(size, alignment) {
            // Alignment padding calculation: (alignment - (bumpPtr % alignment)) % alignment
            const padding = (alignment - (this.bumpPtr % alignment)) % alignment;
            const totalRequired = padding + size;

            if (this.bumpPtr + totalRequired > this.size) {
                return { success: false, error: 'Out of Memory: Arena capacity exceeded.' };
            }

            const startAddr = this.bumpPtr;
            const payloadAddr = startAddr + padding;

            this.allocationCount++;
            const newAlloc = {
                id: this.allocationCount,
                start: startAddr,
                size: size,
                alignment: alignment,
                padding: padding,
                payloadStart: payloadAddr
            };

            this.allocations.push(newAlloc);
            this.bumpPtr += totalRequired;
            return { success: true, allocation: newAlloc };
        }

        reset() {
            this.bumpPtr = 0;
            this.allocations = [];
            this.allocationCount = 0;
        }

        getUsedMemory() {
            return this.bumpPtr;
        }

        getEfficiency() {
            if (this.bumpPtr === 0) return 100;
            let payloadBytes = 0;
            this.allocations.forEach(a => payloadBytes += a.size);
            return Math.round((payloadBytes / this.bumpPtr) * 100);
        }
    }

    // Arena DOM Elements & Handlers
    const arenaMapGrid = document.getElementById('arena-memory-map-grid');
    const arenaLogEntries = document.getElementById('arena-log-entries');
    const arenaSizeInput = document.getElementById('arena-buffer-size');
    const arenaAllocSizeInput = document.getElementById('arena-alloc-size');
    const arenaAllocAlignSelect = document.getElementById('arena-alloc-align');
    
    const arenaUsedVal = document.getElementById('arena-used-val');
    const arenaFreeVal = document.getElementById('arena-free-val');
    const arenaEffVal = document.getElementById('arena-eff-val');

    let currentArena = new ArenaSimulator(parseInt(arenaSizeInput.value));

    function logArenaMsg(msg, type = 'system-msg') {
        const entry = document.createElement('div');
        entry.className = `log-entry ${type}`;
        entry.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
        arenaLogEntries.appendChild(entry);
        arenaLogEntries.scrollTop = arenaLogEntries.scrollHeight;
    }

    function renderArenaGrid() {
        arenaMapGrid.innerHTML = '';
        const totalSize = currentArena.size;
        
        // Setup allocation color index map
        const cellStates = Array(totalSize).fill(null); // stores { type: 'allocated'|'padding', id }
        
        currentArena.allocations.forEach(alloc => {
            // Mark padding
            for (let i = 0; i < alloc.padding; i++) {
                cellStates[alloc.start + i] = { type: 'padding', id: alloc.id };
            }
            // Mark payload
            for (let i = 0; i < alloc.size; i++) {
                cellStates[alloc.payloadStart + i] = { type: 'allocated', id: alloc.id };
            }
        });

        for (let i = 0; i < totalSize; i++) {
            const cell = document.createElement('div');
            cell.className = 'byte-cell';
            
            // Add Address info tooltips / attributes
            cell.title = `Address: 0x${i.toString(16).toUpperCase().padStart(3, '0')} (${i})`;
            
            if (cellStates[i]) {
                cell.classList.add(cellStates[i].type);
                if (cellStates[i].type === 'allocated') {
                    cell.textContent = `A${cellStates[i].id}`;
                } else {
                    cell.textContent = 'P';
                }
            } else {
                cell.textContent = '00';
            }

            if (i === currentArena.bumpPtr) {
                cell.classList.add('bump-ptr');
            }

            arenaMapGrid.appendChild(cell);
        }

        // Update stats
        const used = currentArena.getUsedMemory();
        arenaUsedVal.textContent = `${used} B`;
        arenaFreeVal.textContent = `${totalSize - used} B`;
        arenaEffVal.textContent = `${currentArena.getEfficiency()}%`;
    }

    // Arena Controls Event Listeners
    document.getElementById('arena-allocate-btn').addEventListener('click', () => {
        const size = parseInt(arenaAllocSizeInput.value);
        const align = parseInt(arenaAllocAlignSelect.value);

        if (isNaN(size) || size <= 0) {
            logArenaMsg('Error: Invalid allocation size.', 'warn-msg');
            return;
        }

        const result = currentArena.allocate(size, align);
        if (result.success) {
            logArenaMsg(`Allocated ${size} bytes (aligned to ${align}) at offset ${result.allocation.payloadStart}. Padding: ${result.allocation.padding} B.`, 'alloc-msg');
            renderArenaGrid();
        } else {
            logArenaMsg(result.error, 'warn-msg');
        }
    });

    document.getElementById('arena-reset-btn').addEventListener('click', () => {
        currentArena.reset();
        logArenaMsg('Arena cleared/reset.', 'system-msg');
        renderArenaGrid();
    });

    arenaSizeInput.addEventListener('change', () => {
        let size = parseInt(arenaSizeInput.value);
        if (isNaN(size) || size < 64) size = 64;
        arenaSizeInput.value = size;
        currentArena = new ArenaSimulator(size);
        logArenaMsg(`Arena capacity reconfigured to ${size} bytes.`, 'system-msg');
        renderArenaGrid();
    });

    // Initialize Arena Simulator View
    renderArenaGrid();


    // -----------------------------------------------------------------
    // Pool Simulator Implementation
    // -----------------------------------------------------------------
    class PoolSimulator {
        constructor(totalSize = 256, blockSize = 32, alignment = 8) {
            this.totalSize = totalSize;
            
            // Align block size up to block alignment
            this.alignment = alignment;
            this.actualBlockSize = Math.ceil(blockSize / alignment) * alignment;
            this.maxBlocks = Math.floor(totalSize / this.actualBlockSize);
            
            this.blocks = []; // Array of { index, isAllocated, nextIndex }
            this.freeListHead = null;
            this.allocatedCount = 0;
            
            this.reset();
        }

        reset() {
            this.blocks = [];
            this.allocatedCount = 0;
            
            if (this.maxBlocks === 0) {
                this.freeListHead = null;
                return;
            }

            // Build free list in LIFO order (prepending) exactly matching C++ implementation
            let head = null;
            for (let i = 0; i < this.maxBlocks; i++) {
                this.blocks.push({
                    index: i,
                    isAllocated: false,
                    nextIndex: head
                });
                head = i;
            }
            this.freeListHead = head;
        }

        allocate() {
            if (this.freeListHead === null) {
                return { success: false, error: 'Out of Memory: No free blocks remaining in Pool.' };
            }

            const allocatedIndex = this.freeListHead;
            const block = this.blocks[allocatedIndex];
            
            // Pop head from Free List
            this.freeListHead = block.nextIndex;
            block.isAllocated = true;
            block.nextIndex = null;
            this.allocatedCount++;

            return { success: true, index: allocatedIndex };
        }

        deallocate(index) {
            if (index < 0 || index >= this.maxBlocks) {
                return { success: false, error: `Invalid index: Pool contains blocks 0 to ${this.maxBlocks - 1}.` };
            }
            const block = this.blocks[index];
            if (!block.isAllocated) {
                return { success: false, error: `Block ${index} is already free.` };
            }

            // Push back on Free List head
            block.isAllocated = false;
            block.nextIndex = this.freeListHead;
            this.freeListHead = index;
            this.allocatedCount--;

            return { success: true };
        }
    }

    // Pool DOM Elements & Handlers
    const poolMapGrid = document.getElementById('pool-memory-map-grid');
    const poolLogEntries = document.getElementById('pool-log-entries');
    const poolSizeInput = document.getElementById('pool-buffer-size');
    const poolBlockSizeInput = document.getElementById('pool-block-size');
    const poolAlignmentSelect = document.getElementById('pool-alignment');
    
    const poolAllocatedVal = document.getElementById('pool-allocated-val');
    const poolActualSizeVal = document.getElementById('pool-actual-size-val');
    const poolHeadVal = document.getElementById('pool-head-val');
    const poolDeallocInput = document.getElementById('pool-dealloc-index');

    let currentPool = new PoolSimulator(
        parseInt(poolSizeInput.value),
        parseInt(poolBlockSizeInput.value),
        parseInt(poolAlignmentSelect.value)
    );

    function logPoolMsg(msg, type = 'system-msg') {
        const entry = document.createElement('div');
        entry.className = `log-entry ${type}`;
        entry.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
        poolLogEntries.appendChild(entry);
        poolLogEntries.scrollTop = poolLogEntries.scrollHeight;
    }

    function renderPoolGrid() {
        poolMapGrid.innerHTML = '';
        const blocks = currentPool.blocks;
        const head = currentPool.freeListHead;

        blocks.forEach(block => {
            const blockDiv = document.createElement('div');
            blockDiv.className = 'pool-block';
            if (block.isAllocated) {
                blockDiv.classList.add('allocated');
            }
            if (block.index === head) {
                blockDiv.classList.add('is-head');
            }

            const indexSpan = document.createElement('div');
            indexSpan.className = 'block-index';
            indexSpan.textContent = `Block ${block.index} [offset: ${block.index * currentPool.actualBlockSize} B]`;
            blockDiv.appendChild(indexSpan);

            const stateDiv = document.createElement('div');
            stateDiv.className = 'block-state';
            stateDiv.textContent = block.isAllocated ? 'ALLOCATED' : 'FREE';
            blockDiv.appendChild(stateDiv);

            const ptrDiv = document.createElement('div');
            ptrDiv.className = 'block-pointer';
            if (block.isAllocated) {
                ptrDiv.innerHTML = '<i class="fa-solid fa-ban text-muted"></i> No Link';
            } else {
                const nextVal = block.nextIndex !== null ? `Block ${block.nextIndex}` : 'NULL';
                ptrDiv.innerHTML = `<i class="fa-solid fa-arrow-right text-cyan"></i> next -> ${nextVal}`;
            }
            blockDiv.appendChild(ptrDiv);

            poolMapGrid.appendChild(blockDiv);
        });

        // Update stats
        poolAllocatedVal.textContent = `${currentPool.allocatedCount} / ${currentPool.maxBlocks}`;
        poolActualSizeVal.textContent = `${currentPool.actualBlockSize} B (aligned)`;
        poolHeadVal.textContent = head !== null ? `Block ${head}` : 'NULL (FULL)';
        poolDeallocInput.max = currentPool.maxBlocks - 1;
    }

    // Pool Controls Event Listeners
    document.getElementById('pool-allocate-btn').addEventListener('click', () => {
        const result = currentPool.allocate();
        if (result.success) {
            logPoolMsg(`Allocated Block ${result.index}.`, 'alloc-msg');
            renderPoolGrid();
        } else {
            logPoolMsg(result.error, 'warn-msg');
        }
    });

    document.getElementById('pool-deallocate-btn').addEventListener('click', () => {
        const index = parseInt(poolDeallocInput.value);
        if (isNaN(index)) {
            logPoolMsg('Error: Invalid block index.', 'warn-msg');
            return;
        }

        const result = currentPool.deallocate(index);
        if (result.success) {
            logPoolMsg(`Deallocated Block ${index} and pushed back onto Free List.`, 'dealloc-msg');
            renderPoolGrid();
        } else {
            logPoolMsg(result.error, 'warn-msg');
        }
    });

    document.getElementById('pool-reset-btn').addEventListener('click', () => {
        currentPool.reset();
        logPoolMsg('Pool allocator reset.', 'system-msg');
        renderPoolGrid();
    });

    document.getElementById('pool-reconfig-btn').addEventListener('click', () => {
        const totalSize = parseInt(poolSizeInput.value);
        const blockSize = parseInt(poolBlockSizeInput.value);
        const alignment = parseInt(poolAlignmentSelect.value);

        if (isNaN(totalSize) || totalSize < 64) {
            logPoolMsg('Error: Total size must be at least 64 bytes.', 'warn-msg');
            return;
        }
        if (isNaN(blockSize) || blockSize <= 0) {
            logPoolMsg('Error: Block size must be greater than 0.', 'warn-msg');
            return;
        }

        currentPool = new PoolSimulator(totalSize, blockSize, alignment);
        logPoolMsg(`Pool reconfigured: size=${totalSize}B, block size=${blockSize}B, alignment=${alignment}B. Total blocks: ${currentPool.maxBlocks}.`, 'system-msg');
        renderPoolGrid();
    });

    // Initialize Pool Simulator View
    renderPoolGrid();


    // -----------------------------------------------------------------
    // Benchmarks Implementation
    // -----------------------------------------------------------------
    const runBenchBtn = document.getElementById('run-benchmarks-btn');
    
    const arenaStdBar = document.getElementById('arena-std-bar');
    const arenaCustomBar = document.getElementById('arena-custom-bar');
    const arenaStdTime = document.getElementById('arena-std-time');
    const arenaCustomTime = document.getElementById('arena-custom-time');
    const arenaSpeedupBox = document.getElementById('arena-speedup-box');
    const arenaSpeedupVal = document.getElementById('arena-speedup-val');

    const poolStdBar = document.getElementById('pool-std-bar');
    const poolCustomBar = document.getElementById('pool-custom-bar');
    const poolStdTime = document.getElementById('pool-std-time');
    const poolCustomTime = document.getElementById('pool-custom-time');
    const poolSpeedupBox = document.getElementById('pool-speedup-box');
    const poolSpeedupVal = document.getElementById('pool-speedup-val');

    runBenchBtn.addEventListener('click', () => {
        runBenchBtn.disabled = true;
        runBenchBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Running Benchmarks...';

        // Perform measurements inside setTimeout to avoid blocking browser main thread rendering
        setTimeout(() => {
            // 1. Arena Simulator Benchmark in JS
            const numFrames = 500;
            const allocsPerFrame = 500;

            // Standard Allocations Benchmark
            const t0 = performance.now();
            for (let f = 0; f < numFrames; f++) {
                let frameList = [];
                for (let a = 0; a < allocsPerFrame; a++) {
                    // Simulating heavy individual objects
                    frameList.push({ data: new Int32Array(8) });
                }
                // Freeing by letting GC handle them
                frameList = null;
            }
            const t1 = performance.now();
            const arenaStdDuration = t1 - t0;

            // Custom Arena Allocations Simulation
            const t2 = performance.now();
            const arenaSimBuffer = new ArrayBuffer(500000); // 500 KB preallocated
            for (let f = 0; f < numFrames; f++) {
                let offset = 0;
                for (let a = 0; a < allocsPerFrame; a++) {
                    const alignment = 8;
                    const padding = (alignment - (offset % alignment)) % alignment;
                    const size = 32;
                    // Bump allocator logic
                    const ptr = offset + padding;
                    offset = ptr + size;
                }
                // Reset is O(1)
                offset = 0;
            }
            const t3 = performance.now();
            const arenaCustomDuration = t3 - t2;

            // 2. Pool Simulator Benchmark in JS
            const numBlocks = 100000;
            
            // Standard Array insertions/deletions (general heap)
            const t4 = performance.now();
            let stdArr = [];
            for (let i = 0; i < numBlocks; i++) {
                stdArr.push({ data: new Int32Array(8) });
            }
            for (let i = 0; i < numBlocks; i++) {
                stdArr[i] = null;
            }
            stdArr = null;
            const t5 = performance.now();
            const poolStdDuration = t5 - t4;

            // Custom Free List Pool Allocator Simulation
            const t6 = performance.now();
            const poolSize = 100000;
            const poolList = Array(poolSize);
            let freeListHead = 0;
            // Prep linked list
            for (let i = 0; i < poolSize; i++) {
                poolList[i] = i + 1;
            }
            poolList[poolSize - 1] = null;

            // Allocate
            let allocatedNodes = Array(poolSize);
            for (let i = 0; i < poolSize; i++) {
                const node = freeListHead;
                freeListHead = poolList[node];
                allocatedNodes[i] = node;
            }
            // Deallocate
            for (let i = 0; i < poolSize; i++) {
                const node = allocatedNodes[i];
                poolList[node] = freeListHead;
                freeListHead = node;
            }
            const t7 = performance.now();
            const poolCustomDuration = t7 - t6;

            // Display timings and chart updates
            arenaStdTime.textContent = `${arenaStdDuration.toFixed(2)} ms`;
            arenaCustomTime.textContent = `${arenaCustomDuration.toFixed(2)} ms`;
            
            const arenaSpeedup = arenaStdDuration / arenaCustomDuration;
            arenaSpeedupVal.textContent = `${arenaSpeedup.toFixed(1)}x`;
            arenaSpeedupBox.classList.remove('hide');
            
            arenaStdBar.style.width = '100%';
            arenaCustomBar.style.width = `${Math.max(2, (100 / arenaSpeedup))}%`;

            poolStdTime.textContent = `${poolStdDuration.toFixed(2)} ms`;
            poolCustomTime.textContent = `${poolCustomDuration.toFixed(2)} ms`;
            
            const poolSpeedup = poolStdDuration / poolCustomDuration;
            poolSpeedupVal.textContent = `${poolSpeedup.toFixed(1)}x`;
            poolSpeedupBox.classList.remove('hide');

            poolStdBar.style.width = '100%';
            poolCustomBar.style.width = `${Math.max(2, (100 / poolSpeedup))}%`;

            runBenchBtn.disabled = false;
            runBenchBtn.innerHTML = '<i class="fa-solid fa-play"></i> Run Live Benchmarks';
        }, 100);
    });


    // -----------------------------------------------------------------
    // Code Explorer Implementation
    // -----------------------------------------------------------------
    const fileSelector = document.getElementById('code-file-select');
    const filePathDisplay = document.getElementById('file-path-text');
    const codeContentArea = document.getElementById('code-content-area');
    const lineNumbersDiv = document.getElementById('code-line-numbers');

    function loadSelectedFile() {
        const fileName = fileSelector.value;
        filePathDisplay.textContent = `/d:/CPPProject/${fileName}`;
        codeContentArea.textContent = `Fetching and loading ${fileName}...`;
        lineNumbersDiv.innerHTML = '';

        fetch(fileName)
            .then(res => {
                if (!res.ok) throw new Error('File not found');
                return res.text();
            })
            .then(text => {
                // Highlight text
                const highlighted = highlightCPP(text);
                codeContentArea.innerHTML = highlighted;
                
                // Generate line numbers
                const lineCount = text.split('\n').length;
                let lineNums = '';
                for (let i = 1; i <= lineCount; i++) {
                    lineNums += `${i}\n`;
                }
                lineNumbersDiv.style.whiteSpace = 'pre';
                lineNumbersDiv.textContent = lineNums;
            })
            .catch(err => {
                codeContentArea.textContent = `Error loading file: ${err.message}\nEnsure the local python server is running in the workspace directory.`;
            });
    }

    fileSelector.addEventListener('change', loadSelectedFile);

    // Simple custom C++ regex highlighter
    function highlightCPP(code) {
        // Safe HTML escaping
        let esc = code
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');

        // 1. Strings first (avoid matching keywords inside strings)
        esc = esc.replace(/("(?:[^"\\]|\\.)*")/g, '<span class="hl-string">$1</span>');

        // 2. Comments (avoid matching keywords inside comments)
        // Multi-line comments
        esc = esc.replace(/(\/\*[\s\S]*?\*\/)/g, '<span class="hl-comment">$1</span>');
        // Single-line comments (ensure we don't match comments inside existing HTML tags/strings)
        esc = esc.replace(/(\/\/.*)(?![^<>]*>)/g, '<span class="hl-comment">$1</span>');

        // 3. Preprocessor directives
        esc = esc.replace(/(#include &lt;.*&gt;|#include ".*"|#pragma .*|#define .*)/g, '<span class="hl-preprocessor">$1</span>');

        // Keywords (using lookahead to avoid matching tags and attributes)
        const keywords = [
            'public', 'private', 'protected', 'explicit', 'noexcept', 'template', 'typename',
            'static', 'constexpr', 'using', 'struct', 'class', 'const', 'return', 'new', 'delete',
            'nullptr', 'sizeof', 'alignof', 'decltype', 'try', 'catch', 'throw', 'if', 'else', 'for', 'while'
        ];
        keywords.forEach(kw => {
            const regex = new RegExp(`\\b(${kw})\\b(?![^<>]*>)`, 'g');
            esc = esc.replace(regex, '<span class="hl-keyword">$1</span>');
        });

        // Types (using lookahead)
        const types = [
            'int', 'size_t', 'void', 'uint8_t', 'uintptr_t', 'char', 'float', 'double', 'bool', 'value_type',
            'propagate_on_container_move_assignment', 'is_always_equal', 'rebind', 'other', 'T', 'AllocatorType'
        ];
        types.forEach(t => {
            const regex = new RegExp(`\\b(${t})\\b(?![^<>]*>)`, 'g');
            esc = esc.replace(regex, '<span class="hl-type">$1</span>');
        });

        // Numbers (using lookahead)
        esc = esc.replace(/\b(\d+)\b(?![^<>]*>)/g, '<span class="hl-number">$1</span>');

        return esc;
    }

    // -----------------------------------------------------------------
    // Global Reset Button
    // -----------------------------------------------------------------
    document.getElementById('global-reset-btn').addEventListener('click', () => {
        // Reset Arena
        currentArena.reset();
        renderArenaGrid();
        logArenaMsg('System: Global lab reset performed.', 'system-msg');
        
        // Reset Pool
        currentPool.reset();
        renderPoolGrid();
        logPoolMsg('System: Global lab reset performed.', 'system-msg');

        // Clear Benchmarks
        arenaStdTime.textContent = '-- ms';
        arenaCustomTime.textContent = '-- ms';
        arenaSpeedupBox.classList.add('hide');
        arenaStdBar.style.width = '0%';
        arenaCustomBar.style.width = '0%';

        poolStdTime.textContent = '-- ms';
        poolCustomTime.textContent = '-- ms';
        poolSpeedupBox.classList.add('hide');
        poolStdBar.style.width = '0%';
        poolCustomBar.style.width = '0%';

        logArenaMsg('Global laboratory elements reset.', 'warn-msg');
    });

    function parseStructsAndClasses(code) {
        const structSizes = {};
        const structAlignments = {};

        // Remove comments to prevent parsing issues
        const cleanCode = code
            .replace(/\/\/.*$/gm, '')
            .replace(/\/\*[\s\S]*?\*\//g, '');

        const structRegex = /(?:struct|class)\s+(\w+)\s*\{([\s\S]*?)\}\s*;/g;
        let match;

        while ((match = structRegex.exec(cleanCode)) !== null) {
            const name = match[1];
            const body = match[2];

            let currentOffset = 0;
            let maxMemberAlignment = 1;

            const fields = body.split(';');
            fields.forEach(field => {
                let stmt = field.trim();
                // Strip access specifiers
                stmt = stmt.replace(/^(public|private|protected)\s*:/, '').trim();
                if (stmt === '') return;

                // Detect pointer type
                const isPointer = stmt.includes('*');

                // Detect array bracket
                const arrayMatch = stmt.match(/\[\s*(\d+)\s*\]/);
                let arrayMultiplier = 1;
                if (arrayMatch) {
                    arrayMultiplier = parseInt(arrayMatch[1]);
                    stmt = stmt.replace(/\[\s*(\d+)\s*\]/g, ''); // strip brackets
                }

                // Extract type name: the first word
                const words = stmt.split(/\s+/).filter(w => w !== '');
                if (words.length < 2 && !isPointer) return; // Not a variable declaration

                const typeName = words[0];

                // Determine type size and alignment
                let memberSize = 4;
                let memberAlign = 4;

                if (isPointer) {
                    memberSize = 8;
                    memberAlign = 8;
                } else if (structSizes[typeName]) {
                    memberSize = structSizes[typeName];
                    memberAlign = structAlignments[typeName];
                } else {
                    switch (typeName) {
                        case 'char':
                        case 'bool':
                        case 'uint8_t':
                        case 'int8_t':
                            memberSize = 1;
                            memberAlign = 1;
                            break;
                        case 'short':
                        case 'uint16_t':
                        case 'int16_t':
                            memberSize = 2;
                            memberAlign = 2;
                            break;
                        case 'int':
                        case 'float':
                        case 'uint32_t':
                        case 'int32_t':
                            memberSize = 4;
                            memberAlign = 4;
                            break;
                        case 'double':
                        case 'long':
                        case 'uint64_t':
                        case 'int64_t':
                            memberSize = 8;
                            memberAlign = 8;
                            break;
                        default:
                            memberSize = 4;
                            memberAlign = 4;
                            break;
                    }
                }

                // Align currentOffset to memberAlign
                const padding = (memberAlign - (currentOffset % memberAlign)) % memberAlign;
                currentOffset += padding;

                // Add member size
                currentOffset += memberSize * arrayMultiplier;

                // Update max alignment
                if (memberAlign > maxMemberAlignment) {
                    maxMemberAlignment = memberAlign;
                }
            });

            // Round up total size to structure alignment
            const structPadding = (maxMemberAlignment - (currentOffset % maxMemberAlignment)) % maxMemberAlignment;
            const totalSize = currentOffset + structPadding;

            structSizes[name] = totalSize;
            structAlignments[name] = maxMemberAlignment;
        }

        return { sizes: structSizes, alignments: structAlignments };
    }

    // -----------------------------------------------------------------
    // C++ Sandbox Implementation
    // -----------------------------------------------------------------
    const sandboxTextarea = document.getElementById('sandbox-textarea');
    const sandboxHighlightArea = document.getElementById('sandbox-highlight-area');
    const sandboxTemplateSelect = document.getElementById('sandbox-template-select');
    const sandboxParseBtn = document.getElementById('sandbox-parse-btn');
    const sandboxClearBtn = document.getElementById('sandbox-clear-btn');
    const sandboxExecutionList = document.getElementById('sandbox-execution-list');
    
    const sandboxPrevBtn = document.getElementById('sandbox-prev-btn');
    const sandboxPlayBtn = document.getElementById('sandbox-play-btn');
    const sandboxNextBtn = document.getElementById('sandbox-next-btn');
    
    const sandboxTotalStepsVal = document.getElementById('sandbox-total-steps-val');
    const sandboxCurrentStepVal = document.getElementById('sandbox-current-step-val');

    let parsedSteps = [];
    let currentStepIndex = -1;
    let variableToMemoryMap = {}; // Maps variable names (e.g. b1) to allocated indices
    let activeSimulationType = 'arena'; // 'arena' or 'pool'

    const templates = {
        'arena-basic': `// Arena Bump Allocator basic operations
ArenaAllocator arena(256);

void* p1 = arena.allocate(48);      // Allocate 48 bytes
void* p2 = arena.allocate(32);      // Allocate 32 bytes
void* p3 = arena.allocate(64);      // Allocate 64 bytes

arena.reset();                      // Release all allocations`,

        'arena-alignment': `// Arena Dynamic Alignment padding simulation
ArenaAllocator arena(256);

void* p1 = arena.allocate(30, 16);  // Offset 0, fits 16-byte alignment
void* p2 = arena.allocate(20, 8);   // Offset 30 + 2 padding = 32
void* p3 = arena.allocate(15, 16);  // Offset 52 + 12 padding = 64`,

        'pool-lifecycle': `// Pool Allocator block allocation and recycling
PoolAllocator<32> pool(256); // 8 blocks of 32 bytes

void* b0 = pool.allocate();
void* b1 = pool.allocate();
void* b2 = pool.allocate();

pool.deallocate(b1);        // Return block 1
void* b3 = pool.allocate(); // Should reuse block 1`,

        'custom-struct': `// Define custom structures and simulate allocations
struct Particle {
    float position[3]; // 12 bytes
    float velocity[3]; // 12 bytes
}; // Particle size = 24 bytes, alignment = 4 bytes

struct GameObject {
    int id;            // 4 bytes
    char name[16];     // 16 bytes
    double health;     // 8 bytes
}; // GameObject size = 32 bytes (aligned to 8 bytes)

ArenaAllocator arena(256);

// Allocate custom objects into the arena!
void* p1 = arena.allocate(sizeof(Particle), alignof(Particle));
void* p2 = arena.allocate(sizeof(GameObject), alignof(GameObject));
void* p3 = new Particle; // Allocates exactly 24 bytes in the arena`,

        'custom': ``
    };

    // Textarea sync scroll and highlighting
    sandboxTextarea.addEventListener('input', () => {
        const text = sandboxTextarea.value;
        sandboxHighlightArea.innerHTML = highlightCPP(text);
    });

    sandboxTextarea.addEventListener('scroll', () => {
        sandboxHighlightArea.scrollTop = sandboxTextarea.scrollTop;
        sandboxHighlightArea.scrollLeft = sandboxTextarea.scrollLeft;
    });

    // Template selection
    sandboxTemplateSelect.addEventListener('change', () => {
        const templateKey = sandboxTemplateSelect.value;
        sandboxTextarea.value = templates[templateKey];
        sandboxHighlightArea.innerHTML = highlightCPP(sandboxTextarea.value);
        resetExecutionQueue();
    });

    sandboxClearBtn.addEventListener('click', () => {
        sandboxTextarea.value = '';
        sandboxHighlightArea.innerHTML = '';
        sandboxTemplateSelect.value = 'custom';
        resetExecutionQueue();
    });

    function resetExecutionQueue() {
        parsedSteps = [];
        currentStepIndex = -1;
        variableToMemoryMap = {};
        sandboxExecutionList.innerHTML = `
            <div class="empty-execution-placeholder">
                <i class="fa-solid fa-circle-info"></i>
                <p>Write code on the left and click <strong>Parse Allocations</strong> to populate the execution queue.</p>
            </div>`;
        sandboxTotalStepsVal.textContent = '0';
        sandboxCurrentStepVal.textContent = '-- / --';
        sandboxPrevBtn.disabled = true;
        sandboxPlayBtn.disabled = true;
        sandboxNextBtn.disabled = true;
    }

    // Parsing engine
    sandboxParseBtn.addEventListener('click', () => {
        const codeText = sandboxTextarea.value;
        const codeLines = codeText.split('\n');

        // 1. Run struct/class layout parser
        const parsedRegistry = parseStructsAndClasses(codeText);
        const typeSizes = parsedRegistry.sizes;
        const typeAlignments = parsedRegistry.alignments;

        parsedSteps = [];
        variableToMemoryMap = {};
        currentStepIndex = -1;

        codeLines.forEach((line, index) => {
            const trimmed = line.trim();
            if (trimmed.startsWith('//') || trimmed === '') return;

            const lineNum = index + 1;

            // Resolve sizeof(...) and alignof(...) in the line
            let processedLine = trimmed;
            processedLine = processedLine.replace(/sizeof\s*\(\s*(\w+)\s*\)/g, (match, type) => {
                if (typeSizes[type] !== undefined) {
                    return typeSizes[type];
                }
                const stdSizes = { 'char': 1, 'bool': 1, 'short': 2, 'int': 4, 'float': 4, 'double': 8, 'void*': 8, 'int*': 8, 'char*': 8 };
                return stdSizes[type] || 4; 
            });

            processedLine = processedLine.replace(/alignof\s*\(\s*(\w+)\s*\)/g, (match, type) => {
                if (typeAlignments[type] !== undefined) {
                    return typeAlignments[type];
                }
                const stdAlignments = { 'char': 1, 'bool': 1, 'short': 2, 'int': 4, 'float': 4, 'double': 8, 'void*': 8, 'int*': 8, 'char*': 8 };
                return stdAlignments[type] || 4;
            });

            // 1. Arena init: ArenaAllocator arena(256);
            const arenaInitMatch = processedLine.match(/ArenaAllocator\s+(\w+)\s*\((\d+)\)/);
            if (arenaInitMatch) {
                activeSimulationType = 'arena';
                parsedSteps.push({
                    type: 'arena_init',
                    allocatorName: arenaInitMatch[1],
                    size: parseInt(arenaInitMatch[2]),
                    lineText: trimmed,
                    lineNumber: lineNum
                });
                return;
            }

            // 2. Pool init: PoolAllocator<32> pool(256);
            const poolInitMatch = processedLine.match(/PoolAllocator<\s*(\d+)\s*>\s+(\w+)\s*\((\d+)\)/);
            if (poolInitMatch) {
                activeSimulationType = 'pool';
                parsedSteps.push({
                    type: 'pool_init',
                    blockSize: parseInt(poolInitMatch[1]),
                    allocatorName: poolInitMatch[2],
                    size: parseInt(poolInitMatch[3]),
                    lineText: trimmed,
                    lineNumber: lineNum
                });
                return;
            }

            // 3. Standard C++ new operator: void* p = new Particle; or new Particle[4]
            const newMatch = processedLine.match(/(?:void\*\s+(\w+)\s*=\s*)?new\s+(\w+)(?:\s*\[\s*(\d+)\s*\])?\s*;/);
            if (newMatch) {
                const varName = newMatch[1] || `anon_${lineNum}`;
                const typeName = newMatch[2];
                const count = newMatch[3] ? parseInt(newMatch[3]) : 1;

                let itemSize = 4;
                let itemAlign = 4;

                if (typeSizes[typeName]) {
                    itemSize = typeSizes[typeName];
                    itemAlign = typeAlignments[typeName];
                } else {
                    const stdSizes = { 'char': 1, 'bool': 1, 'short': 2, 'int': 4, 'float': 4, 'double': 8 };
                    itemSize = stdSizes[typeName] || 4;
                    itemAlign = itemSize > 8 ? 8 : itemSize;
                }

                if (activeSimulationType === 'arena') {
                    parsedSteps.push({
                        type: 'arena_alloc',
                        varName: varName,
                        allocatorName: 'arena',
                        size: itemSize * count,
                        alignment: itemAlign,
                        lineText: trimmed,
                        lineNumber: lineNum
                    });
                } else {
                    // Pool allocate
                    for (let c = 0; c < count; c++) {
                        parsedSteps.push({
                            type: 'pool_alloc',
                            varName: count === 1 ? varName : `${varName}_${c}`,
                            allocatorName: 'pool',
                            lineText: `${trimmed} (block ${c + 1}/${count})`,
                            lineNumber: lineNum
                        });
                    }
                }
                return;
            }

            // 4. Arena allocate: void* p1 = arena.allocate(48, 8); or arena.allocate(48)
            const arenaAllocMatch = processedLine.match(/(?:void\*\s+(\w+)\s*=\s*)?(\w+)\.allocate\(\s*(\d+)\s*(?:,\s*(\d+)\s*)?\)/);
            if (arenaAllocMatch && activeSimulationType === 'arena') {
                parsedSteps.push({
                    type: 'arena_alloc',
                    varName: arenaAllocMatch[1] || `anon_${lineNum}`,
                    allocatorName: arenaAllocMatch[2],
                    size: parseInt(arenaAllocMatch[3]),
                    alignment: arenaAllocMatch[4] ? parseInt(arenaAllocMatch[4]) : 8,
                    lineText: trimmed,
                    lineNumber: lineNum
                });
                return;
            }

            // 5. Pool allocate: void* b1 = pool.allocate();
            const poolAllocMatch = processedLine.match(/(?:void\*\s+(\w+)\s*=\s*)?(\w+)\.allocate\(\)/);
            if (poolAllocMatch && activeSimulationType === 'pool') {
                parsedSteps.push({
                    type: 'pool_alloc',
                    varName: poolAllocMatch[1] || `anon_${lineNum}`,
                    allocatorName: poolAllocMatch[2],
                    lineText: trimmed,
                    lineNumber: lineNum
                });
                return;
            }

            // 6. Pool deallocate: pool.deallocate(b1);
            const poolDeallocMatch = processedLine.match(/(\w+)\.deallocate\(\s*(\w+)\s*\)/);
            if (poolDeallocMatch && activeSimulationType === 'pool') {
                parsedSteps.push({
                    type: 'pool_dealloc',
                    allocatorName: poolDeallocMatch[1],
                    varName: poolDeallocMatch[2],
                    lineText: trimmed,
                    lineNumber: lineNum
                });
                return;
            }

            // 7. Reset: arena.reset() or pool.reset()
            const resetMatch = processedLine.match(/(\w+)\.reset\(\)/);
            if (resetMatch) {
                parsedSteps.push({
                    type: 'reset',
                    allocatorName: resetMatch[1],
                    lineText: trimmed,
                    lineNumber: lineNum
                });
                return;
            }
        });

        if (parsedSteps.length === 0) {
            sandboxExecutionList.innerHTML = `
                <div class="empty-execution-placeholder text-amber">
                    <i class="fa-solid fa-triangle-exclamation"></i>
                    <p>No valid allocator operations found in your C++ code. Make sure you initialize an Allocator and perform calls like .allocate() or .deallocate().</p>
                </div>`;
            return;
        }

        renderExecutionSteps();
    });

    function renderExecutionSteps() {
        sandboxExecutionList.innerHTML = '';
        sandboxTotalStepsVal.textContent = parsedSteps.length;
        updatePlaybackControls();

        parsedSteps.forEach((step, index) => {
            const item = document.createElement('div');
            item.className = 'execution-step-item';
            item.id = `step-item-${index}`;

            const details = document.createElement('div');
            details.className = 'step-details';

            const num = document.createElement('span');
            num.className = 'step-number';
            num.textContent = `L${step.lineNumber}`;
            details.appendChild(num);

            const desc = document.createElement('span');
            desc.className = 'step-desc';
            desc.textContent = getStepDescriptionText(step);
            details.appendChild(desc);

            item.appendChild(details);

            const status = document.createElement('i');
            status.className = 'fa-solid fa-circle step-status-icon pending';
            item.appendChild(status);

            // Bind click to execute up to this step
            item.addEventListener('click', () => {
                jumpToStep(index);
            });

            sandboxExecutionList.appendChild(item);
        });
    }

    function getStepDescriptionText(step) {
        switch (step.type) {
            case 'arena_init':
                return `Init Arena: ${step.allocatorName} (size: ${step.size}B)`;
            case 'pool_init':
                return `Init Pool: ${step.allocatorName} (block: ${step.blockSize}B, size: ${step.size}B)`;
            case 'arena_alloc':
                return `Allocate ${step.size}B (align: ${step.alignment}) -> ${step.varName}`;
            case 'pool_alloc':
                return `Allocate Pool Block -> ${step.varName}`;
            case 'pool_dealloc':
                return `Deallocate Block: ${step.varName}`;
            case 'reset':
                return `Reset: ${step.allocatorName}`;
            default:
                return step.lineText;
        }
    }

    function updatePlaybackControls() {
        sandboxPrevBtn.disabled = currentStepIndex < 0;
        sandboxNextBtn.disabled = currentStepIndex >= parsedSteps.length - 1;
        sandboxPlayBtn.disabled = parsedSteps.length === 0;

        if (parsedSteps.length > 0) {
            sandboxCurrentStepVal.textContent = `${currentStepIndex + 1} / ${parsedSteps.length}`;
        } else {
            sandboxCurrentStepVal.textContent = '-- / --';
        }
    }

    function runSimulationAction(step) {
        if (step.type === 'arena_init') {
            // Reconfigure Arena size input and instantiate
            arenaSizeInput.value = step.size;
            currentArena = new ArenaSimulator(step.size);
            logArenaMsg(`Sandbox: Reinitialized Arena with ${step.size} bytes.`, 'system-msg');
            renderArenaGrid();
            
            // Switch view
            switchToPanelTab('arena-sim');
        } 
        else if (step.type === 'pool_init') {
            // Reconfigure Pool input and instantiate
            poolSizeInput.value = step.size;
            poolBlockSizeInput.value = step.blockSize;
            poolAlignmentSelect.value = 8; // Default alignment for sandbox init
            
            currentPool = new PoolSimulator(step.size, step.blockSize, 8);
            logPoolMsg(`Sandbox: Reinitialized Pool with ${step.size} bytes (block size: ${step.blockSize}B).`, 'system-msg');
            renderPoolGrid();

            switchToPanelTab('pool-sim');
        }
        else if (step.type === 'arena_alloc') {
            const result = currentArena.allocate(step.size, step.alignment);
            if (result.success) {
                logArenaMsg(`Sandbox: Allocated ${step.size} bytes (aligned to ${step.alignment}) at offset ${result.allocation.payloadStart}.`, 'alloc-msg');
                renderArenaGrid();
            } else {
                logArenaMsg(`Sandbox Error: ${result.error}`, 'warn-msg');
            }
            switchToPanelTab('arena-sim');
        }
        else if (step.type === 'pool_alloc') {
            const result = currentPool.allocate();
            if (result.success) {
                // Save variable to index mapping
                variableToMemoryMap[step.varName] = result.index;
                logPoolMsg(`Sandbox: Allocated Block ${result.index} -> stored in ${step.varName}.`, 'alloc-msg');
                renderPoolGrid();
            } else {
                logPoolMsg(`Sandbox Error: ${result.error}`, 'warn-msg');
            }
            switchToPanelTab('pool-sim');
        }
        else if (step.type === 'pool_dealloc') {
            const blockIndex = variableToMemoryMap[step.varName];
            if (blockIndex === undefined) {
                logPoolMsg(`Sandbox Error: Variable '${step.varName}' does not reference an active allocated block.`, 'warn-msg');
            } else {
                const result = currentPool.deallocate(blockIndex);
                if (result.success) {
                    logPoolMsg(`Sandbox: Deallocated Block ${blockIndex} (variable '${step.varName}').`, 'dealloc-msg');
                    renderPoolGrid();
                } else {
                    logPoolMsg(`Sandbox Error: ${result.error}`, 'warn-msg');
                }
            }
            switchToPanelTab('pool-sim');
        }
        else if (step.type === 'reset') {
            if (activeSimulationType === 'arena') {
                currentArena.reset();
                logArenaMsg('Sandbox: Reset Arena.', 'system-msg');
                renderArenaGrid();
                switchToPanelTab('arena-sim');
            } else {
                currentPool.reset();
                logPoolMsg('Sandbox: Reset Pool.', 'system-msg');
                renderPoolGrid();
                switchToPanelTab('pool-sim');
            }
        }
    }

    function switchToPanelTab(tabId) {
        // Toggle nav items
        navItems.forEach(item => {
            item.classList.remove('active');
            if (item.dataset.tab === tabId) {
                item.classList.add('active');
            }
        });

        // Toggle panel containers
        tabPanels.forEach(panel => {
            panel.classList.remove('active');
            if (panel.id === `${tabId}-panel`) {
                panel.classList.add('active');
            }
        });

        // Update headers
        currentTabTitle.textContent = tabMetadata[tabId].title;
        currentTabDesc.textContent = tabMetadata[tabId].desc;
    }

    function jumpToStep(targetIndex) {
        if (targetIndex < -1 || targetIndex >= parsedSteps.length) return;

        // 1. Reset all structures to initial state
        if (activeSimulationType === 'arena') {
            currentArena.reset();
            renderArenaGrid();
        } else {
            currentPool.reset();
            renderPoolGrid();
        }
        variableToMemoryMap = {};

        // 2. Play actions sequentially up to targetIndex
        for (let i = 0; i <= targetIndex; i++) {
            runSimulationAction(parsedSteps[i]);
        }

        // 3. Update active item highlights
        currentStepIndex = targetIndex;
        updateStepHighlight();
        updatePlaybackControls();
    }

    function updateStepHighlight() {
        for (let i = 0; i < parsedSteps.length; i++) {
            const item = document.getElementById(`step-item-${i}`);
            const icon = item.querySelector('.step-status-icon');
            
            item.classList.remove('active', 'completed');
            icon.className = 'fa-solid step-status-icon';

            if (i < currentStepIndex) {
                item.classList.add('completed');
                icon.classList.add('fa-circle-check', 'completed');
            } else if (i === currentStepIndex) {
                item.classList.add('active');
                icon.classList.add('fa-circle-play', 'active');
            } else {
                icon.classList.add('fa-circle', 'pending');
            }
        }
    }

    sandboxNextBtn.addEventListener('click', () => {
        if (currentStepIndex < parsedSteps.length - 1) {
            currentStepIndex++;
            runSimulationAction(parsedSteps[currentStepIndex]);
            updateStepHighlight();
            updatePlaybackControls();
        }
    });

    sandboxPrevBtn.addEventListener('click', () => {
        if (currentStepIndex >= 0) {
            jumpToStep(currentStepIndex - 1);
        }
    });

    sandboxPlayBtn.addEventListener('click', () => {
        if (currentStepIndex < parsedSteps.length - 1) {
            sandboxNextBtn.click();
        } else {
            // Restart from beginning
            jumpToStep(0);
        }
    });
});
