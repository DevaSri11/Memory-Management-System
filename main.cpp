#include <iostream>
#include <vector>
#include <list>
#include <chrono>
#include <iomanip>
#include <cassert>
#include <memory>
#include "ArenaAllocator.hpp"
#include "PoolAllocator.hpp"
#include "STLAdapter.hpp"

// Simple benchmark timer
class Timer {
public:
    Timer() : m_start(std::chrono::high_resolution_clock::now()) {}
    
    void reset() {
        m_start = std::chrono::high_resolution_clock::now();
    }
    
    double elapsed_microseconds() const {
        auto end = std::chrono::high_resolution_clock::now();
        return std::chrono::duration<double, std::micro>(end - m_start).count();
    }
    
    double elapsed_milliseconds() const {
        return elapsed_microseconds() / 1000.0;
    }
private:
    std::chrono::time_point<std::chrono::high_resolution_clock> m_start;
};

// Node structure used for testing
struct HeavyNode {
    int data[8]; // 32 bytes
    
    HeavyNode() {
        for (int i = 0; i < 8; ++i) data[i] = i;
    }
};

void run_correctness_tests() {
    std::cout << "==========================================\n";
    std::cout << "       RUNNING CORRECTNESS TESTS          \n";
    std::cout << "==========================================\n";

    // 1. Test Arena Allocator
    std::cout << "[ArenaAllocator] Testing direct allocation... ";
    {
        ArenaAllocator arena(1024);
        int* p1 = static_cast<int*>(arena.allocate(sizeof(int), alignof(int)));
        int* p2 = static_cast<int*>(arena.allocate(sizeof(int), alignof(int)));
        *p1 = 42;
        *p2 = 100;
        assert(*p1 == 42);
        assert(*p2 == 100);
        assert(arena.used_memory() >= 2 * sizeof(int));
        
        arena.reset();
        assert(arena.used_memory() == 0);
    }
    std::cout << "PASSED\n";

    // 2. Test STL Adapter with std::vector + ArenaAllocator
    std::cout << "[STLAdapter + std::vector] Testing with ArenaAllocator... ";
    {
        ArenaAllocator arena(4096);
        using ArenaAdapter = STLAdapter<int, ArenaAllocator>;
        
        std::vector<int, ArenaAdapter> vec((ArenaAdapter(&arena)));
        vec.push_back(10);
        vec.push_back(20);
        vec.push_back(30);
        
        assert(vec.size() == 3);
        assert(vec[0] == 10);
        assert(vec[1] == 20);
        assert(vec[2] == 30);
    }
    std::cout << "PASSED\n";

    // 3. Test Pool Allocator
    std::cout << "[PoolAllocator] Testing block allocation & reuse... ";
    {
        constexpr size_t BlockSize = sizeof(HeavyNode);
        PoolAllocator<BlockSize> pool(BlockSize * 4);
        
        void* b1 = pool.allocate();
        void* b2 = pool.allocate();
        void* b3 = pool.allocate();
        
        assert(pool.allocated_blocks() == 3);
        assert(pool.free_blocks() == 1);
        
        // Deallocate b2 and reallocate to verify reuse
        pool.deallocate(b2);
        assert(pool.allocated_blocks() == 2);
        
        void* b4 = pool.allocate();
        // Since it's a LIFO free list, b4 should reuse the block of b2
        assert(b4 == b2);
        assert(pool.allocated_blocks() == 3);
        
        pool.deallocate(b1);
        pool.deallocate(b3);
        pool.deallocate(b4);
        assert(pool.allocated_blocks() == 0);
    }
    std::cout << "PASSED\n";

    std::cout << "All correctness tests passed successfully!\n\n";
}

