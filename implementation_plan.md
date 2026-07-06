# High-Performance Custom Memory Allocator

This project implements two high-performance custom memory allocators in modern C++ (Arena Allocator and Pool Allocator) designed to bypass the overhead of general-purpose heap allocation (such as system `malloc`/`free` or `new`/`delete`). The project includes an STL-compliant adapter to use these allocators with standard library containers, and a comprehensive microbenchmarking suite to demonstrate their efficiency.

## Proposed Allocators

### 1. Arena Allocator (Linear Allocator)
- **Concept**: Pre-allocates a large contiguous block of memory. Allocations simply move a cursor/pointer forward (bump allocation).
- **Time Complexity**: $O(1)$ allocation, $O(1)$ deallocation (deallocation is a no-op, all memory is freed at once when resetting the arena).
- **Use Case**: Excellent for temporary objects with matching lifetimes (e.g., per-frame data in games, per-request context in web servers).
- **Aesthetic/Optimization**: Cache-friendly contiguous memory layout, customizable alignment, and optional bounds checking.

### 2. Pool Allocator (Fixed-Size Block Allocator)
- **Concept**: Pre-allocates memory and splits it into blocks of a fixed size. Unused blocks are tracked using a singly linked list (Free List) stored within the free blocks themselves (zero memory overhead).
- **Time Complexity**: $O(1)$ allocation (pop from free list), $O(1)$ deallocation (push back to free list).
- **Use Case**: Ideal for many allocations of the same size (e.g., node-based containers like `std::list`, `std::map`, or game entity pools).
- **Aesthetic/Optimization**: Zero external fragmentation, fast reuse of freed blocks, CPU cache line size alignment.

---

## Proposed Changes

### Core Library

#### [NEW] [ArenaAllocator.hpp](file:///d:/CPPProject/ArenaAllocator.hpp)
An Arena (or Linear) Allocator header-only implementation.
- Manages a contiguous raw byte buffer.
- `allocate(size_t size, size_t alignment = alignof(std::max_align_t))` uses pointer bumping with proper alignment math.
- `reset()` resets the bump pointer to the beginning.
- Prevents individual deallocations (they are no-ops).

#### [NEW] [PoolAllocator.hpp](file:///d:/CPPProject/PoolAllocator.hpp)
A Pool Allocator header-only implementation for fixed-size allocations.
- Manages a contiguous raw byte buffer partitioned into slots of `BlockSize`.
- Contains a nested `struct Node` representing elements of the Free List (pointing to the next free block).
- `allocate()` returns the head of the free list.
- `deallocate(void* ptr)` adds the block back to the free list.

#### [NEW] [STLAdapter.hpp](file:///d:/CPPProject/STLAdapter.hpp)
A wrapper to make custom allocators compliant with the C++ Standard Library Allocator concept.
- Defines standard types (`value_type`, pointer types, copy constructors, etc.).
- Allows using `std::vector`, `std::list`, `std::unordered_map` with our custom arena or pool memory sources.

### Benchmarks & Testing

#### [NEW] [main.cpp](file:///d:/CPPProject/main.cpp)
Main driver application containing:
- Test cases verifying correctness (e.g., standard vector/list operations with custom allocators).
- Microbenchmarks comparing our allocators against standard `std::allocator` using high-resolution timers.
- Visual profiling output showing speedup ratios.

#### [NEW] [CMakeLists.txt](file:///d:/CPPProject/CMakeLists.txt)
CMake build script to configure the project, set compile flags (optimized release builds), and build the executable.

---

## Build Environment
- **Compiler**: GCC 16.1.0 (`g++.exe`) located in `C:\Users\DevaSri\AppData\Local\Temp\WinGet\BrechtSanders.WinLibs.POSIX.UCRT.16.1.0-14.0.0-r2\extracted\mingw64\bin\g++.exe`.
- **Build System**: CMake 4.3.3 and Ninja build generator.
- **Language Standard**: C++20.

---

## Verification Plan

### Automated Benchmarks
We will compile the project in **Release mode** (with optimizations `-O3` or `/O2`) and run the benchmarks to verify:
1. Correctness of memory allocation, alignment, and data persistence.
2. Performance improvements: We expect Arena allocations to be significantly faster (up to 10-100x) than standard heap allocation.
3. Node allocation performance: We expect the Pool Allocator to outperform standard heap allocation when constructing node-based structures like linked lists.

### Manual Verification
- We will inspect the generated benchmark output showing execution times (in microseconds or nanoseconds) and allocations per second.