void run_arena_benchmarks() {
    std::cout << "==========================================\n";
    std::cout << "         ARENA ALLOCATOR BENCHMARK        \n";
    std::cout << "==========================================\n";
    std::cout << "Simulation: 1,000 frames. In each frame, we allocate\n"
              << "various object sizes, use them, and free them.\n\n";

    constexpr size_t NumFrames = 1000;
    constexpr size_t AllocationsPerFrame = 5000;
    constexpr size_t ArenaSize = 5000 * 64; // Plenty of space

    // Benchmark Standard Heap Allocator
    double stdTime = 0.0;
    {
        Timer timer;
        for (size_t frame = 0; frame < NumFrames; ++frame) {
            std::vector<void*> ptrs;
            ptrs.reserve(AllocationsPerFrame);
            for (size_t i = 0; i < AllocationsPerFrame; ++i) {
                // Varying sizes
                size_t size = (i % 4 + 1) * 8;
                ptrs.push_back(::operator new(size));
            }
            for (void* ptr : ptrs) {
                ::operator delete(ptr);
            }
        }
        stdTime = timer.elapsed_milliseconds();
    }

    // Benchmark Arena Allocator
    double arenaTime = 0.0;
    {
        ArenaAllocator arena(ArenaSize);
        Timer timer;
        for (size_t frame = 0; frame < NumFrames; ++frame) {
            std::vector<void*> ptrs;
            ptrs.reserve(AllocationsPerFrame);
            for (size_t i = 0; i < AllocationsPerFrame; ++i) {
                size_t size = (i % 4 + 1) * 8;
                ptrs.push_back(arena.allocate(size));
            }
            // Deallocation is a single reset at the end of the frame!
            arena.reset();
        }
        arenaTime = timer.elapsed_milliseconds();
    }

    std::cout << std::left << std::setw(25) << "Allocator Type" 
              << std::right << std::setw(15) << "Time (ms)" 
              << std::setw(20) << "Speedup" << "\n";
    std::cout << "------------------------------------------------------------\n";
    std::cout << std::left << std::setw(25) << "Standard (new/delete)" 
              << std::right << std::setw(15) << std::fixed << std::setprecision(2) << stdTime 
              << std::setw(20) << "1.0x (Baseline)" << "\n";
    std::cout << std::left << std::setw(25) << "Custom ArenaAllocator" 
              << std::right << std::setw(15) << std::fixed << std::setprecision(2) << arenaTime 
              << std::setw(20) << (stdTime / arenaTime) << "x" << "\n";
    std::cout << "==========================================\n\n";
}

void run_pool_benchmarks() {
    std::cout << "==========================================\n";
    std::cout << "          POOL ALLOCATOR BENCHMARK        \n";
    std::cout << "==========================================\n";
    std::cout << "Simulation: Allocate and deallocate 50,000\n"
              << "fixed-size blocks (32 bytes) in random orders.\n\n";

    constexpr size_t NumBlocks = 50000;
    constexpr size_t PoolSize = NumBlocks * sizeof(HeavyNode);

    // Warm up
    {
        std::vector<void*> ptrs;
        ptrs.reserve(NumBlocks);
        for (size_t i = 0; i < NumBlocks; ++i) {
            ptrs.push_back(::operator new(sizeof(HeavyNode)));
        }
        for (void* ptr : ptrs) {
            ::operator delete(ptr);
        }
    }

    // Benchmark Standard Heap Allocator
    double stdTime = 0.0;
    {
        std::vector<void*> ptrs(NumBlocks, nullptr);
        Timer timer;
        for (size_t run = 0; run < 10; ++run) {
            for (size_t i = 0; i < NumBlocks; ++i) {
                ptrs[i] = ::operator new(sizeof(HeavyNode));
            }
            for (size_t i = 0; i < NumBlocks; ++i) {
                ::operator delete(ptrs[i]);
            }
        }
        stdTime = timer.elapsed_milliseconds();
    }

    // Benchmark Pool Allocator
    double poolTime = 0.0;
    {
        PoolAllocator<sizeof(HeavyNode)> pool(PoolSize);
        std::vector<void*> ptrs(NumBlocks, nullptr);
        Timer timer;
        for (size_t run = 0; run < 10; ++run) {
            for (size_t i = 0; i < NumBlocks; ++i) {
                ptrs[i] = pool.allocate();
            }
            for (size_t i = 0; i < NumBlocks; ++i) {
                pool.deallocate(ptrs[i]);
            }
        }
        poolTime = timer.elapsed_milliseconds();
    }

    std::cout << std::left << std::setw(25) << "Allocator Type" 
              << std::right << std::setw(15) << "Time (ms)" 
              << std::setw(20) << "Speedup" << "\n";
    std::cout << "------------------------------------------------------------\n";
    std::cout << std::left << std::setw(25) << "Standard (new/delete)" 
              << std::right << std::setw(15) << std::fixed << std::setprecision(2) << stdTime 
              << std::setw(20) << "1.0x (Baseline)" << "\n";
    std::cout << std::left << std::setw(25) << "Custom PoolAllocator" 
              << std::right << std::setw(15) << std::fixed << std::setprecision(2) << poolTime 
              << std::setw(20) << (stdTime / poolTime) << "x" << "\n";
    std::cout << "==========================================\n\n";
}

int main() {
    try {
        run_correctness_tests();
        run_arena_benchmarks();
        run_pool_benchmarks();
    } catch (const std::exception& e) {
        std::cerr << "Exception occurred: " << e.what() << "\n";
        return 1;
    }
    return 0;
}